# Web CloudBase Conversion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first-phase mobile Web app while auditing and adapting the existing WeChat CloudBase backend for shared mini program and Web use.

**Architecture:** Keep WeChat CloudBase as the only backend. Add Web password authentication and a shared identity resolver, then retrofit core business cloud functions to accept either mini program `OPENID` or Web session tokens. Add a React/Vite/TypeScript mobile Web app under `web/`, with desktop-only phone preview frame and real browser verification through `agent-browser`.

**Tech Stack:** WeChat CloudBase cloud functions (`wx-server-sdk ~2.6.3`), CloudBase CLI, React, Vite, TypeScript, CloudBase JS SDK, Claude Code for frontend implementation, agent-browser for verification.

---

## File Structure

Create or modify these files:

- Create: `package.json` for root-level CloudBase scripts and dev tools.
- Modify: `.gitignore` to keep local credential files out of Git.
- Create: `scripts/cloudbase/verify-web-auth.js` for Web auth verification.
- Create: `scripts/cloudbase/verify-core-flow.js` for backend business-flow verification.
- Create: `scripts/cloudbase/compress-screenshot.js` for screenshot resizing before visual inspection.
- Create: `cloudfunctions/webAuth/index.js` and `cloudfunctions/webAuth/package.json`.
- Create: `cloudfunctions/_shared/auth.js`, `cloudfunctions/_shared/responses.js`, and `cloudfunctions/_shared/user.js` as canonical shared helpers.
- Create: `scripts/cloudbase/sync-shared.js` to copy shared helpers into each deployable function folder.
- Modify: `cloudfunctions/initDB/index.js` to initialize new auth collections and stay idempotent.
- Modify: `cloudfunctions/syncUserInfo/index.js` to support phone-based cross-platform user merge.
- Modify: `cloudfunctions/handleUser/index.js` to use shared identity resolution and stable response codes.
- Modify: `cloudfunctions/handleTraining/index.js` to use shared identity resolution and preserve public certificate verification.
- Modify: `cloudfunctions/handleVolunteer/index.js` to use shared identity resolution and protect availability changes.
- Modify: `cloudfunctions/handleOrder/index.js` to enforce training gate, valid state transitions, and idempotent completion rewards.
- Modify: `cloudfunctions/handleSchedule/index.js` to use shared identity resolution and fix appointment completion idempotency.
- Modify: `cloudfunctions/handleRecord/index.js` only for shared identity resolution if first-phase frontend needs today stats.
- Create: `web/package.json`, `web/vite.config.ts`, `web/tsconfig.json`, `web/index.html`, `web/src/*`.
- Create: `web/src/components/DeviceFrame.tsx`, `web/src/components/AppShell.tsx`, `web/src/services/cloudbase.ts`, `web/src/services/api.ts`, `web/src/stores/session.ts`.
- Create: `web/src/components/LocationPicker.tsx`, `web/src/services/location.ts`, and `web/src/types/location.ts` for Web map point selection.
- Create: first-phase Web pages under `web/src/pages/`.

Keep unrelated dirty mini program frontend files untouched.

---

### Task 1: Tooling And Environment Guardrails

**Files:**
- Modify: `.gitignore`
- Create: `package.json`

- [ ] **Step 1: Ignore local credential files**

Add these lines to `.gitignore`:

```gitignore
.env
.env.*
!.env.example
!web/.env.example
```

Credentials must only live in the operator's shell environment or ignored local files. They must not be copied into plan docs, source files, commit messages, verification logs, or final reports.

- [ ] **Step 2: Write root development scripts**

Create a root `package.json` with local CloudBase tooling so agents do not depend on a global `tcb` install:

```json
{
  "name": "blind-run-miniapp-workspace",
  "private": true,
  "scripts": {
    "tcb": "tcb",
    "cloudbase:env": "CLOUDBASE_ENV=${CLOUDBASE_ENV:-cloud1-d8gbfzr7t6c5dc8bc}; tcb env detail -e \"$CLOUDBASE_ENV\" --json",
    "cloudbase:functions": "CLOUDBASE_ENV=${CLOUDBASE_ENV:-cloud1-d8gbfzr7t6c5dc8bc}; tcb fn list -e \"$CLOUDBASE_ENV\" --json",
    "cloudbase:sync-shared": "node scripts/cloudbase/sync-shared.js"
  },
  "devDependencies": {
    "@cloudbase/cli": "^3.5.3"
  }
}
```

- [ ] **Step 3: Install tooling**

Run:

```bash
npm install
```

Expected: `node_modules/` and `package-lock.json` are created. `node_modules/` remains ignored. `npm audit --package-lock-only` reports no vulnerabilities for the root tooling lockfile.

- [ ] **Step 4: Log in to CloudBase without committing secrets**

Use the SecretId and SecretKey provided by the project owner only as local environment variables:

```bash
export TENCENTCLOUD_SECRETID="<provided-secret-id>"
export TENCENTCLOUD_SECRETKEY="<provided-secret-key>"
npm run tcb -- login --apiKeyId "$TENCENTCLOUD_SECRETID" --apiKey "$TENCENTCLOUD_SECRETKEY"
unset TENCENTCLOUD_SECRETID TENCENTCLOUD_SECRETKEY
```

Expected: CloudBase CLI reports a successful login and stores a local CLI login state on this machine. Later `tcb` deploy, invoke, and environment inspection commands use that local login state plus `cloud1-d8gbfzr7t6c5dc8bc`; they do not need the raw SecretKey to be written into the repo. If non-interactive credential login fails, use `npm run tcb -- login` and complete the browser/device flow with the provided subaccount manually. Do not write the password or SecretKey into files.

- [ ] **Step 5: Verify CloudBase CLI**

Run:

```bash
npm run tcb -- --version
npm run cloudbase:env
npm run cloudbase:functions
```

Expected: CLI prints a version, then environment details for `cloud1-d8gbfzr7t6c5dc8bc`, then an empty or near-empty function list. If auth is missing, run `npm run tcb -- login` and repeat.

- [ ] **Step 6: Commit tooling**

```bash
git add .gitignore package.json package-lock.json scripts/cloudbase/sync-shared.js
git commit -m "chore: add cloudbase tooling"
```

---

### Task 2: Shared Cloud Function Helpers

**Files:**
- Create: `cloudfunctions/_shared/responses.js`
- Create: `cloudfunctions/_shared/auth.js`
- Create: `cloudfunctions/_shared/user.js`
- Modify: `scripts/cloudbase/sync-shared.js`

- [ ] **Step 1: Add response helpers**

Create `cloudfunctions/_shared/responses.js`:

```js
function ok(data) {
  return { success: true, ...(data || {}) }
}

function fail(code, error, extra) {
  return { success: false, code, error, ...(extra || {}) }
}

module.exports = { ok, fail }
```

- [ ] **Step 2: Add user helper**

Create `cloudfunctions/_shared/user.js`:

