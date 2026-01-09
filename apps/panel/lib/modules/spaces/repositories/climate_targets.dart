import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_climate_intent.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_climate_intent_delta.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_climate_intent_type.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_req_climate_intent.dart';
import 'package:fastybird_smart_panel/api/spaces_module/spaces_module_client.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/climate_targets/climate_target.dart';
import 'package:flutter/foundation.dart';

class ClimateTargetsRepository extends ChangeNotifier {
  final SpacesModuleClient _apiClient;

  /// Climate targets indexed by space ID, then by climate target ID
  final Map<String, Map<String, ClimateTargetModel>> _climateTargets = {};
  bool _isLoading = false;

  ClimateTargetsRepository({
    required SpacesModuleClient apiClient,
  }) : _apiClient = apiClient;

  SpacesModuleClient get apiClient => _apiClient;

  bool get isLoading => _isLoading;

  /// Get all climate targets for a specific space
  List<ClimateTargetModel> getClimateTargetsForSpace(String spaceId) {
    return _climateTargets[spaceId]?.values.toList() ?? [];
  }

  /// Get a specific climate target
  ClimateTargetModel? getClimateTarget(String spaceId, String climateTargetId) {
    return _climateTargets[spaceId]?[climateTargetId];
  }

  /// Insert climate targets for a space from raw JSON data
  void insert(String spaceId, List<Map<String, dynamic>> jsonList) {
    Map<String, ClimateTargetModel> newData = {...?_climateTargets[spaceId]};

    for (var json in jsonList) {
      try {
        final climateTarget = ClimateTargetModel.fromJson(json, spaceId: spaceId);
        newData[climateTarget.id] = climateTarget;
      } catch (e) {
        if (kDebugMode) {
          debugPrint(
            '[SPACES MODULE][CLIMATE_TARGETS] Failed to parse climate target: $e',
          );
        }
      }
    }

    if (!mapEquals(_climateTargets[spaceId], newData)) {
      _climateTargets[spaceId] = newData;
      notifyListeners();
    }
  }

  /// Replace all climate targets for a space
  void replace(String spaceId, List<Map<String, dynamic>> jsonList) {
    Map<String, ClimateTargetModel> newData = {};

    for (var json in jsonList) {
      try {
        final climateTarget = ClimateTargetModel.fromJson(json, spaceId: spaceId);
        newData[climateTarget.id] = climateTarget;
      } catch (e) {
        if (kDebugMode) {
          debugPrint(
            '[SPACES MODULE][CLIMATE_TARGETS] Failed to parse climate target: $e',
          );
        }
      }
    }

    if (!mapEquals(_climateTargets[spaceId], newData)) {
      _climateTargets[spaceId] = newData;
      notifyListeners();
    }
  }

