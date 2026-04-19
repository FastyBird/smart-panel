import 'dart:async';

import 'package:event_bus/event_bus.dart';
import 'package:fastybird_smart_panel/app/app/body.dart';
import 'package:fastybird_smart_panel/app/app/error.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/models/discovered_backend.dart';
import 'package:fastybird_smart_panel/core/services/local_preferences.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/startup_manager.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/features/discovery/presentation/discovery.dart';
import 'package:fastybird_smart_panel/features/discovery/presentation/room_selection.dart';
import 'package:fastybird_smart_panel/modules/displays/repositories/display.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/foundation.dart';
import 'package:fastybird_smart_panel/modules/system/types/configuration.dart';
import 'package:fastybird_smart_panel/modules/dashboard/export.dart'
    as dashboard_module;
import 'package:fastybird_smart_panel/modules/deck/export.dart'
    as deck_module;
import 'package:fastybird_smart_panel/features/overlay/services/overlay_manager.dart';
import 'package:fastybird_smart_panel/features/suggestions/services/suggestion_notification_service.dart';
import 'package:fastybird_smart_panel/modules/buddy/export.dart'
    as buddy_module;
import 'package:fastybird_smart_panel/modules/security/export.dart'
    as security_module;
import 'package:fastybird_smart_panel/modules/devices/export.dart'
    as devices_module;
import 'package:fastybird_smart_panel/modules/displays/export.dart'
    as displays_module;
import 'package:fastybird_smart_panel/modules/intents/export.dart'
    as intents_module;
import 'package:fastybird_smart_panel/modules/system/export.dart'
    as system_module;
import 'package:fastybird_smart_panel/modules/energy/export.dart'
    as energy_module;
import 'package:fastybird_smart_panel/modules/spaces/export.dart'
    as spaces_module;
import 'package:fastybird_smart_panel/modules/weather/export.dart'
    as weather_module;
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';

/// Structured error information for app initialization failures.
///
/// Stores error type and context data so the UI can localize messages
/// at display time using [AppLocalizations] from a widget context.
sealed class AppErrorInfo {
  const AppErrorInfo();

  /// Resolves this error to a localized message for display.
  String toLocalizedMessage(AppLocalizations l) {
    return switch (this) {
      AppErrorConnectionFailedStored() =>
        l.app_error_connection_failed_stored,
      AppErrorConnectionFailedBackend(:final name, :final address) =>
        l.app_error_connection_failed_backend(name, address),
      AppErrorConnectionFailedUrl(:final url) =>
        l.app_error_connection_failed_url(url),
      AppErrorInitializationFailed() =>
        l.app_error_initialization_failed,
      AppErrorException(:final message) => message,
    };
  }
}

class AppErrorConnectionFailedStored extends AppErrorInfo {
  const AppErrorConnectionFailedStored();
}

class AppErrorConnectionFailedBackend extends AppErrorInfo {
  final String name;
  final String address;
  const AppErrorConnectionFailedBackend(this.name, this.address);
}

class AppErrorConnectionFailedUrl extends AppErrorInfo {
  final String url;
  const AppErrorConnectionFailedUrl(this.url);
}

class AppErrorInitializationFailed extends AppErrorInfo {
  const AppErrorInitializationFailed();
}

class AppErrorException extends AppErrorInfo {
  final String message;
  const AppErrorException(this.message);
}

/// Application state during startup
enum AppState {
  /// Initial loading state
  loading,

  /// Backend discovery needed
  discovery,

  /// Connection to stored backend failed, retrying discovery
  connectionFailed,

  /// Room selection needed (display has no room assigned)
  roomSelection,

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
  AppErrorInfo? _errorInfo;

  Language _cachedLanguage = Language.english;
  bool _cachedDarkMode = false;

  StreamSubscription<ResetToDiscoveryEvent>? _resetEventSubscription;

  /// Background timer for auto-retrying backend connection.
  /// Active when the app is in [connectionFailed] or [discovery] state
  /// and a backend URL is known (e.g. from environment variables in AIO mode).
  Timer? _backendRetryTimer;

  /// The backend URL being retried in the background.
  String? _retryBackendUrl;

  /// Guard flag to prevent overlapping [_onRetryTick] executions.
  bool _retryInProgress = false;

