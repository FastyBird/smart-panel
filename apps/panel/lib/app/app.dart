import 'package:fastybird_smart_panel/app/app/body.dart';
import 'package:fastybird_smart_panel/app/app/error.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/startup_manager.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/features/dashboard/services/devices.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/config/repositories/export.dart'
    as config_module;
import 'package:fastybird_smart_panel/modules/config/types/configuration.dart';
import 'package:fastybird_smart_panel/modules/dashboard/repositories/export.dart'
    as dashboard_module;
import 'package:fastybird_smart_panel/modules/devices/repositories/export.dart'
    as devices_module;
import 'package:fastybird_smart_panel/modules/system/repositories/export.dart'
    as system_module;
import 'package:fastybird_smart_panel/modules/weather/repositories/export.dart'
    as weather_module;
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';

class MyApp extends StatelessWidget {
  final StartupManagerService _startupManager;

  MyApp({super.key})
      : _startupManager = StartupManagerService(
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

  @override
  Widget build(BuildContext context) {
    return FutureBuilder(
      future: _startupManager.initialize(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
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

        if (snapshot.hasError) {
          debugPrint(snapshot.error.toString());

          return AppError();
        }

        return MultiProvider(
          providers: [
            ChangeNotifierProvider.value(
                value: locator<config_module.AudioConfigRepository>()),
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
              value: locator<system_module.SystemInfoRepository>(),
            ),
            ChangeNotifierProvider.value(
              value: locator<system_module.ThrottleStatusRepository>(),
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
              value: locator<DevicesService>(),
            ),
          ],
          child: AppBody(),
        );
      },
    );
  }
}
