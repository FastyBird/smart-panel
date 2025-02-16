<p align="center">
  <img src="https://github.com/fastybird/.github/blob/main/assets/repo_title.png?raw=true" alt="FastyBird"/>
</p>

# 📱 Smart Panel Display

The **Smart Panel Display App** is the **interactive interface** of the **FastyBird Smart Panel**, providing seamless
control and monitoring of smart home devices.

Built with **Flutter**, it offers a **modern**, **customizable**, and **real-time** experience on dedicated touchscreens.

---

## ✨ Features

- ✔ **Beautiful UI** – Clean, intuitive, and optimized for **touchscreens**
- ✔ **Device Control** – Toggle lights, adjust temperatures, and monitor sensors
- ✔ **Real-time Updates** – WebSocket integration for instant feedback
- ✔ **Weather Forecast** – OpenWeather API integration for daily forecasts
- ✔ **Multi-Screen Support** – Manage multiple dashboards efficiently
- ✔ **Customizable Widgets** – Resize, rearrange, and personalize widgets  

---

## 📂 Project Structure

```plaintext
lib/
├── app/                   # Core application entry point
├── api/                   # API clients and generated models
├── core/                  # Core utilities, services, and models
│   ├── repositories/      # Data repositories for configuration & devices
│   ├── services/          # Global services (networking, storage, etc.)
│   ├── utils/             # Helper functions (date, formatting, etc.)
│   ├── widgets/           # Reusable UI components (cards, tiles, etc.)
│
├── features/              # Feature-based structure
│   ├── dashboard/         # Dashboard UI and widgets
│   ├── overlay/           # Overlay screens
│   ├── settings/          # Application settings screens
│
├── main.dart              # App entry point
└── i10n/                  # Auto-generated localization files
```

## 🛠️ Tech Stack

- 🖥️ Flutter – Cross-platform UI framework
- 🛰️ WebSockets – Real-time communication with the backend
- 📡 OpenWeather API – Weather forecasting
- 🔗 Dio – Network requests and API communication
- 📦 Provider – State management

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

### 3️⃣ Run the App (Development Mode)

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

This project is licensed under the **Apache License 2.0**. See the [LICENSE](https://github.com/FastyBird/smart-panel/blob/main/LICENSE.md) file for details.

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
Homepage [https://smart-panel.fastybird.com](https://smart-panel.fastybird.com) and
repository [https://github.com/fastybird/smart-panel](https://github.com/fastybird/smart-panel).
