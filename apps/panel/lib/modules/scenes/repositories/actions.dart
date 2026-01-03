import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/modules/scenes/mappers/action.dart';
import 'package:fastybird_smart_panel/modules/scenes/models/actions/action.dart';
import 'package:fastybird_smart_panel/modules/scenes/repositories/repository.dart';
import 'package:flutter/foundation.dart';

class ActionsRepository extends Repository<ActionModel> {
  bool _isLoading = false;

  ActionsRepository({
    required super.apiClient,
  });

  bool get isLoading => _isLoading;

  /// Get all actions
  List<ActionModel> get actions => data.values.toList();

  /// Get a specific action by ID
  ActionModel? getAction(String id) => getItem(id);

  /// Insert actions from raw JSON data
  void insert(List<Map<String, dynamic>> jsonList) {
    Map<String, ActionModel> newData = {...data};

    for (var json in jsonList) {
      try {
        final action = buildActionModel(json);
        newData[action.id] = action;
      } catch (e) {
        if (kDebugMode) {
          debugPrint(
            '[SCENES MODULE][ACTIONS] Failed to parse action: $e',
          );
        }
      }
    }

    if (!mapEquals(data, newData)) {
      data = newData;
      notifyListeners();
    }
  }

  /// Delete an action by ID
  void delete(String id) {
    if (data.containsKey(id) && data.remove(id) != null) {
      if (kDebugMode) {
        debugPrint('[SCENES MODULE][ACTIONS] Removed action: $id');
      }
      notifyListeners();
    }
  }

  /// Delete all actions for a specific scene (cleanup operation)
  void deleteForScene(String sceneId) {
    final actionsToDelete = data.values
        .where((a) => a.scene == sceneId)
        .map((a) => a.id)
        .toList();

    if (actionsToDelete.isNotEmpty) {
      for (var id in actionsToDelete) {
        data.remove(id);
      }

      if (kDebugMode) {
        debugPrint(
          '[SCENES MODULE][ACTIONS] Removed ${actionsToDelete.length} actions for scene: $sceneId',
        );
      }
      notifyListeners();
    }
  }

  /// Fetch all actions for a scene from the API
  Future<void> fetchAll(String sceneId) async {
    _isLoading = true;
    notifyListeners();

    try {
      final response = await apiClient.getScenesModuleSceneActions(
        sceneId: sceneId,
      );

      if (response.response.statusCode == 200) {
        final raw = response.response.data['data'] as List;
        insert(raw.cast<Map<String, dynamic>>());
      }
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SCENES MODULE][ACTIONS] API error: ${e.response?.statusCode} - ${e.message}',
        );
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SCENES MODULE][ACTIONS] Unexpected error: $e',
        );
      }
    }

    _isLoading = false;
    notifyListeners();
  }

  /// Fetch a single action by ID
  Future<void> fetchOne(String sceneId, String actionId) async {
    try {
      final response = await apiClient.getScenesModuleSceneAction(
        sceneId: sceneId,
        id: actionId,
      );

      if (response.response.statusCode == 200) {
        final raw = response.response.data['data'] as Map<String, dynamic>;
        insert([raw]);
      }
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SCENES MODULE][ACTIONS] API error fetching action $actionId: ${e.response?.statusCode} - ${e.message}',
        );
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SCENES MODULE][ACTIONS] Unexpected error fetching action $actionId: $e',
        );
      }
    }
  }
}
