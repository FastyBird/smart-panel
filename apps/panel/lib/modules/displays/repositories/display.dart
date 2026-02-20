import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/api/models/displays_module_req_update_display.dart';
import 'package:fastybird_smart_panel/api/models/displays_module_update_display.dart';
import 'package:fastybird_smart_panel/api/models/displays_module_update_display_distance_unit.dart';
import 'package:fastybird_smart_panel/api/models/displays_module_update_display_home_mode.dart';
import 'package:fastybird_smart_panel/api/models/displays_module_update_display_precipitation_unit.dart';
import 'package:fastybird_smart_panel/api/models/displays_module_update_display_pressure_unit.dart';
import 'package:fastybird_smart_panel/api/models/displays_module_update_display_role.dart';
import 'package:fastybird_smart_panel/api/models/displays_module_update_display_temperature_unit.dart';
import 'package:fastybird_smart_panel/api/models/displays_module_update_display_wind_speed_unit.dart';
import 'package:fastybird_smart_panel/modules/displays/models/display.dart';
import 'package:fastybird_smart_panel/modules/system/types/configuration.dart';
import 'package:flutter/foundation.dart';

/// Result of fetching current display
enum FetchDisplayResult {
  /// Display fetched successfully
  success,
  /// Authentication failed (token invalid/expired)
  authenticationFailed,
  /// Display not found
  notFound,
  /// Network or other error
  error,
}

/// Result of token refresh
enum TokenRefreshResult {
  /// Token refreshed successfully
  success,
  /// Token refresh failed
  failed,
}

/// Callback type for persisting the refreshed token
typedef TokenPersistCallback = Future<void> Function(String newToken);

/// Callback type for getting the current token
typedef GetCurrentTokenCallback = String? Function();

class DisplayRepository extends ChangeNotifier {
  final ApiClient _apiClient;
  final Dio _dio;
  TokenPersistCallback? _tokenPersistCallback;
  GetCurrentTokenCallback? _getCurrentTokenCallback;

  // Expose for interceptor access
  Dio get dio => _dio;

  /// Get the current token using the callback (for interceptor use)
  String? getCurrentToken() => _getCurrentTokenCallback?.call();

  DisplayModel? _display;
  bool _isLoading = false;
  bool _isRefreshingToken = false;

  DisplayRepository({
    required ApiClient apiClient,
    required Dio dio,
  })  : _apiClient = apiClient,
        _dio = dio;

  /// Set callbacks for token management
  void setTokenCallbacks({
    required TokenPersistCallback onTokenRefreshed,
    required GetCurrentTokenCallback getCurrentToken,
  }) {
    _tokenPersistCallback = onTokenRefreshed;
    _getCurrentTokenCallback = getCurrentToken;
  }

  DisplayModel? get display => _display;

  bool get isLoading => _isLoading;

  bool get hasDisplay => _display != null;

  // Display settings getters
  bool get hasDarkMode => _display?.darkMode ?? false;

  int get brightness => _display?.brightness ?? 100;

  int get screenLockDuration => _display?.screenLockDuration ?? 30;

  bool get hasScreenSaver => _display?.screenSaver ?? true;

  // Audio settings getters
  bool get audioOutputSupported => _display?.audioOutputSupported ?? false;

  bool get audioInputSupported => _display?.audioInputSupported ?? false;

  bool get hasSpeakerEnabled => _display?.speaker ?? false;

  int get speakerVolume => _display?.speakerVolume ?? 50;

  bool get hasMicrophoneEnabled => _display?.microphone ?? false;

  int get microphoneVolume => _display?.microphoneVolume ?? 50;

  // Grid settings getters
  int get rows => _display?.rows ?? 12;

  int get cols => _display?.cols ?? 24;

  double get unitSize => _display?.unitSize ?? 120.0;

  // Home page settings getters
  HomeMode get homeMode => _display?.homeMode ?? HomeMode.autoSpace;

