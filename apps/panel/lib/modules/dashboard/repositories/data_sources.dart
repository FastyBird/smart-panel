import 'package:fastybird_smart_panel/api/models/dashboard_card_data_source_union.dart'
    as card_data_source;
import 'package:fastybird_smart_panel/api/models/dashboard_cards_page_data_source_union.dart'
    as cards_page_data_source;
import 'package:fastybird_smart_panel/api/models/dashboard_res_page_card_data_sources_data_union.dart';
import 'package:fastybird_smart_panel/api/models/dashboard_res_page_card_tile_data_sources_data_union.dart';
import 'package:fastybird_smart_panel/api/models/dashboard_res_page_data_sources_data_union.dart';
import 'package:fastybird_smart_panel/api/models/dashboard_res_page_tile_data_sources_data_union.dart';
import 'package:fastybird_smart_panel/api/models/dashboard_tile_base_data_source_union.dart'
    as tile_data_source;
import 'package:fastybird_smart_panel/api/models/dashboard_tiles_page_data_source_union.dart'
    as tiles_page_data_source;
import 'package:fastybird_smart_panel/modules/dashboard/mappers/data_source.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/data_source.dart';
import 'package:fastybird_smart_panel/modules/dashboard/repositories/repository.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:flutter/foundation.dart';

class DataSourcesRepository extends Repository<DataSourceModel> {
  DataSourcesRepository({required super.apiClient});

  void insertCardsPageDataSource(
    String pageId,
    List<cards_page_data_source.DashboardCardsPageDataSourceUnion>
        apiDataSources,
  ) {
    for (var apiDataSource in apiDataSources) {
      final DataSourceType? dataSourceType =
          DataSourceType.fromValue(apiDataSource.type);

      if (dataSourceType == null) {
        if (kDebugMode) {
          debugPrint(
            '[DASHBOARD MODULE][DATA SOURCE] Unknown cards page data source type: "${apiDataSource.type}" for data source: "${apiDataSource.id}"',
          );
        }

        continue;
      }

      if (apiDataSource is cards_page_data_source
          .DashboardCardsPageDataSourceUnionDeviceChannel) {
        data[apiDataSource.id] = buildPageDataSourceModel(dataSourceType, {
          'id': apiDataSource.id,
          'type': apiDataSource.type,
          'parent': pageId,
          'device': apiDataSource.device,
          'channel': apiDataSource.channel,
          'property': apiDataSource.property,
          'icon': apiDataSource.icon,
          'created_at': apiDataSource.createdAt.toIso8601String(),
          'updated_at': apiDataSource.updatedAt?.toIso8601String(),
        });
      }
    }
  }

  void insertTilesPageDataSource(
    String pageId,
    List<tiles_page_data_source.DashboardTilesPageDataSourceUnion>
        apiDataSources,
  ) {
    for (var apiDataSource in apiDataSources) {
      final DataSourceType? dataSourceType =
          DataSourceType.fromValue(apiDataSource.type);

      if (dataSourceType == null) {
        if (kDebugMode) {
          debugPrint(
            '[DASHBOARD MODULE][DATA SOURCE] Unknown tiles page data source type: "${apiDataSource.type}" for data source: "${apiDataSource.id}"',
          );
        }

        continue;
      }

      if (apiDataSource is tiles_page_data_source
          .DashboardTilesPageDataSourceUnionDeviceChannel) {
        data[apiDataSource.id] = buildPageDataSourceModel(dataSourceType, {
          'id': apiDataSource.id,
          'type': apiDataSource.type,
          'parent': pageId,
          'device': apiDataSource.device,
          'channel': apiDataSource.channel,
          'property': apiDataSource.property,
          'icon': apiDataSource.icon,
          'created_at': apiDataSource.createdAt.toIso8601String(),
          'updated_at': apiDataSource.updatedAt?.toIso8601String(),
        });
      }
    }
  }

