# Task: Device Validation Constraints
ID: FEATURE-DEVICE-VALIDATION-CONSTRAINTS
Type: feature
Scope: backend, admin, panel
Size: medium
Parent: (none)
Status: done

## 1. Business goal

In order to ensure devices are properly configured according to their specifications
As a plugin developer or system administrator
I want to have constraint validation that enforces property and channel relationships

## 2. Context

- The existing `DeviceValidationService` validates devices against their JSON specifications
- Some channels have properties that are mutually exclusive (e.g., RGB vs HSV color properties in lights)
- Some channels require at least one property from a group (e.g., ozone sensor needs detected, density, or level)
- Some devices have similar constraints on channels (e.g., switcher can have outlets OR switches, not both)
- Reference: `spec/devices/channels.json`, `spec/devices/devices.json`

## 3. Scope

**In scope**

- Add constraint definitions to JSON schema files
- Implement property constraints for channels (oneOf, oneOrMoreOf, mutuallyExclusiveGroups)
- Implement channel constraints for devices (same constraint types)
- Update backend validation service to check constraints
- Update Dart generators for Flutter app constraint classes
- Update admin app to display constraint violation messages
- Add documentation for the constraint system

**Out of scope**

- Runtime constraint enforcement (blocking device creation)
- UI for editing constraints
- Custom user-defined constraints

## 4. Acceptance criteria

- [x] JSON schema updated to support constraint definitions for channels
- [x] JSON schema updated to support constraint definitions for devices
- [x] `channels.json` has constraints for ozone, light, air_particulate, carbon_dioxide, carbon_monoxide, nitrogen_dioxide, volatile_organic_compounds
- [x] `devices.json` has constraints for switcher device (outlet vs switcher channels)
- [x] `DeviceValidationService` validates property constraints (oneOf, oneOrMoreOf, mutuallyExclusiveGroups)
- [x] `DeviceValidationService` validates channel constraints for devices
- [x] New validation issue types added: `constraint_one_of_violation`, `constraint_one_or_more_of_violation`, `constraint_mutually_exclusive_violation`
- [x] Dart generator (`build_channel_spec.dart`) outputs constraint classes
- [x] Dart generator (`build_device_spec.dart`) outputs constraint classes
- [x] Admin app displays constraint violation messages with translations
- [x] Documentation added to `apps/backend/docs/device-validation.md`
- [x] Pre-save validation (`validateDeviceStructure`) checks constraints
- [x] Post-save validation (`validateDevice`) checks constraints

## 5. Example scenarios

### Scenario: Light channel with RGB and HSV properties fails validation

Given a light channel with properties: color_red, color_green, color_blue, hue, saturation
When the device is validated
Then a `constraint_mutually_exclusive_violation` error is reported
And the message indicates RGB and HSV properties cannot be mixed

### Scenario: Ozone channel without any measurement property fails validation

Given an ozone channel with no detected, density, or level properties
When the device is validated
Then a `constraint_one_or_more_of_violation` error is reported
And the message indicates at least one measurement property is required

### Scenario: Switcher device with both outlet and switcher channels fails validation

Given a switcher device with outlet and switcher channels
When the device is validated
Then a `constraint_mutually_exclusive_violation` error is reported
And the message indicates outlet and switcher channels cannot be mixed

### Scenario: Switcher device with multiple outlets passes validation

Given a switcher device with 3 outlet channels and device_information channel
When the device is validated
Then no constraint violations are reported
And the device is marked as valid

## 6. Technical constraints

- Follow the existing validation service patterns
- Constraints are defined in JSON spec files, not hardcoded
- Dart and TypeScript generators must parse constraints from JSON
- OpenAPI spec must include new enum values for constraint violations
- Admin app regenerates OpenAPI types locally (gitignored)

## 7. Implementation hints

- Look at `getChannelConstraints()` and `getDeviceConstraints()` in `schema.utils.ts`
- Reuse the same constraint structure for both property and channel constraints
- The `mutuallyExclusiveGroups` constraint is an array of group pairs, not individual items

## 8. AI instructions

- Read this file entirely before making any code changes.
- Start by replying with a short implementation plan (max 10 steps).
- Keep changes scoped to this task and its `Scope`.
- For each acceptance criterion, either implement it or explain why it's skipped.
- Respect global AI rules from `/.ai-rules/GUIDELINES.md`.

## 9. Implementation notes

### Files modified

**Spec files:**
- `spec/devices/channels.schema.json` - Added constraint definitions
- `spec/devices/channels.json` - Added constraints to 7 channels
- `spec/devices/devices.schema.json` - Added constraint definitions
- `spec/devices/devices.json` - Added constraints to switcher device

**Backend:**
- `apps/backend/src/modules/devices/utils/schema.utils.ts` - Added `ChannelConstraints`, `DeviceConstraints` interfaces and getter functions
- `apps/backend/src/modules/devices/services/device-validation.service.ts` - Added constraint validation logic
- `apps/backend/src/modules/devices/models/device-validation.model.ts` - Added new `ValidationIssueType` enum values

**Panel (Dart):**
- `apps/panel/tools/build_channel_spec.dart` - Generates `PropertyConstraintType`, `PropertyConstraint` classes
- `apps/panel/tools/build_device_spec.dart` - Generates `ChannelConstraintType`, `ChannelConstraint` classes

**Admin:**
- `apps/admin/src/modules/devices/locales/en-US.json` - Added translations for constraint violation types

**Documentation:**
- `apps/backend/docs/device-validation.md` - Comprehensive documentation

### Constraint types

| Type | Description |
|------|-------------|
| `oneOf` | Only one item from the group can be present (mutually exclusive within group) |
| `oneOrMoreOf` | At least one item from the group must be present |
| `mutuallyExclusiveGroups` | Items from different groups cannot be mixed (e.g., RGB vs HSV) |
