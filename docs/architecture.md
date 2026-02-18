# Smart Panel Architecture

## Overview

Smart Panel is a home automation dashboard system consisting of four main applications:

1. **Backend** - NestJS REST API server with WebSocket support
2. **Admin** - Vue.js web administration interface
3. **Panel** - Flutter embedded application for smart displays
4. **Website** - Next.js documentation and marketing website

## System Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Panel App     │     │   Admin App     │     │  External APIs  │
│   (Flutter)     │     │   (Vue.js)      │     │  (HA, Shelly)   │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         │    REST + WebSocket   │    REST + WebSocket   │
         │                       │                       │
         └───────────────────────┴───────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │      Backend (NestJS)   │
                    │                         │
                    │  ┌───────────────────┐  │
                    │  │      Modules      │  │
                    │  │  (core business)  │  │
                    │  └───────────────────┘  │
                    │  ┌───────────────────┐  │
                    │  │      Plugins      │  │
                    │  │  (integrations)   │  │
                    │  └───────────────────┘  │
                    └────────────┬────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │     SQLite Database     │
                    │     InfluxDB (stats)    │
                    └─────────────────────────┘
```

## Core Concepts

### Devices, Channels, and Properties

The device model follows a hierarchical structure inspired by Matter:

- **Device** - A physical or virtual device (e.g., smart plug, light bulb)
- **Channel** - A functional unit within a device (e.g., relay, dimmer, sensor)
- **Property** - An individual attribute or control (e.g., on/off state, brightness, temperature)

```
Device (Smart Plug)
├── Channel (Relay)
│   ├── Property (state: on/off)
│   └── Property (power: watts)
├── Channel (Energy Meter)
│   └── Property (consumption: kWh)
└── Channel (Device Info)
    ├── Property (firmware)
    └── Property (rssi)
```

### Dashboard Structure

The dashboard system organizes content into:

- **Pages** - Full-screen views displayed on the panel
- **Tiles** - UI components within pages (weather, device controls, clocks)
- **Data Sources** - Connections between tiles and device properties or external data

### Displays

Displays are panel app instances that register with the backend:

- Each display has a unique identity and authentication token
- Displays can be assigned to specific pages
- Multiple displays can show different dashboards

## Backend Architecture

### Modules (Core Business Logic)

| Module | Purpose |
|--------|---------|
| `api` | API infrastructure and routing |
| `auth` | Authentication, authorization, token management |
| `config` | System and module configuration |
| `dashboard` | Pages, tiles, data sources |
| `devices` | Device, channel, property management |
| `displays` | Display registration and configuration |
| `energy` | Energy tracking and aggregation |
| `extensions` | Extension system and metadata |
| `influxdb` | Time-series database integration |
| `intents` | Intent and automation system |
| `mdns` | mDNS device discovery |
| `platform` | Platform core utilities |
| `scenes` | Scene management |
| `security` | Security and alert system |
| `seed` | Database seeding |
| `spaces` | Space (room/zone) management |
| `stats` | Statistics and timeseries data |
| `swagger` | OpenAPI/Swagger documentation |
| `system` | System settings and info |
| `users` | User accounts and roles |
| `weather` | Weather data management |
| `websocket` | Real-time event distribution |

### Plugins (Integrations & Extensions)

| Category | Plugins |
|----------|---------|
| Device integrations | `devices-home-assistant`, `devices-shelly-ng`, `devices-shelly-v1`, `devices-simulator`, `devices-third-party`, `devices-wled`, `devices-zigbee2mqtt` |
| Page types | `pages-tiles`, `pages-cards`, `pages-device-detail` |
| Tile types | `tiles-weather`, `tiles-time`, `tiles-device-preview`, `tiles-scene` |
| Data sources | `data-sources-device-channel`, `data-sources-weather` |
| Scene management | `scenes-local` |
| Weather providers | `weather-openweathermap`, `weather-openweathermap-onecall` |
| Logging | `logger-rotating-file` |

## Admin Architecture

The admin app mirrors the backend module structure:

- **Modules** - UI for managing core entities (devices, pages, users)
- **Plugins** - UI for plugin-specific configuration and management
- **Pinia Stores** - State management for each module/plugin

## Panel Architecture

The panel app is designed for embedded displays:

- **Modules** - Feature modules matching backend capabilities
- **API Client** - Generated from OpenAPI specification
- **Widgets** - Reusable UI components for tiles and controls

## Data Flow

### REST API

- CRUD operations for all entities
- OpenAPI specification generated from backend
- Type-safe clients generated for admin (TypeScript) and panel (Dart)

### WebSocket

- Real-time property value updates
- Display-specific event channels
- Device state change notifications

### External Integrations

Plugins connect to external systems:

- **Home Assistant** - WebSocket API for entity sync
- **Shelly** - CoAP/HTTP for device discovery and control
- **OpenWeatherMap** - HTTP API for weather data

## Security

### Authentication

- **Users** - JWT access/refresh tokens
- **Displays** - Long-lived tokens with permit-join registration
- **WebSocket** - Token-based authentication for real-time connections

### Authorization

- Role-based access control (Owner, Admin, User)
- Display-specific permissions for page access
