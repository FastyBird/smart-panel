import 'dart:async';

import 'package:fastybird_smart_panel/plugins/pages-cards/models/model.dart';
import 'package:fastybird_smart_panel/plugins/pages-tiles/models/model.dart';
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

  Timer? _updateDebounce;

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

    _pagesRepository.addListener(_scheduleUpdate);
    _cardsRepository.addListener(_scheduleUpdate);
    _tilesRepository.addListener(_scheduleUpdate);
    _dataSourcesRepository.addListener(_scheduleUpdate);

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

  void _scheduleUpdate() {
    _updateDebounce?.cancel();
    _updateDebounce = Timer(const Duration(milliseconds: 50), _updateData);
  }

  void _updateData() {
    final pages = _pagesRepository.getItems();
    final tiles = _tilesRepository.getItems();
    final dataSources = _dataSourcesRepository.getItems();
    final cards = _cardsRepository.getItems();

    late bool triggerNotifyListeners = false;

    // Step 1: Build all DataSourceViews first (no nested children)
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

    // Step 2: Build TileViews with their embedded dataSources
    Map<String, TileView> newTilesViews = {};

    for (var tile in tiles) {
      try {
        // Get dataSources for this tile
        final tileDataSources = newDataSourcesViews.entries
            .where((entry) =>
                entry.value.parentId == tile.id &&
                entry.value.parentType == 'tile')
            .map((entry) => entry.value)
            .toList();

        newTilesViews[tile.id] = buildTileView(
          tile,
          dataSources: tileDataSources,
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

    // Step 3: Build CardViews with their embedded tiles and dataSources
    Map<String, CardView> newCardsViews = {};

    for (var card in cards) {
      try {
        // Get tiles for this card
        final cardTiles = newTilesViews.entries
            .where((entry) => card.tiles.contains(entry.key))
            .map((entry) => entry.value)
            .toList();

        // Get dataSources for this card
        final cardDataSources = newDataSourcesViews.entries
            .where((entry) =>
                entry.value.parentId == card.id &&
                entry.value.parentType == 'card')
            .map((entry) => entry.value)
            .toList();

        newCardsViews[card.id] = CardView(
          model: card,
          tiles: cardTiles,
          dataSources: cardDataSources,
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

    // Step 4: Build PageViews with their embedded tiles, cards, and dataSources
    Map<String, DashboardPageView> newPagesViews = {};

    for (var page in pages) {
      try {
        // Get tiles for this page (from page model's tiles list)
        List<String> pageTileIds = [];
        if (page is TilesPageModel) {
          pageTileIds = page.tiles;
        }

        final pageTiles = newTilesViews.entries
            .where((entry) => pageTileIds.contains(entry.key))
            .map((entry) => entry.value)
            .toList();

        // Get cards for this page (from page model's cards list)
        List<String> pageCardIds = [];
        if (page is CardsPageModel) {
          pageCardIds = page.cards;
        }

        final pageCards = newCardsViews.entries
            .where((entry) => pageCardIds.contains(entry.key))
            .map((entry) => entry.value)
            .toList();

        // Get dataSources for this page
        final pageDataSources = newDataSourcesViews.entries
            .where((entry) =>
                entry.value.parentId == page.id &&
                entry.value.parentType == 'page')
            .map((entry) => entry.value)
            .toList();

        newPagesViews[page.id] = buildPageView(
          page,
          tiles: pageTiles,
          cards: pageCards,
          dataSources: pageDataSources,
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
    _updateDebounce?.cancel();

    _pagesRepository.removeListener(_scheduleUpdate);
    _tilesRepository.removeListener(_scheduleUpdate);
    _dataSourcesRepository.removeListener(_scheduleUpdate);
    _cardsRepository.removeListener(_scheduleUpdate);

    super.dispose();
  }
}
