import 'package:fastybird_smart_panel/api/models/scenes_module_data_scene.dart';
import 'package:fastybird_smart_panel/api/models/scenes_module_data_scene_category.dart';
import 'package:fastybird_smart_panel/modules/scenes/repositories/scenes.dart';
import 'package:flutter/foundation.dart';

class ScenesService extends ChangeNotifier {
  final ScenesRepository _scenesRepository;

  Map<String, ScenesModuleDataScene> _scenes = {};

  ScenesService({
    required ScenesRepository scenesRepository,
  }) : _scenesRepository = scenesRepository;

  Future<void> initialize() async {
    await _scenesRepository.fetchAll();

    _scenesRepository.addListener(_updateData);

    _updateData();
  }

  /// All scenes as a map by ID
  Map<String, ScenesModuleDataScene> get scenes => _scenes;

  /// All scenes as a list
  List<ScenesModuleDataScene> get scenesList => _scenes.values.toList();

  /// All triggerable scenes sorted by order
  List<ScenesModuleDataScene> get triggerableScenes => _scenes.values
      .where((s) => s.enabled && s.triggerable)
      .toList()
    ..sort((a, b) => a.order.compareTo(b.order));

  /// Get a specific scene by ID
  ScenesModuleDataScene? getScene(String id) {
    return _scenes[id];
  }

  /// Get scenes by list of IDs
  List<ScenesModuleDataScene> getScenes(List<String> ids) {
    return _scenes.entries
        .where((entry) => ids.contains(entry.key))
        .map((entry) => entry.value)
        .toList();
  }

  /// Get scenes for a specific space
  List<ScenesModuleDataScene> getScenesForSpace(String spaceId) {
    return _scenes.values
        .where((s) => s.primarySpaceId == spaceId && s.enabled && s.triggerable)
        .toList()
      ..sort((a, b) => a.order.compareTo(b.order));
  }

  /// Get scenes by category
  List<ScenesModuleDataScene> getScenesByCategory(
    ScenesModuleDataSceneCategory category,
  ) {
    return _scenes.values
        .where((s) => s.category == category && s.enabled)
        .toList()
      ..sort((a, b) => a.order.compareTo(b.order));
  }

  /// Trigger a scene
  Future<TriggerSceneResult> triggerScene(String sceneId) async {
    return _scenesRepository.triggerScene(sceneId);
  }

  void _updateData() {
    final newScenes = {for (var s in _scenesRepository.scenes) s.id: s};

    if (!mapEquals(_scenes, newScenes)) {
      _scenes = newScenes;
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _scenesRepository.removeListener(_updateData);
    super.dispose();
  }
}
