# Task: Implement Sensor Device Detail Page in Panel App
ID: FEATURE-PANEL-SENSOR-DEVICE-PAGE
Type: feature
Scope: panel
Size: large
Parent: (none)
Status: planned
Created: 2025-12-18

## 1. Business goal

In order to view real-time and historical sensor data with rich visualizations
As a Smart Panel user
I want a comprehensive sensor device detail page that dynamically displays all available sensor readings and provides historical data charts.

## 2. Context

- The sensor device is defined in `spec/devices/devices.json` (lines 1018-1185) with 1 required channel (device_information) and 19 optional channels covering environmental, air quality, detection, and electrical monitoring.
- The `SensorDeviceView` class exists at `apps/panel/lib/modules/devices/views/devices/sensor.dart` with all necessary mixins for accessing channel data.
- The placeholder page at `apps/panel/lib/features/dashboard/presentation/devices/sensor.dart` shows a "Device Detail is Preparing" warning message that needs replacement.
- Backend timeseries API is fully implemented (FEATURE-PROPERTY-TIMESERIES is DONE):
  - Endpoint: `GET /channels/:channelId/properties/:id/timeseries`
  - Supports time ranges (`from`/`to`) and downsampling buckets (`1m`, `5m`, `15m`, `1h`)
  - Returns `PropertyTimeseriesModel` with array of `TimeseriesPointModel`
- Reference implementations:
  - `apps/panel/lib/features/dashboard/presentation/devices/thermostat.dart` - Complex device page with multiple channels
  - `apps/panel/lib/features/dashboard/presentation/devices/heater.dart` - Medium complexity device page
- No charting library currently exists in the panel app; one must be added.

## 3. Scope

**In scope**

- Replace the placeholder sensor device detail page with a fully functional implementation
- Dynamically display available sensor channels based on device configuration
- Group sensors logically by category (environmental, air quality, detection, electrical, device info)
- Show current values with appropriate icons, units, and formatting
- Integrate a Flutter charting library for historical data visualization
- Implement time range selection for historical data (1h, 6h, 12h, 24h, 7d)
- Add API client methods for fetching property timeseries data
- Handle loading, error, and empty states gracefully
- Support both light and dark themes
- Responsive layout for different screen sizes
- Add localization strings for sensor labels and units

**Out of scope**

- Backend API changes (timeseries API is already complete)
- Admin app implementation
- Modifications to device specification or channel views
- Real-time chart updates via WebSocket (use periodic refresh instead)
- Complex aggregation or statistics beyond what the API provides
- Data export functionality

## 4. Acceptance criteria

- [ ] Sensor device detail page displays all available channels from the device
- [ ] Channels are grouped into logical sections:
  - [ ] Environmental (temperature, humidity, pressure, illuminance)
  - [ ] Air Quality (CO2, CO, O3, NO2, SO2, VOC, PM2.5/PM10)
  - [ ] Detection (motion, occupancy, contact, leak, smoke)
  - [ ] Electrical (power, energy)
  - [ ] Device Info (battery, device information)
- [ ] Each sensor displays:
  - [ ] Appropriate icon (using Material Design Icons)
  - [ ] Current value with unit
  - [ ] Min/max range indicators where applicable
  - [ ] Fault/tamper status indicators where applicable
- [ ] A charting library is integrated (recommend `fl_chart`)
- [ ] Historical data chart is available for numeric sensors:
  - [ ] Temperature, humidity, pressure, illuminance
  - [ ] CO2, CO, O3, NO2, SO2, VOC, PM levels
  - [ ] Power consumption, energy usage
- [ ] Time range selector allows switching between: 1h, 6h, 12h, 24h, 7d
- [ ] Chart automatically selects appropriate downsampling bucket based on time range
- [ ] API client includes method to fetch property timeseries
- [ ] Loading indicator shown while fetching historical data
- [ ] Error message displayed if timeseries fetch fails
- [ ] Empty state shown when no historical data available
- [ ] Page works correctly in both light and dark themes
- [ ] All user-facing text is localized
- [ ] Widget tests cover key components

## 5. Example scenarios

### Scenario: Temperature sensor with history

Given a sensor device with temperature channel
When user opens the sensor device detail page
Then they see current temperature value with icon and unit
And they can tap to view historical temperature chart
And the chart shows last 24 hours of data by default

### Scenario: Multi-sensor device

Given a sensor device with temperature, humidity, and motion channels
When user opens the sensor device detail page
Then they see temperature and humidity in Environmental section
And they see motion in Detection section
And each sensor shows its current value
And numeric sensors (temp, humidity) offer chart view

### Scenario: Battery-powered sensor

Given a sensor device with battery channel
When user opens the sensor device detail page
Then they see battery percentage in Device Info section
And they see low battery warning if applicable
And they see charging indicator if applicable

