import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/api/dashboard_module/dashboard_module_client.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/modules/dashboard/constants.dart';
import 'package:fastybird_smart_panel/modules/dashboard/repositories/cards.dart';
import 'package:fastybird_smart_panel/modules/dashboard/repositories/data_sources.dart';
import 'package:fastybird_smart_panel/modules/dashboard/repositories/pages.dart';
import 'package:fastybird_smart_panel/modules/dashboard/repositories/tiles.dart';
import 'package:fastybird_smart_panel/modules/dashboard/service.dart';
import 'package:flutter/foundation.dart';

class DashboardModuleService {
  final DashboardModuleClient _apiClient;

  final SocketService _socketService;

  late PagesRepository _pagesRepository;
  late CardsRepository _cardsRepository;
  late TilesRepository _tilesRepository;
  late DataSourcesRepository _dataSourcesRepository;

  late DashboardService _dashboardService;

  bool _isLoading = true;

  DashboardModuleService({
    required ApiClient apiClient,
    required SocketService socketService,
  })  : _apiClient = apiClient.dashboardModule,
        _socketService = socketService {
    _pagesRepository = PagesRepository(
      apiClient: apiClient.dashboardModule,
    );
    _cardsRepository = CardsRepository(
      apiClient: apiClient.pagesCardsPlugin,
    );
    _tilesRepository = TilesRepository(
      apiClient: apiClient.dashboardModule,
    );
    _dataSourcesRepository = DataSourcesRepository(
      apiClient: apiClient.dashboardModule,
    );

    _dashboardService = DashboardService(
      pagesRepository: _pagesRepository,
      tilesRepository: _tilesRepository,
      dataSourcesRepository: _dataSourcesRepository,
      cardsRepository: _cardsRepository,
    );

    locator.registerSingleton(_pagesRepository);
    locator.registerSingleton(_cardsRepository);
    locator.registerSingleton(_tilesRepository);
    locator.registerSingleton(_dataSourcesRepository);

    locator.registerSingleton(_dashboardService);
  }

  Future<void> initialize() async {
    _isLoading = true;

    await _initializePages();

    await _dashboardService.initialize();

    _isLoading = false;

    _socketService.registerEventHandler(
      DashboardModuleConstants.moduleWildcardEvent,
      _socketEventHandler,
    );
  }

  bool get isLoading => _isLoading;

  void dispose() {
    _socketService.unregisterEventHandler(
      DashboardModuleConstants.moduleWildcardEvent,
      _socketEventHandler,
    );
  }

  Future<void> _initializePages() async {
    var pages = await _fetchPages();

    _pagesRepository.insertPages(pages);

    for (var page in pages) {
      final dataSources = (page['data_source'] ?? []) as List;

      _dataSourcesRepository
          .insertDataSources(dataSources.cast<Map<String, dynamic>>());

      if (page['type'] == 'cards') {
        final cards = (page['cards'] ?? []) as List;

        _cardsRepository.insertCards(cards.cast<Map<String, dynamic>>());

        for (var card in cards) {
          final dataSources = (card['data_source'] ?? []) as List;

          _dataSourcesRepository
              .insertDataSources(dataSources.cast<Map<String, dynamic>>());

          final tiles = (card['tiles'] ?? []) as List;

          _tilesRepository.insertTiles(tiles.cast<Map<String, dynamic>>());

          for (var tile in tiles) {
            final dataSources = (tile['data_source'] ?? []) as List;

            _dataSourcesRepository
                .insertDataSources(dataSources.cast<Map<String, dynamic>>());
          }
        }
      } else if (page['type'] == 'tiles') {
        final tiles = (page['tiles'] ?? []) as List;

        _tilesRepository.insertTiles(tiles.cast<Map<String, dynamic>>());

        for (var tile in tiles) {
          final dataSources = (tile['data_source'] ?? []) as List;

          _dataSourcesRepository
              .insertDataSources(dataSources.cast<Map<String, dynamic>>());
        }
      }
    }
  }

  /// ////////////
  /// API HANDLERS
  /// ////////////

  Future<List<Map<String, dynamic>>> _fetchPages() async {
    return _handleApiCall(
      () async {
        final response = await _apiClient.getDashboardModulePages();

        final raw = response.response.data['data'] as List;

        return raw.cast<Map<String, dynamic>>();
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

  /// ////////////////
  /// SOCKETS HANDLERS
  /// ////////////////

  void _socketEventHandler(String event, Map<String, dynamic> payload) {
    /// Page CREATE/UPDATE
    if (event == DashboardModuleConstants.pageCreatedEvent ||
        event == DashboardModuleConstants.pageUpdatedEvent) {
      _pagesRepository.insertPages([payload]);

      /// Page DELETE
    } else if (event == DashboardModuleConstants.pageDeletedEvent &&
        payload.containsKey('id')) {
      _pagesRepository.delete(payload['id']);

      /// Card CREATE/UPDATE
    } else if (event == DashboardModuleConstants.cardCreatedEvent ||
        event == DashboardModuleConstants.cardUpdatedEvent) {
      _cardsRepository.insertCards([payload]);

      /// Card DELETE
    } else if (event == DashboardModuleConstants.cardDeletedEvent &&
        payload.containsKey('id')) {
      _cardsRepository.delete(payload['id']);

      /// Tile CREATE/UPDATE
    } else if (event == DashboardModuleConstants.tileCreatedEvent ||
        event == DashboardModuleConstants.tileUpdatedEvent) {
      _tilesRepository.insertTiles([payload]);

      /// Tile DELETE
    } else if (event == DashboardModuleConstants.tileDeletedEvent &&
        payload.containsKey('id')) {
      _tilesRepository.delete(payload['id']);

      /// Data source CREATE/UPDATE
    } else if (event == DashboardModuleConstants.dataSourceCreatedEvent ||
        event == DashboardModuleConstants.dataSourceUpdatedEvent) {
      _dataSourcesRepository.insertDataSources([payload]);

      /// Data source DELETE
    } else if (event == DashboardModuleConstants.dataSourceDeletedEvent &&
        payload.containsKey('id')) {
      _dataSourcesRepository.delete(payload['id']);
    }
  }
}