  void insertPageCardDataSource(
    String cardId,
    List<card_data_source.DashboardCardDataSourceUnion> apiDataSources,
  ) {
    for (var apiDataSource in apiDataSources) {
      final DataSourceType? dataSourceType =
          DataSourceType.fromValue(apiDataSource.type);

      if (dataSourceType == null) {
        if (kDebugMode) {
          debugPrint(
            '[DASHBOARD MODULE][DATA SOURCE] Unknown card data source type: "${apiDataSource.type}" for data source: "${apiDataSource.id}"',
          );
        }

        continue;
      }

      if (apiDataSource
          is card_data_source.DashboardCardDataSourceUnionDeviceChannel) {
        data[apiDataSource.id] = buildCardDataSourceModel(dataSourceType, {
          'id': apiDataSource.id,
          'type': apiDataSource.type,
          'parent': cardId,
          'device': apiDataSource.device,
          'channel': apiDataSource.channel,
          'property': apiDataSource.property,
          'icon': apiDataSource.icon,
          'created_at': apiDataSource.createdAt.toIso8601String(),
          'updated_at': apiDataSource.updatedAt?.toIso8601String(),
        });
      }
    }
  }

  void insertPageTileDataSource(
    String tileId,
    List<tile_data_source.DashboardTileBaseDataSourceUnion> apiDataSources,
  ) {
    for (var apiDataSource in apiDataSources) {
      final DataSourceType? dataSourceType =
          DataSourceType.fromValue(apiDataSource.type);

      if (dataSourceType == null) {
        if (kDebugMode) {
          debugPrint(
            '[DASHBOARD MODULE][DATA SOURCE] Unknown tile data source type: "${apiDataSource.type}" for data source: "${apiDataSource.id}"',
          );
        }

        continue;
      }

      if (apiDataSource
          is tile_data_source.DashboardTileBaseDataSourceUnionDeviceChannel) {
        data[apiDataSource.id] = buildPageDataSourceModel(dataSourceType, {
          'id': apiDataSource.id,
          'type': apiDataSource.type,
          'parent': tileId,
          'device': apiDataSource.device,
          'channel': apiDataSource.channel,
          'property': apiDataSource.property,
          'icon': apiDataSource.icon,
          'created_at': apiDataSource.createdAt.toIso8601String(),
          'updated_at': apiDataSource.updatedAt?.toIso8601String(),
        });
      }
    }
  }

  void insertCardTileDataSource(
    String tileId,
    List<tile_data_source.DashboardTileBaseDataSourceUnion> apiDataSources,
  ) {
    for (var apiDataSource in apiDataSources) {
      final DataSourceType? dataSourceType =
          DataSourceType.fromValue(apiDataSource.type);

      if (dataSourceType == null) {
        if (kDebugMode) {
          debugPrint(
            '[DASHBOARD MODULE][DATA SOURCE] Unknown tile data source type: "${apiDataSource.type}" for data source: "${apiDataSource.id}"',
          );
        }

        continue;
      }

      if (apiDataSource
          is tile_data_source.DashboardTileBaseDataSourceUnionDeviceChannel) {
        data[apiDataSource.id] = buildPageDataSourceModel(dataSourceType, {
          'id': apiDataSource.id,
          'type': apiDataSource.type,
          'parent': tileId,
          'device': apiDataSource.device,
          'channel': apiDataSource.channel,
          'property': apiDataSource.property,
          'icon': apiDataSource.icon,
          'created_at': apiDataSource.createdAt.toIso8601String(),
          'updated_at': apiDataSource.updatedAt?.toIso8601String(),
        });
      }
    }
  }

  Future<void> fetchPageDataSource(
    String pageId,
  ) async {
    return handleApiCall(
      () async {
        final response = await apiClient.getDashboardModulePageDataSources(
          pageId: pageId,
        );

        for (var apiDataSource in response.data.data) {
          final DataSourceType? dataSourceType =
              DataSourceType.fromValue(apiDataSource.type);

          if (dataSourceType == null) {
            if (kDebugMode) {
              debugPrint(
                '[DASHBOARD MODULE][DATA SOURCE] Unknown cards page data source type: "${apiDataSource.type}" for data source: "${apiDataSource.id}"',
              );
            }

            continue;
          }

          if (apiDataSource
              is DashboardResPageDataSourcesDataUnionDeviceChannel) {
            data[apiDataSource.id] = buildPageDataSourceModel(dataSourceType, {
              'id': apiDataSource.id,
              'type': apiDataSource.type,
              'parent': pageId,
              'device': apiDataSource.device,
              'channel': apiDataSource.channel,
              'property': apiDataSource.property,
              'icon': apiDataSource.icon,
              'created_at': apiDataSource.createdAt.toIso8601String(),
              'updated_at': apiDataSource.updatedAt?.toIso8601String(),
            });
          }
        }
      },
      'fetch page data sources',
    );
  }

