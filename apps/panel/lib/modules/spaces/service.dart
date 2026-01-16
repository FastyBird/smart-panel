import 'package:fastybird_smart_panel/api/models/spaces_module_climate_intent_delta.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_data_space_type.dart';
import 'package:fastybird_smart_panel/modules/spaces/mappers/climate_target.dart';
import 'package:fastybird_smart_panel/modules/spaces/mappers/light_target.dart';
import 'package:fastybird_smart_panel/modules/spaces/mappers/space.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/climate_state/climate_state.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/intent_result/intent_result.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/lighting_state/lighting_state.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/suggestion/suggestion.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/undo/undo_state.dart';
import 'package:fastybird_smart_panel/modules/spaces/repositories/climate_targets.dart';
import 'package:fastybird_smart_panel/modules/spaces/repositories/intent_types.dart';
import 'package:fastybird_smart_panel/modules/spaces/repositories/light_targets.dart';
import 'package:fastybird_smart_panel/modules/spaces/repositories/space_state.dart';
import 'package:fastybird_smart_panel/modules/spaces/repositories/spaces.dart';
import 'package:fastybird_smart_panel/modules/spaces/views/climate_targets/view.dart';
import 'package:fastybird_smart_panel/modules/spaces/views/light_targets/view.dart';
import 'package:fastybird_smart_panel/modules/spaces/views/spaces/view.dart';
import 'package:flutter/foundation.dart';

/// Service for managing spaces and their associated state.
///
/// This service aggregates data from multiple repositories and provides
/// a unified view of spaces with their lighting and climate targets.
/// It also handles real-time state updates and intent execution.
///
/// The service provides:
/// - **Space views**: Aggregated space data with light/climate targets
/// - **State access**: Lighting state, climate state, suggestions, undo
/// - **Intent execution**: Execute lighting and climate intents
/// - **Undo functionality**: Revert recent changes within a time window
///
/// Example usage:
/// ```dart
/// final service = SpacesService(
///   spacesRepository: spacesRepo,
///   lightTargetsRepository: lightTargetsRepo,
///   climateTargetsRepository: climateTargetsRepo,
///   spaceStateRepository: stateRepo,
/// );
///
/// await service.initialize();
///
/// // Get all rooms
/// final rooms = service.rooms;
///
/// // Execute a lighting intent
/// final result = await service.executeLightingIntent(
///   spaceId: 'space-123',
///   type: LightingIntentType.off,
/// );
/// ```
class SpacesService extends ChangeNotifier {
  final SpacesRepository _spacesRepository;
  final LightTargetsRepository _lightTargetsRepository;
  final ClimateTargetsRepository _climateTargetsRepository;
  final SpaceStateRepository _spaceStateRepository;

  Map<String, SpaceView> _spaces = {};
  Map<String, LightTargetView> _lightTargets = {};
  Map<String, ClimateTargetView> _climateTargets = {};

  /// Creates a new [SpacesService] with the required repositories.
  SpacesService({
    required SpacesRepository spacesRepository,
    required LightTargetsRepository lightTargetsRepository,
    required ClimateTargetsRepository climateTargetsRepository,
    required SpaceStateRepository spaceStateRepository,
  })  : _spacesRepository = spacesRepository,
        _lightTargetsRepository = lightTargetsRepository,
        _climateTargetsRepository = climateTargetsRepository,
        _spaceStateRepository = spaceStateRepository;

  /// Initializes the service by fetching space data and setting up listeners.
  ///
  /// This must be called before using the service.
  Future<void> initialize() async {
    await _spacesRepository.fetchAll();

    _spacesRepository.addListener(_updateData);
    _lightTargetsRepository.addListener(_updateData);
    _climateTargetsRepository.addListener(_updateData);
    _spaceStateRepository.addListener(_onStateChanged);

    _updateData();
  }

  void _onStateChanged() {
    // Forward state repository notifications to our listeners
    notifyListeners();
  }

  /// All spaces as a map by ID
  Map<String, SpaceView> get spaces => _spaces;

