# Task: Security domain — provider registry + aggregation contract
ID: FEATURE-SECURITY-PROVIDER-REGISTRY
Type: technical
Scope: backend
Size: small
Parent: (none)
Status: done

## 1. Business goal
In order to allow multiple sources (alarm devices, sensors, connectivity) to contribute security signals
As a system architect
I want a provider-based aggregation architecture in the Security domain

## 2. Context
The Security module skeleton already exists with a `GET /api/v1/modules/security/status` endpoint
that returns hardcoded default values. This task introduces the provider registry and aggregation
pipeline so future integrations can plug in without refactoring the core module.

## 3. Scope
**In scope**
- Define provider contract (`SecurityStateProviderInterface`) and aggregator contract (`SecurityAggregatorInterface`)
- Define `SecuritySignal` type for partial security state contributions
- Implement `SecurityAggregatorService` using NestJS multi-provider DI pattern
- Add `DefaultSecurityProvider` (dummy) to validate wiring
- Wire aggregator into `SecurityDomainService.getStatus()`
- Unit tests for aggregation logic

**Out of scope**
- Real alarm/sensor integrations
- Alert lifecycle logic
- Persistence/history

## 4. Acceptance criteria
- [x] `/api/security/status` still works and returns deterministic data
- [x] Aggregator uses providers (validated in tests)
- [x] Adding new provider later requires no refactor (just register DI token)
- [x] No real integrations yet
- [x] Merging rules: armedState/alarmState first non-null wins, highestSeverity max, activeAlertsCount sum, hasCriticalAlert any-true-or-critical, lastEvent newest timestamp
- [x] Unit tests cover: providers called, severity max, alerts sum, lastEvent newest selection

## 5. Example scenarios

## 6. Technical constraints
- Use NestJS multi-provider pattern (injection token with `useClass` or `useExisting`)
- Providers must be safe to call (never throw)
- Follow existing project code style (tabs, single quotes, semicolons)

## 7. Implementation hints
- DI token: `SECURITY_STATE_PROVIDERS`
- `@Inject(SECURITY_STATE_PROVIDERS) private readonly providers: SecurityStateProviderInterface[]`

## 8. AI instructions
- Follow existing folder structure under `apps/backend/src/modules/security/`
- Reuse existing enums from `security.constants.ts`
- Keep `SecurityStatusModel` as-is for API response; aggregator populates it