  Future<void> fetchPageCardDataSource(
    String pageId,
    String cardId,
  ) async {
    return handleApiCall(
      () async {
        final response = await apiClient.getDashboardModulePageCardDataSources(
          pageId: pageId,
          cardId: cardId,
        );

        for (var apiDataSource in response.data.data) {
          final DataSourceType? dataSourceType =
              DataSourceType.fromValue(apiDataSource.type);

          if (dataSourceType == null) {
            if (kDebugMode) {
              debugPrint(
                '[DASHBOARD MODULE][DATA SOURCE] Unknown card data source type: "${apiDataSource.type}" for data source: "${apiDataSource.id}"',
              );
            }

            continue;
          }

          if (apiDataSource
              is DashboardResPageCardDataSourcesDataUnionDeviceChannel) {
            data[apiDataSource.id] = buildCardDataSourceModel(dataSourceType, {
              'id': apiDataSource.id,
              'type': apiDataSource.type,
              'parent': cardId,
              'device': apiDataSource.device,
              'channel': apiDataSource.channel,
              'property': apiDataSource.property,
              'icon': apiDataSource.icon,
              'created_at': apiDataSource.createdAt.toIso8601String(),
              'updated_at': apiDataSource.updatedAt?.toIso8601String(),
            });
          }
        }
      },
      'fetch page card data sources',
    );
  }

  Future<void> fetchPageTileDataSource(
    String pageId,
    String tileId,
  ) async {
    return handleApiCall(
      () async {
        final response = await apiClient.getDashboardModulePageTileDataSources(
          pageId: pageId,
          tileId: tileId,
        );

        for (var apiDataSource in response.data.data) {
          final DataSourceType? dataSourceType =
              DataSourceType.fromValue(apiDataSource.type);

          if (dataSourceType == null) {
            if (kDebugMode) {
              debugPrint(
                '[DASHBOARD MODULE][DATA SOURCE] Unknown tile data source type: "${apiDataSource.type}" for data source: "${apiDataSource.id}"',
              );
            }

            continue;
          }

          if (apiDataSource
              is DashboardResPageTileDataSourcesDataUnionDeviceChannel) {
            data[apiDataSource.id] = buildPageDataSourceModel(dataSourceType, {
              'id': apiDataSource.id,
              'type': apiDataSource.type,
              'parent': tileId,
              'device': apiDataSource.device,
              'channel': apiDataSource.channel,
              'property': apiDataSource.property,
              'icon': apiDataSource.icon,
              'created_at': apiDataSource.createdAt.toIso8601String(),
              'updated_at': apiDataSource.updatedAt?.toIso8601String(),
            });
          }
        }
      },
      'fetch page tile data sources',
    );
  }

  Future<void> fetchCardTileDataSource(
    String pageId,
    String cardId,
    String tileId,
  ) async {
    return handleApiCall(
      () async {
        final response =
            await apiClient.getDashboardModulePageCardTileDataSources(
          pageId: pageId,
          cardId: cardId,
          tileId: tileId,
        );

        for (var apiDataSource in response.data.data) {
          final DataSourceType? dataSourceType =
              DataSourceType.fromValue(apiDataSource.type);

          if (dataSourceType == null) {
            if (kDebugMode) {
              debugPrint(
                '[DASHBOARD MODULE][DATA SOURCE] Unknown tile data source type: "${apiDataSource.type}" for data source: "${apiDataSource.id}"',
              );
            }

            continue;
          }

          if (apiDataSource
              is DashboardResPageCardTileDataSourcesDataUnionDeviceChannel) {
            data[apiDataSource.id] = buildPageDataSourceModel(dataSourceType, {
              'id': apiDataSource.id,
              'type': apiDataSource.type,
              'parent': tileId,
              'device': apiDataSource.device,
              'channel': apiDataSource.channel,
              'property': apiDataSource.property,
              'icon': apiDataSource.icon,
              'created_at': apiDataSource.createdAt.toIso8601String(),
              'updated_at': apiDataSource.updatedAt?.toIso8601String(),
            });
          }
        }
      },
      'fetch card tile data sources',
    );
  }
}
