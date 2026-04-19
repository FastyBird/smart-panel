import 'package:fastybird_smart_panel/api/models/devices_module_device_category.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_data_space_type.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/pages/page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/view.dart';
import 'package:fastybird_smart_panel/modules/deck/models/deck_item.dart';
import 'package:fastybird_smart_panel/modules/deck/models/deck_result.dart';
import 'package:fastybird_smart_panel/modules/deck/services/deck_builder.dart';
import 'package:fastybird_smart_panel/modules/deck/services/system_views_builder.dart';
import 'package:fastybird_smart_panel/modules/deck/types/domain_type.dart';
import 'package:fastybird_smart_panel/modules/deck/types/system_view_type.dart';
import 'package:fastybird_smart_panel/modules/displays/models/display.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/spaces/space.dart';
import 'package:fastybird_smart_panel/modules/spaces/views/spaces/view.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/services/space_view_builders.dart';
import 'package:fastybird_smart_panel/plugins/spaces-synthetic-entry/services/space_view_builder.dart';
import 'package:fastybird_smart_panel/plugins/spaces-synthetic-master/services/space_view_builder.dart';
import 'package:flutter_test/flutter_test.dart';

// Valid UUIDs for testing (v4 format with variant bits)
const _uuid1 = 'a0000000-0000-4000-8000-000000000001';
const _uuid2 = 'a0000000-0000-4000-8000-000000000002';
const _uuid3 = 'a0000000-0000-4000-8000-000000000003';

const _roomUuid = 'b0000000-0000-4000-8000-000000000001';
const _masterUuid = 'b0000000-0000-4000-8000-000000000002';
const _entryUuid = 'b0000000-0000-4000-8000-000000000003';

const String _testPageType = 'test-page';

// Simple test page model for testing
class TestPageModel extends PageModel {
  TestPageModel({
    required super.id,
    required super.title,
    super.order,
  }) : super(
          type: _testPageType,
        );
}

// Simple test page view for testing
class TestPageView extends DashboardPageView {
  TestPageView({
    required String id,
    required String title,
    int order = 0,
  }) : super(
          model: TestPageModel(
            id: id,
            title: title,
            order: order,
          ),
        );
}

DisplayModel createTestDisplay({
  String id = 'test-display-id',
  String? spaceId,
  HomeMode homeMode = HomeMode.autoSpace,
  String? homePageId,
  String? resolvedHomePageId,
}) {
  return DisplayModel(
    id: id,
    macAddress: '00:11:22:33:44:55',
    version: '1.0.0',
    screenWidth: 800,
    screenHeight: 480,
    pixelRatio: 1.0,
    unitSize: 80.0,
    rows: 3,
    cols: 5,
    darkMode: false,
    brightness: 100,
    screenLockDuration: 30,
    screenSaver: true,
    audioOutputSupported: false,
    audioInputSupported: false,
    speaker: false,
    speakerVolume: 50,
    microphone: false,
    microphoneVolume: 50,
    spaceId: spaceId,
    homeMode: homeMode,
    homePageId: homePageId,
    resolvedHomePageId: resolvedHomePageId,
    createdAt: DateTime.now(),
  );
}

// Helper to create a mock space for testing
SpaceView createMockSpace({
  required String id,
  required SpacesModuleDataSpaceType type,
}) {
  return SpaceView(
    model: SpaceModel(
      id: id,
      type: type,
      name: 'Test Space',
      displayOrder: 0,
      suggestionsEnabled: true,
      parentId: null,
    ),
  );
}

