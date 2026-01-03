import 'package:fastybird_smart_panel/plugins/pages-device-detail/presentation/page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:fastybird_smart_panel/plugins/pages-device-detail/views/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/view.dart';
import 'package:flutter/material.dart';

Map<PageType, Widget Function(DashboardPageView)> deviceDetailPageWidgetMappers = {
  PageType.deviceDetail: (page) {
    return DeviceDetailPage(page: page as DeviceDetailPageView);
  },
};