  /// All spaces as a list
  List<SpaceView> get spacesList => _spaces.values.toList();

  /// All rooms (spaces with type=room) sorted by display order
  List<SpaceView> get rooms => _spaces.values
      .where((s) => s.type == SpacesModuleDataSpaceType.room)
      .toList()
    ..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));

  /// All zones (spaces with type=zone) sorted by display order
  List<SpaceView> get zones => _spaces.values
      .where((s) => s.type == SpacesModuleDataSpaceType.zone)
      .toList()
    ..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));

  /// All light targets as a map by ID
  Map<String, LightTargetView> get lightTargets => _lightTargets;

  /// All climate targets as a map by ID
  Map<String, ClimateTargetView> get climateTargets => _climateTargets;

  /// Get a specific space by ID
  SpaceView? getSpace(String id) {
    return _spaces[id];
  }

  /// Get spaces by list of IDs
  List<SpaceView> getSpaces(List<String> ids) {
    return _spaces.entries
        .where((entry) => ids.contains(entry.key))
        .map((entry) => entry.value)
        .toList();
  }

  /// Get child rooms of a zone
  List<SpaceView> getChildRooms(String zoneId) {
    return _spaces.values.where((s) => s.parentId == zoneId).toList()
      ..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));
  }

  /// Get the parent zone of a room
  SpaceView? getParentZone(String roomId) {
    final room = _spaces[roomId];
    if (room == null || room.parentId == null) {
      return null;
    }
    return _spaces[room.parentId];
  }

  /// Get light targets for a specific space
  List<LightTargetView> getLightTargetsForSpace(String spaceId) {
    return _lightTargets.values
        .where((t) => t.spaceId == spaceId)
        .toList()
      ..sort((a, b) => a.priority.compareTo(b.priority));
  }

  /// Get a specific light target by ID
  LightTargetView? getLightTarget(String id) {
    return _lightTargets[id];
  }

  /// Fetch light targets for a specific space
  Future<void> fetchLightTargetsForSpace(String spaceId) async {
    await _lightTargetsRepository.fetchForSpace(spaceId);
  }

  /// Fetch light targets for all rooms
  Future<void> fetchAllLightTargets() async {
    final roomIds = rooms.map((r) => r.id).toList();
    await _lightTargetsRepository.fetchForSpaces(roomIds);
  }

  /// Get climate targets for a specific space
  List<ClimateTargetView> getClimateTargetsForSpace(String spaceId) {
    return _climateTargets.values
        .where((t) => t.spaceId == spaceId)
        .toList()
      ..sort((a, b) => a.priority.compareTo(b.priority));
  }

  /// Get a specific climate target by ID
  ClimateTargetView? getClimateTarget(String id) {
    return _climateTargets[id];
  }

  /// Fetch climate targets for a specific space
  Future<void> fetchClimateTargetsForSpace(String spaceId) async {
    await _climateTargetsRepository.fetchForSpace(spaceId);
  }

  /// Fetch climate targets for all rooms
  Future<void> fetchAllClimateTargets() async {
    final roomIds = rooms.map((r) => r.id).toList();
    await _climateTargetsRepository.fetchForSpaces(roomIds);
  }

  /// Execute a climate setpoint delta intent (adjust temperature by step)
  Future<bool> executeClimateSetpointDelta({
    required String spaceId,
    required SpacesModuleClimateIntentDelta delta,
    required bool increase,
  }) {
    return _climateTargetsRepository.executeSetpointDelta(
      spaceId: spaceId,
      delta: delta,
      increase: increase,
    );
  }

  /// Execute a climate setpoint set intent (set temperature to exact value)
  Future<bool> executeClimateSetpointSet({
    required String spaceId,
    required double value,
  }) {
    return _climateTargetsRepository.executeSetpointSet(
      spaceId: spaceId,
      value: value,
    );
  }

  // ============================================
  // LIGHTING STATE
  // ============================================

  /// Get cached lighting state for a space
  LightingStateModel? getLightingState(String spaceId) {
    return _spaceStateRepository.getLightingState(spaceId);
  }

  /// Fetch lighting state from API
  Future<LightingStateModel?> fetchLightingState(String spaceId) {
    return _spaceStateRepository.fetchLightingState(spaceId);
  }

  // ============================================
  // CLIMATE STATE
  // ============================================

  /// Get cached climate state for a space
  ClimateStateModel? getClimateState(String spaceId) {
    return _spaceStateRepository.getClimateState(spaceId);
  }

  /// Fetch climate state from API
  Future<ClimateStateModel?> fetchClimateState(String spaceId) {
    return _spaceStateRepository.fetchClimateState(spaceId);
  }

  // ============================================
  // LIGHTING INTENTS
  // ============================================

  /// Turn all lights off in a space
  Future<LightingIntentResult?> turnLightsOff(String spaceId) {
    return _spaceStateRepository.turnLightsOff(spaceId);
  }

  /// Turn all lights on in a space
  Future<LightingIntentResult?> turnLightsOn(String spaceId) {
    return _spaceStateRepository.turnLightsOn(spaceId);
  }

  /// Set lighting mode for a space
  Future<LightingIntentResult?> setLightingMode(
    String spaceId,
    LightingMode mode,
  ) {
    return _spaceStateRepository.setLightingMode(spaceId, mode);
  }

  /// Adjust brightness by delta
  Future<LightingIntentResult?> adjustBrightness(
    String spaceId, {
    required BrightnessDelta delta,
    required bool increase,
  }) {
    return _spaceStateRepository.adjustBrightness(
      spaceId,
      delta: delta,
      increase: increase,
    );
  }

  /// Turn on lights with specific role
  Future<LightingIntentResult?> turnRoleOn(
    String spaceId,
    LightingStateRole role,
  ) {
    return _spaceStateRepository.turnRoleOn(spaceId, role);
  }

  /// Turn off lights with specific role
  Future<LightingIntentResult?> turnRoleOff(
    String spaceId,
    LightingStateRole role,
  ) {
    return _spaceStateRepository.turnRoleOff(spaceId, role);
  }

  /// Set brightness for a specific role
  Future<LightingIntentResult?> setRoleBrightness(
    String spaceId,
    LightingStateRole role,
    int brightness,
  ) {
    return _spaceStateRepository.setRoleBrightness(spaceId, role, brightness);
  }

  /// Set color for a specific role
  Future<LightingIntentResult?> setRoleColor(
    String spaceId,
    LightingStateRole role,
    String color,
  ) {
    return _spaceStateRepository.setRoleColor(spaceId, role, color);
  }

  /// Set color temperature for a specific role
  Future<LightingIntentResult?> setRoleColorTemp(
    String spaceId,
    LightingStateRole role,
    int colorTemperature,
  ) {
    return _spaceStateRepository.setRoleColorTemp(
      spaceId,
      role,
      colorTemperature,
    );
  }

  // ============================================
  // CLIMATE INTENTS (via SpaceStateRepository)
  // ============================================

  /// Adjust setpoint by delta
  Future<ClimateIntentResult?> adjustSetpoint(
    String spaceId, {
    required SetpointDelta delta,
    required bool increase,
  }) {
    return _spaceStateRepository.adjustSetpoint(
      spaceId,
      delta: delta,
      increase: increase,
    );
  }

  /// Set exact setpoint value
  Future<ClimateIntentResult?> setSetpoint(String spaceId, double value) {
    return _spaceStateRepository.setSetpoint(spaceId, value);
  }

  /// Set climate mode
  Future<ClimateIntentResult?> setClimateMode(
    String spaceId,
    ClimateMode mode,
  ) {
    return _spaceStateRepository.setClimateMode(spaceId, mode);
  }

  // ============================================
  // SUGGESTIONS
  // ============================================

  /// Get cached suggestion for a space
  SuggestionModel? getSuggestion(String spaceId) {
    return _spaceStateRepository.getSuggestion(spaceId);
  }

  /// Fetch suggestion from API
  Future<SuggestionModel?> fetchSuggestion(String spaceId) {
    return _spaceStateRepository.fetchSuggestion(spaceId);
  }

  /// Submit suggestion feedback (applied or dismissed)
  Future<SuggestionFeedbackResult?> submitSuggestionFeedback(
    String spaceId,
    SuggestionType suggestionType,
    SuggestionFeedback feedback,
  ) {
    return _spaceStateRepository.submitSuggestionFeedback(
      spaceId,
      suggestionType,
      feedback,
    );
  }

  // ============================================
  // UNDO
  // ============================================

  /// Get cached undo state for a space
  UndoStateModel? getUndoState(String spaceId) {
    return _spaceStateRepository.getUndoState(spaceId);
  }

  /// Fetch undo state from API
  Future<UndoStateModel?> fetchUndoState(String spaceId) {
    return _spaceStateRepository.fetchUndoState(spaceId);
  }

  /// Execute undo for a space
  Future<UndoResultModel?> executeUndo(String spaceId) {
    return _spaceStateRepository.executeUndo(spaceId);
  }

  // ============================================
  // BATCH OPERATIONS
  // ============================================

  /// Fetch all state for a space (lighting, climate, suggestion, undo)
  Future<void> fetchAllStateForSpace(String spaceId) {
    return _spaceStateRepository.fetchAllState(spaceId);
  }

  void _updateData() {
    final spaceModels = _spacesRepository.spaces;

    late bool triggerNotifyListeners = false;

    // Build light target views first (needed for space views)
    Map<String, LightTargetView> newLightTargetViews = {};

    for (var space in spaceModels) {
      final lightTargetModels =
          _lightTargetsRepository.getLightTargetsForSpace(space.id);

      for (var lightTarget in lightTargetModels) {
        try {
          newLightTargetViews[lightTarget.id] =
              buildLightTargetView(lightTarget);
        } catch (e) {
          if (kDebugMode) {
            debugPrint(
              '[SPACES MODULE][SERVICE] Failed to create light target view: ${e.toString()}',
            );
          }
        }
      }
    }

    if (!mapEquals(_lightTargets, newLightTargetViews)) {
      _lightTargets = newLightTargetViews;
      triggerNotifyListeners = true;
    }

    // Build climate target views
    Map<String, ClimateTargetView> newClimateTargetViews = {};

    for (var space in spaceModels) {
      final climateTargetModels =
          _climateTargetsRepository.getClimateTargetsForSpace(space.id);

      for (var climateTarget in climateTargetModels) {
        try {
          newClimateTargetViews[climateTarget.id] =
              buildClimateTargetView(climateTarget);
        } catch (e) {
          if (kDebugMode) {
            debugPrint(
              '[SPACES MODULE][SERVICE] Failed to create climate target view: ${e.toString()}',
            );
          }
        }
      }
    }

    if (!mapEquals(_climateTargets, newClimateTargetViews)) {
      _climateTargets = newClimateTargetViews;
      triggerNotifyListeners = true;
    }

    // Build space views
    Map<String, SpaceView> newSpaceViews = {};

    for (var space in spaceModels) {
      try {
        newSpaceViews[space.id] = buildSpaceView(space);
      } catch (e) {
        if (kDebugMode) {
          debugPrint(
            '[SPACES MODULE][SERVICE] Failed to create space view: ${e.toString()}',
          );
        }
      }
    }

    if (!mapEquals(_spaces, newSpaceViews)) {
      _spaces = newSpaceViews;
      triggerNotifyListeners = true;
    }

    if (triggerNotifyListeners) {
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _spacesRepository.removeListener(_updateData);
    _lightTargetsRepository.removeListener(_updateData);
    _climateTargetsRepository.removeListener(_updateData);
    _spaceStateRepository.removeListener(_onStateChanged);

    // Clear internal maps to prevent memory leaks
    _spaces.clear();
    _lightTargets.clear();
    _climateTargets.clear();

    super.dispose();
  }
}
