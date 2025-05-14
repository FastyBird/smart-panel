<p align="center">
	<img src="https://github.com/fastybird/.github/blob/main/assets/repo_title.png?raw=true" alt="FastyBird"/>
</p>

# 🚀 Smart Panel Admin

The **Smart Panel Admin** is a web-based interface for configuring the **FastyBird Smart Panel**.

It lets you **design dashboards**, manage **tiles, data sources, and pages**, and connect with various **smart home systems** like Home Assistant, OpenHAB, and Sonoff.

---

## ✨ Features

- 🧩 **Plugin Support** – Extend UI with custom page, tile, or data source plugins
- 🧱 **Dashboard Configuration** – Manage layouts using pages, cards, tiles, and more
- ⚙️ **Device Integration** – Seamless control of devices, channels, and properties
- 🔁 **Real-Time Updates** – Powered by WebSockets for instant feedback
- 📱 **Responsive UI** – Built for desktops and tablets with adaptive layout
- 🔐 **Authentication Support** – Secure access and user role control
- 🌍 **Internationalization** – Ready for multi-language setups

---

## 📂 Project Structure

```plaintext
src/
├── assets/               # Static files (images, icons, etc.)
├── common/               # Shared utilities and helpers
│   ├── components/       # Reusable UI components
│   ├── composables/      # Vue 3 composables (hooks)
│   ├── services/         # Application services
│   └── utils/            # Helper functions
│
├── layouts/              # Page layouts
├── locales/              # Internationalization files
│
├── modules/              # Feature-based modules
│   ├── auth/             # Authentication logic
│   ├── dashboard/        # Authentication logic
│   ├── devices/          # Authentication logic
│   ├── users/            # User management
│   └── <other-modules>/  # User management
│
├── plugins/              # Optional plugin extensions (tiles, pages, etc.)
│   ├── pages-tiles/      #
│   └── <other-plugins>/  #
│
├── views/                # Main application views
│
├── app.constants.ts      # Constants for app-wide configuration
├── app.main.ts           # Main entry file
├── app.main.vue          # Root Vue component
├── app.types.ts          # TypeScript type definitions
└── openapi.ts            # OpenAPI-generated API client
```

💡 Each plugin can define its own forms, UI logic, and schemas to seamlessly integrate with the Admin Panel.

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

### 3️⃣ Build generated code

```shell
pnpm generate:openapi
```

### 4️⃣ Start the Development Server

```shell
pnpm dev
```

### 5️⃣ Open the Admin Panel

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
Homepage [https://www.fastybird.com](https://www.fastybird.com) and repository [https://github.com/fastybird/smart-panel](https://github.com/fastybird/smart-panel).
