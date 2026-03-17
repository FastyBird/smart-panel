<p align="center">
  <img src="https://github.com/fastybird/.github/blob/main/assets/repo_title.png?raw=true" alt="FastyBird"/>
</p>

# FastyBird Smart Panel

A smart touchscreen interface for your smart home.

**FastyBird Smart Panel** is a modular and extensible **user interface platform** designed to bring your smart home system to life on touchscreen displays.

It provides a seamless way to interact with your home setup, acting as a **real-time control dashboard** for systems like Home Assistant, Shelly, Zigbee2MQTT, WLED, and more.

---

## What FastyBird Smart Panel Offers

### Elegant, User-Centric UI

Create dynamic dashboards with customizable tiles, icons, and layouts -- all optimized for embedded screens and modern devices.

### Modular Architecture

Each feature -- from tiles to data sources -- is handled by independent plugins. This makes the platform easy to extend and tailor to any smart home setup.

### Built for Integration

FastyBird Smart Panel connects with your existing smart home backend. It fetches data, executes commands, and displays device status in real-time.

### Touch-Optimized Display App

Crafted with **Flutter**, the display app runs smoothly on Raspberry Pi and other embedded Linux devices with small screens (e.g., 4" or 7").

---

## System Components

| Component | Technology | Description |
|-----------|------------|-------------|
| **Backend** | NestJS, TypeORM, SQLite | Core service managing devices, dashboards, pages, tiles, and configuration |
| **Admin** | Vue 3, Pinia, Element Plus | Web-based interface for managing pages, configuring layouts, and controlling devices |
| **Panel** | Flutter (Dart) | Touchscreen display app for Raspberry Pi and embedded Linux devices |
| **Website** | Next.js, React, MDX | Project documentation and marketing website |

---

## Supported Integrations

### Device Integrations

| Integration | Protocol | Description |
|-------------|----------|-------------|
| **Home Assistant** | WebSocket API | Full entity sync with Home Assistant instances |
| **Shelly (Gen 2+)** | HTTP/CoAP | Native support for Shelly Gen 2+ (NG) devices |
| **Shelly (Gen 1)** | HTTP/CoAP | Support for Shelly Gen 1 devices |
| **Zigbee2MQTT** | MQTT | Integration with Zigbee devices via Zigbee2MQTT |
| **WLED** | HTTP | Control WLED-powered RGB/LED devices |
| **OpenWeatherMap** | HTTP API | Weather data for dashboard tiles |

### AI & Voice Integrations

| Integration | Description |
|-------------|-------------|
| **Claude (Anthropic)** | AI-powered smart home assistant via Claude API |
| **OpenAI** | AI assistant powered by OpenAI models |
| **OpenAI Codex** | Code-generation AI assistant |
| **Ollama** | Local AI assistant using self-hosted Ollama models |
| **ElevenLabs** | High-quality text-to-speech voice synthesis |
| **System TTS** | Built-in system text-to-speech engine |
| **Whisper (Local)** | Local speech-to-text transcription |

### Messaging Integrations

| Integration | Description |
|-------------|-------------|
| **Discord** | Control your smart home through Discord bot |
| **Telegram** | Control your smart home through Telegram bot |
| **WhatsApp** | Control your smart home through WhatsApp |

---

## Features at a Glance

- **Configurable Grid Layouts** -- Tile-based, card-based, and detail-style page views
- **Customizable Tiles** -- Clocks, weather, device previews, scenes, and more
- **Plugin System** -- Extensible architecture for data sources, pages, tiles, and device integrations
- **Real-Time Updates** -- WebSocket-powered instant sync across all clients
- **API-first Design** -- OpenAPI-documented REST API for easy third-party integration
- **Multi-Display Support** -- Multiple displays showing different dashboards with role-based views
- **Spaces & Rooms** -- Room-first control with domain-based device grouping (lights, climate, media, security)
- **Scenes** -- Automations and scene presets for one-tap control
- **Energy Monitoring** -- Track consumption and production across devices and spaces
- **AI Assistant (Buddy)** -- Built-in AI assistant with support for Claude, OpenAI, and local Ollama models
- **Voice Control** -- Speech-to-text (Whisper) and text-to-speech (ElevenLabs, system TTS) support
- **Messaging Bots** -- Control your home via Discord, Telegram, or WhatsApp
- **Extension SDK** -- Build and distribute custom extensions as npm packages

