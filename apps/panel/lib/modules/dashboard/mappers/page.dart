import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/pages/cards_page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/pages/device_page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/pages/page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/pages/tiles_page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/service.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/cards/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/cards.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/device_detail.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/tiles.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/tiles/view.dart';

Map<String, PageModel Function(Map<String, dynamic>)> pageModelMappers = {
  PageType.cards.value: (data) {
    return CardsPageModel.fromJson(data);
  },
  PageType.tiles.value: (data) {
    return TilesPageModel.fromJson(data);
  },
  PageType.deviceDetail.value: (data) {
    return DeviceDetailPageModel.fromJson(data);
  },
};

PageModel buildPageModel(PageType type, Map<String, dynamic> data) {
  final builder = pageModelMappers[type.value];

  if (builder != null) {
    return builder(data);
  } else {
    throw Exception(
      'Page model can not be created. Unsupported page type: ${type.value}',
    );
  }
}

Map<PageType, DashboardPageView Function(PageModel)> pageViewsMappers = {
  PageType.tiles: (page) {
    if (page is! TilesPageModel) {
      throw ArgumentError(
        'Page model is not valid for Tiles page view.',
      );
    }

    final DashboardService dashboardService = locator<DashboardService>();

    final List<TileView> tiles = dashboardService.tiles.entries
        .where((entry) => page.tiles.contains(entry.key))
        .map((entry) => entry.value)
        .toList();

    // Query data sources by parentId to include newly created ones
    final List<DataSourceView> dataSources = dashboardService
        .dataSources.entries
        .where((entry) =>
            entry.value.parentId == page.id && entry.value.parentType == 'page')
        .map((entry) => entry.value)
        .toList();

    return TilesPageView(
      pageModel: page,
      tiles: tiles,
      dataSources: dataSources,
    );
  },
  PageType.cards: (page) {
    if (page is! CardsPageModel) {
      throw ArgumentError(
        'Page model is not valid for Cards page view.',
      );
    }

    final DashboardService dashboardService = locator<DashboardService>();

    final List<CardView> cards = dashboardService.cards.entries
        .where((entry) => page.cards.contains(entry.key))
        .map((entry) => entry.value)
        .toList();

    // Query data sources by parentId to include newly created ones
    final List<DataSourceView> dataSources = dashboardService
        .dataSources.entries
        .where((entry) =>
            entry.value.parentId == page.id && entry.value.parentType == 'page')
        .map((entry) => entry.value)
        .toList();

    return CardsPageView(
      pageModel: page,
      cards: cards,
      dataSources: dataSources,
    );
  },
  PageType.deviceDetail: (page) {
    if (page is! DeviceDetailPageModel) {
      throw ArgumentError(
        'Page model is not valid for Device detail page view.',
      );
    }

    return DeviceDetailPageView(
      pageModel: page,
    );
  },
};

DashboardPageView buildPageView(
  PageModel page,
) {
  final builder = pageViewsMappers[page.type];

  if (builder != null) {
    return builder(page);
  } else {
    throw ArgumentError(
      'Page view can not be created. Unsupported page type: ${page.type.value}',
    );
  }
}
