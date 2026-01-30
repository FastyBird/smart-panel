# Task: Security domain backend skeleton
ID: FEATURE-SECURITY-DOMAIN-BACKEND
Type: feature
Scope: backend
Size: small
Parent: EPIC-EXPAND-SMART-PANEL-DOMAINS
Status: in-progress

## 1. Business goal

In order to have a central place for security state and alerts on the panel,
As a smart home user,
I want the backend to expose a security status endpoint that aggregates armed state, alarm state, and alert information.

## 2. Context

- This is a standalone domain module, not part of the spaces module.
- Designed as an extensible skeleton — providers and aggregators will be added later.
- Follows the same module pattern as `weather`, `devices`, etc.
- Related to but separate from `FEATURE-SPACE-SECURITY-DOMAIN` (which covers space-level intents).

## 3. Scope

**In scope**

- `SecurityModule` registered in `AppModule`
- `SecurityService` as the main entry point
- Extension contracts: `SecurityStateProviderInterface`, `SecurityAggregatorInterface`
- `SecurityStatusModel` with armed/alarm state, severity, alerts count, last event
- Read-only endpoint: `GET /api/v1/modules/security/status`
- Static/default values until providers are implemented
- Smoke tests

**Out of scope**

- Alarm device mapping
- Sensors aggregation
- Alert lifecycle logic
- UI / overlay behavior
- Persistence or history
- Integration plugins (Home Assistant, Matter, etc.)

## 4. Acceptance criteria

- [x] Application boots with the new security domain enabled
- [x] `GET /api/v1/modules/security/status` responds with valid JSON
- [x] No dependency on specific integrations
- [x] Clear extension points (interfaces) for next tasks
- [x] Smoke tests pass: module compiles, controller exists, endpoint returns 200

## 5. Example scenarios

### Scenario: Default status with no providers

Given no security state providers are registered
When a client calls `GET /api/v1/modules/security/status`
Then the response contains armedState=null, alarmState=null, highestSeverity="info", activeAlertsCount=0, hasCriticalAlert=false

## 6. Technical constraints

- Follow the existing module structure (`weather` module as reference)
- Use `BaseSuccessResponseModel` for response wrapping
- Do not modify generated code
- Tests are expected

## 7. Implementation hints

- Constants: `SECURITY_MODULE_PREFIX`, `SECURITY_MODULE_NAME`, etc.
- Controller at `@Controller('status')` under the `security` module prefix
- Service returns default `SecurityStatusModel` for now
- Interfaces define `getArmedState()`, `getAlarmState()`, `getAlerts()`, `aggregate()`

## 8. AI instructions

- Read this file entirely before making any code changes.
- Keep changes scoped to backend only.
- Follow the weather module pattern for structure.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