  /// Delete all climate targets for a space
  void deleteForSpace(String spaceId) {
    if (_climateTargets.containsKey(spaceId)) {
      _climateTargets.remove(spaceId);

      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][CLIMATE_TARGETS] Removed all climate targets for space: $spaceId',
        );
      }
      notifyListeners();
    }
  }

  /// Delete a single climate target by ID
  void delete(String climateTargetId) {
    for (final spaceId in _climateTargets.keys) {
      if (_climateTargets[spaceId]?.containsKey(climateTargetId) == true) {
        _climateTargets[spaceId]!.remove(climateTargetId);

        if (kDebugMode) {
          debugPrint(
            '[SPACES MODULE][CLIMATE_TARGETS] Removed climate target: $climateTargetId from space: $spaceId',
          );
        }
        notifyListeners();
        return;
      }
    }
  }

  /// Insert or update a single climate target from raw JSON data
  void insertOne(Map<String, dynamic> json) {
    final spaceId = json['space'] is Map<String, dynamic>
        ? json['space']['id'] as String?
        : json['space_id'] as String?;

    if (spaceId == null) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][CLIMATE_TARGETS] Cannot insert climate target: missing space ID',
        );
      }
      return;
    }

    try {
      final climateTarget = ClimateTargetModel.fromJson(json, spaceId: spaceId);

      _climateTargets[spaceId] ??= {};
      _climateTargets[spaceId]![climateTarget.id] = climateTarget;

      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][CLIMATE_TARGETS] Inserted climate target: ${climateTarget.id} for space: $spaceId',
        );
      }
      notifyListeners();
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][CLIMATE_TARGETS] Failed to parse climate target: $e',
        );
      }
    }
  }

  /// Fetch climate targets for a specific space from the API
  Future<void> fetchForSpace(String spaceId) async {
    _isLoading = true;
    notifyListeners();

    try {
      final response = await _apiClient.getSpacesModuleSpaceClimateTargets(
        id: spaceId,
      );

      if (response.response.statusCode == 200) {
        final raw = response.response.data['data'] as List;
        replace(spaceId, raw.cast<Map<String, dynamic>>());
      }
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][CLIMATE_TARGETS] API error for space $spaceId: ${e.response?.statusCode} - ${e.message}',
        );
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][CLIMATE_TARGETS] Unexpected error for space $spaceId: $e',
        );
      }
    }

    _isLoading = false;
    notifyListeners();
  }

  /// Fetch climate targets for multiple spaces
  Future<void> fetchForSpaces(List<String> spaceIds) async {
    _isLoading = true;
    notifyListeners();

    for (final spaceId in spaceIds) {
      try {
        final response = await _apiClient.getSpacesModuleSpaceClimateTargets(
          id: spaceId,
        );

        if (response.response.statusCode == 200) {
          final raw = response.response.data['data'] as List;
          replace(spaceId, raw.cast<Map<String, dynamic>>());
        }
      } on DioException catch (e) {
        if (kDebugMode) {
          debugPrint(
            '[SPACES MODULE][CLIMATE_TARGETS] API error for space $spaceId: ${e.response?.statusCode} - ${e.message}',
          );
        }
      } catch (e) {
        if (kDebugMode) {
          debugPrint(
            '[SPACES MODULE][CLIMATE_TARGETS] Unexpected error for space $spaceId: $e',
          );
        }
      }
    }

    _isLoading = false;
    notifyListeners();
  }

  /// Execute a setpoint delta intent (adjust temperature by small/medium/large step)
  Future<bool> executeSetpointDelta({
    required String spaceId,
    required SpacesModuleClimateIntentDelta delta,
    required bool increase,
  }) async {
    try {
      final response = await _apiClient.createSpacesModuleSpaceClimateIntent(
        id: spaceId,
        body: SpacesModuleReqClimateIntent(
          data: SpacesModuleClimateIntent(
            type: SpacesModuleClimateIntentType.setpointDelta,
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
          '[SPACES MODULE][CLIMATE_TARGETS] Failed to execute setpoint delta: ${e.response?.statusCode} - ${e.message}',
        );
      }
      return false;
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][CLIMATE_TARGETS] Unexpected error executing setpoint delta: $e',
        );
      }
      return false;
    }
  }

  /// Execute a setpoint set intent (set temperature to exact value)
  Future<bool> executeSetpointSet({
    required String spaceId,
    required double value,
  }) async {
    try {
      final response = await _apiClient.createSpacesModuleSpaceClimateIntent(
        id: spaceId,
        body: SpacesModuleReqClimateIntent(
          data: SpacesModuleClimateIntent(
            type: SpacesModuleClimateIntentType.setpointSet,
            value: value,
          ),
        ),
      );

      return response.response.statusCode == 200 ||
          response.response.statusCode == 201;
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][CLIMATE_TARGETS] Failed to execute setpoint set: ${e.response?.statusCode} - ${e.message}',
        );
      }
      return false;
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][CLIMATE_TARGETS] Unexpected error executing setpoint set: $e',
        );
      }
      return false;
    }
  }
}
