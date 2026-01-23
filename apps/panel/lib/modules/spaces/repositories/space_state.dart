import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_climate_intent.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_covers_intent.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_lighting_intent.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_req_climate_intent.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_req_covers_intent.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_req_lighting_intent.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_media_intent.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_req_media_intent.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_req_suggestion_feedback.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_suggestion_feedback.dart';
import 'package:fastybird_smart_panel/api/spaces_module/spaces_module_client.dart';
import 'package:fastybird_smart_panel/core/services/metrics_service.dart';
import 'package:fastybird_smart_panel/modules/intents/models/intents/intent.dart';
import 'package:fastybird_smart_panel/modules/intents/repositories/intents.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/climate_state/climate_state.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/covers_state/covers_state.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/intent_result/intent_result.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/lighting_state/lighting_state.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/media_state/media_state.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/sensor_state/sensor_state.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/suggestion/suggestion.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/undo/undo_state.dart';
import 'package:fastybird_smart_panel/modules/spaces/repositories/intent_types.dart';
import 'package:flutter/foundation.dart';

/// Repository for managing space state including lighting, climate, suggestions, and undo.
///
/// This repository provides:
/// - **Lighting state**: Current state of lights in a space (on/off, brightness, color, etc.)
/// - **Climate state**: Current HVAC state (temperature, humidity, mode)
/// - **Suggestions**: Smart suggestions based on context (time of day, occupancy)
/// - **Undo**: Ability to revert recent lighting/climate changes within a time window
///
/// State can be updated via:
/// - API fetches (for initial load or refresh)
/// - WebSocket events (for real-time updates)
///
/// The repository uses [ChangeNotifier] to notify listeners when state changes.
///
/// Example usage:
/// ```dart
/// final repo = SpaceStateRepository(apiClient: client);
///
/// // Fetch all state for a space
/// await repo.fetchAllState('space-123');
///
/// // Get cached lighting state
/// final lighting = repo.getLightingState('space-123');
///
/// // Execute a lighting intent
/// final result = await repo.executeLightingIntent(
///   'space-123',
///   LightingIntentType.off,
/// );
/// ```
class SpaceStateRepository extends ChangeNotifier {
  final SpacesModuleClient _apiClient;
  final IntentsRepository _intentsRepository;

  /// Cached lighting states by space ID
  final Map<String, LightingStateModel> _lightingStates = {};

  /// Cached climate states by space ID
  final Map<String, ClimateStateModel> _climateStates = {};

  /// Cached media states by space ID
  final Map<String, MediaStateModel> _mediaStates = {};

  /// Cached covers states by space ID
  final Map<String, CoversStateModel> _coversStates = {};

  /// Cached sensor states by space ID
  final Map<String, SensorStateModel> _sensorStates = {};

  /// Cached suggestions by space ID (null means no suggestion available)
  final Map<String, SuggestionModel?> _suggestions = {};

  /// Cached undo states by space ID
  final Map<String, UndoStateModel> _undoStates = {};

  /// Counter for concurrent loading operations (0 = not loading)
  int _loadingCount = 0;

  SpaceStateRepository({
    required SpacesModuleClient apiClient,
    required IntentsRepository intentsRepository,
  })  : _apiClient = apiClient,
        _intentsRepository = intentsRepository;

  SpacesModuleClient get apiClient => _apiClient;

  /// Returns true if any fetch operation is in progress
  bool get isLoading => _loadingCount > 0;

  // ============================================
  // LIGHTING STATE
  // ============================================

  /// Get cached lighting state for a space
  LightingStateModel? getLightingState(String spaceId) {
    return _lightingStates[spaceId];
  }

