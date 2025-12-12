# Home Assistant Device Adoption Feature

This feature allows users to adopt Home Assistant devices into the Smart Panel system with automatic entity mapping.

## Features

- **Multi-step Device Adoption Wizard**: Guided process for adopting HA devices
- **Automatic Entity Mapping**: Intelligent mapping of HA entities to Smart Panel channels/properties
- **Mapping Preview**: Preview mappings before adoption
- **Mapping Customization**: Override channel categories and skip entities
- **Comprehensive Mapping Rules**: 50+ entity type mappings supported

## Usage

### Device Adoption Flow

1. **Device Selection**: Select a Home Assistant discovered device
2. **Mapping Preview**: Review automatic mapping suggestions
3. **Mapping Customization** (Optional): Customize entity mappings
4. **Device Configuration**: Set device name, category, description
5. **Adoption**: Create the device with confirmed mappings

### Components

#### Main Form
- `home-assistant-device-add-form.vue` - Main multi-step form component

#### Step Components
- `steps/device-selection-step.vue` - Device selection step
- `steps/mapping-preview-step.vue` - Mapping preview display
- `steps/mapping-customization-step.vue` - Entity mapping customization
- `steps/device-configuration-step.vue` - Final device configuration

#### Mapping Preview Components
- `mapping-preview/entity-mapping-card.vue` - Individual entity mapping card
- `mapping-preview/mapping-summary.vue` - Mapping summary statistics
- `mapping-preview/mapping-warnings.vue` - Warnings display

### Composables

- `useMappingPreview` - Fetch and update mapping previews
- `useDeviceAdoption` - Adopt devices with mapping configuration
- `useDeviceAddForm` - Multi-step form management

### API Endpoints

- `POST /plugins/devices-home-assistant/discovered-devices/:id/preview-mapping` - Get mapping preview
- `POST /plugins/devices-home-assistant/discovered-devices/adopt` - Adopt device

## Implementation Notes

- The form uses a collapse-based step navigation (similar to Shelly NG plugin)
- Mapping preview is automatically fetched when a device is selected
- Entity overrides can be applied to customize mappings
- Device name and category are auto-populated from preview suggestions
- After adoption, user is redirected to the device edit page

## Future Enhancements

- Bulk device adoption
- Mapping templates
- Advanced property mapping customization
- Mapping validation before adoption
