import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/spaces_module/spaces_module_client.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/light_targets/light_target.dart';
import 'package:flutter/foundation.dart';

class LightTargetsRepository extends ChangeNotifier {
  final SpacesModuleClient _apiClient;

  /// Light targets indexed by space ID, then by light target ID
  final Map<String, Map<String, LightTargetModel>> _lightTargets = {};
  bool _isLoading = false;

  LightTargetsRepository({
    required SpacesModuleClient apiClient,
  }) : _apiClient = apiClient;

  SpacesModuleClient get apiClient => _apiClient;

  bool get isLoading => _isLoading;

  /// Get all light targets for a specific space
  List<LightTargetModel> getLightTargetsForSpace(String spaceId) {
    return _lightTargets[spaceId]?.values.toList() ?? [];
  }

  /// Get a specific light target
  LightTargetModel? getLightTarget(String spaceId, String lightTargetId) {
    return _lightTargets[spaceId]?[lightTargetId];
  }

  /// Insert light targets for a space from raw JSON data
  void insert(String spaceId, List<Map<String, dynamic>> jsonList) {
    Map<String, LightTargetModel> newData = {...?_lightTargets[spaceId]};

    for (var json in jsonList) {
      try {
        final lightTarget = LightTargetModel.fromJson(json, spaceId: spaceId);
        newData[lightTarget.id] = lightTarget;
      } catch (e) {
        if (kDebugMode) {
          debugPrint(
            '[SPACES MODULE][LIGHT_TARGETS] Failed to parse light target: $e',
          );
        }
      }
    }

    if (!mapEquals(_lightTargets[spaceId], newData)) {
      _lightTargets[spaceId] = newData;
      notifyListeners();
    }
  }

  /// Replace all light targets for a space
  void replace(String spaceId, List<Map<String, dynamic>> jsonList) {
    Map<String, LightTargetModel> newData = {};

    for (var json in jsonList) {
      try {
        final lightTarget = LightTargetModel.fromJson(json, spaceId: spaceId);
        newData[lightTarget.id] = lightTarget;
      } catch (e) {
        if (kDebugMode) {
          debugPrint(
            '[SPACES MODULE][LIGHT_TARGETS] Failed to parse light target: $e',
          );
        }
      }
    }

    if (!mapEquals(_lightTargets[spaceId], newData)) {
      _lightTargets[spaceId] = newData;
      notifyListeners();
    }
  }

  /// Delete all light targets for a space
  void deleteForSpace(String spaceId) {
    if (_lightTargets.containsKey(spaceId)) {
      _lightTargets.remove(spaceId);

      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][LIGHT_TARGETS] Removed all light targets for space: $spaceId',
        );
      }
      notifyListeners();
    }
  }

  /// Delete a single light target by ID
  void delete(String lightTargetId) {
    for (final spaceId in _lightTargets.keys) {
      if (_lightTargets[spaceId]?.containsKey(lightTargetId) == true) {
        _lightTargets[spaceId]!.remove(lightTargetId);

        if (kDebugMode) {
          debugPrint(
            '[SPACES MODULE][LIGHT_TARGETS] Removed light target: $lightTargetId from space: $spaceId',
          );
        }
        notifyListeners();
        return;
      }
    }
  }

  /// Insert or update a single light target from raw JSON data
  void insertOne(Map<String, dynamic> json) {
    final spaceId = json['space'] is Map<String, dynamic>
        ? json['space']['id'] as String?
        : json['space_id'] as String?;

    if (spaceId == null) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][LIGHT_TARGETS] Cannot insert light target: missing space ID',
        );
      }
      return;
    }

    try {
      final lightTarget = LightTargetModel.fromJson(json, spaceId: spaceId);

      _lightTargets[spaceId] ??= {};
      _lightTargets[spaceId]![lightTarget.id] = lightTarget;

      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][LIGHT_TARGETS] Inserted light target: ${lightTarget.id} for space: $spaceId',
        );
      }
      notifyListeners();
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][LIGHT_TARGETS] Failed to parse light target: $e',
        );
      }
    }
  }

  /// Fetch light targets for a specific space from the API
  Future<void> fetchForSpace(String spaceId) async {
    _isLoading = true;
    notifyListeners();

    try {
      final response = await _apiClient.getSpacesModuleSpaceLightingTargets(
        id: spaceId,
      );

      if (response.response.statusCode == 200) {
        final raw = response.response.data['data'] as List;
        replace(spaceId, raw.cast<Map<String, dynamic>>());
      }
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][LIGHT_TARGETS] API error for space $spaceId: ${e.response?.statusCode} - ${e.message}',
        );
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][LIGHT_TARGETS] Unexpected error for space $spaceId: $e',
        );
      }
    }

    _isLoading = false;
    notifyListeners();
  }

  /// Fetch light targets for multiple spaces
  Future<void> fetchForSpaces(List<String> spaceIds) async {
    _isLoading = true;
    notifyListeners();

    for (final spaceId in spaceIds) {
      try {
        final response = await _apiClient.getSpacesModuleSpaceLightingTargets(
          id: spaceId,
        );

        if (response.response.statusCode == 200) {
          final raw = response.response.data['data'] as List;
          replace(spaceId, raw.cast<Map<String, dynamic>>());
        }
      } on DioException catch (e) {
        if (kDebugMode) {
          debugPrint(
            '[SPACES MODULE][LIGHT_TARGETS] API error for space $spaceId: ${e.response?.statusCode} - ${e.message}',
          );
        }
      } catch (e) {
        if (kDebugMode) {
          debugPrint(
            '[SPACES MODULE][LIGHT_TARGETS] Unexpected error for space $spaceId: $e',
          );
        }
      }
    }

    _isLoading = false;
    notifyListeners();
  }
}
