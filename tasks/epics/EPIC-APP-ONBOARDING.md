# Epic: App Onboarding Wizard
ID: EPIC-APP-ONBOARDING
Type: epic
Scope: backend, admin
Size: large
Parent: (none)
Status: planned

## 1. Business goal

In order to provide a seamless first-time setup experience similar to HomeAssistant or Homebridge,
As a new user installing Smart Panel,
I want a guided onboarding wizard that helps me create my account, configure the system, and set up my smart home.

## 2. Context

Currently, the application requires manual CLI commands to create the first user (`pnpm run onboard` or `auth:onboarding`). There is no guided setup process, which creates friction for new users.

**Existing references:**
- HomeAssistant onboarding flow: welcome → account creation → location → integrations → done
- Homebridge setup wizard: similar step-by-step approach
- Existing `TECH-SPACES-ONBOARDING-WIZARD` for spaces/devices assignment (can be integrated as a later step)

**Existing code to leverage:**
- `apps/admin/src/modules/auth/` - Authentication module with sign-up form
- `apps/admin/src/modules/spaces/views/view-spaces-onboarding.vue` - Spaces onboarding wizard (pattern reference)
- `apps/backend/src/modules/auth/` - Registration endpoint (`POST /auth/register`)
- `apps/backend/src/modules/users/services/users.service.ts` - `findOwner()` method
- `apps/backend/src/modules/weather/` - Weather/location configuration

## 3. Scope

**In scope**

- Backend endpoint to check onboarding status (`GET /system/onboarding`)
- Admin onboarding module with multi-step wizard
- Welcome/introduction step
- Owner account creation step (username, password, email, name)
- Location configuration step (for weather integration)
- Integrations discovery step (show available plugins, allow enabling)
- Completion step with summary and next actions
- Router guards to redirect unauthenticated users to onboarding when no owner exists
- Persist onboarding completion status
- Skip option for experienced users

**Out of scope**

- Panel app onboarding (future consideration)
- Device discovery during onboarding (handled by existing spaces onboarding wizard)
- Dashboard auto-generation (handled by existing dashboard features)
- Multi-user onboarding (only owner account in initial setup)

## 4. Acceptance criteria

- [ ] Fresh installation shows onboarding wizard instead of login page
- [ ] User can create owner account through wizard
- [ ] User can configure location for weather
- [ ] User can see and enable available integrations
- [ ] Onboarding can be skipped with minimal setup (just account creation)
- [ ] After onboarding, user is automatically logged in
- [ ] Subsequent visits show normal login page (not onboarding)
- [ ] Backend provides public endpoint to check onboarding status
- [ ] Admin app properly detects and routes to onboarding

## 5. Example scenarios

### Scenario: Fresh installation onboarding

Given a fresh Smart Panel installation with no users
When I navigate to the admin interface
Then I see the onboarding wizard welcome screen
And the login page is not accessible until onboarding is complete

### Scenario: Complete basic onboarding

Given I am on the onboarding wizard
When I complete the account creation step with valid credentials
And I skip optional steps (location, integrations)
And I click "Finish"
Then my owner account is created
And I am automatically logged in
And I am redirected to the main dashboard

### Scenario: Full onboarding with all steps

Given I am on the onboarding wizard
When I create my owner account
And I configure my location (city/coordinates)
And I enable Home Assistant integration
And I click "Finish"
Then all configurations are saved
And I can see weather for my location
And Home Assistant integration is ready to configure

### Scenario: Return visit after onboarding

Given I have completed the onboarding wizard previously
When I navigate to the admin interface while logged out
Then I see the normal login page
And the onboarding wizard is not shown

## 6. Technical constraints

- Follow existing module/service patterns in admin and backend
- Reuse existing sign-up form components where possible
- Use existing multi-step wizard patterns from spaces onboarding
- Do not modify generated OpenAPI code
- Backend changes require OpenAPI regeneration after completion
- Tests required for new backend endpoints and frontend composables

## 7. Implementation hints

**Backend:**
- Add `GET /system/onboarding` public endpoint returning:
  - `hasOwner: boolean` - whether owner account exists
  - `onboardingCompleted: boolean` - stored in system config
  - `devicesCount`, `spacesCount`, `displaysCount` - for skip decision
- Store `onboardingCompleted` flag in system module config
- Leverage existing `UsersService.findOwner()` method

**Admin Frontend:**
- Create new `onboarding` module under `apps/admin/src/modules/`
- Use `el-steps` component for wizard progress (like spaces onboarding)
- Create composable `useAppOnboarding()` for state management
- Add special router guard that checks onboarding status before authenticated guard
- Steps should be:
  1. Welcome - introduction and language selection
  2. Account - create owner (reuse sign-up-form with modifications)
  3. Location - configure weather location (optional, skippable)
  4. Integrations - list available plugins, toggle enable (optional)
  5. Complete - summary and "Get Started" button

**Router Flow:**
```
[User visits /]
  → [Check /system/onboarding]
  → [If !hasOwner] → Redirect to /onboarding
  → [If hasOwner && !authenticated] → Redirect to /sign/in
  → [If authenticated] → Show dashboard
```

## 8. Child tasks

| ID | Title | Scope | Size |
|----|-------|-------|------|
| FEATURE-ONBOARDING-BACKEND | Onboarding status backend API | backend | small |
| FEATURE-ONBOARDING-WIZARD | Onboarding wizard UI | admin | medium |
| FEATURE-ONBOARDING-INTEGRATIONS | Integrations discovery step | backend, admin | medium |
| TECH-ONBOARDING-ROUTER-GUARDS | Router guards for onboarding flow | admin | small |

## 9. AI instructions

- Read this file and all child task files before implementation
- Implement child tasks in order: BACKEND → ROUTER-GUARDS → WIZARD → INTEGRATIONS
- Start each task by replying with implementation plan
- Follow patterns from existing spaces onboarding wizard
- Regenerate OpenAPI spec after backend changes
- Keep changes scoped to onboarding - do not refactor unrelated code
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`
