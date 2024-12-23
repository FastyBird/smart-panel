import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/app/routes.dart';
import 'package:fastybird_smart_panel/core/models/general/configuration.dart';
import 'package:fastybird_smart_panel/core/repositories/configuration.dart';
import 'package:fastybird_smart_panel/core/repositories/weather.dart';
import 'package:fastybird_smart_panel/core/services/navigation.dart';
import 'package:fastybird_smart_panel/core/services/screen_scaler.dart';
import 'package:fastybird_smart_panel/core/services/startup_manager.dart';
import 'package:fastybird_smart_panel/core/state/interaction_manager.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/device_detail.dart';
import 'package:fastybird_smart_panel/features/dashboard/repositories/data/devices/channels.dart';
import 'package:fastybird_smart_panel/features/dashboard/repositories/data/devices/controls.dart';
import 'package:fastybird_smart_panel/features/dashboard/repositories/data/devices/devices.dart';
import 'package:fastybird_smart_panel/features/dashboard/repositories/data/devices/properties.dart';
import 'package:fastybird_smart_panel/features/dashboard/repositories/data/scenes/scenes.dart';
import 'package:fastybird_smart_panel/features/dashboard/repositories/ui/pages.dart';
import 'package:fastybird_smart_panel/features/dashboard/repositories/ui/tiles.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    WidgetsFlutterBinding.ensureInitialized();

    final mediaQuery = MediaQueryData.fromView(
        WidgetsBinding.instance.platformDispatcher.views.first);

    final deviceInfo = ConfigurationModel(
      screenWidth: mediaQuery.size.width * mediaQuery.devicePixelRatio,
      screenHeight: mediaQuery.size.height * mediaQuery.devicePixelRatio,
      devicePixelRatio: mediaQuery.devicePixelRatio,
    );

    var startupService = StartupManagerService(deviceInfo: deviceInfo);

    return FutureBuilder(
      future: startupService.initialize(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return MaterialApp(
            theme: AppTheme.startThemeLight,
            darkTheme: AppTheme.startThemeDark,
            themeMode: ThemeMode.dark,
            debugShowCheckedModeBanner: false,
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

          final scaler = locator<ScreenScalerService>();

          return MaterialApp(
            theme: AppTheme.lightTheme,
            darkTheme: AppTheme.darkTheme,
            themeMode: ThemeMode.dark,
            debugShowCheckedModeBanner: false,
            home: Scaffold(
              body: Center(
                child: Padding(
                  padding: AppSpacings.paddingMd,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.error,
                        color: Theme.of(context).danger,
                        size: scaler.scale(64),
                      ),
                      AppSpacings.spacingMdVertical,
                      const Text(
                        'Failed to start application!',
                        textAlign: TextAlign.center,
                      ),
                      AppSpacings.spacingSmVertical,
                      const Text(
                        'Application could not be initialized.',
                        textAlign: TextAlign.center,
                      ),
                      const Text(
                        'Please try to restart device.',
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          );
        }

        return MultiProvider(
          providers: [
            ChangeNotifierProvider(
              create: (_) => locator<InteractionManager>(),
            ),
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
              create: (_) => locator<ChannelsControlsDataRepository>(),
            ),
            ChangeNotifierProvider(
              create: (_) => locator<ChannelsPropertiesDataRepository>(),
            ),
            ChangeNotifierProvider(
              create: (_) => locator<ChannelsDataRepository>(),
            ),
            ChangeNotifierProvider(
              create: (_) => locator<DevicesControlsDataRepository>(),
            ),
            ChangeNotifierProvider(
              create: (_) => locator<DevicesPropertiesDataRepository>(),
            ),
            ChangeNotifierProvider(
              create: (_) => locator<DevicesDataRepository>(),
            ),
          ],
          child: MaterialApp(
            theme: AppTheme.lightTheme,
            darkTheme: AppTheme.darkTheme,
            themeMode: ThemeMode.dark,
            debugShowCheckedModeBanner: false,
            title: 'FastyBird Smart Panel',
            navigatorKey: locator<NavigationService>().navigatorKey,
            initialRoute: '/',
            routes: appRoutes,
            onGenerateRoute: (settings) {
              if (settings.name != null) {
                final uri = Uri.parse(settings.name!);

                if (uri.pathSegments.length == 2 &&
                    uri.pathSegments[0] == 'device') {
                  final id = uri.pathSegments[1];

                  return MaterialPageRoute(
                    builder: (context) => DeviceDetailPage(id),
                  );
                }
              }
              return null; // Fallback to default behavior
            },
          ),
        );
      },
    );
  }
}
