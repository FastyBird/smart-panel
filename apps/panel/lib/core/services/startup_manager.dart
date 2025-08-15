import 'dart:io';

import 'package:dio/dio.dart';
import 'package:event_bus/event_bus.dart';
import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/api/models/auth_module_register_display.dart';
import 'package:fastybird_smart_panel/api/models/auth_module_req_register_display.dart';
import 'package:fastybird_smart_panel/api/models/system_module_create_display_profile.dart';
import 'package:fastybird_smart_panel/api/models/system_module_display_profile.dart';
import 'package:fastybird_smart_panel/api/models/system_module_req_create_display_profile.dart';
import 'package:fastybird_smart_panel/api/models/users_module_req_update_display_instance.dart';
import 'package:fastybird_smart_panel/api/models/users_module_update_display_instance.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/navigation.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/core/services/system_actions.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/application.dart';
import 'package:fastybird_smart_panel/core/utils/secure_storage.dart';
import 'package:fastybird_smart_panel/modules/config/module.dart';
import 'package:fastybird_smart_panel/modules/dashboard/module.dart';
import 'package:fastybird_smart_panel/modules/devices/module.dart';
import 'package:fastybird_smart_panel/modules/system/module.dart';
import 'package:fastybird_smart_panel/modules/weather/module.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:uuid/uuid.dart';

class StartupManagerService {
  static const String _apiSecretKey = 'api_secret';
  static const String _appUniqueIdentifierKey = 'app_uid';

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

    final bool isAndroidEmulator = Platform.isAndroid && !kReleaseMode;

    const String appHost = String.fromEnvironment(
      'FB_APP_HOST',
      defaultValue: 'http://localhost',
    );
    const String backendPort = String.fromEnvironment(
      'FB_BACKEND_PORT',
      defaultValue: '3000',
    );

    final String host = isAndroidEmulator ? 'http://10.0.2.2' : appHost;

    final String baseUrl = '$host:$backendPort/api/v1';

    if (kDebugMode) {
      debugPrint(
        '[STARTUP MANAGER] API base URL: $baseUrl',
      );
    }

    _apiIoService = Dio(
      BaseOptions(
        baseUrl: baseUrl,
        contentType: 'application/json',
      ),
    );

    _apiClient = ApiClient(_apiIoService);

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

    // Register modules
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

  Future<void> initialize() async {
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

      throw StateError(
        'Backend initialization failed. Ensure the server is running.',
      );
    }

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