```js
const crypto = require('crypto')

function normalizePhone(phone) {
  return String(phone || '').replace(/\s+/g, '')
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase()
}

function normalizeIdentifier(identifier) {
  const value = String(identifier || '').trim()
  if (value.includes('@')) {
    return { type: 'email', value: normalizeEmail(value) }
  }
  return { type: 'phone', value: normalizePhone(value) }
}

function createWebOpenid() {
  return `web_${crypto.randomBytes(12).toString('hex')}`
}

function publicUser(user) {
  if (!user) return null
  const clone = { ...user }
  delete clone.idCard
  delete clone.password
  delete clone.passwordHash
  delete clone.passwordSalt
  return clone
}

module.exports = {
  normalizePhone,
  normalizeEmail,
  normalizeIdentifier,
  createWebOpenid,
  publicUser
}
```

- [ ] **Step 3: Add identity resolver**

Create `cloudfunctions/_shared/auth.js`:

```js
const cloud = require('wx-server-sdk')
const crypto = require('crypto')
const { fail } = require('./responses')

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex')
}

async function resolveIdentity(db, event, options = {}) {
  const authToken = event && (event.authToken || event._authToken)
  if (authToken) {
    const tokenHash = hashToken(authToken)
    const sessionRes = await db.collection('web_sessions')
      .where({ tokenHash, revoked: false })
      .limit(1)
      .get()

    if (sessionRes.data.length === 0) {
      return { error: fail('SESSION_EXPIRED', '登录已过期，请重新登录') }
    }

    const session = sessionRes.data[0]
    const expiresAt = session.expiresAt ? new Date(session.expiresAt).getTime() : 0
    if (!expiresAt || expiresAt <= Date.now()) {
      return { error: fail('SESSION_EXPIRED', '登录已过期，请重新登录') }
    }

    const userDoc = await db.collection('users').doc(session.userId).get()
    if (!userDoc.data) {
      return { error: fail('USER_NOT_FOUND', '用户不存在') }
    }

    await db.collection('web_sessions').doc(session._id).update({
      data: { lastUsedAt: db.serverDate() }
    })

    return {
      user: userDoc.data,
      userId: userDoc.data._id,
      openid: userDoc.data.openid,
      source: 'web'
    }
  }

  const wxContext = cloud.getWXContext()
  if (wxContext && wxContext.OPENID) {
    const _ = db.command
    const userRes = await db.collection('users')
      .where(_.or([
        { openid: wxContext.OPENID },
        { miniOpenid: wxContext.OPENID }
      ]))
      .limit(1)
      .get()
    const user = userRes.data[0] || null
    return {
      user,
      userId: user ? user._id : '',
      openid: user ? (user.openid || wxContext.OPENID) : wxContext.OPENID,
      source: 'miniapp'
    }
  }

  if (options.optional) {
    return { user: null, userId: '', openid: '', source: 'anonymous' }
  }

  return { error: fail('AUTH_REQUIRED', '请先登录') }
}

function requireUser(identity) {
  if (identity.error) return identity.error
  if (!identity.user) return fail('USER_NOT_FOUND', '用户不存在')
  return null
}

module.exports = { resolveIdentity, requireUser, hashToken }
```

- [ ] **Step 4: Verify helper sync script**

Ensure `scripts/cloudbase/sync-shared.js` contains this implementation:

```js
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '../..')
const sharedDir = path.join(root, 'cloudfunctions/_shared')
const cloudfunctionsDir = path.join(root, 'cloudfunctions')

if (!fs.existsSync(sharedDir)) {
  console.log('No shared helpers found yet. Skipping sync.')
  process.exit(0)
}

const targets = fs.readdirSync(cloudfunctionsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) => name !== '_shared')
  .filter((name) => {
    const functionDir = path.join(cloudfunctionsDir, name)
    return fs.existsSync(path.join(functionDir, 'index.js')) &&
      fs.existsSync(path.join(functionDir, 'package.json'))
  })

let synced = 0
for (const fn of targets) {
  const functionDir = path.join(cloudfunctionsDir, fn)
  const targetDir = path.join(functionDir, 'shared')
  fs.mkdirSync(targetDir, { recursive: true })
  for (const file of fs.readdirSync(sharedDir)) {
    fs.copyFileSync(path.join(sharedDir, file), path.join(targetDir, file))
  }
  synced++
}

console.log(`Synced shared helpers into ${synced} cloud function folders.`)
```

- [ ] **Step 5: Run helper sync**

Run:

```bash
npm run cloudbase:sync-shared
```

Expected: each listed cloud function has a `shared/` directory with `auth.js`, `responses.js`, and `user.js`.

- [ ] **Step 6: Commit shared helpers**

```bash
git add cloudfunctions/_shared scripts/cloudbase/sync-shared.js cloudfunctions/*/shared
git commit -m "feat: add shared cloud function helpers"
```

---

### Task 3: Web Authentication Cloud Function

**Files:**
- Create: `cloudfunctions/webAuth/package.json`
- Create: `cloudfunctions/webAuth/index.js`
- Test: `scripts/cloudbase/verify-web-auth.js`

- [ ] **Step 1: Create function package**

Create `cloudfunctions/webAuth/package.json`:

```json
{
  "name": "webAuth",
  "version": "1.0.0",
  "description": "Web password authentication for blind-run platform",
  "main": "index.js",
  "dependencies": {
    "wx-server-sdk": "~2.6.3"
  }
}
```

- [ ] **Step 2: Implement password auth**

Create `cloudfunctions/webAuth/index.js` with these exported actions:

