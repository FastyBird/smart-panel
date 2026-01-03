import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_data_space.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_data_space_type.dart';
import 'package:fastybird_smart_panel/api/spaces_module/spaces_module_client.dart';
import 'package:flutter/foundation.dart';

class SpacesRepository extends ChangeNotifier {
  final SpacesModuleClient _apiClient;

  Map<String, SpacesModuleDataSpace> _spaces = {};
  bool _isLoading = false;

  SpacesRepository({
    required SpacesModuleClient apiClient,
  }) : _apiClient = apiClient;

  SpacesModuleClient get apiClient => _apiClient;

  bool get isLoading => _isLoading;

  /// Get all spaces
  List<SpacesModuleDataSpace> get spaces => _spaces.values.toList();

  /// Get all rooms (spaces with type=room)
  List<SpacesModuleDataSpace> get rooms => _spaces.values
      .where((s) => s.type == SpacesModuleDataSpaceType.room)
      .toList()
    ..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));

  /// Get all zones (spaces with type=zone)
  List<SpacesModuleDataSpace> get zones => _spaces.values
      .where((s) => s.type == SpacesModuleDataSpaceType.zone)
      .toList()
    ..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));

  /// Get a specific space by ID
  SpacesModuleDataSpace? getSpace(String id) => _spaces[id];

  /// Get spaces by list of IDs
  List<SpacesModuleDataSpace> getSpaces(List<String> ids) {
    return _spaces.entries
        .where((entry) => ids.contains(entry.key))
        .map((entry) => entry.value)
        .toList();
  }

  /// Get child rooms of a zone
  List<SpacesModuleDataSpace> getChildRooms(String zoneId) {
    return _spaces.values
        .where((s) => s.parentId == zoneId)
        .toList()
      ..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));
  }

  /// Insert spaces from raw JSON data
  void insert(List<Map<String, dynamic>> jsonList) {
    Map<String, SpacesModuleDataSpace> newData = {..._spaces};

    for (var json in jsonList) {
      try {
        final space = SpacesModuleDataSpace.fromJson(json);
        newData[space.id] = space;
      } catch (e) {
        if (kDebugMode) {
          debugPrint(
            '[SPACES MODULE][SPACES] Failed to parse space: $e',
          );
        }
      }
    }

    if (!mapEquals(_spaces, newData)) {
      _spaces = newData;
      notifyListeners();
    }
  }

  /// Delete a space by ID
  void delete(String id) {
    if (_spaces.containsKey(id) && _spaces.remove(id) != null) {
      if (kDebugMode) {
        debugPrint('[SPACES MODULE][SPACES] Removed space: $id');
      }
      notifyListeners();
    }
  }

  /// Fetch all spaces from the API
  Future<void> fetchAll() async {
    _isLoading = true;
    notifyListeners();

    try {
      final response = await _apiClient.getSpacesModuleSpaces();

      if (response.response.statusCode == 200) {
        final raw = response.response.data['data'] as List;
        insert(raw.cast<Map<String, dynamic>>());
      }
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][SPACES] API error: ${e.response?.statusCode} - ${e.message}',
        );
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][SPACES] Unexpected error: $e',
        );
      }
    }

    _isLoading = false;
    notifyListeners();
  }

  /// Fetch a single space by ID
  Future<void> fetchOne(String id) async {
    try {
      final response = await _apiClient.getSpacesModuleSpace(id: id);

      if (response.response.statusCode == 200) {
        final raw = response.response.data['data'] as Map<String, dynamic>;
        insert([raw]);
      }
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][SPACES] API error fetching space $id: ${e.response?.statusCode} - ${e.message}',
        );
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SPACES MODULE][SPACES] Unexpected error fetching space $id: $e',
        );
      }
    }
  }
}