### Scenario: Air quality sensor

Given a sensor device with CO2 and VOC channels
When user opens the sensor device detail page
Then they see both readings in Air Quality section
And they can view historical trends for both
And the chart shows concentration over time

### Scenario: No historical data

Given a newly added sensor device
When user views historical chart
Then they see empty state message
And the message explains no data is available yet

## 6. Technical constraints

- Follow existing panel architecture patterns from `apps/panel/lib/features/dashboard/`
- Use package imports only (`package:fastybird_smart_panel/...`)
- File naming: `snake_case.dart`
- Do not modify generated code in `lib/api/` or `lib/spec/`
- Use existing services (ScreenService, VisualDensityService, DevicesService)
- Use existing theme utilities from `core/utils/theme.dart`
- Use existing widgets (AppTopBar, AppSpacings, AppBottomNavigationBar)
- Use localization via `AppLocalizations.of(context)`
- Charting library should be lightweight and well-maintained (recommend `fl_chart`)
- Tests expected for new widget logic

## 7. Implementation hints

### Phase 1: Foundation (API & Dependencies)

1. Add `fl_chart` dependency to `pubspec.yaml`
2. Create API client method for property timeseries:
   - Location: `apps/panel/lib/modules/devices/`
   - Use existing Retrofit patterns
   - Handle pagination and error cases

### Phase 2: Core Widgets

3. Create reusable sensor card widget:
   - Location: `apps/panel/lib/features/dashboard/presentation/widgets/sensors/`
   - Display icon, label, value, unit
   - Support tap interaction for chart view

4. Create sensor section widget:
   - Groups sensors by category
   - Shows section header with icon
   - Uses grid layout for sensor cards

5. Create timeseries chart widget:
   - Uses `fl_chart` LineChart
   - Configurable time range
   - Auto-scales Y axis
   - Theme-aware colors

### Phase 3: Main Page

6. Implement `SensorDeviceDetailPage`:
   - StatefulWidget with state management
   - Detect available channels from device view
   - Build sections dynamically
   - Handle chart modal/sheet for sensor details

7. Create sensor detail bottom sheet/dialog:
   - Shows larger current value
   - Time range selector
   - Historical chart
   - Min/max/avg statistics if available

### Phase 4: Polish

8. Add localization strings:
   - Sensor type labels
   - Section headers
   - Time range labels
   - Error messages

9. Implement widget tests:
   - Sensor card rendering
   - Section grouping logic
   - Chart time range selection

### Reference patterns

- Channel access: Use `device.hasTemperature`, `device.temperature`, etc. from mixins
- Value formatting: Use `ValueUtils.formatValue()` from `features/dashboard/utils/value.dart`
- Property access: See `ChannelPropertyView` in `modules/devices/views/properties/view.dart`
- Theme colors: Use `AppColorsLight`/`AppColorsDark`, `AppTextColorLight`/`AppTextColorDark`
- Spacing: Use `AppSpacings.paddingMd`, `AppSpacings.spacingSmVertical`, etc.
- Icons: Use `MdiIcons` from `material_design_icons_flutter`

### Sensor icons mapping

```dart
// Environmental
temperature: MdiIcons.thermometer
humidity: MdiIcons.waterPercent
pressure: MdiIcons.gauge
illuminance: MdiIcons.brightness6

// Air Quality
carbonDioxide: MdiIcons.moleculeCo2
carbonMonoxide: MdiIcons.molecule
ozone: MdiIcons.weatherWindy
nitrogenDioxide: MdiIcons.cloudAlert
sulphurDioxide: MdiIcons.cloudAlert
volatileOrganicCompounds: MdiIcons.airFilter
airParticulate: MdiIcons.blur

// Detection
motion: MdiIcons.motionSensor
occupancy: MdiIcons.accountEye
contact: MdiIcons.doorOpen / MdiIcons.doorClosed
leak: MdiIcons.waterAlert
smoke: MdiIcons.smokeDetector

// Electrical
electricalPower: MdiIcons.flash
electricalEnergy: MdiIcons.lightningBolt

// Device
battery: MdiIcons.battery / MdiIcons.batteryLow / MdiIcons.batteryCharging
deviceInformation: MdiIcons.informationOutline
```

### Time range to bucket mapping

```dart
// Recommended mapping for optimal chart rendering
1h  -> raw (no downsampling)
6h  -> 1m bucket
12h -> 5m bucket
24h -> 5m bucket
7d  -> 1h bucket
```

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.
- Test the implementation with various sensor configurations (single sensor, multi-sensor, battery-powered, air quality, etc.).
- Commit changes in logical increments with descriptive messages.
- Do not modify backend, admin, or generated code.
