/**
 * Vite dev-only middleware that bridges the browser to CloudBase cloud
 * functions by spawning the repository-root `tcb` CLI (already installed at
 * <repo>/node_modules/.bin/tcb).
 *
 * This exists so local QA works even when direct browser CloudBase SDK
 * anonymous-auth / security-origin setup is unavailable. It is NEVER bundled
 * into the production build — it only runs inside the Vite dev server.
 *
 * Endpoint: POST /api/cloud-function
 *   body: { "name": "<functionName>", "data": { ...payload } }
 *   resp: the cloud function's own return value (the { success, ... } object)
 *
 * No credentials live here. The tcb CLI uses its own machine-local login state.
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import type { Connect, Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'

const DEFAULT_ENV = 'cloud1-d8gbfzr7t6c5dc8bc'
const INVOKE_TIMEOUT_MS = 60_000

const TCB_BIN_NAME = process.platform === 'win32' ? 'tcb.cmd' : 'tcb'

/**
 * Walk up from `start`, returning the first ancestor directory that contains
 * `node_modules/.bin/<tcb>`. The CloudBase CLI is installed at the repository
 * root (<repo>/node_modules/.bin/tcb), which is an ancestor of this file's
 * web/ directory — but it may also be installed web-locally. Searching upward
 * handles both layouts without hardcoding a level count.
 */
function findDirWithTcb(start: string): string | null {
  let dir = start
  for (;;) {
    if (existsSync(join(dir, 'node_modules', '.bin', TCB_BIN_NAME))) return dir
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

/** Repository root that owns the tcb CLI; used as both binary base and cwd. */
function repoRoot(): string {
  return findDirWithTcb(__dirname) ?? findDirWithTcb(process.cwd()) ?? resolve(__dirname, '..')
}

function tcbBinaryPath(root: string): string {
  return resolve(root, 'node_modules', '.bin', TCB_BIN_NAME)
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > 1_000_000) {
        reject(new Error('Request body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolvePromise(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function invokeCloudFunction(name: string, payload: unknown, envId: string): Promise<unknown> {
  return new Promise((resolvePromise, reject) => {
    const root = repoRoot()
    const tempDir = mkdtempSync(join(tmpdir(), 'blind-run-web-'))
    const payloadPath = join(tempDir, 'payload.json')
    writeFileSync(payloadPath, JSON.stringify(payload ?? {}), { mode: 0o600 })

    const child = spawn(
      tcbBinaryPath(root),
      ['fn', 'invoke', name, '-e', envId, '-d', `@${payloadPath}`, '--json'],
      {
        cwd: root,
        env: { ...process.env, CI: '1', CLOUDBASE_ENV: envId }
      }
    )

    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      cleanup()
      reject(new Error(`tcb fn invoke ${name} timed out`))
    }, INVOKE_TIMEOUT_MS)

    function cleanup() {
      clearTimeout(timer)
      rmSync(tempDir, { recursive: true, force: true })
    }

    child.stdout.on('data', (d) => (stdout += d.toString()))
    child.stderr.on('data', (d) => (stderr += d.toString()))
    child.on('error', (err) => {
      cleanup()
      reject(new Error(`Failed to run tcb CLI: ${err.message}`))
    })
    child.on('close', (code) => {
      cleanup()
      if (code !== 0) {
        reject(new Error(`tcb fn invoke ${name} exited ${code}: ${redact(stderr || stdout)}`))
        return
      }
      try {
        resolvePromise(extractFunctionResult(stdout, name))
      } catch (err) {
        reject(err)
      }
    })
  })
}

/** Pull the function's actual return value out of the tcb CLI JSON envelope. */
function extractFunctionResult(output: string, name: string): unknown {
  const values = extractJsonValues(output)
  if (values.length === 0) {
    throw new Error(`tcb fn invoke ${name} did not emit parseable JSON`)
  }
  const wrapper = values[values.length - 1] as Record<string, unknown>
  const data = (wrapper && (wrapper as any).data) ? (wrapper as any).data : wrapper

  if (data && typeof data.RetMsg === 'string') return JSON.parse(data.RetMsg)
  if (data && typeof data.body === 'string') return JSON.parse(data.body)
  if (data && data.RetMsg && typeof data.RetMsg === 'object') return data.RetMsg
  if (data && data.body && typeof data.body === 'object') return data.body
  return data
}

/** Scan for balanced top-level JSON blocks, ignoring CLI banners/log noise. */
function extractJsonValues(text: string): unknown[] {
  const values: unknown[] = []
  let start = -1
  let depth = 0
  let inString = false
  let escaping = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (inString) {
      if (escaping) escaping = false
      else if (char === '\\') escaping = true
      else if (char === '"') inString = false
      continue
    }
    if (char === '"') {
      inString = true
      continue
    }
    if (char === '{' || char === '[') {
      if (depth === 0) start = i
      depth++
      continue
    }
    if ((char === '}' || char === ']') && depth > 0) {
      depth--
      if (depth === 0 && start !== -1) {
        const candidate = text.slice(start, i + 1)
        try {
          values.push(JSON.parse(candidate))
        } catch {
          /* ignore non-JSON brace blocks */
        }
        start = -1
      }
    }
  }
  return values
}

function redact(output: string): string {
  return String(output || '')
    .replace(/"authToken"\s*:\s*"[^"]+"/g, '"authToken":"[redacted]"')
    .replace(/"password"\s*:\s*"[^"]+"/g, '"password":"[redacted]"')
    .trim()
}

export function cloudFunctionProxyPlugin(options: { envId?: string } = {}): Plugin {
  // Prefer the value vite.config passes from loadEnv (.env / .env.local), then
  // process.env using the same VITE_CLOUDBASE_ENV name the web app uses (or the
  // bare CLOUDBASE_ENV), then the shared default.
  const envId =
    options.envId ||
    process.env.VITE_CLOUDBASE_ENV ||
    process.env.CLOUDBASE_ENV ||
    DEFAULT_ENV

  const handler: Connect.NextHandleFunction = (req, res, next) => {
    const url = (req.url || '').split('?')[0]
    if (url !== '/api/cloud-function') {
      next()
      return
    }
    if (req.method !== 'POST') {
      sendJson(res, 405, { success: false, code: 'METHOD_NOT_ALLOWED', error: 'POST only' })
      return
    }

    readBody(req)
      .then(async (raw) => {
        let parsed: { name?: string; data?: unknown }
        try {
          parsed = raw ? JSON.parse(raw) : {}
        } catch {
          sendJson(res, 400, { success: false, code: 'BAD_REQUEST', error: 'Invalid JSON body' })
          return
        }
        const name = parsed.name
        if (!name || !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)) {
          sendJson(res, 400, { success: false, code: 'BAD_REQUEST', error: 'Invalid function name' })
          return
        }
        try {
          const result = await invokeCloudFunction(name, parsed.data ?? {}, envId)
          sendJson(res, 200, result)
        } catch (err) {
          sendJson(res, 502, {
            success: false,
            code: 'CLOUD_PROXY_ERROR',
            error: err instanceof Error ? err.message : String(err)
          })
        }
      })
      .catch((err) => {
        sendJson(res, 400, {
          success: false,
          code: 'BAD_REQUEST',
          error: err instanceof Error ? err.message : String(err)
        })
      })
  }

  return {
    name: 'cloudbase-function-dev-proxy',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler)
    }
  }
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(payload)
}
