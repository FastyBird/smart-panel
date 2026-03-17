<p align="center">
	<img src="https://github.com/fastybird/.github/blob/main/assets/repo_title.png?raw=true" alt="FastyBird"/>
</p>

# 🚀 Smart Panel Backend

The **FastyBird Smart Panel Backend** is the core service powering the user interface layer of smart home platforms.

It is responsible for managing **dashboards, pages, tiles, and data sources**—delivering data in real-time and supporting seamless integration with smart home systems like Home Assistant, Shelly, Zigbee2MQTT, and WLED.

---

## ✨ Key Features

- ✅ **Plugin-Based Architecture** – Easily extend with new tile types, data sources, or custom pages
- ✅ **Modular Design** – Cleanly separated `modules/` and `plugins/` to support scalable growth
- ✅ **Real-Time WebSocket Communication** – Instant updates for connected frontend apps
- ✅ **Flexible Page Layouts** – Support for tile-based, card-based, and detail-style views
- ✅ **AI Assistant (Buddy)** – Built-in AI assistant with Claude, OpenAI, and local Ollama support
- ✅ **Voice AI** – Speech-to-text (Whisper) and text-to-speech (ElevenLabs, system TTS)
- ✅ **Messaging Bots** – Control your home via Discord, Telegram, or WhatsApp
- ✅ **Built-In Validation & Error Handling** – Strong type safety and detailed errors
- ✅ **Database Integration** – Works with relational databases via TypeORM

## Project Structure

```plaintext
src/
├── common/                  # Shared utilities, base classes, and helpers
│   ├── entities/            # Base entities and abstract classes
│   ├── filters/             # Custom exception filters
│   ├── logger/              # Logging utilities
│   ├── services/            # Shared services
│   ├── utils/               # Utility functions and helpers
│   └── validation/          # Custom validation rules and decorators
│
├── modules/                 # Core feature modules
│   ├── api/                 # API infrastructure
│   ├── auth/                # Authentication & authorization
│   ├── buddy/               # AI assistant module
│   ├── config/              # Configuration management
│   ├── dashboard/           # Pages, tiles, and data sources
│   ├── devices/             # Device, channel, and property management
│   ├── displays/            # Display registration & management
│   ├── energy/              # Energy tracking and aggregation
│   ├── extension-registry/  # Extension discovery and registration
│   ├── extensions/          # Extension system
│   ├── factory-reset/       # Factory reset functionality
│   ├── influxdb/            # Time-series database integration
│   ├── intents/             # Intent and automation system
│   ├── mdns/                # mDNS discovery
│   ├── module-registry/     # Module registry management
│   ├── platform/            # Platform core utilities
│   ├── scenes/              # Scene management
│   ├── security/            # Security and alerts
│   ├── seed/                # Database seeding
│   ├── spaces/              # Space (room/zone) management
│   ├── stats/               # Statistics and timeseries
│   ├── swagger/             # OpenAPI/Swagger documentation
│   ├── system/              # System settings and info
│   ├── tools/               # Shared tools and utilities
│   ├── users/               # User management
│   ├── weather/             # Weather data
│   └── websocket/           # WebSocket gateway
│
├── plugins/                 # Pluggable integrations and features
│   │
│   │   # AI & Voice plugins
│   ├── buddy-claude/              # Claude (Anthropic) AI assistant
│   ├── buddy-claude-setup-token/  # Claude API token setup
│   ├── buddy-openai/              # OpenAI AI assistant
│   ├── buddy-openai-codex/        # OpenAI Codex assistant
│   ├── buddy-ollama/              # Local Ollama AI assistant
│   ├── buddy-elevenlabs/          # ElevenLabs text-to-speech
│   ├── buddy-system-tts/          # System text-to-speech
│   ├── buddy-stt-whisper-local/   # Local Whisper speech-to-text
│   ├── buddy-voiceai/             # Voice AI orchestration
│   │
│   │   # Messaging channel plugins
│   ├── buddy-discord/             # Discord bot integration
│   ├── buddy-telegram/            # Telegram bot integration
│   ├── buddy-whatsapp/            # WhatsApp integration
│   │
│   │   # Device integration plugins
│   ├── devices-home-assistant/    # Home Assistant integration
│   ├── devices-shelly-ng/         # Shelly Gen 2+ devices
│   ├── devices-shelly-v1/         # Shelly Gen 1 devices
│   ├── simulator/         # Virtual device simulator
│   ├── devices-third-party/       # Third-party device support
│   ├── devices-wled/              # WLED RGB device support
│   ├── devices-zigbee2mqtt/       # Zigbee2MQTT integration
│   │
│   │   # Data source, page, tile, and other plugins
│   ├── data-sources-device-channel/  # Device channel data sources
│   ├── data-sources-weather/      # Weather data sources
│   ├── pages-cards/               # Card-based page layouts
│   ├── pages-device-detail/       # Device detail pages
│   ├── pages-tiles/               # Tile-based page layouts
│   ├── scenes-local/              # Local scene management
│   ├── tiles-device-preview/      # Device preview tiles
│   ├── tiles-scene/               # Scene control tiles
│   ├── tiles-time/                # Clock tiles
│   ├── tiles-weather/             # Weather tiles
│   ├── logger-rotating-file/      # File-based logging
│   ├── weather-openweathermap/            # OpenWeatherMap API
│   └── weather-openweathermap-onecall/    # OpenWeatherMap OneCall API
│
├── migrations/              # TypeORM database migrations
├── spec/                    # Generated device/channel specifications
├── cli.ts                   # Command-line interface for administration
└── main.ts                  # Application entry point
```

