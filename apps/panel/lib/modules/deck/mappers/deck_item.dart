import 'package:fastybird_smart_panel/modules/dashboard/mappers/page.dart';
import 'package:fastybird_smart_panel/modules/deck/export.dart';
import 'package:fastybird_smart_panel/modules/energy/presentation/energy_screen.dart';
import 'package:fastybird_smart_panel/modules/security/presentation/security_screen.dart';
import 'package:flutter/material.dart';

/// Builds the appropriate widget for any deck item.
///
/// Handles system views, domain views, security view, energy view,
/// and dashboard pages by delegating to the appropriate mapper or widget.
Widget buildDeckItemWidget(DeckItem item) {
  switch (item) {
    case SystemViewItem systemView:
      return buildSystemViewWidget(systemView);
    case DomainViewItem domainView:
      return _buildDomainViewWidget(domainView);
    case SecurityViewItem _:
      return const SecurityScreen(embedded: true);
    case EnergyViewItem _:
      return const EnergyScreen(embedded: true);
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
      return ClimateDomainViewPage(viewItem: domainView);
    case DomainType.shading:
      return ShadingDomainViewPage(viewItem: domainView);
    case DomainType.media:
      return MediaDomainViewPage(viewItem: domainView);
    case DomainType.sensors:
      return SensorsDomainViewPage(viewItem: domainView);
    case DomainType.energy:
      return EnergyDomainViewPage(viewItem: domainView);
  }
}
