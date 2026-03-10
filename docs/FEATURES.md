# FastyBird Smart Panel - Complete Features & Capabilities

> A comprehensive reference of all features, functions, and capabilities of the FastyBird Smart Panel platform. This document serves as the source of truth for web presentation content.

---

## Table of Contents

- [Platform Overview](#platform-overview)
- [Architecture](#architecture)
- [Device Integrations](#device-integrations)
- [Supported Device Types](#supported-device-types)
- [Dashboard & Display System](#dashboard--display-system)
- [Space Management](#space-management)
- [Climate Control](#climate-control)
- [Media Control](#media-control)
- [Energy Monitoring](#energy-monitoring)
- [Scenes & Automation](#scenes--automation)
- [Buddy AI Assistant](#buddy-ai-assistant)
- [Weather Integration](#weather-integration)
- [Security & Access Control](#security--access-control)
- [System Administration](#system-administration)
- [Extension System](#extension-system)
- [Real-Time Communication](#real-time-communication)
- [API & Developer Tools](#api--developer-tools)
- [Panel Touch Interface](#panel-touch-interface)
- [Admin Web Interface](#admin-web-interface)
- [Technology Stack](#technology-stack)

---

## Platform Overview

FastyBird Smart Panel is an open-source smart home control platform designed for wall-mounted touch displays. It provides a unified interface for managing and controlling smart home devices from multiple ecosystems, all from a single, beautiful touch panel.

### Key Highlights

- **Wall-mounted touch control** - Purpose-built for embedded touch displays
- **Multi-ecosystem support** - Integrates Home Assistant, Shelly, Zigbee2MQTT, WLED, and more
- **Offline-first architecture** - Works without cloud dependency; local processing and control
- **AI-powered assistant** - Built-in Buddy AI with support for Claude, OpenAI, and local Ollama models
- **Modular & extensible** - Plugin-based architecture with an Extension SDK for custom integrations
- **Open source** - Apache 2.0 license, community-driven development

### Three-Application Ecosystem

| Application | Technology | Purpose |
|-------------|------------|---------|
| **Panel App** | Flutter/Dart | Touch-optimized embedded UI for wall-mounted displays |
| **Admin App** | Vue.js 3 | Web-based management interface for configuration and setup |
| **Backend** | NestJS | API server handling device communication, data processing, and business logic |

---

## Architecture

### Device Model: Three-Level Hierarchy

Smart Panel uses a universal device abstraction model:

```
Device → Channel → Property
```

- **Device** - A physical or virtual smart home device (e.g., a thermostat, a light bulb, a sensor)
- **Channel** - A functional capability of a device (e.g., temperature sensor, light control, power meter)
- **Property** - An individual data point or control within a channel (e.g., current temperature, brightness level, on/off state)

This hierarchy allows Smart Panel to represent any smart home device uniformly, regardless of the underlying protocol or manufacturer.

### Communication Patterns

- **RESTful API** - Full CRUD operations for all resources
- **WebSocket** - Real-time bidirectional state updates and event streaming
- **mDNS** - Automatic device discovery on the local network
- **MQTT** - Message broker integration for Zigbee2MQTT devices
- **HTTP/RPC** - Direct device communication (Shelly, WLED)

### Data Storage

- **SQLite** - Primary relational database for device configuration and metadata
- **InfluxDB** - Time-series database for energy metrics, climate history, and intent tracking

---

## Device Integrations

Smart Panel connects to multiple smart home ecosystems through dedicated integration plugins.

### Home Assistant

- **Protocol**: WebSocket and REST API
- **Coverage**: 39+ Home Assistant entity domains
- **Features**:
  - Automatic entity discovery and synchronization
  - Bidirectional real-time control
  - Support for all light color modes (brightness, color temperature, HS, XY, RGB, RGBW, RGBWW)
  - Entity attribute extraction and property mapping
  - Virtual property derivation from HA attributes
  - YAML-based configuration mappings

**Supported HA domains**: climate, cover, light, switch, lock, media_player, camera, sensor, humidifier, thermostat, valve, vacuum, water_heater, fan, binary_sensor, and 24+ more.

### Shelly (Generation 2+ / Next Generation)

- **Device support**: 40+ Shelly models across Plus, Pro, and Gen3/Gen4 product lines
- **Connectivity**: WiFi and Ethernet
- **Discovery**: mDNS-based automatic discovery
- **Protocol**: RPC via HTTP and WebSocket
- **Component types**:
  - Switch and relay control
  - Cover and shutter control (position, tilt)
  - Light and dimmer control
  - RGB, RGBW, and CCT lighting
  - Binary inputs
  - Temperature and humidity sensors
  - Power monitoring (PM1)

### Shelly (Generation 1 / Legacy)

- Support for first-generation Shelly devices
- HTTP-based communication
- Backward compatibility with older device firmware

### Zigbee2MQTT

- **Protocol**: MQTT broker-based device bridging
- **Coverage**: 3,000+ Zigbee devices via Zigbee2MQTT
- **Features**:
  - Configuration-driven mapping system
  - Transformer registry for property conversion
  - Virtual property support
  - YAML-based entity definitions
  - Automatic capability detection via "exposes" mapper
  - Device adoption with property scaling and mapping

### WLED

- **Purpose**: RGB/RGBW LED strip and controller management
- **Discovery**: mDNS-based automatic discovery
- **Control**: Brightness, color (RGB/RGBW), effects, segments
- **Protocol**: HTTP API with WebSocket support

### Third-Party Devices

- Generic extensible framework for custom device integrations
- API-based device registration and control
- Custom property type definitions

### Device Simulator

- **Purpose**: Development, testing, and demonstration without physical hardware
- **Simulated device categories**: 12+ sensor types, lighting, climate, control devices, environmental, specialty
- **Predefined scenarios**: Small apartment, penthouse, office, retail store
- **Behavioral simulation**:
  - Realistic sensor value patterns
  - Time-based simulation (sunrise/sunset, day/night cycles)
  - Location-aware calculations
  - Environmental correlation (e.g., temperature affects humidity)
  - Command response simulation

---

## Supported Device Types

Smart Panel supports 31 device categories and 45+ channel types with 120+ property types.

### Device Categories (31)

| Category | Description |
|----------|-------------|
| Air Conditioner | Cooling with temperature control |
| Air Dehumidifier | Humidity reduction |
| Air Humidifier | Humidity increase |
| Air Purifier | Air filtration and quality management |
| Alarm | Security alarm systems |
| AV Receiver | Audio/video receiver systems |
| Camera | Video monitoring and surveillance |
| Door | Smart door control and monitoring |
| Doorbell | Smart doorbells with video and audio |
| Fan | Ventilation and cooling fans |
| Game Console | Gaming device control |
| Heating Unit | Dedicated heating systems |
| Lighting | Lights, dimmers, LED strips, smart bulbs |
| Lock | Smart locks and access control |
| Media | Generic media devices |
| Outlet | Smart power outlets and plugs |
| Projector | Video projectors |
| Pump | Water and fluid circulation pumps |
| Robot Vacuum | Robotic vacuum cleaners |
| Sensor | Generic sensors (temperature, humidity, motion, etc.) |
| Set-Top Box | Cable/satellite receivers |
| Speaker | Smart speakers and audio systems |
| Sprinkler | Irrigation and sprinkler systems |
| Streaming Service | Streaming media devices |
| Switcher | Smart relay switches |
| Television | Smart TVs |
| Thermostat | Heating and cooling controllers |
| Valve | Smart valves (water, gas) |
| Water Heater | Water heating systems |
| Window Covering | Blinds, curtains, shutters, and shades |

### Channel Types (45+)

**Climate Control**: heater, cooler, thermostat, humidifier, dehumidifier

**Lighting**: light (with brightness, color temperature, RGB/RGBW, hue/saturation, effects)

**Environmental Sensors**: temperature, humidity, illuminance, pressure, flow

**Motion & Presence**: motion, occupancy, contact

**Air Quality**: air_quality, air_particulate, carbon_dioxide, carbon_monoxide, ozone, volatile_organic_compounds, nitrogen_dioxide, smoke, gas, leak

**Power & Energy**: electrical_power, electrical_energy, electrical_generation

**Control**: switcher, outlet, fan, valve, window_covering, door, lock, projector, robot_vacuum

**Media**: speaker, media_input, media_playback, television

**System**: device_information, battery, connection_type, alarm, doorbell, camera, microphone, filter

**Specialized**: remote_key, command

### Property Types (120+)

**Power & Energy**: power, consumption, production, in_use, average_power, current, voltage, frequency, rate, peak_level, balance

**Lighting**: on, brightness, color_red, color_green, color_blue, color_white, color_temperature, hue, saturation, effect, profile

**Climate**: temperature, humidity, mode, status, swing, defrost_active, child_lock

**Media**: volume, mute, repeat, shuffle, source, media_type, album, artist, track, artwork_url

**Environmental**: pressure, illuminance, distance, concentration, link_quality

**Status**: fault, locked, tampered, detected, triggered, in_use, change_needed, life_remaining, firmware_revision, serial_number, manufacturer, model

**Mechanical**: position, tilt, angle, speed, level, direction

---

## Dashboard & Display System

The dashboard system allows creating customizable home control interfaces with multiple layout types, widgets, and data bindings.

### Page Types

#### Tiles Page
- Grid-based tile layout for dashboard design
- Configurable grid dimensions
- Drag-and-drop tile placement
- Responsive tile sizing
- Tile nesting support

#### Cards Page
- Card-based layout for organized information display
- Nested card grouping
- Responsive card management
- Per-card configuration

#### Device Detail Page
- Full device information and control display
- Channel and property visualization
- Device-specific control interface
- Real-time property value updates

### Tile Widgets

#### Device Preview Tile
- Real-time device status display
- Quick toggle controls for on/off devices
- Multi-property value visualization
- Connection status indicator
- Device icon and name display

#### Scene Tile
- Scene execution trigger button
- Last triggered timestamp display
- Scene status indicator
- Quick-trigger controls

#### Weather Tile
- **Current weather**: temperature, feels-like, humidity, wind speed/direction, precipitation, UV index, cloud coverage, weather condition icons
- **Forecast weather**: multi-day forecasts, high/low temperatures, precipitation probability, wind forecasts

#### Time Tile
- Digital clock display
- 12-hour and 24-hour format options
- Date display with configurable formatting
- Timezone support
- Auto-updating display

### Data Sources

#### Device Channel Data Source
- Binds dashboard widgets to device channel properties
- Constraint validation (device, channel, property existence)
- Real-time value updates via WebSocket

#### Weather Data Source
- Binds weather data to dashboard tiles
- Current conditions and forecast data
- Location-based weather information

---

## Space Management

Spaces organize devices and displays into logical groupings that represent physical locations.

### Features

- **Hierarchical organization** - Rooms, zones, areas, and buildings
- **Device assignment** - Assign devices to specific spaces
- **Display assignment** - Assign panel displays to spaces
- **Climate targets** - Set temperature targets per space
- **Lighting targets** - Set brightness and color targets per space
- **Cover targets** - Control blinds and shutters per space
- **Sensor aggregation** - Aggregate sensor readings (temperature, humidity) per space
- **Real-time state tracking** - Live updates of space climate, lighting, and sensor states

---

## Climate Control

The climate domain provides intelligent, multi-device climate management at the space level.

### Climate Modes

| Mode | Description |
|------|-------------|
| HEAT | Heating only - activates heating devices |
| COOL | Cooling only - activates cooling devices |
| AUTO | Both heating and cooling based on setpoints |
| OFF | All climate devices disabled |

### Climate Intents

| Intent | Description |
|--------|-------------|
| SET_MODE | Change the climate mode for a space |
| SETPOINT_SET | Set an absolute temperature target |
| SETPOINT_DELTA | Adjust temperature relatively (±0.5°C small, ±1.0°C medium, ±2.0°C large) |
| CLIMATE_SET | Atomic mode + setpoint change in one operation |

### Device Roles

| Role | Behavior |
|------|----------|
| AUTO | Responds to all climate modes (HEAT, COOL, AUTO, OFF) |
| HEATING_ONLY | Only participates in HEAT mode |
| COOLING_ONLY | Only participates in COOL mode |
| SENSOR | Temperature reading only, no control commands |
| HIDDEN | Excluded from climate state calculation |

### Climate State Calculation

For each space, Smart Panel calculates an aggregated climate state:
- Current temperature (averaged from all sensors in the space)
- Current humidity (averaged from humidity sensors)
- Heating and cooling setpoints (consensus from devices)
- Active heating/cooling status
- Support flags for heating and cooling capability
- Mixed state detection (when devices have divergent setpoints)
- Last applied mode and timestamp

### Performance Optimizations
- Parallel data fetching for devices, roles, and historical state
- Event debouncing (100ms) to prevent WebSocket flooding
- Fire-and-forget InfluxDB writes for history tracking
- Early exit patterns for spaces without climate devices

---

## Media Control

The media domain manages audio/video devices with an activity-based control model.

### Concepts

- **Activities** - User-facing modes: Watch, Listen, Gaming, Background, Off
- **Endpoints** - Controllable media targets derived from device capabilities
- **Bindings** - Activity-to-endpoint associations with presets

### Endpoint Types

| Type | Description | Examples |
|------|-------------|---------|
| Display | Video output devices | TVs, projectors |
| Audio Output | Speaker systems | Receivers, soundbars, smart speakers |
| Source | Content sources | Streaming apps, tuners, inputs |
| Remote Target | Control-only endpoints | IR remotes, control systems |

### Features

- Dynamic endpoint discovery from device capabilities
- Automatic presets for common activity-endpoint combinations
- Real-time binding updates as devices come online
- Multi-endpoint activity support
- WebSocket requirement flags per activity
- Visual warnings for unreliable endpoints

---

## Energy Monitoring

Track and visualize energy consumption and production across the smart home.

### Capabilities

- **Real-time power monitoring** - Live wattage readings from power-monitoring devices
- **Energy consumption tracking** - kWh usage per device, per space, and system-wide
- **Grid flow monitoring** - Import and export tracking for grid-connected systems
- **Solar/production tracking** - Energy production monitoring for solar panels and other sources
- **Historical data** - InfluxDB time-series storage for trends and analytics
- **Per-device breakdown** - Individual device energy contribution analysis
- **Optimized caching** - Multi-layer caching designed for resource-constrained panel devices

---

## Scenes & Automation

Create automation sequences that control multiple devices with a single action.

### Features

- **Scene creation** - Define named automation sequences
- **Action sequencing** - Execute multiple device property commands in sequence
- **Device property actions** - Set any device property value as part of a scene
- **Delay actions** - Add timed delays between actions
- **Scene triggers** - Manual trigger from dashboard tiles, API, or Buddy AI
- **Execution feedback** - Real-time execution status via WebSocket
- **Last triggered tracking** - Timestamp of last execution
- **Enable/disable** - Toggle scenes without deleting them
- **InfluxDB logging** - Action execution history stored in time-series database

### Scene Execution Platforms

- **Local execution** - Scenes run directly on the Smart Panel backend
- **Atomic execution** - Rollback on partial failure
- **Extensible** - Plugin-based platform for future remote execution

---

## Buddy AI Assistant

An AI-powered smart home assistant that understands your home and helps you control it.

### LLM Providers

| Provider | Type | Description |
|----------|------|-------------|
| **Claude** (Anthropic) | Cloud API | Advanced reasoning and natural language understanding |
| **OpenAI GPT** | Cloud API | GPT model family with chat completions |
| **OpenAI Codex** | Cloud API | Code generation for automation scripts |
| **Ollama** | Local | Privacy-focused, offline-capable local LLM inference |

### Speech Capabilities

| Feature | Provider | Type |
|---------|----------|------|
| Speech-to-Text | Whisper (Local) | Offline speech recognition, multilingual |
| Text-to-Speech | ElevenLabs | High-quality cloud voice synthesis |
| Text-to-Speech | System TTS | Native OS text-to-speech (offline) |
| Voice AI | VoiceAI | Voice-specific routing and optimization |

### Messaging Channels

| Channel | Protocol | Features |
|---------|----------|----------|
| **Telegram** | Bot API | Messages, commands, inline buttons |
| **WhatsApp** | WAPI | Messages, media, status updates |
| **Discord** | Bot API | Messages, embeds, reactions, slash commands |

### Buddy Capabilities

- **Home status monitoring** - Observes device states and environmental conditions
- **Natural language control** - Control devices through conversational text or voice
- **Text chat interface** - Built-in chat UI in both panel and admin apps
- **Voice commands** - Speak commands and receive voice responses
- **Proactive intelligence** - Automated suggestions and predictive notifications
- **Context-aware responses** - Understands your home layout, devices, and preferences
- **Multi-channel access** - Consistent experience across Telegram, WhatsApp, and Discord
- **Automation suggestions** - Learns patterns and suggests scene automations

---

## Weather Integration

Integrated weather data for dashboard display and environmental context.

### Weather Providers

| Provider | Features |
|----------|----------|
| **OpenWeatherMap Standard** | Current conditions, 5-day forecast, city-based queries |
| **OpenWeatherMap One Call** | Unified endpoint, current + forecast, minute-level precision, historical data |

### Weather Data

- **Current conditions**: Temperature, feels-like, humidity, pressure, wind speed/direction, clouds, precipitation, visibility, UV index
- **Forecasts**: 5-day, 7-day, and 10-day forecasts with hourly and daily granularity
- **Location support**: Coordinates, city names, geographic boundaries
- **Multiple locations**: Configure and track weather for multiple locations

---

## Security & Access Control

### User Roles

| Role | Capabilities |
|------|-------------|
| **Owner** | Full system access, user management, factory reset, all configuration |
| **Admin** | System configuration, device management, extension management |
| **User** | Dashboard viewing, basic device control |

### Authentication

- JWT-based authentication with configurable secret and expiration
- Three token types:
  - **Access tokens** - Short-lived for API requests
  - **Refresh tokens** - Medium-lived for session renewal
  - **Long-live tokens** - No expiration for display panel authentication
- Password hashing via bcrypt
- Token creation, validation, and revocation
- Global route protection with AuthGuard

### Display Authentication

- Generate dedicated access tokens for panel displays
- Token lifecycle management (creation, revocation)
- Token validity period configuration
- Separate authentication flow for embedded devices

---

## System Administration

### System Monitoring

- **CPU metrics** - Processor usage and throttle status monitoring
- **Memory metrics** - RAM usage and availability
- **Disk metrics** - Storage usage and health
- **Network metrics** - Network interface status and throughput
- **Thermal monitoring** - CPU temperature and thermal throttling detection

### System Logs

- **Log collection** - Centralized log aggregation from all modules
- **Severity filtering** - Debug, info, warning, error levels
- **Log rotation** - Rotating file-based log storage
- **Log viewer** - Browse, filter, and search system logs in the admin UI

### Maintenance Operations

- **System reboot** - Safe system restart
- **Power off** - Graceful system shutdown
- **Factory reset** - Restore system to default state
- **Maintenance mode** - Special restricted access mode for servicing

### Configuration Management

- **Module configuration** - Enable/disable and configure individual backend modules
- **Plugin configuration** - Enable/disable and configure individual plugins
- **Dynamic settings forms** - Schema-driven configuration UI
- **Real-time sync** - Configuration changes applied and synced in real-time

---

## Extension System

Smart Panel features a plugin-based extension system that allows third-party developers to add new capabilities.

### Extension SDK

- **Purpose**: TypeScript package defining the contract for backend and admin extensions
- **Package**: `@fastybird/smart-panel-extension-sdk`
- **Backend extensions**: NestJS modules mounted at `/api/prefix` or `/api/plugins/prefix`
- **Admin extensions**: Vue.js components for the admin interface
- **Manifest validation**: Type guards and route normalization utilities

### Extension Types

| Kind | Mounting | Description |
|------|----------|-------------|
| Module | `/api/{prefix}` | Core system extensions |
| Plugin | `/api/plugins/{prefix}` | Integration and feature plugins |

### Extension Discovery

1. Backend scans `node_modules` for extension manifests in `package.json`
2. Validates manifest structure using SDK type guards
3. Dynamically imports and instantiates extension modules
4. Mounts extensions at their designated routes
5. Extensions are live and serving requests

### Example Extension

An example extension (`@fastybird/smart-panel-extension-example`) demonstrates:
- Minimal NestJS module setup with a single controller
- Backend plugin with health/status endpoint
- Admin UI plugin with Vue.js components
- Clean separation of backend and admin code
- Proper manifest configuration

---

## Real-Time Communication

### WebSocket Gateway

- **Protocol**: Socket.io for reliable real-time communication
- **Multi-client broadcast** - Push state changes to all connected clients simultaneously
- **Event-driven architecture** - Internal pub/sub system using Event2
- **Event debouncing** - Aggregation to prevent flooding (100ms window)
- **Selective updates** - Efficient `CHANNEL_PROPERTY_VALUE_SET` events for value-only changes

### Update Patterns

- Device state changes pushed instantly to all connected panels and admin apps
- Dashboard data source values update in real-time
- Climate and energy state recalculated and broadcast on device changes
- Scene execution status streamed during execution
- Configuration changes synchronized across all connected clients

---

## API & Developer Tools

### RESTful API

- **Full CRUD** for all resources (devices, channels, properties, pages, tiles, scenes, spaces, users, etc.)
- **OpenAPI specification** - Auto-generated from backend controllers and Swagger decorators
- **Discriminator-based polymorphism** - Plugin types handled via OpenAPI discriminators
- **Response models** - Controllers return typed `*ResponseModel` objects
- **Input DTOs** - Validated request input via decorator-based DTOs

### Code Generation

- **OpenAPI spec generation** - `pnpm run generate:openapi` produces the complete API specification
- **Device/channel spec generation** - `pnpm run generate:spec` produces device and channel type definitions
- **Admin client** - OpenAPI types auto-generated for the Vue.js admin app
- **Panel client** - API client auto-generated for the Flutter panel app

### CLI Commands

- `register:owner` - Create the initial owner account
- `reset:password` - Reset user passwords
- Device simulator scenario management commands

---

## Panel Touch Interface

The Flutter-based panel app is designed for wall-mounted touch displays with an optimized UI.

### Features

#### Deck Navigation
- Swipeable deck-based navigation between dashboard pages
- Page indicator dots
- Smooth page transitions
- Touch-optimized gestures

#### Device Discovery
- Automatic discovery of new devices on the network
- mDNS service scanning
- Device adoption workflow

#### Overlay System
- Modal overlays for device detail views
- Climate control overlay with temperature wheel
- Media control overlay
- Device control panels

#### Settings
- Panel display configuration
- Network settings
- Backend connection configuration
- Display brightness and timeout

### Optimistic UI Pattern

The panel implements a sophisticated optimistic UI pattern for responsive device control:

```
IDLE (shows actual server value)
  ↓ user action
PENDING (shows desired value, UI locked)
  ↓ API success
SETTLING (waits for actual value match, UI locked)
  ↓ actual matches OR timeout
IDLE (shows confirmed value)
  ← API failure: rollback to previous IDLE value
```

This ensures the UI feels instant and responsive even when controlling remote devices.

### Channel Controllers

Specialized controllers for each device type with optimistic-aware getters and command methods:
- FanChannelController
- HumidifierChannelController
- DehumidifierChannelController
- HeaterChannelController
- CoolerChannelController
- ThermostatChannelController
- LightChannelController

---

## Admin Web Interface

The Vue.js admin interface provides comprehensive management for the entire system.

### Module Summary (20 modules, 34 plugins)

| Module | Screens | Key Capabilities |
|--------|---------|-----------------|
| Authentication | 4 | Login, registration, profile, security settings |
| Users | 3 | User CRUD, role management |
| Devices | 10+ | Device/channel/property management, control, logs |
| Dashboard | 8 | Page/tile/data source design and configuration |
| Spaces | 5 | Space organization, device assignment, climate/lighting targets |
| Scenes | 3 | Scene creation, action configuration, trigger management |
| Displays | 3 | Display management, token generation |
| Extensions | 2 | Extension browsing, service monitoring, log viewing |
| Config | 4 | Module and plugin configuration |
| System | 4 | System info, logs, reboot/power off/factory reset |
| Weather | 4 | Location management, weather data display |
| Buddy | 1 | AI assistant chat interface |
| Stats | 1 | System statistics dashboard |
| Energy | - | Energy monitoring (reserved for expansion) |

### UI Capabilities

- **58 view pages** across all modules
- **243 Vue components** for a rich, interactive UI
- **30+ Pinia stores** for reactive state management
- **80+ composables** for reusable business logic
- **Element Plus** component library with custom SCSS styling
- **Responsive design** with breakpoint detection
- **Dark mode** support
- **Internationalization** (i18n) framework with Vue I18n
- **Real-time updates** via Socket.io WebSocket integration
- **Breadcrumb navigation** for deep page hierarchies
- **Bulk actions** toolbar for multi-select operations
- **Icon picker** for device and channel customization
- **Markdown renderer** for rich text display

---

## Technology Stack

### Backend

| Technology | Purpose |
|------------|---------|
| NestJS | Application framework |
| TypeScript | Type-safe development |
| TypeORM | Database ORM |
| SQLite | Primary database |
| InfluxDB | Time-series data storage |
| Socket.io | WebSocket real-time communication |
| Passport / JWT | Authentication |
| Swagger / OpenAPI | API documentation |
| nest-commander | CLI commands |
| Event2 | Internal event bus |
| bcrypt | Password hashing |
| axios | HTTP client for device communication |
| mqtt | MQTT client for Zigbee2MQTT |
| mdns | Device discovery |

### Admin App

| Technology | Purpose |
|------------|---------|
| Vue.js 3 | UI framework (Composition API) |
| TypeScript | Type-safe development |
| Vite | Build tool and dev server |
| Pinia | State management |
| Vue Router 4 | Client-side routing |
| Element Plus | UI component library |
| Vue I18n | Internationalization |
| OpenAPI Fetch | API client |
| Socket.io Client | Real-time updates |
| UNO CSS | Utility CSS framework |
| Vitest | Unit testing |

### Panel App

| Technology | Purpose |
|------------|---------|
| Flutter | Cross-platform UI framework |
| Dart | Programming language |
| Provider | State management |
| Dio | HTTP client |
| Socket.io Client | Real-time updates |
| go_router | Navigation and routing |

### Website

| Technology | Purpose |
|------------|---------|
| Next.js 15 | React framework |
| Nextra 4 | Documentation engine |
| Tailwind CSS 4 | Utility-first styling |
| React 19 | UI library |
| Framer Motion | Animations |
| Pagefind | Search functionality |

### Infrastructure

| Technology | Purpose |
|------------|---------|
| pnpm | Package manager (monorepo workspaces) |
| Turborepo | Monorepo build orchestration |
| ESLint / Prettier | Code quality and formatting |
| Node.js 20+ | Runtime environment |

---

## Integration Coverage Matrix

| Device Type | Home Assistant | Shelly NG | Shelly V1 | Zigbee2MQTT | WLED | Simulator |
|------------|:-:|:-:|:-:|:-:|:-:|:-:|
| Lighting | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Switches/Outlets | ✅ | ✅ | ✅ | ✅ | - | ✅ |
| Covers/Blinds | ✅ | ✅ | - | ✅ | - | ✅ |
| Climate/HVAC | ✅ | - | - | ✅ | - | ✅ |
| Sensors | ✅ | ✅ | ✅ | ✅ | - | ✅ |
| Locks | ✅ | - | - | ✅ | - | ✅ |
| Cameras | ✅ | - | - | - | - | ✅ |
| Media Players | ✅ | - | - | - | - | ✅ |
| Fans | ✅ | - | - | ✅ | - | ✅ |
| Vacuums | ✅ | - | - | - | - | ✅ |
| Valves | ✅ | - | - | ✅ | - | - |
| Auto-Discovery | ✅ | ✅ | ✅ | ✅ | ✅ | - |

---

## Summary of Capabilities

### By the Numbers

| Metric | Count |
|--------|-------|
| Device integration plugins | 7 |
| Supported device categories | 31 |
| Channel types | 45+ |
| Property types | 120+ |
| Dashboard page types | 3 |
| Dashboard tile widgets | 4 |
| AI/LLM providers | 4 |
| Messaging channels | 3 |
| Weather providers | 2 |
| Backend modules | 24 |
| Backend plugins | 32+ |
| Admin modules | 20 |
| Admin plugins | 34 |
| Admin view pages | 58 |
| Admin Vue components | 243 |
| Panel modules | 14 |
| Panel features | 4 |
| Panel plugins | 17 |

### Core Value Propositions

1. **Unified Control** - One touch panel to control devices from Home Assistant, Shelly, Zigbee, WLED, and more
2. **Privacy-First** - Local processing, offline-capable, optional cloud services
3. **AI-Powered** - Built-in smart assistant with voice, text, and messaging capabilities
4. **Beautiful UI** - Touch-optimized Flutter panel with customizable dashboards
5. **Professional Admin** - Full-featured Vue.js web interface for configuration and management
6. **Extensible** - Plugin architecture with SDK for custom integrations
7. **Open Source** - Apache 2.0 license, transparent development, community contributions welcome
8. **Real-Time** - WebSocket-based instant updates across all connected devices and clients
9. **Smart Climate** - Intelligent multi-device climate management with intent-based control
10. **Energy Aware** - Built-in energy monitoring and tracking capabilities
