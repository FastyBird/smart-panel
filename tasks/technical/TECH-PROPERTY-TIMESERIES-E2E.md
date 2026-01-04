# Task: E2E Test for Property Timeseries Endpoint
ID: TECH-PROPERTY-TIMESERIES-E2E
Type: technical
Scope: backend
Size: tiny
Parent: FEATURE-PROPERTY-TIMESERIES
Status: planned

## 1. Business goal

In order to ensure the timeseries endpoint works correctly end-to-end
As a developer
I want an E2E test covering the property timeseries API

## 2. Context

- Property timeseries endpoint was implemented in FEATURE-PROPERTY-TIMESERIES
- Unit tests exist but E2E test was marked as optional and deferred

## 3. Scope

**In scope**

- E2E test for GET /channels/:channelId/properties/:id/timeseries endpoint
- Test with different time ranges and bucket sizes

**Out of scope**

- Additional unit tests
- Panel integration tests

## 4. Acceptance criteria

- [ ] E2E test verifies endpoint returns correct response format
- [ ] Test covers time range filtering (from/to parameters)
- [ ] Test covers bucket size downsampling
- [ ] Test handles empty data gracefully

## 5. Technical constraints

- Follow existing E2E test patterns
- Use existing test fixtures

## 6. AI instructions

- Read this file entirely before making any code changes.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
