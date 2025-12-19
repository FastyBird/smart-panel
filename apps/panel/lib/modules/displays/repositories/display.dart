import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/api/models/displays_module_req_update_display.dart';
import 'package:fastybird_smart_panel/api/models/displays_module_update_display.dart';
import 'package:fastybird_smart_panel/modules/displays/models/display.dart';
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
      // Audio settings
      speaker: speaker ?? _display!.speaker,
      speakerVolume: speakerVolume ?? _display!.speakerVolume,
      microphone: microphone ?? _display!.microphone,
      microphoneVolume: microphoneVolume ?? _display!.microphoneVolume,
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
}
