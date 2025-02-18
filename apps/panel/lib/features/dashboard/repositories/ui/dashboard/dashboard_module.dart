import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/dashboard_module/dashboard_module_client.dart';
import 'package:fastybird_smart_panel/api/models/dashboard_card.dart';
import 'package:fastybird_smart_panel/api/models/dashboard_card_data_source_union.dart'
    as card_data_source;
import 'package:fastybird_smart_panel/api/models/dashboard_card_tiles_union.dart'
    as card_tile;
import 'package:fastybird_smart_panel/api/models/dashboard_cards_page_data_source_union.dart'
    as cards_page_data_source;
import 'package:fastybird_smart_panel/api/models/dashboard_res_pages_data_union.dart';
import 'package:fastybird_smart_panel/api/models/dashboard_tile_base_data_source_union.dart'
    as tile_data_source;
import 'package:fastybird_smart_panel/api/models/dashboard_tiles_page_data_source_union.dart'
    as tiles_page_data_source;
import 'package:fastybird_smart_panel/api/models/dashboard_tiles_page_tiles_union.dart'
    as page_tile;
import 'package:fastybird_smart_panel/features/dashboard/mappers/ui/data_source.dart';
import 'package:fastybird_smart_panel/features/dashboard/mappers/ui/page.dart';
import 'package:fastybird_smart_panel/features/dashboard/mappers/ui/tile.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/cards/card.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/data_source/data_source.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/pages/page.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/tiles/tile.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/ui.dart';
import 'package:flutter/foundation.dart';

class DashboardModuleRepository extends ChangeNotifier {
  final DashboardModuleClient _apiClient;

  final List<PageModel> _pages = [];
  final List<CardModel> _cards = [];
  final List<TileModel> _tiles = [];
  final List<DataSourceModel> _dataSources = [];

  bool _isLoading = true;

  DashboardModuleRepository({
    required DashboardModuleClient apiClient,
  }) : _apiClient = apiClient;

  Future<void> initialize() async {
    _isLoading = true;

    await _loadPages();

    _isLoading = false;

    notifyListeners();
  }

  bool get isLoading => _isLoading;

  List<PageModel> getPages() {
    return _pages;
  }

  List<CardModel> getCardsByIds(List<String> ids) {
    return _cards.where((card) => ids.contains(card.id)).toList();
  }

  List<TileModel> getTilesByIds(List<String> ids) {
    return _tiles.where((tile) => ids.contains(tile.id)).toList();
  }

  List<DataSourceModel> getDataSourceByIds(List<String> ids) {
    return _dataSources
        .where((dataSource) => ids.contains(dataSource.id))
        .toList();
  }

  Future<void> _loadPages() async {
    var resPages = await _fetchPages();

    _pages.clear();
    _cards.clear();
    _tiles.clear();
    _dataSources.clear();

    _parsePages(resPages);
  }

  /// /////
  /// PAGES
  /// /////

  void _parsePages(
    List<DashboardResPagesDataUnion> apiPages,
  ) {
    for (var apiPage in apiPages) {
      final PageType? pageType = PageType.fromValue(apiPage.type);

      if (pageType == null) {
        if (kDebugMode) {
          debugPrint(
            'Unknown page type: "${apiPage.type}" for page: "${apiPage.id}"',
          );
        }

        continue;
      }

      if (apiPage is DashboardCardsPage) {
        _pages.add(
          buildPageModel(pageType, {
            "id": apiPage.id,
            "type": apiPage.type,
            "title": apiPage.title,
            "icon": apiPage.icon,
            "order": apiPage.order,
            "created_at": apiPage.createdAt.toIso8601String(),
            "updated_at": apiPage.updatedAt?.toIso8601String(),
            "cards": apiPage.cards.map((card) => card.id).toList(),
            "data_source": apiPage.dataSource
                .map(
                  (dataSource) => dataSource.id,
                )
                .toList(),
          }),
        );

        _parsePageCards(apiPage, apiPage.cards);
        _parseCardsPageDataSource(apiPage, apiPage.dataSource);
      } else if (apiPage is DashboardTilesPage) {
        _pages.add(
          buildPageModel(pageType, {
            "id": apiPage.id,
            "type": apiPage.type,
            "title": apiPage.title,
            "icon": apiPage.icon,
            "order": apiPage.order,
            "created_at": apiPage.createdAt.toIso8601String(),
            "updated_at": apiPage.updatedAt?.toIso8601String(),
            "tiles": apiPage.tiles.map((tile) => tile.id).toList(),
            "data_source": apiPage.dataSource
                .map(
                  (dataSource) => dataSource.id,
                )
                .toList(),
          }),
        );

        _parsePageTiles(apiPage, apiPage.tiles);
        _parseTilesPageDataSource(apiPage, apiPage.dataSource);
      } else if (apiPage is DashboardDevicePage) {
        _pages.add(
          buildPageModel(pageType, {
            "id": apiPage.id,
            "type": apiPage.type,
            "title": apiPage.title,
            "icon": apiPage.icon,
            "order": apiPage.order,
            "created_at": apiPage.createdAt.toIso8601String(),
            "updated_at": apiPage.updatedAt?.toIso8601String(),
            "device": apiPage.device,
          }),
        );
      }
    }
  }

