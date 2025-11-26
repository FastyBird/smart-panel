Welcome to the **FastyBird Smart Panel API Documentation**!

This API is the central interface for integrating with the **FastyBird Smart Panel**, a modern, modular, and open-source platform for managing smart home devices and dashboards — all running on **your local hardware**, with no cloud dependency.

---

## 🌟 What Can This API Do?

The **FastyBird Smart Panel API** provides:

- 🎛️ **Full Access to Smart Devices**  
  Manage devices, channels, and properties — read current values or send commands.

- 📊 **Real-Time Monitoring & Sync**  
  Receive live updates from sensors, switches, and more through WebSocket connections.

- 🔌 **Third-Party Integration Support**  
  Easily connect external systems using standard API calls to sync data and trigger actions.

- 🧱 **Dashboard Customization**  
  Build or modify dashboard layouts, pages, tiles, and data sources dynamically via API.

- 🚀 **Local-First Control**  
  The entire stack is designed to run offline on your own network — secure, private, and fast.

---

## 🚀 Getting Started

> ����️ **No cloud required. Everything runs locally.**

### 1. Install the Smart Panel  
Deploy the platform to a supported device like a Raspberry Pi or ReTerminal.

### 2. Connect & Configure Devices  
Add devices via the Admin App or API, either manually or through plugin integrations.

### 3. Interact via REST or WebSocket  
Use the API to read states, send commands, and subscribe to real-time updates.

---

## 🔎 API Modules Overview

### Devices API  
Manage devices and their structure:  
- Retrieve device/channel/property metadata  
- Send control commands  
- Sync state updates  

### Dashboard API  
Configure your Smart Panel UI:  
- Build pages and tiles  
- Add data sources  
- Organize device widgets  

---

## 📚 API Usage Examples

Use this API to:

- 💡 Read a temperature sensor value  
- 🔘 Toggle a light switch  
- 🧩 Display custom widgets  
- 🔄 Sync external device state  
- 📱 Integrate with your own mobile or desktop app  

---

## 🔐 Authentication

Use token-based access when integrating external apps or third-party devices.  
See the [Authentication Guide](#) for details.

---

## 💬 Frequently Asked

**Is the API cloud-based?**  
No — it runs entirely on your own hardware.

**Do I need to be online?**  
No — the API is designed for offline-first use.

**Can I control third-party devices?**  
Yes — use plugin-based extensions or the generic third-party interface.

**Does the Smart Panel support real-time updates?**  
Yes — WebSocket support is built-in.

---

## 🤝 Need Help?

- 💬 [Join the FastyBird Community](https://discord.gg/H7pHN3hbqq)  
- 🛠️ [Explore the Docs](https://smart-panel.fastybird.com/docs)  
- 📨 [Report an issue](https://github.com/fastybird/smart-panel/issues)

---

🚀 **Built with ❤️ by FastyBird** — Local-first, modular smart home integration.