```js
const cloud = require('wx-server-sdk')
const crypto = require('crypto')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const { ok, fail } = require('./shared/responses')
const { normalizeIdentifier, createWebOpenid, publicUser } = require('./shared/user')
const { resolveIdentity, hashToken } = require('./shared/auth')

const SESSION_DAYS = 7

exports.main = async (event) => {
  try {
    switch (event.action) {
      case 'register':
        return await register(event)
      case 'login':
        return await login(event)
      case 'logout':
        return await logout(event)
      case 'me':
        return await me(event)
      default:
        return fail('VALIDATION_ERROR', '未知操作')
    }
  } catch (err) {
    console.error('webAuth error:', err)
    return fail('INTERNAL_ERROR', err.message || '服务异常')
  }
}

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 64).toString('hex')
}

function verifyPassword(password, salt, expectedHash) {
  const actual = Buffer.from(hashPassword(password, salt), 'hex')
  const expected = Buffer.from(expectedHash, 'hex')
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
}

function validatePassword(password) {
  return typeof password === 'string' && password.length >= 8
}

async function findOrCreateUser(identifier, profile = {}) {
  if (identifier.type === 'phone') {
    const existing = await db.collection('users').where({ phone: identifier.value }).limit(1).get()
    if (existing.data.length > 0) return existing.data[0]
  }

  const now = new Date().toLocaleString()
  const userData = {
    openid: createWebOpenid(),
    userType: profile.userType || 'disabled',
    nickName: profile.nickName || '用户',
    avatarUrl: '',
    phone: identifier.type === 'phone' ? identifier.value : '',
    email: identifier.type === 'email' ? identifier.value : '',
    name: profile.name || '',
    gender: profile.gender || '',
    points: 0,
    exp: 0,
    checkInDays: 0,
    lastCheckInDate: '',
    tierLevel: 1,
    tierName: profile.userType === 'volunteer' ? '启明之星' : '初心跑者',
    totalRuns: 0,
    totalDistance: 0,
    totalTime: 0,
    likes: 0,
    medals: 0,
    emergencyPhone: profile.emergencyPhone || '',
    emergencyName: '',
    emergencyRelation: '',
    runningLocation: profile.runningLocation || '',
    examPassed: profile.userType === 'volunteer' ? false : null,
    examScore: 0,
    examDate: '',
    certificateNo: '',
    certificateUrl: '',
    videoWatched: false,
    isAvailable: false,
    latitude: 0,
    longitude: 0,
    authSources: ['web'],
    createdAt: now,
    lastLoginTime: now,
    updatedAt: db.serverDate()
  }

  const addRes = await db.collection('users').add({ data: userData })
  return { _id: addRes._id, ...userData }
}

async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
  await db.collection('web_sessions').add({
    data: {
      tokenHash: hashToken(token),
      userId,
      revoked: false,
      expiresAt,
      createdAt: db.serverDate(),
      lastUsedAt: db.serverDate()
    }
  })
  return { token, expiresAt: expiresAt.toISOString() }
}

async function register(event) {
  const identifier = normalizeIdentifier(event.identifier)
  const { password, profile = {} } = event
  if (!identifier.value) return fail('VALIDATION_ERROR', '请输入邮箱或手机号')
  if (!validatePassword(password)) return fail('VALIDATION_ERROR', '密码至少需要8位')

  const accountRes = await db.collection('web_accounts')
    .where({ identifierType: identifier.type, identifier: identifier.value })
    .limit(1)
    .get()
  if (accountRes.data.length > 0) return fail('ACCOUNT_EXISTS', '账号已存在')

  const user = await findOrCreateUser(identifier, profile)
  const salt = crypto.randomBytes(16).toString('hex')
  const passwordHash = hashPassword(password, salt)
  await db.collection('web_accounts').add({
    data: {
      identifierType: identifier.type,
      identifier: identifier.value,
      passwordSalt: salt,
      passwordHash,
      userId: user._id,
      status: 'active',
      createdAt: db.serverDate(),
      updatedAt: db.serverDate()
    }
  })

  const session = await createSession(user._id)
  return ok({ authToken: session.token, expiresAt: session.expiresAt, user: publicUser(user) })
}

async function login(event) {
  const identifier = normalizeIdentifier(event.identifier)
  const { password } = event
  const accountRes = await db.collection('web_accounts')
    .where({ identifierType: identifier.type, identifier: identifier.value, status: 'active' })
    .limit(1)
    .get()
  if (accountRes.data.length === 0) return fail('INVALID_CREDENTIALS', '账号或密码错误')

  const account = accountRes.data[0]
  if (!verifyPassword(password, account.passwordSalt, account.passwordHash)) {
    return fail('INVALID_CREDENTIALS', '账号或密码错误')
  }

  const userDoc = await db.collection('users').doc(account.userId).get()
  if (!userDoc.data) return fail('USER_NOT_FOUND', '用户不存在')
  const session = await createSession(account.userId)
  return ok({ authToken: session.token, expiresAt: session.expiresAt, user: publicUser(userDoc.data) })
}

async function logout(event) {
  const token = event.authToken
  if (!token) return ok()
  const tokenHash = hashToken(token)
  const res = await db.collection('web_sessions').where({ tokenHash }).get()
  for (const session of res.data) {
    await db.collection('web_sessions').doc(session._id).update({
      data: { revoked: true, revokedAt: db.serverDate() }
    })
  }
  return ok()
}

async function me(event) {
  const identity = await resolveIdentity(db, event)
  if (identity.error) return identity.error
  return ok({ user: publicUser(identity.user), source: identity.source })
}
```

- [ ] **Step 3: Sync shared helpers into webAuth**

Run:

```bash
npm run cloudbase:sync-shared
```

Expected: `cloudfunctions/webAuth/shared/*` exists.

- [ ] **Step 4: Commit webAuth**

```bash
git add cloudfunctions/webAuth cloudfunctions/webAuth/shared
git commit -m "feat: add web password authentication"
```

---

### Task 4: Database Initialization For Blank Environment

**Files:**
- Modify: `cloudfunctions/initDB/index.js`

- [ ] **Step 1: Add Web auth collections**

In `cloudfunctions/initDB/index.js`, include `web_accounts` and `web_sessions` in the collections array:

```js
const collections = [
  'users', 'orders', 'products', 'exchange_orders', 'moments',
  'sport_records', 'appointments', 'certificates', 'exams',
  'comments', 'web_accounts', 'web_sessions'
]
```

- [ ] **Step 2: Keep seed data idempotent**

Keep the existing `products` and `exams` count checks. Add an action field to the return value so verification can tell it ran against the new version:

```js
return {
  success: true,
  action: 'initDB',
  message: '数据库初始化成功',
  collections: collections
}
```

- [ ] **Step 3: Sync shared helpers**

Run:

```bash
npm run cloudbase:sync-shared
```

Expected: `cloudfunctions/initDB/shared/*` remains present.

- [ ] **Step 4: Commit initDB update**

```bash
git add cloudfunctions/initDB/index.js cloudfunctions/initDB/shared
git commit -m "feat: initialize web auth collections"
```

---

### Task 5: Cross-Platform User Identity Safety

**Files:**
- Modify: `cloudfunctions/syncUserInfo/index.js`

- [ ] **Step 1: Do not trust mini program client phone as a merge key**

In `syncUserInfo`, after reading `userInfo` and `userType`, compute:

```js
const { normalizePhone } = require('./shared/user')
const phone = normalizePhone(userInfo.phone)
```

Only use CloudBase `OPENID` / existing `miniOpenid` to find the current mini program user. Do not merge an existing `users.phone` match from a client-provided mini program profile, because the current mini program login flow has no server-side SMS verification in this repository.

```js
const { user: existingUser, matchedBy } = await findExistingUser(openid)
```

- [ ] **Step 2: Return link-required on phone conflicts**

If a submitted phone already belongs to another user, return a stable error instead of binding or merging:

```js
const phoneOwner = await findUserByPhone(phone)
if (phoneOwner && phoneOwner._id !== existingUser._id) {
  return fail('PHONE_LINK_REQUIRED', '该手机号已有关联用户，请先完成手机号验证后再绑定')
}
```

This keeps Web-created users protected until a real verified phone-linking flow exists.

- [ ] **Step 3: New user includes authSources**

When creating a new mini program user, include:

```js
authSources: ['miniapp'],
miniOpenid: openid
```

- [ ] **Step 4: Run local syntax check**

Run:

```bash
node -c cloudfunctions/syncUserInfo/index.js
```

Expected: no syntax errors.

- [ ] **Step 5: Commit user merge update**