void main() {
  setUp(() {
    spaceViewBuilders[SpacesModuleDataSpaceType.room] = RoomSpaceViewBuilder();
    spaceViewBuilders[SpacesModuleDataSpaceType.zone] = ZoneSpaceViewBuilder();
    spaceViewBuilders[SpacesModuleDataSpaceType.master] = MasterSpaceViewBuilder();
    spaceViewBuilders[SpacesModuleDataSpaceType.entry] = EntrySpaceViewBuilder();
  });

  tearDown(() {
    spaceViewBuilders.clear();
  });

  group('buildDeck', () {
    group('system view generation', () {
      test('should create room system view for room space', () {
        final display = createTestDisplay(spaceId: _roomUuid);
        final space = createMockSpace(
          id: _roomUuid,
          type: SpacesModuleDataSpaceType.room,
        );
        final input = DeckBuildInput(
          display: display,
          space: space,
          pages: [],
          roomViewTitle: 'Room Overview',
        );

        final result = buildDeck(input);

        expect(result.items.length, 2); // system view + security view
        expect(result.items.first, isA<SystemViewItem>());
        final systemView = result.items.first as SystemViewItem;
        expect(systemView.viewType, SystemViewType.room);
        expect(systemView.roomId, _roomUuid);
        expect(systemView.title, 'Room Overview');
        expect(result.items[1], isA<SecurityViewItem>());
      });

      test('should create master system view for master space', () {
        final display = createTestDisplay(spaceId: _masterUuid);
        final space = createMockSpace(
          id: _masterUuid,
          type: SpacesModuleDataSpaceType.master,
        );
        final input = DeckBuildInput(
          display: display,
          space: space,
          pages: [],
          masterViewTitle: 'Home Overview',
        );

        final result = buildDeck(input);

        expect(result.items.length, 2); // system view + security view
        final systemView = result.items.first as SystemViewItem;
        expect(systemView.viewType, SystemViewType.master);
        expect(systemView.title, 'Home Overview');
      });

      test('should create entry system view for entry space', () {
        final display = createTestDisplay(spaceId: _entryUuid);
        final space = createMockSpace(
          id: _entryUuid,
          type: SpacesModuleDataSpaceType.entry,
        );
        final input = DeckBuildInput(
          display: display,
          space: space,
          pages: [],
          entryViewTitle: 'Entry',
        );

        final result = buildDeck(input);

        expect(result.items.length, 2); // system view + security view
        final systemView = result.items.first as SystemViewItem;
        expect(systemView.viewType, SystemViewType.entry);
        expect(systemView.title, 'Entry');
      });
    });

    group('domain view generation', () {
      test('should create domain views for ROOM space with devices', () {
        final display = createTestDisplay(spaceId: _roomUuid);
        final space = createMockSpace(
          id: _roomUuid,
          type: SpacesModuleDataSpaceType.room,
        );
        final input = DeckBuildInput(
          display: display,
          space: space,
          pages: [],
          deviceCategories: [
            DevicesModuleDeviceCategory.lighting,
            DevicesModuleDeviceCategory.thermostat,
          ],
          lightsViewTitle: 'Lights',
          climateViewTitle: 'Climate',
        );

        final result = buildDeck(input);

        // 1 system view + 2 domain views + 1 security view
        expect(result.items.length, 4);
        expect(result.items[0], isA<SystemViewItem>());
        expect(result.items[1], isA<DomainViewItem>());
        expect(result.items[2], isA<DomainViewItem>());
        expect(result.items[3], isA<SecurityViewItem>());

        final lightsView = result.items[1] as DomainViewItem;
        expect(lightsView.domainType, DomainType.lights);
        expect(lightsView.title, 'Lights');
        expect(lightsView.deviceCount, 1);

        final climateView = result.items[2] as DomainViewItem;
        expect(climateView.domainType, DomainType.climate);
        expect(climateView.title, 'Climate');
        expect(climateView.deviceCount, 1);
      });

      test('should not create domain views for MASTER space', () {
        final display = createTestDisplay(spaceId: _masterUuid);
        final space = createMockSpace(
          id: _masterUuid,
          type: SpacesModuleDataSpaceType.master,
        );
        final input = DeckBuildInput(
          display: display,
          space: space,
          pages: [],
          deviceCategories: [
            DevicesModuleDeviceCategory.lighting,
            DevicesModuleDeviceCategory.thermostat,
          ],
        );

        final result = buildDeck(input);

        expect(result.items.length, 2); // system view + security view
        expect(result.items.first, isA<SystemViewItem>());
        expect(result.domainCounts, isNull);
      });

      test('should not create domain views for ENTRY space', () {
        final display = createTestDisplay(spaceId: _entryUuid);
        final space = createMockSpace(
          id: _entryUuid,
          type: SpacesModuleDataSpaceType.entry,
        );
        final input = DeckBuildInput(
          display: display,
          space: space,
          pages: [],
          deviceCategories: [
            DevicesModuleDeviceCategory.lighting,
          ],
        );

        final result = buildDeck(input);

        expect(result.items.length, 2); // system view + security view
        expect(result.items.first, isA<SystemViewItem>());
        expect(result.domainCounts, isNull);
      });

      test('should place domain views between system view and pages', () {
        final display = createTestDisplay(spaceId: _roomUuid);
        final space = createMockSpace(
          id: _roomUuid,
          type: SpacesModuleDataSpaceType.room,
        );
        final pages = [
          TestPageView(id: _uuid1, title: 'Page 1'),
        ];
        final input = DeckBuildInput(
          display: display,
          space: space,
          pages: pages,
          deviceCategories: [DevicesModuleDeviceCategory.lighting],
        );

        final result = buildDeck(input);

        // system view, lights domain, security view, page
        expect(result.items.length, 4);
        expect(result.items[0], isA<SystemViewItem>());
        expect(result.items[1], isA<DomainViewItem>());
        expect(result.items[2], isA<SecurityViewItem>());
        expect(result.items[3], isA<DashboardPageItem>());
      });

      test('should include domainCounts for ROOM space', () {
        final display = createTestDisplay(spaceId: _roomUuid);
        final space = createMockSpace(
          id: _roomUuid,
          type: SpacesModuleDataSpaceType.room,
        );
        final input = DeckBuildInput(
          display: display,
          space: space,
          pages: [],
          deviceCategories: [
            DevicesModuleDeviceCategory.lighting,
            DevicesModuleDeviceCategory.lighting,
            DevicesModuleDeviceCategory.thermostat,
          ],
        );

        final result = buildDeck(input);

        expect(result.domainCounts, isNotNull);
        expect(result.domainCounts!.lights, 2);
        expect(result.domainCounts!.climate, 1);
        expect(result.domainCounts!.media, 0);
        expect(result.domainCounts!.sensors, 0);
      });
    });

    group('energy view deduplication', () {
      test('should not add EnergyViewItem when energy domain view exists for ROOM space', () {
        final display = createTestDisplay(spaceId: _roomUuid);
        final space = createMockSpace(
          id: _roomUuid,
          type: SpacesModuleDataSpaceType.room,
        );
        final input = DeckBuildInput(
          display: display,
          space: space,
          pages: [],
          deviceCategories: [
            DevicesModuleDeviceCategory.sensor,
          ],
          energyDeviceCount: 1, // room has devices with energy channels
          energySupported: true,
        );

        final result = buildDeck(input);

        // Should have: system view, sensors domain, energy domain, security — NO EnergyViewItem
        final energyViewItems = result.items.whereType<EnergyViewItem>().toList();
        final energyDomainViews = result.items
            .whereType<DomainViewItem>()
            .where((d) => d.domainType == DomainType.energy)
            .toList();

        expect(energyViewItems, isEmpty);
        expect(energyDomainViews, hasLength(1));
      });

      test('should add EnergyViewItem for MASTER space when energy supported', () {
        final display = createTestDisplay(spaceId: _masterUuid);
        final space = createMockSpace(
          id: _masterUuid,
          type: SpacesModuleDataSpaceType.master,
        );
        final input = DeckBuildInput(
          display: display,
          space: space,
          pages: [],
          energySupported: true,
        );

        final result = buildDeck(input);

        final energyViewItems = result.items.whereType<EnergyViewItem>().toList();
        expect(energyViewItems, hasLength(1));
      });

      test('should add EnergyViewItem for ENTRY space when energy supported', () {
        final display = createTestDisplay(spaceId: _entryUuid);
        final space = createMockSpace(
          id: _entryUuid,
          type: SpacesModuleDataSpaceType.entry,
        );
        final input = DeckBuildInput(
          display: display,
          space: space,
          pages: [],
          energySupported: true,
        );

        final result = buildDeck(input);

        final energyViewItems = result.items.whereType<EnergyViewItem>().toList();
        expect(energyViewItems, hasLength(1));
      });

      test('should add EnergyViewItem for ROOM space without sensor devices', () {
        final display = createTestDisplay(spaceId: _roomUuid);
        final space = createMockSpace(
          id: _roomUuid,
          type: SpacesModuleDataSpaceType.room,
        );
        final input = DeckBuildInput(
          display: display,
          space: space,
          pages: [],
          deviceCategories: [
            DevicesModuleDeviceCategory.lighting, // no sensors → no energy domain view
          ],
          energySupported: true,
        );

        final result = buildDeck(input);

        final energyViewItems = result.items.whereType<EnergyViewItem>().toList();
        expect(energyViewItems, hasLength(1));
      });
    });

    group('indexByViewKey', () {
      test('should populate indexByViewKey for system view', () {
        final display = createTestDisplay(spaceId: _roomUuid);
        final space = createMockSpace(
          id: _roomUuid,
          type: SpacesModuleDataSpaceType.room,
        );
        final input = DeckBuildInput(display: display, space: space, pages: []);

        final result = buildDeck(input);

        expect(result.indexByViewKey['room-overview:$_roomUuid'], 0);
      });

      test('should populate indexByViewKey for domain views', () {
        final display = createTestDisplay(spaceId: _roomUuid);
        final space = createMockSpace(
          id: _roomUuid,
          type: SpacesModuleDataSpaceType.room,
        );
        final input = DeckBuildInput(
          display: display,
          space: space,
          pages: [],
          deviceCategories: [
            DevicesModuleDeviceCategory.lighting,
            DevicesModuleDeviceCategory.television,
          ],
        );

        final result = buildDeck(input);

        expect(result.indexByViewKey['room-overview:$_roomUuid'], 0);
        expect(result.indexByViewKey['domain:$_roomUuid:lights'], 1);
        expect(result.indexByViewKey['domain:$_roomUuid:media'], 2);
      });

      test('should populate indexByViewKey for pages', () {
        final display = createTestDisplay(spaceId: _roomUuid);
        final space = createMockSpace(
          id: _roomUuid,
          type: SpacesModuleDataSpaceType.room,
        );
        final pages = [
          TestPageView(id: _uuid1, title: 'Page 1'),
          TestPageView(id: _uuid2, title: 'Page 2'),
        ];
        final input = DeckBuildInput(display: display, space: space, pages: pages);

        final result = buildDeck(input);

        expect(result.indexByViewKey['page:$_uuid1'], 2); // after system + security
        expect(result.indexByViewKey['page:$_uuid2'], 3);
      });

      test('getIndexByViewKey should return -1 for unknown key', () {
        final display = createTestDisplay(spaceId: _roomUuid);
        final space = createMockSpace(
          id: _roomUuid,
          type: SpacesModuleDataSpaceType.room,
        );
        final input = DeckBuildInput(display: display, space: space, pages: []);

        final result = buildDeck(input);

        expect(result.getIndexByViewKey('unknown-key'), -1);
      });
    });

    group('page ordering', () {
      test('should sort pages by order', () {
        final display = createTestDisplay(spaceId: _roomUuid);
        final space = createMockSpace(
          id: _roomUuid,
          type: SpacesModuleDataSpaceType.room,
        );
        final pages = [
          TestPageView(id: _uuid3, title: 'Page 3', order: 3),
          TestPageView(id: _uuid1, title: 'Page 1', order: 1),
          TestPageView(id: _uuid2, title: 'Page 2', order: 2),
        ];
        final input = DeckBuildInput(display: display, space: space, pages: pages);

        final result = buildDeck(input);

        expect(result.items.length, 5); // 1 system view + 1 security view + 3 pages
        expect(result.items[0], isA<SystemViewItem>());
        expect(result.items[1], isA<SecurityViewItem>());
        expect((result.items[2] as DashboardPageItem).id, _uuid1);
        expect((result.items[3] as DashboardPageItem).id, _uuid2);
        expect((result.items[4] as DashboardPageItem).id, _uuid3);
      });
    });

    group('start index', () {
      test('should start on system view for homeMode=auto', () {
        final display = createTestDisplay(
          spaceId: _roomUuid,
          homeMode: HomeMode.autoSpace,
        );
        final space = createMockSpace(
          id: _roomUuid,
          type: SpacesModuleDataSpaceType.room,
        );
        final pages = [
          TestPageView(id: _uuid1, title: 'Page 1'),
        ];
        final input = DeckBuildInput(display: display, space: space, pages: pages);

        final result = buildDeck(input);

        expect(result.startIndex, 0);
        expect(result.didFallback, false);
        expect(result.startItem, isA<SystemViewItem>());
      });

      test('should start on explicit page for homeMode=explicit', () {
        final display = createTestDisplay(
          spaceId: _roomUuid,
          homeMode: HomeMode.explicit,
          homePageId: _uuid2,
        );
        final space = createMockSpace(
          id: _roomUuid,
          type: SpacesModuleDataSpaceType.room,
        );
        final pages = [
          TestPageView(id: _uuid1, title: 'Page 1', order: 1),
          TestPageView(id: _uuid2, title: 'Page 2', order: 2),
        ];
        final input = DeckBuildInput(display: display, space: space, pages: pages);

        final result = buildDeck(input);

        expect(result.startIndex, 3); // Index 0 = system view, 1 = security, 2 = page-1, 3 = page-2
        expect(result.didFallback, false);
        expect((result.startItem as DashboardPageItem).id, _uuid2);
      });

      test('should fallback to system view when explicit page not found', () {
        final display = createTestDisplay(
          spaceId: _roomUuid,
          homeMode: HomeMode.explicit,
          homePageId: 'nonexistent-page',
        );
        final space = createMockSpace(
          id: _roomUuid,
          type: SpacesModuleDataSpaceType.room,
        );
        final pages = [
          TestPageView(id: _uuid1, title: 'Page 1'),
        ];
        final input = DeckBuildInput(display: display, space: space, pages: pages);

        final result = buildDeck(input);

        expect(result.startIndex, 0);
        expect(result.didFallback, true);
        expect(result.warningMessage, contains('nonexistent-page'));
        expect(result.startItem, isA<SystemViewItem>());
      });

      test('should fallback when explicit mode but no homePageId', () {
        final display = createTestDisplay(
          spaceId: _roomUuid,
          homeMode: HomeMode.explicit,
          homePageId: null,
        );
        final space = createMockSpace(
          id: _roomUuid,
          type: SpacesModuleDataSpaceType.room,
        );
        final pages = [
          TestPageView(id: _uuid1, title: 'Page 1'),
        ];
        final input = DeckBuildInput(display: display, space: space, pages: pages);

        final result = buildDeck(input);

        expect(result.startIndex, 0);
        expect(result.didFallback, true);
        expect(result.warningMessage, contains('Explicit home mode'));
      });

      test('should use resolvedHomePageId when homePageId is null', () {
        final display = createTestDisplay(
          spaceId: _roomUuid,
          homeMode: HomeMode.explicit,
          homePageId: null,
          resolvedHomePageId: _uuid1,
        );
        final space = createMockSpace(
          id: _roomUuid,
          type: SpacesModuleDataSpaceType.room,
        );
        final pages = [
          TestPageView(id: _uuid1, title: 'Page 1', order: 1),
          TestPageView(id: _uuid2, title: 'Page 2', order: 2),
        ];
        final input = DeckBuildInput(display: display, space: space, pages: pages);

        final result = buildDeck(input);

        expect(result.startIndex, 2); // page-1 is at index 2 (after system + security)
        expect(result.didFallback, false);
      });
    });

    group('system view ID generation', () {
      test('should generate unique ID for room view with space', () {
        final id = SystemViewItem.generateId(SystemViewType.room, 'space-123');
        expect(id, 'system-view-room-space-123');
      });

      test('should generate ID without space for master view', () {
        final id = SystemViewItem.generateId(SystemViewType.master);
        expect(id, 'system-view-master');
      });
    });
  });

  group('DeckResult', () {
    test('isEmpty should return true for empty deck', () {
      final result = DeckResult(items: [], startIndex: 0);
      expect(result.isEmpty, true);
      expect(result.isNotEmpty, false);
    });

    test('startItem should return null for empty deck', () {
      final result = DeckResult(items: [], startIndex: 0);
      expect(result.startItem, isNull);
    });

    test('dashboardPages should return only page items', () {
      final display = createTestDisplay(spaceId: _roomUuid);
      final space = createMockSpace(
        id: _roomUuid,
        type: SpacesModuleDataSpaceType.room,
      );
      final pages = [
        TestPageView(id: _uuid1, title: 'Page 1'),
        TestPageView(id: _uuid2, title: 'Page 2'),
      ];
      final input = DeckBuildInput(display: display, space: space, pages: pages);
      final deck = buildDeck(input);

      final dashboardPages = deck.dashboardPages;

      expect(dashboardPages.length, 2);
      expect(dashboardPages[0].id, _uuid1);
      expect(dashboardPages[1].id, _uuid2);
    });

    test('systemView should return first item when it is SystemViewItem', () {
      final display = createTestDisplay(spaceId: _roomUuid);
      final space = createMockSpace(
        id: _roomUuid,
        type: SpacesModuleDataSpaceType.room,
      );
      final input = DeckBuildInput(display: display, space: space, pages: []);
      final deck = buildDeck(input);

      expect(deck.systemView, isNotNull);
      expect(deck.systemView!.viewType, SystemViewType.room);
    });

    test('domainViews should return only DomainViewItem items', () {
      final display = createTestDisplay(spaceId: _roomUuid);
      final space = createMockSpace(
        id: _roomUuid,
        type: SpacesModuleDataSpaceType.room,
      );
      final pages = [
        TestPageView(id: _uuid1, title: 'Page 1'),
      ];
      final input = DeckBuildInput(
        display: display,
        space: space,
        pages: pages,
        deviceCategories: [
          DevicesModuleDeviceCategory.lighting,
          DevicesModuleDeviceCategory.thermostat,
          DevicesModuleDeviceCategory.television,
        ],
      );
      final deck = buildDeck(input);

      final domainViews = deck.domainViews;

      expect(domainViews.length, 3);
      expect(domainViews[0].domainType, DomainType.lights);
      expect(domainViews[1].domainType, DomainType.climate);
      expect(domainViews[2].domainType, DomainType.media);
    });

    test('domainViews should return empty list when no domain views', () {
      final display = createTestDisplay(spaceId: _masterUuid);
      final space = createMockSpace(
        id: _masterUuid,
        type: SpacesModuleDataSpaceType.master,
      );
      final input = DeckBuildInput(display: display, space: space, pages: []);
      final deck = buildDeck(input);

      expect(deck.domainViews, isEmpty);
    });
  });

  group('DomainViewItem', () {
    test('generateId should create unique ID', () {
      final id = DomainViewItem.generateId(DomainType.lights, 'room-1');
      expect(id, 'domain-lights-room-1');
    });

    test('generateId should work for all domain types', () {
      expect(
        DomainViewItem.generateId(DomainType.climate, 'r1'),
        'domain-climate-r1',
      );
      expect(
        DomainViewItem.generateId(DomainType.media, 'r1'),
        'domain-media-r1',
      );
      expect(
        DomainViewItem.generateId(DomainType.sensors, 'r1'),
        'domain-sensors-r1',
      );
      expect(
        DomainViewItem.generateId(DomainType.energy, 'r1'),
        'domain-energy-r1',
      );
    });
  });
}
