import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_lighting_intent.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_req_lighting_intent.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_climate_intent.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_req_climate_intent.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_suggestion_feedback.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_req_suggestion_feedback.dart';
import 'package:fastybird_smart_panel/api/spaces_module/spaces_module_client.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/climate_state/climate_state.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/intent_result/intent_result.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/lighting_state/lighting_state.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/suggestion/suggestion.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/undo/undo_state.dart';
import 'package:flutter/foundation.dart';

/// Lighting intent type enum
enum LightingIntentType {
  off,
  on,
  setMode,
  brightnessDelta,
  roleOn,
  roleOff,
  roleBrightness,
  roleColor,
  roleColorTemp,
  roleWhite,
  roleSet,
}

/// Brightness delta size
enum BrightnessDelta {
  small,
  medium,
  large,
}

/// Climate intent type enum
enum ClimateIntentType {
  setpointDelta,
  setpointSet,
  setMode,
  climateSet,
}

/// Setpoint delta size
enum SetpointDelta {
  small,
  medium,
  large,
}

/// Convert LightingIntentType to API string
String _lightingIntentTypeToString(LightingIntentType type) {
  switch (type) {
    case LightingIntentType.off:
      return 'off';
    case LightingIntentType.on:
      return 'on';
    case LightingIntentType.setMode:
      return 'set_mode';
    case LightingIntentType.brightnessDelta:
      return 'brightness_delta';
    case LightingIntentType.roleOn:
      return 'role_on';
    case LightingIntentType.roleOff:
      return 'role_off';
    case LightingIntentType.roleBrightness:
      return 'role_brightness';
    case LightingIntentType.roleColor:
      return 'role_color';
    case LightingIntentType.roleColorTemp:
      return 'role_color_temp';
    case LightingIntentType.roleWhite:
      return 'role_white';
    case LightingIntentType.roleSet:
      return 'role_set';
  }
}

/// Convert BrightnessDelta to API string
String _brightnessDeltaToString(BrightnessDelta delta) {
  switch (delta) {
    case BrightnessDelta.small:
      return 'small';
    case BrightnessDelta.medium:
      return 'medium';
    case BrightnessDelta.large:
      return 'large';
  }
}

/// Convert ClimateIntentType to API string
String _climateIntentTypeToString(ClimateIntentType type) {
  switch (type) {
    case ClimateIntentType.setpointDelta:
      return 'setpoint_delta';
    case ClimateIntentType.setpointSet:
      return 'setpoint_set';
    case ClimateIntentType.setMode:
      return 'set_mode';
    case ClimateIntentType.climateSet:
      return 'climate_set';
  }
}

/// Convert SetpointDelta to API string
String _setpointDeltaToString(SetpointDelta delta) {
  switch (delta) {
    case SetpointDelta.small:
      return 'small';
    case SetpointDelta.medium:
      return 'medium';
    case SetpointDelta.large:
      return 'large';
  }
}

/// Convert LightingMode to API string
String _lightingModeToString(LightingMode mode) {
  switch (mode) {
    case LightingMode.work:
      return 'work';
    case LightingMode.relax:
      return 'relax';
    case LightingMode.night:
      return 'night';
  }
}

/// Convert LightingStateRole to API string
String _lightingRoleToString(LightingStateRole role) {
  switch (role) {
    case LightingStateRole.main:
      return 'main';
    case LightingStateRole.task:
      return 'task';
    case LightingStateRole.ambient:
      return 'ambient';
    case LightingStateRole.accent:
      return 'accent';
    case LightingStateRole.night:
      return 'night';
    case LightingStateRole.other:
      return 'other';
  }
}

/// Repository for space state (lighting, climate, suggestions, undo)
class SpaceStateRepository extends ChangeNotifier {
  final SpacesModuleClient _apiClient;

  /// Cached lighting states by space ID
  final Map<String, LightingStateModel> _lightingStates = {};

  /// Cached climate states by space ID
  final Map<String, ClimateStateModel> _climateStates = {};

  /// Cached suggestions by space ID (null means no suggestion available)
  final Map<String, SuggestionModel?> _suggestions = {};

  /// Cached undo states by space ID
  final Map<String, UndoStateModel> _undoStates = {};

  bool _isLoading = false;

  SpaceStateRepository({
    required SpacesModuleClient apiClient,
  }) : _apiClient = apiClient;

  SpacesModuleClient get apiClient => _apiClient;

  bool get isLoading => _isLoading;

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
    try {
      final Map<String, dynamic> body = {
        'type': _lightingIntentTypeToString(type),
      };

      if (mode != null) {
        body['mode'] = _lightingModeToString(mode);
      }
      if (delta != null) {
        body['delta'] = _brightnessDeltaToString(delta);
      }
      if (increase != null) {
        body['increase'] = increase;
      }
      if (role != null) {
        body['role'] = _lightingRoleToString(role);
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

        // Refresh undo state after successful intent execution
        // (a new undo window may now be available)
        // Note: Lighting state refresh is handled by WebSocket events
        fetchUndoState(spaceId);

        return result;
      }
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][STATE] API error executing lighting intent for $spaceId: ${e.response?.statusCode}',
        );
      }
    } catch (e) {
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
    try {
      final Map<String, dynamic> body = {
        'type': _climateIntentTypeToString(type),
      };

      if (delta != null) {
        body['delta'] = _setpointDeltaToString(delta);
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

        // Refresh undo state after successful intent execution
        // (a new undo window may now be available)
        // Note: Climate state refresh is handled by WebSocket events
        fetchUndoState(spaceId);

        return result;
      }
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][STATE] API error executing climate intent for $spaceId: ${e.response?.statusCode}',
        );
      }
    } catch (e) {
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

  /// Set exact setpoint value
  Future<ClimateIntentResult?> setSetpoint(
    String spaceId,
    double value,
  ) {
    return executeClimateIntent(
      spaceId: spaceId,
      type: ClimateIntentType.setpointSet,
      value: value,
    );
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
        final data = response.response.data['data'] as Map<String, dynamic>;
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
        final data = response.response.data['data'] as Map<String, dynamic>;

        // Clear undo state after execution
        _undoStates.remove(spaceId);
        notifyListeners();

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
    _isLoading = true;
    notifyListeners();

    await Future.wait([
      fetchLightingState(spaceId),
      fetchClimateState(spaceId),
      fetchSuggestion(spaceId),
      fetchUndoState(spaceId),
    ]);

    _isLoading = false;
    notifyListeners();
  }

  /// Clear all cached state
  void clearAll() {
    _lightingStates.clear();
    _climateStates.clear();
    _suggestions.clear();
    _undoStates.clear();
    notifyListeners();
  }

  /// Clear cached state for a specific space
  void clearForSpace(String spaceId) {
    _lightingStates.remove(spaceId);
    _climateStates.remove(spaceId);
    _suggestions.remove(spaceId);
    _undoStates.remove(spaceId);
    notifyListeners();
  }
}
