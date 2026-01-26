import 'dart:io';

import 'package:dio/dio.dart';
import 'package:event_bus/event_bus.dart';
import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/api/models/displays_module_register_display.dart';
import 'package:fastybird_smart_panel/api/models/displays_module_req_register_display.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/models/discovered_backend.dart';
import 'package:fastybird_smart_panel/core/interceptors/json_serializer_interceptor.dart';
import 'package:fastybird_smart_panel/core/interceptors/retry_interceptor.dart';
import 'package:fastybird_smart_panel/core/interceptors/token_refresh_interceptor.dart';
import 'package:fastybird_smart_panel/core/services/navigation.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/core/services/system_actions.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/application.dart';
import 'package:fastybird_smart_panel/core/utils/secure_storage.dart';
import 'package:fastybird_smart_panel/modules/config/module.dart';
// LanguageConfigRepository and WeatherConfigRepository moved to their respective modules
import 'package:fastybird_smart_panel/modules/dashboard/module.dart';
import 'package:fastybird_smart_panel/modules/dashboard/repositories/cards.dart';
import 'package:fastybird_smart_panel/modules/dashboard/repositories/data_sources.dart';
import 'package:fastybird_smart_panel/modules/dashboard/repositories/pages.dart';
import 'package:fastybird_smart_panel/modules/dashboard/repositories/tiles.dart';
import 'package:fastybird_smart_panel/modules/dashboard/service.dart';
import 'package:fastybird_smart_panel/modules/devices/module.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/channel_controls.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/channel_properties.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/channels.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/device_controls.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/devices.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/validation.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/device_control_state.service.dart';
import 'package:fastybird_smart_panel/modules/devices/services/role_control_state_repository.dart';
import 'package:fastybird_smart_panel/modules/devices/services/property_timeseries.dart';
import 'package:fastybird_smart_panel/modules/displays/models/display.dart';
import 'package:fastybird_smart_panel/modules/displays/module.dart';
import 'package:fastybird_smart_panel/modules/displays/repositories/display.dart';
import 'package:fastybird_smart_panel/modules/system/module.dart';
import 'package:fastybird_smart_panel/modules/system/repositories/system_info.dart';
import 'package:fastybird_smart_panel/modules/system/repositories/throttle_status.dart';
import 'package:fastybird_smart_panel/modules/system/service.dart';
import 'package:fastybird_smart_panel/modules/weather/module.dart';
import 'package:fastybird_smart_panel/modules/weather/repositories/current.dart';
import 'package:fastybird_smart_panel/modules/weather/repositories/forecast.dart';
import 'package:fastybird_smart_panel/modules/weather/repositories/locations.dart';
import 'package:fastybird_smart_panel/modules/weather/service.dart';
import 'package:fastybird_smart_panel/modules/intents/export.dart';
import 'package:fastybird_smart_panel/modules/scenes/export.dart';
import 'package:fastybird_smart_panel/modules/spaces/export.dart';
import 'package:fastybird_smart_panel/modules/deck/export.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:uuid/uuid.dart';

/// Result of the initialization attempt
enum InitializationResult {
  /// Initialization was successful
  success,

  /// No backend URL configured - needs discovery
  needsDiscovery,

  /// Backend connection failed - should retry discovery
  connectionFailed,

  /// Initialization failed with error
  error,
}

/// Exception with additional context for initialization failures
class InitializationException implements Exception {
  final String message;
  final InitializationResult result;

  InitializationException(this.message, this.result);

  @override
  String toString() => message;
}

class StartupManagerService {
  static const String _apiSecretKey = 'api_secret';
  static const String _appUniqueIdentifierKey = 'app_uid';
  static const String _backendUrlKey = 'backend_url';

  final double screenWidth;
  final double screenHeight;
  final double pixelRatio;

  late String? _apiSecret;
  late ApiClient _apiClient;
  late Dio _apiIoService;

  late SocketService _socketClient;

  late EventBus _eventBus;

  late FlutterSecureStorage _securedStorage;
  late SecureStorageFallback _securedStorageFallback;

  String? _currentBackendUrl;

  StartupManagerService({
    required this.screenWidth,
    required this.screenHeight,
    required this.pixelRatio,
  }) {
    if (kDebugMode) {
      debugPrint(
        '[STARTUP MANAGER] Starting application with width: $screenWidth, height: $screenHeight, pixelRatio: $pixelRatio',
      );
    }

    if (Platform.isAndroid || Platform.isIOS) {
      _securedStorage = const FlutterSecureStorage();
    } else {
      _securedStorageFallback = SecureStorageFallback();
    }

    _socketClient = SocketService();

    _eventBus = EventBus();

    // Register core services
    locator.registerLazySingleton(
      () => NavigationService(),
    );
    locator.registerLazySingleton(
      () => ScreenService(
        screenWidth: screenWidth,
        screenHeight: screenHeight,
        pixelRatio: pixelRatio,
      ),
    );
    locator.registerLazySingleton(
      () => VisualDensityService(
        pixelRatio: pixelRatio,
        envDensity: const String.fromEnvironment('FB_DISPLAY_DENSITY'),
      ),
    );
    if (Platform.isAndroid || Platform.isIOS) {
      locator.registerSingleton(_securedStorage);
    } else {
      locator.registerSingleton(_securedStorageFallback);
    }
    locator.registerSingleton(_eventBus);
  }

