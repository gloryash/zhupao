/**
 * CloudBase transport wrapper.
 *
 * Two interchangeable transports call the same cloud functions:
 *   - 'proxy': POST /api/cloud-function, which the Vite dev server bridges to
 *     the local `tcb` CLI. Works without browser-side anonymous auth /
 *     security-origin configuration, but only exists while the dev/preview
 *     server is running — it is NOT available in a deployed static build.
 *   - 'sdk': @cloudbase/js-sdk with anonymous sign-in, calling functions
 *     directly from the browser. The only transport that works for a deployed
 *     production site (requires the CloudBase console to allow the deploy
 *     origin as a security domain and to enable anonymous login).
 *
 * Default is environment-aware: 'proxy' during `vite` dev/serve, and 'sdk' in
 * a production build (`vite build`). Set VITE_CLOUDBASE_TRANSPORT=proxy|sdk to
 * override explicitly (e.g. to force the SDK while developing locally).
 *
 * The public env id (cloud1-...) is the only CloudBase identifier needed here;
 * no secrets are ever embedded.
 */
import type { CloudResponse } from '../types'

const DEFAULT_ENV = 'cloud1-d8gbfzr7t6c5dc8bc'

export const CLOUD_ENV =
  (import.meta.env.VITE_CLOUDBASE_ENV as string | undefined) || DEFAULT_ENV

type Transport = 'proxy' | 'sdk'

// Explicit override wins; otherwise default by build mode: proxy for the dev
// server (where the tcb-backed /api proxy exists), sdk for a deployed build.
const EXPLICIT_TRANSPORT = import.meta.env.VITE_CLOUDBASE_TRANSPORT as string | undefined

export const TRANSPORT: Transport =
  EXPLICIT_TRANSPORT === 'sdk' || EXPLICIT_TRANSPORT === 'proxy'
    ? EXPLICIT_TRANSPORT
    : import.meta.env.PROD
      ? 'sdk'
      : 'proxy'

export class CloudError extends Error {
  code: string
  response?: CloudResponse
  constructor(message: string, code = 'CLOUD_ERROR', response?: CloudResponse) {
    super(message)
    this.name = 'CloudError'
    this.code = code
    this.response = response
  }
}

/* ----------------------------- proxy transport ---------------------------- */

async function callViaProxy(name: string, data: Record<string, unknown>): Promise<CloudResponse> {
  let res: Response
  try {
    res = await fetch('/api/cloud-function', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, data })
    })
  } catch (err) {
    throw new CloudError(
      `无法连接本地云函数代理：${err instanceof Error ? err.message : String(err)}`,
      'NETWORK_ERROR'
    )
  }

  let body: unknown
  try {
    body = await res.json()
  } catch {
    throw new CloudError('云函数代理返回了无效响应', 'BAD_RESPONSE')
  }

  return body as CloudResponse
}

/* ------------------------------ sdk transport ----------------------------- */

let sdkAppPromise: Promise<{ callFunction: (opts: { name: string; data: unknown }) => Promise<{ result: unknown }> }> | null =
  null

async function getSdkApp() {
  if (!sdkAppPromise) {
    sdkAppPromise = (async () => {
      const mod = await import('@cloudbase/js-sdk')
      const cloudbase = (mod as { default?: unknown }).default ?? mod
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const app = (cloudbase as any).init({ env: CLOUD_ENV })
      const auth = app.auth({ persistence: 'local' })
      if (typeof auth.signInAnonymously === 'function') {
        const state = await auth.getLoginState?.()
        if (!state) await auth.signInAnonymously()
      }
      return app
    })()
  }
  return sdkAppPromise
}

async function callViaSdk(name: string, data: Record<string, unknown>): Promise<CloudResponse> {
  try {
    const app = await getSdkApp()
    const res = await app.callFunction({ name, data })
    return res.result as CloudResponse
  } catch (err) {
    throw new CloudError(
      `CloudBase SDK 调用失败：${err instanceof Error ? err.message : String(err)}`,
      'SDK_ERROR'
    )
  }
}

/* -------------------------------- dispatch -------------------------------- */

export async function callFunction(
  name: string,
  data: Record<string, unknown> = {}
): Promise<CloudResponse> {
  if (TRANSPORT === 'sdk') return callViaSdk(name, data)
  return callViaProxy(name, data)
}
