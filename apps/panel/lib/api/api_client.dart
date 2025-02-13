// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint, unused_import

import 'package:dio/dio.dart';

import 'auth_module/auth_module_client.dart';
import 'users_module/users_module_client.dart';
import 'devices_module/devices_module_client.dart';
import 'dashboard_module/dashboard_module_client.dart';
import 'configuration_module/configuration_module_client.dart';
import 'system_module/system_module_client.dart';
import 'weather_module/weather_module_client.dart';

/// 🖥️ FastyBird Smart Panel API 🚀 `v1.0`.
///
/// The FastyBird Smart Panel API provides a local, real-time interface for retrieving device data, monitoring statuses, and integrating third-party IoT systems. It enables seamless communication between the smart panel and connected devices, ensuring fast, private, and reliable interactions without cloud dependencies.
///
/// Welcome to the **FastyBird Smart Panel API Documentation**! This API enables seamless integration between the **FastyBird Smart Panel** and connected devices, providing a local, real-time, and fully customizable **smart home experience**.
///
/// ---.
///
/// ## **🌟 What Does This API Provide?**.
///
/// The **FastyBird Smart Panel API** allows you to:.
///
/// - 🎛️ **Access Smart Devices** – Retrieve device information, configurations, and states.  .
/// - 📊 **Monitor Device Status in Real-Time** – Stream live updates from sensors and switches.  .
/// - 🔗 **Integrate with External Systems** – Connect third-party devices and services for a unified experience.  .
/// - 📡 **Subscribe to Events** – Use **WebSockets** to get instant updates on device changes.  .
/// - 🚀 **Control Locally** – No cloud dependency, everything runs on your own **local hardware**.  .
///
/// 💡 **Jump straight into the [API Reference](#explore-apis) for all available endpoints.**.
///
/// ---.
///
/// ## **🚀 Getting Started**.
///
/// > **💡 This API is designed for local control—no cloud required.**.
///
/// ### **1️⃣ Install the Smart Panel**.
/// Set up the **FastyBird Smart Panel** on your hardware.
///
/// ### **2️⃣ Connect Devices**.
/// Ensure compatible smart devices are available for the panel to manage.
///
/// ### **3️⃣ Start Using the API**.
/// Use REST or WebSockets to **query device states, receive updates, and integrate external systems**.
///
/// ---.
///
/// ## **🔎 API Overview**.
/// Explore the available API endpoints for integration:.
///
/// <!--.
/// type: tab.
/// title: Devices API.
/// -->.
///
/// 🔹 **Query smart devices and retrieve metadata.**  .
/// - [List all devices](#)  .
/// - [Get device details](#)  .
/// - [Check device availability](#)  .
/// - [API Reference](#)  .
///
/// <!--.
/// type: tab.
/// title: Status & Monitoring API.
/// -->.
///
/// 🔹 **Retrieve sensor readings and real-time device states.**  .
/// - [Get temperature sensor data](#)  .
/// - [Monitor smart switch states](#)  .
/// - [Track energy consumption](#)  .
/// - [API Reference](#)  .
///
/// <!--.
/// type: tab.
/// title: WebSocket API.
/// -->.
///
/// 🔹 **Subscribe to live updates for devices & events.**  .
/// - [Receive real-time device status changes](#)  .
/// - [Subscribe to WebSocket event streams](#)  .
/// - [API Reference](#)  .
///
/// <!-- type: tab-end -->.
///
/// ---.
///
/// ## **📚 API Usage Guides**.
/// Detailed documentation to help developers integrate the API:.
///
/// 🔹 **[Understanding Device States](#)** – Learn how to interpret API responses.  .
/// 🔹 **[Using WebSockets for Real-Time Monitoring](#)** – Get instant updates from the panel.  .
/// 🔹 **[Integrating Third-Party Devices](#)** – Extend your setup with custom integrations.  .
///
/// 💡 **Need something specific?** Let us know how we can improve the documentation.
///
/// ---.
///
/// ## **💡 FAQs**.
/// > **🔍 Common API-related questions:**.
///
/// **Does this API require the cloud?**  .
/// No, everything runs **locally** on your **own hardware**.
///
/// **How do I authenticate API requests?**  .
/// Use **API tokens** for secure access. See [Authentication Guide](#).
///
/// **Can I get real-time updates from the panel?**  .
/// Yes! The **WebSocket API** provides instant status updates.
///
/// **Does the API support third-party integrations?**  .
/// Yes, you can connect external IoT systems via API endpoints.
///
/// ---.
///
/// ## **💬 Need Help?**.
/// 💌 **[Join our Developer Community](#)** – Discuss API integrations with others.  .
/// 📧 **[Contact Support](#)** – Reach out for technical assistance.  .
///
/// ---.
///
/// 🔥 **Built with ❤️ by FastyBird** | API-first smart panel integration 🚀.
class ApiClient {
  ApiClient(
    Dio dio, {
    String? baseUrl,
  })  : _dio = dio,
        _baseUrl = baseUrl;

  final Dio _dio;
  final String? _baseUrl;

  static String get version => '1.0';

  AuthModuleClient? _authModule;
  UsersModuleClient? _usersModule;
  DevicesModuleClient? _devicesModule;
  DashboardModuleClient? _dashboardModule;
  ConfigurationModuleClient? _configurationModule;
  SystemModuleClient? _systemModule;
  WeatherModuleClient? _weatherModule;

  AuthModuleClient get authModule => _authModule ??= AuthModuleClient(_dio, baseUrl: _baseUrl);

  UsersModuleClient get usersModule => _usersModule ??= UsersModuleClient(_dio, baseUrl: _baseUrl);

  DevicesModuleClient get devicesModule => _devicesModule ??= DevicesModuleClient(_dio, baseUrl: _baseUrl);

  DashboardModuleClient get dashboardModule => _dashboardModule ??= DashboardModuleClient(_dio, baseUrl: _baseUrl);

  ConfigurationModuleClient get configurationModule => _configurationModule ??= ConfigurationModuleClient(_dio, baseUrl: _baseUrl);

  SystemModuleClient get systemModule => _systemModule ??= SystemModuleClient(_dio, baseUrl: _baseUrl);

  WeatherModuleClient get weatherModule => _weatherModule ??= WeatherModuleClient(_dio, baseUrl: _baseUrl);
}
