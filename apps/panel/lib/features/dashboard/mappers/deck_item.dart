import 'package:fastybird_smart_panel/features/dashboard/mappers/page.dart';
import 'package:fastybird_smart_panel/features/dashboard/mappers/system_view.dart';
import 'package:fastybird_smart_panel/modules/deck/export.dart';
import 'package:flutter/material.dart';

/// Builds the appropriate widget for any deck item.
///
/// Handles both system views and dashboard pages by delegating to
/// the appropriate mapper.
Widget buildDeckItemWidget(DeckItem item) {
  switch (item) {
    case SystemViewItem systemView:
      return buildSystemViewWidget(systemView);
    case DashboardPageItem pageItem:
      return buildPageWidget(pageItem.pageView);
  }
}