      throw ArgumentError(
        'Data storage initialization failed. Ensure the server is running.',
      );
    }

    String? apiSecret = _apiSecret;

    if (apiSecret != null) {
      _socketClient.initialize(apiSecret);
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
    final appUid = await _getAppUid();
    final mac = await AppInfo.getMacAddress();
    final versionInfo = await AppInfo.getAppVersionInfo();

    try {
      var registerResponse =
          await _apiClient.authModule.createAuthModuleRegisterDisplay(
        userAgent: 'FlutterApp',
        body: AuthModuleReqRegisterDisplay(
          data: AuthModuleRegisterDisplay(
            uid: appUid,
            mac: mac,
            version: versionInfo.version,
            build: versionInfo.build,
          ),
        ),
      );

      String apiSecret = registerResponse.data.data.secret;

      // Store API secret key
      if (Platform.isAndroid || Platform.isIOS) {
        await _securedStorage.write(
          key: _apiSecretKey,
          value: apiSecret,
        );
      } else {
        await _securedStorageFallback.write(
          key: _apiSecretKey,
          value: apiSecret,
        );
      }

      // Update API secret key in the API client
      _apiIoService.options.headers['X-Display-Secret'] = apiSecret;
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[OBTAIN SECRET] API error: ${e.response?.statusCode} - ${e.message}',
        );
      }

      if (e.response?.statusCode == 403) {
        throw StateError(
          'Application reset is required. Please reset the app.',
        );
      }

      throw Exception(
        'Backend initialization failed. Ensure the server is running.',
      );
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[OBTAIN SECRET] Unexpected error: ${e.toString()}');
      }

      throw StateError('Unexpected backend error.');
    }
  }

  Future<void> _notifyDisplayInstance() async {
    final appUid = await _getAppUid();

    String? existingInstanceId;

    try {
      final existingProfile = await _apiClient.usersModule
          .getUsersModuleDisplayInstanceByUid(uid: appUid);

      existingInstanceId = existingProfile.data.data.id;
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[READ DISPLAY INSTANCE] API error: ${e.response?.statusCode} - ${e.message}',
        );
      }

      if (e.response?.statusCode != 404) {
        throw Exception(
          'Reading display instance failed. Ensure the server is running.',
        );
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[READ DISPLAY INSTANCE] Unexpected error: ${e.toString()}');
      }

      throw StateError('Unexpected backend error.');
    }

    final versionInfo = await AppInfo.getAppVersionInfo();

    try {
      if (existingInstanceId != null) {
        await _apiClient.usersModule.updateUsersModuleDisplayInstance(
          id: existingInstanceId,
          body: UsersModuleReqUpdateDisplayInstance(
            data: UsersModuleUpdateDisplayInstance(
              version: versionInfo.version,
              build: versionInfo.build,
            ),
          ),
        );
      }
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[UPDATE DISPLAY INSTANCE] API error: ${e.response?.statusCode} - ${e.message}',
        );
      }

      if (e.response?.statusCode == 401 || e.response?.statusCode == 403) {
        if (kDebugMode) {
          debugPrint(
              '[UPDATE DISPLAY INSTANCE] Stored secret key is not valid');
        }
      }

      throw Exception(
        'Backend initialization failed. Ensure the server is running.',
      );
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
            '[UPDATE DISPLAY INSTANCE] Unexpected error: ${e.toString()}');
      }

      throw StateError('Unexpected backend error.');
    }
  }

  Future<void> _notifyDisplayProfile() async {
    final appUid = await _getAppUid();

    final ScreenService screenService = locator.get<ScreenService>();

    SystemModuleDisplayProfile? existingProfile;

    try {
      final existingProfileResponse = await _apiClient.systemModule
          .getSystemModuleDisplayProfileByUid(uid: appUid);

      existingProfile = existingProfileResponse.data.data;
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[READ DISPLAY PROFILE] API error: ${e.response?.statusCode} - ${e.message}',
        );
      }

      if (e.response?.statusCode != 404) {
        throw Exception(
          'Reading display profile failed. Ensure the server is running.',
        );
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[READ DISPLAY PROFILE] Unexpected error: ${e.toString()}');
      }

      throw StateError('Unexpected backend error.');
    }

    if (existingProfile != null) {
      screenService.updateFromProfile(
        profileCols: existingProfile.cols,
        profileRows: existingProfile.rows,
        profileUnitSize: existingProfile.unitSize.toDouble(),
      );

      return;
    }

    try {
      await _apiClient.systemModule.createSystemModuleDisplayProfile(
        body: SystemModuleReqCreateDisplayProfile(
          data: SystemModuleCreateDisplayProfile(
            id: const Uuid().v4(),
            uid: appUid,
            screenWidth: screenService.screenWidth.toInt(),
            screenHeight: screenService.screenHeight.toInt(),
            pixelRatio: screenService.pixelRatio,
            unitSize: screenService.unitSize,
            rows: screenService.rows,
            cols: screenService.columns,
          ),
        ),
      );
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[UPDATE DISPLAY PROFILE] API error: ${e.response?.statusCode} - ${e.message}',
        );
      }

      if (e.response?.statusCode == 401 || e.response?.statusCode == 403) {
        if (kDebugMode) {
          debugPrint('[UPDATE DISPLAY PROFILE] Stored secret key is not valid');
        }
      }

      throw Exception(
        'Backend initialization failed. Ensure the server is running.',
      );
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
            '[UPDATE DISPLAY PROFILE] Unexpected error: ${e.toString()}');
      }

      throw StateError('Unexpected backend error.');
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
}
