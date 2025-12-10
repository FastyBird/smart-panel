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
    if (payload.containsKey('display') &&
        payload['display'] is Map<String, dynamic>) {
      _displayRepository.insertDisplay(
        payload['display'] as Map<String, dynamic>,
      );

      // Update screen service if grid settings changed
      final screenService = locator.get<ScreenService>();
      screenService.updateFromProfile(
        profileCols: _displayRepository.cols,
        profileRows: _displayRepository.rows,
        profileUnitSize: _displayRepository.unitSize,
      );
    }
  }
}
