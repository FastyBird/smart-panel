import 'package:fastybird_smart_panel/plugins/pages-tiles/presentation/page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:fastybird_smart_panel/plugins/pages-tiles/views/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/view.dart';
import 'package:flutter/material.dart';

Map<PageType, Widget Function(DashboardPageView)> tilesPageWidgetMappers = {
  PageType.tiles: (page) {
    return TilesPage(page: page as TilesPageView);
  },
};
