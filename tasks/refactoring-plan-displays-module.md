# Refactoring Plan: Consolidate Display Definitions into `displays` Module

## Executive Summary

Create a new `displays` module that consolidates all display-related functionality currently split between the `users` module (display instances) and `system` module (display profiles). This will provide a single, cohesive module for managing displays, their configurations, and access control.

---

## Current State Analysis

### Users Module - Display Instances
| Component | File | Purpose |
|-----------|------|---------|
| Controller | `users/controllers/displays-instances.controller.ts` | CRUD for display instances |
| Service | `users/services/displays-instances.service.ts` | Business logic for display instances |
| Entity | `users/entities/users.entity.ts` → `DisplayInstanceEntity` | Physical device registration (uid, mac, version, build, user) |
| DTOs | `users/dto/create-display-instance.dto.ts`, `update-display-instance.dto.ts` | Input validation |
| Models | `users/models/users-response.model.ts` → `DisplayInstance*ResponseModel` | API responses |
| Subscriber | `users/subscribers/system-display-entity.subscriber.ts` | Links instances to profiles |
| Constants | `users/users.constants.ts` → `EventType.DISPLAY_INSTANCE_*` | Event types |
| Module Reset | `users/services/module-reset.service.ts` | Handles display instance reset |

### System Module - Display Profiles
| Component | File | Purpose |
|-----------|------|---------|
| Controller | `system/controllers/displays-profiles.controller.ts` | CRUD for display profiles |
| Service | `system/services/displays-profiles.service.ts` | Business logic for display profiles |
| Entity | `system/entities/system.entity.ts` → `DisplayProfileEntity` | Display configuration (screen size, grid, etc.) |
| DTOs | `system/dto/create-display-profile.dto.ts`, `update-display-profile.dto.ts` | Input validation |
| Models | `system/models/system-response.model.ts` → `DisplayProfile*ResponseModel` | API responses |
| Validator | `system/validators/display-profile-exists-constraint.validator.ts` | Display profile existence check |
| Constants | `system/system.constants.ts` → `EventType.DISPLAY_PROFILE_*` | Event types |
| Module Reset | `system/services/module-reset.service.ts` | Handles display profile reset |

### External Dependencies
| Module | Usage |
|--------|-------|
| **Auth** | Creates display instances during registration (`auth.controller.ts`) |
| **Dashboard** | References `DisplayProfileEntity` for page layout (`pages.service.ts`, `dashboard.entity.ts`) |

---

## Target Architecture

### New Module Structure
```
apps/backend/src/modules/displays/
├── controllers/
│   ├── profiles.controller.ts              # Display profiles CRUD
│   ├── profiles.controller.spec.ts
│   ├── instances.controller.ts             # Display instances CRUD  
│   └── instances.controller.spec.ts
├── dto/
│   ├── create-profile.dto.ts
│   ├── update-profile.dto.ts
│   ├── create-instance.dto.ts
│   └── update-instance.dto.ts
├── entities/
│   └── displays.entity.ts                  # Both entities in one file
├── models/
│   └── displays-response.model.ts          # All response models
├── services/
│   ├── profiles.service.ts
│   ├── profiles.service.spec.ts
│   ├── instances.service.ts
│   ├── instances.service.spec.ts
│   └── module-reset.service.ts
├── subscribers/
│   └── profile-instance-link.subscriber.ts # Links profiles to instances
├── validators/
│   ├── profile-exists-constraint.validator.ts
│   └── instance-exists-constraint.validator.ts
├── displays.constants.ts
├── displays.exceptions.ts
├── displays.module.ts
└── displays.openapi.ts
```

### API Routes (New)
| Old Route | New Route |
|-----------|-----------|
| `GET /users-module/displays-instances` | `GET /displays-module/instances` |
| `GET /system-module/displays-profiles` | `GET /displays-module/profiles` |

---

## Detailed Refactoring Steps

### Phase 1: Create New Module Foundation

