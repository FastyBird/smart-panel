<p align="center">
	<img src="https://github.com/fastybird/.github/blob/main/assets/repo_title.png?raw=true" alt="FastyBird"/>
</p>

# 📦 FastyBird Smart Panel - Applications

Welcome to the `apps/` directory of the **FastyBird Smart Panel**.

This folder contains the main applications that make up the **FastyBird Smart Panel** ecosystem.

Each app serves a distinct purpose, built to run on different platforms for managing and displaying smart home data.

---

## 📂 Overview

| Folder     | Description                                                                 |
|------------|-----------------------------------------------------------------------------|
| `backend/` | 🧠 The core backend built with **NestJS**, handling plugins, APIs & storage |
| `admin/`   | 🛠️ A **Vue.js**-powered web app for managing pages, tiles & data sources     |
| `panel/`   | 📱 A **Flutter** app designed for embedded screens (e.g., Raspberry Pi)      |

Each of these apps contains:

- `modules/`: Core functionality (e.g., dashboards, devices, users)
- `plugins/`: Feature extensions that define new pages, tiles, or data source types specific to the app

---

## 🧭 Project Structure

Each application is **self-contained**, with its own dependencies and architecture.  
They communicate via internal APIs and plugins defined in the [`plugins/`](../plugins/) folder, and are part of the larger monorepo.

- ✅ **Modular**: Each app can be developed or deployed independently
- 🔌 **Extensible**: Plugins define how pages, tiles, and data sources behave across all apps
- 🔄 **Synced**: Changes made in the Admin Panel are reflected in the Display App via real-time updates

---

## 🧩 Plugin Ecosystem

The power of the Smart Panel comes from its **plugin system**, which lets you define:
- Custom pages (like grid layouts or device detail views)
- Interactive tiles (showing clocks, weather, sensors, etc.)
- Data source types (such as device channels, third-party APIs, etc.)

Each application supports plugins differently:
- `backend/`: Loads and registers plugin logic (schemas, DTOs, services)
- `admin/`: Dynamically renders plugin forms, detail pages, and input widgets
- `panel/`: Displays plugin-rendered content in real-time on-screen

---

## 🔄 How Everything Connects

- The **backend** exposes APIs and loads plugin logic (schemas, services, DTOs)
- The **admin** uses those APIs and renders plugin-defined forms and configuration views
- The **panel** consumes the output and renders it via plugin-defined visual components

This way, each app remains lean and specialized — but plugins define the shared language of what a **tile**, **page**, or **data source** means across the stack.

---

## 💡 Development Notes

- Run `pnpm install` from the root to link all dependencies
- Use per-app `README.md` files for details on dev & build commands

---

## 📚 Learn More

- [Application README](../README.md) – Project overview, features, and motivation
- Developer documentation is currently being prepared and will be available soon.

***
Homepage [https://smart-panel.fastybird.com](https://smart-panel.fastybird.com) and repository [https://github.com/fastybird/smart-panel](https://github.com/fastybird/smart-panel).
