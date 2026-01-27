import 'package:fastybird_smart_panel/api/spaces_module/spaces_module_client.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/media_targets/media_target.dart';
import 'package:flutter/foundation.dart';

// Note: Media domain now uses routing-based architecture (V2)
// API endpoints for media targets have been removed
// This repository is stubbed until the new V2 API is available

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

  void deleteByDevice(String spaceId, String deviceId) {
    if (_mediaTargets[spaceId]?.containsKey(deviceId) == true) {
      _mediaTargets[spaceId]!.remove(deviceId);

      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][MEDIA_TARGETS] Removed media target for device: $deviceId in space: $spaceId',
        );
      }

      notifyListeners();
    }
  }

  void updateByDevice(String spaceId, String deviceId, MediaTargetModel model) {
    if (_mediaTargets[spaceId] == null) {
      _mediaTargets[spaceId] = {};
    }
    _mediaTargets[spaceId]![deviceId] = model;

    if (kDebugMode) {
      debugPrint(
        '[SPACES MODULE][MEDIA_TARGETS] Updated media target for device: $deviceId in space: $spaceId',
      );
    }

    notifyListeners();
  }

  /// Stub - media targets API no longer exists
  /// Will be updated when V2 media routing API is available
  Future<void> fetchForSpace(String spaceId) async {
    // API endpoint removed - media domain now uses routing-based architecture
    if (kDebugMode) {
      debugPrint(
        '[SPACES MODULE][MEDIA_TARGETS] fetchForSpace stubbed - API removed',
      );
    }
  }

  /// Stub - media targets API no longer exists
  /// Will be updated when V2 media routing API is available
  Future<void> fetchForSpaces(List<String> spaceIds) async {
    // API endpoint removed - media domain now uses routing-based architecture
    if (kDebugMode) {
      debugPrint(
        '[SPACES MODULE][MEDIA_TARGETS] fetchForSpaces stubbed - API removed',
      );
    }
  }

  void clearAll() {
    if (_mediaTargets.isNotEmpty) {
      _mediaTargets.clear();
      notifyListeners();
    }
  }
}
