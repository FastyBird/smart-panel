import 'dart:async';

import 'package:fastybird_smart_panel/api/models/scenes_module_data_scene_category.dart';
import 'package:fastybird_smart_panel/modules/scenes/mappers/action.dart';
import 'package:fastybird_smart_panel/modules/scenes/mappers/scene.dart';
import 'package:fastybird_smart_panel/modules/scenes/repositories/actions.dart';
import 'package:fastybird_smart_panel/modules/scenes/repositories/scenes.dart';
import 'package:fastybird_smart_panel/modules/scenes/views/actions/view.dart';
import 'package:fastybird_smart_panel/modules/scenes/views/scenes/view.dart';
import 'package:flutter/foundation.dart';

class ScenesService extends ChangeNotifier {
  final ScenesRepository _scenesRepository;
  final ActionsRepository _actionsRepository;

  Map<String, SceneView> _scenes = {};
  Map<String, ActionView> _actions = {};

  Timer? _updateDebounce;

  ScenesService({
    required ScenesRepository scenesRepository,
    required ActionsRepository actionsRepository,
  })  : _scenesRepository = scenesRepository,
        _actionsRepository = actionsRepository;

  Future<void> initialize() async {
    // Fetch scenes - actions are automatically inserted by ScenesRepository
    await _scenesRepository.fetchAll();

    _scenesRepository.addListener(_scheduleUpdate);
    _actionsRepository.addListener(_scheduleUpdate);

    _updateData();
  }

  /// All scenes as a map by ID
  Map<String, SceneView> get scenes => _scenes;

  /// All actions as a map by ID
  Map<String, ActionView> get actions => _actions;

  /// All scenes as a list
  List<SceneView> get scenesList => _scenes.values.toList();

  /// All triggerable scenes sorted by order
  List<SceneView> get triggerableScenes => _scenes.values
      .where((s) => s.enabled && s.triggerable)
      .toList()
    ..sort((a, b) => a.order.compareTo(b.order));

  /// Get a specific scene by ID
  SceneView? getScene(String id) {
    return _scenes[id];
  }

  /// Get scenes by list of IDs
  List<SceneView> getScenes(List<String> ids) {
    return _scenes.entries
        .where((entry) => ids.contains(entry.key))
        .map((entry) => entry.value)
        .toList();
  }

  /// Get scenes for a specific space
  List<SceneView> getScenesForSpace(String spaceId) {
    return _scenes.values
        .where((s) => s.primarySpaceId == spaceId && s.enabled && s.triggerable)
        .toList()
      ..sort((a, b) => a.order.compareTo(b.order));
  }

  /// Get scenes by category
  List<SceneView> getScenesByCategory(
    ScenesModuleDataSceneCategory category,
  ) {
    return _scenes.values
        .where((s) => s.category == category && s.enabled)
        .toList()
      ..sort((a, b) => a.order.compareTo(b.order));
  }

  /// Get an action by ID
  ActionView? getAction(String id) {
    return _actions[id];
  }

  /// Get actions for a specific scene
  List<ActionView> getActionsForScene(String sceneId) {
    return _actions.values
        .where((a) => a.scene == sceneId)
        .toList()
      ..sort((a, b) => a.order.compareTo(b.order));
  }

  /// Trigger a scene
  Future<TriggerSceneResult> triggerScene(String sceneId) async {
    return _scenesRepository.triggerScene(sceneId);
  }

  void _scheduleUpdate() {
    _updateDebounce?.cancel();
    _updateDebounce = Timer(const Duration(milliseconds: 50), _updateData);
  }

  void _updateData() {
    final sceneModels = _scenesRepository.scenes;
    final actionModels = _actionsRepository.actions;

    late bool triggerNotifyListeners = false;

    // Build action views first (needed for scene views)
    Map<String, ActionView> newActionsViews = {};

    for (var action in actionModels) {
      try {
        newActionsViews[action.id] = buildActionView(action);
      } catch (e) {
        if (kDebugMode) {
          debugPrint(
            '[SCENES MODULE][SERVICE] Failed to create action view: ${e.toString()}',
          );
        }
      }
    }

    if (!mapEquals(_actions, newActionsViews)) {
      _actions = newActionsViews;
      triggerNotifyListeners = true;
    }

    // Build scene views
    Map<String, SceneView> newScenesViews = {};

    for (var scene in sceneModels) {
      try {
        newScenesViews[scene.id] = buildSceneView(scene);
      } catch (e) {
        if (kDebugMode) {
          debugPrint(
            '[SCENES MODULE][SERVICE] Failed to create scene view: ${e.toString()}',
          );
        }
      }
    }

    if (!mapEquals(_scenes, newScenesViews)) {
      _scenes = newScenesViews;
      triggerNotifyListeners = true;
    }

    if (triggerNotifyListeners) {
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _updateDebounce?.cancel();

    _scenesRepository.removeListener(_scheduleUpdate);
    _actionsRepository.removeListener(_scheduleUpdate);

    super.dispose();
  }
}
