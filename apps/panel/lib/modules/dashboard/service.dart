import 'package:fastybird_smart_panel/modules/dashboard/export.dart';
import 'package:fastybird_smart_panel/modules/dashboard/mappers/data_source.dart';
import 'package:fastybird_smart_panel/modules/dashboard/mappers/page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/mappers/tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/cards/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/tiles/view.dart';
import 'package:flutter/foundation.dart';

class DashboardService extends ChangeNotifier {
  final PagesRepository _pagesRepository;
  final TilesRepository _tilesRepository;
  final DataSourcesRepository _dataSourcesRepository;
  final CardsRepository _cardsRepository;

  Map<String, DashboardPageView> _pages = {};
  Map<String, TileView> _tiles = {};
  Map<String, DataSourceView> _dataSources = {};
  Map<String, CardView> _cards = {};

  /// Tracks the current page ID during the session for space-aware idle mode.
  /// When the panel returns from idle (screensaver/lock), it will restore
  /// to this page instead of always going to the home page.
  String? _currentPageId;

  DashboardService({
    required PagesRepository pagesRepository,
    required TilesRepository tilesRepository,
    required DataSourcesRepository dataSourcesRepository,
    required CardsRepository cardsRepository,
  })  : _pagesRepository = pagesRepository,
        _tilesRepository = tilesRepository,
        _dataSourcesRepository = dataSourcesRepository,
        _cardsRepository = cardsRepository;

  Future<void> initialize() async {
    await _pagesRepository.fetchAll();

    for (var page in _pagesRepository.getItems()) {
      await _cardsRepository.fetchAll(page.id);
      await _tilesRepository.fetchAll('page', page.id);
      await _dataSourcesRepository.fetchAll('page', page.id);
    }

    for (var card in _cardsRepository.getItems()) {
      await _tilesRepository.fetchAll('card', card.id);
      await _dataSourcesRepository.fetchAll('card', card.id);
    }

    for (var tile in _tilesRepository.getItems()) {
      await _tilesRepository.fetchAll('tile', tile.id);
      await _dataSourcesRepository.fetchAll('tile', tile.id);
    }

    _pagesRepository.addListener(_updateData);
    _cardsRepository.addListener(_updateData);
    _tilesRepository.addListener(_updateData);
    _dataSourcesRepository.addListener(_updateData);

    _updateData();
  }

  Map<String, DashboardPageView> get pages => _pages;

  Map<String, TileView> get tiles => _tiles;

  Map<String, DataSourceView> get dataSources => _dataSources;

  Map<String, CardView> get cards => _cards;

  /// Returns the current page ID being viewed, if set.
  String? get currentPageId => _currentPageId;

  /// Sets the current page ID. Call this when the user navigates to a page.
  /// This enables space-aware idle mode - when returning from screensaver/lock,
  /// the dashboard will restore to this page.
  void setCurrentPageId(String? pageId) {
    if (_currentPageId != pageId) {
      _currentPageId = pageId;
    }
  }

  /// Clears the current page ID tracking. Call this when resetting to home.
  void clearCurrentPageId() {
    _currentPageId = null;
  }

  DashboardPageView? getPage(String id) {
    if (!_pages.containsKey(id)) {
      return null;
    }

    return _pages[id];
  }

  TileView? getTile(String id) {
    if (!_tiles.containsKey(id)) {
      return null;
    }

    return _tiles[id];
  }

  DataSourceView? getDataSource(String id) {
    if (!_dataSources.containsKey(id)) {
      return null;
    }

    return _dataSources[id];
  }

  CardView? getCard(String id) {
    if (!_cards.containsKey(id)) {
      return null;
    }

    return _cards[id];
  }

  void _updateData() {
    final pages = _pagesRepository.getItems();
    final tiles = _tilesRepository.getItems();
    final dataSources = _dataSourcesRepository.getItems();
    final cards = _cardsRepository.getItems();

    late bool triggerNotifyListeners = false;

    Map<String, DataSourceView> newDataSourcesViews = {};

    for (var dataSource in dataSources) {
      try {
        newDataSourcesViews[dataSource.id] = buildDataSourceView(
          dataSource,
        );
      } catch (e) {
        if (kDebugMode) {
          debugPrint(
            '[DASHBOARD MODULE][SERVICE] Failed to create data source view: ${e.toString()}',
          );
        }
      }
    }

    if (!mapEquals(_dataSources, newDataSourcesViews)) {
      _dataSources = newDataSourcesViews;

      triggerNotifyListeners = true;
    }

    Map<String, TileView> newTilesViews = {};

    for (var tile in tiles) {
      try {
        newTilesViews[tile.id] = buildTileView(
          tile,
        );
      } catch (e) {
        if (kDebugMode) {
          debugPrint(
            '[DASHBOARD MODULE][SERVICE] Failed to create tile view: ${e.toString()}',
          );
        }
      }
    }

    if (!mapEquals(_tiles, newTilesViews)) {
      _tiles = newTilesViews;

      triggerNotifyListeners = true;
    }

    Map<String, CardView> newCardsViews = {};

    for (var card in cards) {
      try {
        newCardsViews[card.id] = CardView(
          cardModel: card,
        );
      } catch (e) {
        if (kDebugMode) {
          debugPrint(
            '[DASHBOARD MODULE][SERVICE] Failed to create card view: ${e.toString()}',
          );
        }
      }
    }

    if (!mapEquals(_cards, newCardsViews)) {
      _cards = newCardsViews;

      triggerNotifyListeners = true;
    }

    Map<String, DashboardPageView> newPagesViews = {};

    for (var page in pages) {
      try {
        newPagesViews[page.id] = buildPageView(
          page,
        );
      } catch (e) {
        if (kDebugMode) {
          debugPrint(
            '[DASHBOARD MODULE][SERVICE] Failed to create page view: ${e.toString()}',
          );
        }
      }
    }

    if (!mapEquals(_pages, newPagesViews)) {
      _pages = newPagesViews;

      triggerNotifyListeners = true;
    }

    if (triggerNotifyListeners) {
      notifyListeners();
    }
  }

  @override
  void dispose() {
    super.dispose();

    _pagesRepository.removeListener(_updateData);
    _tilesRepository.removeListener(_updateData);
    _dataSourcesRepository.removeListener(_updateData);
    _cardsRepository.removeListener(_updateData);
  }
}
