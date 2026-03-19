# Task: Companion Display Admin UI
ID: FEATURE-COMPANION-ADMIN-UI
Type: feature
Scope: admin
Size: medium
Parent: EPIC-COMPANION-DISPLAY
Status: planned

## 1. Business goal

In order to create, configure, and manage companion displays from the admin interface,
As a system administrator,
I want an admin UI that lets me assign companion displays to parent displays, configure transport settings, preview compiled screens, and trigger firmware uploads.

## 2. Context

- Depends on `FEATURE-COMPANION-BACKEND-PLUGIN` for the CRUD API
- Depends on `FEATURE-COMPANION-SCREEN-COMPILER` for screen preview (can be added incrementally)
- Depends on `FEATURE-COMPANION-PROVISIONING` for the upload workflow (can be added incrementally)
- Admin app uses Vue.js and follows patterns in `apps/admin/src/plugins/`
- Related: `EPIC-COMPANION-DISPLAY` (parent epic)

## 3. Scope

**In scope**
- Companion display list view (showing all companions with status)
- Create companion form (select parent display, name, transport config)
- Edit companion form (update settings)
- Delete companion with confirmation
- Companion detail view showing: parent display info, transport status, firmware version, compiled screens preview
- Upload/deploy button (triggers firmware build + OTA push)
- Deploy progress indicator (build progress, upload progress)

**Out of scope**
- Screen customization UI (v1 uses auto-generated screens only)
- Real-time companion status WebSocket updates (use polling for v1)
- Companion display simulator/preview renderer

## 4. Acceptance criteria

- [ ] Companion displays appear in admin navigation
- [ ] List view shows all companions with name, parent display, status, firmware version
- [ ] Create form allows selecting a parent display and configuring transport
- [ ] Edit form allows updating companion settings
- [ ] Delete action removes the companion with confirmation dialog
- [ ] Detail view shows compiled screens preview (screen type, entity, parameters)
- [ ] "Generate & Upload" button triggers the deploy endpoint
- [ ] Deploy progress is shown to the user (building → uploading → done/error)
- [ ] Error states are handled gracefully (no companion connected, build failure, OTA failure)

## 5. Example scenarios

### Scenario: Create a new companion display

Given the admin navigates to Companion Displays section
When they click "Add Companion Display"
Then a form appears with:
  - Name field
  - Parent display dropdown (populated from existing displays)
  - Transport type selector (USB Serial)
  - Serial port field (e.g. /dev/ttyACM0)
And after submitting, the new companion appears in the list

### Scenario: Deploy firmware to companion

Given a companion display is configured with a parent display
When the admin clicks "Generate & Upload"
Then a progress modal shows:
  1. "Compiling screens..." (screen compiler runs)
  2. "Building firmware..." (ESPHome compiles)
  3. "Uploading..." (OTA push or USB flash)
  4. "Done" or error message

## 6. Technical constraints

- Follow the existing admin plugin pattern in `apps/admin/src/plugins/`
- Use the generated OpenAPI client for API calls
- Follow existing UI component patterns and styling
- Do not modify generated code

## 7. Implementation hints

- Look at existing admin plugins for list/detail/form patterns
- The deploy progress can use polling against a status endpoint
- Screen preview can be a simple table showing screen type, mapped entity, and parameters

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Follow the existing admin plugin patterns in the codebase.
- Keep changes scoped to admin only.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
