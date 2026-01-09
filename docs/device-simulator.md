# Device Simulator Plugin

The Device Simulator plugin allows developers to create virtual devices for testing purposes without requiring physical hardware. This is essential for UI testing, feature development, and QA testing.

## Features

- **Generate Devices** - Create simulated devices of any category with proper channels and properties
- **Simulate Values** - Manually set or auto-generate random values for properties
- **Connection Testing** - Simulate connection state changes (online/offline/lost/alert)
- **CLI Tool** - Interactive and non-interactive command-line interface

## Use Cases

| Use Case | Description |
|----------|-------------|
| **UI Testing** | Test how the UI handles different device types and states |
| **Development** | Develop and test features without physical devices |
| **Demo Mode** | Create demo environments with simulated devices |
| **QA Testing** | Test edge cases, error handling, and state transitions |
| **Integration Testing** | Test device interactions and automations |

## CLI Commands

### List Available Device Categories

```bash
pnpm run cli simulator:generate --list
```

Shows all 26 device categories with their channel counts and descriptions.

### Generate Devices (Interactive Mode)

```bash
pnpm run cli simulator:generate
```

Interactive mode prompts you to:
1. Select a device category from a list
2. Enter a name (or leave empty for auto-generated)
3. Specify how many devices to create

### Generate Devices (Non-Interactive Mode)

```bash
# Generate a single light device
pnpm run cli simulator:generate --category lighting --name "Test Light"

# Generate 5 thermostats
pnpm run cli simulator:generate --category thermostat --count 5

# Generate minimal sensor (required channels/properties only)
pnpm run cli simulator:generate -c sensor --required-only

# Generate with auto-simulation enabled (updates every 3 seconds)
pnpm run cli simulator:generate -c lighting --auto-simulate --interval 3000
```

### CLI Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--category` | `-c` | Device category (lighting, thermostat, sensor, etc.) | - |
| `--name` | `-n` | Custom name for the device | Auto-generated |
| `--count` | - | Number of devices to generate | 1 |
| `--required-only` | - | Only include required channels/properties | false |
| `--auto-simulate` | - | Store auto-simulate flag in device (not yet implemented) | false |
| `--interval` | - | Store simulation interval in device (not yet implemented) | 5000 |
| `--list` | `-l` | List all available device categories | - |

## REST API Endpoints

All endpoints are prefixed with `/api/v1/plugins/devices-simulator/simulator`

### List Available Categories

```http
GET /api/v1/plugins/devices-simulator/simulator/categories
```

Returns a list of all device categories with their descriptions.

**Response:**
```json
{
  "data": [
    {
      "category": "lighting",
      "name": "Lighting",
      "description": "Lighting devices like bulbs, LED strips, etc."
    },
    ...
  ]
}
```

### Generate a Simulated Device

```http
POST /api/v1/plugins/devices-simulator/simulator/generate
```

**Request Body:**
```json
{
  "data": {
    "category": "lighting",
    "name": "Living Room Light",
    "description": "A simulated light for testing",
    "room_id": "uuid-of-room",
    "required_channels_only": false,
    "required_properties_only": false,
    "auto_simulate": false,
    "simulate_interval": 5000
  }
}
```

**Response:** Returns the created device with all channels and properties.

### Simulate Property Value Change

```http
POST /api/v1/plugins/devices-simulator/simulator/{deviceId}/simulate-value
```

**Request Body:**
```json
{
  "data": {
    "property_id": "uuid-of-property",
    "value": true
  }
}
```

If `value` is omitted, a random value based on the property type will be generated.

### Simulate Connection State

```http
POST /api/v1/plugins/devices-simulator/simulator/{deviceId}/simulate-connection
```

**Request Body:**
```json
{
  "data": {
    "state": "disconnected"
  }
}
```

**Valid states:** `connected`, `disconnected`, `lost`, `alert`, `unknown`

### Simulate All Property Values

