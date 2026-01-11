import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/core/services/startup_manager.dart';
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

      // Register socket event handlers
      _registerSocketEventHandlers();

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

    _registerSocketEventHandlers();

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

    _registerSocketEventHandlers();

    if (kDebugMode) {
      debugPrint(
        '[DISPLAYS MODULE][MODULE] Module initialized from registration',
      );
    }
  }

  bool get isLoading => _isLoading;

  DisplayRepository get displayRepository => _displayRepository;

  void dispose() {
    _unregisterSocketEventHandlers();
  }

  void _registerSocketEventHandlers() {
    _socketService.registerEventHandler(
      DisplaysModuleConstants.displayUpdatedEvent,
      _socketEventHandler,
    );
    _socketService.registerEventHandler(
      DisplaysModuleConstants.displayDeletedEvent,
      _socketDisplayDeletedHandler,
    );
    _socketService.registerEventHandler(
      DisplaysModuleConstants.displayTokenRevokedEvent,
      _socketTokenRevokedHandler,
    );
  }

  void _unregisterSocketEventHandlers() {
    _socketService.unregisterEventHandler(
      DisplaysModuleConstants.displayUpdatedEvent,
      _socketEventHandler,
    );
    _socketService.unregisterEventHandler(
      DisplaysModuleConstants.displayDeletedEvent,
      _socketDisplayDeletedHandler,
    );
    _socketService.unregisterEventHandler(
      DisplaysModuleConstants.displayTokenRevokedEvent,
      _socketTokenRevokedHandler,
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

    // CRITICAL: Only process events for THIS display
    // Without this check, events for other displays would overwrite our state
    final currentDisplay = _displayRepository.display;
    final eventDisplayId = payload['id'] as String?;

    if (currentDisplay == null || eventDisplayId != currentDisplay.id) {
      if (kDebugMode) {
        debugPrint(
          '[DISPLAYS MODULE] Ignoring display update for different display: $eventDisplayId (current: ${currentDisplay?.id})',
        );
      }
      return;
    }

    // Store previous values to detect changes (currentDisplay is guaranteed non-null here)
    final previousDarkMode = currentDisplay.darkMode;
    final previousBrightness = currentDisplay.brightness;
    final previousScreenSaver = currentDisplay.screenSaver;
    final previousRows = currentDisplay.rows;
    final previousCols = currentDisplay.cols;
    final previousUnitSize = currentDisplay.unitSize;

    // Update display repository (this will notify listeners)
    _displayRepository.insertDisplay(payload);

    // Update screen service if grid settings changed
    final screenService = locator.get<ScreenService>();
    final updatedDisplay = _displayRepository.display;

    if (updatedDisplay != null) {
      // Check if grid settings changed
      if (previousRows != updatedDisplay.rows ||
          previousCols != updatedDisplay.cols ||
          previousUnitSize != updatedDisplay.unitSize) {
        screenService.updateFromProfile(
          profileCols: updatedDisplay.cols,
          profileRows: updatedDisplay.rows,
          profileUnitSize: updatedDisplay.unitSize,
        );

        if (kDebugMode) {
          debugPrint(
            '[DISPLAYS MODULE] Grid settings updated: ${updatedDisplay.rows}x${updatedDisplay.cols}, unitSize: ${updatedDisplay.unitSize}',
          );
        }
      }

      // Log other setting changes for debugging
      if (kDebugMode) {
        if (previousDarkMode != updatedDisplay.darkMode) {
          debugPrint(
            '[DISPLAYS MODULE] Dark mode changed: $previousDarkMode -> ${updatedDisplay.darkMode}',
          );
        }
        if (previousBrightness != updatedDisplay.brightness) {
          debugPrint(
            '[DISPLAYS MODULE] Brightness changed: $previousBrightness -> ${updatedDisplay.brightness}',
          );
        }
        if (previousScreenSaver != updatedDisplay.screenSaver) {
          debugPrint(
            '[DISPLAYS MODULE] Screen saver changed: $previousScreenSaver -> ${updatedDisplay.screenSaver}',
          );
        }
      }
    }
  }

  void _socketDisplayDeletedHandler(String event, Map<String, dynamic> payload) {
    if (kDebugMode) {
      debugPrint('[DISPLAYS MODULE] Display deleted event received via socket');
    }

    // Check if this deletion is for the current display
    final currentDisplay = _displayRepository.display;
    final deletedDisplayId = payload['id'] as String?;

    if (currentDisplay != null && deletedDisplayId == currentDisplay.id) {
      if (kDebugMode) {
        debugPrint(
          '[DISPLAYS MODULE] Current display was deleted, resetting to discovery state',
        );
      }

      // Clear display model
      _displayRepository.setDisplay(null);

      // Disconnect from sockets
      _socketService.dispose();

      // Trigger app reset to discovery state
      // This will be handled by the startup manager
      final startupManager = locator.get<StartupManagerService>();
      startupManager.resetToDiscovery();
    }
  }

  void _socketTokenRevokedHandler(String event, Map<String, dynamic> payload) {
    if (kDebugMode) {
      debugPrint('[DISPLAYS MODULE] Token revoked event received via socket');
    }

    // Check if this revocation is for the current display
    final currentDisplay = _displayRepository.display;
    final revokedDisplayId = payload['id'] as String?;

    if (currentDisplay != null && revokedDisplayId == currentDisplay.id) {
      if (kDebugMode) {
        debugPrint(
          '[DISPLAYS MODULE] Current display token was revoked, resetting to discovery state for re-registration',
        );
      }

      // Token was revoked - immediately reset to discovery state
      // This will trigger re-registration which requires permit join to be enabled
      _displayRepository.setDisplay(null);

      // Disconnect from sockets (prevent reconnection attempts)
      _socketService.dispose();

      // Trigger app reset to discovery state
      final startupManager = locator.get<StartupManagerService>();
      startupManager.resetToDiscovery();
    }
  }
}