  /// /////
  /// CARDS
  /// /////

  void _parsePageCards(
    DashboardResPagesDataUnion apiPage,
    List<DashboardCard> apiCards,
  ) {
    for (var apiCard in apiCards) {
      _cards.add(
        CardModel.fromJson({
          "id": apiCard.id,
          "page": apiPage.id,
          "title": apiCard.title,
          "icon": apiCard.icon,
          "order": apiCard.order,
          "created_at": apiCard.createdAt.toIso8601String(),
          "updated_at": apiCard.updatedAt?.toIso8601String(),
          "tiles": apiCard.tiles.map((tile) => tile.id).toList(),
          "data_source": apiCard.dataSource
              .map(
                (dataSource) => dataSource.id,
              )
              .toList(),
        }),
      );

      _parseCardDataSource(apiCard, apiCard.dataSource);
      _parseCardTiles(apiCard, apiCard.tiles);
    }
  }

  /// ////////////////////////
  /// TILES - TILES PAGE, CARD
  /// ////////////////////////

  void _parsePageTiles(
    DashboardResPagesDataUnion apiPage,
    List<page_tile.DashboardTilesPageTilesUnion> apiTiles,
  ) {
    for (var apiTile in apiTiles) {
      final TileType? tileType = TileType.fromValue(apiTile.type);

      if (tileType == null) {
        if (kDebugMode) {
          debugPrint(
            'Unknown tiles page tile type: "${apiTile.type}" for tile: "${apiTile.id}"',
          );
        }

        continue;
      }

      if (apiTile is page_tile.DashboardDeviceTile) {
        _tiles.add(
          buildPageTileModel(tileType, {
            "id": apiTile.id,
            "type": apiTile.type,
            "parent": apiPage.id,
            "row": apiTile.row,
            "col": apiTile.col,
            "row_span": apiTile.rowSpan,
            "col_span": apiTile.colSpan,
            "icon": apiTile.icon,
            "device": apiTile.device,
            "created_at": apiTile.createdAt.toIso8601String(),
            "updated_at": apiTile.updatedAt?.toIso8601String(),
            "data_source": apiTile.dataSource
                .map(
                  (dataSource) => dataSource.id,
                )
                .toList(),
          }),
        );
      } else if (apiTile is page_tile.DashboardTimeTile ||
          apiTile is page_tile.DashboardDayWeatherTile ||
          apiTile is page_tile.DashboardForecastWeatherTile) {
        _tiles.add(
          buildPageTileModel(tileType, {
            "id": apiTile.id,
            "type": apiTile.type,
            "parent": apiPage.id,
            "row": apiTile.row,
            "col": apiTile.col,
            "row_span": apiTile.rowSpan,
            "col_span": apiTile.colSpan,
            "created_at": apiTile.createdAt.toIso8601String(),
            "updated_at": apiTile.updatedAt?.toIso8601String(),
            "data_source": apiTile.dataSource
                .map(
                  (dataSource) => dataSource.id,
                )
                .toList(),
          }),
        );
      }

      _parsePageTileDataSource(apiTile, apiTile.dataSource);
    }
  }

