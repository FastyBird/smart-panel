import 'package:fastybird_smart_panel/modules/dashboard/models/pages/generic_page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/pages/house_modes_page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/pages/house_page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/pages/page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/cards/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/generic_page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/house.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/house_modes.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/tiles/view.dart';
import 'package:fastybird_smart_panel/plugins/pages-cards/models/model.dart';
import 'package:fastybird_smart_panel/plugins/pages-cards/views/view.dart';
import 'package:fastybird_smart_panel/plugins/pages-device-detail/models/model.dart';
import 'package:fastybird_smart_panel/plugins/pages-device-detail/views/view.dart';
import 'package:fastybird_smart_panel/plugins/pages-space/models/model.dart';
import 'package:fastybird_smart_panel/plugins/pages-space/views/view.dart';
import 'package:fastybird_smart_panel/plugins/pages-tiles/models/model.dart';
import 'package:fastybird_smart_panel/plugins/pages-tiles/views/view.dart';

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
  PageType.space.value: (data) {
    return SpacePageModel.fromJson(data);
  },
  PageType.house.value: (data) {
    return HousePageModel.fromJson(data);
  },
  PageType.houseModes.value: (data) {
    return HouseModesPageModel.fromJson(data);
  },
};

void registerPageModelMapper(
  String type,
  PageModel Function(Map<String, dynamic>) mapper,
) {
  pageModelMappers[type] = mapper;
}

PageModel buildPageModel(PageType type, Map<String, dynamic> data) {
  final builder = pageModelMappers[type.value];

  if (builder != null) {
    return builder(data);
  } else {
    return GenericPageModel.fromJson(data);
  }
}

Map<PageType,
        DashboardPageView Function(PageModel, List<TileView>, List<CardView>, List<DataSourceView>)>
    pageViewsMappers = {
  PageType.tiles: (page, tiles, cards, dataSources) {
    if (page is! TilesPageModel) {
      throw ArgumentError(
        'Page model is not valid for Tiles page view.',
      );
    }

    return TilesPageView(
      id: page.id,
      type: page.type,
      title: page.title,
      icon: page.icon,
      order: page.order,
      showTopBar: page.showTopBar,
      displays: page.displays,
      tiles: tiles,
      cards: cards,
      dataSources: dataSources,
      tileSize: page.tileSize,
      rows: page.rows,
      cols: page.cols,
    );
  },
  PageType.cards: (page, tiles, cards, dataSources) {
    if (page is! CardsPageModel) {
      throw ArgumentError(
        'Page model is not valid for Cards page view.',
      );
    }

    return CardsPageView(
      id: page.id,
      type: page.type,
      title: page.title,
      icon: page.icon,
      order: page.order,
      showTopBar: page.showTopBar,
      displays: page.displays,
      tiles: tiles,
      cards: cards,
      dataSources: dataSources,
    );
  },
  PageType.deviceDetail: (page, tiles, cards, dataSources) {
    if (page is! DeviceDetailPageModel) {
      throw ArgumentError(
        'Page model is not valid for Device detail page view.',
      );
    }

    return DeviceDetailPageView(
      id: page.id,
      type: page.type,
      title: page.title,
      icon: page.icon,
      order: page.order,
      showTopBar: page.showTopBar,
      displays: page.displays,
      tiles: tiles,
      cards: cards,
      dataSources: dataSources,
      device: page.device,
    );
  },
  PageType.space: (page, tiles, cards, dataSources) {
    if (page is! SpacePageModel) {
      throw ArgumentError(
        'Page model is not valid for Space page view.',
      );
    }

    return SpacePageView(
      id: page.id,
      type: page.type,
      title: page.title,
      icon: page.icon,
      order: page.order,
      showTopBar: page.showTopBar,
      displays: page.displays,
      tiles: tiles,
      cards: cards,
      dataSources: dataSources,
      spaceId: page.spaceId,
      viewMode: page.viewMode,
      quickActions: page.quickActions,
    );
  },
  PageType.house: (page, tiles, cards, dataSources) {
    if (page is! HousePageModel) {
      throw ArgumentError(
        'Page model is not valid for House page view.',
      );
    }

    return HousePageView(
      id: page.id,
      type: page.type,
      title: page.title,
      icon: page.icon,
      order: page.order,
      showTopBar: page.showTopBar,
      displays: page.displays,
      tiles: tiles,
      cards: cards,
      dataSources: dataSources,
      viewMode: page.viewMode,
      showWeather: page.showWeather,
    );
  },
  PageType.houseModes: (page, tiles, cards, dataSources) {
    if (page is! HouseModesPageModel) {
      throw ArgumentError(
        'Page model is not valid for House Modes page view.',
      );
    }

    return HouseModesPageView(
      id: page.id,
      type: page.type,
      title: page.title,
      icon: page.icon,
      order: page.order,
      showTopBar: page.showTopBar,
      displays: page.displays,
      tiles: tiles,
      cards: cards,
      dataSources: dataSources,
      confirmOnAway: page.confirmOnAway,
      showLastChanged: page.showLastChanged,
    );
  },
};

void registerPageViewMapper(
  PageType type,
  DashboardPageView Function(
          PageModel, List<TileView>, List<CardView>, List<DataSourceView>)
      mapper,
) {
  pageViewsMappers[type] = mapper;
}

DashboardPageView buildPageView(
  PageModel page, {
  List<TileView> tiles = const [],
  List<CardView> cards = const [],
  List<DataSourceView> dataSources = const [],
}) {
  final builder = pageViewsMappers[page.type];

  if (builder != null) {
    return builder(page, tiles, cards, dataSources);
  } else {
    final Map<String, dynamic> configuration = page is GenericPageModel
        ? page.configuration
        : <String, dynamic>{};

    return GenericPageView(
      id: page.id,
      type: page.type,
      title: page.title,
      icon: page.icon,
      order: page.order,
      showTopBar: page.showTopBar,
      displays: page.displays,
      tiles: tiles,
      cards: cards,
      dataSources: dataSources,
      configuration: configuration,
    );
  }
}
