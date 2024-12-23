import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/models/general/configuration.dart';
import 'package:fastybird_smart_panel/core/repositories/configuration.dart';
import 'package:fastybird_smart_panel/core/repositories/weather.dart';
import 'package:fastybird_smart_panel/core/services/configuration.dart';
import 'package:fastybird_smart_panel/core/services/navigation.dart';
import 'package:fastybird_smart_panel/core/services/screen_scaler.dart';
import 'package:fastybird_smart_panel/features/dashboard/repositories/data/devices/devices.dart';
import 'package:fastybird_smart_panel/features/dashboard/repositories/data/scenes/scenes.dart';
import 'package:fastybird_smart_panel/features/dashboard/repositories/ui/pages.dart';
import 'package:fastybird_smart_panel/features/dashboard/repositories/ui/tiles.dart';
import 'package:flutter/material.dart';

class StartupManagerService {
  final ConfigurationModel configuration;

  StartupManagerService({required this.configuration});

  Future<void> initialize() async {
    await locator.reset();

    var configurationRepository = ConfigurationRepository(
      screenHeight: configuration.screenHeight,
      screenWidth: configuration.screenWidth,
      devicePixelRatio: configuration.devicePixelRatio,
    );
    var weatherRepository = WeatherRepository();
    var screensRepository = PagesRepository();
    var tilesRepository = TilesRepository();
    var tilesDataRepository = TilesDataRepository();
    var scenesRepository = ScenesDataRepository();
    var devicesRepository = DevicesDataRepository();

    // Register services
    locator.registerLazySingleton(() => NavigationService());
    locator.registerLazySingleton(() => ScreenScalerService(configuration));
    locator.registerLazySingleton(() => ConfigurationService(configuration));

    // Register repositories
    locator.registerSingleton(configurationRepository);
    locator.registerSingleton(weatherRepository);
    locator.registerSingleton(screensRepository);
    locator.registerSingleton(tilesRepository);
    locator.registerSingleton(tilesDataRepository);
    locator.registerSingleton(scenesRepository);
    locator.registerSingleton(devicesRepository);

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
    }
  }
}
