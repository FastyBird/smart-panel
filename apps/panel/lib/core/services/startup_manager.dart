import 'dart:io';

import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/navigation.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/modules/config/module.dart';
import 'package:fastybird_smart_panel/modules/dashboard/module.dart';
import 'package:fastybird_smart_panel/modules/devices/module.dart';
import 'package:fastybird_smart_panel/modules/system/module.dart';
import 'package:fastybird_smart_panel/modules/weather/module.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class StartupManagerService {
  static const String _apiSecretKey = 'api_secret';

  final double screenWidth;
  final double screenHeight;
  final double pixelRatio;

  late String? _apiSecret;
  late ApiClient _apiClient;
  late Dio _apiIoService;

  late SocketService _socketClient;

  late FlutterSecureStorage _securedStorage;

  StartupManagerService({
    required this.screenWidth,
    required this.screenHeight,
    required this.pixelRatio,
  }) {
    _securedStorage = const FlutterSecureStorage();

    _apiIoService = Dio(
      BaseOptions(
        baseUrl:
            '${Platform.environment['APP_HOST'] ?? 'http://10.0.2.2'}:${Platform.environment['BACKEND_PORT'] ?? '3000'}/api/v1',
        contentType: 'application/json',
      ),
    );

    _apiClient = ApiClient(_apiIoService);

    _socketClient = SocketService();

    var configModuleService = ConfigModuleService(
      apiClient: _apiClient,
      socketService: _socketClient,
    );
    var systemModuleService = SystemModuleService(
      apiClient: _apiClient,
      socketService: _socketClient,
    );
    var weatherModuleService = WeatherModuleService(
      apiClient: _apiClient,
      socketService: _socketClient,
    );
    var devicesModuleService = DevicesModuleService(
      apiClient: _apiClient,
      socketService: _socketClient,
    );
    var dashboardModuleService = DashboardModuleService(
      apiClient: _apiClient,
      socketService: _socketClient,
    );

    // Register core services
    locator.registerLazySingleton(
      () => NavigationService(),
    );
    locator.registerLazySingleton(
      () => ScreenService(
        screenWidth: screenWidth,
        screenHeight: screenHeight,
        pixelRatio: pixelRatio,
      ),
    );
    locator.registerSingleton(_securedStorage);

    // Register modules
    locator.registerSingleton(configModuleService);
    locator.registerSingleton(systemModuleService);
    locator.registerSingleton(weatherModuleService);
    locator.registerSingleton(devicesModuleService);
    locator.registerSingleton(dashboardModuleService);

    // Api client
    locator.registerSingleton(_apiIoService);
    locator.registerSingleton(_apiClient);

    // Sockets client
    locator.registerSingleton(_socketClient);
  }

  Future<void> initialize() async {
    _apiSecret = await _securedStorage.read(key: _apiSecretKey);

    if (_apiSecret != null) {
      _apiIoService.options.headers['X-Display-Secret'] = _apiSecret;
    }

    try {
      await _initialize();
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[BACKEND INIT] Backend initialization failed: $e');
      }

      throw StateError(
        'Backend initialization failed. Ensure the server is running.',
      );
    }

    try {
      await Future.wait([
        locator.get<ConfigModuleService>().initialize(),
        locator.get<SystemModuleService>().initialize(),
        locator.get<WeatherModuleService>().initialize(),
        locator.get<DevicesModuleService>().initialize(),
        locator.get<DashboardModuleService>().initialize(),
      ]);
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[REPOS INIT] Data storage initialization failed: $e');
      }

      throw ArgumentError(
        'Data storage initialization failed. Ensure the server is running.',
      );
    }

    String? apiSecret = _apiSecret;

    if (apiSecret != null) {
      _socketClient.initialize(apiSecret);
    }
  }

  Future<void> _initialize() async {
    if (_apiSecret == null) {
      await _obtainApiSecret();
    } else {
      await _checkApiConnection();
    }
  }

  Future<void> _obtainApiSecret() async {
    try {
      var registerResponse = await _apiClient.authModule
          .createAuthModuleRegisterDisplay(userAgent: 'FlutterApp');

      String apiSecret = registerResponse.data.data.secret;

      // Store API secret key
      await _securedStorage.write(
        key: _apiSecretKey,
        value: apiSecret,
      );

      // Update API secret key in the API client
      _apiIoService.options.headers['X-Display-Secret'] = apiSecret;
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[OBTAIN SECRET] API error: ${e.response?.statusCode} - ${e.message}',
        );
      }

      if (e.response?.statusCode == 403) {
        throw StateError(
          'Application reset is required. Please reset the app.',
        );
      }

      throw Exception(
        'Backend initialization failed. Ensure the server is running.',
      );
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[OBTAIN SECRET] Unexpected error: ${e.toString()}');
      }

      throw StateError('Unexpected backend error.');
    }
  }

  Future<void> _checkApiConnection() async {
    try {
      // Try to fetch the display profile
      await _apiClient.authModule.getAuthModuleProfile();
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[CHECK SECRET] API Error: ${e.response?.statusCode} - ${e.message}',
        );
      }

      if (e.response?.statusCode == 401 || e.response?.statusCode == 403) {
        if (kDebugMode) {
          debugPrint('[CHECK SECRET] Stored secret key is not valid');
        }

        _securedStorage.delete(key: _apiSecretKey);
        _apiSecret = null;

        await _initialize();
      } else {
        throw Exception(
          'Backend connection check failed. Ensure the server is running.',
        );
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[CHECK SECRET] Unexpected error: ${e.toString()}');
      }

      throw StateError('Unexpected backend error.');
    }
  }
}
