import 'package:fastybird_smart_panel/modules/dashboard/models/pages/page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/view.dart';
import 'package:fastybird_smart_panel/modules/deck/models/deck_item.dart';
import 'package:fastybird_smart_panel/modules/deck/models/deck_result.dart';
import 'package:fastybird_smart_panel/modules/deck/services/deck_builder.dart';
import 'package:fastybird_smart_panel/modules/deck/types/system_view_type.dart';
import 'package:fastybird_smart_panel/modules/displays/models/display.dart';
import 'package:flutter_test/flutter_test.dart';

// Simple test page model for testing
class TestPageModel extends PageModel {
  TestPageModel({
    required String id,
    required String title,
    int order = 0,
  }) : super(
          id: id,
          type: PageType.tiles,
          title: title,
          order: order,
        );
}

// Simple test page view for testing
class TestPageView extends DashboardPageView<TestPageModel> {
  TestPageView({
    required String id,
    required String title,
    int order = 0,
  }) : super(
          pageModel: TestPageModel(
            id: id,
            title: title,
            order: order,
          ),
        );
}

DisplayModel createTestDisplay({
  String id = 'test-display-id',
  DisplayRole role = DisplayRole.room,
  String? roomId,
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
    role: role,
    roomId: roomId,
    homeMode: homeMode,
    homePageId: homePageId,
    resolvedHomePageId: resolvedHomePageId,
    createdAt: DateTime.now(),
  );
}

