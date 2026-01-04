import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/modules/dashboard/export.dart';
import 'package:fastybird_smart_panel/modules/dashboard/mappers/tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/tiles/tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/repositories/repository.dart';
import 'package:flutter/foundation.dart';

class TilesRepository extends Repository<TileModel> {
  TilesRepository({required super.apiClient});

  void insert(List<Map<String, dynamic>> json) {
    final PagesRepository pagesRepository = locator<PagesRepository>();
    final CardsRepository cardsRepository = locator<CardsRepository>();

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

      final String tileType = row['type'];

      try {
        TileModel tile = buildTileModel(tileType, row);

        if (tile.parentType == 'page' &&
            pagesRepository.getItem(tile.parentId) == null) {
          continue;
        }

        if (tile.parentType == 'card' &&
            cardsRepository.getItem(tile.parentId) == null) {
          continue;
        }

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

  Future<void> fetchOne(
    String id,
  ) async {
    return handleApiCall(
      () async {
        final response = await apiClient.getDashboardModuleTile(id: id);

        final raw = response.response.data['data'] as Map<String, dynamic>;

        insert([raw]);
      },
      'fetch tile',
    );
  }

  Future<void> fetchAll(
    String parentType,
    String parentId,
  ) async {
    return handleApiCall(
      () async {
        final response = await apiClient.getDashboardModuleTiles(
          parentType: parentType,
          parentId: parentId,
        );

        final raw = response.response.data['data'] as List;

        insert(raw.cast<Map<String, dynamic>>());
      },
      'fetch $parentType tiles',
    );
  }
}
