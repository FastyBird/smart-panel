<p align="center">
  <img src="https://github.com/fastybird/.github/blob/main/assets/repo_title.png?raw=true" alt="FastyBird"/>
</p>

<h1 align="center">🧠 FastyBird Smart Panel</h1>

<p align="center">A smart touchscreen interface for your smart home.</p>

**FastyBird Smart Panel** is a modular and extensible **user interface platform** designed to bring your smart home system to life on touchscreen displays.  

It provides a seamless way to interact with your home setup, acting as a **real-time control dashboard** for systems like Home Assistant, OpenHAB, Sonoff, and more.

---

## 🎯 What FastyBird Smart Panel Offers

### ✨ **Elegant, User-Centric UI**

Create dynamic dashboards with customizable tiles, icons, and layouts — all optimized for embedded screens and modern devices.

### 🧩 **Modular Architecture**  
Each feature — from tiles to data sources — is handled by independent plugins. This makes the platform easy to extend and tailor to any smart home setup.

### ⚙️ **Built for Integration**  
FastyBird Smart Panel is designed to connect with your existing smart home backend. It fetches data, executes commands, and displays device status in real-time.

### 🖥️ **Touch-Optimized Display App**  
Crafted with **Flutter**, the display app runs smoothly on Raspberry Pi and other embedded Linux devices with small screens (e.g., 4" or 7").

---

## 🧰 System Components

### 🧠 **Smart Panel Backend**
 
- Built with **NestJS & TypeORM**
- Manages data sources, pages, tiles, and configuration
- Plugin-based architecture for easy integration of device types and UI components

### 🧑‍💼 **Admin Panel**

- Built with **Vue 3 + Pinia + Element Plus**
- Used for creating pages, configuring dashboard layout, and managing tiles & data sources
- Fully responsive and works in any modern browser

### 📱 **Touchscreen Display App**

- Built in **Flutter** for smooth animations and real-time updates
- Deploy on Raspberry Pi or any embedded Linux device with a screen
- Shows your configured pages with support for multiple tile types (weather, devices, clocks, etc.)

---

## 📦 Features at a Glance

- 📐 **Configurable Grid Layouts**
- 🧱 **Customizable Tiles** (clocks, weather, device previews, and more)
- 🔌 **Plugin Support** for extensibility (data sources, pages, tiles)
- 🔄 **Real-Time Updates** via WebSockets
- 🌐 **API-first Design** for easy third-party integration

---

## 📖 Documentation & Resources

- 🌍 [Project Website](https://smart-panel.fastybird.com)
- 📚 [User Documentation](https://smart-panel.fastybird.com/docs)
- 💻 Developer documentation is currently a work in progress and will be available soon.
- 🐛 [Issue Tracker](https://github.com/FastyBird/smart-panel/issues)

---

## ❤️ Designed for Makers & Integrators

Whether you're building a custom dashboard for your smart home setup, integrating device states into a centralized view, or simply want a beautiful touchscreen controller — **FastyBird Smart Panel is your canvas**.

> **Ready to build your control center? Start with FastyBird.**

***
Homepage [https://smart-panel.fastybird.com](https://smart-panel.fastybird.com) and repository [https://github.com/fastybird/smart-panel](https://github.com/fastybird/smart-panel).
