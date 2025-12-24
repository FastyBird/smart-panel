# Implementation Plan: Spaces-first UX Epic

**Epic ID**: EPIC-SPACES-FIRST-UX
**Branch**: `claude/spaces-first-ux-KrGEe`
**Status**: Planning

---

## Overview

This plan implements the Spaces-first UX in 4 phases, following the child task dependencies:

```
FEATURE-SPACES-MODULE (Phase 1)
    ↓
TECH-SPACES-ONBOARDING-WIZARD (Phase 2)
    ↓
FEATURE-DASHBOARD-SPACE-PAGE (Phase 3)
    ↓
FEATURE-SPACE-INTENTS-LIGHTING-MVP (Phase 4)
```

---

## Phase 1: Spaces Module (FEATURE-SPACES-MODULE)

**Scope**: Backend + Admin
**Size**: Medium

### Backend Implementation

#### Step 1.1: Create Spaces Module Structure
```
apps/backend/src/modules/spaces/
├── controllers/
│   └── spaces.controller.ts
├── dto/
│   ├── create-space.dto.ts
│   └── update-space.dto.ts
├── entities/
│   └── space.entity.ts
├── models/
│   ├── space.model.ts
│   └── spaces.model.ts
├── services/
│   └── spaces.service.ts
├── spaces.constants.ts
├── spaces.exceptions.ts
├── spaces.module.ts
└── spaces.openapi.ts
```

#### Step 1.2: Space Entity
- Fields: `id`, `name`, `description`, `icon`, `order`, `createdAt`, `updatedAt`
- Follows BaseEntity pattern from existing modules

#### Step 1.3: Add spaceId to Device and Display
- Add nullable `spaceId` column to `DeviceEntity`
- Add nullable `spaceId` column to `DisplayEntity`
- Create ManyToOne relationships to SpaceEntity
- Deletion behavior: SET NULL (devices/displays remain, just unassigned)

#### Step 1.4: Spaces Service
- CRUD operations following existing patterns
- Event emission for real-time updates
- Methods: `findAll()`, `findOne()`, `create()`, `update()`, `remove()`
- Additional: `findDevicesBySpace()`, `findDisplaysBySpace()`

#### Step 1.5: Spaces Controller
- REST endpoints with Swagger decorators
- `GET /spaces` - list all spaces
- `GET /spaces/:id` - get single space
- `POST /spaces` - create space
- `PATCH /spaces/:id` - update space
- `DELETE /spaces/:id` - delete space
- `GET /spaces/:id/devices` - list devices in space
- `GET /spaces/:id/displays` - list displays in space

#### Step 1.6: Device/Display Assignment Endpoints
- `PATCH /devices/:id` - add `spaceId` to update DTO
- `PATCH /displays/:id` - add `spaceId` to update DTO
- Bulk assignment: `POST /spaces/:id/devices` with device IDs array

#### Step 1.7: Database Migration
- Create `spaces` table
- Add `space_id` column to `devices` and `displays` tables
- Add foreign key constraints with ON DELETE SET NULL

#### Step 1.8: Unit Tests
- SpacesService CRUD tests
- Assignment/unassignment tests
- Cascade behavior tests

### Admin Implementation

#### Step 1.9: Create Spaces Module in Admin
```
apps/admin/src/modules/spaces/
├── components/
│   ├── space-form.vue
│   ├── space-list.vue
│   └── space-assignment.vue
├── store/
│   └── spaces.store.ts
├── views/
│   ├── spaces-list.vue
│   └── space-detail.vue
├── router/
│   └── index.ts
└── index.ts
```

#### Step 1.10: Spaces CRUD UI
- List view with create/edit/delete actions
- Form with name, description, icon picker
- Follows ElementPlus patterns from existing modules

#### Step 1.11: Device Assignment UI
- Device list with space filter/selector
- Bulk selection and assignment
- Visual grouping by current space

#### Step 1.12: Display Assignment UI
- Display list with space dropdown
- Single space per display
- Clear indication of unassigned displays

---

## Phase 2: Onboarding Wizard (TECH-SPACES-ONBOARDING-WIZARD)

**Scope**: Admin + Backend
**Size**: Medium
**Depends on**: Phase 1

### Backend Implementation

#### Step 2.1: Space Proposal Endpoint
- `POST /spaces/propose` - analyze device names and suggest spaces
- Simple heuristics: extract room tokens from device names
- Common tokens: "living room", "bedroom", "kitchen", "bathroom", "office", etc.
- Returns proposed spaces with matched device IDs

#### Step 2.2: Bulk Assignment Endpoint
- `POST /spaces/bulk-assign` - idempotent bulk assignment
- Request body: `{ assignments: [{ spaceId, deviceIds[], displayIds[] }] }`
- Single transaction for atomicity

#### Step 2.3: Integration Import (Optional)
- If HA plugin exists: endpoint to import areas as spaces
- `POST /spaces/import/home-assistant`
- Maps HA areas to spaces, preserves device-area relationships

### Admin Implementation

