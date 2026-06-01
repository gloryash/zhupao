# Web Order Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the Web companion-run publish and volunteer matching flow with map point selection, precise departure time, stable filters, and verified CloudBase filtering.

**Architecture:** Keep the mini-program frontend untouched. The Web app continues to call existing CloudBase functions through the existing `/api/cloud-function` proxy. Frontend changes live in focused Web components/helpers; backend changes extend `handleOrder` in a backward-compatible way.

**Tech Stack:** React + Vite + TypeScript, Leaflet/OpenStreetMap/Nominatim, Tencent CloudBase `handleOrder`, agent-browser headed QA.

---

### Task 1: Frontend Address And Departure Refinement

**Files:**
- Modify: `web/src/components/AddressSearchField.tsx`
- Create or modify: `web/src/components/InlineMapPicker.tsx`
- Create or modify: `web/src/components/DepartureTimeControl.tsx`
- Modify: `web/src/pages/SportPage.tsx`
- Modify: `web/src/services/api.ts`
- Modify: `web/src/types/index.ts`
- Modify: `web/src/types/location.ts`
- Modify: `web/src/lib/orderFilters.ts`
- Modify: `web/src/styles.css`
- Add tests where helpers are extracted under `web/src/lib/*.test.ts`

- [ ] Add map-pick mode below each address input. It must use Leaflet click selection plus reverse geocoding and must not expose latitude/longitude inputs.
- [ ] Preserve search history display below search mode and keep the map visually below the input, never overlaying history rows.
- [ ] Add departure controls: `immediate` or delayed by hours/minutes, without day selection in runner publish.
- [ ] Submit `departureMode`, `departureOffsetMinutes`, `departureAt`, and derived label fields while keeping `runTimeWindow` compatible.
- [ ] Fix publish success to set `activeOrder` from the returned order without triggering an extra forced reload.
- [ ] Replace volunteer filter dropdown behavior with a stable in-page card/control set that cannot jump to the viewport corner.
- [ ] Add volunteer filters for hour/day and city search/current city while keeping distance basis defaulted to `origin`.

### Task 2: Backend CloudBase Order Filtering

**Files:**
- Modify: `cloudfunctions/handleOrder/index.js`

- [ ] Store new publish fields: `departureMode`, `departureOffsetMinutes`, `departureAt`, `departureHour`, `departureDate`, and `departureLabel`.
- [ ] Keep accepting older clients that only send `runTimeWindow`.
- [ ] Extend waiting-order filters with `departureFilterType`, `departureHour`, `departureDate`, `departureWithinMinutes`, and normalized city matching.
- [ ] Keep `distanceBasis` defaulted to `origin` and return the selected basis on each order.
- [ ] Verify with direct CloudBase invocation and database query after deployment.

### Task 3: Verification

**Files:**
- No product files unless verification exposes defects.

- [ ] Run `node -c cloudfunctions/handleOrder/index.js`.
- [ ] Run `cd web && npm run typecheck`.
- [ ] Run `cd web && npm run build`.
- [ ] Deploy `handleOrder` to `cloud1-d8gbfzr7t6c5dc8bc`.
- [ ] Use visible `agent-browser --headed` to verify runner publish via search and map point selection.
- [ ] Verify volunteer filtering: default distance basis is start location, filter panel is stable, city can use current city or searched prefecture-level city, and time filtering works.
- [ ] Complete one order from publish through volunteer accept, arrival, running, location upload, and completion.
