import 'package:fastybird_smart_panel/modules/dashboard/mappers/page_widget.dart';
import 'package:fastybird_smart_panel/features/deck/mappers/system_view.dart';
import 'package:fastybird_smart_panel/features/deck/presentation/domain_views/domain_view.dart';
import 'package:fastybird_smart_panel/modules/deck/export.dart';
import 'package:flutter/material.dart';

/// Builds the appropriate widget for any deck item.
///
/// Handles system views, domain views, and dashboard pages by delegating to
/// the appropriate mapper or widget.
Widget buildDeckItemWidget(DeckItem item) {
  switch (item) {
    case SystemViewItem systemView:
      return buildSystemViewWidget(systemView);
    case DomainViewItem domainView:
      return DomainViewPage(viewItem: domainView);
    case DashboardPageItem pageItem:
      return buildPageWidget(pageItem.pageView);
  }
}
