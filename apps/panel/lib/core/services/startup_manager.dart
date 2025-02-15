import 'dart:io';

import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/repositories/configuration.dart';
import 'package:fastybird_smart_panel/core/repositories/weather.dart';
import 'package:fastybird_smart_panel/core/services/navigation.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/features/dashboard/repositories/data/devices/devices.dart';
import 'package:fastybird_smart_panel/features/dashboard/repositories/data/scenes/scenes.dart';
import 'package:fastybird_smart_panel/features/dashboard/repositories/ui/pages.dart';
import 'package:fastybird_smart_panel/features/dashboard/repositories/ui/tiles.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class StartupManagerService {
  static const String _apiSecretKey = 'api_secret';

  final double screenWidth;
  final double screenHeight;
  final double pixelRatio;

  StartupManagerService({
    required this.screenWidth,
    required this.screenHeight,
    required this.pixelRatio,
  });

  Future<void> initialize() async {
    await locator.reset();

    var securedStorage = const FlutterSecureStorage();

    // securedStorage.delete(key: _apiSecretKey);
    var apiSecret = await securedStorage.read(key: _apiSecretKey);

    var apiIoService = Dio(
      BaseOptions(
        baseUrl:
            '${Platform.environment['APP_HOST'] ?? 'http://10.0.2.2'}:${Platform.environment['BACKEND_PORT'] ?? '3000'}/api/v1',
        headers: {
          'X-Display-Secret': apiSecret,
        },
        contentType: 'application/json',
      ),
    );

    var apiClient = ApiClient(apiIoService);

    var configurationRepository = ConfigurationRepository(
      apiClient: apiClient.configurationModule,
    );
    var weatherRepository = WeatherRepository(
      apiClient: apiClient.weatherModule,
    );
    var screensRepository = PagesRepository();
    var tilesRepository = TilesRepository();
    var tilesDataRepository = TilesDataRepository();
    var scenesRepository = ScenesDataRepository();
    var devicesRepository = DevicesDataRepository();

    // Register services
    locator.registerLazySingleton(() => NavigationService());
    locator.registerLazySingleton(
      () => ScreenService(
        screenWidth: screenWidth,
        screenHeight: screenHeight,
        pixelRatio: pixelRatio,
      ),
    );

    locator.registerSingleton(securedStorage);

    // Register repositories
    locator.registerSingleton(configurationRepository);
    locator.registerSingleton(weatherRepository);
    locator.registerSingleton(screensRepository);
    locator.registerSingleton(tilesRepository);
    locator.registerSingleton(tilesDataRepository);
    locator.registerSingleton(scenesRepository);
    locator.registerSingleton(devicesRepository);

    // Api client
    locator.registerSingleton(apiIoService);
    locator.registerSingleton(apiClient);

    if (apiSecret == null) {
      try {
        var registerResponse = await apiClient.authModule
            .createAuthModuleRegisterDisplay(userAgent: 'FlutterApp');

        await securedStorage.write(
          key: _apiSecretKey,
          value: registerResponse.data.data.secret,
        );

        // Update secret key
        apiIoService.options.headers['X-Display-Secret'] =
            registerResponse.data.data.secret;

        debugPrint(registerResponse.data.data.secret);
      } on DioException catch (e) {
        if (e.response?.statusCode == 403) {
          throw Exception('Application have to be reset');
        } else {
          throw Exception('Backend initialization failed');
        }
      } catch (e) {
        debugPrint(e.toString());

        throw Exception('Backend initialization failed');
      }
    } else {
      try {
        // Try to fetch the display profile
        await apiClient.authModule.getAuthModuleProfile();
      } on DioException catch (e) {
        if (e.response?.statusCode == 403) {
          debugPrint('Stored secret key is not valid');

          securedStorage.delete(key: _apiSecretKey);
        } else {
          throw Exception('Backend initialization failed');
        }
      } catch (e) {
        debugPrint(e.toString());

        throw Exception('Backend initialization failed');
      }
    }

    try {
      await Future.wait([
        configurationRepository.initialize(),
        weatherRepository.initialize(),
        screensRepository.initialize(),
        tilesRepository.initialize(),
        tilesDataRepository.initialize(),
        scenesRepository.initialize(),
        devicesRepository.initialize(),
      ]);
    } catch (e) {
      debugPrint('Failed to initialize: $e');

      throw Exception('Services initialization failed');
    }
  }
}