  void _parseCardTiles(
    DashboardCard apiCard,
    List<card_tile.DashboardCardTilesUnion> apiTiles,
  ) {
    for (var apiTile in apiTiles) {
      final TileType? tileType = TileType.fromValue(apiTile.type);

      if (tileType == null) {
        if (kDebugMode) {
          debugPrint(
            'Unknown tiles page tile type: "${apiTile.type}" for tile: "${apiTile.id}"',
          );
        }

        continue;
      }

      if (apiTile is card_tile.DashboardDeviceTile) {
        _tiles.add(
          buildPageTileModel(tileType, {
            "id": apiTile.id,
            "type": apiTile.type,
            "parent": apiCard.id,
            "row": apiTile.row,
            "col": apiTile.col,
            "row_span": apiTile.rowSpan,
            "col_span": apiTile.colSpan,
            "icon": apiTile.icon,
            "device": apiTile.device,
            "created_at": apiTile.createdAt.toIso8601String(),
            "updated_at": apiTile.updatedAt?.toIso8601String(),
            "data_source": apiTile.dataSource
                .map(
                  (dataSource) => dataSource.id,
                )
                .toList(),
          }),
        );
      } else if (apiTile is card_tile.DashboardTimeTile ||
          apiTile is card_tile.DashboardDayWeatherTile ||
          apiTile is card_tile.DashboardForecastWeatherTile) {
        _tiles.add(
          buildPageTileModel(tileType, {
            "id": apiTile.id,
            "type": apiTile.type,
            "parent": apiCard.id,
            "row": apiTile.row,
            "col": apiTile.col,
            "row_span": apiTile.rowSpan,
            "col_span": apiTile.colSpan,
            "created_at": apiTile.createdAt.toIso8601String(),
            "updated_at": apiTile.updatedAt?.toIso8601String(),
            "data_source": apiTile.dataSource
                .map(
                  (dataSource) => dataSource.id,
                )
                .toList(),
          }),
        );
      }

      _parseCardTileDataSource(apiTile, apiTile.dataSource);
    }
  }

  /// //////////////////////////////////////////////////
  /// DATA SOURCES - CARDS PAGE, TILES PAGE, CARD, TILE
  /// //////////////////////////////////////////////////

  void _parseCardsPageDataSource(
    DashboardResPagesDataUnion apiPage,
    List<cards_page_data_source.DashboardCardsPageDataSourceUnion>
        apiDataSources,
  ) {
    for (var apiDataSource in apiDataSources) {
      final DataSourceType? dataSourceType =
          DataSourceType.fromValue(apiDataSource.type);

      if (dataSourceType == null) {
        if (kDebugMode) {
          debugPrint(
            'Unknown cards page data source type: "${apiDataSource.type}" for data source: "${apiDataSource.id}"',
          );
        }

        continue;
      }

      if (apiDataSource
          is cards_page_data_source.DashboardDeviceChannelDataSource) {
        _dataSources.add(
          buildPageDataSourceModel(dataSourceType, {
            "id": apiDataSource.id,
            "type": apiDataSource.type,
            "parent": apiPage.id,
            "device": apiDataSource.device,
            "channel": apiDataSource.channel,
            "property": apiDataSource.property,
            "icon": apiDataSource.icon,
            "created_at": apiDataSource.createdAt.toIso8601String(),
            "updated_at": apiDataSource.updatedAt?.toIso8601String(),
          }),
        );
      }
    }
  }

  void _parseTilesPageDataSource(
    DashboardResPagesDataUnion apiPage,
    List<tiles_page_data_source.DashboardTilesPageDataSourceUnion>
        apiDataSources,
  ) {
    for (var apiDataSource in apiDataSources) {
      final DataSourceType? dataSourceType =
          DataSourceType.fromValue(apiDataSource.type);

      if (dataSourceType == null) {
        if (kDebugMode) {
          debugPrint(
            'Unknown tiles page data source type: "${apiDataSource.type}" for data source: "${apiDataSource.id}"',
          );
        }

        continue;
      }

      if (apiDataSource
          is tiles_page_data_source.DashboardDeviceChannelDataSource) {
        _dataSources.add(
          buildPageDataSourceModel(dataSourceType, {
            "id": apiDataSource.id,
            "type": apiDataSource.type,
            "parent": apiPage.id,
            "device": apiDataSource.device,
            "channel": apiDataSource.channel,
            "property": apiDataSource.property,
            "icon": apiDataSource.icon,
            "created_at": apiDataSource.createdAt.toIso8601String(),
            "updated_at": apiDataSource.updatedAt?.toIso8601String(),
          }),
        );
      }
    }
  }

