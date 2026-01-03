import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/models/scenes_module_req_trigger_scene.dart';
import 'package:fastybird_smart_panel/api/models/scenes_module_trigger_scene.dart';
import 'package:fastybird_smart_panel/modules/scenes/models/scenes/scene.dart';
import 'package:fastybird_smart_panel/modules/scenes/repositories/actions.dart';
import 'package:fastybird_smart_panel/modules/scenes/repositories/repository.dart';
import 'package:flutter/foundation.dart';

class ScenesRepository extends Repository<SceneModel> {
  final ActionsRepository _actionsRepository;

  bool _isLoading = false;

  ScenesRepository({
    required super.apiClient,
    required ActionsRepository actionsRepository,
  }) : _actionsRepository = actionsRepository;

  bool get isLoading => _isLoading;

  /// Get all scenes
  List<SceneModel> get scenes => data.values.toList();

  /// Get a specific scene by ID
  SceneModel? getScene(String id) => getItem(id);

  /// Insert scenes from raw JSON data
  void insert(List<Map<String, dynamic>> jsonList) {
    Map<String, SceneModel> newData = {...data};
    List<Map<String, dynamic>> embeddedActions = [];

    for (var json in jsonList) {
      try {
        final scene = SceneModel.fromJson(json);
        newData[scene.id] = scene;

        // Extract embedded action objects (not just IDs)
        if (json['actions'] is List) {
          for (var action in json['actions']) {
            if (action is Map<String, dynamic> && action.containsKey('id')) {
              embeddedActions.add(action);
            }
          }
        }
      } catch (e) {
        if (kDebugMode) {
          debugPrint(
            '[SCENES MODULE][SCENES] Failed to parse scene: $e',
          );
        }
      }
    }

    // Insert embedded actions into actions repository
    if (embeddedActions.isNotEmpty) {
      _actionsRepository.insert(embeddedActions);
    }

    if (!mapEquals(data, newData)) {
      data = newData;
      notifyListeners();
    }
  }

  /// Delete a scene by ID
  void delete(String id) {
    if (data.containsKey(id) && data.remove(id) != null) {
      // Also delete associated actions
      _actionsRepository.deleteForScene(id);

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
      final response = await apiClient.getScenesModuleScenes();

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
      final response = await apiClient.getScenesModuleScene(id: id);

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
      final response = await apiClient.triggerScenesModuleScene(
        id: sceneId,
        body: const ScenesModuleReqTriggerScene(
          data: ScenesModuleTriggerScene(
            source: 'panel',
          ),
        ),
      );

      if (response.response.statusCode == 200) {
        final result = response.data.data;

        if (kDebugMode) {
          debugPrint(
            '[SCENES MODULE][SCENES] Scene triggered: status=${result.status}, '
            'successCount=${result.successfulActions}, failureCount=${result.failedActions}',
          );
        }

        return TriggerSceneResult(
          success: result.failedActions == 0,
          successCount: result.successfulActions,
          failureCount: result.failedActions,
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
