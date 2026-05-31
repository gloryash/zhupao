import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import type { User } from '../types'
import {
  fetchMe,
  loginAccount,
  logoutAccount,
  registerAccount,
  setAuthToken,
  setUnauthorizedHandler,
  type AuthSession,
  type RegisterProfile
} from '../services/api'

const STORAGE_KEY = 'blindrun.session.v1'

interface PersistedSession {
  authToken: string
  expiresAt: string
  user: User
}

interface SessionContextValue {
  user: User | null
  authToken: string | null
  expiresAt: string | null
  status: 'loading' | 'authenticated' | 'guest'
  login: (identifier: string, password: string) => Promise<void>
  register: (identifier: string, password: string, profile: RegisterProfile) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
  setUser: (user: User) => void
}

const SessionContext = createContext<SessionContextValue | null>(null)

function readStored(): PersistedSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedSession
    if (!parsed.authToken || !parsed.user) return null
    if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() <= Date.now()) return null
    return parsed
  } catch {
    return null
  }
}

function writeStored(session: PersistedSession | null): void {
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* storage may be unavailable; non-fatal */
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null)
  const [authToken, setToken] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'guest'>('loading')
  const clearingRef = useRef(false)

  const applySession = useCallback((session: AuthSession) => {
    setAuthToken(session.authToken)
    setToken(session.authToken)
    setExpiresAt(session.expiresAt)
    setUserState(session.user)
    setStatus('authenticated')
    writeStored({ authToken: session.authToken, expiresAt: session.expiresAt, user: session.user })
  }, [])

  const clearSession = useCallback(() => {
    setAuthToken(null)
    setToken(null)
    setExpiresAt(null)
    setUserState(null)
    setStatus('guest')
    writeStored(null)
  }, [])

  // Route unauthorized/expired backend errors back to the guest (login) state.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (clearingRef.current) return
      clearingRef.current = true
      clearSession()
      setTimeout(() => {
        clearingRef.current = false
      }, 0)
    })
    return () => setUnauthorizedHandler(null)
  }, [clearSession])

  // Hydrate from localStorage and validate the token against the backend.
  useEffect(() => {
    const stored = readStored()
    if (!stored) {
      setStatus('guest')
      return
    }
    setAuthToken(stored.authToken)
    setToken(stored.authToken)
    setExpiresAt(stored.expiresAt)
    setUserState(stored.user)
    setStatus('authenticated')

    fetchMe(stored.authToken)
      .then((fresh) => {
        setUserState(fresh)
        writeStored({ authToken: stored.authToken, expiresAt: stored.expiresAt, user: fresh })
      })
      .catch(() => {
        clearSession()
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const login = useCallback(
    async (identifier: string, password: string) => {
      const session = await loginAccount(identifier, password)
      applySession(session)
    },
    [applySession]
  )

  const register = useCallback(
    async (identifier: string, password: string, profile: RegisterProfile) => {
      const session = await registerAccount(identifier, password, profile)
      applySession(session)
    },
    [applySession]
  )

  const logout = useCallback(async () => {
    const token = authToken
    clearSession()
    if (token) {
      try {
        await logoutAccount(token)
      } catch {
        /* best-effort server-side revoke */
      }
    }
  }, [authToken, clearSession])

  const refreshUser = useCallback(async () => {
    if (!authToken) return
    const fresh = await fetchMe(authToken)
    setUserState(fresh)
    setExpiresAt((prev) => {
      writeStored({ authToken, expiresAt: prev || '', user: fresh })
      return prev
    })
  }, [authToken])

  const setUser = useCallback(
    (next: User) => {
      setUserState(next)
      if (authToken) writeStored({ authToken, expiresAt: expiresAt || '', user: next })
    },
    [authToken, expiresAt]
  )

  const value = useMemo<SessionContextValue>(
    () => ({ user, authToken, expiresAt, status, login, register, logout, refreshUser, setUser }),
    [user, authToken, expiresAt, status, login, register, logout, refreshUser, setUser]
  )

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used within SessionProvider')
  return ctx
}
