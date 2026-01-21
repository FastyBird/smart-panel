import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/spaces_module/spaces_module_client.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/media_targets/media_target.dart';
import 'package:flutter/foundation.dart';

class MediaTargetsRepository extends ChangeNotifier {
  final SpacesModuleClient _apiClient;

  /// Media targets indexed by space ID, then by target ID.
  final Map<String, Map<String, MediaTargetModel>> _mediaTargets = {};
  bool _isLoading = false;

  MediaTargetsRepository({
    required SpacesModuleClient apiClient,
  }) : _apiClient = apiClient;

  SpacesModuleClient get apiClient => _apiClient;

  bool get isLoading => _isLoading;

  List<MediaTargetModel> getMediaTargetsForSpace(String spaceId) {
    return _mediaTargets[spaceId]?.values.toList() ?? [];
  }

  MediaTargetModel? getMediaTarget(String spaceId, String mediaTargetId) {
    return _mediaTargets[spaceId]?[mediaTargetId];
  }

  void insert(String spaceId, List<Map<String, dynamic>> jsonList) {
    Map<String, MediaTargetModel> newData = {...?_mediaTargets[spaceId]};

    for (final json in jsonList) {
      try {
        final mediaTarget = MediaTargetModel.fromJson(json, spaceId: spaceId);
        newData[mediaTarget.id] = mediaTarget;
      } catch (e) {
        if (kDebugMode) {
          debugPrint(
            '[SPACES MODULE][MEDIA_TARGETS] Failed to parse media target: $e',
          );
        }
      }
    }

    if (!mapEquals(_mediaTargets[spaceId], newData)) {
      _mediaTargets[spaceId] = newData;
      notifyListeners();
    }
  }

  void replace(String spaceId, List<Map<String, dynamic>> jsonList) {
    Map<String, MediaTargetModel> newData = {};

    for (final json in jsonList) {
      try {
        final mediaTarget = MediaTargetModel.fromJson(json, spaceId: spaceId);
        newData[mediaTarget.id] = mediaTarget;
      } catch (e) {
        if (kDebugMode) {
          debugPrint(
            '[SPACES MODULE][MEDIA_TARGETS] Failed to parse media target: $e',
          );
        }
      }
    }

    if (!mapEquals(_mediaTargets[spaceId], newData)) {
      _mediaTargets[spaceId] = newData;
      notifyListeners();
    }
  }

  void deleteForSpace(String spaceId) {
    if (_mediaTargets.containsKey(spaceId)) {
      _mediaTargets.remove(spaceId);

      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][MEDIA_TARGETS] Removed all media targets for space: $spaceId',
        );
      }
      notifyListeners();
    }
  }

  void delete(String mediaTargetId) {
    for (final spaceId in _mediaTargets.keys) {
      if (_mediaTargets[spaceId]?.containsKey(mediaTargetId) == true) {
        _mediaTargets[spaceId]!.remove(mediaTargetId);

        if (kDebugMode) {
          debugPrint(
            '[SPACES MODULE][MEDIA_TARGETS] Removed media target: $mediaTargetId from space: $spaceId',
          );
        }
        notifyListeners();
        return;
      }
    }
  }

  void insertOne(Map<String, dynamic> json) {
    final spaceId = json['space'] is Map<String, dynamic>
        ? json['space']['id'] as String?
        : json['space_id'] as String?;

    if (spaceId == null) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][MEDIA_TARGETS] Cannot insert media target: missing space ID',
        );
      }
      return;
    }

    try {
      final mediaTarget = MediaTargetModel.fromJson(json, spaceId: spaceId);
      _mediaTargets[spaceId] ??= {};
      _mediaTargets[spaceId]![mediaTarget.id] = mediaTarget;

      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][MEDIA_TARGETS] Inserted media target: ${mediaTarget.id} for space: $spaceId',
        );
      }
      notifyListeners();
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][MEDIA_TARGETS] Failed to parse media target: $e',
        );
      }
    }
  }

  void updateDeviceName(String deviceId, String newDeviceName) {
    bool updated = false;

    for (final spaceId in _mediaTargets.keys) {
      final targets = _mediaTargets[spaceId]!;

      for (final targetId in targets.keys.toList()) {
        final target = targets[targetId]!;

        if (target.deviceId == deviceId &&
            target.deviceName != newDeviceName) {
          targets[targetId] = target.copyWith(deviceName: newDeviceName);
          updated = true;

          if (kDebugMode) {
            debugPrint(
              '[SPACES MODULE][MEDIA_TARGETS] Updated device name for target: $targetId to: $newDeviceName',
            );
          }
        }
      }
    }

    if (updated) {
      notifyListeners();
    }
  }

  Future<void> fetchForSpace(String spaceId) async {
    _isLoading = true;
    notifyListeners();

    try {
      final response = await _apiClient.getSpacesModuleSpaceMediaTargets(
        id: spaceId,
      );

      if (response.response.statusCode == 200) {
        final raw = response.response.data['data'] as List;
        replace(spaceId, raw.cast<Map<String, dynamic>>());
      }
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][MEDIA_TARGETS] API error for space $spaceId: ${e.response?.statusCode} - ${e.message}',
        );
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][MEDIA_TARGETS] Unexpected error for space $spaceId: $e',
        );
      }
    }

    _isLoading = false;
    notifyListeners();
  }

  Future<void> fetchForSpaces(List<String> spaceIds) async {
    _isLoading = true;
    notifyListeners();

    for (final spaceId in spaceIds) {
      try {
        final response = await _apiClient.getSpacesModuleSpaceMediaTargets(
          id: spaceId,
        );

        if (response.response.statusCode == 200) {
          final raw = response.response.data['data'] as List;
          replace(spaceId, raw.cast<Map<String, dynamic>>());
        }
      } on DioException catch (e) {
        if (kDebugMode) {
          debugPrint(
            '[SPACES MODULE][MEDIA_TARGETS] API error for space $spaceId: ${e.response?.statusCode} - ${e.message}',
          );
        }
      } catch (e) {
        if (kDebugMode) {
          debugPrint(
            '[SPACES MODULE][MEDIA_TARGETS] Unexpected error for space $spaceId: $e',
          );
        }
      }
    }

    _isLoading = false;
    notifyListeners();
  }

  void clearAll() {
    if (_mediaTargets.isNotEmpty) {
      _mediaTargets.clear();
      notifyListeners();
    }
  }
}
