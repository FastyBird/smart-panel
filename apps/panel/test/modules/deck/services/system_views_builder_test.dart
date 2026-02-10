import 'package:fastybird_smart_panel/modules/deck/models/deck_item.dart';
import 'package:fastybird_smart_panel/modules/deck/services/system_views_builder.dart';
import 'package:fastybird_smart_panel/modules/deck/types/domain_type.dart';
import 'package:fastybird_smart_panel/modules/deck/types/system_view_type.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_device_category.dart';
import 'package:fastybird_smart_panel/modules/displays/models/display.dart';
import 'package:flutter_test/flutter_test.dart';

// Helper to create a display with minimum required fields
DisplayModel createDisplay({
  DisplayRole role = DisplayRole.room,
  String? roomId,
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
    role: role,
    roomId: roomId,
    createdAt: DateTime(2024, 1, 1),
  );
}

void main() {
  group('buildSystemViews', () {
    group('ROOM role', () {
      test('should return empty result when roomId is null', () {
        final display = createDisplay(role: DisplayRole.room, roomId: null);

        final result = buildSystemViews(SystemViewsBuildInput(
          display: display,
          deviceCategories: [DevicesModuleDeviceCategory.lighting],
        ));

        expect(result.items, isEmpty);
        expect(result.indexByViewKey, isEmpty);
        expect(result.domainCounts, isNull);
      });

      test('should return empty result when roomId is empty', () {
        final display = createDisplay(role: DisplayRole.room, roomId: '');

        final result = buildSystemViews(SystemViewsBuildInput(
          display: display,
          deviceCategories: [DevicesModuleDeviceCategory.lighting],
        ));

        expect(result.items, isEmpty);
        expect(result.indexByViewKey, isEmpty);
        expect(result.domainCounts, isNull);
      });

      test('should create room overview as first item', () {
        final display = createDisplay(role: DisplayRole.room, roomId: 'room-1');

        final result = buildSystemViews(SystemViewsBuildInput(
          display: display,
          deviceCategories: [DevicesModuleDeviceCategory.lighting],
          roomViewTitle: 'Living Room',
        ));

        expect(result.items.isNotEmpty, true);
        expect(result.items[0], isA<SystemViewItem>());

        final roomOverview = result.items[0] as SystemViewItem;
        expect(roomOverview.viewType, SystemViewType.room);
        expect(roomOverview.roomId, 'room-1');
        expect(roomOverview.title, 'Living Room');
      });

      test('should register room overview in indexByViewKey', () {
        final display = createDisplay(role: DisplayRole.room, roomId: 'room-1');

        final result = buildSystemViews(SystemViewsBuildInput(
          display: display,
          deviceCategories: [],
        ));

        expect(result.indexByViewKey['room-overview:room-1'], 0);
      });

      test('should create domain views for present domains', () {
        final display = createDisplay(role: DisplayRole.room, roomId: 'room-1');

        final result = buildSystemViews(SystemViewsBuildInput(
          display: display,
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
        expect(lightsView.roomId, 'room-1');

        // Third item is climate domain (displayOrder 1)
        expect(result.items[2], isA<DomainViewItem>());
        final climateView = result.items[2] as DomainViewItem;
        expect(climateView.domainType, DomainType.climate);
        expect(climateView.title, 'Climate');
        expect(climateView.deviceCount, 1);
      });

      test('should register domain views in indexByViewKey', () {
        final display = createDisplay(role: DisplayRole.room, roomId: 'room-1');

        final result = buildSystemViews(SystemViewsBuildInput(
          display: display,
          deviceCategories: [
            DevicesModuleDeviceCategory.lighting,
            DevicesModuleDeviceCategory.television,
            DevicesModuleDeviceCategory.sensor,
          ],
        ));

        expect(result.indexByViewKey['room-overview:room-1'], 0);
        expect(result.indexByViewKey['domain:room-1:lights'], 1);
        expect(result.indexByViewKey['domain:room-1:media'], 2);
        expect(result.indexByViewKey['domain:room-1:sensors'], 3);
      });

      test('should not create domain view for domains with zero count', () {
        final display = createDisplay(role: DisplayRole.room, roomId: 'room-1');

        final result = buildSystemViews(SystemViewsBuildInput(
          display: display,
          deviceCategories: [DevicesModuleDeviceCategory.lighting],
        ));

        // Room overview + 1 domain view (lights only)
        expect(result.items.length, 2);
        expect(result.items[1], isA<DomainViewItem>());
        final lightsView = result.items[1] as DomainViewItem;
        expect(lightsView.domainType, DomainType.lights);

        // No climate, media, or sensors
        expect(result.indexByViewKey.containsKey('domain:room-1:climate'), false);
        expect(result.indexByViewKey.containsKey('domain:room-1:media'), false);
        expect(result.indexByViewKey.containsKey('domain:room-1:sensors'), false);
      });

      test('should return domainCounts for ROOM role', () {
        final display = createDisplay(role: DisplayRole.room, roomId: 'room-1');

        final result = buildSystemViews(SystemViewsBuildInput(
          display: display,
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
        final display = createDisplay(role: DisplayRole.room, roomId: 'room-1');

        final result = buildSystemViews(SystemViewsBuildInput(
          display: display,
          deviceCategories: [
            DevicesModuleDeviceCategory.sensor, // sensors = displayOrder 3
            DevicesModuleDeviceCategory.thermostat, // climate = displayOrder 1
            DevicesModuleDeviceCategory.lighting, // lights = displayOrder 0
            DevicesModuleDeviceCategory.television, // media = displayOrder 2
          ],
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
        final display = createDisplay(role: DisplayRole.room, roomId: 'room-1');

        final result = buildSystemViews(SystemViewsBuildInput(
          display: display,
          deviceCategories: [],
        ));

        // Only room overview, no domain views
        expect(result.items.length, 1);
        expect(result.items[0], isA<SystemViewItem>());
        expect(result.domainCounts!.hasAnyDomain, false);
      });

      test('should ignore unclassified device categories', () {
        final display = createDisplay(role: DisplayRole.room, roomId: 'room-1');

        final result = buildSystemViews(SystemViewsBuildInput(
          display: display,
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

    group('MASTER role', () {
      test('should create master overview only', () {
        final display = createDisplay(role: DisplayRole.master);

        final result = buildSystemViews(SystemViewsBuildInput(
          display: display,
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
        final display = createDisplay(role: DisplayRole.master);

        final result = buildSystemViews(SystemViewsBuildInput(display: display));

        expect(result.indexByViewKey['master-overview'], 0);
      });

      test('should not return domainCounts for MASTER role', () {
        final display = createDisplay(role: DisplayRole.master);

        final result = buildSystemViews(SystemViewsBuildInput(
          display: display,
          deviceCategories: [DevicesModuleDeviceCategory.lighting],
        ));

        expect(result.domainCounts, isNull);
      });

      test('should ignore deviceCategories for MASTER role', () {
        final display = createDisplay(role: DisplayRole.master);

        final result = buildSystemViews(SystemViewsBuildInput(
          display: display,
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

    group('ENTRY role', () {
      test('should create entry overview only', () {
        final display = createDisplay(role: DisplayRole.entry);

        final result = buildSystemViews(SystemViewsBuildInput(
          display: display,
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
        final display = createDisplay(role: DisplayRole.entry);

        final result = buildSystemViews(SystemViewsBuildInput(display: display));

        expect(result.indexByViewKey['entry-overview'], 0);
      });

      test('should not return domainCounts for ENTRY role', () {
        final display = createDisplay(role: DisplayRole.entry);

        final result = buildSystemViews(SystemViewsBuildInput(
          display: display,
          deviceCategories: [DevicesModuleDeviceCategory.lighting],
        ));

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
  });
}