  @override
  void initState() {
    super.initState();

    _appState = ValueNotifier<AppState>(AppState.loading);

    final view = WidgetsBinding.instance.platformDispatcher.views.first;
    final physicalSize = view.physicalSize;

    _startupManager = StartupManagerService(
      screenHeight: physicalSize.height,
      screenWidth: physicalSize.width,
      pixelRatio: view.devicePixelRatio,
    );

    locator.registerSingleton(_startupManager);

    // Listen for reset to discovery events
    final eventBus = locator.get<EventBus>();
    _resetEventSubscription = eventBus.on<ResetToDiscoveryEvent>().listen((_) {
      _resetToDiscovery();
    });

    _initializeApp();
  }


  Future<void> _resetToDiscovery() async {
    if (kDebugMode) {
      debugPrint('[APP] Resetting to discovery state');
    }

    // Stop any running retry timer immediately — before yielding to the
    // event loop — so stale ticks cannot race with the reset.
    _stopBackendRetry();

    // If a compile-time backend URL is configured (AIO mode), try it
    // directly instead of showing the discovery screen.
    final url = await _startupManager.getEffectiveBackendUrl();

    if (url != null) {
      _appState.value = AppState.loading;
      _initializeApp();

      return;
    }

    _appState.value = AppState.discovery;
  }

  /// Check if space selection is needed and transition to the appropriate state.
  ///
  /// Phase 5: displays no longer carry a `DisplayRole`. An unassigned
  /// display (`spaceId == null`) is the signal to open the space picker.
  bool _needsRoomSelection() {
    try {
      final displayRepo = locator<DisplayRepository>();
      final display = displayRepo.display;

      if (display != null && display.spaceId == null) {
        return true;
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[APP] Could not check space selection: $e');
      }
    }

    return false;
  }

  /// Transition to ready or room selection based on display state
  void _transitionToReadyOrRoomSelection() {
    if (_needsRoomSelection()) {
      _appState.value = AppState.roomSelection;
    } else {
      _appState.value = AppState.ready;
    }
  }

  void _onRoomSelected(String roomId) {
    if (kDebugMode) {
      debugPrint('[APP] Room selected: $roomId');
    }

    _appState.value = AppState.ready;
  }

  /// Start a background timer that periodically pings the backend URL.
  /// When the backend responds, automatically re-trigger initialization.
  void _startBackendRetry(String backendUrl) {
    _stopBackendRetry();
    _retryBackendUrl = backendUrl;

    if (kDebugMode) {
      debugPrint(
        '[APP] Starting background backend retry for: $backendUrl',
      );
    }

    _backendRetryTimer = Timer.periodic(
      const Duration(seconds: 5),
      (_) => _onRetryTick(),
    );
  }

  /// Stop the background retry timer.
  void _stopBackendRetry() {
    _backendRetryTimer?.cancel();
    _backendRetryTimer = null;
    _retryBackendUrl = null;
    _retryInProgress = false;
  }

  /// Called on each retry tick - pings the backend and re-initializes if reachable.
  Future<void> _onRetryTick() async {
    // Prevent overlapping ticks — the ping timeout (up to 6s) can exceed
    // the timer interval (5s), so a new tick may fire while the previous
    // one is still in-flight.
    if (_retryInProgress) return;

    final url = _retryBackendUrl;

    if (url == null) return;

    // Only retry while in connectionFailed or discovery state
    final currentState = _appState.value;

    if (currentState != AppState.connectionFailed &&
        currentState != AppState.discovery) {
      _stopBackendRetry();

      return;
    }

    _retryInProgress = true;

    try {
      if (kDebugMode) {
        debugPrint('[APP] Background retry: pinging $url');
      }

      final reachable = await StartupManagerService.pingUrl(url);

      // After the async ping, verify the retry was not cancelled or restarted
      // with a different URL while we were waiting. A null timer means outright
      // cancellation; a changed URL means a new retry was started for a
      // different backend and this tick is stale.
      if (_backendRetryTimer == null || _retryBackendUrl != url) return;

      if (!reachable) return;

      if (kDebugMode) {
        debugPrint(
          '[APP] Background retry: backend is online, re-initializing',
        );
      }

      _stopBackendRetry();

      // Initialize with the specific URL that was pinged, not whatever
      // getEffectiveBackendUrl() might return (which could be different).
      await _initializeAppWithUrl(url);
    } finally {
      _retryInProgress = false;
    }
  }

  /// If a backend URL is available, start background retry polling.
  void _maybeStartBackendRetry(String? url) {
    if (url != null) {
      _startBackendRetry(url);
    }
  }

