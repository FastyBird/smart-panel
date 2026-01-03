# Task: Onboarding status backend API
ID: FEATURE-ONBOARDING-BACKEND
Type: feature
Scope: backend
Size: small
Parent: EPIC-APP-ONBOARDING
Status: planned

## 1. Business goal

In order to detect whether the application needs initial setup,
As the admin frontend,
I want a public API endpoint that returns the current onboarding status.

## 2. Context

The admin app needs to determine if it should show the onboarding wizard or the regular login page. This requires a public (unauthenticated) endpoint that checks:
- Whether an owner account exists
- Whether onboarding has been marked as completed
- Basic system statistics for decision making

**Existing code:**
- `apps/backend/src/modules/users/services/users.service.ts` - `findOwner()` method
- `apps/backend/src/modules/system/` - System module for health/info endpoints
- `apps/backend/src/modules/config/` - Module configuration storage

## 3. Scope

**In scope**

- Add `OnboardingStatusModel` data model
- Add `OnboardingStatusResponseModel` response wrapper
- Add `GET /system/onboarding` public endpoint
- Add `onboardingCompleted` field to system module config
- Add `POST /system/onboarding/complete` endpoint to mark completion
- Register new models in OpenAPI extra models
- Unit tests for new service methods

**Out of scope**

- Admin UI implementation (separate task)
- Integration step configuration (separate task)
- Weather location configuration (handled by existing weather module)

## 4. Acceptance criteria

- [ ] `GET /system/onboarding` returns onboarding status without authentication
- [ ] Response includes `hasOwner` boolean (true if owner account exists)
- [ ] Response includes `onboardingCompleted` boolean (from system config)
- [ ] Response includes `devicesCount`, `spacesCount`, `displaysCount` integers
- [ ] `POST /system/onboarding/complete` marks onboarding as completed (requires auth)
- [ ] Endpoint is properly documented in OpenAPI spec
- [ ] Unit tests cover the new functionality

## 5. Example scenarios

### Scenario: Fresh installation status check

Given a fresh installation with no users
When I call `GET /system/onboarding`
Then I receive:
```json
{
  "data": {
    "has_owner": false,
    "onboarding_completed": false,
    "devices_count": 0,
    "spaces_count": 0,
    "displays_count": 0
  }
}
```

### Scenario: After owner creation

Given an installation with owner account but incomplete onboarding
When I call `GET /system/onboarding`
Then `has_owner` is `true` and `onboarding_completed` is `false`

### Scenario: Mark onboarding complete

Given I am authenticated as the owner
When I call `POST /system/onboarding/complete`
Then the system config is updated
And subsequent calls to `GET /system/onboarding` show `onboarding_completed: true`

## 6. Technical constraints

- Endpoint must be public (use `@Public()` decorator)
- Follow existing response model patterns in system module
- Store completion flag in system module config (via ConfigService)
- Do not modify generated code

## 7. Implementation hints

**Files to create/modify:**

1. `apps/backend/src/modules/system/models/onboarding.model.ts` - Data model
2. `apps/backend/src/modules/system/models/system-response.model.ts` - Add response wrapper
3. `apps/backend/src/modules/system/system.openapi.ts` - Register models
4. `apps/backend/src/modules/system/services/onboarding.service.ts` - New service
5. `apps/backend/src/modules/system/controllers/system.controller.ts` - Add endpoints
6. `apps/backend/src/modules/system/system.module.ts` - Register service
7. `apps/backend/src/modules/system/models/config.model.ts` - Add `onboardingCompleted` to config

**OnboardingService methods:**
```typescript
async getStatus(): Promise<OnboardingStatusModel> {
  const owner = await this.usersService.findOwner();
  const config = this.configService.getModuleConfig<SystemConfigModel>(SYSTEM_MODULE_NAME);
  const [devices, spaces, displays] = await Promise.all([
    this.devicesService.count(),
    this.spacesService.count(),
    this.displaysService.count(),
  ]);
  return {
    hasOwner: owner !== null,
    onboardingCompleted: config.onboardingCompleted ?? false,
    devicesCount: devices,
    spacesCount: spaces,
    displaysCount: displays,
  };
}

async markComplete(): Promise<void> {
  await this.configService.updateModuleConfig(SYSTEM_MODULE_NAME, {
    onboardingCompleted: true,
  });
}
```

## 8. AI instructions

- Read this file entirely before making any code changes
- Start by replying with a short implementation plan (max 10 steps)
- After implementation, regenerate OpenAPI spec with `pnpm run generate:openapi`
- Add unit tests for OnboardingService
- Keep changes scoped to this task
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`
