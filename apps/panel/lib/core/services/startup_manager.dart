import 'dart:io';

import 'package:dio/dio.dart';
import 'package:event_bus/event_bus.dart';
import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/models/discovered_backend.dart';
import 'package:fastybird_smart_panel/core/services/navigation.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/core/services/system_actions.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/secure_storage.dart';
import 'package:fastybird_smart_panel/modules/config/module.dart';
import 'package:fastybird_smart_panel/modules/dashboard/module.dart';
import 'package:fastybird_smart_panel/modules/devices/module.dart';
import 'package:fastybird_smart_panel/modules/system/module.dart';
import 'package:fastybird_smart_panel/modules/weather/module.dart';
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
      _apiIoService.options.headers['X-Display-Secret'] = _apiSecret;
    }

    try {
      await _initialize();
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[BACKEND INIT] Backend initialization failed: $e');
      }

      // Clear stored URL on connection failure to allow rediscovery
      await _clearStoredBackendUrl();

      return InitializationResult.connectionFailed;
    }

    // Unregister any existing modules before registering new ones
    // This ensures modules always use the current _apiClient, especially on retries
    _unregisterModulesIfNeeded();

    // Register modules with the new API client after successful connection
    _registerModules();

    final appUid = await _getAppUid();

    try {
      await Future.wait([
        locator.get<ConfigModuleService>().initialize(),
        locator.get<SystemModuleService>().initialize(appUid),
        locator.get<WeatherModuleService>().initialize(),
        locator.get<DevicesModuleService>().initialize(),
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

    if (apiSecret != null) {
      _socketClient.initialize(apiSecret);
    }

    return InitializationResult.success;
  }

  /// Unregister modules if they are already registered
  /// This ensures modules are cleaned up on retries or initialization failures
  void _unregisterModulesIfNeeded() {
    if (!locator.isRegistered<ConfigModuleService>()) {
      return;
    }

    if (kDebugMode) {
      debugPrint(
        '[STARTUP MANAGER] Modules already registered, unregistering to use new API client',
      );
    }

    // Unregister all module services
    try {
      locator.unregister<ConfigModuleService>();
    } catch (_) {}
    try {
      locator.unregister<SystemModuleService>();
    } catch (_) {}
    try {
      locator.unregister<WeatherModuleService>();
    } catch (_) {}
    try {
      locator.unregister<DevicesModuleService>();
    } catch (_) {}
    try {
      locator.unregister<DashboardModuleService>();
    } catch (_) {}

    // Unregister API client and Dio instance
    try {
      locator.unregister<ApiClient>();
    } catch (_) {}
    try {
      locator.unregister<Dio>();
    } catch (_) {}

    // Unregister SocketService
    try {
      locator.unregister<SocketService>();
    } catch (_) {}

    // Unregister SystemActionsService
    try {
      locator.unregister<SystemActionsService>();
    } catch (_) {}
  }

  /// Register modules with the current API client
  /// This should only be called after successful backend connection
  void _registerModules() {
    // Register modules with the new API client
    var configModuleService = ConfigModuleService(
      apiClient: _apiClient,
      socketService: _socketClient,
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
    var devicesModuleService = DevicesModuleService(
      apiClient: _apiClient,
      socketService: _socketClient,
    );
    var dashboardModuleService = DashboardModuleService(
      apiClient: _apiClient,
      socketService: _socketClient,
    );

    locator.registerSingleton(configModuleService);
    locator.registerSingleton(systemModuleService);
    locator.registerSingleton(weatherModuleService);
    locator.registerSingleton(devicesModuleService);
    locator.registerSingleton(dashboardModuleService);

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

    if (_apiSecret == null) {
      await _obtainApiSecret();
      await _notifyDisplayProfile();
    } else {
      await _checkApiConnection();
      await _notifyDisplayInstance();
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

  Future<void> _obtainApiSecret() async {
    // TODO: Update to use displays module API once client is generated
    // The displays module registration endpoint is at /displays-module/displays/register
    // For now, this functionality is disabled until the API client is regenerated
    throw UnimplementedError(
      'Display registration is not yet implemented. The displays module API client needs to be regenerated.',
    );
  }

  Future<void> _notifyDisplayInstance() async {
    // TODO: Update to use displays module API once client is generated
    // The displays module update endpoint is at /displays-module/displays/:id
    // For now, this functionality is disabled until the API client is regenerated
    if (kDebugMode) {
      debugPrint('[NOTIFY DISPLAY INSTANCE] Skipped - displays module API not yet available');
    }
  }

  Future<void> _notifyDisplayProfile() async {
    // TODO: Display profiles functionality has been moved to displays module
    // This functionality is now handled through the display registration/update endpoints
    // For now, this functionality is disabled until the API client is regenerated
    if (kDebugMode) {
      debugPrint('[NOTIFY DISPLAY PROFILE] Skipped - displays module API not yet available');
    }
  }

  Future<void> _checkApiConnection() async {
    try {
      // Try to fetch the display profile
      await _apiClient.authModule.getAuthModuleProfile();
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[CHECK SECRET] API Error: ${e.response?.statusCode} - ${e.message}',
        );
      }

      if (e.response?.statusCode == 401 || e.response?.statusCode == 403) {
        if (kDebugMode) {
          debugPrint('[CHECK SECRET] Stored secret key is not valid');
        }

        if (Platform.isAndroid || Platform.isIOS) {
          _securedStorage.delete(key: _apiSecretKey);
        } else {
          _securedStorageFallback.delete(key: _apiSecretKey);
        }
        _apiSecret = null;

        await _initialize();
      } else {
        throw Exception(
          'Backend connection check failed. Ensure the server is running.',
        );
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[CHECK SECRET] Unexpected error: ${e.toString()}');
      }

      throw StateError('Unexpected backend error.');
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
}
