<p align="center">
  <img src="https://github.com/fastybird/.github/blob/main/assets/repo_title.png?raw=true" alt="FastyBird"/>
</p>

# 📱 Smart Panel Display

The **Smart Panel Display App** is the **touchscreen interface** of your smart home dashboard.  

It’s designed to run on embedded devices (like Raspberry Pi), giving users a **beautiful, real-time view** of their smart devices, tiles, and automations.

Built with **Flutter**, it’s optimized for **performance**, **simplicity**, and **customization**.

---

## ✨ Key Features

- 🖥️ **Touch-Optimized UI** – Built for embedded displays and full-screen kiosks
- 📊 **Custom Dashboards** – Renders pages, tiles, and data in a compact, visual layout
- 🔁 **Real-Time Updates** – WebSocket integration ensures instant sync with the backend
- 🌤️ **Weather Forecast** – Integrates with OpenWeather for local conditions
- 🧩 **Dynamic Tiles** – Modular tile system powered by backend plugins
- 🧠 **Smart Display Logic** – Automatically refreshes content when data changes
- 🤖 **AI Assistant** – Integrated Buddy AI assistant for voice and text interaction

---

## Project Structure

```plaintext
lib/
├── app/                   # Core application entry point and main widget
├── api/                   # Generated API clients (DO NOT EDIT)
├── spec/                  # Generated device/channel specs (DO NOT EDIT)
├── core/                  # Core utilities, services, and models
│   ├── interceptors/      # HTTP interceptors
│   ├── models/            # Core data models
│   ├── services/          # Global services (networking, storage, etc.)
│   ├── types/             # Type definitions
│   ├── utils/             # Helper functions (date, formatting, etc.)
│   └── widgets/           # Reusable UI components (cards, tiles, etc.)
│
├── features/              # Feature-based screens
│   ├── deck/              # Deck navigation feature
│   ├── discovery/         # Device discovery feature
│   ├── overlay/           # Overlay screens
│   └── settings/          # Application settings screens
│
├── modules/               # Feature modules
│   ├── buddy/             # AI assistant integration
│   ├── config/            # Configuration management
│   ├── dashboard/         # Dashboard data and UI
│   ├── deck/              # Spaces + Deck navigation system
│   ├── devices/           # Device management and control
│   ├── displays/          # Display registration
│   ├── energy/            # Energy tracking and display
│   ├── intents/           # Intent execution
│   ├── scenes/            # Scene control
│   ├── security/          # Security and alerts
│   ├── spaces/            # Space (room/zone) management
│   ├── system/            # System info
│   └── weather/           # Weather display
│
├── plugins/               # Plugin implementations
│   ├── devices-*/         # Device integration plugins
│   ├── pages-*/           # Page type renderers
│   ├── tiles-*/           # Tile type renderers
│   ├── data-sources-*/    # Data source plugins
│   └── scenes-local/      # Local scene plugin
│
├── l10n/                  # Localization files
└── main.dart              # App entry point
```

## 🛠️ Tech Stack

- 🖥️ Flutter – Cross-platform UI framework
- 🌐 WebSockets – Real-time backend communication
- 📦 Provider – State management
- 🛰️ Dio – API requests
- 🌦️ OpenWeather – Weather integration
- 🧪 Flutter Test – Unit testing framework

## 🚀 Getting Started

### 1️⃣ Clone the Repository

```shell
git clone https://github.com/fastybird/smart-panel.git
cd apps/panel
```

### 2️⃣ Install Dependencies

```shell
flutter pub get
```

### 3️⃣ Build generated code

```shell
dart run swagger_parser && dart run build_runner build
```

### 4️⃣ Run the App (Development Mode)

```shell
flutter run
```

## 📦 Building for Raspberry Pi (flutter-pi)

If deploying to **Raspberry Pi** using flutter-pi, build with:

```shell
flutter build bundle
```

Then run on the Pi:

```shell
flutter-pi --release /path/to/flutter_assets
```

### 🧪 Running Tests

Run unit tests:

```shell
flutter test
```

Analyze code quality:

```shell
dart analyze .
```

## 📡 Raspberry Pi Deployment

### 1️⃣ Build the app

```shell
flutter build bundle
```

### 2️⃣ Transfer the app to your Pi

```shell
scp -r build/flutter_assets pi@raspberrypi:/home/pi/
```

### 3️⃣ Run on Raspberry Pi

```shell
flutter-pi /home/pi/flutter_assets
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

- Thanks to the Flutter community for their extensive documentation and support.
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