```bash
git add cloudfunctions/syncUserInfo/index.js cloudfunctions/syncUserInfo/shared
git commit -m "feat: merge users by phone across clients"
```

---

### Task 6: Retrofit Identity Resolver Into Core Functions

**Files:**
- Modify: `cloudfunctions/handleUser/index.js`
- Modify: `cloudfunctions/handleTraining/index.js`
- Modify: `cloudfunctions/handleVolunteer/index.js`
- Modify: `cloudfunctions/handleRecord/index.js`

- [ ] **Step 1: Update handleUser entry**

At the top of `handleUser/index.js`, require helpers:

```js
const { resolveIdentity, requireUser } = require('./shared/auth')
const { ok, fail } = require('./shared/responses')
```

Replace `const openid = wxContext.OPENID` use with:

```js
const identity = await resolveIdentity(db, event)
const authError = requireUser(identity)
if (authError) return authError
const openid = identity.openid
```

Return `fail('VALIDATION_ERROR', '未知操作')` for unknown actions.

- [ ] **Step 2: Update handleTraining entry**

Use optional identity for public actions:

```js
if (action === 'getExamQuestions' || action === 'verifyCertificate') {
  // allow without auth
} else {
  const identity = await resolveIdentity(db, event)
  const authError = requireUser(identity)
  if (authError) return authError
  openid = identity.openid
}
```

Do not expose answers in `getExamQuestions` for the Web exam screen. Return `answer` only in `submitExam` results:

```js
const questions = res.data.map(q => ({
  _id: q._id,
  question: q.question,
  options: q.options,
  order: q.order
}))
```

- [ ] **Step 3: Update handleVolunteer entry**

Allow `getVolunteers` and `getVolunteerDetail` without auth. Require auth for `getAvailableVolunteers`, `updateAvailability`, and `getFrequentContacts`. Use `fail('FORBIDDEN', '只有志愿者可以切换接单状态')` when a non-volunteer calls `updateAvailability`.

- [ ] **Step 4: Update handleRecord entry**

Use the shared resolver for all first-phase record and today-stat actions. Return `AUTH_REQUIRED` instead of silently using an empty openid.

- [ ] **Step 5: Run syntax checks**

Run:

```bash
node -c cloudfunctions/handleUser/index.js
node -c cloudfunctions/handleTraining/index.js
node -c cloudfunctions/handleVolunteer/index.js
node -c cloudfunctions/handleRecord/index.js
```

Expected: no syntax errors.

- [ ] **Step 6: Commit resolver retrofit**

```bash
git add cloudfunctions/handleUser cloudfunctions/handleTraining cloudfunctions/handleVolunteer cloudfunctions/handleRecord
git commit -m "feat: support web auth in core cloud functions"
```

---

### Task 7: Audit And Fix Immediate Order Flow

**Files:**
- Modify: `cloudfunctions/handleOrder/index.js`

- [ ] **Step 1: Use shared identity resolver**

Require helpers:

```js
const { resolveIdentity, requireUser } = require('./shared/auth')
const { fail } = require('./shared/responses')
```

Resolve identity once in `exports.main` and pass `identity.openid` into action handlers.

- [ ] **Step 2: Enforce publisher role**

In `publishOrder`, after loading `user`, add:

```js
if (user.userType !== 'disabled') {
  return fail('FORBIDDEN', '只有视障用户可以发布陪跑需求')
}
```

- [ ] **Step 3: Enforce volunteer training gate**

In `acceptOrder`, after loading `volunteer`, add:

```js
if (volunteer.userType !== 'volunteer') {
  return fail('FORBIDDEN', '只有志愿者可以接单')
}
if (!volunteer.videoWatched || !volunteer.examPassed || !volunteer.certificateNo) {
  return fail('TRAINING_REQUIRED', '请先完成培训、考试和证书认证')
}
```

- [ ] **Step 4: Make completion idempotent**

Before updating a completed order, reject duplicate completion without applying rewards:

```js
if (orderRes.data.status === 'completed') {
  return fail('INVALID_ORDER_STATUS', '订单已完成')
}
if (orderRes.data.rewardApplied) {
  return fail('INVALID_ORDER_STATUS', '订单奖励已发放')
}
```

When completing, write:

```js
rewardApplied: true,
rewardAppliedAt: db.serverDate()
```

- [ ] **Step 5: Use a transaction for completion**

Replace the separate order and user updates with one `db.runTransaction` that:

1. Re-reads the order document.
2. Verifies volunteer permission.
3. Verifies current status is not `completed` or `cancelled`.
4. Updates order status and reward flags.
5. Updates blind user and volunteer user stats.

- [ ] **Step 6: Update error codes**

Return these codes from order failures:

```js
ORDER_NOT_FOUND
ORDER_ALREADY_ACCEPTED
INVALID_ORDER_STATUS
FORBIDDEN
TRAINING_REQUIRED
VALIDATION_ERROR
```

- [ ] **Step 7: Run syntax check**

```bash
node -c cloudfunctions/handleOrder/index.js
```

Expected: no syntax errors.

- [ ] **Step 8: Commit order audit**

```bash
git add cloudfunctions/handleOrder
git commit -m "fix: audit immediate order flow"
```

---

### Task 8: Audit And Fix Appointment Flow

**Files:**
- Modify: `cloudfunctions/handleSchedule/index.js`

- [ ] **Step 1: Use shared identity resolver**

Resolve identity in `exports.main` and pass `identity.openid` into appointment handlers.

- [ ] **Step 2: Validate appointment creator**

In `createAppointment`, require:

```js
if (!appointmentDate || !appointmentTime) {
  return fail('VALIDATION_ERROR', '请填写预约日期和时间')
}
if (user.userType === 'disabled' && !volunteerOpenid) {
  return fail('VALIDATION_ERROR', '请选择志愿者')
}
```

- [ ] **Step 3: Validate completion idempotency**

In `completeAppointment`, before updating rewards:

```js
if (res.data.status === 'completed') {
  return fail('INVALID_APPOINTMENT_STATUS', '该预约已完成')
}
if (res.data.rewardApplied) {
  return fail('INVALID_APPOINTMENT_STATUS', '预约奖励已发放')
}
```

Set `rewardApplied: true` and `rewardAppliedAt: db.serverDate()` when completion succeeds.

- [ ] **Step 4: Keep appointments as source of truth**

Do not read or write local-cache concepts such as `blind_orders` in cloud functions. Only use the `appointments` collection.

- [ ] **Step 5: Run syntax check**

```bash
node -c cloudfunctions/handleSchedule/index.js
```

Expected: no syntax errors.

- [ ] **Step 6: Commit appointment audit**

```bash
git add cloudfunctions/handleSchedule
git commit -m "fix: audit appointment flow"
```

---

### Task 9: Backend Verification Scripts

**Files:**
- Create: `scripts/cloudbase/verify-web-auth.js`
- Create: `scripts/cloudbase/verify-core-flow.js`

- [ ] **Step 1: Add Web auth verification script**

Create `scripts/cloudbase/verify-web-auth.js`:

```js
const { execFileSync } = require('child_process')
const path = require('path')

const env = process.env.CLOUDBASE_ENV || 'cloud1-d8gbfzr7t6c5dc8bc'
const root = path.resolve(__dirname, '../..')
const tcb = path.join(root, 'node_modules/.bin/tcb')

function parseJsonOutput(output) {
  const start = output.lastIndexOf('\n{')
  const json = start >= 0 ? output.slice(start + 1) : output
  return JSON.parse(json)
}

async function call(name, data) {
  const output = execFileSync(tcb, [
    'fn', 'invoke', name,
    '--params', JSON.stringify(data),
    '-e', env,
    '--json'
  ], { encoding: 'utf8' })
  const parsed = parseJsonOutput(output)
  return parsed.result || parsed.data || parsed
}

async function main() {
  const suffix = Date.now()
  const phone = `139${String(suffix).slice(-8)}`
  const password = 'Passw0rd!'

  const register = await call('webAuth', {
    action: 'register',
    identifier: phone,
    password,
    profile: { userType: 'disabled', nickName: 'Web测试用户' }
  })
  if (!register.success || !register.authToken) throw new Error(`register failed: ${register.error}`)

  const me = await call('webAuth', { action: 'me', authToken: register.authToken })
  if (!me.success || !me.user || me.user.phone !== phone) throw new Error('me failed after register')

  const login = await call('webAuth', { action: 'login', identifier: phone, password })
  if (!login.success || !login.authToken) throw new Error(`login failed: ${login.error}`)

  const logout = await call('webAuth', { action: 'logout', authToken: login.authToken })
  if (!logout.success) throw new Error(`logout failed: ${logout.error}`)

  console.log(JSON.stringify({ success: true, phone }, null, 2))
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 2: Add core flow verification script**

Create `scripts/cloudbase/verify-core-flow.js`:

```js
const { execFileSync } = require('child_process')
const path = require('path')

const env = process.env.CLOUDBASE_ENV || 'cloud1-d8gbfzr7t6c5dc8bc'
const root = path.resolve(__dirname, '../..')
const tcb = path.join(root, 'node_modules/.bin/tcb')

function parseJsonOutput(output) {
  const start = output.lastIndexOf('\n{')
  const json = start >= 0 ? output.slice(start + 1) : output
  return JSON.parse(json)
}

async function call(name, data) {
  const output = execFileSync(tcb, [
    'fn', 'invoke', name,
    '--params', JSON.stringify(data),
    '-e', env,
    '--json'
  ], { encoding: 'utf8' })
  const parsed = parseJsonOutput(output)
  return parsed.result || parsed.data || parsed
}

async function register(identifier, userType, nickName) {
  const res = await call('webAuth', {
    action: 'register',
    identifier,
    password: 'Passw0rd!',
    profile: { userType, nickName }
  })
  if (!res.success) throw new Error(`${identifier} register failed: ${res.error}`)
  return res.authToken
}

async function main() {
  const suffix = String(Date.now()).slice(-8)
  const blindToken = await register(`138${suffix}`, 'disabled', '视障测试用户')
  const volunteerToken = await register(`137${suffix}`, 'volunteer', '志愿者测试用户')

  const blockedAcceptProbe = await call('handleOrder', {
    action: 'getWaitingOrders',
    authToken: volunteerToken,
    page: 1
  })
  if (!blockedAcceptProbe.success) throw new Error(`waiting orders failed: ${blockedAcceptProbe.error}`)

  const publish = await call('handleOrder', {
    action: 'publish',
    authToken: blindToken,
    targetDistance: '3',
    estimatedDuration: '30分钟',
    latitude: 31.2304,
    longitude: 121.4737,
    address: '上海测试地址'
  })
  if (!publish.success) throw new Error(`publish failed: ${publish.error}`)

  const acceptBeforeTraining = await call('handleOrder', {
    action: 'accept',
    authToken: volunteerToken,
    orderId: publish.orderId
  })
  if (acceptBeforeTraining.success || acceptBeforeTraining.code !== 'TRAINING_REQUIRED') {
    throw new Error('volunteer accepted order before training gate')
  }

  console.log(JSON.stringify({
    success: true,
    orderId: publish.orderId,
    trainingGateCode: acceptBeforeTraining.code
  }, null, 2))
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 3: Commit verification scripts**

```bash
git add scripts/cloudbase/verify-web-auth.js scripts/cloudbase/verify-core-flow.js package.json
git commit -m "test: add cloudbase verification scripts"
```

---

### Task 10: Deploy Backend To New CloudBase Environment

**Files:**
- No source edits if prior tasks are complete.

- [ ] **Step 1: Sync helpers before deployment**

Run:

```bash
npm run cloudbase:sync-shared
```

Expected: copied helpers are current in every function folder.

- [ ] **Step 2: Deploy functions**

Run these commands:

```bash
npm run tcb -- fn deploy initDB --force -e cloud1-d8gbfzr7t6c5dc8bc --json
npm run tcb -- fn deploy webAuth --force -e cloud1-d8gbfzr7t6c5dc8bc --json
npm run tcb -- fn deploy syncUserInfo --force -e cloud1-d8gbfzr7t6c5dc8bc --json
npm run tcb -- fn deploy wechatLogin --force -e cloud1-d8gbfzr7t6c5dc8bc --json
npm run tcb -- fn deploy handleUser --force -e cloud1-d8gbfzr7t6c5dc8bc --json
npm run tcb -- fn deploy handleTraining --force -e cloud1-d8gbfzr7t6c5dc8bc --json
npm run tcb -- fn deploy handleVolunteer --force -e cloud1-d8gbfzr7t6c5dc8bc --json
npm run tcb -- fn deploy handleOrder --force -e cloud1-d8gbfzr7t6c5dc8bc --json
npm run tcb -- fn deploy handleSchedule --force -e cloud1-d8gbfzr7t6c5dc8bc --json
npm run tcb -- fn deploy handleRecord --force -e cloud1-d8gbfzr7t6c5dc8bc --json
npm run tcb -- fn deploy updatePoints --force -e cloud1-d8gbfzr7t6c5dc8bc --json
```

Expected: every deploy command exits `0`.

- [ ] **Step 3: Initialize database**

Run:

```bash
npm run tcb -- fn invoke initDB --params '{}' -e cloud1-d8gbfzr7t6c5dc8bc --json
```

Expected: result contains `success: true` and collections including `web_accounts` and `web_sessions`.

- [ ] **Step 4: Run backend verification**

Run:

```bash
npm run cloudbase:verify-auth
npm run cloudbase:verify-core
```

Expected: both scripts print JSON with `"success": true`.

---

### Task 11: Web App Scaffold

**Files:**
- Create: `web/package.json`
- Create: `web/vite.config.ts`
- Create: `web/tsconfig.json`
- Create: `web/tsconfig.node.json`
- Create: `web/index.html`
- Create: `web/src/main.tsx`
- Create: `web/src/App.tsx`
- Create: `web/src/styles.css`
- Create: `web/src/vite-env.d.ts`

- [ ] **Step 1: Scaffold package**

Create `web/package.json`:

```json
{
  "name": "blind-run-web",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "tsc -b && vite build",
    "preview": "vite preview --host 127.0.0.1",
    "lint": "tsc -b --pretty false"
  },
  "dependencies": {
    "@cloudbase/js-sdk": "^3.3.13",
    "@vitejs/plugin-react": "^5.0.0",
    "leaflet": "^1.9.4",
    "lucide-react": "^0.468.0",
    "vite": "^6.0.0",
    "typescript": "^5.6.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.28.0",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@types/leaflet": "^1.9.12",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0"
  }
}
```

- [ ] **Step 2: Add Vite config**

Create `web/vite.config.ts`:

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173
  }
})
```

- [ ] **Step 3: Add TypeScript configs**

Create `web/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2020"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