Each module and plugin defines its own controllers, services, entities, DTOs, and OpenAPI schemas.

## 🛠️ Tech Stack

- 🚀 **Node.js** – Runtime environment
- 🔧 **NestJS** – Scalable backend framework
- 📦 **TypeORM** – Database ORM
- 🔍 **Jest** – Testing framework
- 🔗 **WebSockets** – Real-time communication

## 🚧 Prerequisites

Before starting, make sure you have the following installed:
- Node.js v24+
- PNPM v10+
- SQLite (bundled, no external installation needed)

## 🚀 Getting Started

### 1️⃣ Clone the Repository

```shell
git clone https://github.com/fastybird/smart-panel.git
cd apps/backend
```
### 2️⃣ Install Dependencies

```shell
pnpm install
```

### 3️⃣ Build generated code

```shell
pnpm generate:openapi
```

### 4️⃣ Run Migrations

```shell
pnpm typeorm:migration:run
```

### 5️⃣ Start the Server

```shell
pnpm start:dev
```

### 6️⃣ Access the API

The server runs on http://localhost:3000 by default. Test endpoints using a tool like Postman or cURL.

### 🧪 Running Tests

- Run unit tests:
```shell
pnpm test:unit
```

- Run end-to-end tests:
```shell
pnpm test:e2e
```

- Check code coverage:
```shell
pnpm test:cov
```

## 🖥️ CLI Commands

The backend includes a command-line interface for administration and development tasks.

### Authentication

```shell
# Register the initial owner account
pnpm cli auth:register-owner

# Reset a user's password
pnpm cli auth:reset-password
```

### Device Simulator

The simulator plugin provides commands for creating and managing test devices:

```shell
# List available device categories
pnpm cli simulator:generate --list

# Generate devices interactively
pnpm cli simulator:generate

# Generate specific device types
pnpm cli simulator:generate --category lighting --name "Test Light"
pnpm cli simulator:generate --category thermostat --count 3
pnpm cli simulator:generate --category sensor --required-only

# List existing simulator devices
pnpm cli simulator:populate --list

# Populate devices with random values
pnpm cli simulator:populate --all                    # All devices
pnpm cli simulator:populate --device <device-id>    # Specific device
pnpm cli simulator:populate                         # Interactive selection
```

### OpenAPI Generation

```shell
# Generate OpenAPI specification from backend code
pnpm cli openapi:generate
```

## 👨‍💻 Contributing

Contributions are welcome! Please fork this repository and submit a pull request.

1. Fork the project
2. Create your feature branch (git checkout -b feature/AmazingFeature)
3. Commit your changes (git commit -m 'Add some AmazingFeature')
4. Push to the branch (git push origin feature/AmazingFeature)
5. Open a pull request

## 📜 License

This project is licensed under the **Apache License 2.0**. See the [LICENSE](../../LICENSE.md) file for details.

## 🌟 Acknowledgements

- Thanks to the NestJS community for their extensive documentation and support.
- Special shout-out to the contributors for their time and effort in making this backend service awesome.

## 👨‍💻 Maintainers

<table>
	<tbody>
		<tr>
			<td align="center">
				<a href="https://github.com/akadlec">
					<img alt="akadlec" width="80" height="80" src="https://avatars3.githubusercontent.com/u/1866672?s=460&amp;v=4" />
				</a>
				<br>
				<a href="https://github.com/akadlec">Adam Kadlec</a>
			</td>
		</tr>
	</tbody>
</table>

***
Homepage [https://smart-panel.fastybird.com](https://smart-panel.fastybird.com) and repository [https://github.com/fastybird/smart-panel](https://github.com/fastybird/smart-panel).