#### Step 1.1: Create Module Constants
Create `displays.constants.ts`:
```typescript
export const DISPLAYS_MODULE_PREFIX = 'displays-module';
export const DISPLAYS_MODULE_NAME = 'displays-module';
export const DISPLAYS_MODULE_API_TAG_NAME = 'Displays module';
export const DISPLAYS_MODULE_API_TAG_DESCRIPTION = 
  'Endpoints for managing display devices and their configuration profiles.';

export enum EventType {
  // Profile events
  PROFILE_CREATED = 'DisplaysModule.Profile.Created',
  PROFILE_UPDATED = 'DisplaysModule.Profile.Updated',
  PROFILE_DELETED = 'DisplaysModule.Profile.Deleted',
  PROFILE_RESET = 'DisplaysModule.Profile.Reset',
  // Instance events
  INSTANCE_CREATED = 'DisplaysModule.Instance.Created',
  INSTANCE_UPDATED = 'DisplaysModule.Instance.Updated',
  INSTANCE_DELETED = 'DisplaysModule.Instance.Deleted',
  INSTANCE_RESET = 'DisplaysModule.Instance.Reset',
  // Module events
  MODULE_RESET = 'DisplaysModule.All.Reset',
}
```

#### Step 1.2: Create Module Exceptions
Create `displays.exceptions.ts`:
```typescript
export class DisplaysException extends Error { ... }
export class DisplaysNotFoundException extends DisplaysException { ... }
export class DisplaysValidationException extends DisplaysException { ... }
```

#### Step 1.3: Create Entities File
Create `displays.entity.ts` combining both entities:
- Move `DisplayProfileEntity` from `system/entities/system.entity.ts`
- Move `DisplayInstanceEntity` from `users/entities/users.entity.ts`
- Update table names:
  - `system_module_displays_profiles` → `displays_module_profiles`
  - `users_module_displays_instances` → `displays_module_instances`
- Update `@ApiSchema` names to use `DisplaysModule*` prefix

### Phase 2: Migrate Services

#### Step 2.1: Create Profile Service
Move `DisplaysProfilesService` → `ProfilesService`:
- Update imports to use new entity location
- Update exception classes
- Update event types

#### Step 2.2: Create Instance Service
Move `DisplaysInstancesService` → `InstancesService`:
- Update imports to use new entity location
- Update exception classes
- Update event types
- **Keep dependency on UsersService** (display instance belongs to a user)

#### Step 2.3: Create Module Reset Service
Combine reset logic from both modules:
- Reset instances first (cascade delete)
- Reset profiles
- Emit appropriate events

### Phase 3: Migrate Controllers

#### Step 3.1: Create Profiles Controller
Move `DisplaysProfilesController` → `ProfilesController`:
- Update route from `displays-profiles` to `profiles`
- Update API tags to `DISPLAYS_MODULE_API_TAG_NAME`
- Update `operationId` prefixes to `displays-module-*`
- Update Location header prefix

#### Step 3.2: Create Instances Controller
Move `DisplaysInstancesController` → `InstancesController`:
- Update route from `displays-instances` to `instances`
- Update API tags to `DISPLAYS_MODULE_API_TAG_NAME`
- Update `operationId` prefixes to `displays-module-*`
- Update Location header prefix

### Phase 4: Migrate DTOs, Validators, and Models

#### Step 4.1: Migrate DTOs
- Move and rename DTO files
- Update `@ApiSchema` names to `DisplaysModule*`

#### Step 4.2: Migrate Validators
- Move `DisplayProfileExistsConstraintValidator` → `ProfileExistsConstraintValidator`
- Create `InstanceExistsConstraintValidator` if needed

#### Step 4.3: Migrate Response Models
Combine all response models in `displays-response.model.ts`:
- `ProfileResponseModel`, `ProfilesResponseModel`, `ProfileByUidResponseModel`
- `InstanceResponseModel`, `InstancesResponseModel`, `InstanceByUidResponseModel`

### Phase 5: Create Module Definition