Create `web/tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 4: Add app shell files**

Create `web/index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>助盲跑</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `web/src/main.tsx`:

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
```

Create `web/src/App.tsx`:

```tsx
import { Navigate, Route, Routes } from 'react-router-dom'

function LoginPage() {
  return (
    <main className="app-screen">
      <h1>助盲跑</h1>
      <p>邮箱或手机号登录</p>
      <button type="button">开始</button>
    </main>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
```

Create `web/src/styles.css`:

```css
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: #eef4f1;
  color: #10231d;
}

button,
input,
select,
textarea {
  font: inherit;
}

.app-screen {
  min-height: 100dvh;
  padding: 24px;
}
```

Create `web/src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />
```

The app must build before Claude Code starts visual implementation.

- [ ] **Step 5: Install Web dependencies**

Run:

```bash
cd web && npm install
npm run build
```

Expected: dependencies install and build succeeds.

- [ ] **Step 6: Commit scaffold**

```bash
git add web
git commit -m "feat: scaffold mobile web app"
```

---

### Task 12: Web CloudBase Client And Session Store

**Files:**
- Create: `web/.env.example`
- Create: `web/src/services/cloudbase.ts`
- Create: `web/src/services/api.ts`
- Create: `web/src/stores/session.ts`
- Create: `web/src/types/api.ts`

- [ ] **Step 1: Add env example**

Create `web/.env.example`:

```bash
VITE_CLOUDBASE_ENV_ID=cloud1-d8gbfzr7t6c5dc8bc
```

- [ ] **Step 2: Add CloudBase client**

Create `web/src/services/cloudbase.ts`:

```ts
import cloudbase from '@cloudbase/js-sdk'

const env = import.meta.env.VITE_CLOUDBASE_ENV_ID || 'cloud1-d8gbfzr7t6c5dc8bc'

export const cloudbaseApp = cloudbase.init({ env })
```

- [ ] **Step 3: Add API client**

Create `web/src/services/api.ts`:

```ts
import { cloudbaseApp } from './cloudbase'
import { useSessionStore } from '../stores/session'

export type CloudResult<T> = T & {
  success: boolean
  code?: string
  error?: string
}

export async function callFunction<T>(name: string, data: Record<string, unknown> = {}) {
  const token = useSessionStore.getState().authToken
  const payload = token ? { ...data, authToken: token } : data
  const res = await cloudbaseApp.callFunction({ name, data: payload })
  const result = res.result as CloudResult<T>
  if (!result.success && (result.code === 'SESSION_EXPIRED' || result.code === 'AUTH_REQUIRED')) {
    useSessionStore.getState().clearSession()
  }
  return result
}
```

- [ ] **Step 4: Add session store**

Create `web/src/stores/session.ts`:

```ts
import { create } from 'zustand'

type SessionUser = {
  _id: string
  openid: string
  userType: 'disabled' | 'volunteer'
  nickName: string
  phone?: string
  email?: string
}

type SessionState = {
  authToken: string
  user: SessionUser | null
  setSession: (authToken: string, user: SessionUser) => void
  clearSession: () => void
}

const storedToken = localStorage.getItem('blindRun.authToken') || ''
const storedUser = localStorage.getItem('blindRun.user')

export const useSessionStore = create<SessionState>((set) => ({
  authToken: storedToken,
  user: storedUser ? JSON.parse(storedUser) : null,
  setSession: (authToken, user) => {
    localStorage.setItem('blindRun.authToken', authToken)
    localStorage.setItem('blindRun.user', JSON.stringify(user))
    set({ authToken, user })
  },
  clearSession: () => {
    localStorage.removeItem('blindRun.authToken')
    localStorage.removeItem('blindRun.user')
    set({ authToken: '', user: null })
  }
}))
```

- [ ] **Step 5: Run Web build**

```bash
cd web && npm run build
```

Expected: TypeScript and Vite build succeed.

- [ ] **Step 6: Commit client layer**

```bash
git add web/.env.example web/src/services web/src/stores web/src/types
git commit -m "feat: add web cloudbase client"
```

---

### Task 13: Device Frame And App Shell

**Files:**
- Create: `web/src/components/DeviceFrame.tsx`
- Create: `web/src/components/AppShell.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/styles.css`

- [ ] **Step 1: Add DeviceFrame component**

Create `web/src/components/DeviceFrame.tsx` with props:

```ts
type DeviceFrameProps = {
  children: React.ReactNode
  model?: 'iphone-15' | 'iphone-15-plus'
}
```

The component must:

- Render 393x852 for `iphone-15`.
- Render 430x932 for `iphone-15-plus`.
- Include simulated status bar, Dynamic Island, screen content area, and home indicator.
- Disable frame on screens narrower than 768px with CSS.

- [ ] **Step 2: Add AppShell component**

Create `web/src/components/AppShell.tsx` with:

- Top app navigation below status safe area.
- Bottom TabBar for Home, Sport, Appointment/Orders, Mine.
- CSS variables for `--safe-top`, `--safe-bottom`, and `--tabbar-height`.

- [ ] **Step 3: Add non-overlap CSS**

In `web/src/styles.css`, define:

```css
:root {
  --safe-top: 44px;
  --safe-bottom: 34px;
  --nav-height: 48px;
  --tabbar-height: 64px;
}

.app-screen {
  min-height: 100dvh;
  padding-top: calc(var(--safe-top) + var(--nav-height));
  padding-bottom: calc(var(--safe-bottom) + var(--tabbar-height));
}

@media (max-width: 767px) {
  :root {
    --safe-top: env(safe-area-inset-top, 0px);
    --safe-bottom: env(safe-area-inset-bottom, 0px);
  }
}
```

- [ ] **Step 4: Run Web build**

```bash
cd web && npm run build
```

Expected: build succeeds.

- [ ] **Step 5: Commit device frame**

```bash
git add web/src/components web/src/App.tsx web/src/styles.css
git commit -m "feat: add mobile device preview shell"
```

---

### Task 14: Web Location Picker

**Files:**
- Create: `web/src/types/location.ts`
- Create: `web/src/services/location.ts`
- Create: `web/src/components/LocationPicker.tsx`
- Modify: `web/src/styles.css`

- [ ] **Step 1: Extract the mini program location data contract**

Read these existing files before coding:

```bash
sed -n '1,260p' pages/publish-need/publish-need.js
sed -n '1,220p' utils/amap.js
```

Extract the data contract, not the `wx.*` APIs or WXML implementation. The Web location contract must keep these fields compatible with `handleOrder.publish`:

```ts
export type SelectedLocation = {
  latitude: number
  longitude: number
  address: string
  source: 'geolocation' | 'map-click' | 'manual'
}
```

- [ ] **Step 2: Add location helpers**

Create `web/src/types/location.ts`:

```ts
export type SelectedLocation = {
  latitude: number
  longitude: number
  address: string
  source: 'geolocation' | 'map-click' | 'manual'
}
```

Create `web/src/services/location.ts`:

```ts
import type { SelectedLocation } from '../types/location'

export function formatCoordinateAddress(latitude: number, longitude: number) {
  return `当前位置 ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
}

export function getBrowserLocation(): Promise<SelectedLocation> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('当前浏览器不支持定位'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude
        const longitude = position.coords.longitude
        resolve({
          latitude,
          longitude,
          address: formatCoordinateAddress(latitude, longitude),
          source: 'geolocation'
        })
      },
      () => reject(new Error('定位失败，请在地图上选点')),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    )
  })
}
```

- [ ] **Step 3: Add Leaflet map picker**

Create `web/src/components/LocationPicker.tsx` using Leaflet. It must:

- Render a map centered on Shanghai by default.
- Use browser geolocation when available.
- Let the user click/tap the map to choose a point.
- Show the selected latitude, longitude, and address string.
- Call `onChange(location)` with the `SelectedLocation`.
- Work without an AMap/Tencent map key for local verification.

Implementation outline:

```tsx
import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { SelectedLocation } from '../types/location'
import { formatCoordinateAddress, getBrowserLocation } from '../services/location'

type LocationPickerProps = {
  value?: SelectedLocation | null
  onChange: (location: SelectedLocation) => void
}

const SHANGHAI: [number, number] = [31.2304, 121.4737]

export function LocationPicker({ value, onChange }: LocationPickerProps) {
  const mapRef = useRef<HTMLDivElement | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const [selected, setSelected] = useState<SelectedLocation | null>(value || null)

  useEffect(() => {
    if (!mapRef.current) return
    const map = L.map(mapRef.current, { zoomControl: true }).setView(SHANGHAI, 13)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map)

    function applyLocation(location: SelectedLocation) {
      setSelected(location)
      onChange(location)
      if (markerRef.current) markerRef.current.remove()
      markerRef.current = L.marker([location.latitude, location.longitude]).addTo(map)
      map.setView([location.latitude, location.longitude], 15)
    }

    map.on('click', (event) => {
      const location: SelectedLocation = {
        latitude: event.latlng.lat,
        longitude: event.latlng.lng,
        address: formatCoordinateAddress(event.latlng.lat, event.latlng.lng),
        source: 'map-click'
      }
      applyLocation(location)
    })

    getBrowserLocation().then(applyLocation).catch(() => undefined)

    return () => {
      map.remove()
    }
  }, [onChange])

  return (
    <section className="location-picker">
      <div ref={mapRef} className="location-picker__map" aria-label="地图选点" />
      <div className="location-picker__summary">
        {selected ? selected.address : '请在地图上选择集合地点'}
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Add map styles**

Append to `web/src/styles.css`:

```css
.location-picker {
  display: grid;
  gap: 12px;
}

.location-picker__map {
  min-height: 260px;
  border: 1px solid rgba(16, 35, 29, 0.16);
  border-radius: 16px;
  overflow: hidden;
}

.location-picker__summary {
  font-weight: 700;
  color: #10231d;
}
```

- [ ] **Step 5: Run Web build**

```bash
cd web && npm run build
```

Expected: build succeeds and Leaflet CSS is bundled.

- [ ] **Step 6: Commit location picker**

```bash
git add web/src/components/LocationPicker.tsx web/src/services/location.ts web/src/types/location.ts web/src/styles.css web/package.json web/package-lock.json
git commit -m "feat: add web map location picker"
```

---

### Task 15: First-Phase Web Pages

**Files:**
- Create: `web/src/pages/LoginPage.tsx`
- Create: `web/src/pages/ProfileSetupPage.tsx`
- Create: `web/src/pages/HomePage.tsx`
- Create: `web/src/pages/TrainingPage.tsx`
- Create: `web/src/pages/ExamPage.tsx`
- Create: `web/src/pages/CertificatePage.tsx`
- Create: `web/src/pages/SportPage.tsx`
- Create: `web/src/pages/PublishNeedPage.tsx`
- Create: `web/src/pages/VolunteerOrdersPage.tsx`
- Create: `web/src/pages/OrderTrackPage.tsx`
- Create: `web/src/pages/AppointmentsPage.tsx`
- Create: `web/src/pages/VolunteerListPage.tsx`
- Create: `web/src/pages/MinePage.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/services/api.ts`

- [ ] **Step 1: Add typed business API wrappers**

In `web/src/services/api.ts`, add wrappers:

```ts
export const authApi = {
  register: (identifier: string, password: string, profile: Record<string, unknown>) =>
    callFunction<{ authToken: string; user: any }>('webAuth', { action: 'register', identifier, password, profile }),
  login: (identifier: string, password: string) =>
    callFunction<{ authToken: string; user: any }>('webAuth', { action: 'login', identifier, password }),
  me: () => callFunction<{ user: any }>('webAuth', { action: 'me' })
}

export const userApi = {
  profile: () => callFunction<{ user: any }>('handleUser', { action: 'getUserProfile' }),
  stats: () => callFunction<{ stats: any }>('handleUser', { action: 'getUserStats' }),
  updateProfile: (data: Record<string, unknown>) => callFunction<{ user: any }>('handleUser', { action: 'updateProfile', ...data })
}

export const orderApi = {
  publish: (data: Record<string, unknown>) => callFunction<{ orderId: string; order: any }>('handleOrder', { action: 'publish', ...data }),
  waiting: () => callFunction<{ orders: any[] }>('handleOrder', { action: 'getWaitingOrders', page: 1 }),
  accept: (orderId: string) => callFunction<{ order: any }>('handleOrder', { action: 'accept', orderId }),
  detail: (orderId: string) => callFunction<{ order: any }>('handleOrder', { action: 'getOrderDetail', orderId }),
  updateStatus: (orderId: string, status: string) => callFunction('handleOrder', { action: 'updateOrderStatus', orderId, status }),
  complete: (orderId: string, data: Record<string, unknown>) => callFunction('handleOrder', { action: 'complete', orderId, ...data })
}
```

- [ ] **Step 2: Implement LoginPage**

The page supports:

- Toggle between login and register.
- Identifier field for email or phone.
- Password field.
- Role selector during registration.
- Calls `authApi.register` or `authApi.login`.
- Stores session with `useSessionStore.setSession`.
- Routes to `/home`.

- [ ] **Step 3: Implement profile and home pages**

`ProfileSetupPage` updates name, phone, emergency contact, running location, and volunteer running metadata. `HomePage` loads `userApi.profile()` and `userApi.stats()` and shows role-aware actions.

- [ ] **Step 4: Implement training pages**

`TrainingPage`, `ExamPage`, and `CertificatePage` call `handleTraining` actions. `ExamPage` submits all answers and routes to certificate when passed.

- [ ] **Step 5: Implement order pages**

`PublishNeedPage` must use `LocationPicker` for map point selection, keep selected `latitude`, `longitude`, and `address` in state, allow target distance/duration input, and call `orderApi.publish`. `VolunteerOrdersPage` lists waiting orders and calls `orderApi.accept`. `OrderTrackPage` supports arrived, running, and completed status actions.

- [ ] **Step 6: Implement appointment and volunteer pages**

`VolunteerListPage` lists trained volunteers. `AppointmentsPage` creates and lists appointments through `handleSchedule`.

- [ ] **Step 7: Run Web build**

```bash
cd web && npm run build
```

Expected: build succeeds.

- [ ] **Step 8: Commit first-phase pages**

```bash
git add web/src
git commit -m "feat: add first-phase web pages"
```

---

### Task 16: Claude Code Frontend Design Pass

**Files:**
- Modify: `web/src/components/*`
- Modify: `web/src/pages/*`
- Modify: `web/src/styles.css`

- [ ] **Step 1: Invoke Claude Code for frontend work**

Run Claude Code from the repo root and give it this exact task:

```bash
claude
```

Prompt to Claude Code:

```text
Use the Frontend Design skill.

You are responsible only for the Web frontend under /Users/dgao/blind-run-miniapp/web.
Do not modify cloudfunctions, docs, mini program pages, or unrelated files.

Design direction: sport-dashboard oriented, accessible, trustworthy, safe, and公益-oriented. Keep the app as a portrait mobile Web app. Do not create a marketing landing page.

Required:
- Refine the React/Vite/TypeScript UI in web/src.
- Preserve all existing API calls and route behavior.
- Preserve LocationPicker behavior for publishing a blind-running need. Do not replace it with manual coordinate inputs.
- Implement or improve DeviceFrame so desktop preview has phone border, rounded corners, shadow, status bar, Dynamic Island, screen safe areas, and home indicator.
- Disable DeviceFrame on small/mobile viewports.
- Ensure app navigation sits below the simulated status bar.
- Ensure TabBar and bottom controls avoid bottom safe area.
- Use lucide-react icons where appropriate.
- Keep text readable, high contrast, and non-overlapping.
- Do not put UI cards inside cards.
- Run cd web && npm run build before finishing.

Return changed file paths and verification output.
```

- [ ] **Step 2: Review Claude Code changes**

Run:

```bash
git diff -- web
cd web && npm run build
```

Expected: diff only touches Web frontend files and build succeeds.

- [ ] **Step 3: Commit frontend design pass**

```bash
git add web
git commit -m "feat: refine web frontend design"
```

---

### Task 17: agent-browser Functional And Visual Verification

**Files:**
- Create: `scripts/cloudbase/compress-screenshot.js`

- [ ] **Step 1: Add screenshot compression script**

Create `scripts/cloudbase/compress-screenshot.js`:

```js
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const input = process.argv[2]
if (!input) {
  console.error('Usage: node scripts/cloudbase/compress-screenshot.js <image>')
  process.exit(1)
}

const parsed = path.parse(input)
const output = path.join(parsed.dir, `${parsed.name}.compressed${parsed.ext}`)

const result = spawnSync('sips', ['-Z', '1200', input, '--out', output], { stdio: 'inherit' })
if (result.status !== 0) process.exit(result.status || 1)
if (!fs.existsSync(output)) {
  console.error(`Missing compressed image: ${output}`)
  process.exit(1)
}
console.log(output)
```

- [ ] **Step 2: Start Web dev server**

Run:

```bash
cd web && npm run dev
```

Keep the dev server running until verification is complete. If port `5173` is occupied, use the port printed by Vite.

- [ ] **Step 3: Open the app with agent-browser**

Run:

```bash
agent-browser open --enable react-devtools http://127.0.0.1:5173
agent-browser snapshot -i
```

Expected: snapshot shows login/register controls.

- [ ] **Step 4: Test auth flow**

Use `agent-browser fill`, `click`, and `snapshot -i` to:

1. Register a disabled user.
2. Confirm route reaches Home or Profile Setup.
3. Log out if UI supports it, then log in again.
4. Confirm no session-expired loop occurs.

- [ ] **Step 5: Test core UI flows**

Use `agent-browser` to exercise:

- Profile completion.
- Training page and exam submit.
- Publish immediate need.
- Map point selection in PublishNeedPage.
- Volunteer order list using a second browser session:

```bash
agent-browser --session volunteer open http://127.0.0.1:5173
```

- Appointment creation/list.
- Mine page.

- [ ] **Step 6: Capture compressed desktop screenshot**

Run:

```bash
agent-browser screenshot /tmp/blind-run-desktop.png
node scripts/cloudbase/compress-screenshot.js /tmp/blind-run-desktop.png
```

Only inspect `/tmp/blind-run-desktop.compressed.png`, not the original screenshot.

- [ ] **Step 7: Capture compressed mobile screenshot**

Run:

```bash
agent-browser close --all
agent-browser open http://127.0.0.1:5173
agent-browser set viewport 393 852
agent-browser screenshot /tmp/blind-run-mobile.png
node scripts/cloudbase/compress-screenshot.js /tmp/blind-run-mobile.png
```

Expected: `/tmp/blind-run-mobile.compressed.png` is created from a 393x852 CSS viewport.

- [ ] **Step 8: Verify layout acceptance criteria**

Confirm from compressed screenshots and snapshots:

- Desktop viewport shows the phone device frame.
- Mobile viewport shows pure app without device frame.
- Status bar, app nav, content, TabBar, inputs, and home indicator do not overlap.
- Text fits buttons and cards.
- Primary actions are reachable with large touch targets.
- PublishNeedPage allows selecting a map point and sends non-empty latitude, longitude, and address to the publish action.

- [ ] **Step 9: Commit verification helpers**

```bash
git add scripts/cloudbase/compress-screenshot.js
git commit -m "test: add browser screenshot compression helper"
```

---

### Task 18: Final Integration Verification

**Files:**
- No expected source edits unless verification finds defects.

- [ ] **Step 1: Run backend syntax checks**

```bash
find cloudfunctions -name index.js -maxdepth 2 -print -exec node -c {} \;
```

Expected: no syntax errors.

- [ ] **Step 2: Run Web build**

```bash
cd web && npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Run CloudBase verification scripts**

```bash
npm run cloudbase:verify-auth
npm run cloudbase:verify-core
```

Expected: both scripts succeed.

- [ ] **Step 4: Inspect git status**

```bash
git status --short
```

Expected: only intentional changes are present. Unrelated pre-existing dirty files remain untouched.

- [ ] **Step 5: Report credentials warning**

In the final implementation report, state that credentials shared in chat should be rotated after deployment and verification.