```http
POST /api/v1/plugins/devices-simulator/simulator/{deviceId}/simulate-all
```

Generates and sets random values for all properties of the device based on their data types and constraints.

## Supported Device Categories

The simulator supports all 26 standard device categories:

| Category | Description |
|----------|-------------|
| `generic` | Generic device |
| `air_conditioner` | Air conditioning units |
| `air_dehumidifier` | Dehumidifier devices |
| `air_humidifier` | Humidifier devices |
| `air_purifier` | Air purification devices |
| `alarm` | Alarm/security systems |
| `camera` | Security cameras |
| `door` | Door sensors and controls |
| `doorbell` | Smart doorbells |
| `fan` | Fan devices |
| `heater` | Heating devices |
| `lighting` | Light bulbs, strips, fixtures |
| `lock` | Smart locks |
| `media` | Media players |
| `outlet` | Smart outlets/plugs |
| `pump` | Pump devices |
| `robot_vacuum` | Robot vacuum cleaners |
| `sensor` | Various sensors |
| `speaker` | Smart speakers |
| `sprinkler` | Irrigation/sprinkler systems |
| `switcher` | Switch devices |
| `television` | Smart TVs |
| `thermostat` | Thermostat devices |
| `valve` | Valve controls |
| `window_covering` | Blinds, curtains, shades |

## Device Structure

Each generated device includes:

1. **Device Entity** - The main device with category, name, and metadata
2. **Channels** - Functional units based on device specification (e.g., light channel, temperature channel)
3. **Properties** - Measurable/controllable attributes per channel with:
   - Data type (bool, int, float, string, enum)
   - Permissions (read-only, read-write, write-only)
   - Constraints (min/max values, allowed enum values)
   - Units (%, °C, etc.)

## Examples

### Testing a Thermostat UI

```bash
# Generate a thermostat
pnpm run cli simulator:generate -c thermostat -n "Office Thermostat"

# The device will have channels for:
# - Temperature sensing
# - Heating/cooling control
# - Fan control
# - Device information
```

### Testing Connection Loss Handling

```bash
# Generate a device
pnpm run cli simulator:generate -c lighting -n "Test Light"

# Use the API to simulate disconnection
curl -X POST http://localhost:3000/api/v1/plugins/devices-simulator/simulator/{deviceId}/simulate-connection \
  -H "Content-Type: application/json" \
  -d '{"data": {"state": "disconnected"}}'
```

### Testing Real-time Value Updates

```bash
# Generate a sensor and manually trigger value updates
pnpm run cli simulator:generate -c sensor -n "Test Sensor"

# Use the API to simulate value changes
curl -X POST http://localhost:3000/api/v1/plugins/devices-simulator/simulator/{deviceId}/simulate-all
```

> **Note:** The `--auto-simulate` and `--interval` options store configuration in the device entity but automatic value simulation is not yet implemented. Use the `/simulate-all` endpoint to manually trigger value updates.

## Technical Details

### Plugin Location

```
apps/backend/src/plugins/devices-simulator/
├── commands/
│   └── generate-device.command.ts    # CLI command
├── controllers/
│   └── simulator.controller.ts       # REST API endpoints
├── dto/                              # Data transfer objects
├── entities/
│   └── devices-simulator.entity.ts   # Database entities
├── models/                           # Response models
├── platforms/
│   └── simulator-device.platform.ts  # Platform handler
├── services/
│   └── device-generator.service.ts   # Device generation logic
├── devices-simulator.constants.ts
├── devices-simulator.openapi.ts
└── devices-simulator.plugin.ts       # Plugin module
```

### Device Type

Simulated devices use the type `devices-simulator` which distinguishes them from real device integrations.

### Value Generation

Random values are generated based on property metadata:
- **Boolean**: Random true/false
- **Enum**: Random selection from allowed values
- **Numeric**: Random value within min/max range
- **String**: Context-appropriate values (e.g., firmware version, manufacturer)
