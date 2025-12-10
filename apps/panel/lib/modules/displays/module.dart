import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/modules/displays/constants.dart';
import 'package:fastybird_smart_panel/modules/displays/models/display.dart';
import 'package:fastybird_smart_panel/modules/displays/repositories/display.dart';
import 'package:flutter/foundation.dart';

class DisplaysModuleService {
  final ApiClient _apiClient;
  final SocketService _socketService;
  final Dio _dio;

  late DisplayRepository _displayRepository;

  bool _isLoading = true;

  DisplaysModuleService({
    required ApiClient apiClient,
    required SocketService socketService,
    required Dio dio,
  })  : _apiClient = apiClient,
        _socketService = socketService,
        _dio = dio {
    _displayRepository = DisplayRepository(
      apiClient: _apiClient,
      dio: _dio,
    );

    locator.registerSingleton(_displayRepository);
  }

  /// Set callbacks for token refresh functionality
  void setTokenCallbacks({
    required TokenPersistCallback onTokenRefreshed,
    required GetCurrentTokenCallback getCurrentToken,
  }) {
    _displayRepository.setTokenCallbacks(
      onTokenRefreshed: onTokenRefreshed,
      getCurrentToken: getCurrentToken,
    );
  }

  /// Initialize the displays module by fetching the current display data
  /// using the stored access token.
  /// Returns the result of the fetch operation.
  Future<FetchDisplayResult> initializeWithStoredToken() async {
    _isLoading = true;

    final result = await _displayRepository.fetchCurrentDisplay();

    if (result == FetchDisplayResult.success && _displayRepository.hasDisplay) {
      // Update screen service with display profile
      final screenService = locator.get<ScreenService>();
      screenService.updateFromProfile(
        profileCols: _displayRepository.cols,
        profileRows: _displayRepository.rows,
        profileUnitSize: _displayRepository.unitSize,
      );

      // Register socket event handler
      _socketService.registerEventHandler(
        DisplaysModuleConstants.displayUpdatedEvent,
        _socketEventHandler,
      );

      if (kDebugMode) {
        debugPrint(
          '[DISPLAYS MODULE][MODULE] Module initialized with stored token',
        );
      }
    }

    _isLoading = false;

    return result;
  }

  Future<void> initialize(String displayId) async {
    _isLoading = true;

    await _displayRepository.fetchDisplay(displayId);

    // Update screen service with display profile
    if (_displayRepository.hasDisplay) {
      final screenService = locator.get<ScreenService>();
      screenService.updateFromProfile(
        profileCols: _displayRepository.cols,
        profileRows: _displayRepository.rows,
        profileUnitSize: _displayRepository.unitSize,
      );
    }

    _isLoading = false;

    _socketService.registerEventHandler(
      DisplaysModuleConstants.displayUpdatedEvent,
      _socketEventHandler,
    );

    if (kDebugMode) {
      debugPrint(
        '[DISPLAYS MODULE][MODULE] Module was successfully initialized',
      );
    }
  }

  /// Initialize with display data from registration
  void initializeFromRegistration(DisplayModel display) {
    _displayRepository.setDisplay(display);

    // Update screen service with display profile
    final screenService = locator.get<ScreenService>();
    screenService.updateFromProfile(
      profileCols: display.cols,
      profileRows: display.rows,
      profileUnitSize: display.unitSize,
    );

    _isLoading = false;

    _socketService.registerEventHandler(
      DisplaysModuleConstants.displayUpdatedEvent,
      _socketEventHandler,
    );

    if (kDebugMode) {
      debugPrint(
        '[DISPLAYS MODULE][MODULE] Module initialized from registration',
      );
    }
  }

  bool get isLoading => _isLoading;

  DisplayRepository get displayRepository => _displayRepository;

  void dispose() {
    _socketService.unregisterEventHandler(
      DisplaysModuleConstants.displayUpdatedEvent,
      _socketEventHandler,
    );
  }

  void _socketEventHandler(String event, Map<String, dynamic> payload) {
    // Payload is the display entity directly from backend
    if (!payload.containsKey('id') || !payload.containsKey('mac_address')) {
      if (kDebugMode) {
        debugPrint(
          '[DISPLAYS MODULE] Invalid display update payload: missing required fields',
        );
      }
      return;
    }

    // Store previous values to detect changes
    final previousDisplay = _displayRepository.display;
    final previousDarkMode = previousDisplay?.darkMode;
    final previousBrightness = previousDisplay?.brightness;
    final previousScreenSaver = previousDisplay?.screenSaver;
    final previousRows = previousDisplay?.rows;
    final previousCols = previousDisplay?.cols;
    final previousUnitSize = previousDisplay?.unitSize;

    // Update display repository (this will notify listeners)
    _displayRepository.insertDisplay(payload);

    // Update screen service if grid settings changed
    final screenService = locator.get<ScreenService>();
    final currentDisplay = _displayRepository.display;

    if (currentDisplay != null) {
      // Check if grid settings changed
      if (previousRows != currentDisplay.rows ||
          previousCols != currentDisplay.cols ||
          previousUnitSize != currentDisplay.unitSize) {
        screenService.updateFromProfile(
          profileCols: currentDisplay.cols,
          profileRows: currentDisplay.rows,
          profileUnitSize: currentDisplay.unitSize,
        );

        if (kDebugMode) {
          debugPrint(
            '[DISPLAYS MODULE] Grid settings updated: ${currentDisplay.rows}x${currentDisplay.cols}, unitSize: $currentDisplay.unitSize',
          );
        }
      }

      // Log other setting changes for debugging
      if (kDebugMode) {
        if (previousDarkMode != currentDisplay.darkMode) {
          debugPrint(
            '[DISPLAYS MODULE] Dark mode changed: $previousDarkMode -> ${currentDisplay.darkMode}',
          );
        }
        if (previousBrightness != currentDisplay.brightness) {
          debugPrint(
            '[DISPLAYS MODULE] Brightness changed: $previousBrightness -> ${currentDisplay.brightness}',
          );
        }
        if (previousScreenSaver != currentDisplay.screenSaver) {
          debugPrint(
            '[DISPLAYS MODULE] Screen saver changed: $previousScreenSaver -> ${currentDisplay.screenSaver}',
          );
        }
      }
    }
  }
}
