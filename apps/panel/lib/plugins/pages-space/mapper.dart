import 'package:fastybird_smart_panel/plugins/pages-space/presentation/page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:fastybird_smart_panel/plugins/pages-space/views/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/view.dart';
import 'package:flutter/material.dart';

Map<PageType, Widget Function(DashboardPageView)> spacePageWidgetMappers = {
  PageType.space: (page) {
    return SpacePage(page: page as SpacePageView);
  },
};
