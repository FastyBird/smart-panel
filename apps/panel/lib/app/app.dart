import 'package:fastybird_smart_panel/app/app/body.dart';
import 'package:fastybird_smart_panel/app/app/error.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/startup_manager.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/config/export.dart'
    as config_module;
import 'package:fastybird_smart_panel/modules/config/types/configuration.dart';
import 'package:fastybird_smart_panel/modules/dashboard/export.dart'
    as dashboard_module;
import 'package:fastybird_smart_panel/modules/devices/export.dart'
    as devices_module;
import 'package:fastybird_smart_panel/modules/system/export.dart'
    as system_module;
import 'package:fastybird_smart_panel/modules/weather/export.dart'
    as weather_module;
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';

class MyApp extends StatefulWidget {
  const MyApp({super.key});

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  late StartupManagerService _startupManager;
  late ValueNotifier<bool> _isInitializing;
  late ValueNotifier<bool> _isInitializationError;

  @override
  void initState() {
    super.initState();

    _isInitializing = ValueNotifier<bool>(true);
    _isInitializationError = ValueNotifier<bool>(false);

    _startupManager = StartupManagerService(
      screenHeight: MediaQueryData.fromView(
            WidgetsBinding.instance.platformDispatcher.views.first,
          ).size.height *
          MediaQueryData.fromView(
            WidgetsBinding.instance.platformDispatcher.views.first,
          ).devicePixelRatio,
      screenWidth: MediaQueryData.fromView(
            WidgetsBinding.instance.platformDispatcher.views.first,
          ).size.width *
          MediaQueryData.fromView(
            WidgetsBinding.instance.platformDispatcher.views.first,
          ).devicePixelRatio,
      pixelRatio: MediaQueryData.fromView(
        WidgetsBinding.instance.platformDispatcher.views.first,
      ).devicePixelRatio,
    );

    locator.registerSingleton(_startupManager);

    _initializeApp();
  }

  Future<void> _initializeApp() async {
    _isInitializing.value = true;

    try {
      await _startupManager.initialize();

      /// Ensure loader is shown for at least 500ms
      await Future.delayed(const Duration(milliseconds: 500));

      _isInitializing.value = false;
      _isInitializationError.value = false;
    } catch (error) {
      debugPrint(error.toString());

      /// Ensure loader is shown even in case of an error
      await Future.delayed(const Duration(milliseconds: 500));

      _isInitializing.value = false;
      _isInitializationError.value = true;
    }
  }

  Future<void> _restartApp() async {
    await _initializeApp();
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<bool>(
      valueListenable: _isInitializing,
      builder: (context, isInitializing, child) {
        if (isInitializing) {
          return MaterialApp(
            theme: AppTheme.startThemeLight,
            darkTheme: AppTheme.startThemeDark,
            themeMode: ThemeMode.system,
            debugShowCheckedModeBanner: false,
            localizationsDelegates: const [
              AppLocalizations.delegate,
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: Language.values.map(
              (item) => Locale(
                item.value.split('_')[0],
                item.value.split('_')[1],
              ),
            ),
            locale: Locale(
              Language.english.value.split('_')[0],
              Language.english.value.split('_')[1],
            ),
            home: Scaffold(
              body: Center(
                child: SizedBox(
                  width: locator.get<ScreenService>().scale(50),
                  height: locator.get<ScreenService>().scale(50),
                  child: const CircularProgressIndicator(),
                ),
              ),
            ),
          );
        }

        if (_isInitializationError.value) {
          return AppError(onRestart: _restartApp);
        }

        return MultiProvider(
          providers: [
            ChangeNotifierProvider.value(
              value: locator<ScreenService>(),
            ),
            ChangeNotifierProvider.value(
              value: locator<config_module.AudioConfigRepository>(),
            ),
            ChangeNotifierProvider.value(
              value: locator<config_module.DisplayConfigRepository>(),
            ),
            ChangeNotifierProvider.value(
              value: locator<config_module.LanguageConfigRepository>(),
            ),
            ChangeNotifierProvider.value(
              value: locator<config_module.WeatherConfigRepository>(),
            ),
            ChangeNotifierProvider.value(
              value: locator<weather_module.CurrentWeatherRepository>(),
            ),
            ChangeNotifierProvider.value(
              value: locator<weather_module.ForecastWeatherRepository>(),
            ),
            ChangeNotifierProvider.value(
              value: locator<weather_module.WeatherService>(),
            ),
            ChangeNotifierProvider.value(
              value: locator<system_module.SystemInfoRepository>(),
            ),
            ChangeNotifierProvider.value(
              value: locator<system_module.ThrottleStatusRepository>(),
            ),
            ChangeNotifierProvider.value(
              value: locator<system_module.SystemService>(),
            ),
            ChangeNotifierProvider.value(
              value: locator<devices_module.DevicesRepository>(),
            ),
            ChangeNotifierProvider.value(
              value: locator<devices_module.DeviceControlsRepository>(),
            ),
            ChangeNotifierProvider.value(
              value: locator<devices_module.ChannelsRepository>(),
            ),
            ChangeNotifierProvider.value(
              value: locator<devices_module.ChannelControlsRepository>(),
            ),
            ChangeNotifierProvider.value(
              value: locator<devices_module.ChannelPropertiesRepository>(),
            ),
            ChangeNotifierProvider.value(
              value: locator<devices_module.DevicesService>(),
            ),
            ChangeNotifierProvider.value(
              value: locator<dashboard_module.PagesRepository>(),
            ),
            ChangeNotifierProvider.value(
              value: locator<dashboard_module.CardsRepository>(),
            ),
            ChangeNotifierProvider.value(
              value: locator<dashboard_module.TilesRepository>(),
            ),
            ChangeNotifierProvider.value(
              value: locator<dashboard_module.DataSourcesRepository>(),
            ),
            ChangeNotifierProvider.value(
              value: locator<dashboard_module.DashboardService>(),
            ),
          ],
          child: AppBody(),
        );
      },
    );
  }
}
