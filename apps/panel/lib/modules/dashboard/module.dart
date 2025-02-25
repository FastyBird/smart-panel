import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/api/dashboard_module/dashboard_module_client.dart';
import 'package:fastybird_smart_panel/api/models/dashboard_res_pages_data_union.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/modules/dashboard/repositories/cards.dart';
import 'package:fastybird_smart_panel/modules/dashboard/repositories/data_sources.dart';
import 'package:fastybird_smart_panel/modules/dashboard/repositories/pages.dart';
import 'package:fastybird_smart_panel/modules/dashboard/repositories/tiles.dart';
import 'package:flutter/foundation.dart';

class DashboardModuleService {
  final DashboardModuleClient _apiClient;

  late PagesRepository _pagesRepository;
  late CardsRepository _cardsRepository;
  late TilesRepository _tilesRepository;
  late DataSourcesRepository _dataSourcesRepository;

  bool _isLoading = true;

  DashboardModuleService({
    required ApiClient apiClient,
  }) : _apiClient = apiClient.dashboardModule {
    _pagesRepository = PagesRepository(
      apiClient: apiClient.dashboardModule,
    );
    _cardsRepository = CardsRepository(
      apiClient: apiClient.dashboardModule,
    );
    _tilesRepository = TilesRepository(
      apiClient: apiClient.dashboardModule,
    );
    _dataSourcesRepository = DataSourcesRepository(
      apiClient: apiClient.dashboardModule,
    );

    locator.registerSingleton(_pagesRepository);
    locator.registerSingleton(_cardsRepository);
    locator.registerSingleton(_tilesRepository);
    locator.registerSingleton(_dataSourcesRepository);
  }

  Future<void> initialize() async {
    _isLoading = true;

    await _initializePages();

    _isLoading = false;
  }

  bool get isLoading => _isLoading;

  Future<void> _initializePages() async {
    var apiPages = await _fetchPages();

    List<Map<String, dynamic>> pages = [];

    for (var page in apiPages) {
      pages.add(jsonDecode(jsonEncode(page)));
    }

    _pagesRepository.insertPages(pages);

    for (var apiPage in apiPages) {
      if (apiPage is DashboardResPagesDataUnionCards) {
        List<Map<String, dynamic>> cards = [];

        for (var card in apiPage.cards) {
          cards.add(jsonDecode(jsonEncode(card)));
        }

        _cardsRepository.insertCards(cards);

        List<Map<String, dynamic>> pageDataSource = [];

        for (var dataSource in apiPage.dataSource) {
          pageDataSource.add(jsonDecode(jsonEncode(dataSource)));
        }

        _dataSourcesRepository.insertPageDataSources(pageDataSource);

        for (var apiCard in apiPage.cards) {
          List<Map<String, dynamic>> cardDataSource = [];

          for (var dataSource in apiCard.dataSource) {
            cardDataSource.add(jsonDecode(jsonEncode(dataSource)));
          }

          _dataSourcesRepository.insertCardDataSources(cardDataSource);

          List<Map<String, dynamic>> cardTiles = [];

          for (var tile in apiCard.tiles) {
            cardTiles.add(jsonDecode(jsonEncode(tile)));
          }

          _tilesRepository.insertCardTiles(cardTiles);

          for (var apiTile in apiCard.tiles) {
            List<Map<String, dynamic>> tileDataSource = [];

            for (var dataSource in apiTile.dataSource) {
              tileDataSource.add(jsonDecode(jsonEncode(dataSource)));
            }

            _dataSourcesRepository.insertTileDataSources(tileDataSource);
          }
        }
      } else if (apiPage is DashboardResPagesDataUnionTiles) {
        List<Map<String, dynamic>> pageTiles = [];

        for (var tile in apiPage.tiles) {
          pageTiles.add(jsonDecode(jsonEncode(tile)));
        }

        _tilesRepository.insertPageTiles(pageTiles);

        List<Map<String, dynamic>> pageDataSource = [];

        for (var dataSource in apiPage.dataSource) {
          pageDataSource.add(jsonDecode(jsonEncode(dataSource)));
        }

        _dataSourcesRepository.insertPageDataSources(pageDataSource);

        for (var apiTile in apiPage.tiles) {
          List<Map<String, dynamic>> tileDataSource = [];

          for (var dataSource in apiTile.dataSource) {
            tileDataSource.add(jsonDecode(jsonEncode(dataSource)));
          }

          _dataSourcesRepository.insertTileDataSources(tileDataSource);
        }
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
          '[DASHBOARD MODULE][${operation.toUpperCase()}] API error: ${e.response?.statusCode} - ${e.message}',
        );
      }

      throw Exception('Failed to $operation: ${e.response?.statusCode}');
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[DASHBOARD MODULE][${operation.toUpperCase()}] Unexpected error: ${e.toString()}',
        );
      }

      throw Exception('Unexpected error when calling backend service');
    }
  }
}
