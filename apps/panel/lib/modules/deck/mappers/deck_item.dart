import 'package:fastybird_smart_panel/modules/dashboard/mappers/page.dart';
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
      return _buildDomainViewWidget(domainView);
    case DashboardPageItem pageItem:
      return buildPageWidget(pageItem.pageView);
  }
}

/// Builds the appropriate widget for a domain view based on its type.
Widget _buildDomainViewWidget(DomainViewItem domainView) {
  switch (domainView.domainType) {
    case DomainType.lights:
      return LightsDomainViewPage(viewItem: domainView);
    case DomainType.climate:
    case DomainType.media:
    case DomainType.sensors:
      // Use placeholder for other domains (to be implemented)
      return DomainViewPage(viewItem: domainView);
  }
}
