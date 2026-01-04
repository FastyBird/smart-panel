import 'package:fastybird_smart_panel/plugins/pages-cards/mapper.dart';
import 'package:fastybird_smart_panel/plugins/pages-device-detail/mapper.dart';
import 'package:fastybird_smart_panel/plugins/pages-space/mapper.dart';
import 'package:fastybird_smart_panel/plugins/pages-tiles/mapper.dart';
import 'package:fastybird_smart_panel/features/deck/presentation/pages/house.dart';
import 'package:fastybird_smart_panel/features/deck/presentation/pages/house_modes.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/house.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/house_modes.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/view.dart';
import 'package:flutter/material.dart';

/// Combines all page widget mappers from plugins
final Map<PageType, Widget Function(DashboardPageView)> pageWidgetMappers = {
  ...tilesPageWidgetMappers,
  ...cardsPageWidgetMappers,
  ...deviceDetailPageWidgetMappers,
  ...spacePageWidgetMappers,
  PageType.house: (page) => HousePage(page: page as HousePageView),
  PageType.houseModes: (page) => HouseModesPage(page: page as HouseModesPageView),
};

Widget buildPageWidget(DashboardPageView page) {
  final builder = pageWidgetMappers[page.type];

  if (builder != null) {
    return builder(page);
  } else {
    throw ArgumentError(
      'Page widget can not be created. Unsupported page type: ${page.type.value}',
    );
  }
}
