# Task: Property timeseries endpoint for sensor values
ID: FEATURE-PROPERTY-TIMESERIES
Type: feature
Scope: backend
Size: medium
Parent: (none)
Status: done
Created: 2025-11-13

## 1. Business goal

In order to visualize historical sensor data (e.g. temperature, humidity, etc.)
As a Smart Panel user
I want the backend to expose a timeseries endpoint for property values so the panel (and admin) can request data for a specific time range and render charts.

## 2. Context

- Property values are already stored in a time-series database (InfluxDB) for historical tracking.
- Currently, the backend exposes only “latest value” semantics for properties.
- The Flutter panel and the admin app will later use this endpoint to show charts.
- This task focuses only on backend API + service layer.

## 3. Scope

**In scope**
- Extend the OpenAPI specification.
- Add a new backend endpoint for property timeseries.
- Implement a service that queries InfluxDB for a given property and time range.

**Out of scope**
- Admin or panel UI.
- Changes to how data is written to InfluxDB.
- Complex aggregation beyond basic bucket downsampling.

## 4. Acceptance criteria

- [x] OpenAPI spec contains a new timeseries endpoint under the correct module.
- [x] Endpoint supports:
  - [x] property identification
  - [x] time range (`from`/`to` ISO datetimes OR relative range like `12h`)
  - [x] optional downsampling bucket (`5m`, `1h`, etc.)
- [x] Output format:
```json
{
  "property": "<id>",
  // Compatibility note: if older clients expect `propertyId`, consider providing both fields for one release cycle.
  "from": "2025-01-01T10:00:00Z",
  "to": "2025-01-01T22:00:00Z",
  "bucket": "5m",
  "points": [
    { "time": "2025-01-01T10:00:00Z", "value": 21.4 },
    { "time": "2025-01-01T10:05:00Z", "value": 21.6 }
  ]
}
```
- [x] Endpoint returns HTTP 200 with `"points": []` when no data exists.
- [x] Input validation for invalid ranges.
- [x] Unit tests for service + controller.
- [ ] Optionally 1 E2E test.

## 5. Example scenarios

### Scenario: Fetch last 12 hours of values
Given historical values exist  
When I request last 12h  
Then I receive ordered timestamp/value pairs.

### Scenario: No data
When I request 24h  
And no values exist  
Then I get `"points": []`.

### Scenario: Invalid range
If `from > to`  
Then return HTTP 400.

## 6. Technical constraints

- Reuse existing InfluxDB integration.
- If needed create a dedicated service (e.g. PropertyTimeseriesService).
- Keep controller thin.
- Do not touch generated code.
- Follow NestJS conventions and validation.

## 7. Implementation hints

- Reuse time normalization utilities if available.
- Start with a simple optional bucket param.
- Use DTOs for query parameters.

## 8. AI instructions

- Read this file fully before coding.
- Respect global rules in `/.ai-rules/GUIDELINES.md`.
- Start by responding with a 5–10 step implementation plan.
- Implement in small steps, beginning with service + tests.
- Do not modify admin or panel code.
- For each acceptance criterion either implement or mark TODO.
