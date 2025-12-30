import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/modules/scenes/models/scene.dart';
import 'package:flutter/foundation.dart';

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

  factory TriggerSceneResult.fromJson(Map<String, dynamic> json) {
    final data = json['data'] as Map<String, dynamic>? ?? json;
    return TriggerSceneResult(
      success: data['success'] as bool? ?? false,
      successCount: data['success_count'] as int? ?? 0,
      failureCount: data['failure_count'] as int? ?? 0,
    );
  }

  factory TriggerSceneResult.error(String message) {
    return TriggerSceneResult(
      success: false,
      errorMessage: message,
    );
  }
}

/// Service for interacting with the Scenes Module API
class ScenesService extends ChangeNotifier {
  final Dio _dio;

  // Cache of scenes by spaceId
  final Map<String, List<SceneModel>> _scenesBySpace = {};

  // Loading state per space
  final Map<String, bool> _loadingBySpace = {};

  ScenesService({required Dio dio}) : _dio = dio;

  /// Get cached scenes for a space
  List<SceneModel> getScenesForSpace(String spaceId) {
    return _scenesBySpace[spaceId] ?? [];
  }

  /// Check if scenes are loading for a space
  bool isLoadingForSpace(String spaceId) {
    return _loadingBySpace[spaceId] ?? false;
  }

  /// Fetch scenes for a specific space from the API
  Future<List<SceneModel>> fetchScenesForSpace(String spaceId) async {
    _loadingBySpace[spaceId] = true;
    notifyListeners();

    try {
      final response = await _dio.get(
        '/api/v1/scenes-module/scenes',
        queryParameters: {'space_id': spaceId},
      );

      if (response.statusCode == 200) {
        final data = response.data['data'] as List?;

        if (data == null) {
          _scenesBySpace[spaceId] = [];
          return [];
        }

        final scenes = data
            .map((json) => SceneModel.fromJson(json as Map<String, dynamic>))
            .where((scene) => scene.enabled && scene.isTriggerable)
            .toList();

        // Sort by display order
        scenes.sort((a, b) => a.displayOrder.compareTo(b.displayOrder));

        _scenesBySpace[spaceId] = scenes;
        _loadingBySpace[spaceId] = false;
        notifyListeners();

        if (kDebugMode) {
          debugPrint(
            '[SCENES SERVICE] Fetched ${scenes.length} scenes for space $spaceId',
          );
        }

        return scenes;
      }

      _loadingBySpace[spaceId] = false;
      notifyListeners();

      return [];
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SCENES SERVICE] Failed to fetch scenes: ${e.response?.statusCode} - ${e.message}',
        );
      }

      _loadingBySpace[spaceId] = false;
      notifyListeners();

      return [];
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SCENES SERVICE] Unexpected error fetching scenes: $e',
        );
      }

      _loadingBySpace[spaceId] = false;
      notifyListeners();

      return [];
    }
  }

  /// Trigger (apply) a scene
  Future<TriggerSceneResult> triggerScene(String sceneId) async {
    try {
      final response = await _dio.post(
        '/api/v1/scenes-module/scenes/$sceneId/trigger',
      );

      if (response.statusCode == 200) {
        final result = TriggerSceneResult.fromJson(
          response.data as Map<String, dynamic>,
        );

        if (kDebugMode) {
          debugPrint(
            '[SCENES SERVICE] Scene triggered: success=${result.success}, '
            'successCount=${result.successCount}, failureCount=${result.failureCount}',
          );
        }

        return result;
      }

      return TriggerSceneResult.error(
        'Failed to trigger scene: ${response.statusCode}',
      );
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SCENES SERVICE] Failed to trigger scene: ${e.response?.statusCode} - ${e.message}',
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
          '[SCENES SERVICE] Unexpected error triggering scene: $e',
        );
      }

      return TriggerSceneResult.error('Unexpected error');
    }
  }

  /// Clear cached scenes for a space
  void clearCacheForSpace(String spaceId) {
    _scenesBySpace.remove(spaceId);
    notifyListeners();
  }

  /// Clear all cached scenes
  void clearAllCache() {
    _scenesBySpace.clear();
    notifyListeners();
  }
}
