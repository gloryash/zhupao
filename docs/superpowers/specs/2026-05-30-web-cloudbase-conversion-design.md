# Web CloudBase Conversion Design

## Goal

Convert the blind-running WeChat mini program into a first-phase mobile Web app while reusing one Tencent CloudBase backend and one shared database. The Web app is a portrait mobile application, not a desktop marketing site. The first phase focuses on the core service loop: user registration, profile completion, volunteer training, immediate orders, appointment matching, and personal/home views.

## Confirmed Decisions

- Target CloudBase environment is `cloud1-d8gbfzr7t6c5dc8bc`.
- The target environment is currently blank. Implementation must deploy cloud functions and initialize database collections and seed data.
- Existing mini program frontend work is out of scope.
- Mini program-compatible cloud function behavior must remain possible, but existing cloud functions should be audited and corrected instead of preserved blindly.
- Web frontend will live under `web/`.
- Web frontend stack is React, Vite, TypeScript, and CloudBase Web SDK.
- Web authentication uses email or phone registration and password login. It does not use SMS verification in the first phase.
- Users with the same phone number must resolve to the same `users` record across mini program and Web.
- The first phase is local Web delivery, not CloudBase static hosting deployment.
- Frontend implementation should be delegated to Claude Code as a frontend sub-agent with the Frontend Design skill.
- Final functional and UI verification must use the `agent-browser` skill against a real browser. Screenshots must be compressed before visual inspection.

## Scope

### In Scope

- Web registration and password login.
- User identity selection and profile completion for `disabled` and `volunteer`.
- Shared CloudBase identity resolution for mini program and Web callers.
- Home and personal profile data views.
- Volunteer training status, exam, and certificate flow.
- Immediate order publishing, waiting order list, accepting, arriving, running, location update, and completion.
- Appointment creation and list views.
- Volunteer list and available volunteer matching.
- Reusable desktop-only `DeviceFrame` or `PhonePreviewFrame` component.
- New blank-environment setup: function deployment, collections, seed data, and verification scripts.

### Deferred

- Running circle.
- Points shop.
- Full sport record management.
- Tutorial and training management/admin pages.
- CloudBase static hosting deployment.
- Real SMS verification.
- Future WeChat login for Web.

## Backend Architecture

The backend remains WeChat CloudBase. The current cloud functions are treated as a starting point, not as a correctness guarantee. Implementation must review them against the PRD and repair business issues found in core flows.

### Functions

Deploy and audit these core functions in the new environment:

- `syncUserInfo`
- `wechatLogin`
- `handleUser`
- `handleOrder`
- `handleVolunteer`
- `handleSchedule`
- `handleTraining`
- `handleRecord`
- `updatePoints`
- `initDB`

Add a new Web authentication function:

- `webAuth`

`webAuth` supports:

- `register`
- `login`
- `logout`
- `me`

Passwords must be stored as salted hashes only. Plaintext passwords must never be persisted or logged.

### Identity Resolver

Business cloud functions should use a shared identity resolver:

- Mini program calls continue to use `cloud.getWXContext().OPENID`.
- Web calls send `event.authToken`.
- The resolver validates `authToken` against `web_sessions`, loads the linked user, and returns the same principal shape expected by business functions.
- Unauthorized calls return stable auth errors such as `AUTH_REQUIRED`, `SESSION_EXPIRED`, or `FORBIDDEN`.

The implementation should reduce repeated auth parsing across cloud functions. A local shared helper under `cloudfunctions/common/` is acceptable if compatible with CloudBase packaging.

### Data Model

Existing shared collections:

- `users`
- `orders`
- `appointments`
- `sport_records`
- `moments`
- `comments`
- `products`
- `exchange_orders`
- `certificates`
- `exams`

New Web auth collections:

- `web_accounts`: normalized email or phone, credential type, password salt/hash, linked `userId`, status, created and updated timestamps.
- `web_sessions`: token hash, linked `userId`, expiration time, revoked flag, created and last-used timestamps.

Phone is the cross-platform account anchor:

- Web phone registration first looks for `users.phone`.
- If found, the Web account binds to that `users` record.
- If not found, registration creates a new `users` record.
- Future mini program sync should also check phone and reuse an existing Web-created `users` record.
- Duplicate phone conflicts must return explicit business errors.

## Backend Business Rules To Audit

Implementation must verify and, where needed, correct these rules:

- Volunteers cannot accept orders until training video, exam pass, and certificate requirements are met.
- Order status transitions are valid and enforced.
- Only the order publisher or accepted volunteer can cancel an active order.
- Only the accepted volunteer can move order status and complete the order.
- Completion rewards are not applied twice.
- Points, experience, total runs, likes, and tier updates are transaction-safe or idempotent enough for repeat calls.
- Appointment data uses `appointments` as the first-phase source of truth.
- New environment initialization is repeatable and does not duplicate seed exams or products.

## Frontend Architecture

Create a new `web/` application:

- React + Vite + TypeScript.
- CloudBase Web SDK client wrapper.
- Route-level pages for the first-phase workflow.
- Shared business API client that injects `authToken` into cloud function calls.
- Shared user session store.
- Reusable mobile shell and desktop preview shell.

### Page Set

First-phase pages:

- Login and registration.
- Role and profile completion.
- Home.
- Training flow.
- Exam.
- Certificate.
- Sport entry.
- Publish immediate need.
- Volunteer order list.
- Order tracking and order operation flow.
- Appointment creation/list.
- Volunteer list.
- Mine/profile.

