import 'package:fastybird_smart_panel/app/app/body.dart';
import 'package:fastybird_smart_panel/app/app/error.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/repositories/configuration.dart';
import 'package:fastybird_smart_panel/core/repositories/weather.dart';
import 'package:fastybird_smart_panel/core/services/startup_manager.dart';
import 'package:fastybird_smart_panel/core/types/localization.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/features/dashboard/repositories/data/devices/devices.dart';
import 'package:fastybird_smart_panel/features/dashboard/repositories/data/scenes/scenes.dart';
import 'package:fastybird_smart_panel/features/dashboard/repositories/ui/pages.dart';
import 'package:fastybird_smart_panel/features/dashboard/repositories/ui/tiles.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    WidgetsFlutterBinding.ensureInitialized();

    final mediaQuery = MediaQueryData.fromView(
      WidgetsBinding.instance.platformDispatcher.views.first,
    );

    final startupService = StartupManagerService(
      screenHeight: mediaQuery.size.height * mediaQuery.devicePixelRatio,
      screenWidth: mediaQuery.size.width * mediaQuery.devicePixelRatio,
      pixelRatio: mediaQuery.devicePixelRatio,
    );

    final ThemeMode themeMode = ThemeMode.system;

    return FutureBuilder(
      future: startupService.initialize(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return MaterialApp(
            theme: AppTheme.startThemeLight,
            darkTheme: AppTheme.startThemeDark,
            themeMode: themeMode,
            debugShowCheckedModeBanner: false,
            localizationsDelegates: const [
              AppLocalizations.delegate,
              GlobalMaterialLocalizations.delegate,
              GlobalWidgetsLocalizations.delegate,
              GlobalCupertinoLocalizations.delegate,
            ],
            supportedLocales: LanguageType.values.map(
              (item) =>
                  Locale(item.value.split('_')[0], item.value.split('_')[1]),
            ),
            locale: Locale(
              LanguageType.english.value.split('_')[0],
              LanguageType.english.value.split('_')[1],
            ),
            home: Scaffold(
              body: Center(
                child: SizedBox(
                  width: 50 * 2 / mediaQuery.devicePixelRatio,
                  height: 50 * 2 / mediaQuery.devicePixelRatio,
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
            ChangeNotifierProvider(
              create: (_) => locator<ConfigurationRepository>(),
            ),
            ChangeNotifierProvider(
              create: (_) => locator<WeatherRepository>(),
            ),
            ChangeNotifierProvider(
              create: (_) => locator<PagesRepository>(),
            ),
            ChangeNotifierProvider(
              create: (_) => locator<TilesRepository>(),
            ),
            ChangeNotifierProvider(
              create: (_) => locator<TilesDataRepository>(),
            ),
            ChangeNotifierProvider(
              create: (_) => locator<ScenesDataRepository>(),
            ),
            ChangeNotifierProvider(
              create: (_) => locator<DevicesDataRepository>(),
            ),
          ],
          child: Consumer<ConfigurationRepository>(builder: (
            context,
            configurationRepository,
            _,
          ) {
            return AppBody();
          }),
        );
      },
    );
  }
}