  /// Get the currently configured backend URL
  String? get currentBackendUrl => _currentBackendUrl;

  /// Check if there's a stored backend URL
  Future<bool> hasStoredBackendUrl() async {
    final storedUrl = await _readStoredBackendUrl();
    return storedUrl != null && storedUrl.isNotEmpty;
  }

  /// Get the effective backend URL (from environment or storage)
  Future<String?> getEffectiveBackendUrl() async {
    // Priority 1: Environment variable (for embedded deployments)
    final bool isAndroidEmulator = Platform.isAndroid && !kReleaseMode;

    const String appHost = String.fromEnvironment(
      'FB_APP_HOST',
      defaultValue: '',
    );
    const String backendPort = String.fromEnvironment(
      'FB_BACKEND_PORT',
      defaultValue: '3000',
    );

    if (isAndroidEmulator) {
      return 'http://10.0.2.2:$backendPort/api/v1';
    }

    if (appHost.isNotEmpty) {
      String host;

      // Ensure appHost has a protocol prefix
      host = appHost;

      if (!host.startsWith('http://') && !host.startsWith('https://')) {
        host = 'http://$host';
      }

      return '$host:$backendPort/api/v1';
    }

    // Priority 2: Stored URL from previous discovery
    final storedUrl = await _readStoredBackendUrl();

    if (storedUrl != null && storedUrl.isNotEmpty) {
      return storedUrl;
    }

    return null;
  }

  /// Initialize with a specific backend URL
  Future<InitializationResult> initializeWithUrl(String backendUrl) async {
    if (kDebugMode) {
      debugPrint('[STARTUP MANAGER] Initializing with URL: $backendUrl');
    }

    _currentBackendUrl = backendUrl;

    // Initialize API client with this URL
    _apiIoService = Dio(
      BaseOptions(
        baseUrl: backendUrl,
        contentType: 'application/json',
      ),
    );

    // Add interceptor to serialize Freezed objects to JSON
    _apiIoService.interceptors.add(JsonSerializerInterceptor());

    // Add retry interceptor for network/server errors
    _apiIoService.interceptors.add(RetryInterceptor(_apiIoService));

    _apiClient = ApiClient(_apiIoService);

    return _performInitialization();
  }

  /// Initialize with a discovered backend
  Future<InitializationResult> initializeWithBackend(
    DiscoveredBackend backend,
  ) async {
    if (kDebugMode) {
      debugPrint(
        '[STARTUP MANAGER] Initializing with discovered backend: ${backend.name} at ${backend.baseUrl}',
      );
    }

    // Store the backend URL for future use
    await _storeBackendUrl(backend.baseUrl);

    return initializeWithUrl(backend.baseUrl);
  }

  /// Try to initialize with stored/configured URL
  Future<InitializationResult> tryInitialize() async {
    final backendUrl = await getEffectiveBackendUrl();

    if (backendUrl == null) {
      if (kDebugMode) {
        debugPrint(
          '[STARTUP MANAGER] No backend URL configured, needs discovery',
        );
      }
      return InitializationResult.needsDiscovery;
    }

    return initializeWithUrl(backendUrl);
  }

  Future<InitializationResult> _performInitialization() async {
    if (Platform.isAndroid || Platform.isIOS) {
      _apiSecret = await _securedStorage.read(key: _apiSecretKey);
    } else {
      _apiSecret = await _securedStorageFallback.read(key: _apiSecretKey);
    }

    if (_apiSecret != null) {
      _apiIoService.options.headers['Authorization'] = 'Bearer $_apiSecret';
    }

    // Unregister any existing modules before registering new ones
    // This ensures modules always use the current _apiClient, especially on retries
    _unregisterModulesIfNeeded();

    // Register modules with the new API client BEFORE initialization
    // This is needed because _initialize() uses DisplaysModuleService
    _registerModules();

    try {
      await _initialize();
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[BACKEND INIT] Backend initialization failed: $e');
      }

      // Clean up registered modules on failure
      _unregisterModulesIfNeeded();

      // Clear stored URL on connection failure to allow rediscovery
      await _clearStoredBackendUrl();

      return InitializationResult.connectionFailed;
    }

    final appUid = await _getAppUid();

    try {
      await Future.wait([
        locator.get<ConfigModuleService>().initialize(),
        locator.get<SystemModuleService>().initialize(appUid),
        locator.get<WeatherModuleService>().initialize(),
        locator.get<DevicesModuleService>().initialize(),
        locator.get<SpacesModuleService>().initialize(),
        locator.get<ScenesModuleService>().initialize(),
        locator.get<IntentsModuleService>().initialize(),
        locator.get<DashboardModuleService>().initialize(),
      ]);
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[REPOS INIT] Data storage initialization failed: $e');
      }

