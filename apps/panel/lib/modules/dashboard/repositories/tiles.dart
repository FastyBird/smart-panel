import 'package:fastybird_smart_panel/modules/dashboard/mappers/tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/repositories/repository.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:flutter/foundation.dart';

class TilesRepository extends Repository<TileModel> {
  TilesRepository({required super.apiClient});

  List<TileModel> getForParent(String parentId, String parentType) {
    return data.entries
        .where((entry) =>
            entry.value.parentId == parentId &&
            entry.value.parentType == parentType)
        .map((entry) => entry.value)
        .toList();
  }

  void insertTiles(List<Map<String, dynamic>> json) {
    late Map<String, TileModel> insertData = {...data};

    for (var row in json) {
      if (!row.containsKey('type')) {
        if (kDebugMode) {
          debugPrint(
            '[DASHBOARD MODULE][TILES] Missing required attribute: "type" for tile: "${row['id']}"',
          );
        }

        continue;
      }

      final TileType? tileType = TileType.fromValue(row['type']);

      if (tileType == null) {
        if (kDebugMode) {
          debugPrint(
            '[DASHBOARD MODULE][TILES] Unknown tile type: "${row['type']}" for tile: "${row['id']}"',
          );
        }

        continue;
      }

      try {
        TileModel tile = buildTileModel(tileType, row);

        insertData[tile.id] = tile;
      } catch (e) {
        if (kDebugMode) {
          debugPrint(
            '[DASHBOARD MODULE][TILES] Failed to create tile model: ${e.toString()}',
          );
        }

        /// Failed to create new model
      }
    }

    if (!mapEquals(data, insertData)) {
      data = insertData;

      notifyListeners();
    }
  }

  void delete(String id) {
    if (data.containsKey(id) && data.remove(id) != null) {
      if (kDebugMode) {
        debugPrint(
          '[DASHBOARD MODULE][TILES] Removed tile: $id',
        );
      }

      notifyListeners();
    }
  }

  Future<void> fetchTile(
    String id,
  ) async {
    return handleApiCall(
      () async {
        final response = await apiClient.getDashboardModuleTile(id: id);

        final raw = response.response.data['data'] as Map<String, dynamic>;

        insertTiles([raw]);
      },
      'fetch tile',
    );
  }
}
