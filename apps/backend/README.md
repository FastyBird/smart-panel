<p align="center">
	<img src="https://github.com/fastybird/.github/blob/main/assets/repo_title.png?raw=true" alt="FastyBird"/>
</p>

# 🚀 Smart Panel Backend

The **FastyBird Smart Panel Backend** is the core service powering the user interface layer of smart home platforms.

It is responsible for managing **dashboards, pages, tiles, and data sources**—delivering data in real-time and supporting seamless integration with smart home systems like Home Assistant, OpenHAB, and Sonoff.

---

## ✨ Key Features

- ✅ **Plugin-Based Architecture** – Easily extend with new tile types, data sources, or custom pages
- ✅ **Modular Design** – Cleanly separated `modules/` and `plugins/` to support scalable growth
- ✅ **Real-Time WebSocket Communication** – Instant updates for connected frontend apps
- ✅ **Flexible Page Layouts** – Support for tile-based, card-based, and detail-style views
- ✅ **Built-In Validation & Error Handling** – Strong type safety and detailed errors
- ✅ **Database Integration** – Works with relational databases via TypeORM

## 📂 Project Structure

```plaintext
src/
├── common/                  # Shared utilities, base classes, and helpers
│   ├── entities/            # Base entities and abstract classes
│   ├── dto/                 # Shared Data Transfer Objects (DTOs)
│   ├── filters/             # Custom exception filters
│   ├── interceptors/        # Global request/response interceptors
│   ├── guards/              # Authentication and authorization guards
│   ├── utils/               # Utility functions and helpers
│   └── validation/          # Custom validation rules and decorators
│
├── modules/                 # Modular feature-based structure
│   ├── auth/                # Authentication and authorization module
│   │   ├── controllers/     # API controllers for authentication
│   │   ├── dto/             # Data Transfer Objects
│   │   ├── entities/        # Database entities
│   │   ├── services/        # Business logic and authentication services
│   │   ├── guards/          # Auth guards for protecting routes
│   │   ├── strategies/      # Authentication strategies (JWT, OAuth, etc.)
│   │   └── auth.module.ts   # Module definition
│   │
│   ├── users/               # User management module
│   │   ├── controllers/
│   │   ├── dto/
│   │   ├── entities/
│   │   ├── services/
│   │   └── users.module.ts
│   │
│   ├── devices/             # Device management module
│   │   ├── controllers/
│   │   ├── dto/
│   │   ├── entities/
│   │   ├── services/
│   │   └── devices.module.ts
│   │
│   ├── dashboard/           # Dashboard module for UI representation
│   │   ├── controllers/
│   │   ├── dto/
│   │   ├── entities/
│   │   ├── services/
│   │   └── dashboard.module.ts
│   │
│   ├── websocket/           # WebSocket-based real-time communication
│   │   ├── gateway/
│   │   ├── events/
│   │   ├── services/
│   │   └── websocket.module.ts
│   │
│   └── <other-modules>/     # Additional modules for extendability
│       ├── controllers/
│       ├── dto/
│       ├── entities/
│       ├── services/
│       ├── events/
│       ├── utils/
│       └── <module-name>.module.ts
│
├── plugins/                 # Pluggable logic for tiles, pages, data sources
│
├── cli.ts                   # Command-line interface for administration
├── main.ts                  # Application entry point
```

💡 Each plugin or module may define its own entities, services, and OpenAPI schemas.

## 🛠️ Tech Stack

- 🚀 **Node.js** – Runtime environment
- 🔧 **NestJS** – Scalable backend framework
- 📦 **TypeORM** – Database ORM
- 🔍 **Jest** – Testing framework
- 🔗 **WebSockets** – Real-time communication

## 🚧 Prerequisites

Before starting, make sure you have the following installed:
- Node.js v20+
- PNPM v9+
- SQLite database

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

## 👨‍💻 Contributing

Contributions are welcome! Please fork this repository and submit a pull request.

1. Fork the project
2. Create your feature branch (git checkout -b feature/AmazingFeature)
3. Commit your changes (git commit -m 'Add some AmazingFeature')
4. Push to the branch (git push origin feature/AmazingFeature)
5. Open a pull request

## 📜 License

This project is licensed under the **Apache License 2.0**. See the [LICENSE](https://github.com/FastyBird/smart-panel/blob/main/LICENSE.md) file for details.

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
Homepage [https://www.fastybird.com](https://www.fastybird.com) and repository [https://github.com/fastybird/smart-panel](https://github.com/fastybird/smart-panel).