Create `displays.module.ts`:
```typescript
@ApiTag({
  tagName: DISPLAYS_MODULE_NAME,
  displayName: DISPLAYS_MODULE_API_TAG_NAME,
  description: DISPLAYS_MODULE_API_TAG_DESCRIPTION,
})
@Module({
  imports: [
    TypeOrmModule.forFeature([DisplayProfileEntity, DisplayInstanceEntity]),
    forwardRef(() => UsersModule), // Circular dependency for user association
  ],
  providers: [
    ProfilesService,
    InstancesService,
    ModuleResetService,
    ProfileExistsConstraintValidator,
    ProfileInstanceLinkSubscriber,
  ],
  controllers: [ProfilesController, InstancesController],
  exports: [
    ProfilesService,
    InstancesService,
    ProfileExistsConstraintValidator,
  ],
})
export class DisplaysModule { ... }
```

### Phase 6: Update Dependent Modules

#### Step 6.1: Update Auth Module
In `auth.controller.ts`:
- Change import from `users/services/displays-instances.service` to `displays/services/instances.service`
- Change import for `CreateDisplayInstanceDto`

#### Step 6.2: Update Dashboard Module
In `dashboard.entity.ts`, `pages.service.ts`, `create-page.dto.ts`, `update-page.dto.ts`:
- Change imports for `DisplayProfileEntity` and `DisplaysProfilesService`
- Change validator import

#### Step 6.3: Update Users Module
- Remove `DisplayInstanceEntity` from TypeORM features
- Remove `DisplaysInstancesService` provider
- Remove `DisplaysInstancesController` from controllers
- Remove display-related exports
- Remove `SystemDisplayEntitySubscriber`
- Update `ModuleResetService` to not reset displays (delegate to displays module)
- Update constants to remove display events
- Keep `UserEntity` relationship to `DisplayInstanceEntity` (reference only)

#### Step 6.4: Update System Module
- Remove `DisplayProfileEntity` from TypeORM features
- Remove `DisplaysProfilesService` provider
- Remove `DisplaysProfilesController` from controllers
- Remove display-related exports
- Remove `DisplayProfileExistsConstraintValidator`
- Update `ModuleResetService` to not reset displays (delegate to displays module)
- Update constants to remove display events

### Phase 7: Database Migration

Create TypeORM migration to:
1. Rename tables:
   - `system_module_displays_profiles` → `displays_module_profiles`
   - `users_module_displays_instances` → `displays_module_instances`
2. Update any foreign key references

### Phase 8: Update OpenAPI Specification

Update `spec/api/v1/openapi.json`:
- Add new `Displays module` tag
- Move endpoints under new paths:
  - `/displays-module/profiles/*`
  - `/displays-module/instances/*`
- Update schema names from `UsersModule*`/`SystemModule*` to `DisplaysModule*`
- Remove old endpoints from users and system modules

### Phase 9: Cleanup

#### Step 9.1: Remove Old Files from Users Module
- `users/controllers/displays-instances.controller.ts`
- `users/controllers/displays-instances.controller.spec.ts`
- `users/services/displays-instances.service.ts`
- `users/services/displays-instances.service.spec.ts`
- `users/dto/create-display-instance.dto.ts`
- `users/dto/update-display-instance.dto.ts`
- `users/subscribers/system-display-entity.subscriber.ts`
- Remove `DisplayInstanceEntity` from `users/entities/users.entity.ts`
- Update `users/models/users-response.model.ts` to remove display models
- Update `users/users.openapi.ts` to remove display models

#### Step 9.2: Remove Old Files from System Module
- `system/controllers/displays-profiles.controller.ts`
- `system/controllers/displays-profiles.controller.spec.ts`
- `system/services/displays-profiles.service.ts`
- `system/services/displays-profiles.service.spec.ts`
- `system/dto/create-display-profile.dto.ts`
- `system/dto/update-display-profile.dto.ts`
- `system/validators/display-profile-exists-constraint.validator.ts`
- Remove `DisplayProfileEntity` from `system/entities/system.entity.ts`
- Update `system/models/system-response.model.ts` to remove display models
- Update `system/system.openapi.ts` to remove display models

### Phase 10: Testing & Verification

#### Step 10.1: Update Unit Tests
- Migrate existing tests to new module structure
- Update mock imports and dependencies
- Ensure all tests pass

#### Step 10.2: Update E2E Tests
- Update endpoint paths in E2E tests
- Verify full CRUD operations work

