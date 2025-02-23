import 'package:fastybird_smart_panel/api/models/dashboard_card_tiles_union.dart'
    as card_tile;
import 'package:fastybird_smart_panel/api/models/dashboard_res_page_card_tiles_data_union.dart';
import 'package:fastybird_smart_panel/api/models/dashboard_res_page_tiles_data_union.dart';
import 'package:fastybird_smart_panel/api/models/dashboard_tiles_page_tiles_union.dart'
    as page_tile;
import 'package:fastybird_smart_panel/modules/dashboard/mappers/tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/repositories/repository.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:flutter/foundation.dart';

class TilesRepository extends Repository<TileModel> {
  TilesRepository({required super.apiClient});

  void insertPageTiles(
    String pageId,
    List<page_tile.DashboardTilesPageTilesUnion> apiTiles,
  ) {
    for (var apiTile in apiTiles) {
      final TileType? tileType = TileType.fromValue(apiTile.type);

      if (tileType == null) {
        if (kDebugMode) {
          debugPrint(
            '[DASHBOARD MODULE][TILES] Unknown tiles page tile type: "${apiTile.type}" for tile: "${apiTile.id}"',
          );
        }

        continue;
      }

      if (apiTile is page_tile.DashboardTilesPageTilesUnionDevice) {
        data[apiTile.id] = buildPageTileModel(tileType, {
          'id': apiTile.id,
          'type': apiTile.type,
          'parent': pageId,
          'row': apiTile.row,
          'col': apiTile.col,
          'row_span': apiTile.rowSpan,
          'col_span': apiTile.colSpan,
          'icon': apiTile.icon,
          'device': apiTile.device,
          'created_at': apiTile.createdAt.toIso8601String(),
          'updated_at': apiTile.updatedAt?.toIso8601String(),
          'data_source': apiTile.dataSource
              .map(
                (dataSource) => dataSource.id,
              )
              .toList(),
        });
      } else if (apiTile is page_tile.DashboardTilesPageTilesUnionClock ||
          apiTile is page_tile.DashboardTilesPageTilesUnionWeatherDay ||
          apiTile is page_tile.DashboardTilesPageTilesUnionWeatherForecast) {
        data[apiTile.id] = buildPageTileModel(tileType, {
          'id': apiTile.id,
          'type': apiTile.type,
          'parent': pageId,
          'row': apiTile.row,
          'col': apiTile.col,
          'row_span': apiTile.rowSpan,
          'col_span': apiTile.colSpan,
          'created_at': apiTile.createdAt.toIso8601String(),
          'updated_at': apiTile.updatedAt?.toIso8601String(),
          'data_source': apiTile.dataSource
              .map(
                (dataSource) => dataSource.id,
              )
              .toList(),
        });
      }
    }
  }

  void insertCardTiles(
    String cardId,
    List<card_tile.DashboardCardTilesUnion> apiTiles,
  ) {
    for (var apiTile in apiTiles) {
      final TileType? tileType = TileType.fromValue(apiTile.type);

      if (tileType == null) {
        if (kDebugMode) {
          debugPrint(
            '[DASHBOARD MODULE][TILES] Unknown tiles page tile type: "${apiTile.type}" for tile: "${apiTile.id}"',
          );
        }

        continue;
      }

      if (apiTile is card_tile.DashboardCardTilesUnionDevice) {
        data[apiTile.id] = buildPageTileModel(tileType, {
          'id': apiTile.id,
          'type': apiTile.type,
          'parent': cardId,
          'row': apiTile.row,
          'col': apiTile.col,
          'row_span': apiTile.rowSpan,
          'col_span': apiTile.colSpan,
          'icon': apiTile.icon,
          'device': apiTile.device,
          'created_at': apiTile.createdAt.toIso8601String(),
          'updated_at': apiTile.updatedAt?.toIso8601String(),
          'data_source': apiTile.dataSource
              .map(
                (dataSource) => dataSource.id,
              )
              .toList(),
        });
      } else if (apiTile is card_tile.DashboardCardTilesUnionClock ||
          apiTile is card_tile.DashboardCardTilesUnionWeatherDay ||
          apiTile is card_tile.DashboardCardTilesUnionWeatherForecast) {
        data[apiTile.id] = buildPageTileModel(tileType, {
          'id': apiTile.id,
          'type': apiTile.type,
          'parent': cardId,
          'row': apiTile.row,
          'col': apiTile.col,
          'row_span': apiTile.rowSpan,
          'col_span': apiTile.colSpan,
          'created_at': apiTile.createdAt.toIso8601String(),
          'updated_at': apiTile.updatedAt?.toIso8601String(),
          'data_source': apiTile.dataSource
              .map(
                (dataSource) => dataSource.id,
              )
              .toList(),
        });
      }
    }
  }

