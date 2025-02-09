<p align="center">
	<img src="https://github.com/fastybird/.github/blob/main/assets/repo_title.png?raw=true" alt="FastyBird"/>
</p>

# 🚀 Smart Panel Backend

The **Smart Panel Backend** is the powerhouse behind the **FastyBird Smart Panel**, ensuring smooth communication between devices and the user interface.

Built on **NestJS**, **TypeORM**, and modern technologies, it delivers a **scalable**, **real-time**, and **developer-friendly** experience.

## ✨ Features

✔ **Device Management** – Control devices, channels, properties, and automation.
✔ **Real-time Updates** – Instant state changes via WebSockets.
✔ **Dashboard & UI** – Organize information with **pages, cards, and tiles**.
✔ **Weather & System Info** – Display **current weather, forecasts, and device stats**.
✔ **Robust Validation & Error Handling** – Ensures reliability and security.
✔ **Database Integration** – Supports SQL databases via TypeORM.
✔ **Modular Architecture** – Scalable and maintainable design.

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
│   ├── <other-modules>/     # Additional modules for extendability
│   │   ├── controllers/
│   │   ├── dto/
│   │   ├── entities/
│   │   ├── services/
│   │   ├── events/
│   │   ├── utils/
│   │   └── <module-name>.module.ts
│
├── cli.ts                # Command-line interface for administration
├── main.ts               # Application entry point
```

## 🛠️ Tech Stack

- 🚀 **Node.js** – Runtime environment
- 🔧 **NestJS** – Scalable backend framework
- 📦 **TypeORM** – Database ORM
- 🔍 **Jest** – Testing framework
- 🔗 **WebSockets** – Real-time communication

## 🚧 Prerequisites

Before starting, make sure you have the following installed:
- Node.js v20+
- Yarn v1.22+
- SQLite database

## 🚀 Getting Started

### 1. Clone the Repository

```shell
git clone https://github.com/fastybird/smart-panel.git
cd apps/backend
```
### 2. Install Dependencies

```shell
yarn install
```

### 3. Set Up Environment Variables

Create a .env file in the root directory and configure the following variables:

```shell
DATABASE_URL=your-database-url
NODE_ENV=development
```

### 4. Run Migrations

```shell
yarn typeorm:migration:run
```

### 5. Start the Server

```shell
yarn start:dev
```

### 6. Access the API

The server runs on http://localhost:3000 by default. Test endpoints using a tool like Postman or cURL.

### 🧪 Running Tests

- Run unit tests:
```shell
yarn test:unit
```

- Run end-to-end tests:
```shell
yarn test:e2e
```

- Check code coverage:
```shell
yarn test:cov
```

## 👨‍💻 Contributing

Contributions are welcome! Please fork this repository and submit a pull request.

1. Fork the project
2. Create your feature branch (git checkout -b feature/AmazingFeature)
3. Commit your changes (git commit -m 'Add some AmazingFeature')
4. Push to the branch (git push origin feature/AmazingFeature)
5. Open a pull request

📄 License

This project is licensed under the MIT License. See the LICENSE file for details.

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
Homepage [https://smart-panel.fastybird.com](https://smart-panel.fastybird.com) and
repository [https://github.com/fastybird/smart-panel](https://github.com/fastybird/smart-panel).
