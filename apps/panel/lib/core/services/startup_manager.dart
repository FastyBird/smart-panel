import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/models/general/configuration.dart';
import 'package:fastybird_smart_panel/core/repositories/configuration.dart';
import 'package:fastybird_smart_panel/core/repositories/weather.dart';
import 'package:fastybird_smart_panel/core/services/navigation.dart';
import 'package:fastybird_smart_panel/core/services/screen_scaler.dart';
import 'package:fastybird_smart_panel/core/state/interaction_manager.dart';
import 'package:fastybird_smart_panel/features/dashboard/repositories/data/devices/channels.dart';
import 'package:fastybird_smart_panel/features/dashboard/repositories/data/devices/controls.dart';
import 'package:fastybird_smart_panel/features/dashboard/repositories/data/devices/devices.dart';
import 'package:fastybird_smart_panel/features/dashboard/repositories/data/devices/properties.dart';
import 'package:fastybird_smart_panel/features/dashboard/repositories/data/scenes/scenes.dart';
import 'package:fastybird_smart_panel/features/dashboard/repositories/ui/pages.dart';
import 'package:fastybird_smart_panel/features/dashboard/repositories/ui/tiles.dart';
import 'package:flutter/material.dart';

class StartupManagerService {
  final ConfigurationModel deviceInfo;

  StartupManagerService({required this.deviceInfo});

  Future<void> initialize() async {
    await locator.reset();

    var interactionManager = InteractionManager();

    var configurationRepository = ConfigurationRepository(
      screenHeight: deviceInfo.screenHeight,
      screenWidth: deviceInfo.screenWidth,
      devicePixelRatio: deviceInfo.devicePixelRatio,
    );
    var weatherRepository = WeatherRepository();
    var screensRepository = PagesRepository();
    var tilesRepository = TilesRepository();
    var tilesDataRepository = TilesDataRepository();
    var scenesRepository = ScenesDataRepository();
    var channelsControlsRepository = ChannelsControlsDataRepository();
    var channelsPropertiesRepository = ChannelsPropertiesDataRepository();
    var channelsRepository = ChannelsDataRepository();
    var devicesControlsRepository = DevicesControlsDataRepository();
    var devicesPropertiesRepository = DevicesPropertiesDataRepository();
    var devicesRepository = DevicesDataRepository();

    // Register services
    locator.registerLazySingleton(() => NavigationService());
    locator.registerLazySingleton(() => ScreenScalerService(deviceInfo));

    // Register managers
    locator.registerSingleton(interactionManager);

    // Register repositories
    locator.registerSingleton(configurationRepository);
    locator.registerSingleton(weatherRepository);
    locator.registerSingleton(screensRepository);
    locator.registerSingleton(tilesRepository);
    locator.registerSingleton(tilesDataRepository);
    locator.registerSingleton(scenesRepository);
    locator.registerSingleton(channelsControlsRepository);
    locator.registerSingleton(channelsPropertiesRepository);
    locator.registerSingleton(channelsRepository);
    locator.registerSingleton(devicesControlsRepository);
    locator.registerSingleton(devicesPropertiesRepository);
    locator.registerSingleton(devicesRepository);

    try {
      await Future.wait([
        configurationRepository.initialize(),
        weatherRepository.initialize(),
        screensRepository.initialize(),
        tilesRepository.initialize(),
        tilesDataRepository.initialize(),
        scenesRepository.initialize(),
        channelsControlsRepository.initialize(),
        channelsPropertiesRepository.initialize(),
        channelsRepository.initialize(),
        devicesControlsRepository.initialize(),
        devicesPropertiesRepository.initialize(),
        devicesRepository.initialize(),
      ]);
    } catch (e) {
      debugPrint('Failed to initialize: $e');
    }
  }
}