#### Step 10.3: Verify Dependencies
- Ensure Auth module can still register displays
- Ensure Dashboard module can still reference display profiles
- Verify factory reset works correctly

---

## API Changes Summary

### Deprecated Endpoints (to be removed)
| Method | Old Path | Status |
|--------|----------|--------|
| GET | `/api/v1/users-module/displays-instances` | → REMOVED |
| GET | `/api/v1/users-module/displays-instances/:id` | → REMOVED |
| GET | `/api/v1/users-module/displays-instances/by-uid/:uid` | → REMOVED |
| POST | `/api/v1/users-module/displays-instances` | → REMOVED |
| PATCH | `/api/v1/users-module/displays-instances/:id` | → REMOVED |
| DELETE | `/api/v1/users-module/displays-instances/:id` | → REMOVED |
| GET | `/api/v1/system-module/displays-profiles` | → REMOVED |
| GET | `/api/v1/system-module/displays-profiles/:id` | → REMOVED |
| GET | `/api/v1/system-module/displays-profiles/by-uid/:uid` | → REMOVED |
| POST | `/api/v1/system-module/displays-profiles` | → REMOVED |
| PATCH | `/api/v1/system-module/displays-profiles/:id` | → REMOVED |
| DELETE | `/api/v1/system-module/displays-profiles/:id` | → REMOVED |

### New Endpoints
| Method | New Path | Operation ID |
|--------|----------|--------------|
| GET | `/api/v1/displays-module/instances` | `get-displays-module-instances` |
| GET | `/api/v1/displays-module/instances/:id` | `get-displays-module-instance` |
| GET | `/api/v1/displays-module/instances/by-uid/:uid` | `get-displays-module-instance-by-uid` |
| POST | `/api/v1/displays-module/instances` | `create-displays-module-instance` |
| PATCH | `/api/v1/displays-module/instances/:id` | `update-displays-module-instance` |
| DELETE | `/api/v1/displays-module/instances/:id` | `delete-displays-module-instance` |
| GET | `/api/v1/displays-module/profiles` | `get-displays-module-profiles` |
| GET | `/api/v1/displays-module/profiles/:id` | `get-displays-module-profile` |
| GET | `/api/v1/displays-module/profiles/by-uid/:uid` | `get-displays-module-profile-by-uid` |
| POST | `/api/v1/displays-module/profiles` | `create-displays-module-profile` |
| PATCH | `/api/v1/displays-module/profiles/:id` | `update-displays-module-profile` |
| DELETE | `/api/v1/displays-module/profiles/:id` | `delete-displays-module-profile` |

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking API changes | High | Document changes, coordinate with frontend teams |
| Database migration issues | Medium | Test migration on staging, create rollback plan |
| Circular dependencies | Medium | Use `forwardRef()` for module imports |
| Missing test coverage | Medium | Ensure all migrated tests pass before cleanup |
| Event listener issues | Medium | Verify all subscribers are updated with new event names |

---

## Estimated Effort

| Phase | Estimated Time |
|-------|----------------|
| Phase 1: Module Foundation | 1-2 hours |
| Phase 2: Services Migration | 2-3 hours |
| Phase 3: Controllers Migration | 2-3 hours |
| Phase 4: DTOs, Validators, Models | 1-2 hours |
| Phase 5: Module Definition | 1 hour |
| Phase 6: Update Dependencies | 2-3 hours |
| Phase 7: Database Migration | 1-2 hours |
| Phase 8: OpenAPI Update | 1-2 hours |
| Phase 9: Cleanup | 1-2 hours |
| Phase 10: Testing | 3-4 hours |
| **Total** | **15-24 hours** |

---

## Success Criteria

1. ✅ All display-related code consolidated in `displays` module
2. ✅ All existing functionality preserved
3. ✅ All unit and E2E tests passing
4. ✅ OpenAPI spec updated with new endpoints
5. ✅ Database migration works correctly
6. ✅ Dependent modules (Auth, Dashboard) function correctly
7. ✅ Factory reset works for displays module
8. ✅ No circular dependency issues
