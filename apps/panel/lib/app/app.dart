import 'package:fastybird_smart_panel/app/app/body.dart';
import 'package:fastybird_smart_panel/app/app/error.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/models/discovered_backend.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/startup_manager.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/features/discovery/presentation/backend_discovery.dart';
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

/// Application state during startup
enum AppState {
  /// Initial loading state
  loading,

  /// Backend discovery needed
  discovery,

  /// Connection to stored backend failed, retrying discovery
  connectionFailed,

  /// Initialization successful
  ready,

  /// Initialization error
  error,
}

class MyApp extends StatefulWidget {
  const MyApp({super.key});

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  late StartupManagerService _startupManager;
  late ValueNotifier<AppState> _appState;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();

    _appState = ValueNotifier<AppState>(AppState.loading);

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
    _appState.value = AppState.loading;
    _errorMessage = null;

    try {
      final result = await _startupManager.tryInitialize();

      /// Ensure loader is shown for at least 500ms
      await Future.delayed(const Duration(milliseconds: 500));

      switch (result) {
        case InitializationResult.success:
          _appState.value = AppState.ready;
          break;

        case InitializationResult.needsDiscovery:
          _appState.value = AppState.discovery;
          break;

        case InitializationResult.connectionFailed:
          _errorMessage = 'Could not connect to the stored backend server.';
          _appState.value = AppState.connectionFailed;
          break;

        case InitializationResult.error:
          _appState.value = AppState.error;
          break;
      }
    } catch (error) {
      debugPrint(error.toString());

      /// Ensure loader is shown even in case of an error
      await Future.delayed(const Duration(milliseconds: 500));

      _errorMessage = error.toString();
      _appState.value = AppState.error;
    }
  }

  Future<void> _onBackendSelected(DiscoveredBackend backend) async {
    _appState.value = AppState.loading;

    try {
      final result = await _startupManager.initializeWithBackend(backend);

      await Future.delayed(const Duration(milliseconds: 300));

      switch (result) {
        case InitializationResult.success:
          _appState.value = AppState.ready;
          break;

        case InitializationResult.connectionFailed:
          _errorMessage =
              'Could not connect to ${backend.name} at ${backend.displayAddress}';
          _appState.value = AppState.connectionFailed;
          break;

        case InitializationResult.needsDiscovery:
        case InitializationResult.error:
          _errorMessage = 'Failed to initialize connection to backend.';
          _appState.value = AppState.error;
          break;
      }
    } catch (error) {
      debugPrint(error.toString());
      _errorMessage = error.toString();
      _appState.value = AppState.error;
    }
  }

  Future<void> _onManualUrlEntered(String url) async {
    _appState.value = AppState.loading;

    // Normalize URL - ensure it has the API path
    String normalizedUrl = url.trim();
    if (!normalizedUrl.contains('/api/')) {
      // Remove trailing slash if present
      if (normalizedUrl.endsWith('/')) {
        normalizedUrl = normalizedUrl.substring(0, normalizedUrl.length - 1);
      }
      normalizedUrl = '$normalizedUrl/api/v1';
    }

    try {
      final result = await _startupManager.initializeWithUrl(normalizedUrl);

      await Future.delayed(const Duration(milliseconds: 300));

      switch (result) {
        case InitializationResult.success:
          // Store the URL for future use
          await _startupManager.storeBackendUrl(normalizedUrl);
          _appState.value = AppState.ready;
          break;

        case InitializationResult.connectionFailed:
          _errorMessage = 'Could not connect to $url';
          _appState.value = AppState.connectionFailed;
          break;

        case InitializationResult.needsDiscovery:
        case InitializationResult.error:
          _errorMessage = 'Failed to initialize connection to backend.';
          _appState.value = AppState.error;
          break;
      }
    } catch (error) {
      debugPrint(error.toString());
      _errorMessage = error.toString();
      _appState.value = AppState.error;
    }
  }

  Future<void> _restartApp() async {
    await _initializeApp();
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<AppState>(
      valueListenable: _appState,
      builder: (context, appState, child) {
        switch (appState) {
          case AppState.loading:
            return _buildLoadingApp();

          case AppState.discovery:
            return _buildDiscoveryApp(isRetry: false);

          case AppState.connectionFailed:
            return _buildDiscoveryApp(isRetry: true);

          case AppState.error:
            return AppError(onRestart: _restartApp);

          case AppState.ready:
            return _buildMainApp();
        }
      },
    );
  }

  Widget _buildLoadingApp() {
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

  Widget _buildDiscoveryApp({required bool isRetry}) {
    return MaterialApp(
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
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
      home: BackendDiscoveryScreen(
        onBackendSelected: _onBackendSelected,
        onManualUrlEntered: _onManualUrlEntered,
        errorMessage: _errorMessage,
        isRetry: isRetry,
      ),
    );
  }

  Widget _buildMainApp() {
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
  }
}
