import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_covers_intent.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_covers_intent_delta.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_covers_intent_type.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_req_covers_intent.dart';
import 'package:fastybird_smart_panel/api/spaces_module/spaces_module_client.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/covers_targets/covers_target.dart';
import 'package:flutter/foundation.dart';

class CoversTargetsRepository extends ChangeNotifier {
  final SpacesModuleClient _apiClient;

  /// Covers targets indexed by space ID, then by covers target ID
  final Map<String, Map<String, CoversTargetModel>> _coversTargets = {};
  bool _isLoading = false;

  CoversTargetsRepository({
    required SpacesModuleClient apiClient,
  }) : _apiClient = apiClient;

  SpacesModuleClient get apiClient => _apiClient;

  bool get isLoading => _isLoading;

  /// Get all covers targets for a specific space
  List<CoversTargetModel> getCoversTargetsForSpace(String spaceId) {
    return _coversTargets[spaceId]?.values.toList() ?? [];
  }

  /// Get a specific covers target
  CoversTargetModel? getCoversTarget(String spaceId, String coversTargetId) {
    return _coversTargets[spaceId]?[coversTargetId];
  }

  /// Insert covers targets for a space from raw JSON data
  void insert(String spaceId, List<Map<String, dynamic>> jsonList) {
    Map<String, CoversTargetModel> newData = {...?_coversTargets[spaceId]};

    for (var json in jsonList) {
      try {
        final coversTarget = CoversTargetModel.fromJson(json, spaceId: spaceId);
        newData[coversTarget.id] = coversTarget;
      } catch (e) {
        if (kDebugMode) {
          debugPrint(
            '[SPACES MODULE][COVERS_TARGETS] Failed to parse covers target: $e',
          );
        }
      }
    }

    if (!mapEquals(_coversTargets[spaceId], newData)) {
      _coversTargets[spaceId] = newData;
      notifyListeners();
    }
  }

  /// Replace all covers targets for a space
  void replace(String spaceId, List<Map<String, dynamic>> jsonList) {
    Map<String, CoversTargetModel> newData = {};

    for (var json in jsonList) {
      try {
        final coversTarget = CoversTargetModel.fromJson(json, spaceId: spaceId);
        newData[coversTarget.id] = coversTarget;
      } catch (e) {
        if (kDebugMode) {
          debugPrint(
            '[SPACES MODULE][COVERS_TARGETS] Failed to parse covers target: $e',
          );
        }
      }
    }

    if (!mapEquals(_coversTargets[spaceId], newData)) {
      _coversTargets[spaceId] = newData;
      notifyListeners();
    }
  }