#### Step 2.4: Wizard Component Structure
```
apps/admin/src/modules/spaces/components/wizard/
├── spaces-wizard.vue          # Main wizard container
├── step-create-spaces.vue     # Step 1: Create/confirm spaces
├── step-assign-displays.vue   # Step 2: Assign displays
├── step-assign-devices.vue    # Step 3: Bulk assign devices
└── step-summary.vue           # Step 4: Review + next steps
```

#### Step 2.5: Step 1 - Create/Confirm Spaces
- Show proposed spaces from backend
- Allow adding/removing/renaming spaces
- Visual list with device count estimates

#### Step 2.6: Step 2 - Assign Displays
- Show all displays with space dropdown
- Highlight unassigned displays
- Require assignment before proceeding (or allow skip)

#### Step 2.7: Step 3 - Assign Devices
- Grouped by current space (or "Unassigned")
- Drag-and-drop or multi-select assignment
- Smart suggestions based on device names

#### Step 2.8: Step 4 - Summary
- Show spaces with device/display counts
- "Create Space Pages" CTA (leads to Phase 3)
- "Done" to exit wizard

#### Step 2.9: Wizard Entry Points
- Tools menu in admin sidebar
- First-run detection (if no spaces exist)
- Button in Spaces list view

---

## Phase 3: Space Page Type (FEATURE-DASHBOARD-SPACE-PAGE)

**Scope**: Backend + Admin + Panel
**Size**: Large
**Depends on**: Phase 1

### Backend Implementation

#### Step 3.1: Create pages-spaces Plugin
```
apps/backend/src/plugins/pages-spaces/
├── entities/
│   └── space-page.entity.ts
├── dto/
│   ├── create-space-page.dto.ts
│   └── update-space-page.dto.ts
├── models/
│   └── space-page-read.model.ts
├── services/
│   ├── space-page.service.ts
│   └── space-page-read-model.service.ts
├── pages-spaces.constants.ts
├── pages-spaces.module.ts
└── pages-spaces.openapi.ts
```

#### Step 3.2: SpacePageEntity
- Extends PageEntity with @ChildEntity('space')
- Additional fields: `spaceId` (required), `viewMode` (optional: 'simple'|'detailed')
- ManyToOne relationship to SpaceEntity

#### Step 3.3: SpacePageReadModelService
- Assembles render model for panel
- Queries devices in space
- Groups by capability domain:
  - **Lights**: devices with `on` property (light category)
  - **Climate**: devices with temperature/thermostat properties
  - **Covers**: devices with position/cover properties
  - **Media**: devices with media player properties
  - **Sensors**: devices with sensor readings
- Returns deterministic view model

#### Step 3.4: Space Page API Response Model
```typescript
interface SpacePageReadModel {
  space: { id, name, icon };
  sections: {
    lights?: { devices: LightDevice[], summary: { on: number, total: number } };
    climate?: { devices: ClimateDevice[], summary: { avgTemp: number } };
    covers?: { devices: CoverDevice[], summary: { open: number, total: number } };
    sensors?: SensorReading[];
  };
}
```

#### Step 3.5: Register Page Type
- Register in PagesTypeMapperService
- Register discriminator
- Register Swagger models
- Register relation loaders

#### Step 3.6: Unit Tests
- SpacePageReadModelService tests
- Device grouping logic tests
- Empty space handling tests

### Admin Implementation

#### Step 3.7: Space Page Form Component
- Space selector (required)
- View mode selector (optional)
- Inherits common page fields (title, icon, displays)

#### Step 3.8: Space Page in Page Type Selector
- Add "Space" option to page type dropdown
- Icon and description for clarity

#### Step 3.9: Quick Create from Wizard
- "Create Space Pages" action from wizard summary
- Auto-creates one SpacePage per space with display assigned

### Panel Implementation

#### Step 3.10: SpacePage Model
```dart
class SpacePageModel extends PageModel {
  final String spaceId;
  final String? viewMode;
  final SpacePageData? data;
}

class SpacePageData {
  final SpaceInfo space;
  final LightsSection? lights;
  final ClimateSection? climate;
  final CoversSection? covers;
  final List<SensorReading>? sensors;
}
```

#### Step 3.11: SpacePage View
```
apps/panel/lib/modules/dashboard/views/pages/
└── space.dart
```
- Header: Space name + status badges
- Sections: Lights, Climate, Covers, Sensors (conditional)
- Each section: summary + device list

#### Step 3.12: Section Components
- **LightsSection**: On/Off toggle, brightness indicator, device chips
- **ClimateSection**: Current temp display, setpoint (if thermostat)
- **CoversSection**: Open/closed status, position controls
- **SensorsSection**: Reading cards with values

#### Step 3.13: Empty States
- Graceful handling when space has no devices
- "No lights in this space" type messages
- No crashes on missing data

#### Step 3.14: Page Type Registration
- Register 'space' type in page type mapper
- Add to page view dispatcher

---

## Phase 4: Lighting Intents MVP (FEATURE-SPACE-INTENTS-LIGHTING-MVP)