Deferred pages should not block first-phase navigation. They can be hidden or represented by disabled routes until implemented.

## Device Frame

Build a reusable `DeviceFrame` or `PhonePreviewFrame` component:

- Desktop viewport renders a fixed phone preview such as 393x852 or 430x932.
- The frame includes border, rounded corners, shadow, screen area, and optional Dynamic Island/notch.
- The screen simulates status bar safe area, content safe area, bottom safe area, and home indicator.
- App navigation sits below the simulated system status bar.
- TabBar and fixed bottom controls avoid the bottom safe area.
- Simulated status bar includes time, signal, Wi-Fi, and battery.
- Small screens and real mobile visits automatically render the pure app without device frame.
- This component is preview-only and must be easy to exclude from native packaging if that happens later.

## Visual Direction

The frontend direction is sport-dashboard oriented, based on option C from the visual discussion:

- Athletic, data-forward, and action-oriented.
- Strong readability and accessible contrast.
- It should still feel trustworthy, safe, and公益-oriented, not only like a generic fitness tracker.
- The exact visual system is intentionally left for Claude Code with the Frontend Design skill during frontend implementation.

## Core Data Flows

### Web Auth

1. User registers or logs in with email/phone and password.
2. `webAuth` validates credentials.
3. Phone registration binds to an existing `users` record when the phone already exists.
4. `webAuth` returns a session token.
5. Web stores the token and sends it with business cloud function calls.
6. Business cloud functions resolve the token to the shared `users` record.

### Immediate Order

1. Disabled user obtains location in Web.
2. Web calls `handleOrder.publish`.
3. Cloud function writes an `orders` document.
4. Volunteer views waiting orders through `handleOrder.getWaitingOrders`.
5. Volunteer calls `accept`, `updateOrderStatus`, `updateVolunteerLocation`, and `complete`.
6. Completion updates order data and both users' growth stats.

### Appointment

1. Disabled user selects a volunteer or creates an appointment.
2. Web calls `handleSchedule.createAppointment`.
3. Appointment lists are loaded with `getAppointments`.
4. Status changes are enforced by role and current state.

### Home And Mine

1. Web calls `handleUser.getUserProfile`.
2. Web calls `handleUser.getUserStats`.
3. Frontend local cache is display-only and not authoritative.

## Error Handling

All cloud functions should return stable response shapes:

```json
{
  "success": false,
  "code": "SESSION_EXPIRED",
  "error": "登录已过期，请重新登录"
}
```

Expected error code groups:

- Auth: `AUTH_REQUIRED`, `SESSION_EXPIRED`, `INVALID_CREDENTIALS`, `FORBIDDEN`.
- Account: `ACCOUNT_EXISTS`, `PHONE_CONFLICT`, `USER_NOT_FOUND`.
- Order: `ORDER_NOT_FOUND`, `INVALID_ORDER_STATUS`, `ORDER_ALREADY_ACCEPTED`, `TRAINING_REQUIRED`.
- Appointment: `APPOINTMENT_NOT_FOUND`, `APPOINTMENT_CONFLICT`, `INVALID_APPOINTMENT_STATUS`.
- Validation: `VALIDATION_ERROR`.

Frontend behavior:

- Expired sessions route to login.
- Location failure allows retry and clear fallback UI.
- Cloud function errors are shown as understandable user-facing messages.
- The Web first phase should avoid broad simulated-data fallbacks for core flows so backend problems are visible during testing.

## Verification

### Backend Verification

- Install or verify `tcb` CLI.
- Run CloudBase CLI health checks.
- Verify target environment details and current cloud function list.
- Deploy audited core functions to `cloud1-d8gbfzr7t6c5dc8bc`.
- Run repeatable database initialization.
- Invoke `webAuth.register`, `login`, `me`, and `logout`.
- Invoke core business functions with Web auth token.
- Verify same-phone user binding.
- Verify volunteer training gate before accepting orders.
- Verify order status transitions and duplicate completion behavior.
- Verify appointment creation and list behavior.

### Frontend Verification

- Start the local Vite dev server.
- Use `agent-browser` to open the app in a real browser.
- Use accessibility snapshots to inspect forms, buttons, navigation, and route changes.
- Test registration, login, profile, home, training, order publishing, volunteer accepting, appointment, and mine flows.
- Capture desktop and mobile viewport screenshots.
- Compress screenshots before visual inspection. Do not inspect raw high-resolution screenshots directly.
- Confirm desktop viewport shows `DeviceFrame`.
- Confirm mobile viewport renders pure app.
- Confirm status bar, app navigation, content, TabBar, input bars, and home indicator do not overlap.

## Security Notes

- SecretId, SecretKey, passwords, session tokens, and private user data must not be committed to code or docs.
- Cloud credentials supplied in conversation should be treated as exposed and rotated after the operation.
- Passwords are hashed with salt.
- Session tokens are stored server-side as hashes when practical.
- Sensitive fields should not be returned from public volunteer or user lookup APIs.

## Implementation Handoff

After this design is approved, create a detailed implementation plan under `docs/superpowers/plans/`. That plan should include:

- CloudBase CLI setup.
- Backend audit and refactor tasks.
- `webAuth` implementation.
- New-environment initialization.
- Web scaffold.
- Claude Code frontend sub-agent handoff using the Frontend Design skill.
- `agent-browser` verification tasks with compressed screenshot workflow.