      // Clean up registered modules if initialization failed
      // This ensures they don't remain registered with a stale API client
      _unregisterModulesIfNeeded();

      // Clear stored URL on module initialization failure to allow rediscovery
      // This matches the behavior of connection failures (line 247)
      await _clearStoredBackendUrl();

      return InitializationResult.error;
    }

    String? apiSecret = _apiSecret;

    if (apiSecret != null && _currentBackendUrl != null) {
      _socketClient.initialize(
        apiSecret,
        _currentBackendUrl!,
        onTokenInvalid: () {
          if (kDebugMode) {
            debugPrint('[STARTUP MANAGER] Token invalidated via socket error, resetting to discovery');
          }
          resetToDiscovery();
        },
      );
    }

    return InitializationResult.success;
  }

  /// Unregister modules if they are already registered
  /// This ensures modules are cleaned up on retries or initialization failures
  void _unregisterModulesIfNeeded() {
    // Check if any module or repository is registered
    // We check multiple types because registration can fail partway through
    final hasAnyRegistration = locator.isRegistered<ConfigModuleService>() ||
        locator.isRegistered<DisplaysModuleService>() ||
        locator.isRegistered<DisplayRepository>() ||
        locator.isRegistered<DevicesModuleService>() ||
        locator.isRegistered<DevicesRepository>();

    if (!hasAnyRegistration) {
      return;
    }

    if (kDebugMode) {
      debugPrint(
        '[STARTUP MANAGER] Modules already registered, unregistering to use new API client',
      );
    }

    // Unregister all module services - call dispose() first to clean up socket handlers
    if (locator.isRegistered<ConfigModuleService>()) {
      try {
        final module = locator<ConfigModuleService>();
        module.dispose();
        locator.unregister<ConfigModuleService>();
      } catch (_) {}
    }
    if (locator.isRegistered<DisplaysModuleService>()) {
      try {
        final module = locator<DisplaysModuleService>();
        module.dispose();
        locator.unregister<DisplaysModuleService>();
      } catch (_) {}
    }
    if (locator.isRegistered<SystemModuleService>()) {
      try {
        final module = locator<SystemModuleService>();
        module.dispose();
        locator.unregister<SystemModuleService>();
      } catch (_) {}
    }
    if (locator.isRegistered<WeatherModuleService>()) {
      try {
        final module = locator<WeatherModuleService>();
        module.dispose();
        locator.unregister<WeatherModuleService>();
      } catch (_) {}
    }
    if (locator.isRegistered<DevicesModuleService>()) {
      try {
        final module = locator<DevicesModuleService>();
        module.dispose();
        locator.unregister<DevicesModuleService>();
      } catch (_) {}
    }
    if (locator.isRegistered<DashboardModuleService>()) {
      try {
        final module = locator<DashboardModuleService>();
        module.dispose();
        locator.unregister<DashboardModuleService>();
      } catch (_) {}
    }
    if (locator.isRegistered<SpacesModuleService>()) {
      try {
        final module = locator<SpacesModuleService>();
        module.dispose();
        locator.unregister<SpacesModuleService>();
      } catch (_) {}
    }
    if (locator.isRegistered<ScenesModuleService>()) {
      try {
        final module = locator<ScenesModuleService>();
        module.dispose();
        locator.unregister<ScenesModuleService>();
      } catch (_) {}
    }
    if (locator.isRegistered<IntentsModuleService>()) {
      try {
        final module = locator<IntentsModuleService>();
        module.dispose();
        locator.unregister<IntentsModuleService>();
      } catch (_) {}
    }

    // Unregister all repositories and services registered by modules
    // Config module repositories (LanguageConfigRepository moved to system module)
    // WeatherConfigRepository moved to weather module
    // SystemConfigRepository is registered by system module

    // Displays module repositories
    if (locator.isRegistered<DisplayRepository>()) {
      try {
        locator.unregister<DisplayRepository>();
      } catch (_) {}
    }

    // System module repositories and services
    if (locator.isRegistered<SystemInfoRepository>()) {
      try {
        locator.unregister<SystemInfoRepository>();
      } catch (_) {}
    }
    if (locator.isRegistered<ThrottleStatusRepository>()) {
      try {
        locator.unregister<ThrottleStatusRepository>();
      } catch (_) {}
    }
    if (locator.isRegistered<SystemService>()) {
      try {
        locator.unregister<SystemService>();
      } catch (_) {}
    }

    // Weather module repositories and services
    if (locator.isRegistered<CurrentWeatherRepository>()) {
      try {
        locator.unregister<CurrentWeatherRepository>();
      } catch (_) {}
    }
    if (locator.isRegistered<ForecastWeatherRepository>()) {
      try {
        locator.unregister<ForecastWeatherRepository>();
      } catch (_) {}
    }
    if (locator.isRegistered<LocationsRepository>()) {
      try {
        locator.unregister<LocationsRepository>();
      } catch (_) {}
    }
    if (locator.isRegistered<WeatherService>()) {
      try {
        locator.unregister<WeatherService>();
      } catch (_) {}
    }

    // Devices module repositories and services
    if (locator.isRegistered<DevicesRepository>()) {
      try {
        locator.unregister<DevicesRepository>();
      } catch (_) {}
    }
    if (locator.isRegistered<DeviceControlsRepository>()) {
      try {
        locator.unregister<DeviceControlsRepository>();
      } catch (_) {}
    }
    if (locator.isRegistered<ChannelsRepository>()) {
      try {
        locator.unregister<ChannelsRepository>();
      } catch (_) {}
    }
    if (locator.isRegistered<ChannelControlsRepository>()) {
      try {
        locator.unregister<ChannelControlsRepository>();
      } catch (_) {}
    }
    if (locator.isRegistered<ChannelPropertiesRepository>()) {
      try {
        locator.unregister<ChannelPropertiesRepository>();
      } catch (_) {}
    }
    if (locator.isRegistered<DeviceValidationRepository>()) {
      try {
        locator.unregister<DeviceValidationRepository>();
      } catch (_) {}
    }
    if (locator.isRegistered<RoleControlStateRepository>()) {
      try {
        locator<RoleControlStateRepository>().dispose();
        locator.unregister<RoleControlStateRepository>();
      } catch (_) {}
    }
    if (locator.isRegistered<DeviceControlStateService>()) {
      try {
        locator<DeviceControlStateService>().dispose();
        locator.unregister<DeviceControlStateService>();
      } catch (_) {}
    }
    if (locator.isRegistered<DevicesService>()) {
      try {
        locator.unregister<DevicesService>();
      } catch (_) {}
    }

    // Dashboard module repositories and services
    if (locator.isRegistered<PagesRepository>()) {
      try {
        locator.unregister<PagesRepository>();
      } catch (_) {}
    }
    if (locator.isRegistered<CardsRepository>()) {
      try {
        locator.unregister<CardsRepository>();
      } catch (_) {}
    }
    if (locator.isRegistered<TilesRepository>()) {
      try {
        locator.unregister<TilesRepository>();
      } catch (_) {}
    }
    if (locator.isRegistered<DataSourcesRepository>()) {
      try {
        locator.unregister<DataSourcesRepository>();
      } catch (_) {}
    }
    if (locator.isRegistered<DashboardService>()) {
      try {
        locator.unregister<DashboardService>();
      } catch (_) {}
    }

    // Spaces module repositories and services
    if (locator.isRegistered<SpacesRepository>()) {
      try {
        locator.unregister<SpacesRepository>();
      } catch (_) {}
    }
    if (locator.isRegistered<LightTargetsRepository>()) {
      try {
        locator<LightTargetsRepository>().dispose();
        locator.unregister<LightTargetsRepository>();
      } catch (_) {}
    }
    if (locator.isRegistered<ClimateTargetsRepository>()) {
      try {
        locator<ClimateTargetsRepository>().dispose();
        locator.unregister<ClimateTargetsRepository>();
      } catch (_) {}
    }
    if (locator.isRegistered<MediaTargetsRepository>()) {
      try {
        locator<MediaTargetsRepository>().dispose();
        locator.unregister<MediaTargetsRepository>();
      } catch (_) {}
    }
    if (locator.isRegistered<CoversTargetsRepository>()) {
      try {
        locator<CoversTargetsRepository>().dispose();
        locator.unregister<CoversTargetsRepository>();
      } catch (_) {}
    }
    if (locator.isRegistered<SpaceStateRepository>()) {
      try {
        locator<SpaceStateRepository>().dispose();
        locator.unregister<SpaceStateRepository>();
      } catch (_) {}
    }
    if (locator.isRegistered<SpacesService>()) {
      try {
        locator.unregister<SpacesService>();
      } catch (_) {}
    }

    // Scenes module repositories and services
    if (locator.isRegistered<ScenesRepository>()) {
      try {
        locator.unregister<ScenesRepository>();
      } catch (_) {}
    }
    if (locator.isRegistered<ActionsRepository>()) {
      try {
        locator.unregister<ActionsRepository>();
      } catch (_) {}
    }
    if (locator.isRegistered<ScenesService>()) {
      try {
        locator.unregister<ScenesService>();
      } catch (_) {}
    }

    // Intents module repositories and services
    if (locator.isRegistered<IntentsRepository>()) {
      try {
        locator.unregister<IntentsRepository>();
      } catch (_) {}
    }
    if (locator.isRegistered<IntentOverlayService>()) {
      try {
        locator.unregister<IntentOverlayService>();
      } catch (_) {}
    }

    // Deck module services
    if (locator.isRegistered<DeckModuleService>()) {
      try {
        locator<DeckModuleService>().dispose();
        locator.unregister<DeckModuleService>();
      } catch (_) {}
    }
    if (locator.isRegistered<DeckService>()) {
      try {
        locator.unregister<DeckService>();
      } catch (_) {}
    }
    if (locator.isRegistered<IntentsService>()) {
      try {
        locator.unregister<IntentsService>();
      } catch (_) {}
    }
    if (locator.isRegistered<PropertyTimeseriesService>()) {
      try {
        locator.unregister<PropertyTimeseriesService>();
      } catch (_) {}
    }

    // Unregister API client and Dio instance
    if (locator.isRegistered<ApiClient>()) {
      try {
        locator.unregister<ApiClient>();
      } catch (_) {}
    }
    if (locator.isRegistered<Dio>()) {
      try {
        locator.unregister<Dio>();
      } catch (_) {}
    }

    // Unregister SocketService
    if (locator.isRegistered<SocketService>()) {
      try {
        locator.unregister<SocketService>();
      } catch (_) {}
    }

    // Unregister SystemActionsService
    if (locator.isRegistered<SystemActionsService>()) {
      try {
        locator.unregister<SystemActionsService>();
      } catch (_) {}
    }

    // Note: Core services like ScreenService, NavigationService, VisualDensityService
    // are NOT unregistered here as they persist across module reinitializations.
    // They are registered once at app startup in initializeCoreServices() and
    // remain active for the app's lifetime.
  }

  /// Register modules with the current API client
  /// This should only be called after successful backend connection
  void _registerModules() {
    // Register modules with the new API client
    var configModuleService = ConfigModuleService(
      apiClient: _apiClient,
      dio: _apiIoService,
      socketService: _socketClient,
    );
    var displaysModuleService = DisplaysModuleService(
      apiClient: _apiClient,
      socketService: _socketClient,
      dio: _apiIoService,
    );

    // Set up token refresh callbacks for displays module
    displaysModuleService.setTokenCallbacks(
      onTokenRefreshed: _onTokenRefreshed,
      getCurrentToken: () => _apiSecret,
    );

    // Add token refresh interceptor to Dio instance
    // This must be done after the displays module is created and callbacks are set
    final displayRepository = displaysModuleService.displayRepository;
    _apiIoService.interceptors.add(
      TokenRefreshInterceptor(displayRepository),
    );

    var systemModuleService = SystemModuleService(
      apiClient: _apiClient,
      socketService: _socketClient,
      eventBus: _eventBus,
    );
    var weatherModuleService = WeatherModuleService(
      apiClient: _apiClient,
      socketService: _socketClient,
    );
    // IntentsModuleService must be created before DevicesModuleService and SpacesModuleService
    // because they depend on IntentsRepository for intent-based optimistic UI
    var intentsModuleService = IntentsModuleService(
      socketService: _socketClient,
    );
    var devicesModuleService = DevicesModuleService(
      apiClient: _apiClient,
      socketService: _socketClient,
    );
    var dashboardModuleService = DashboardModuleService(
      apiClient: _apiClient,
      socketService: _socketClient,
    );
    var scenesModuleService = ScenesModuleService(
      apiClient: _apiClient,
      socketService: _socketClient,
    );
    var spacesModuleService = SpacesModuleService(
      apiClient: _apiClient,
      socketService: _socketClient,
    );

    locator.registerSingleton(configModuleService);
    locator.registerSingleton(displaysModuleService);
    locator.registerSingleton(systemModuleService);
    locator.registerSingleton(weatherModuleService);
    locator.registerSingleton(devicesModuleService);
    locator.registerSingleton(dashboardModuleService);
    locator.registerSingleton(scenesModuleService);
    locator.registerSingleton(intentsModuleService);
    locator.registerSingleton(spacesModuleService);

    // Property timeseries service
    var propertyTimeseriesService = PropertyTimeseriesService(dio: _apiIoService);
    locator.registerSingleton(propertyTimeseriesService);

    // Deck module services
    var deckModuleService = DeckModuleService(
      eventBus: _eventBus,
      dashboardService: locator<DashboardService>(),
      devicesService: locator<DevicesService>(),
      scenesService: locator<ScenesService>(),
      channelPropertiesRepository: locator<ChannelPropertiesRepository>(),
    );
    locator.registerSingleton(deckModuleService);

    // Api client
    locator.registerSingleton(_apiIoService);
    locator.registerSingleton(_apiClient);

    // Sockets client
    locator.registerSingleton(_socketClient);

    // Misc services
    locator.registerSingleton<SystemActionsService>(
      SystemActionsService(_eventBus),
    );
  }

  /// Callback for when token is refreshed - persists the new token
  Future<void> _onTokenRefreshed(String newToken) async {
    if (Platform.isAndroid || Platform.isIOS) {
      await _securedStorage.write(key: _apiSecretKey, value: newToken);
    } else {
      await _securedStorageFallback.write(key: _apiSecretKey, value: newToken);
    }
    _apiSecret = newToken;

    // Also reinitialize the socket with the new token
    if (_currentBackendUrl != null) {
      _socketClient.initialize(newToken, _currentBackendUrl!);
    }

    if (kDebugMode) {
      debugPrint('[STARTUP MANAGER] Token refreshed and persisted successfully');
    }
  }

  Future<void> _initialize() async {
    final backendReady = await _waitForBackend();

    if (!backendReady) {
      if (kDebugMode) {
        debugPrint(
          '[CHECK BACKEND] Checking backend connection failed.',
        );
      }

      throw Exception(
        'Backend connection check failed. Ensure the server is running.',
      );
    }

    // Try to initialize with stored token if available
    if (_apiSecret != null) {
      final success = await _tryInitializeWithStoredToken();

      if (success) {
        if (kDebugMode) {
          debugPrint('[INITIALIZE] Successfully initialized with stored token');
        }
        return;
      }

      // Token invalid, expired, or display not found - need to re-register
      if (kDebugMode) {
        debugPrint(
          '[INITIALIZE] Stored token invalid, expired, or display not found - re-registering display',
        );
      }

      // Clear the invalid token (only the token, not backend URL or other state)
      await _clearStoredApiSecret();

      // Clear the display model to ensure no stale data remains
      // The display model will be set fresh from the registration response
      try {
        final displaysModule = locator.get<DisplaysModuleService>();
        displaysModule.displayRepository.setDisplay(null);
        if (kDebugMode) {
          debugPrint('[INITIALIZE] Cleared display model before re-registration');
        }
      } catch (e) {
        // Module might not be registered yet, which is fine
        // The new registration will set the display model fresh anyway
        if (kDebugMode) {
          debugPrint(
            '[INITIALIZE] Could not clear display model (module not registered yet): $e',
          );
        }
      }
    }

    // No valid token (lost, corrupted, or invalid) - register the display
    // This will check permit join status and throw InitializationException if closed
    await _registerDisplay();
  }

  /// Try to initialize using the stored API secret/token
  /// Returns true if successful, false if token is invalid or display not found
  Future<bool> _tryInitializeWithStoredToken() async {
    if (kDebugMode) {
      debugPrint('[TRY STORED TOKEN] Attempting to load display with stored token');
    }

    try {
      // Get the displays module service (it's already registered in _registerModules)
      // But at this point modules aren't registered yet, so we need to create a temporary
      // displays module service to test the token
      final displaysModule = locator.get<DisplaysModuleService>();
      final result = await displaysModule.initializeWithStoredToken();

      switch (result) {
        case FetchDisplayResult.success:
          if (kDebugMode) {
            debugPrint('[TRY STORED TOKEN] Display loaded successfully');
          }
          return true;

        case FetchDisplayResult.authenticationFailed:
          if (kDebugMode) {
            debugPrint(
              '[TRY STORED TOKEN] Authentication failed - token invalid, revoked, or deleted',
            );
          }
          return false;

        case FetchDisplayResult.notFound:
          if (kDebugMode) {
            debugPrint(
              '[TRY STORED TOKEN] Display not found - display may have been deleted',
            );
          }
          return false;

        case FetchDisplayResult.error:
          if (kDebugMode) {
            debugPrint('[TRY STORED TOKEN] Error fetching display');
          }
          return false;
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[TRY STORED TOKEN] Exception: $e');
      }
      return false;
    }
  }

  /// Clear the stored API secret
  Future<void> _clearStoredApiSecret() async {
    if (Platform.isAndroid || Platform.isIOS) {
      await _securedStorage.delete(key: _apiSecretKey);
    } else {
      await _securedStorageFallback.delete(key: _apiSecretKey);
    }
    _apiSecret = null;
    _apiIoService.options.headers.remove('Authorization');
  }

  /// Register the display with the backend
  Future<void> _registerDisplay() async {
    if (kDebugMode) {
      debugPrint('[REGISTER DISPLAY] Registering display with backend');
    }

    try {
      // Check registration status before attempting registration
      await _checkRegistrationStatus();

      // Get device information
      final macAddress = await AppInfo.getMacAddress();
      final appVersion = await AppInfo.getAppVersionInfo();

      // Detect audio capabilities
      final audioOutputSupported = await AppInfo.hasAudioOutputSupport();
      final audioInputSupported = await AppInfo.hasAudioInputSupport();

      // Calculate grid dimensions
      final screenService = locator.get<ScreenService>();

      final registrationData = DisplaysModuleRegisterDisplay(
        macAddress: macAddress.toUpperCase(),
        version: appVersion.version,
        build: appVersion.build,
        screenWidth: screenWidth.toInt(),
        screenHeight: screenHeight.toInt(),
        pixelRatio: pixelRatio,
        unitSize: screenService.unitSize,
        rows: screenService.defaultRows,
        cols: screenService.defaultColumns,
        audioOutputSupported: audioOutputSupported,
        audioInputSupported: audioInputSupported,
      );

      if (kDebugMode) {
        debugPrint('[REGISTER DISPLAY] Registration data:');
        debugPrint('  macAddress: ${macAddress.toUpperCase()}');
        debugPrint('  version: ${appVersion.version}');
        debugPrint('  build: ${appVersion.build}');
        debugPrint('  screenWidth: ${screenWidth.toInt()}');
        debugPrint('  screenHeight: ${screenHeight.toInt()}');
        debugPrint('  pixelRatio: $pixelRatio');
        debugPrint('  unitSize: ${screenService.unitSize}');
        debugPrint('  rows: ${screenService.defaultRows}');
        debugPrint('  cols: ${screenService.defaultColumns}');
        debugPrint('  audioOutputSupported: $audioOutputSupported');
        debugPrint('  audioInputSupported: $audioInputSupported');
      }

      final response = await _apiClient.displaysModule.createDisplaysModuleRegister(
        userAgent: 'FastyBird Smart Panel/${appVersion.version}',
        body: DisplaysModuleReqRegisterDisplay(data: registrationData),
      );

      if (response.response.statusCode == 201) {
        final accessToken = response.data.data.accessToken;
        final display = response.data.data.display;

        if (kDebugMode) {
          debugPrint(
            '[REGISTER DISPLAY] Display registered successfully with ID: ${display.id}',
          );
        }

        // Store the access token
        if (Platform.isAndroid || Platform.isIOS) {
          await _securedStorage.write(key: _apiSecretKey, value: accessToken);
        } else {
          await _securedStorageFallback.write(
            key: _apiSecretKey,
            value: accessToken,
          );
        }

        _apiSecret = accessToken;
        _apiIoService.options.headers['Authorization'] = 'Bearer $accessToken';

        // Initialize displays module with the registration data
        final displaysModule = locator.get<DisplaysModuleService>();
        displaysModule.initializeFromRegistration(
          DisplayModel(
            id: display.id,
            macAddress: display.macAddress,
            version: display.version,
            build: display.build,
            name: display.name,
            screenWidth: display.screenWidth,
            screenHeight: display.screenHeight,
            pixelRatio: display.pixelRatio.toDouble(),
            unitSize: display.unitSize.toDouble(),
            rows: display.rows,
            cols: display.cols,
            darkMode: display.darkMode,
            brightness: display.brightness,
            screenLockDuration: display.screenLockDuration,
            screenSaver: display.screenSaver,
            audioOutputSupported: display.audioOutputSupported,
            audioInputSupported: display.audioInputSupported,
            speaker: display.speaker,
            speakerVolume: display.speakerVolume,
            microphone: display.microphone,
            microphoneVolume: display.microphoneVolume,
            createdAt: display.createdAt,
            updatedAt: display.updatedAt,
          ),
        );
      } else {
        throw Exception(
          'Failed to register display: Unexpected response status',
        );
      }
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[REGISTER DISPLAY] Registration failed: ${e.response?.statusCode} - ${e.message}',
        );
        debugPrint('[REGISTER DISPLAY] Response body: ${e.response?.data}');
      }

      // Handle specific error cases
      if (e.response?.statusCode == 403) {
        throw InitializationException(
          'Registration is not currently permitted. Please activate permit join in the admin panel.',
          InitializationResult.error,
        );
      } else if (e.response?.statusCode == 409) {
        throw InitializationException(
          'Display already registered with this IP address. Please contact the administrator.',
          InitializationResult.error,
        );
      }

      throw InitializationException(
        'Display registration failed: ${e.response?.data ?? e.message}',
        InitializationResult.error,
      );
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[REGISTER DISPLAY] Unexpected error: $e');
      }

      if (e is InitializationException) {
        rethrow;
      }

      throw InitializationException(
        'Display registration failed: $e',
        InitializationResult.error,
      );
    }
  }

  /// Check if the backend URL is localhost (127.0.0.1, ::1, or localhost)
  bool _isLocalhost(String backendUrl) {
    try {
      final uri = Uri.parse(backendUrl);
      final host = uri.host.toLowerCase();

      // Check for localhost variants
      return host == 'localhost' ||
          host == '127.0.0.1' ||
          host == '::1' ||
          host == '[::1]';
    } catch (_) {
      return false;
    }
  }

  /// Check registration status before attempting registration
  /// Throws InitializationException if registration is not open
  /// Note: Localhost registrations in ALL_IN_ONE/COMBINED modes are allowed
  /// even if permit join is not active, so we skip the check for localhost
  Future<void> _checkRegistrationStatus() async {
    // Skip permit join check for localhost connections
    // The backend will allow localhost registrations even if permit join is disabled
    if (_currentBackendUrl != null && _isLocalhost(_currentBackendUrl!)) {
      if (kDebugMode) {
        debugPrint(
          '[CHECK REGISTRATION STATUS] Localhost connection detected, skipping permit join check',
        );
      }
      return;
    }

    if (kDebugMode) {
      debugPrint('[CHECK REGISTRATION STATUS] Checking if registration is open');
    }

    try {
      final statusResponse = await _apiClient.displaysModule.getDisplaysModuleRegisterStatus();

      if (statusResponse.response.statusCode == 200) {
        final isOpen = statusResponse.data.data.open;

        if (kDebugMode) {
          debugPrint(
            '[CHECK REGISTRATION STATUS] Registration status: ${isOpen ? "open" : "closed"}',
          );
          if (statusResponse.data.data.remainingTime != null) {
            final remainingSeconds =
                (statusResponse.data.data.remainingTime! / 1000).round();
            debugPrint(
              '[CHECK REGISTRATION STATUS] Remaining time: ${remainingSeconds}s',
            );
          }
        }

        // If registration is closed, throw an exception
        if (!isOpen) {
          throw InitializationException(
            'Registration is not currently permitted. Please activate permit join in the admin panel.',
            InitializationResult.error,
          );
        }
      }
    } on DioException catch (e) {
      // If status endpoint fails, we'll still try to register
      // The registration endpoint will return the appropriate error
      if (kDebugMode) {
        debugPrint(
          '[CHECK REGISTRATION STATUS] Status check failed: ${e.response?.statusCode} - ${e.message}',
        );
        debugPrint(
          '[CHECK REGISTRATION STATUS] Will attempt registration anyway',
        );
      }
    } catch (e) {
      // Re-throw InitializationException
      if (e is InitializationException) {
        rethrow;
      }

      // For other errors, log and continue with registration attempt
      if (kDebugMode) {
        debugPrint(
          '[CHECK REGISTRATION STATUS] Unexpected error: $e',
        );
        debugPrint(
          '[CHECK REGISTRATION STATUS] Will attempt registration anyway',
        );
      }
    }
  }

  Future<bool> _waitForBackend({
    Duration timeout = const Duration(seconds: 30),
  }) async {
    final stopwatch = Stopwatch()..start();

    while (stopwatch.elapsed < timeout) {
      final reachable = await _pingBackend();

      if (reachable) {
        return true;
      }

      await Future.delayed(const Duration(seconds: 1));
    }

    return false;
  }

  Future<bool> _pingBackend() async {
    try {
      final systemInfoResponse =
          await _apiClient.systemModule.getSystemModuleSystemHealth();

      return systemInfoResponse.response.statusCode == 200;
    } catch (_) {
      return false;
    }
  }

  Future<String> _getAppUid() async {
    late String? appUid;

    if (Platform.isAndroid || Platform.isIOS) {
      appUid = await _securedStorage.read(key: _appUniqueIdentifierKey);
    } else {
      appUid = await _securedStorageFallback.read(key: _appUniqueIdentifierKey);
    }

    if (appUid == null) {
      appUid = const Uuid().v4();

      // Store app UID
      if (Platform.isAndroid || Platform.isIOS) {
        await _securedStorage.write(
          key: _appUniqueIdentifierKey,
          value: appUid,
        );
      } else {
        await _securedStorageFallback.write(
          key: _appUniqueIdentifierKey,
          value: appUid,
        );
      }
    }

    return appUid;
  }

  Future<String?> _readStoredBackendUrl() async {
    if (Platform.isAndroid || Platform.isIOS) {
      return await _securedStorage.read(key: _backendUrlKey);
    } else {
      return await _securedStorageFallback.read(key: _backendUrlKey);
    }
  }

  /// Store a backend URL for future use
  Future<void> storeBackendUrl(String url) async {
    if (Platform.isAndroid || Platform.isIOS) {
      await _securedStorage.write(key: _backendUrlKey, value: url);
    } else {
      await _securedStorageFallback.write(key: _backendUrlKey, value: url);
    }
  }

  Future<void> _storeBackendUrl(String url) async {
    if (Platform.isAndroid || Platform.isIOS) {
      await _securedStorage.write(key: _backendUrlKey, value: url);
    } else {
      await _securedStorageFallback.write(key: _backendUrlKey, value: url);
    }
  }

  Future<void> _clearStoredBackendUrl() async {
    if (Platform.isAndroid || Platform.isIOS) {
      await _securedStorage.delete(key: _backendUrlKey);
    } else {
      await _securedStorageFallback.delete(key: _backendUrlKey);
    }
  }

  /// Reset the app to discovery state
  /// This clears the token and backend URL, disconnects sockets, and triggers discovery
  Future<void> resetToDiscovery() async {
    if (kDebugMode) {
      debugPrint('[STARTUP MANAGER] Resetting to discovery state');
    }

    // Clear token
    await _clearStoredApiSecret();

    // Clear backend URL to force rediscovery
    await _clearStoredBackendUrl();

    // Disconnect sockets
    _socketClient.dispose();

    // Clear display model if module is registered
    try {
      final displaysModule = locator.get<DisplaysModuleService>();
      displaysModule.displayRepository.setDisplay(null);
    } catch (e) {
      // Module might not be registered, which is fine
      if (kDebugMode) {
        debugPrint('[STARTUP MANAGER] Could not clear display model: $e');
      }
    }

    // Emit event to trigger app state change to discovery
    _eventBus.fire(ResetToDiscoveryEvent());
  }
}

/// Event fired when app should reset to discovery state
class ResetToDiscoveryEvent {}