**Scope**: Backend + Panel
**Size**: Medium
**Depends on**: Phase 3

### Backend Implementation

#### Step 4.1: SpaceIntentService
```
apps/backend/src/modules/spaces/services/
└── space-intent.service.ts
```

#### Step 4.2: Intent Types
```typescript
enum LightingIntent {
  OFF = 'off',
  ON = 'on',
  MODE_WORK = 'mode_work',
  MODE_RELAX = 'mode_relax',
  MODE_NIGHT = 'mode_night',
  BRIGHTNESS_UP = 'brightness_up',
  BRIGHTNESS_DOWN = 'brightness_down',
}
```

#### Step 4.3: Intent Execution Logic
- Query all lights in space
- For each light:
  - OFF: set `on` = false
  - ON: set `on` = true
  - MODE_WORK: `on` = true, `brightness` = 100 (if supported)
  - MODE_RELAX: `on` = true, `brightness` = 50 (if supported)
  - MODE_NIGHT: `on` = true, `brightness` = 10 (if supported)
  - BRIGHTNESS_UP: `brightness` += 20 (clamped 0-100)
  - BRIGHTNESS_DOWN: `brightness` -= 20 (clamped 0-100)
- Use existing device command dispatch

#### Step 4.4: Intent API Endpoint
- `POST /spaces/:id/intents/lighting`
- Request: `{ intent: 'mode_work' }`
- Response: `{ success: true, affectedDevices: number }`

#### Step 4.5: Safety Handling
- No-op if space has no lights
- Skip brightness commands for on/off-only devices
- Log intent execution for debugging

#### Step 4.6: Unit Tests
- No lights scenario
- Mixed capability devices
- Brightness clamping
- All intent types

### Panel Implementation

#### Step 4.7: Intent Controls in LightsSection
```dart
class LightingIntentControls extends StatelessWidget {
  // Off | On buttons
  // Work | Relax | Night mode buttons
  // Brightness +/- buttons
}
```

#### Step 4.8: API Integration
- Call intent endpoint on button press
- Show loading state during execution
- Handle errors gracefully

#### Step 4.9: Visual Feedback
- Highlight active mode (based on current state analysis)
- Disable brightness controls if no dimmable lights

---

## Testing Strategy

### Backend Tests
- Unit tests for all new services
- E2E tests for critical API flows
- Test files in `apps/backend/src/modules/spaces/__tests__/`

### Admin Tests
- Component tests for wizard steps (if testing framework exists)
- Manual testing checklist

### Panel Tests
- Widget tests for SpacePage components
- Integration tests for intent controls

---

## Migration & Backward Compatibility

### Database Migration
- Single migration file for all schema changes
- Reversible with proper `down()` method
- No data loss for existing devices/displays

### API Compatibility
- All new endpoints are additive
- Existing endpoints unchanged
- `spaceId` is nullable on devices/displays

### UI Compatibility
- Existing dashboard pages unaffected
- SpacePage is optional addition
- No forced migration

---

## Deliverables Checklist

### Phase 1: Spaces Module
- [ ] Backend: SpaceEntity, SpacesService, SpacesController
- [ ] Backend: spaceId on Device/Display entities
- [ ] Backend: Assignment endpoints
- [ ] Backend: Database migration
- [ ] Backend: Unit tests
- [ ] Admin: Spaces CRUD UI
- [ ] Admin: Device/Display assignment UI

### Phase 2: Onboarding Wizard
- [ ] Backend: Space proposal endpoint
- [ ] Backend: Bulk assignment endpoint
- [ ] Admin: Wizard component with 4 steps
- [ ] Admin: Wizard entry points

### Phase 3: Space Page Type
- [ ] Backend: pages-spaces plugin
- [ ] Backend: SpacePageReadModelService
- [ ] Backend: Page type registration
- [ ] Backend: Unit tests
- [ ] Admin: Space page form
- [ ] Panel: SpacePage view
- [ ] Panel: Section components
- [ ] Panel: Empty states

### Phase 4: Lighting Intents
- [ ] Backend: SpaceIntentService
- [ ] Backend: Intent API endpoint
- [ ] Backend: Unit tests
- [ ] Panel: Intent controls
- [ ] Panel: Visual feedback

---

## Estimated Effort

| Phase | Backend | Admin | Panel |
|-------|---------|-------|-------|
| 1. Spaces Module | Medium | Medium | - |
| 2. Onboarding Wizard | Small | Medium | - |
| 3. Space Page Type | Medium | Small | Large |
| 4. Lighting Intents | Small | - | Medium |

**Total**: Large (as specified in epic)

---

## Risk Mitigation

1. **Complexity creep**: Stick to MVP scope, defer advanced features
2. **Breaking changes**: All new code is additive, test existing flows
3. **Panel performance**: Lazy load sections, optimize API responses
4. **Missing device capabilities**: Graceful degradation, no crashes

---

## Next Steps

1. Review and approve this plan
2. Begin Phase 1 implementation
3. Iterate through phases sequentially
4. Mark child tasks complete as phases finish
