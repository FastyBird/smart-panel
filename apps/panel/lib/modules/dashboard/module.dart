import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:fastybird_smart_panel/features/deck/mappers/page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/constants.dart';
import 'package:fastybird_smart_panel/modules/dashboard/repositories/cards.dart';
import 'package:fastybird_smart_panel/modules/dashboard/repositories/data_sources.dart';
import 'package:fastybird_smart_panel/modules/dashboard/repositories/pages.dart';
import 'package:fastybird_smart_panel/modules/dashboard/repositories/tiles.dart';
import 'package:fastybird_smart_panel/modules/dashboard/service.dart';
import 'package:fastybird_smart_panel/plugins/data-sources-device-channel/mapper.dart';
import 'package:fastybird_smart_panel/plugins/data-sources-weather/mapper.dart';
import 'package:fastybird_smart_panel/plugins/pages-cards/mapper.dart';
import 'package:fastybird_smart_panel/plugins/pages-device-detail/mapper.dart';
import 'package:fastybird_smart_panel/plugins/pages-space/mapper.dart';
import 'package:fastybird_smart_panel/plugins/pages-tiles/mapper.dart';
import 'package:fastybird_smart_panel/plugins/tiles-device-preview/mapper.dart';
import 'package:fastybird_smart_panel/plugins/tiles-scene/mapper.dart';
import 'package:fastybird_smart_panel/plugins/tiles-time/mapper.dart';
import 'package:fastybird_smart_panel/plugins/tiles-weather/mapper.dart';
import 'package:flutter/foundation.dart';

class DashboardModuleService {
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
  }) : _socketService = socketService {
    // Register all dashboard plugins
    _registerPlugins();

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

    await _dashboardService.initialize();

    _isLoading = false;

    _socketService.registerEventHandler(
      DashboardModuleConstants.moduleWildcardEvent,
      _socketEventHandler,
    );

    if (kDebugMode) {
      debugPrint(
        '[DASHBOARD MODULE][MODULE] Module was successfully initialized',
      );
    }
  }

  bool get isLoading => _isLoading;

  void dispose() {
    _socketService.unregisterEventHandler(
      DashboardModuleConstants.moduleWildcardEvent,
      _socketEventHandler,
    );
  }

  /// ////////////////
  /// PLUGIN REGISTRATION
  /// ////////////////

  void _registerPlugins() {
    // Register tile plugins
    registerTilesTimePlugin();
    registerTilesWeatherPlugin();
    registerTilesDevicePreviewPlugin();
    registerTilesScenePlugin();

    // Register data source plugins
    registerDataSourcesDeviceChannelPlugin();
    registerDataSourcesWeatherPlugin();

    // Register page plugins
    registerPagesTilesPlugin();
    registerPagesCardsPlugin();
    registerPagesDeviceDetailPlugin();
    registerPagesSpacePlugin();

    // Register deck feature pages (house, house modes)
    registerDeckPagesFeature();

    if (kDebugMode) {
      debugPrint(
        '[DASHBOARD MODULE][MODULE] All dashboard plugins registered successfully',
      );
    }
  }

  /// ////////////////
  /// SOCKETS HANDLERS
  /// ////////////////

  void _socketEventHandler(String event, Map<String, dynamic> payload) {
    /// Page CREATE/UPDATE
    if (event == DashboardModuleConstants.pageCreatedEvent ||
        event == DashboardModuleConstants.pageUpdatedEvent) {
      // Filter pages based on current display ID before inserting
      // The insert() method will handle the filtering logic
      _pagesRepository.insert([payload]);

      /// Page DELETE
    } else if (event == DashboardModuleConstants.pageDeletedEvent &&
        payload.containsKey('id')) {
      _pagesRepository.delete(payload['id']);

      /// Card CREATE/UPDATE
    } else if (event == DashboardModuleConstants.cardCreatedEvent ||
        event == DashboardModuleConstants.cardUpdatedEvent) {
      _cardsRepository.insert([payload]);

      /// Card DELETE
    } else if (event == DashboardModuleConstants.cardDeletedEvent &&
        payload.containsKey('id')) {
      _cardsRepository.delete(payload['id']);

      /// Tile CREATE/UPDATE
    } else if (event == DashboardModuleConstants.tileCreatedEvent ||
        event == DashboardModuleConstants.tileUpdatedEvent) {
      _tilesRepository.insert([payload]);

      /// Tile DELETE
    } else if (event == DashboardModuleConstants.tileDeletedEvent &&
        payload.containsKey('id')) {
      _tilesRepository.delete(payload['id']);

      /// Data source CREATE/UPDATE
    } else if (event == DashboardModuleConstants.dataSourceCreatedEvent ||
        event == DashboardModuleConstants.dataSourceUpdatedEvent) {
      _dataSourcesRepository.insert([payload]);

      /// Data source DELETE
    } else if (event == DashboardModuleConstants.dataSourceDeletedEvent &&
        payload.containsKey('id')) {
      _dataSourcesRepository.delete(payload['id']);
    }
  }
}
