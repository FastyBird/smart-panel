import 'package:fastybird_smart_panel/api/models/spaces_module_data_space_type.dart';
import 'package:fastybird_smart_panel/modules/spaces/mappers/light_target.dart';
import 'package:fastybird_smart_panel/modules/spaces/mappers/space.dart';
import 'package:fastybird_smart_panel/modules/spaces/repositories/light_targets.dart';
import 'package:fastybird_smart_panel/modules/spaces/repositories/spaces.dart';
import 'package:fastybird_smart_panel/modules/spaces/views/light_targets/view.dart';
import 'package:fastybird_smart_panel/modules/spaces/views/spaces/view.dart';
import 'package:flutter/foundation.dart';

class SpacesService extends ChangeNotifier {
  final SpacesRepository _spacesRepository;
  final LightTargetsRepository _lightTargetsRepository;

  Map<String, SpaceView> _spaces = {};
  Map<String, LightTargetView> _lightTargets = {};

  SpacesService({
    required SpacesRepository spacesRepository,
    required LightTargetsRepository lightTargetsRepository,
  })  : _spacesRepository = spacesRepository,
        _lightTargetsRepository = lightTargetsRepository;

  Future<void> initialize() async {
    await _spacesRepository.fetchAll();

    _spacesRepository.addListener(_updateData);
    _lightTargetsRepository.addListener(_updateData);

    _updateData();
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
    super.dispose();
  }
}
