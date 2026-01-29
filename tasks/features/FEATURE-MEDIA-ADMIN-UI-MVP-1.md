# Task: Media Domain – Admin UI MVP #1 (Endpoints Diagnostics + Activity Bindings Editor)
ID: FEATURE-MEDIA-ADMIN-UI-MVP-1
Type: feature
Scope: admin
Size: large
Parent: (none)
Status: in-progress

## 1. Business goal

In order to configure media routing for spaces
As an admin
I want to view derived media endpoints and edit activity bindings per space

## 2. Context

- Backend APIs already exist: endpoints read model, bindings CRUD, apply-defaults
- Media domain V2 uses routing-based architecture with derived endpoints
- Admin app uses Element Plus, Pinia, openapi-fetch, Vue 3 Composition API
- Spaces module already has tabs for devices, scenes, displays in the detail view

## 3. Scope

**In scope**

- Space detail: new "Media" tab with sub-tabs for Endpoints and Activities
- Media Endpoints diagnostics list (read-only table with type/capability badges)
- Media Activities bindings editor (activity list + slot editor form)
- Apply defaults action
- Pinia store for media endpoints and bindings
- Component and store tests

**Out of scope**

- Activation buttons (next PR)
- Custom activity creation
- Routing list beyond fixed MVP keys
- YAML editing in Admin

## 4. Acceptance criteria

- [ ] Admin can see endpoints list with types and capability badges
- [ ] Admin can edit bindings for each activity and save successfully
- [ ] Apply defaults fills missing bindings and UI refreshes
- [ ] Overrides fields appear only when meaningful
- [ ] Errors from server are shown clearly in the form
- [ ] No "guessing" in UI (only show what backend supports)
- [ ] Empty states are informative
- [ ] Switching activities never loses saved state
- [ ] Component test for Activities editor form rendering + filtering logic
- [ ] Store tests for fetch/save/apply defaults (mock API)

## 5. Example scenarios (optional, Gherkin-style)

### Scenario: Admin views media endpoints

Given a space has devices with media capabilities
When the admin navigates to the Media Endpoints tab
Then the admin sees a table of derived endpoints with type badges and capability indicators

### Scenario: Admin edits activity binding

Given a space has derived endpoints
When the admin selects the "watch" activity
Then the editor shows slot selectors filtered by endpoint type
And the admin can assign endpoints and save the binding

### Scenario: Admin applies defaults

Given a space has no bindings configured
When the admin clicks "Apply defaults"
Then the system creates bindings using heuristic defaults
And the UI refreshes to show the new bindings

## 6. Technical constraints

- Follow existing spaces module patterns for store, composables, components
- Use openapi-fetch typed client for API calls
- Use Element Plus components consistently
- Do not modify generated OpenAPI files

## 7. Implementation hints

- Add media sub-tabs inside the existing space detail view
- Create a dedicated composable `useSpaceMedia` for endpoints + bindings state
- Reuse the existing `SpacesModuleCreateMediaEndpointType` and activity key enums from openapi.ts
- Filter endpoint selectors by type to ensure slot type safety

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