void main() {
  group('buildDeck', () {
    group('system view generation', () {
      test('should create room system view for room role', () {
        final display = createTestDisplay(
          role: DisplayRole.room,
          roomId: 'space-123',
        );
        final input = DeckBuildInput(
          display: display,
          pages: [],
          roomViewTitle: 'Room Overview',
        );

        final result = buildDeck(input);

        expect(result.items.length, 1);
        expect(result.items.first, isA<SystemViewItem>());
        final systemView = result.items.first as SystemViewItem;
        expect(systemView.viewType, SystemViewType.room);
        expect(systemView.roomId, 'space-123');
        expect(systemView.title, 'Room Overview');
      });

      test('should create master system view for master role', () {
        final display = createTestDisplay(role: DisplayRole.master);
        final input = DeckBuildInput(
          display: display,
          pages: [],
          masterViewTitle: 'Home Overview',
        );

        final result = buildDeck(input);

        expect(result.items.length, 1);
        final systemView = result.items.first as SystemViewItem;
        expect(systemView.viewType, SystemViewType.master);
        expect(systemView.title, 'Home Overview');
      });

      test('should create entry system view for entry role', () {
        final display = createTestDisplay(role: DisplayRole.entry);
        final input = DeckBuildInput(
          display: display,
          pages: [],
          entryViewTitle: 'Entry',
        );

        final result = buildDeck(input);

        expect(result.items.length, 1);
        final systemView = result.items.first as SystemViewItem;
        expect(systemView.viewType, SystemViewType.entry);
        expect(systemView.title, 'Entry');
      });
    });

    group('page ordering', () {
      test('should sort pages by order', () {
        final display = createTestDisplay(role: DisplayRole.room);
        final pages = [
          TestPageView(id: 'page-3', title: 'Page 3', order: 3),
          TestPageView(id: 'page-1', title: 'Page 1', order: 1),
          TestPageView(id: 'page-2', title: 'Page 2', order: 2),
        ];
        final input = DeckBuildInput(display: display, pages: pages);

        final result = buildDeck(input);

        expect(result.items.length, 4); // 1 system view + 3 pages
        expect(result.items[0], isA<SystemViewItem>());
        expect((result.items[1] as DashboardPageItem).id, 'page-1');
        expect((result.items[2] as DashboardPageItem).id, 'page-2');
        expect((result.items[3] as DashboardPageItem).id, 'page-3');
      });
    });

    group('start index', () {
      test('should start on system view for homeMode=auto', () {
        final display = createTestDisplay(
          role: DisplayRole.room,
          homeMode: HomeMode.autoSpace,
        );
        final pages = [
          TestPageView(id: 'page-1', title: 'Page 1'),
        ];
        final input = DeckBuildInput(display: display, pages: pages);

        final result = buildDeck(input);

        expect(result.startIndex, 0);
        expect(result.didFallback, false);
        expect(result.startItem, isA<SystemViewItem>());
      });

      test('should start on explicit page for homeMode=explicit', () {
        final display = createTestDisplay(
          role: DisplayRole.room,
          homeMode: HomeMode.explicit,
          homePageId: 'page-2',
        );
        final pages = [
          TestPageView(id: 'page-1', title: 'Page 1', order: 1),
          TestPageView(id: 'page-2', title: 'Page 2', order: 2),
        ];
        final input = DeckBuildInput(display: display, pages: pages);

        final result = buildDeck(input);

        expect(result.startIndex, 2); // Index 0 = system view, 1 = page-1, 2 = page-2
        expect(result.didFallback, false);
        expect((result.startItem as DashboardPageItem).id, 'page-2');
      });

      test('should fallback to system view when explicit page not found', () {
        final display = createTestDisplay(
          role: DisplayRole.room,
          homeMode: HomeMode.explicit,
          homePageId: 'nonexistent-page',
        );
        final pages = [
          TestPageView(id: 'page-1', title: 'Page 1'),
        ];
        final input = DeckBuildInput(display: display, pages: pages);

        final result = buildDeck(input);

        expect(result.startIndex, 0);
        expect(result.didFallback, true);
        expect(result.warningMessage, contains('nonexistent-page'));
        expect(result.startItem, isA<SystemViewItem>());
      });

      test('should fallback when explicit mode but no homePageId', () {
        final display = createTestDisplay(
          role: DisplayRole.room,
          homeMode: HomeMode.explicit,
          homePageId: null,
        );
        final pages = [
          TestPageView(id: 'page-1', title: 'Page 1'),
        ];
        final input = DeckBuildInput(display: display, pages: pages);

        final result = buildDeck(input);

        expect(result.startIndex, 0);
        expect(result.didFallback, true);
        expect(result.warningMessage, contains('Explicit home mode'));
      });

      test('should use resolvedHomePageId when homePageId is null', () {
        final display = createTestDisplay(
          role: DisplayRole.room,
          homeMode: HomeMode.explicit,
          homePageId: null,
          resolvedHomePageId: 'page-1',
        );
        final pages = [
          TestPageView(id: 'page-1', title: 'Page 1', order: 1),
          TestPageView(id: 'page-2', title: 'Page 2', order: 2),
        ];
        final input = DeckBuildInput(display: display, pages: pages);

        final result = buildDeck(input);

        expect(result.startIndex, 1); // page-1 is at index 1
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

  group('validateDisplayConfig', () {
    test('should return error for room role without spaceId', () {
      final display = createTestDisplay(
        role: DisplayRole.room,
        roomId: null,
      );

      final error = validateDisplayConfig(display);

      expect(error, isNotNull);
      expect(error, contains('Room display requires'));
    });

    test('should return null for room role with spaceId', () {
      final display = createTestDisplay(
        role: DisplayRole.room,
        roomId: 'space-123',
      );

      final error = validateDisplayConfig(display);

      expect(error, isNull);
    });

    test('should return null for master role', () {
      final display = createTestDisplay(
        role: DisplayRole.master,
        roomId: null,
      );

      final error = validateDisplayConfig(display);

      expect(error, isNull);
    });

    test('should return null for entry role', () {
      final display = createTestDisplay(
        role: DisplayRole.entry,
        roomId: null,
      );

      final error = validateDisplayConfig(display);

      expect(error, isNull);
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
      final display = createTestDisplay(role: DisplayRole.room);
      final pages = [
        TestPageView(id: 'page-1', title: 'Page 1'),
        TestPageView(id: 'page-2', title: 'Page 2'),
      ];
      final input = DeckBuildInput(display: display, pages: pages);
      final deck = buildDeck(input);

      final dashboardPages = deck.dashboardPages;

      expect(dashboardPages.length, 2);
      expect(dashboardPages[0].id, 'page-1');
      expect(dashboardPages[1].id, 'page-2');
    });

    test('systemView should return first item when it is SystemViewItem', () {
      final display = createTestDisplay(role: DisplayRole.room);
      final input = DeckBuildInput(display: display, pages: []);
      final deck = buildDeck(input);

      expect(deck.systemView, isNotNull);
      expect(deck.systemView!.viewType, SystemViewType.room);
    });
  });
}
