<p align="center">
	<img src="https://github.com/fastybird/.github/blob/main/assets/repo_title.png?raw=true" alt="FastyBird"/>
</p>

# 🚀 Smart Panel Admin

The **Smart Panel Admin** is the frontend interface for managing the **FastyBird Smart Panel**. It provides an intuitive **dashboard**, **device management**, **real-time monitoring**, and a **customizable UI**.

Built with **Vue 3**, **Vite**, and **Element Plus**, it delivers a **fast**, **scalable**, and **developer-friendly** experience.

## ✨ Features

- ✔ **Device & User Management** – Add, edit, and remove users and devices.
- ✔ **Real-time Data** – WebSocket-based updates for instant changes.
- ✔ **Dashboard UI** – Customize pages, cards, and tiles for efficient control.
- ✔ **Responsive Design** – Optimized for mobile, tablet, and desktop.
- ✔ **Authentication & Authorization** – Secure access to features.
- ✔ **REST & WebSocket API** – Seamless backend communication.
- ✔ **Optimized Performance** – Built with Vite for blazing-fast builds.

## 📂 Project Structure

```plaintext
src/
├── assets/            # Static files (images, icons, etc.)
├── common/            # Shared utilities and helpers
│   ├── components/    # Reusable UI components
│   ├── composables/   # Vue 3 composables (hooks)
│   ├── services/      # Application services
│   └── utils/         # Helper functions
│
├── layouts/           # Page layouts
├── locales/           # Internationalization files
│
├── modules/           # Feature-based modules
│   ├── auth-module/   # Authentication logic
│   └── users-module/  # User management
│
└── views/             # Main application views
    ├── app.constants.ts # Constants for app-wide configuration
    ├── app.main.ts      # Main entry file
    ├── app.main.vue     # Root Vue component
    ├── app.types.ts     # TypeScript type definitions
    └── openapi.ts       # OpenAPI-generated API client
```

## 🛠️ Tech Stack

- 🚀 **Vue 3** – Progressive JavaScript framework
- ⚡ **Vite** – Lightning-fast build tool
- 🎨 **Element Plus** – Elegant UI component library
- 🌍 **Vue Router** – Client-side routing
- 📦 **Pinia** – State management
- 🔗 **Socket.IO** – Real-time communication

## 🚧 Prerequisites

Before starting, ensure you have:

- Node.js v20+
- PNPM v9+
- Backend API running (FastyBird Smart Panel Backend)

## 🚀 Getting Started

### 1️⃣ Clone the Repository

```shell
git clone https://github.com/fastybird/smart-panel.git
cd apps/admin
```

### 2️⃣ Install Dependencies

```shell
pnpm install
```

### 3️⃣ Start the Development Server

```shell
pnpm dev
```

### 4️⃣ Open the Admin Panel

The app runs on [http://localhost:3003](http://localhost:3003) by default.

### 🏗️ Build for Production

```shell
pnpm build
```

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
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a pull request

## 📜 License

This project is licensed under the **Apache License 2.0**. See the [LICENSE](https://github.com/FastyBird/smart-panel/blob/main/LICENSE.md) file for details.

## 🌟 Acknowledgements

- Thanks to the Vue.js community for their extensive documentation and support.
- Special thanks to contributors who make this project better.

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