  /// Shared initialization wrapper: stops the retry timer, shows the loader,
  /// loads cached UI preferences, runs [initialize], and handles errors.
  ///
  /// [initialize] receives the resolved result and the retry URL to use on
  /// failure. It must call the appropriate startup-manager method and map
  /// the [InitializationResult] to the right app state.
  Future<void> _runInitialization(
    Future<void> Function() initialize,
  ) async {
    _stopBackendRetry();
    _appState.value = AppState.loading;
    _errorInfo = null;

    // Load cached UI preferences (language, dark mode) before anything else
    // so the first frame uses the correct locale and theme
    final prefs = locator<LocalPreferencesService>();
    await prefs.load();
    setState(() {
      _cachedLanguage = prefs.language;
      _cachedDarkMode = prefs.darkMode;
    });

    try {
      await initialize();
    } catch (error) {
      debugPrint(error.toString());

      /// Ensure loader is shown even in case of an error
      await Future.delayed(const Duration(milliseconds: 500));

      _errorInfo = AppErrorException(error.toString());
      _appState.value = AppState.error;
    }
  }

  /// Initialize the app with a specific backend URL, storing it on success.
  Future<void> _initializeAppWithUrl(String backendUrl) async {
    await _runInitialization(() async {
      final result = await _startupManager.initializeWithUrl(backendUrl);

      /// Ensure loader is shown for at least 500ms
      await Future.delayed(const Duration(milliseconds: 500));

      switch (result) {
        case InitializationResult.success:
          await _startupManager.storeBackendUrl(backendUrl);
          _transitionToReadyOrRoomSelection();
          break;

        case InitializationResult.needsDiscovery:
          _appState.value = AppState.discovery;
          _maybeStartBackendRetry(backendUrl);
          break;

        case InitializationResult.connectionFailed:
          _errorInfo = const AppErrorConnectionFailedStored();
          _appState.value = AppState.connectionFailed;
          _maybeStartBackendRetry(backendUrl);
          break;

        case InitializationResult.error:
          _appState.value = AppState.error;
          break;
      }
    });
  }

  Future<void> _initializeApp() async {
    // Resolve the effective URL before tryInitialize so we can pass it to
    // _maybeStartBackendRetry synchronously on failure.
    String? effectiveUrl;

    await _runInitialization(() async {
      effectiveUrl = await _startupManager.getEffectiveBackendUrl();

      final result = await _startupManager.tryInitialize();

      /// Ensure loader is shown for at least 500ms
      await Future.delayed(const Duration(milliseconds: 500));

      switch (result) {
        case InitializationResult.success:
          _transitionToReadyOrRoomSelection();
          break;

        case InitializationResult.needsDiscovery:
          _appState.value = AppState.discovery;
          _maybeStartBackendRetry(effectiveUrl);
          break;

        case InitializationResult.connectionFailed:
          _errorInfo = const AppErrorConnectionFailedStored();
          _appState.value = AppState.connectionFailed;
          _maybeStartBackendRetry(effectiveUrl);
          break;

        case InitializationResult.error:
          _appState.value = AppState.error;
          break;
      }
    });
  }

  Future<void> _onBackendSelected(DiscoveredBackend backend) async {
    _stopBackendRetry();
    _appState.value = AppState.loading;

    try {
      final result = await _startupManager.initializeWithBackend(backend);

      await Future.delayed(const Duration(milliseconds: 300));

      switch (result) {
        case InitializationResult.success:
          _transitionToReadyOrRoomSelection();
          break;

        case InitializationResult.connectionFailed:
          _errorInfo = AppErrorConnectionFailedBackend(
            backend.name, backend.displayAddress,
          );
          _appState.value = AppState.connectionFailed;
          _startBackendRetry(backend.baseUrl);
          break;

        case InitializationResult.needsDiscovery:
        case InitializationResult.error:
          _errorInfo = const AppErrorInitializationFailed();
          _appState.value = AppState.error;
          break;
      }
    } catch (error) {
      debugPrint(error.toString());
      _errorInfo = AppErrorException(error.toString());
      _appState.value = AppState.error;
    }
  }