  void _parseCardDataSource(
    DashboardCard apiCard,
    List<card_data_source.DashboardCardDataSourceUnion> apiDataSources,
  ) {
    for (var apiDataSource in apiDataSources) {
      final DataSourceType? dataSourceType =
          DataSourceType.fromValue(apiDataSource.type);

      if (dataSourceType == null) {
        if (kDebugMode) {
          debugPrint(
            'Unknown card data source type: "${apiDataSource.type}" for data source: "${apiDataSource.id}"',
          );
        }

        continue;
      }

      if (apiDataSource
          is tiles_page_data_source.DashboardDeviceChannelDataSource) {
        _dataSources.add(
          buildCardDataSourceModel(dataSourceType, {
            "id": apiDataSource.id,
            "type": apiDataSource.type,
            "parent": apiCard.id,
            "device": apiDataSource.device,
            "channel": apiDataSource.channel,
            "property": apiDataSource.property,
            "icon": apiDataSource.icon,
            "created_at": apiDataSource.createdAt.toIso8601String(),
            "updated_at": apiDataSource.updatedAt?.toIso8601String(),
          }),
        );
      }
    }
  }

  void _parsePageTileDataSource(
    page_tile.DashboardTilesPageTilesUnion apiTile,
    List<tile_data_source.DashboardTileBaseDataSourceUnion> apiDataSources,
  ) {
    for (var apiDataSource in apiDataSources) {
      final DataSourceType? dataSourceType =
          DataSourceType.fromValue(apiDataSource.type);

      if (dataSourceType == null) {
        if (kDebugMode) {
          debugPrint(
            'Unknown tile data source type: "${apiDataSource.type}" for data source: "${apiDataSource.id}"',
          );
        }

        continue;
      }

      if (apiDataSource is tile_data_source.DashboardDeviceChannelDataSource) {
        _dataSources.add(
          buildPageDataSourceModel(dataSourceType, {
            "id": apiDataSource.id,
            "type": apiDataSource.type,
            "parent": apiTile.id,
            "device": apiDataSource.device,
            "channel": apiDataSource.channel,
            "property": apiDataSource.property,
            "icon": apiDataSource.icon,
            "created_at": apiDataSource.createdAt.toIso8601String(),
            "updated_at": apiDataSource.updatedAt?.toIso8601String(),
          }),
        );
      }
    }
  }

  void _parseCardTileDataSource(
    card_tile.DashboardCardTilesUnion apiTile,
    List<tile_data_source.DashboardTileBaseDataSourceUnion> apiDataSources,
  ) {
    for (var apiDataSource in apiDataSources) {
      final DataSourceType? dataSourceType =
          DataSourceType.fromValue(apiDataSource.type);

      if (dataSourceType == null) {
        if (kDebugMode) {
          debugPrint(
            'Unknown tile data source type: "${apiDataSource.type}" for data source: "${apiDataSource.id}"',
          );
        }

        continue;
      }

      if (apiDataSource is tile_data_source.DashboardDeviceChannelDataSource) {
        _dataSources.add(
          buildPageDataSourceModel(dataSourceType, {
            "id": apiDataSource.id,
            "type": apiDataSource.type,
            "parent": apiTile.id,
            "device": apiDataSource.device,
            "channel": apiDataSource.channel,
            "property": apiDataSource.property,
            "icon": apiDataSource.icon,
            "created_at": apiDataSource.createdAt.toIso8601String(),
            "updated_at": apiDataSource.updatedAt?.toIso8601String(),
          }),
        );
      }
    }
  }

  /// ////////////
  /// API HANDLERS
  /// ////////////

  Future<List<DashboardResPagesDataUnion>> _fetchPages() async {
    return _handleApiCall(
      () async {
        final response = await _apiClient.getDashboardModulePages();

        return response.data.data;
      },
      'fetch pages',
    );
  }

  Future<T> _handleApiCall<T>(
    Future<T> Function() apiCall,
    String operation,
  ) async {
    try {
      return await apiCall();
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[${operation.toUpperCase()}] API error: ${e.response?.statusCode} - ${e.message}',
        );
      }

      throw Exception('Failed to $operation: ${e.response?.statusCode}');
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[${operation.toUpperCase()}] Unexpected error: ${e.toString()}',
        );
      }

      throw Exception('Unexpected error when calling backend service');
    }
  }
}
