import 'package:fastybird_smart_panel/l10n/app_localizations_en.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/pages/page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/view.dart';
import 'package:fastybird_smart_panel/modules/deck/models/deck_item.dart';
import 'package:fastybird_smart_panel/modules/deck/models/deck_nav_tab_data.dart';
import 'package:fastybird_smart_panel/modules/deck/types/domain_type.dart';
import 'package:fastybird_smart_panel/modules/deck/types/system_view_type.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

const String _testPageType = 'test-page';

class _TestPageModel extends PageModel {
  _TestPageModel({required super.id, required super.title})
      : super(type: _testPageType);
}

class _TestPageView extends DashboardPageView {
  _TestPageView({required String id, required String title})
      : super(model: _TestPageModel(id: id, title: title));
}

void main() {
  final localizations = AppLocalizationsEn();

  group('DeckNavTabData', () {
    test('should have correct default values', () {
      final tab = DeckNavTabData(
        icon: MdiIcons.home,
        label: 'Home',
        pageIndex: 0,
      );

      expect(tab.isMore, false);
      expect(tab.isMoreActive, false);
      expect(tab.badgeCount, 0);
    });
  });

  group('buildDeckNavTabs', () {
    test('should return null homeTab when no SystemViewItem', () {
      final tabs = buildDeckNavTabs(
        items: [
          const DomainViewItem(
            id: 'lights-1',
            domainType: DomainType.lights,
            roomId: 'room1',
            title: 'Lights',
            deviceCount: 3,
          ),
        ],
        currentIndex: 0,
        localizations: localizations,
      );

      expect(tabs.homeTab, isNull);
      expect(tabs.scrollableTabs, hasLength(1));
    });

    test('should create homeTab from SystemViewItem', () {
      final tabs = buildDeckNavTabs(
        items: [
          const SystemViewItem(
            id: 'system-master',
            viewType: SystemViewType.master,
            title: 'Master',
          ),
        ],
        currentIndex: 0,
        localizations: localizations,
      );

      expect(tabs.homeTab, isNotNull);
      expect(tabs.homeTab!.label, localizations.system_view_master);
      expect(tabs.homeTab!.icon, MdiIcons.home);
      expect(tabs.homeTab!.pageIndex, 0);
      expect(tabs.scrollableTabs, isEmpty);
    });

    test('should create scrollable tabs from DomainViewItems', () {
      final tabs = buildDeckNavTabs(
        items: [
          const DomainViewItem(
            id: 'lights-1',
            domainType: DomainType.lights,
            roomId: 'room1',
            title: 'Lights',
            deviceCount: 3,
          ),
          const DomainViewItem(
            id: 'climate-1',
            domainType: DomainType.climate,
            roomId: 'room1',
            title: 'Climate',
            deviceCount: 2,
          ),
        ],
        currentIndex: 0,
        localizations: localizations,
      );

      expect(tabs.scrollableTabs, hasLength(2));
      expect(tabs.scrollableTabs[0].label, DomainType.lights.label);
      expect(tabs.scrollableTabs[0].pageIndex, 0);
      expect(tabs.scrollableTabs[1].label, DomainType.climate.label);
      expect(tabs.scrollableTabs[1].pageIndex, 1);
    });

    test('should create scrollable tab from SecurityViewItem', () {
      final tabs = buildDeckNavTabs(
        items: [
          const SecurityViewItem(id: 'security', title: 'Security'),
        ],
        currentIndex: 0,
        localizations: localizations,
      );

      expect(tabs.scrollableTabs, hasLength(1));
      expect(tabs.scrollableTabs[0].label, 'Security');
      expect(tabs.scrollableTabs[0].icon, MdiIcons.shieldHome);
    });

    test('should add More tab when DashboardPageItems exist', () {
      final tabs = buildDeckNavTabs(
        items: [
          const SystemViewItem(
            id: 'system-master',
            viewType: SystemViewType.master,
            title: 'Master',
          ),
          DashboardPageItem(
            id: 'a0000000-0000-4000-8000-000000000001',
            pageView: _TestPageView(id: 'a0000000-0000-4000-8000-000000000001', title: 'Dashboard'),
          ),
        ],
        currentIndex: 0,
        localizations: localizations,
      );

      expect(tabs.scrollableTabs, hasLength(1));
      final moreTab = tabs.scrollableTabs.last;
      expect(moreTab.isMore, true);
      expect(moreTab.label, localizations.deck_nav_more);
      expect(moreTab.pageIndex, -1);
      expect(moreTab.badgeCount, 1);
      expect(moreTab.isMoreActive, false);
    });

    test('should mark More tab active when currentIndex is a DashboardPageItem', () {
      final tabs = buildDeckNavTabs(
        items: [
          const SystemViewItem(
            id: 'system-master',
            viewType: SystemViewType.master,
            title: 'Master',
          ),
          DashboardPageItem(
            id: 'a0000000-0000-4000-8000-000000000001',
            pageView: _TestPageView(id: 'a0000000-0000-4000-8000-000000000001', title: 'Dashboard'),
          ),
        ],
        currentIndex: 1,
        localizations: localizations,
      );

      final moreTab = tabs.scrollableTabs.last;
      expect(moreTab.isMore, true);
      expect(moreTab.isMoreActive, true);
    });

    test('should set correct badgeCount for multiple DashboardPageItems', () {
      final tabs = buildDeckNavTabs(
        items: [
          const SystemViewItem(
            id: 'system-master',
            viewType: SystemViewType.master,
            title: 'Master',
          ),
          DashboardPageItem(
            id: 'a0000000-0000-4000-8000-000000000001',
            pageView: _TestPageView(id: 'a0000000-0000-4000-8000-000000000001', title: 'Page 1'),
          ),
          DashboardPageItem(
            id: 'a0000000-0000-4000-8000-000000000002',
            pageView: _TestPageView(id: 'a0000000-0000-4000-8000-000000000002', title: 'Page 2'),
          ),
          DashboardPageItem(
            id: 'a0000000-0000-4000-8000-000000000003',
            pageView: _TestPageView(id: 'a0000000-0000-4000-8000-000000000003', title: 'Page 3'),
          ),
        ],
        currentIndex: 0,
        localizations: localizations,
      );

      final moreTab = tabs.scrollableTabs.last;
      expect(moreTab.badgeCount, 3);
    });

    test('should preserve correct pageIndex for mixed items', () {
      final tabs = buildDeckNavTabs(
        items: [
          const SystemViewItem(
            id: 'system-master',
            viewType: SystemViewType.master,
            title: 'Master',
          ),
          const DomainViewItem(
            id: 'lights-1',
            domainType: DomainType.lights,
            roomId: 'room1',
            title: 'Lights',
            deviceCount: 3,
          ),
          const SecurityViewItem(id: 'security', title: 'Security'),
          DashboardPageItem(
            id: 'a0000000-0000-4000-8000-000000000001',
            pageView: _TestPageView(id: 'a0000000-0000-4000-8000-000000000001', title: 'Dashboard'),
          ),
        ],
        currentIndex: 0,
        localizations: localizations,
      );

      expect(tabs.homeTab!.pageIndex, 0);
      // Lights at index 1, Security at index 2, More at -1
      expect(tabs.scrollableTabs[0].pageIndex, 1);
      expect(tabs.scrollableTabs[1].pageIndex, 2);
      expect(tabs.scrollableTabs[2].pageIndex, -1);
      expect(tabs.scrollableTabs[2].isMore, true);
    });

    test('should return empty tabs for empty items list', () {
      final tabs = buildDeckNavTabs(
        items: [],
        currentIndex: 0,
        localizations: localizations,
      );

      expect(tabs.homeTab, isNull);
      expect(tabs.scrollableTabs, isEmpty);
    });
  });
}
