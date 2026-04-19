import 'package:fastybird_smart_panel/api/models/devices_module_device_category.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_data_space_type.dart';
import 'package:fastybird_smart_panel/modules/deck/models/deck_item.dart';
import 'package:fastybird_smart_panel/modules/deck/services/system_views_builder.dart';
import 'package:fastybird_smart_panel/modules/deck/types/domain_type.dart';
import 'package:fastybird_smart_panel/modules/deck/types/system_view_type.dart';
import 'package:fastybird_smart_panel/modules/displays/models/display.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/spaces/space.dart';
import 'package:fastybird_smart_panel/modules/spaces/views/spaces/view.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/services/space_view_builders.dart';
import 'package:fastybird_smart_panel/plugins/spaces-signage-info-panel/services/space_view_builder.dart';
import 'package:fastybird_smart_panel/plugins/spaces-synthetic-entry/services/space_view_builder.dart';
import 'package:fastybird_smart_panel/plugins/spaces-synthetic-master/services/space_view_builder.dart';
import 'package:flutter_test/flutter_test.dart';

// Valid UUIDs for testing (v4 format with variant bits)
const _roomUuid = 'a0000000-0000-4000-8000-000000000001';
const _masterUuid = 'a0000000-0000-4000-8000-000000000002';
const _entryUuid = 'a0000000-0000-4000-8000-000000000003';

