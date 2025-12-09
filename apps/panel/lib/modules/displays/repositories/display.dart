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

class DisplayRepository extends ChangeNotifier {
  final ApiClient _apiClient;

  DisplayModel? _display;
  bool _isLoading = false;

  DisplayRepository({required ApiClient apiClient}) : _apiClient = apiClient;

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
  void setDisplay(DisplayModel display) {
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

  /// Fetch display from backend
  Future<bool> fetchDisplay(String displayId) async {
    _isLoading = true;
    notifyListeners();

    try {
      final response =
          await _apiClient.displaysModuleDisplays.findOne(id: displayId);

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

  /// Fetch current display using /displays-module/displays/me endpoint
  /// This is used when the display has a stored token and needs to fetch its own data
  Future<FetchDisplayResult> fetchCurrentDisplay() async {
    _isLoading = true;
    notifyListeners();

    try {
      final response = await _apiClient.displaysModuleDisplays.getMe();

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
      _isLoading = false;
      notifyListeners();

      final statusCode = e.response?.statusCode;

      if (kDebugMode) {
        debugPrint(
          '[DISPLAYS MODULE] Failed to fetch current display: $statusCode - ${e.message}',
        );
      }

      if (statusCode == 401 || statusCode == 403) {
        return FetchDisplayResult.authenticationFailed;
      }

      if (statusCode == 404) {
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

  /// Update display dark mode
  Future<bool> setDisplayDarkMode(bool darkMode) async {
    if (_display == null) return false;

    try {
      final response = await _apiClient.displaysModuleDisplays.update(
        id: _display!.id,
        body: DisplaysModuleReqUpdateDisplay(
          data: DisplaysModuleUpdateDisplay(darkMode: darkMode),
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
      final response = await _apiClient.displaysModuleDisplays.update(
        id: _display!.id,
        body: DisplaysModuleReqUpdateDisplay(
          data: DisplaysModuleUpdateDisplay(brightness: brightness),
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
      final response = await _apiClient.displaysModuleDisplays.update(
        id: _display!.id,
        body: DisplaysModuleReqUpdateDisplay(
          data: DisplaysModuleUpdateDisplay(screenLockDuration: duration),
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
      final response = await _apiClient.displaysModuleDisplays.update(
        id: _display!.id,
        body: DisplaysModuleReqUpdateDisplay(
          data: DisplaysModuleUpdateDisplay(screenSaver: enabled),
        ),
      );

      if (response.response.statusCode == 200) {
        _display = _display!.copyWith(screenSaver: enabled);
        notifyListeners();
        return true;
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
      final response = await _apiClient.displaysModuleDisplays.update(
        id: _display!.id,
        body: DisplaysModuleReqUpdateDisplay(
          data: DisplaysModuleUpdateDisplay(speaker: enabled),
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
      final response = await _apiClient.displaysModuleDisplays.update(
        id: _display!.id,
        body: DisplaysModuleReqUpdateDisplay(
          data: DisplaysModuleUpdateDisplay(speakerVolume: volume),
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
      final response = await _apiClient.displaysModuleDisplays.update(
        id: _display!.id,
        body: DisplaysModuleReqUpdateDisplay(
          data: DisplaysModuleUpdateDisplay(microphone: enabled),
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
      final response = await _apiClient.displaysModuleDisplays.update(
        id: _display!.id,
        body: DisplaysModuleReqUpdateDisplay(
          data: DisplaysModuleUpdateDisplay(microphoneVolume: volume),
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