  /// Update lighting state from WebSocket event
  void updateLightingState(String spaceId, Map<String, dynamic> json) {
    try {
      final state = LightingStateModel.fromJson(json, spaceId: spaceId);
      _lightingStates[spaceId] = state;

      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][STATE] Updated lighting state for space: $spaceId',
        );
      }
      notifyListeners();
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][STATE] Failed to parse lighting state: $e',
        );
      }
    }
  }

  /// Fetch lighting state from API
  Future<LightingStateModel?> fetchLightingState(String spaceId) async {
    try {
      final response = await _apiClient.getSpacesModuleSpaceLightingState(
        id: spaceId,
      );

      if (response.response.statusCode == 200) {
        final data = response.response.data['data'] as Map<String, dynamic>;
        final state = LightingStateModel.fromJson(data, spaceId: spaceId);
        _lightingStates[spaceId] = state;
        notifyListeners();
        return state;
      }
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][STATE] API error fetching lighting state for $spaceId: ${e.response?.statusCode}',
        );
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][STATE] Error fetching lighting state for $spaceId: $e',
        );
      }
    }
    return null;
  }

  // ============================================
  // CLIMATE STATE
  // ============================================

  /// Get cached climate state for a space
  ClimateStateModel? getClimateState(String spaceId) {
    return _climateStates[spaceId];
  }

  /// Update climate state from WebSocket event
  void updateClimateState(String spaceId, Map<String, dynamic> json) {
    try {
      final state = ClimateStateModel.fromJson(json, spaceId: spaceId);
      _climateStates[spaceId] = state;

      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][STATE] Updated climate state for space: $spaceId',
        );
      }
      notifyListeners();
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][STATE] Failed to parse climate state: $e',
        );
      }
    }
  }

  /// Fetch climate state from API
  Future<ClimateStateModel?> fetchClimateState(String spaceId) async {
    try {
      final response = await _apiClient.getSpacesModuleSpaceClimate(
        id: spaceId,
      );

      if (response.response.statusCode == 200) {
        final data = response.response.data['data'] as Map<String, dynamic>;
        final state = ClimateStateModel.fromJson(data, spaceId: spaceId);
        _climateStates[spaceId] = state;
        notifyListeners();
        return state;
      }
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][STATE] API error fetching climate state for $spaceId: ${e.response?.statusCode}',
        );
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][STATE] Error fetching climate state for $spaceId: $e',
        );
      }
    }
    return null;
  }

  // ============================================
  // MEDIA STATE
  // ============================================

  /// Get cached media state for a space
  MediaStateModel? getMediaState(String spaceId) {
    return _mediaStates[spaceId];
  }

  /// Update media state from WebSocket event
  void updateMediaState(String spaceId, Map<String, dynamic> json) {
    try {
      final state = MediaStateModel.fromJson(json, spaceId: spaceId);
      _mediaStates[spaceId] = state;

      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][STATE] Updated media state for space: $spaceId',
        );
      }
      notifyListeners();
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][STATE] Failed to parse media state: $e',
        );
      }
    }
  }

  /// Fetch media state from API
  Future<MediaStateModel?> fetchMediaState(String spaceId) async {
    try {
      final response = await _apiClient.getSpacesModuleSpaceMedia(
        id: spaceId,
      );

      if (response.response.statusCode == 200) {
        final data = response.response.data['data'] as Map<String, dynamic>;
        final state = MediaStateModel.fromJson(data, spaceId: spaceId);
        _mediaStates[spaceId] = state;
        notifyListeners();
        return state;
      }
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][STATE] API error fetching media state for $spaceId: ${e.response?.statusCode}',
        );
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][STATE] Error fetching media state for $spaceId: $e',
        );
      }
    }
    return null;
  }

  // ============================================
  // COVERS STATE
  // ============================================

  /// Get cached covers state for a space
  CoversStateModel? getCoversState(String spaceId) {
    return _coversStates[spaceId];
  }

  /// Update covers state from WebSocket event
  void updateCoversState(String spaceId, Map<String, dynamic> json) {
    try {
      final state = CoversStateModel.fromJson(json, spaceId: spaceId);
      _coversStates[spaceId] = state;

      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][STATE] Updated covers state for space: $spaceId',
        );
      }
      notifyListeners();
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][STATE] Failed to parse covers state: $e',
        );
      }
    }
  }

  /// Fetch covers state from API
  Future<CoversStateModel?> fetchCoversState(String spaceId) async {
    try {
      final response = await _apiClient.getSpacesModuleSpaceCovers(
        id: spaceId,
      );

      if (response.response.statusCode == 200) {
        final data = response.response.data['data'] as Map<String, dynamic>;
        final state = CoversStateModel.fromJson(data, spaceId: spaceId);
        _coversStates[spaceId] = state;
        notifyListeners();
        return state;
      }
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][STATE] API error fetching covers state for $spaceId: ${e.response?.statusCode}',
        );
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][STATE] Error fetching covers state for $spaceId: $e',
        );
      }
    }
    return null;
  }

  // ============================================
  // SENSOR STATE
  // ============================================

  /// Get cached sensor state for a space
  SensorStateModel? getSensorState(String spaceId) {
    return _sensorStates[spaceId];
  }

  /// Update sensor state from WebSocket event
  void updateSensorState(String spaceId, Map<String, dynamic> json) {
    try {
      final state = SensorStateModel.fromJson(json, spaceId: spaceId);
      _sensorStates[spaceId] = state;

      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][STATE] Updated sensor state for space: $spaceId',
        );
      }
      notifyListeners();
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][STATE] Failed to parse sensor state: $e',
        );
      }
    }
  }

  /// Fetch sensor state from API
  Future<SensorStateModel?> fetchSensorState(String spaceId) async {
    try {
      final response = await _apiClient.getSpacesModuleSpaceSensors(
        id: spaceId,
      );

      if (response.response.statusCode == 200) {
        // Prefer typed response data and convert to JSON for existing model
        final apiData = response.data.data;
        final state = SensorStateModel.fromJson(apiData.toJson(), spaceId: spaceId);
        _sensorStates[spaceId] = state;
        notifyListeners();
        return state;
      }
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][STATE] API error fetching sensor state for $spaceId: ${e.response?.statusCode}',
        );
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][STATE] Error fetching sensor state for $spaceId: $e',
        );
      }
    }
    return null;
  }

  // ============================================
  // LIGHTING INTENTS
  // ============================================

  /// Execute a lighting intent
  Future<LightingIntentResult?> executeLightingIntent({
    required String spaceId,
    required LightingIntentType type,
    LightingMode? mode,
    BrightnessDelta? delta,
    bool? increase,
    LightingStateRole? role,
    bool? on,
    int? brightness,
    String? color,
    int? colorTemperature,
    int? white,
  }) async {
    final stopwatch = Stopwatch()..start();
    final intentName = 'lighting_${lightingIntentTypeToString(type)}';

    // Build intent value for optimistic UI
    final intentValue = <String, dynamic>{
      'type': lightingIntentTypeToString(type),
      if (mode != null) 'mode': lightingModeToString(mode),
      if (delta != null) 'delta': brightnessDeltaToString(delta),
      if (increase != null) 'increase': increase,
      if (role != null) 'role': lightingRoleToString(role),
      if (on != null) 'on': on,
      if (brightness != null) 'brightness': brightness,
      if (color != null) 'color': color,
      if (colorTemperature != null) 'colorTemperature': colorTemperature,
      if (white != null) 'white': white,
    };

    // Create local intent for optimistic UI before API call
    _intentsRepository.createLocalSpaceIntent(
      spaceId: spaceId,
      type: _mapLightingIntentType(type),
      value: intentValue,
    );

    try {
      final Map<String, dynamic> body = {
        'type': lightingIntentTypeToString(type),
      };

      if (mode != null) {
        body['mode'] = lightingModeToString(mode);
      }
      if (delta != null) {
        body['delta'] = brightnessDeltaToString(delta);
      }
      if (increase != null) {
        body['increase'] = increase;
      }
      if (role != null) {
        body['role'] = lightingRoleToString(role);
      }
      if (on != null) {
        body['on'] = on;
      }
      if (brightness != null) {
        body['brightness'] = brightness;
      }
      if (color != null) {
        body['color'] = color;
      }
      if (colorTemperature != null) {
        body['color_temperature'] = colorTemperature;
      }
      if (white != null) {
        body['white'] = white;
      }

      final response = await _apiClient.createSpacesModuleSpaceLightingIntent(
        id: spaceId,
        body: SpacesModuleReqLightingIntent(
          data: SpacesModuleLightingIntent.fromJson(body),
        ),
      );

      if (response.response.statusCode == 200 ||
          response.response.statusCode == 201) {
        final data = response.response.data['data'] as Map<String, dynamic>;
        final result = LightingIntentResult.fromJson(data);

        // Track successful intent execution
        stopwatch.stop();
        MetricsService.instance.trackIntent(
          intentName,
          result.failedDevices > 0 ? MetricStatus.partial : MetricStatus.success,
          stopwatch.elapsed,
          spaceId: spaceId,
          affectedDevices: result.affectedDevices,
          failedDevices: result.failedDevices,
        );

        // Refresh undo state after successful intent execution
        // (a new undo window may now be available)
        // Note: Lighting state refresh is handled by WebSocket events
        fetchUndoState(spaceId);

        return result;
      }
    } on DioException catch (e) {
      stopwatch.stop();
      MetricsService.instance.trackIntent(
        intentName,
        MetricStatus.failure,
        stopwatch.elapsed,
        spaceId: spaceId,
      );
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][STATE] API error executing lighting intent for $spaceId: ${e.response?.statusCode}',
        );
      }
    } catch (e) {
      stopwatch.stop();
      MetricsService.instance.trackIntent(
        intentName,
        MetricStatus.failure,
        stopwatch.elapsed,
        spaceId: spaceId,
      );
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][STATE] Error executing lighting intent for $spaceId: $e',
        );
      }
    }
    return null;
  }

  /// Turn all lights off
  Future<LightingIntentResult?> turnLightsOff(String spaceId) {
    return executeLightingIntent(
      spaceId: spaceId,
      type: LightingIntentType.off,
    );
  }

  /// Turn all lights on
  Future<LightingIntentResult?> turnLightsOn(String spaceId) {
    return executeLightingIntent(
      spaceId: spaceId,
      type: LightingIntentType.on,
    );
  }

  /// Set lighting mode
  Future<LightingIntentResult?> setLightingMode(
    String spaceId,
    LightingMode mode,
  ) {
    return executeLightingIntent(
      spaceId: spaceId,
      type: LightingIntentType.setMode,
      mode: mode,
    );
  }

  /// Adjust brightness by delta
  Future<LightingIntentResult?> adjustBrightness(
    String spaceId, {
    required BrightnessDelta delta,
    required bool increase,
  }) {
    return executeLightingIntent(
      spaceId: spaceId,
      type: LightingIntentType.brightnessDelta,
      delta: delta,
      increase: increase,
    );
  }

  /// Turn on lights with specific role
  Future<LightingIntentResult?> turnRoleOn(
    String spaceId,
    LightingStateRole role,
  ) {
    return executeLightingIntent(
      spaceId: spaceId,
      type: LightingIntentType.roleOn,
      role: role,
    );
  }

  /// Turn off lights with specific role
  Future<LightingIntentResult?> turnRoleOff(
    String spaceId,
    LightingStateRole role,
  ) {
    return executeLightingIntent(
      spaceId: spaceId,
      type: LightingIntentType.roleOff,
      role: role,
    );
  }

  /// Set brightness for a specific role
  Future<LightingIntentResult?> setRoleBrightness(
    String spaceId,
    LightingStateRole role,
    int brightness,
  ) {
    return executeLightingIntent(
      spaceId: spaceId,
      type: LightingIntentType.roleBrightness,
      role: role,
      brightness: brightness,
    );
  }

  /// Set color for a specific role
  Future<LightingIntentResult?> setRoleColor(
    String spaceId,
    LightingStateRole role,
    String color,
  ) {
    return executeLightingIntent(
      spaceId: spaceId,
      type: LightingIntentType.roleColor,
      role: role,
      color: color,
    );
  }

  /// Set color temperature for a specific role
  Future<LightingIntentResult?> setRoleColorTemp(
    String spaceId,
    LightingStateRole role,
    int colorTemperature,
  ) {
    return executeLightingIntent(
      spaceId: spaceId,
      type: LightingIntentType.roleColorTemp,
      role: role,
      colorTemperature: colorTemperature,
    );
  }

  // ============================================
  // CLIMATE INTENTS
  // ============================================

  /// Execute a climate intent
  Future<ClimateIntentResult?> executeClimateIntent({
    required String spaceId,
    required ClimateIntentType type,
    SetpointDelta? delta,
    bool? increase,
    double? value,
    double? heatingSetpoint,
    double? coolingSetpoint,
    ClimateMode? mode,
  }) async {
    final stopwatch = Stopwatch()..start();
    final intentName = 'climate_${climateIntentTypeToString(type)}';

    // Build intent value for optimistic UI
    final intentValue = <String, dynamic>{
      'type': climateIntentTypeToString(type),
      if (delta != null) 'delta': setpointDeltaToString(delta),
      if (increase != null) 'increase': increase,
      if (value != null) 'value': value,
      if (heatingSetpoint != null) 'heatingSetpoint': heatingSetpoint,
      if (coolingSetpoint != null) 'coolingSetpoint': coolingSetpoint,
      if (mode != null) 'mode': climateModeToString(mode),
    };

    // Create local intent for optimistic UI before API call
    _intentsRepository.createLocalSpaceIntent(
      spaceId: spaceId,
      type: _mapClimateIntentType(type),
      value: intentValue,
    );

    try {
      final Map<String, dynamic> body = {
        'type': climateIntentTypeToString(type),
      };

      if (delta != null) {
        body['delta'] = setpointDeltaToString(delta);
      }
      if (increase != null) {
        body['increase'] = increase;
      }
      if (value != null) {
        body['value'] = value;
      }
      if (heatingSetpoint != null) {
        body['heating_setpoint'] = heatingSetpoint;
      }
      if (coolingSetpoint != null) {
        body['cooling_setpoint'] = coolingSetpoint;
      }
      if (mode != null) {
        body['mode'] = climateModeToString(mode);
      }

      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][STATE] executeClimateIntent: body=$body',
        );
      }

      final response = await _apiClient.createSpacesModuleSpaceClimateIntent(
        id: spaceId,
        body: SpacesModuleReqClimateIntent(
          data: SpacesModuleClimateIntent.fromJson(body),
        ),
      );

      if (response.response.statusCode == 200 ||
          response.response.statusCode == 201) {
        final data = response.response.data['data'] as Map<String, dynamic>;
        final result = ClimateIntentResult.fromJson(data);

        // Track successful intent execution
        stopwatch.stop();
        MetricsService.instance.trackIntent(
          intentName,
          result.failedDevices > 0 ? MetricStatus.partial : MetricStatus.success,
          stopwatch.elapsed,
          spaceId: spaceId,
          affectedDevices: result.affectedDevices,
          failedDevices: result.failedDevices,
        );

        // Refresh undo state after successful intent execution
        // (a new undo window may now be available)
        // Note: Climate state refresh is handled by WebSocket events
        fetchUndoState(spaceId);

        return result;
      }
    } on DioException catch (e) {
      stopwatch.stop();
      MetricsService.instance.trackIntent(
        intentName,
        MetricStatus.failure,
        stopwatch.elapsed,
        spaceId: spaceId,
      );
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][STATE] API error executing climate intent for $spaceId: ${e.response?.statusCode}',
        );
      }
    } catch (e) {
      stopwatch.stop();
      MetricsService.instance.trackIntent(
        intentName,
        MetricStatus.failure,
        stopwatch.elapsed,
        spaceId: spaceId,
      );
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][STATE] Error executing climate intent for $spaceId: $e',
        );
      }
    }
    return null;
  }

  /// Adjust setpoint by delta
  Future<ClimateIntentResult?> adjustSetpoint(
    String spaceId, {
    required SetpointDelta delta,
    required bool increase,
  }) {
    return executeClimateIntent(
      spaceId: spaceId,
      type: ClimateIntentType.setpointDelta,
      delta: delta,
      increase: increase,
    );
  }

  /// Set exact setpoint value based on mode
  ///
  /// For heat mode: sends heatingSetpoint
  /// For cool mode: sends coolingSetpoint
  /// For auto mode: sends both heatingSetpoint and coolingSetpoint
  /// For off mode: sends heatingSetpoint (preparing for when turned back on)
  Future<ClimateIntentResult?> setSetpoint(
    String spaceId,
    double value, {
    required ClimateMode mode,
  }) {
    switch (mode) {
      case ClimateMode.heat:
      case ClimateMode.off:
        return executeClimateIntent(
          spaceId: spaceId,
          type: ClimateIntentType.setpointSet,
          heatingSetpoint: value,
        );
      case ClimateMode.cool:
        return executeClimateIntent(
          spaceId: spaceId,
          type: ClimateIntentType.setpointSet,
          coolingSetpoint: value,
        );
      case ClimateMode.auto:
        // In auto mode, set both setpoints to the same value
        return executeClimateIntent(
          spaceId: spaceId,
          type: ClimateIntentType.setpointSet,
          heatingSetpoint: value,
          coolingSetpoint: value,
        );
    }
  }

  /// Set climate mode
  Future<ClimateIntentResult?> setClimateMode(
    String spaceId,
    ClimateMode mode,
  ) {
    return executeClimateIntent(
      spaceId: spaceId,
      type: ClimateIntentType.setMode,
      mode: mode,
    );
  }

  // ============================================
  // MEDIA INTENTS
  // ============================================

  /// Execute a media intent
  Future<MediaIntentResult?> executeMediaIntent({
    required String spaceId,
    required MediaIntentType type,
    MediaMode? mode,
    int? volume,
    VolumeDelta? delta,
    bool? increase,
    MediaRole? role,
    bool? on,
    String? source,
  }) async {
    final stopwatch = Stopwatch()..start();
    final intentName = 'media_${mediaIntentTypeToString(type)}';

    final intentValue = <String, dynamic>{
      'type': mediaIntentTypeToString(type),
      if (mode != null) 'mode': mediaModeToString(mode),
      if (volume != null) 'volume': volume,
      if (delta != null) 'delta': volumeDeltaToString(delta),
      if (increase != null) 'increase': increase,
      if (role != null) 'role': mediaRoleToString(role),
      if (on != null) 'on': on,
      if (source != null) 'source': source,
    };

    _intentsRepository.createLocalSpaceIntent(
      spaceId: spaceId,
      type: _mapMediaIntentType(type),
      value: intentValue,
    );

    try {
      final Map<String, dynamic> body = {
        'type': mediaIntentTypeToString(type),
      };

      if (mode != null) {
        body['mode'] = mediaModeToString(mode);
      }
      if (volume != null) {
        body['volume'] = volume;
      }
      if (delta != null) {
        body['delta'] = volumeDeltaToString(delta);
      }
      if (increase != null) {
        body['increase'] = increase;
      }
      if (role != null) {
        body['role'] = mediaRoleToString(role);
      }
      if (on != null) {
        body['on'] = on;
      }
      if (source != null) {
        body['source'] = source;
      }

      final response = await _apiClient.createSpacesModuleSpaceMediaIntent(
        id: spaceId,
        body: SpacesModuleReqMediaIntent(
          data: SpacesModuleMediaIntent.fromJson(body),
        ),
      );

      if (response.response.statusCode == 200 ||
          response.response.statusCode == 201) {
        final data = response.response.data['data'] as Map<String, dynamic>;
        final result = MediaIntentResult.fromJson(data);

        stopwatch.stop();
        MetricsService.instance.trackIntent(
          intentName,
          result.failedDevices > 0 ? MetricStatus.partial : MetricStatus.success,
          stopwatch.elapsed,
          spaceId: spaceId,
          affectedDevices: result.affectedDevices,
          failedDevices: result.failedDevices,
        );

        fetchUndoState(spaceId);

        return result;
      }
    } on DioException catch (e) {
      stopwatch.stop();
      MetricsService.instance.trackIntent(
        intentName,
        MetricStatus.failure,
        stopwatch.elapsed,
        spaceId: spaceId,
      );
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][STATE] API error executing media intent for $spaceId: ${e.response?.statusCode}',
        );
      }
    } catch (e) {
      stopwatch.stop();
      MetricsService.instance.trackIntent(
        intentName,
        MetricStatus.failure,
        stopwatch.elapsed,
        spaceId: spaceId,
      );
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][STATE] Error executing media intent for $spaceId: $e',
        );
      }
    }
    return null;
  }

  /// Set media mode (OFF/BACKGROUND/FOCUSED/PARTY)
  Future<MediaIntentResult?> setMediaMode(
    String spaceId,
    MediaMode mode,
  ) {
    return executeMediaIntent(
      spaceId: spaceId,
      type: MediaIntentType.setMode,
      mode: mode,
    );
  }

  /// Set absolute volume for all media devices
  Future<MediaIntentResult?> setMediaVolume(
    String spaceId,
    int volume,
  ) {
    return executeMediaIntent(
      spaceId: spaceId,
      type: MediaIntentType.volumeSet,
      volume: volume,
    );
  }

  /// Adjust volume by delta
  Future<MediaIntentResult?> adjustMediaVolume(
    String spaceId, {
    required VolumeDelta delta,
    required bool increase,
  }) {
    return executeMediaIntent(
      spaceId: spaceId,
      type: MediaIntentType.volumeDelta,
      delta: delta,
      increase: increase,
    );
  }

  /// Toggle mute on
  Future<MediaIntentResult?> muteMedia(String spaceId) {
    return executeMediaIntent(
      spaceId: spaceId,
      type: MediaIntentType.mute,
    );
  }

  /// Toggle mute off
  Future<MediaIntentResult?> unmuteMedia(String spaceId) {
    return executeMediaIntent(
      spaceId: spaceId,
      type: MediaIntentType.unmute,
    );
  }

  /// Power on media devices
  Future<MediaIntentResult?> powerOnMedia(String spaceId) {
    return executeMediaIntent(
      spaceId: spaceId,
      type: MediaIntentType.powerOn,
    );
  }

  /// Power off media devices
  Future<MediaIntentResult?> powerOffMedia(String spaceId) {
    return executeMediaIntent(
      spaceId: spaceId,
      type: MediaIntentType.powerOff,
    );
  }

  /// Set volume for a specific role
  Future<MediaIntentResult?> setMediaRoleVolume(
    String spaceId, {
    required MediaRole role,
    required int volume,
  }) {
    return executeMediaIntent(
      spaceId: spaceId,
      type: MediaIntentType.roleVolume,
      role: role,
      volume: volume,
    );
  }

  /// Power on/off for a specific role
  Future<MediaIntentResult?> setMediaRolePower(
    String spaceId, {
    required MediaRole role,
    required bool on,
  }) {
    return executeMediaIntent(
      spaceId: spaceId,
      type: MediaIntentType.rolePower,
      role: role,
      on: on,
    );
  }

  /// Set input/source (TV/AVR)
  Future<MediaIntentResult?> setMediaInput(
    String spaceId, {
    required String source,
  }) {
    return executeMediaIntent(
      spaceId: spaceId,
      type: MediaIntentType.inputSet,
      source: source,
    );
  }

  // ============================================
  // COVERS INTENTS
  // ============================================

  /// Execute a covers intent
  Future<CoversIntentResult?> executeCoversIntent({
    required String spaceId,
    required CoversIntentType type,
    PositionDelta? delta,
    bool? increase,
    int? position,
    CoversStateRole? role,
    String? mode,
  }) async {
    final stopwatch = Stopwatch()..start();
    final intentName = 'covers_${coversIntentTypeToString(type)}';

    // Build intent value for optimistic UI
    final intentValue = <String, dynamic>{
      'type': coversIntentTypeToString(type),
      if (delta != null) 'delta': positionDeltaToString(delta),
      if (increase != null) 'increase': increase,
      if (position != null) 'position': position,
      if (role != null) 'role': coversRoleToString(role),
      if (mode != null) 'mode': mode,
    };

    // Create local intent for optimistic UI before API call
    _intentsRepository.createLocalSpaceIntent(
      spaceId: spaceId,
      type: _mapCoversIntentType(type),
      value: intentValue,
    );

    try {
      final Map<String, dynamic> body = {
        'type': coversIntentTypeToString(type),
      };

      if (delta != null) {
        body['delta'] = positionDeltaToString(delta);
      }
      if (increase != null) {
        body['increase'] = increase;
      }
      if (position != null) {
        body['position'] = position;
      }
      if (role != null) {
        body['role'] = coversRoleToString(role);
      }
      if (mode != null) {
        body['mode'] = mode;
      }

      final response = await _apiClient.createSpacesModuleSpaceCoversIntent(
        id: spaceId,
        body: SpacesModuleReqCoversIntent(
          data: SpacesModuleCoversIntent.fromJson(body),
        ),
      );

      if (response.response.statusCode == 200 ||
          response.response.statusCode == 201) {
        final data = response.response.data['data'] as Map<String, dynamic>;
        final result = CoversIntentResult.fromJson(data);

        // Track successful intent execution
        stopwatch.stop();
        MetricsService.instance.trackIntent(
          intentName,
          result.failedDevices > 0 ? MetricStatus.partial : MetricStatus.success,
          stopwatch.elapsed,
          spaceId: spaceId,
          affectedDevices: result.affectedDevices,
          failedDevices: result.failedDevices,
        );

        // Refresh undo state after successful intent execution
        // (a new undo window may now be available)
        // Note: Covers state refresh is handled by WebSocket events
        fetchUndoState(spaceId);

        return result;
      }
    } on DioException catch (e) {
      stopwatch.stop();
      MetricsService.instance.trackIntent(
        intentName,
        MetricStatus.failure,
        stopwatch.elapsed,
        spaceId: spaceId,
      );
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][STATE] API error executing covers intent for $spaceId: ${e.response?.statusCode}',
        );
      }
    } catch (e) {
      stopwatch.stop();
      MetricsService.instance.trackIntent(
        intentName,
        MetricStatus.failure,
        stopwatch.elapsed,
        spaceId: spaceId,
      );
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][STATE] Error executing covers intent for $spaceId: $e',
        );
      }
    }
    return null;
  }

  /// Open all covers in a space
  Future<CoversIntentResult?> openCovers(String spaceId) {
    return executeCoversIntent(
      spaceId: spaceId,
      type: CoversIntentType.open,
    );
  }

  /// Close all covers in a space
  Future<CoversIntentResult?> closeCovers(String spaceId) {
    return executeCoversIntent(
      spaceId: spaceId,
      type: CoversIntentType.close,
    );
  }

  /// Stop all covers movement in a space
  Future<CoversIntentResult?> stopCovers(String spaceId) {
    return executeCoversIntent(
      spaceId: spaceId,
      type: CoversIntentType.stop,
    );
  }

  /// Set covers position
  Future<CoversIntentResult?> setCoversPosition(
    String spaceId,
    int position,
  ) {
    return executeCoversIntent(
      spaceId: spaceId,
      type: CoversIntentType.setPosition,
      position: position,
    );
  }

  /// Adjust position by delta
  Future<CoversIntentResult?> adjustCoversPosition(
    String spaceId, {
    required PositionDelta delta,
    required bool increase,
  }) {
    return executeCoversIntent(
      spaceId: spaceId,
      type: CoversIntentType.positionDelta,
      delta: delta,
      increase: increase,
    );
  }

  /// Set position for covers with a specific role
  Future<CoversIntentResult?> setRolePosition(
    String spaceId,
    CoversStateRole role,
    int position,
  ) {
    return executeCoversIntent(
      spaceId: spaceId,
      type: CoversIntentType.rolePosition,
      role: role,
      position: position,
    );
  }

  /// Set covers mode (open, closed, privacy, daylight)
  Future<CoversIntentResult?> setCoversMode(
    String spaceId,
    CoversMode mode,
  ) {
    return executeCoversIntent(
      spaceId: spaceId,
      type: CoversIntentType.setMode,
      mode: coversModeToString(mode),
    );
  }

  // ============================================
  // SUGGESTIONS
  // ============================================

  /// Get cached suggestion for a space
  SuggestionModel? getSuggestion(String spaceId) {
    return _suggestions[spaceId];
  }

  /// Clear suggestion cache for a space
  void clearSuggestion(String spaceId) {
    _suggestions.remove(spaceId);
    notifyListeners();
  }

  /// Fetch suggestion from API
  Future<SuggestionModel?> fetchSuggestion(String spaceId) async {
    try {
      final response = await _apiClient.getSpacesModuleSpaceSuggestion(
        id: spaceId,
      );

      if (response.response.statusCode == 200) {
        final data = response.response.data['data'];
        if (data != null) {
          final suggestion =
              SuggestionModel.fromJson(data as Map<String, dynamic>);
          _suggestions[spaceId] = suggestion;
          notifyListeners();
          return suggestion;
        } else {
          // No suggestion available
          _suggestions[spaceId] = null;
          notifyListeners();
          return null;
        }
      }
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][STATE] API error fetching suggestion for $spaceId: ${e.response?.statusCode}',
        );
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][STATE] Error fetching suggestion for $spaceId: $e',
        );
      }
    }
    return null;
  }

  /// Submit suggestion feedback
  Future<SuggestionFeedbackResult?> submitSuggestionFeedback(
    String spaceId,
    SuggestionType suggestionType,
    SuggestionFeedback feedback,
  ) async {
    try {
      final response = await _apiClient.createSpacesModuleSpaceSuggestionFeedback(
        id: spaceId,
        body: SpacesModuleReqSuggestionFeedback(
          data: SpacesModuleSuggestionFeedback(
            suggestionType: suggestionTypeToApiEnum(suggestionType),
            feedback: suggestionFeedbackToApiEnum(feedback),
          ),
        ),
      );

      if (response.response.statusCode == 200 ||
          response.response.statusCode == 201) {
        final data = response.response.data['data'] as Map<String, dynamic>;

        // Clear the suggestion after feedback
        _suggestions.remove(spaceId);
        notifyListeners();

        return SuggestionFeedbackResult.fromJson(data);
      }
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][STATE] API error submitting suggestion feedback for $spaceId: ${e.response?.statusCode}',
        );
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][STATE] Error submitting suggestion feedback for $spaceId: $e',
        );
      }
    }
    return null;
  }

  // ============================================
  // UNDO
  // ============================================

  /// Get cached undo state for a space
  UndoStateModel? getUndoState(String spaceId) {
    return _undoStates[spaceId];
  }

  /// Update undo state (called after intent execution)
  void invalidateUndoState(String spaceId) {
    _undoStates.remove(spaceId);
    // Don't notify here - let the caller fetch fresh state
  }

  /// Fetch undo state from API
  Future<UndoStateModel?> fetchUndoState(String spaceId) async {
    try {
      final response = await _apiClient.getSpacesModuleSpaceUndoState(
        id: spaceId,
      );

      if (response.response.statusCode == 200) {
        final rawData = response.response.data['data'];
        // Handle null response (no undo state available)
        if (rawData == null) {
          _undoStates.remove(spaceId);
          notifyListeners();
          return null;
        }
        final data = rawData as Map<String, dynamic>;
        final state = UndoStateModel.fromJson(data);
        _undoStates[spaceId] = state;
        notifyListeners();
        return state;
      }
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][STATE] API error fetching undo state for $spaceId: ${e.response?.statusCode}',
        );
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][STATE] Error fetching undo state for $spaceId: $e',
        );
      }
    }
    return null;
  }

  /// Execute undo
  Future<UndoResultModel?> executeUndo(String spaceId) async {
    try {
      final response = await _apiClient.createSpacesModuleSpaceUndo(
        id: spaceId,
      );

      if (response.response.statusCode == 200 ||
          response.response.statusCode == 201) {
        final rawData = response.response.data['data'];

        // Always clear undo state after attempting execution
        // (whether successful or expired/invalid)
        _undoStates.remove(spaceId);
        notifyListeners();

        // Handle null response (undo expired or could not be executed)
        if (rawData == null) {
          return null;
        }
        final data = rawData as Map<String, dynamic>;

        return UndoResultModel.fromJson(data);
      }
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][STATE] API error executing undo for $spaceId: ${e.response?.statusCode}',
        );
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][STATE] Error executing undo for $spaceId: $e',
        );
      }
    }
    return null;
  }

  // ============================================
  // BATCH OPERATIONS
  // ============================================

  /// Fetch all state for a space
  Future<void> fetchAllState(String spaceId) async {
    _loadingCount++;
    notifyListeners();

    try {
      await Future.wait([
        fetchLightingState(spaceId),
        fetchClimateState(spaceId),
        fetchMediaState(spaceId),
        fetchCoversState(spaceId),
        fetchSensorState(spaceId),
        fetchSuggestion(spaceId),
        fetchUndoState(spaceId),
      ]);
    } finally {
      // Guard against going negative if clearAll was called during fetch
      if (_loadingCount > 0) {
        _loadingCount--;
      }
      notifyListeners();
    }
  }

  /// Clear all cached state
  void clearAll() {
    _lightingStates.clear();
    _climateStates.clear();
    _mediaStates.clear();
    _coversStates.clear();
    _sensorStates.clear();
    _suggestions.clear();
    _undoStates.clear();
    _loadingCount = 0;
    notifyListeners();
  }

  /// Clear cached state for a specific space
  void clearForSpace(String spaceId) {
    _lightingStates.remove(spaceId);
    _climateStates.remove(spaceId);
    _mediaStates.remove(spaceId);
    _coversStates.remove(spaceId);
    _sensorStates.remove(spaceId);
    _suggestions.remove(spaceId);
    _undoStates.remove(spaceId);
    notifyListeners();
  }

  // ============================================
  // INTENT TYPE MAPPING HELPERS
  // ============================================

  /// Map LightingIntentType to IntentType
  IntentType _mapLightingIntentType(LightingIntentType type) {
    switch (type) {
      case LightingIntentType.on:
        return IntentType.spaceLightingOn;
      case LightingIntentType.off:
        return IntentType.spaceLightingOff;
      case LightingIntentType.setMode:
        return IntentType.spaceLightingSetMode;
      case LightingIntentType.brightnessDelta:
        return IntentType.spaceLightingBrightnessDelta;
      case LightingIntentType.roleOn:
        return IntentType.spaceLightingRoleOn;
      case LightingIntentType.roleOff:
        return IntentType.spaceLightingRoleOff;
      case LightingIntentType.roleBrightness:
        return IntentType.spaceLightingRoleBrightness;
      case LightingIntentType.roleColor:
        return IntentType.spaceLightingRoleColor;
      case LightingIntentType.roleColorTemp:
        return IntentType.spaceLightingRoleColorTemp;
      case LightingIntentType.roleWhite:
        return IntentType.spaceLightingRoleWhite;
      case LightingIntentType.roleSet:
        return IntentType.spaceLightingRoleSet;
    }
  }

  /// Map ClimateIntentType to IntentType
  IntentType _mapClimateIntentType(ClimateIntentType type) {
    switch (type) {
      case ClimateIntentType.setMode:
        return IntentType.spaceClimateSetMode;
      case ClimateIntentType.setpointSet:
        return IntentType.spaceClimateSetpointSet;
      case ClimateIntentType.setpointDelta:
        return IntentType.spaceClimateSetpointDelta;
      case ClimateIntentType.climateSet:
        return IntentType.spaceClimateSet;
    }
  }

  /// Map MediaIntentType to IntentType
  IntentType _mapMediaIntentType(MediaIntentType type) {
    switch (type) {
      case MediaIntentType.powerOn:
        return IntentType.spaceMediaPowerOn;
      case MediaIntentType.powerOff:
        return IntentType.spaceMediaPowerOff;
      case MediaIntentType.volumeSet:
        return IntentType.spaceMediaVolumeSet;
      case MediaIntentType.volumeDelta:
        return IntentType.spaceMediaVolumeDelta;
      case MediaIntentType.mute:
        return IntentType.spaceMediaMute;
      case MediaIntentType.unmute:
        return IntentType.spaceMediaUnmute;
      case MediaIntentType.rolePower:
        return IntentType.spaceMediaRolePower;
      case MediaIntentType.roleVolume:
        return IntentType.spaceMediaRoleVolume;
      case MediaIntentType.play:
        return IntentType.spaceMediaPlay;
      case MediaIntentType.pause:
        return IntentType.spaceMediaPause;
      case MediaIntentType.stop:
        return IntentType.spaceMediaStop;
      case MediaIntentType.next:
        return IntentType.spaceMediaNext;
      case MediaIntentType.previous:
        return IntentType.spaceMediaPrevious;
      case MediaIntentType.inputSet:
        return IntentType.spaceMediaInputSet;
      case MediaIntentType.setMode:
        return IntentType.spaceMediaSetMode;
    }
  }

  /// Map CoversIntentType to IntentType
  IntentType _mapCoversIntentType(CoversIntentType type) {
    switch (type) {
      case CoversIntentType.open:
        return IntentType.spaceCoversOpen;
      case CoversIntentType.close:
        return IntentType.spaceCoversClose;
      case CoversIntentType.stop:
        return IntentType.spaceCoversStop;
      case CoversIntentType.setPosition:
        return IntentType.spaceCoversSetPosition;
      case CoversIntentType.positionDelta:
        return IntentType.spaceCoversPositionDelta;
      case CoversIntentType.rolePosition:
        return IntentType.spaceCoversRolePosition;
      case CoversIntentType.setMode:
        return IntentType.spaceCoversSetMode;
    }
  }
}