  /// Delete all covers targets for a space
  void deleteForSpace(String spaceId) {
    if (_coversTargets.containsKey(spaceId)) {
      _coversTargets.remove(spaceId);

      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][COVERS_TARGETS] Removed all covers targets for space: $spaceId',
        );
      }
      notifyListeners();
    }
  }

  /// Delete a single covers target by ID
  void delete(String coversTargetId) {
    for (final spaceId in _coversTargets.keys) {
      if (_coversTargets[spaceId]?.containsKey(coversTargetId) == true) {
        _coversTargets[spaceId]!.remove(coversTargetId);

        if (kDebugMode) {
          debugPrint(
            '[SPACES MODULE][COVERS_TARGETS] Removed covers target: $coversTargetId from space: $spaceId',
          );
        }
        notifyListeners();
        return;
      }
    }
  }

  /// Insert or update a single covers target from raw JSON data
  void insertOne(Map<String, dynamic> json) {
    final spaceId = json['space'] is Map<String, dynamic>
        ? json['space']['id'] as String?
        : json['space_id'] as String?;

    if (spaceId == null) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][COVERS_TARGETS] Cannot insert covers target: missing space ID',
        );
      }
      return;
    }

    try {
      final coversTarget = CoversTargetModel.fromJson(json, spaceId: spaceId);

      _coversTargets[spaceId] ??= {};
      _coversTargets[spaceId]![coversTarget.id] = coversTarget;

      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][COVERS_TARGETS] Inserted covers target: ${coversTarget.id} for space: $spaceId',
        );
      }
      notifyListeners();
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][COVERS_TARGETS] Failed to parse covers target: $e',
        );
      }
    }
  }

  /// Update channel name for all covers targets referencing the given channel
  void updateChannelName(String channelId, String newChannelName) {
    bool updated = false;

    for (final spaceId in _coversTargets.keys) {
      final spaceTargets = _coversTargets[spaceId]!;

      for (final targetId in spaceTargets.keys.toList()) {
        final target = spaceTargets[targetId]!;

        if (target.channelId == channelId && target.channelName != newChannelName) {
          spaceTargets[targetId] = target.copyWith(channelName: newChannelName);
          updated = true;

          if (kDebugMode) {
            debugPrint(
              '[SPACES MODULE][COVERS_TARGETS] Updated channel name for target: $targetId to: $newChannelName',
            );
          }
        }
      }
    }

    if (updated) {
      notifyListeners();
    }
  }

  /// Update device name for all covers targets referencing the given device
  void updateDeviceName(String deviceId, String newDeviceName) {
    bool updated = false;

    for (final spaceId in _coversTargets.keys) {
      final spaceTargets = _coversTargets[spaceId]!;

      for (final targetId in spaceTargets.keys.toList()) {
        final target = spaceTargets[targetId]!;

        if (target.deviceId == deviceId && target.deviceName != newDeviceName) {
          spaceTargets[targetId] = target.copyWith(deviceName: newDeviceName);
          updated = true;

          if (kDebugMode) {
            debugPrint(
              '[SPACES MODULE][COVERS_TARGETS] Updated device name for target: $targetId to: $newDeviceName',
            );
          }
        }
      }
    }

    if (updated) {
      notifyListeners();
    }
  }

  /// Fetch covers targets for a specific space from the API
  Future<void> fetchForSpace(String spaceId) async {
    _isLoading = true;
    notifyListeners();

    try {
      final response = await _apiClient.getSpacesModuleSpaceCoversTargets(
        id: spaceId,
      );

      if (response.response.statusCode == 200) {
        final raw = response.response.data['data'] as List;
        replace(spaceId, raw.cast<Map<String, dynamic>>());
      }
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][COVERS_TARGETS] API error for space $spaceId: ${e.response?.statusCode} - ${e.message}',
        );
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][COVERS_TARGETS] Unexpected error for space $spaceId: $e',
        );
      }
    }

    _isLoading = false;
    notifyListeners();
  }

  /// Fetch covers targets for multiple spaces
  Future<void> fetchForSpaces(List<String> spaceIds) async {
    _isLoading = true;
    notifyListeners();

    for (final spaceId in spaceIds) {
      try {
        final response = await _apiClient.getSpacesModuleSpaceCoversTargets(
          id: spaceId,
        );

        if (response.response.statusCode == 200) {
          final raw = response.response.data['data'] as List;
          replace(spaceId, raw.cast<Map<String, dynamic>>());
        }
      } on DioException catch (e) {
        if (kDebugMode) {
          debugPrint(
            '[SPACES MODULE][COVERS_TARGETS] API error for space $spaceId: ${e.response?.statusCode} - ${e.message}',
          );
        }
      } catch (e) {
        if (kDebugMode) {
          debugPrint(
            '[SPACES MODULE][COVERS_TARGETS] Unexpected error for space $spaceId: $e',
          );
        }
      }
    }

    _isLoading = false;
    notifyListeners();
  }

  /// Execute a position delta intent (adjust position by small/medium/large step)
  Future<bool> executePositionDelta({
    required String spaceId,
    required SpacesModuleCoversIntentDelta delta,
    required bool increase,
  }) async {
    try {
      final response = await _apiClient.createSpacesModuleSpaceCoversIntent(
        id: spaceId,
        body: SpacesModuleReqCoversIntent(
          data: SpacesModuleCoversIntent(
            type: SpacesModuleCoversIntentType.positionDelta,
            delta: delta,
            increase: increase,
          ),
        ),
      );

      return response.response.statusCode == 200 ||
          response.response.statusCode == 201;
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][COVERS_TARGETS] Failed to execute position delta: ${e.response?.statusCode} - ${e.message}',
        );
      }
      return false;
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][COVERS_TARGETS] Unexpected error executing position delta: $e',
        );
      }
      return false;
    }
  }

  /// Execute a set position intent (set position to exact value)
  Future<bool> executeSetPosition({
    required String spaceId,
    required int position,
  }) async {
    try {
      final response = await _apiClient.createSpacesModuleSpaceCoversIntent(
        id: spaceId,
        body: SpacesModuleReqCoversIntent(
          data: SpacesModuleCoversIntent(
            type: SpacesModuleCoversIntentType.setPosition,
            position: position,
          ),
        ),
      );

      return response.response.statusCode == 200 ||
          response.response.statusCode == 201;
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][COVERS_TARGETS] Failed to execute set position: ${e.response?.statusCode} - ${e.message}',
        );
      }
      return false;
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][COVERS_TARGETS] Unexpected error executing set position: $e',
        );
      }
      return false;
    }
  }

  /// Clear all cached covers targets
  void clearAll() {
    if (_coversTargets.isNotEmpty) {
      _coversTargets.clear();
      notifyListeners();
    }
  }
}