---

## Quick Start (Production)

Smart Panel supports three deployment scenarios. Choose the one that fits your setup:

### All-in-One (Server + Display on One Device)

The simplest setup — ideal for a standalone Raspberry Pi with a touchscreen:

```bash
# Install the server (backend + admin interface)
curl -fsSL https://get.smart-panel.fastybird.com | sudo bash

# Install the display app with kiosk mode
curl -fsSL https://get.smart-panel.fastybird.com/panel | sudo bash -s -- --backend http://localhost:3000 --kiosk
```

### Server Only

Run just the backend and admin interface on a central device. Display panels connect remotely:

```bash
# Option A: One-liner install script
curl -fsSL https://get.smart-panel.fastybird.com | sudo bash

# Option B: NPM global install
sudo npm install -g @fastybird/smart-panel
sudo smart-panel-service install
```

### Display Only

Install the panel app on a device that connects to an existing server:

```bash
curl -fsSL https://get.smart-panel.fastybird.com/panel | sudo bash -s -- --backend http://YOUR_SERVER_IP:3000
```

Supports Raspberry Pi (flutter-pi), Linux x64 (eLinux DRM or GTK desktop), and Android (APK via ADB).

For detailed installation instructions, see the [Installation Guide](build/docs/INSTALLATION.md) or the [online documentation](https://smart-panel.fastybird.com/docs/get-started/installation).

---

## Development Setup

### Prerequisites

- **Node.js** >= 24
- **pnpm** >= 10
- **Flutter/Dart** (for panel app development)

### Getting Started

```bash
# Clone the repository
git clone https://github.com/fastybird/smart-panel.git
cd smart-panel

# Bootstrap the project (installs deps, generates code, runs migrations, builds)
pnpm run bootstrap

# Create the first user
pnpm run onboard

# Start the backend in dev mode
pnpm run start:dev
```

The backend runs on `http://localhost:3000` with Swagger docs at `http://localhost:3000/api/docs`.

### Common Commands

```bash
# Development
pnpm run start:dev              # Backend dev server
pnpm run admin:build            # Build admin app

# Testing
pnpm run test:unit              # Run unit tests
pnpm run test:e2e               # Run E2E tests

# Linting & Formatting
pnpm run lint:js                # Lint TypeScript
pnpm run lint:js:fix            # Auto-fix lint issues
pnpm run pretty                 # Format code

# Code Generation
pnpm run generate:openapi       # Generate OpenAPI spec and API clients
pnpm run generate:spec          # Generate device/channel specifications
```

---

## Project Structure

```
apps/
  backend/       NestJS backend application
  admin/         Vue.js admin interface
  panel/         Flutter/Dart display app
  website/       Next.js documentation site

packages/
  extension-sdk/       SDK for building Smart Panel extensions
  example-extension/   Example extension implementation

spec/                  Generated API and device specifications
docs/                  Developer documentation
tasks/                 Feature and technical task specifications
build/                 Production build and installation tools
```

---

## Documentation & Resources

- [Project Website](https://smart-panel.fastybird.com)
- [User Documentation](https://smart-panel.fastybird.com/docs)
- [Installation Guide](build/docs/INSTALLATION.md) - Server, display, and all-in-one setup
- [Architecture Overview](docs/architecture.md)
- [Extensions Guide](docs/extensions.md)
- [Extension SDK](packages/extension-sdk/README.md)
- [Issue Tracker](https://github.com/FastyBird/smart-panel/issues)

---

## Contributing

Contributions are welcome! Please fork this repository and submit a pull request.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a pull request

---

## License

This project is licensed under the **Apache License 2.0**. See the [LICENSE](LICENSE.md) file for details.

***
Homepage [https://smart-panel.fastybird.com](https://smart-panel.fastybird.com) and repository [https://github.com/fastybird/smart-panel](https://github.com/fastybird/smart-panel).