  Future<void> _onManualUrlEntered(String url) async {
    _stopBackendRetry();
    _appState.value = AppState.loading;

    // Normalize URL - ensure it has protocol and API path
    String normalizedUrl = url.trim();
    
    // Normalize protocol to lowercase for case-insensitive check
    final lowerUrl = normalizedUrl.toLowerCase();
    
    // Add protocol if missing (default to http://)
    if (!lowerUrl.startsWith('http://') && 
        !lowerUrl.startsWith('https://')) {
      normalizedUrl = 'http://$normalizedUrl';
    } else {
      // Normalize the protocol to lowercase if present
      if (lowerUrl.startsWith('https://')) {
        normalizedUrl = 'https://${normalizedUrl.substring(8)}';
      } else if (lowerUrl.startsWith('http://')) {
        normalizedUrl = 'http://${normalizedUrl.substring(7)}';
      }
    }
    
    // Ensure it has the API path (case-insensitive check)
    if (!lowerUrl.contains('/api/')) {
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
          _transitionToReadyOrRoomSelection();
          break;

        case InitializationResult.connectionFailed:
          _errorInfo = AppErrorConnectionFailedUrl(url);
          _appState.value = AppState.connectionFailed;
          _startBackendRetry(normalizedUrl);
          break;

        case InitializationResult.needsDiscovery:
        case InitializationResult.error:
          _errorInfo = const AppErrorInitializationFailed();
          _appState.value = AppState.error;
          break;
      }
    } catch (error) {
      debugPrint(error.toString());
      _errorInfo = AppErrorException(error.toString());
      _appState.value = AppState.error;
    }
  }

  Future<void> _restartApp() async {
    await _initializeApp();
  }

  @override
  void dispose() {
    _stopBackendRetry();
    _resetEventSubscription?.cancel();
    _appState.dispose();
    super.dispose();
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

          case AppState.roomSelection:
            return _buildRoomSelectionApp();

          case AppState.error:
            return AppError(
              onRestart: _restartApp,
              errorInfo: _errorInfo,
            );

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
      themeMode: _cachedDarkMode ? ThemeMode.dark : ThemeMode.light,
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
        _cachedLanguage.value.split('_')[0],
        _cachedLanguage.value.split('_')[1],
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
      themeMode: _cachedDarkMode ? ThemeMode.dark : ThemeMode.light,
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
        _cachedLanguage.value.split('_')[0],
        _cachedLanguage.value.split('_')[1],
      ),
      home: DiscoveryScreen(
        onBackendSelected: _onBackendSelected,
        onManualUrlEntered: _onManualUrlEntered,
        errorInfo: _errorInfo,
        isRetry: isRetry,
      ),
    );
  }

  Widget _buildRoomSelectionApp() {
    return MaterialApp(
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: _cachedDarkMode ? ThemeMode.dark : ThemeMode.light,
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
        _cachedLanguage.value.split('_')[0],
        _cachedLanguage.value.split('_')[1],
      ),
      home: RoomSelectionScreen(
        onRoomSelected: _onRoomSelected,
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
          value: locator<displays_module.DisplayRepository>(),
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
          value: locator<intents_module.IntentOverlayService>(),
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
        ChangeNotifierProvider.value(
          value: locator<deck_module.DeckService>(),
        ),
        ChangeNotifierProvider.value(
          value: locator<deck_module.IntentsService>(),
        ),
        ChangeNotifierProvider.value(
          value: locator<deck_module.BottomNavModeNotifier>(),
        ),
        ChangeNotifierProvider.value(
          value: locator<spaces_module.MediaActivityRepository>(),
        ),
        ChangeNotifierProvider.value(
          value: locator<security_module.SecurityStatusRepository>(),
        ),
        ChangeNotifierProvider.value(
          value: locator<security_module.SecurityOverlayController>(),
        ),
        ChangeNotifierProvider.value(
          value: locator<security_module.SecurityEventsRepository>(),
        ),
        ChangeNotifierProvider.value(
          value: locator<spaces_module.MediaActivityService>(),
        ),
        ChangeNotifierProvider.value(
          value: locator<energy_module.EnergyRepository>(),
        ),
        ChangeNotifierProvider.value(
          value: locator<OverlayManager>(),
        ),
        ChangeNotifierProvider.value(
          value: locator<buddy_module.BuddyRepository>(),
        ),
        ChangeNotifierProvider.value(
          value: locator<buddy_module.BuddyService>(),
        ),
        ChangeNotifierProvider.value(
          value: locator<SuggestionNotificationService>(),
        ),
      ],
      child: AppBody(),
    );
  }
}