  String? get homePageId => _display?.homePageId;

  String? get resolvedHomePageId => _display?.resolvedHomePageId;

  // Unit override getters (null = use system default)
  TemperatureUnit? get temperatureUnit => _display?.temperatureUnit;

  WindSpeedUnit? get windSpeedUnit => _display?.windSpeedUnit;

  PressureUnit? get pressureUnit => _display?.pressureUnit;

  PrecipitationUnit? get precipitationUnit => _display?.precipitationUnit;

  DistanceUnit? get distanceUnit => _display?.distanceUnit;

  /// Set display data from registration response
  /// Pass null to clear the display model
  void setDisplay(DisplayModel? display) {
    _display = display;
    notifyListeners();
  }

  /// Insert display configuration from JSON (e.g., from socket event)
  void insertDisplay(Map<String, dynamic> json) {
    try {
      final newDisplay = DisplayModel.fromJson(json);

      if (_display != newDisplay) {
        if (kDebugMode) {
          debugPrint(
            '[DISPLAYS MODULE] Display configuration was successfully updated',
          );
        }

        _display = newDisplay;
        notifyListeners();
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[DISPLAYS MODULE] Display model could not be created: $e',
        );
      }
    }
  }

  /// Refresh the display token
  /// Returns true if refresh was successful, false otherwise
  Future<TokenRefreshResult> refreshToken() async {
    if (_isRefreshingToken) {
      if (kDebugMode) {
        debugPrint('[DISPLAYS MODULE] Token refresh already in progress');
      }
      return TokenRefreshResult.failed;
    }

    final currentToken = _getCurrentTokenCallback?.call();
    if (currentToken == null) {
      if (kDebugMode) {
        debugPrint('[DISPLAYS MODULE] No current token available for refresh');
      }
      return TokenRefreshResult.failed;
    }

    _isRefreshingToken = true;

    try {
      if (kDebugMode) {
        debugPrint('[DISPLAYS MODULE] Attempting to refresh token...');
      }

      final response = await _apiClient.displaysModule.createDisplaysModuleDisplayRefreshToken(
        authorization: 'Bearer $currentToken',
      );

      if (response.response.statusCode == 200) {
        final newToken = response.data.data.accessToken;

        // Update the Dio headers with the new token
        _dio.options.headers['Authorization'] = 'Bearer $newToken';

        // Persist the new token using the callback
        if (_tokenPersistCallback != null) {
          await _tokenPersistCallback!(newToken);
        }

        if (kDebugMode) {
          debugPrint('[DISPLAYS MODULE] Token refreshed successfully');
        }

        _isRefreshingToken = false;
        return TokenRefreshResult.success;
      }

      if (kDebugMode) {
        debugPrint(
          '[DISPLAYS MODULE] Token refresh failed with status: ${response.response.statusCode}',
        );
      }

      _isRefreshingToken = false;
      return TokenRefreshResult.failed;
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[DISPLAYS MODULE] Token refresh failed: ${e.response?.statusCode} - ${e.message}',
        );
      }

      _isRefreshingToken = false;
      return TokenRefreshResult.failed;
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[DISPLAYS MODULE] Token refresh error: $e');
      }

      _isRefreshingToken = false;
      return TokenRefreshResult.failed;
    }
  }

  /// Fetch display from backend
  Future<bool> fetchDisplay(String displayId) async {
    _isLoading = true;
    notifyListeners();

    try {
      final response =
          await _apiClient.displaysModule.getDisplaysModuleDisplay(id: displayId);

      if (response.response.statusCode == 200) {
        final data = response.data.data;

        _display = DisplayModel(
          id: data.id,
          macAddress: data.macAddress,
          version: data.version,
          build: data.build,
          name: data.name,
          screenWidth: data.screenWidth,
          screenHeight: data.screenHeight,
          pixelRatio: data.pixelRatio.toDouble(),
          unitSize: data.unitSize.toDouble(),
          rows: data.rows,
          cols: data.cols,
          darkMode: data.darkMode,
          brightness: data.brightness,
          screenLockDuration: data.screenLockDuration,
          screenSaver: data.screenSaver,
          audioOutputSupported: data.audioOutputSupported,
          audioInputSupported: data.audioInputSupported,
          speaker: data.speaker,
          speakerVolume: data.speakerVolume,
          microphone: data.microphone,
          microphoneVolume: data.microphoneVolume,
          temperatureUnit: data.temperatureUnit?.json != null
              ? TemperatureUnit.fromValue(data.temperatureUnit!.json!)
              : null,
          windSpeedUnit: data.windSpeedUnit?.json != null
              ? WindSpeedUnit.fromValue(data.windSpeedUnit!.json!)
              : null,
          pressureUnit: data.pressureUnit?.json != null
              ? PressureUnit.fromValue(data.pressureUnit!.json!)
              : null,
          precipitationUnit: data.precipitationUnit?.json != null
              ? PrecipitationUnit.fromValue(data.precipitationUnit!.json!)
              : null,
          distanceUnit: data.distanceUnit?.json != null
              ? DistanceUnit.fromValue(data.distanceUnit!.json!)
              : null,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        );

        _isLoading = false;
        notifyListeners();

        return true;
      }

      _isLoading = false;
      notifyListeners();

      return false;
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[DISPLAYS MODULE] Failed to fetch display: ${e.response?.statusCode} - ${e.message}',
        );
      }

      _isLoading = false;
      notifyListeners();

      return false;
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[DISPLAYS MODULE] Unexpected error fetching display: $e');
      }

      _isLoading = false;
      notifyListeners();

      return false;
    }
  }

  /// Fetch current display using /modules/displays/displays/me endpoint
  /// This is used when the display has a stored token and needs to fetch its own data
  /// If authentication fails (401), it will attempt to refresh the token and retry once
  Future<FetchDisplayResult> fetchCurrentDisplay({bool retryAfterRefresh = true}) async {
    _isLoading = true;
    notifyListeners();

    try {
      final response = await _apiClient.displaysModule.getDisplaysModuleDisplayMe();

      if (response.response.statusCode == 200) {
        final data = response.data.data;

        _display = DisplayModel(
          id: data.id,
          macAddress: data.macAddress,
          version: data.version,
          build: data.build,
          name: data.name,
          screenWidth: data.screenWidth,
          screenHeight: data.screenHeight,
          pixelRatio: data.pixelRatio.toDouble(),
          unitSize: data.unitSize.toDouble(),
          rows: data.rows,
          cols: data.cols,
          darkMode: data.darkMode,
          brightness: data.brightness,
          screenLockDuration: data.screenLockDuration,
          screenSaver: data.screenSaver,
          audioOutputSupported: data.audioOutputSupported,
          audioInputSupported: data.audioInputSupported,
          speaker: data.speaker,
          speakerVolume: data.speakerVolume,
          microphone: data.microphone,
          microphoneVolume: data.microphoneVolume,
          temperatureUnit: data.temperatureUnit?.json != null
              ? TemperatureUnit.fromValue(data.temperatureUnit!.json!)
              : null,
          windSpeedUnit: data.windSpeedUnit?.json != null
              ? WindSpeedUnit.fromValue(data.windSpeedUnit!.json!)
              : null,
          pressureUnit: data.pressureUnit?.json != null
              ? PressureUnit.fromValue(data.pressureUnit!.json!)
              : null,
          precipitationUnit: data.precipitationUnit?.json != null
              ? PrecipitationUnit.fromValue(data.precipitationUnit!.json!)
              : null,
          distanceUnit: data.distanceUnit?.json != null
              ? DistanceUnit.fromValue(data.distanceUnit!.json!)
              : null,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        );

        _isLoading = false;
        notifyListeners();

        if (kDebugMode) {
          debugPrint(
            '[DISPLAYS MODULE] Successfully fetched current display: ${_display!.id}',
          );
        }

        return FetchDisplayResult.success;
      }

      _isLoading = false;
      notifyListeners();

      return FetchDisplayResult.error;
    } on DioException catch (e) {
      final statusCode = e.response?.statusCode;

      if (kDebugMode) {
        debugPrint(
          '[DISPLAYS MODULE] Failed to fetch current display: $statusCode - ${e.message}',
        );
      }

      // Attempt token refresh on 401 (Unauthorized)
      if (statusCode == 401 && retryAfterRefresh) {
        if (kDebugMode) {
          debugPrint(
            '[DISPLAYS MODULE] Token expired, attempting refresh...',
          );
        }

        final refreshResult = await refreshToken();

        if (refreshResult == TokenRefreshResult.success) {
          // Retry the fetch with the new token (but don't retry again if it fails)
          return fetchCurrentDisplay(retryAfterRefresh: false);
        }

        if (kDebugMode) {
          debugPrint(
            '[DISPLAYS MODULE] Token refresh failed - token may have been revoked or deleted',
          );
        }
      }

      _isLoading = false;
      notifyListeners();

      if (statusCode == 401 || statusCode == 403) {
        // 401/403: Token invalid, revoked, or deleted
        return FetchDisplayResult.authenticationFailed;
      }

      if (statusCode == 404) {
        // 404: Display not found - display may have been deleted
        return FetchDisplayResult.notFound;
      }

      return FetchDisplayResult.error;
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[DISPLAYS MODULE] Unexpected error fetching current display: $e',
        );
      }

      _isLoading = false;
      notifyListeners();

      return FetchDisplayResult.error;
    }
  }

  /// Convert local DisplayRole to API DisplaysModuleUpdateDisplayRole
  DisplaysModuleUpdateDisplayRole _toApiRole(DisplayRole role) {
    switch (role) {
      case DisplayRole.room:
        return DisplaysModuleUpdateDisplayRole.room;
      case DisplayRole.master:
        return DisplaysModuleUpdateDisplayRole.master;
      case DisplayRole.entry:
        return DisplaysModuleUpdateDisplayRole.entry;
    }
  }

  /// Convert local HomeMode to API DisplaysModuleUpdateDisplayHomeMode
  DisplaysModuleUpdateDisplayHomeMode _toApiHomeMode(HomeMode mode) {
    switch (mode) {
      case HomeMode.autoSpace:
        return DisplaysModuleUpdateDisplayHomeMode.autoSpace;
      case HomeMode.explicit:
        return DisplaysModuleUpdateDisplayHomeMode.explicit;
    }
  }

  /// Convert local TemperatureUnit to API enum
  DisplaysModuleUpdateDisplayTemperatureUnit? _toApiTemperatureUnit(TemperatureUnit? unit) {
    if (unit == null) return null;
    return DisplaysModuleUpdateDisplayTemperatureUnit.fromJson(unit.value);
  }

  /// Convert local WindSpeedUnit to API enum
  DisplaysModuleUpdateDisplayWindSpeedUnit? _toApiWindSpeedUnit(WindSpeedUnit? unit) {
    if (unit == null) return null;
    return DisplaysModuleUpdateDisplayWindSpeedUnit.fromJson(unit.value);
  }

  /// Convert local PressureUnit to API enum
  DisplaysModuleUpdateDisplayPressureUnit? _toApiPressureUnit(PressureUnit? unit) {
    if (unit == null) return null;
    return DisplaysModuleUpdateDisplayPressureUnit.fromJson(unit.value);
  }

  /// Convert local PrecipitationUnit to API enum
  DisplaysModuleUpdateDisplayPrecipitationUnit? _toApiPrecipitationUnit(PrecipitationUnit? unit) {
    if (unit == null) return null;
    return DisplaysModuleUpdateDisplayPrecipitationUnit.fromJson(unit.value);
  }

  /// Convert local DistanceUnit to API enum
  DisplaysModuleUpdateDisplayDistanceUnit? _toApiDistanceUnit(DistanceUnit? unit) {
    if (unit == null) return null;
    return DisplaysModuleUpdateDisplayDistanceUnit.fromJson(unit.value);
  }

  /// Sentinel to distinguish "not provided" from "set to null" in _buildUpdateData
  static const _unset = Object();

  /// Build update data with all current values
  DisplaysModuleUpdateDisplay _buildUpdateData({
    bool? darkMode,
    int? brightness,
    int? screenLockDuration,
    bool? screenSaver,
    bool? speaker,
    int? speakerVolume,
    bool? microphone,
    int? microphoneVolume,
    Object? temperatureUnit = _unset,
    Object? windSpeedUnit = _unset,
    Object? pressureUnit = _unset,
    Object? precipitationUnit = _unset,
    Object? distanceUnit = _unset,
  }) {
    return DisplaysModuleUpdateDisplay(
      version: _display!.version,
      build: _display!.build,
      // Screen info
      screenWidth: _display!.screenWidth,
      screenHeight: _display!.screenHeight,
      pixelRatio: _display!.pixelRatio,
      unitSize: _display!.unitSize,
      rows: _display!.rows,
      cols: _display!.cols,
      // Display settings
      darkMode: darkMode ?? _display!.darkMode,
      brightness: brightness ?? _display!.brightness,
      screenLockDuration: screenLockDuration ?? _display!.screenLockDuration,
      screenSaver: screenSaver ?? _display!.screenSaver,
      // Display configuration
      name: _display!.name,
      role: _toApiRole(_display!.role),
      roomId: _display!.roomId,
      homeMode: _toApiHomeMode(_display!.homeMode),
      homePageId: _display!.homePageId,
      // Audio settings
      speaker: speaker ?? _display!.speaker,
      speakerVolume: speakerVolume ?? _display!.speakerVolume,
      microphone: microphone ?? _display!.microphone,
      microphoneVolume: microphoneVolume ?? _display!.microphoneVolume,
      // Unit overrides
      temperatureUnit: _toApiTemperatureUnit(
        identical(temperatureUnit, _unset)
            ? _display!.temperatureUnit
            : temperatureUnit as TemperatureUnit?,
      ),
      windSpeedUnit: _toApiWindSpeedUnit(
        identical(windSpeedUnit, _unset)
            ? _display!.windSpeedUnit
            : windSpeedUnit as WindSpeedUnit?,
      ),
      pressureUnit: _toApiPressureUnit(
        identical(pressureUnit, _unset)
            ? _display!.pressureUnit
            : pressureUnit as PressureUnit?,
      ),
      precipitationUnit: _toApiPrecipitationUnit(
        identical(precipitationUnit, _unset)
            ? _display!.precipitationUnit
            : precipitationUnit as PrecipitationUnit?,
      ),
      distanceUnit: _toApiDistanceUnit(
        identical(distanceUnit, _unset)
            ? _display!.distanceUnit
            : distanceUnit as DistanceUnit?,
      ),
    );
  }

  /// Update display dark mode
  Future<bool> setDisplayDarkMode(bool darkMode) async {
    if (_display == null) return false;

    try {
      final response = await _apiClient.displaysModule.updateDisplaysModuleDisplayMe(
        body: DisplaysModuleReqUpdateDisplay(
          data: _buildUpdateData(darkMode: darkMode),
        ),
      );

      if (response.response.statusCode == 200) {
        _display = _display!.copyWith(darkMode: darkMode);
        notifyListeners();
        return true;
      }

      return false;
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[DISPLAYS MODULE] Failed to update dark mode: $e');
      }
      return false;
    }
  }

  /// Update display brightness
  Future<bool> setDisplayBrightness(int brightness) async {
    if (_display == null) return false;

    try {
      final response = await _apiClient.displaysModule.updateDisplaysModuleDisplayMe(
        body: DisplaysModuleReqUpdateDisplay(
          data: _buildUpdateData(brightness: brightness),
        ),
      );

      if (response.response.statusCode == 200) {
        _display = _display!.copyWith(brightness: brightness);
        notifyListeners();
        return true;
      }

      return false;
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[DISPLAYS MODULE] Failed to update brightness: $e');
      }
      return false;
    }
  }

  /// Update screen lock duration
  Future<bool> setDisplayScreenLockDuration(int duration) async {
    if (_display == null) return false;

    try {
      final response = await _apiClient.displaysModule.updateDisplaysModuleDisplayMe(
        body: DisplaysModuleReqUpdateDisplay(
          data: _buildUpdateData(screenLockDuration: duration),
        ),
      );

      if (response.response.statusCode == 200) {
        _display = _display!.copyWith(screenLockDuration: duration);
        notifyListeners();
        return true;
      }

      return false;
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[DISPLAYS MODULE] Failed to update screen lock: $e');
      }
      return false;
    }
  }

  /// Update screen saver enabled state
  Future<bool> setDisplayScreenSaver(bool enabled) async {
    if (_display == null) return false;

    try {
      final response = await _apiClient.displaysModule.updateDisplaysModuleDisplayMe(
        body: DisplaysModuleReqUpdateDisplay(
          data: _buildUpdateData(screenSaver: enabled),
        ),
      );

      if (response.response.statusCode == 200) {
        _display = _display!.copyWith(screenSaver: enabled);
        notifyListeners();
        return true;
      }

      return false;
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          'API error: ${e.response?.statusCode} - ${e.message}',
        );
        debugPrint('Response data: ${e.response?.data}');
      }
      return false;
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[DISPLAYS MODULE] Failed to update screen saver: $e');
      }
      return false;
    }
  }

  /// Update speaker enabled state
  Future<bool> setSpeakerState(bool enabled) async {
    if (_display == null) return false;

    try {
      final response = await _apiClient.displaysModule.updateDisplaysModuleDisplayMe(
        body: DisplaysModuleReqUpdateDisplay(
          data: _buildUpdateData(speaker: enabled),
        ),
      );

      if (response.response.statusCode == 200) {
        _display = _display!.copyWith(speaker: enabled);
        notifyListeners();
        return true;
      }

      return false;
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[DISPLAYS MODULE] Failed to update speaker state: $e');
      }
      return false;
    }
  }

  /// Update speaker volume
  Future<bool> setSpeakerVolume(int volume) async {
    if (_display == null) return false;

    try {
      final response = await _apiClient.displaysModule.updateDisplaysModuleDisplayMe(
        body: DisplaysModuleReqUpdateDisplay(
          data: _buildUpdateData(speakerVolume: volume),
        ),
      );

      if (response.response.statusCode == 200) {
        _display = _display!.copyWith(speakerVolume: volume);
        notifyListeners();
        return true;
      }

      return false;
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[DISPLAYS MODULE] Failed to update speaker volume: $e');
      }
      return false;
    }
  }

  /// Update microphone enabled state
  Future<bool> setMicrophoneState(bool enabled) async {
    if (_display == null) return false;

    try {
      final response = await _apiClient.displaysModule.updateDisplaysModuleDisplayMe(
        body: DisplaysModuleReqUpdateDisplay(
          data: _buildUpdateData(microphone: enabled),
        ),
      );

      if (response.response.statusCode == 200) {
        _display = _display!.copyWith(microphone: enabled);
        notifyListeners();
        return true;
      }

      return false;
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[DISPLAYS MODULE] Failed to update microphone state: $e');
      }
      return false;
    }
  }

  /// Update microphone volume
  Future<bool> setMicrophoneVolume(int volume) async {
    if (_display == null) return false;

    try {
      final response = await _apiClient.displaysModule.updateDisplaysModuleDisplayMe(
        body: DisplaysModuleReqUpdateDisplay(
          data: _buildUpdateData(microphoneVolume: volume),
        ),
      );

      if (response.response.statusCode == 200) {
        _display = _display!.copyWith(microphoneVolume: volume);
        notifyListeners();
        return true;
      }

      return false;
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[DISPLAYS MODULE] Failed to update microphone volume: $e');
      }
      return false;
    }
  }

  /// Update temperature unit override (null = system default)
  Future<bool> setTemperatureUnit(TemperatureUnit? unit) async {
    if (_display == null) return false;

    try {
      final response = await _apiClient.displaysModule.updateDisplaysModuleDisplayMe(
        body: DisplaysModuleReqUpdateDisplay(
          data: _buildUpdateData(temperatureUnit: unit),
        ),
      );

      if (response.response.statusCode == 200) {
        _display = _display!.copyWith(temperatureUnit: unit);
        notifyListeners();
        return true;
      }

      return false;
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[DISPLAYS MODULE] Failed to update temperature unit: $e');
      }
      return false;
    }
  }

  /// Update wind speed unit override (null = system default)
  Future<bool> setWindSpeedUnit(WindSpeedUnit? unit) async {
    if (_display == null) return false;

    try {
      final response = await _apiClient.displaysModule.updateDisplaysModuleDisplayMe(
        body: DisplaysModuleReqUpdateDisplay(
          data: _buildUpdateData(windSpeedUnit: unit),
        ),
      );

      if (response.response.statusCode == 200) {
        _display = _display!.copyWith(windSpeedUnit: unit);
        notifyListeners();
        return true;
      }

      return false;
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[DISPLAYS MODULE] Failed to update wind speed unit: $e');
      }
      return false;
    }
  }

  /// Update pressure unit override (null = system default)
  Future<bool> setPressureUnit(PressureUnit? unit) async {
    if (_display == null) return false;

    try {
      final response = await _apiClient.displaysModule.updateDisplaysModuleDisplayMe(
        body: DisplaysModuleReqUpdateDisplay(
          data: _buildUpdateData(pressureUnit: unit),
        ),
      );

      if (response.response.statusCode == 200) {
        _display = _display!.copyWith(pressureUnit: unit);
        notifyListeners();
        return true;
      }

      return false;
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[DISPLAYS MODULE] Failed to update pressure unit: $e');
      }
      return false;
    }
  }

  /// Update precipitation unit override (null = system default)
  Future<bool> setPrecipitationUnit(PrecipitationUnit? unit) async {
    if (_display == null) return false;

    try {
      final response = await _apiClient.displaysModule.updateDisplaysModuleDisplayMe(
        body: DisplaysModuleReqUpdateDisplay(
          data: _buildUpdateData(precipitationUnit: unit),
        ),
      );

      if (response.response.statusCode == 200) {
        _display = _display!.copyWith(precipitationUnit: unit);
        notifyListeners();
        return true;
      }

      return false;
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[DISPLAYS MODULE] Failed to update precipitation unit: $e');
      }
      return false;
    }
  }

  /// Update distance unit override (null = system default)
  Future<bool> setDistanceUnit(DistanceUnit? unit) async {
    if (_display == null) return false;

    try {
      final response = await _apiClient.displaysModule.updateDisplaysModuleDisplayMe(
        body: DisplaysModuleReqUpdateDisplay(
          data: _buildUpdateData(distanceUnit: unit),
        ),
      );

      if (response.response.statusCode == 200) {
        _display = _display!.copyWith(distanceUnit: unit);
        notifyListeners();
        return true;
      }

      return false;
    } catch (e) {
      if (kDebugMode) {
        debugPrint('[DISPLAYS MODULE] Failed to update distance unit: $e');
      }
      return false;
    }
  }
}
