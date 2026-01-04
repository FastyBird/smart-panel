import 'package:fastybird_smart_panel/features/deck/presentation/pages/house.dart';
import 'package:fastybird_smart_panel/features/deck/presentation/pages/house_modes.dart';
import 'package:fastybird_smart_panel/modules/dashboard/mappers/page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/pages/house_modes_page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/pages/house_page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/pages/page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/cards/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/house.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/house_modes.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/tiles/view.dart';

const String _housePageType = 'pages-house';
const String _houseModesPageType = 'pages-house-modes';

void registerDeckPagesFeature() {
  // Register house page model mapper
  registerPageModelMapper(_housePageType, (data) {
    return HousePageModel.fromJson(data);
  });

  // Register house modes page model mapper
  registerPageModelMapper(_houseModesPageType, (data) {
    return HouseModesPageModel.fromJson(data);
  });

  // Register house page view mapper
  registerPageViewMapper(
    PageType.house,
    (PageModel page, List<TileView> tiles, List<CardView> cards, List<DataSourceView> dataSources) {
      if (page is! HousePageModel) {
        throw ArgumentError('Page model is not valid for House page view.');
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
  );

  // Register house modes page view mapper
  registerPageViewMapper(
    PageType.houseModes,
    (PageModel page, List<TileView> tiles, List<CardView> cards, List<DataSourceView> dataSources) {
      if (page is! HouseModesPageModel) {
        throw ArgumentError('Page model is not valid for House Modes page view.');
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
  );

  // Register house page widget mapper
  registerPageWidgetMapper(PageType.house, (page) {
    return HousePage(page: page as HousePageView);
  });

  // Register house modes page widget mapper
  registerPageWidgetMapper(PageType.houseModes, (page) {
    return HouseModesPage(page: page as HouseModesPageView);
  });
}
