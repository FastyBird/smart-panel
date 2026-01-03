import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/models/scenes_module_data_scene.dart';
import 'package:fastybird_smart_panel/api/models/scenes_module_req_trigger_scene.dart';
import 'package:fastybird_smart_panel/api/models/scenes_module_trigger_scene.dart';
import 'package:fastybird_smart_panel/api/scenes_module/scenes_module_client.dart';
import 'package:flutter/foundation.dart';

class ScenesRepository extends ChangeNotifier {
  final ScenesModuleClient _apiClient;

  Map<String, ScenesModuleDataScene> _scenes = {};
  bool _isLoading = false;

  ScenesRepository({
    required ScenesModuleClient apiClient,
  }) : _apiClient = apiClient;

  ScenesModuleClient get apiClient => _apiClient;

  bool get isLoading => _isLoading;

  /// Get all scenes
  List<ScenesModuleDataScene> get scenes => _scenes.values.toList();

  /// Get triggerable scenes only
  List<ScenesModuleDataScene> get triggerableScenes => _scenes.values
      .where((s) => s.enabled && s.triggerable)
      .toList()
    ..sort((a, b) => a.order.compareTo(b.order));

  /// Get a specific scene by ID
  ScenesModuleDataScene? getScene(String id) => _scenes[id];

  /// Get scenes by list of IDs
  List<ScenesModuleDataScene> getScenes(List<String> ids) {
    return _scenes.entries
        .where((entry) => ids.contains(entry.key))
        .map((entry) => entry.value)
        .toList();
  }

  /// Get scenes for a specific space (by primarySpaceId)
  List<ScenesModuleDataScene> getScenesForSpace(String spaceId) {
    return _scenes.values
        .where((s) => s.primarySpaceId == spaceId && s.enabled && s.triggerable)
        .toList()
      ..sort((a, b) => a.order.compareTo(b.order));
  }

  /// Insert scenes from raw JSON data
  void insert(List<Map<String, dynamic>> jsonList) {
    Map<String, ScenesModuleDataScene> newData = {..._scenes};

    for (var json in jsonList) {
      try {
        final scene = ScenesModuleDataScene.fromJson(json);
        newData[scene.id] = scene;
      } catch (e) {
        if (kDebugMode) {
          debugPrint(
            '[SCENES MODULE][SCENES] Failed to parse scene: $e',
          );
        }
      }
    }

    if (!mapEquals(_scenes, newData)) {
      _scenes = newData;
      notifyListeners();
    }
  }

  /// Delete a scene by ID
  void delete(String id) {
    if (_scenes.containsKey(id) && _scenes.remove(id) != null) {
      if (kDebugMode) {
        debugPrint('[SCENES MODULE][SCENES] Removed scene: $id');
      }
      notifyListeners();
    }
  }

  /// Fetch all scenes from the API
  Future<void> fetchAll() async {
    _isLoading = true;
    notifyListeners();

    try {
      final response = await _apiClient.getScenesModuleScenes();

      if (response.response.statusCode == 200) {
        final raw = response.response.data['data'] as List;
        insert(raw.cast<Map<String, dynamic>>());
      }
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SCENES MODULE][SCENES] API error: ${e.response?.statusCode} - ${e.message}',
        );
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SCENES MODULE][SCENES] Unexpected error: $e',
        );
      }
    }

    _isLoading = false;
    notifyListeners();
  }

  /// Fetch a single scene by ID
  Future<void> fetchOne(String id) async {
    try {
      final response = await _apiClient.getScenesModuleScene(id: id);

      if (response.response.statusCode == 200) {
        final raw = response.response.data['data'] as Map<String, dynamic>;
        insert([raw]);
      }
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SCENES MODULE][SCENES] API error fetching scene $id: ${e.response?.statusCode} - ${e.message}',
        );
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SCENES MODULE][SCENES] Unexpected error fetching scene $id: $e',
        );
      }
    }
  }

  /// Trigger a scene
  Future<TriggerSceneResult> triggerScene(String sceneId) async {
    try {
      final response = await _apiClient.triggerScenesModuleScene(
        id: sceneId,
        body: const ScenesModuleReqTriggerScene(
          data: ScenesModuleTriggerScene(
            source: 'panel',
          ),
        ),
      );

      if (response.response.statusCode == 200) {
        final data = response.data.data;

        if (kDebugMode) {
          debugPrint(
            '[SCENES MODULE][SCENES] Scene triggered: status=${data.status}, '
            'successCount=${data.successfulActions}, failureCount=${data.failedActions}',
          );
        }

        return TriggerSceneResult(
          success: data.failedActions == 0,
          successCount: data.successfulActions,
          failureCount: data.failedActions,
        );
      }

      return TriggerSceneResult.error(
        'Failed to trigger scene: ${response.response.statusCode}',
      );
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SCENES MODULE][SCENES] Failed to trigger scene: ${e.response?.statusCode} - ${e.message}',
        );
      }

      final statusCode = e.response?.statusCode;
      if (statusCode == 404) {
        return TriggerSceneResult.error('Scene not found');
      } else if (statusCode == 400) {
        return TriggerSceneResult.error('Scene cannot be triggered');
      }

      return TriggerSceneResult.error('Network error');
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SCENES MODULE][SCENES] Unexpected error triggering scene: $e',
        );
      }

      return TriggerSceneResult.error('Unexpected error');
    }
  }
}

/// Result of triggering a scene
class TriggerSceneResult {
  final bool success;
  final String? errorMessage;
  final int successCount;
  final int failureCount;

  TriggerSceneResult({
    required this.success,
    this.errorMessage,
    this.successCount = 0,
    this.failureCount = 0,
  });

  factory TriggerSceneResult.error(String message) {
    return TriggerSceneResult(
      success: false,
      errorMessage: message,
    );
  }
}