  Future<void> fetchPageTiles(
    String pageId,
  ) async {
    return handleApiCall(
      () async {
        final response = await apiClient.getDashboardModulePageTiles(
          pageId: pageId,
        );

        for (var apiTile in response.data.data) {
          final TileType? tileType = TileType.fromValue(apiTile.type);

          if (tileType == null) {
            if (kDebugMode) {
              debugPrint(
                '[DASHBOARD MODULE][TILES] Unknown tiles page tile type: "${apiTile.type}" for tile: "${apiTile.id}"',
              );
            }

            continue;
          }

          if (apiTile is DashboardResPageTilesDataUnionDevice) {
            data[apiTile.id] = buildPageTileModel(tileType, {
              'id': apiTile.id,
              'type': apiTile.type,
              'parent': pageId,
              'row': apiTile.row,
              'col': apiTile.col,
              'row_span': apiTile.rowSpan,
              'col_span': apiTile.colSpan,
              'icon': apiTile.icon,
              'device': apiTile.device,
              'created_at': apiTile.createdAt.toIso8601String(),
              'updated_at': apiTile.updatedAt?.toIso8601String(),
              'data_source': apiTile.dataSource
                  .map(
                    (dataSource) => dataSource.id,
                  )
                  .toList(),
            });
          } else if (apiTile is DashboardResPageTilesDataUnionClock ||
              apiTile is DashboardResPageTilesDataUnionWeatherDay ||
              apiTile is DashboardResPageTilesDataUnionWeatherForecast) {
            data[apiTile.id] = buildPageTileModel(tileType, {
              'id': apiTile.id,
              'type': apiTile.type,
              'parent': pageId,
              'row': apiTile.row,
              'col': apiTile.col,
              'row_span': apiTile.rowSpan,
              'col_span': apiTile.colSpan,
              'created_at': apiTile.createdAt.toIso8601String(),
              'updated_at': apiTile.updatedAt?.toIso8601String(),
              'data_source': apiTile.dataSource
                  .map(
                    (dataSource) => dataSource.id,
                  )
                  .toList(),
            });
          }
        }
      },
      'fetch page tiles',
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

        for (var apiTile in response.data.data) {
          final TileType? tileType = TileType.fromValue(apiTile.type);

          if (tileType == null) {
            if (kDebugMode) {
              debugPrint(
                '[DASHBOARD MODULE][TILES] Unknown tiles page tile type: "${apiTile.type}" for tile: "${apiTile.id}"',
              );
            }

            continue;
          }

          if (apiTile is DashboardResPageCardTilesDataUnionDevice) {
            data[apiTile.id] = buildPageTileModel(tileType, {
              'id': apiTile.id,
              'type': apiTile.type,
              'parent': cardId,
              'row': apiTile.row,
              'col': apiTile.col,
              'row_span': apiTile.rowSpan,
              'col_span': apiTile.colSpan,
              'icon': apiTile.icon,
              'device': apiTile.device,
              'created_at': apiTile.createdAt.toIso8601String(),
              'updated_at': apiTile.updatedAt?.toIso8601String(),
              'data_source': apiTile.dataSource
                  .map(
                    (dataSource) => dataSource.id,
                  )
                  .toList(),
            });
          } else if (apiTile is DashboardResPageCardTilesDataUnionClock ||
              apiTile is DashboardResPageCardTilesDataUnionWeatherDay ||
              apiTile is DashboardResPageCardTilesDataUnionWeatherForecast) {
            data[apiTile.id] = buildPageTileModel(tileType, {
              'id': apiTile.id,
              'type': apiTile.type,
              'parent': cardId,
              'row': apiTile.row,
              'col': apiTile.col,
              'row_span': apiTile.rowSpan,
              'col_span': apiTile.colSpan,
              'created_at': apiTile.createdAt.toIso8601String(),
              'updated_at': apiTile.updatedAt?.toIso8601String(),
              'data_source': apiTile.dataSource
                  .map(
                    (dataSource) => dataSource.id,
                  )
                  .toList(),
            });
          }
        }
      },
      'fetch card tiles',
    );
  }
}
