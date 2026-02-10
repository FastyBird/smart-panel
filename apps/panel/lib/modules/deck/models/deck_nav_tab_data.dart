import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/models/deck_item.dart';
import 'package:fastybird_smart_panel/modules/deck/types/domain_type.dart';
import 'package:flutter/widgets.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Data holder for a single navigation tab entry.
///
/// Shared between [DeckBottomNavBar] and [DeckSideDock] so the tab
/// construction logic stays in one place.
class DeckNavTabData {
  final IconData icon;
  final String label;
  final int pageIndex;
  final bool isMore;
  final bool isMoreActive;
  final int badgeCount;

  const DeckNavTabData({
    required this.icon,
    required this.label,
    required this.pageIndex,
    this.isMore = false,
    this.isMoreActive = false,
    this.badgeCount = 0,
  });
}

/// Result of [buildDeckNavTabs].
class DeckNavTabs {
  final DeckNavTabData? homeTab;
  final List<DeckNavTabData> scrollableTabs;

  const DeckNavTabs({this.homeTab, required this.scrollableTabs});
}

/// Builds the shared tab data from the deck items list.
///
/// Both the bottom nav bar (portrait) and side dock (landscape) use
/// the same logic to turn [DeckService.items] into navigation tabs.
DeckNavTabs buildDeckNavTabs({
  required List<DeckItem> items,
  required int currentIndex,
  required AppLocalizations localizations,
}) {
  DeckNavTabData? homeTab;
  final scrollableTabs = <DeckNavTabData>[];

  for (int i = 0; i < items.length; i++) {
    final item = items[i];
    if (item is SystemViewItem) {
      homeTab = DeckNavTabData(
        icon: MdiIcons.home,
        label: localizations.system_view_master,
        pageIndex: i,
      );
    } else if (item is DomainViewItem) {
      scrollableTabs.add(DeckNavTabData(
        icon: item.domainType.icon,
        label: item.domainType.label,
        pageIndex: i,
      ));
    } else if (item is SecurityViewItem) {
      scrollableTabs.add(DeckNavTabData(
        icon: MdiIcons.shieldHome,
        label: item.title,
        pageIndex: i,
      ));
    }
  }

  final dashboardPages = items.whereType<DashboardPageItem>().toList();

  if (dashboardPages.isNotEmpty) {
    final isDashboardActive =
        currentIndex < items.length && items[currentIndex] is DashboardPageItem;
    scrollableTabs.add(DeckNavTabData(
      icon: MdiIcons.dotsHorizontal,
      label: localizations.deck_nav_more,
      pageIndex: -1,
      isMore: true,
      isMoreActive: isDashboardActive,
      badgeCount: dashboardPages.length,
    ));
  }

  return DeckNavTabs(homeTab: homeTab, scrollableTabs: scrollableTabs);
}