// Helper to create a display with minimum required fields
DisplayModel createDisplay({
  String? spaceId,
}) {
  return DisplayModel(
    id: 'display-1',
    macAddress: '00:11:22:33:44:55',
    version: '1.0.0',
    screenWidth: 800,
    screenHeight: 480,
    pixelRatio: 1.0,
    unitSize: 10.0,
    rows: 4,
    cols: 6,
    darkMode: false,
    brightness: 80,
    screenLockDuration: 60,
    screenSaver: true,
    audioOutputSupported: true,
    audioInputSupported: true,
    speaker: true,
    speakerVolume: 50,
    microphone: true,
    microphoneVolume: 50,
    spaceId: spaceId,
    createdAt: DateTime(2024, 1, 1),
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
  group('buildSystemViews', () {
    setUp(() {
      spaceViewBuilders[SpacesModuleDataSpaceType.room] = RoomSpaceViewBuilder();
      spaceViewBuilders[SpacesModuleDataSpaceType.zone] = ZoneSpaceViewBuilder();
      spaceViewBuilders[SpacesModuleDataSpaceType.master] = MasterSpaceViewBuilder();
      spaceViewBuilders[SpacesModuleDataSpaceType.entry] = EntrySpaceViewBuilder();
      spaceViewBuilders[SpacesModuleDataSpaceType.signageInfoPanel] =
          SignageInfoPanelSpaceViewBuilder();
    });

    tearDown(() {
      spaceViewBuilders.clear();
    });

    group('no space assignment', () {
      test('should return empty result when space is null', () {
        final display = createDisplay(spaceId: null);

        final result = buildSystemViews(SystemViewsBuildInput(
          display: display,
          space: null,
          deviceCategories: [DevicesModuleDeviceCategory.lighting],
        ));

        expect(result.items, isEmpty);
        expect(result.indexByViewKey, isEmpty);
        expect(result.domainCounts, isNull);
      });

      test('should return empty result when no builder registered for space type', () {
        // Remove the room builder so nothing matches
        spaceViewBuilders.remove(SpacesModuleDataSpaceType.room);

        final display = createDisplay(spaceId: _roomUuid);
        final space = createMockSpace(
          id: _roomUuid,
          type: SpacesModuleDataSpaceType.room,
        );

        final result = buildSystemViews(SystemViewsBuildInput(
          display: display,
          space: space,
          deviceCategories: [DevicesModuleDeviceCategory.lighting],
        ));

        expect(result.items, isEmpty);
        expect(result.indexByViewKey, isEmpty);
        expect(result.domainCounts, isNull);
      });
    });

    group('ROOM space type', () {
      test('should create room overview as first item', () {
        final display = createDisplay(spaceId: _roomUuid);
        final space = createMockSpace(
          id: _roomUuid,
          type: SpacesModuleDataSpaceType.room,
        );

        final result = buildSystemViews(SystemViewsBuildInput(
          display: display,
          space: space,
          deviceCategories: [DevicesModuleDeviceCategory.lighting],
          roomViewTitle: 'Living Room',
        ));

        expect(result.items.isNotEmpty, true);
        expect(result.items[0], isA<SystemViewItem>());

        final roomOverview = result.items[0] as SystemViewItem;
        expect(roomOverview.viewType, SystemViewType.room);
        expect(roomOverview.roomId, _roomUuid);
        expect(roomOverview.title, 'Living Room');
      });

      test('should register room overview in indexByViewKey', () {
        final display = createDisplay(spaceId: _roomUuid);
        final space = createMockSpace(
          id: _roomUuid,
          type: SpacesModuleDataSpaceType.room,
        );

        final result = buildSystemViews(SystemViewsBuildInput(
          display: display,
          space: space,
          deviceCategories: [],
        ));

        expect(result.indexByViewKey['room-overview:$_roomUuid'], 0);
      });

      test('should create domain views for present domains', () {
        final display = createDisplay(spaceId: _roomUuid);
        final space = createMockSpace(
          id: _roomUuid,
          type: SpacesModuleDataSpaceType.room,
        );

        final result = buildSystemViews(SystemViewsBuildInput(
          display: display,
          space: space,
          deviceCategories: [
            DevicesModuleDeviceCategory.lighting,
            DevicesModuleDeviceCategory.thermostat,
          ],
          lightsViewTitle: 'Lights',
          climateViewTitle: 'Climate',
        ));

        // Room overview + 2 domain views
        expect(result.items.length, 3);

        // First item is room overview
        expect(result.items[0], isA<SystemViewItem>());

        // Second item is lights domain (displayOrder 0)
        expect(result.items[1], isA<DomainViewItem>());
        final lightsView = result.items[1] as DomainViewItem;
        expect(lightsView.domainType, DomainType.lights);
        expect(lightsView.title, 'Lights');
        expect(lightsView.deviceCount, 1);
        expect(lightsView.roomId, _roomUuid);

        // Third item is climate domain (displayOrder 1)
        expect(result.items[2], isA<DomainViewItem>());
        final climateView = result.items[2] as DomainViewItem;
        expect(climateView.domainType, DomainType.climate);
        expect(climateView.title, 'Climate');
        expect(climateView.deviceCount, 1);
      });

      test('should register domain views in indexByViewKey', () {
        final display = createDisplay(spaceId: _roomUuid);
        final space = createMockSpace(
          id: _roomUuid,
          type: SpacesModuleDataSpaceType.room,
        );

        final result = buildSystemViews(SystemViewsBuildInput(
          display: display,
          space: space,
          deviceCategories: [
            DevicesModuleDeviceCategory.lighting,
            DevicesModuleDeviceCategory.television,
            DevicesModuleDeviceCategory.sensor,
          ],
          sensorReadingsCount: 1, // backend has sensor readings
        ));

        expect(result.indexByViewKey['room-overview:$_roomUuid'], 0);
        expect(result.indexByViewKey['domain:$_roomUuid:lights'], 1);
        expect(result.indexByViewKey['domain:$_roomUuid:media'], 2);
        expect(result.indexByViewKey['domain:$_roomUuid:sensors'], 3);
      });

      test('should not create domain view for domains with zero count', () {
        final display = createDisplay(spaceId: _roomUuid);
        final space = createMockSpace(
          id: _roomUuid,
          type: SpacesModuleDataSpaceType.room,
        );

        final result = buildSystemViews(SystemViewsBuildInput(
          display: display,
          space: space,
          deviceCategories: [DevicesModuleDeviceCategory.lighting],
        ));

        // Room overview + 1 domain view (lights only)
        expect(result.items.length, 2);
        expect(result.items[1], isA<DomainViewItem>());
        final lightsView = result.items[1] as DomainViewItem;
        expect(lightsView.domainType, DomainType.lights);

        // No climate, media, or sensors
        expect(result.indexByViewKey.containsKey('domain:$_roomUuid:climate'), false);
        expect(result.indexByViewKey.containsKey('domain:$_roomUuid:media'), false);
        expect(result.indexByViewKey.containsKey('domain:$_roomUuid:sensors'), false);
      });

      test('should return domainCounts for ROOM space', () {
        final display = createDisplay(spaceId: _roomUuid);
        final space = createMockSpace(
          id: _roomUuid,
          type: SpacesModuleDataSpaceType.room,
        );

        final result = buildSystemViews(SystemViewsBuildInput(
          display: display,
          space: space,
          deviceCategories: [
            DevicesModuleDeviceCategory.lighting,
            DevicesModuleDeviceCategory.lighting,
            DevicesModuleDeviceCategory.thermostat,
          ],
        ));

        expect(result.domainCounts, isNotNull);
        expect(result.domainCounts!.lights, 2);
        expect(result.domainCounts!.climate, 1);
        expect(result.domainCounts!.media, 0);
        expect(result.domainCounts!.sensors, 0);
      });

      test('should order domain views by displayOrder', () {
        final display = createDisplay(spaceId: _roomUuid);
        final space = createMockSpace(
          id: _roomUuid,
          type: SpacesModuleDataSpaceType.room,
        );

        final result = buildSystemViews(SystemViewsBuildInput(
          display: display,
          space: space,
          deviceCategories: [
            DevicesModuleDeviceCategory.sensor, // sensors = displayOrder 3
            DevicesModuleDeviceCategory.thermostat, // climate = displayOrder 1
            DevicesModuleDeviceCategory.lighting, // lights = displayOrder 0
            DevicesModuleDeviceCategory.television, // media = displayOrder 2
          ],
          energyDeviceCount: 1, // room has energy-capable devices
          sensorReadingsCount: 1, // backend has sensor readings
        ));

        // Order should be: room overview, lights, climate, media, sensors, energy
        expect(result.items.length, 6);
        expect((result.items[1] as DomainViewItem).domainType, DomainType.lights);
        expect((result.items[2] as DomainViewItem).domainType, DomainType.climate);
        expect((result.items[3] as DomainViewItem).domainType, DomainType.media);
        expect((result.items[4] as DomainViewItem).domainType, DomainType.sensors);
        expect((result.items[5] as DomainViewItem).domainType, DomainType.energy);
      });

      test('should handle empty device categories', () {
        final display = createDisplay(spaceId: _roomUuid);
        final space = createMockSpace(
          id: _roomUuid,
          type: SpacesModuleDataSpaceType.room,
        );

        final result = buildSystemViews(SystemViewsBuildInput(
          display: display,
          space: space,
          deviceCategories: [],
        ));

        // Only room overview, no domain views
        expect(result.items.length, 1);
        expect(result.items[0], isA<SystemViewItem>());
        expect(result.domainCounts!.hasAnyDomain, false);
      });

      test('should ignore unclassified device categories', () {
        final display = createDisplay(spaceId: _roomUuid);
        final space = createMockSpace(
          id: _roomUuid,
          type: SpacesModuleDataSpaceType.room,
        );

        final result = buildSystemViews(SystemViewsBuildInput(
          display: display,
          space: space,
          deviceCategories: [
            DevicesModuleDeviceCategory.outlet,
            DevicesModuleDeviceCategory.switcher,
            DevicesModuleDeviceCategory.door,
          ],
        ));

        // Only room overview, no domain views (all categories are unclassified)
        expect(result.items.length, 1);
        expect(result.domainCounts!.total, 0);
      });
    });

    group('MASTER space type', () {
      test('should create master overview only', () {
        final display = createDisplay(spaceId: _masterUuid);
        final space = createMockSpace(
          id: _masterUuid,
          type: SpacesModuleDataSpaceType.master,
        );

        final result = buildSystemViews(SystemViewsBuildInput(
          display: display,
          space: space,
          masterViewTitle: 'Home',
        ));

        expect(result.items.length, 1);
        expect(result.items[0], isA<SystemViewItem>());

        final masterOverview = result.items[0] as SystemViewItem;
        expect(masterOverview.viewType, SystemViewType.master);
        expect(masterOverview.roomId, isNull);
        expect(masterOverview.title, 'Home');
      });

      test('should register master overview in indexByViewKey', () {
        final display = createDisplay(spaceId: _masterUuid);
        final space = createMockSpace(
          id: _masterUuid,
          type: SpacesModuleDataSpaceType.master,
        );

        final result = buildSystemViews(SystemViewsBuildInput(
          display: display,
          space: space,
        ));

        expect(result.indexByViewKey['master-overview'], 0);
      });

      test('should not return domainCounts for MASTER space', () {
        final display = createDisplay(spaceId: _masterUuid);
        final space = createMockSpace(
          id: _masterUuid,
          type: SpacesModuleDataSpaceType.master,
        );

        final result = buildSystemViews(SystemViewsBuildInput(
          display: display,
          space: space,
          deviceCategories: [DevicesModuleDeviceCategory.lighting],
        ));

        expect(result.domainCounts, isNull);
      });

      test('should ignore deviceCategories for MASTER space', () {
        final display = createDisplay(spaceId: _masterUuid);
        final space = createMockSpace(
          id: _masterUuid,
          type: SpacesModuleDataSpaceType.master,
        );

        final result = buildSystemViews(SystemViewsBuildInput(
          display: display,
          space: space,
          deviceCategories: [
            DevicesModuleDeviceCategory.lighting,
            DevicesModuleDeviceCategory.thermostat,
          ],
        ));

        // Only master overview, no domain views
        expect(result.items.length, 1);
        expect(result.items[0], isA<SystemViewItem>());
      });
    });

    group('ENTRY space type', () {
      test('should create entry overview only', () {
        final display = createDisplay(spaceId: _entryUuid);
        final space = createMockSpace(
          id: _entryUuid,
          type: SpacesModuleDataSpaceType.entry,
        );

        final result = buildSystemViews(SystemViewsBuildInput(
          display: display,
          space: space,
          entryViewTitle: 'Entry',
        ));

        expect(result.items.length, 1);
        expect(result.items[0], isA<SystemViewItem>());

        final entryOverview = result.items[0] as SystemViewItem;
        expect(entryOverview.viewType, SystemViewType.entry);
        expect(entryOverview.roomId, isNull);
        expect(entryOverview.title, 'Entry');
      });

      test('should register entry overview in indexByViewKey', () {
        final display = createDisplay(spaceId: _entryUuid);
        final space = createMockSpace(
          id: _entryUuid,
          type: SpacesModuleDataSpaceType.entry,
        );

        final result = buildSystemViews(SystemViewsBuildInput(
          display: display,
          space: space,
        ));

        expect(result.indexByViewKey['entry-overview'], 0);
      });

      test('should not return domainCounts for ENTRY space', () {
        final display = createDisplay(spaceId: _entryUuid);
        final space = createMockSpace(
          id: _entryUuid,
          type: SpacesModuleDataSpaceType.entry,
        );

        final result = buildSystemViews(SystemViewsBuildInput(
          display: display,
          space: space,
          deviceCategories: [DevicesModuleDeviceCategory.lighting],
        ));

        expect(result.domainCounts, isNull);
      });
    });

    group('ZONE space type', () {
      test('should return empty result for zone space', () {
        final display = createDisplay(spaceId: _roomUuid);
        final space = createMockSpace(
          id: _roomUuid,
          type: SpacesModuleDataSpaceType.zone,
        );

        final result = buildSystemViews(SystemViewsBuildInput(
          display: display,
          space: space,
          deviceCategories: [DevicesModuleDeviceCategory.lighting],
        ));

        expect(result.items, isEmpty);
        expect(result.indexByViewKey, isEmpty);
        expect(result.domainCounts, isNull);
      });
    });

    group('SIGNAGE_INFO_PANEL space type', () {
      const _signageUuid = 'a0000000-0000-4000-8000-000000000050';

      test('should create signage overview only', () {
        final display = createDisplay(spaceId: _signageUuid);
        final space = createMockSpace(
          id: _signageUuid,
          type: SpacesModuleDataSpaceType.signageInfoPanel,
        );

        final result = buildSystemViews(SystemViewsBuildInput(
          display: display,
          space: space,
        ));

        expect(result.items.length, 1);
        expect(result.items[0], isA<SystemViewItem>());

        final signageOverview = result.items[0] as SystemViewItem;
        expect(signageOverview.viewType, SystemViewType.signageInfoPanel);
        expect(signageOverview.roomId, _signageUuid);
        expect(result.domainCounts, isNull);
      });

      test('should register signage overview in indexByViewKey', () {
        final display = createDisplay(spaceId: _signageUuid);
        final space = createMockSpace(
          id: _signageUuid,
          type: SpacesModuleDataSpaceType.signageInfoPanel,
        );

        final result = buildSystemViews(SystemViewsBuildInput(
          display: display,
          space: space,
        ));

        expect(
          result.indexByViewKey['signage-info-panel:$_signageUuid'],
          0,
        );
      });

      test('should return empty when builder is not registered', () {
        spaceViewBuilders.remove(SpacesModuleDataSpaceType.signageInfoPanel);

        final display = createDisplay(spaceId: _signageUuid);
        final space = createMockSpace(
          id: _signageUuid,
          type: SpacesModuleDataSpaceType.signageInfoPanel,
        );

        final result = buildSystemViews(SystemViewsBuildInput(
          display: display,
          space: space,
        ));

        expect(result.items, isEmpty);
        expect(result.indexByViewKey, isEmpty);
        expect(result.domainCounts, isNull);
      });
    });
  });

  group('SystemViewsBuildInput', () {
    test('should have default values for titles', () {
      final display = createDisplay();

      final input = SystemViewsBuildInput(display: display);

      expect(input.roomViewTitle, 'Room');
      expect(input.masterViewTitle, 'Home');
      expect(input.entryViewTitle, 'Entry');
      expect(input.lightsViewTitle, 'Lights');
      expect(input.climateViewTitle, 'Climate');
      expect(input.mediaViewTitle, 'Media');
      expect(input.sensorsViewTitle, 'Sensors');
    });

    test('should have empty deviceCategories by default', () {
      final display = createDisplay();

      final input = SystemViewsBuildInput(display: display);

      expect(input.deviceCategories, isEmpty);
    });

    test('should have null space by default', () {
      final display = createDisplay();

      final input = SystemViewsBuildInput(display: display);

      expect(input.space, isNull);
    });
  });

  group('SystemViewsResult', () {
    test('should contain items and indexByViewKey', () {
      const result = SystemViewsResult(
        items: [],
        indexByViewKey: {},
        domainCounts: null,
      );

      expect(result.items, isEmpty);
      expect(result.indexByViewKey, isEmpty);
      expect(result.domainCounts, isNull);
    });

    test('empty constant should be an empty result', () {
      const result = SystemViewsResult.empty;

      expect(result.items, isEmpty);
      expect(result.indexByViewKey, isEmpty);
      expect(result.domainCounts, isNull);
    });
  });
}
