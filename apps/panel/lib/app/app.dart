import 'package:fastybird_smart_panel/app/app/body.dart';
import 'package:fastybird_smart_panel/app/app/error.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/repositories/config_module.dart';
import 'package:fastybird_smart_panel/core/repositories/weather_module.dart';
import 'package:fastybird_smart_panel/core/services/startup_manager.dart';
import 'package:fastybird_smart_panel/core/types/configuration.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/features/dashboard/repositories/data/devices/devices_module.dart';
import 'package:fastybird_smart_panel/features/dashboard/repositories/ui/dashboard/dashboard_module.dart';
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
            supportedLocales: Language.values.map(
              (item) =>
                  Locale(item.value.split('_')[0], item.value.split('_')[1]),
            ),
            locale: Locale(
              Language.english.value.split('_')[0],
              Language.english.value.split('_')[1],
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
              create: (_) => locator<ConfigModuleRepository>(),
            ),
            ChangeNotifierProvider(
              create: (_) => locator<WeatherModuleRepository>(),
            ),
            ChangeNotifierProvider(
              create: (_) => locator<DevicesModuleRepository>(),
            ),
            ChangeNotifierProvider(
              create: (_) => locator<DashboardModuleRepository>(),
            ),
          ],
          child: Consumer<ConfigModuleRepository>(builder: (
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
