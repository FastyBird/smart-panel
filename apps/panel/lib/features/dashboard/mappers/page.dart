import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/cards.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/device_detail.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/tiles.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/cards.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/device_detail.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/tiles.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/view.dart';
import 'package:flutter/material.dart';

Map<PageType, Widget Function(DashboardPageView)> pageWidgetMappers = {
  PageType.tiles: (page) {
    return TilesPage(page: page as TilesPageView);
  },
  PageType.cards: (page) {
    return CardsPage(page: page as CardsPageView);
  },
  PageType.deviceDetail: (page) {
    return DeviceDetailPage(page: page as DeviceDetailPageView);
  },
};

Widget buildPageWidget(DashboardPageView page) {
  final builder = pageWidgetMappers[page.type];

  if (builder != null) {
    return builder(page);
  } else {
    throw Exception(
      'Page widget can not be created. Unsupported page type: ${page.type.value}',
    );
  }
}
