import 'dart:convert';

import 'package:fastybird_smart_panel/modules/dashboard/mappers/tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/repositories/repository.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:flutter/foundation.dart';

class TilesRepository extends Repository<TileModel> {
  TilesRepository({required super.apiClient});

  void insertPageTiles(List<Map<String, dynamic>> json) {
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
        TileModel tile = buildPageTileModel(tileType, row);

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

  void insertCardTiles(List<Map<String, dynamic>> json) {
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
        TileModel tile = buildCardTileModel(tileType, row);

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

  Future<void> fetchPageTile(
    String pageId,
    String id,
  ) async {
    return handleApiCall(
      () async {
        final response = await apiClient.getDashboardModulePageTile(
          pageId: pageId,
          id: id,
        );

        insertPageTiles([jsonDecode(jsonEncode(response.data.data))]);
      },
      'fetch page tiles',
    );
  }

  Future<void> fetchPageTiles(
    String pageId,
  ) async {
    return handleApiCall(
      () async {
        final response = await apiClient.getDashboardModulePageTiles(
          pageId: pageId,
        );

        List<Map<String, dynamic>> tiles = [];

        for (var tile in response.data.data) {
          tiles.add(jsonDecode(jsonEncode(tile)));
        }

        insertPageTiles(tiles);
      },
      'fetch page tiles',
    );
  }

  Future<void> fetchCardTile(
    String pageId,
    String cardId,
    String id,
  ) async {
    return handleApiCall(
      () async {
        final response = await apiClient.getDashboardModulePageCardTile(
          pageId: pageId,
          cardId: cardId,
          id: id,
        );

        insertCardTiles([jsonDecode(jsonEncode(response.data.data))]);
      },
      'fetch card tile',
    );
  }

  Future<void> fetchCardTiles(
    String pageId,
    String cardId,
  ) async {
    return handleApiCall(
      () async {
        final response = await apiClient.getDashboardModulePageCardTiles(
          pageId: pageId,
          cardId: cardId,
        );

        List<Map<String, dynamic>> tiles = [];

        for (var tile in response.data.data) {
          tiles.add(jsonDecode(jsonEncode(tile)));
        }

        insertCardTiles(tiles);
      },
      'fetch card tiles',
    );
  }
}
