import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/api/models/scenes_module_req_trigger_scene.dart';
import 'package:fastybird_smart_panel/api/models/scenes_module_trigger_scene.dart';
import 'package:fastybird_smart_panel/core/services/command_dispatch.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/lighting.dart';
import 'package:fastybird_smart_panel/modules/devices/models/composite_command.dart';
import 'package:fastybird_smart_panel/modules/scenes/constants.dart';
import 'package:fastybird_smart_panel/modules/scenes/models/scenes/scene.dart';
import 'package:fastybird_smart_panel/modules/scenes/repositories/actions.dart';
import 'package:fastybird_smart_panel/modules/scenes/repositories/repository.dart';
import 'package:flutter/foundation.dart';
import 'package:fastybird_smart_panel/plugins/scenes-local/models/local_action.dart';

class ScenesRepository extends Repository<SceneModel> {
  final ActionsRepository _actionsRepository;
  final CommandDispatchService _commandDispatch;

  bool _isLoading = false;

  ScenesRepository({
    required super.apiClient,
    required ActionsRepository actionsRepository,
    required CommandDispatchService commandDispatch,
  })  : _actionsRepository = actionsRepository,
        _commandDispatch = commandDispatch;

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
  ///
  /// Uses WebSocket as primary channel with API fallback when WebSocket is unavailable.
  Future<TriggerSceneResult> triggerScene(String sceneId) async {
    try {
      // Use command dispatch with WebSocket primary and API fallback
      final dispatchResult = _hasCompositeAction(sceneId)
          ? await _commandDispatch.dispatchComposite(
              event: ScenesModuleConstants.triggerSceneEvent,
              handler: ScenesModuleEventHandlerName.triggerScene,
              payload: {'sceneId': sceneId},
              apiFallback: () => _triggerCompositeSceneViaApi(sceneId),
            )
          : await _commandDispatch.dispatch(
        event: ScenesModuleConstants.triggerSceneEvent,
        handler: ScenesModuleEventHandlerName.triggerScene,
        payload: {
          'sceneId': sceneId,
        },
        apiFallback: () => _triggerSceneViaApi(sceneId),
      );

      if (dispatchResult.success ||
          dispatchResult.data?['action_results'] is List ||
          dispatchResult.data?['actionResults'] is List) {
        // Parse result from response data
        final data = dispatchResult.data;
        final successCount = data?['successfulActions'] as int? ??
            data?['successful_actions'] as int? ??
            0;
        final failureCount = data?['failedActions'] as int? ??
            data?['failed_actions'] as int? ??
            0;

        if (kDebugMode) {
          debugPrint(
            '[SCENES MODULE][SCENES] Scene triggered via ${dispatchResult.channel.name}: '
            'successCount=$successCount, failureCount=$failureCount',
          );
        }

        final error = data?['error'] as String?;
        final actionResults = data?['action_results'] ?? data?['actionResults'];
        final composites = actionResults is List
            ? actionResults.whereType<Map<String, dynamic>>()
                .map((action) => action['composite'])
                .whereType<Map<String, dynamic>>()
                .map((value) => CompositeCommandOutcome.fromJson(value, requestId: ''))
                .toList()
            : <CompositeCommandOutcome>[];

        return TriggerSceneResult(
          success: failureCount == 0 && composites.every((outcome) => outcome.confirmed),
          successCount: successCount,
          failureCount: failureCount,
          composites: composites,
          errorMessage: error,
        );
      } else {
        if (kDebugMode) {
          debugPrint(
            '[SCENES MODULE][SCENES] Failed to trigger scene: ${dispatchResult.reason}',
          );
        }

        return TriggerSceneResult.error(
          dispatchResult.reason ?? 'Failed to trigger scene',
        );
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SCENES MODULE][SCENES] Unexpected error triggering scene: $e',
        );
      }

      return TriggerSceneResult.error('Unexpected error');
    }
  }

  /// Trigger scene via API (used as fallback)
  Future<Map<String, dynamic>?> _triggerSceneViaApi(String sceneId) async {
    try {
      final response = await apiClient.triggerScenesModuleScene(
        id: sceneId,
        body: const ScenesModuleReqTriggerScene(
          data: ScenesModuleTriggerScene(
            source: 'panel',
          ),
        ),
      );

      final code = response.response.statusCode ?? 0;
      if (code >= 200 && code < 300) {
        final result = response.data.data;

        return {
          'sceneId': sceneId,
          'status': result.status.name,
          'totalActions': result.totalActions,
          'successfulActions': result.successfulActions,
          'failedActions': result.failedActions,
          'error': result.error,
          'action_results': (response.response.data['data'] as Map<String, dynamic>?)?['action_results'],
        };
      }
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SCENES MODULE][SCENES] API error triggering scene: ${e.response?.statusCode} - ${e.message}',
        );
      }

      final statusCode = e.response?.statusCode;
      if (statusCode == 404) {
        throw Exception('Scene not found');
      } else if (statusCode == 400) {
        throw Exception('Scene cannot be triggered');
      }
    }
    return null;
  }

  bool _hasCompositeAction(String sceneId) {
    if (!locator.isRegistered<DevicesService>()) return true;
    final scene = getScene(sceneId);
    if (scene == null) return true;
    final devices = locator<DevicesService>();
    return scene.actions.any((id) {
      final action = _actionsRepository.getAction(id);
      if (action == null) return true;
      if (action is! LocalActionModel || !action.enabled) return false;
      final device = devices.getDevice(action.deviceId);
      if (device == null) return true;
      return device is LightingDeviceView && device.isCompositeGroup;
    });
  }

  Future<Map<String, dynamic>?> _triggerCompositeSceneViaApi(String sceneId) async {
    final response = await locator<Dio>().post<Map<String, dynamic>>(
      '/modules/scenes/scenes/$sceneId/trigger',
      data: {'data': {'source': 'panel'}},
      options: Options(
        receiveTimeout: const Duration(seconds: 35),
        extra: {'retryExhausted': true},
      ),
    );
    return response.data?['data'] as Map<String, dynamic>?;
  }
}

/// Result of triggering a scene
class TriggerSceneResult {
  final bool success;
  final String? errorMessage;
  final int successCount;
  final int failureCount;
  final List<CompositeCommandOutcome> composites;

  TriggerSceneResult({
    required this.success,
    this.errorMessage,
    this.successCount = 0,
    this.failureCount = 0,
    this.composites = const [],
  });

  factory TriggerSceneResult.error(String message) {
    return TriggerSceneResult(
      success: false,
      errorMessage: message,
    );
  }
}
