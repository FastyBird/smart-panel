import 'package:event_bus/event_bus.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_data_covers_target_role.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/widgets/toast.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/models/deck_item.dart';
import 'package:fastybird_smart_panel/modules/deck/services/bottom_nav_mode_notifier.dart';
import 'package:fastybird_smart_panel/modules/deck/types/deck_page_activated_event.dart';
import 'package:fastybird_smart_panel/modules/deck/types/domain_type.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/models/covers_state/covers_state.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/models/covers_targets/covers_target.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/models/intent_result/intent_result.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/presentation/domain_pages/grouped_covers_room_controls.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/presentation/domain_pages/shading_domain_view.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/services/spaces_service.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/views/covers_targets/view.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:provider/provider.dart';

class MockShadingSpaces extends Mock implements SpacesService {}

class MockShadingDevices extends Mock implements DevicesService {}

const roomId = '00000000-0000-4000-8000-000000000001';
const item = DomainViewItem(
  id: 'shading',
  domainType: DomainType.shading,
  roomId: roomId,
  title: 'Shading',
  deviceCount: 1,
);
CoversStateModel state({required bool grouped}) => CoversStateModel.fromJson({
  'has_covers': true,
  'devices_count': 1,
  'average_position': 100,
  'detected_mode': 'open',
  'is_mode_from_intent': true,
  'mode_confidence': 'exact',
  'covers_by_role': {'primary': 1},
  'roles': {
    'primary': {'position': 100, 'devices_count': 1},
  },
  if (grouped)
    'group_operations': [
      {'operation': 'open', 'commandable': true},
      {
        'operation': 'stop',
        'commandable': false,
        'reasons': ['tag_unavailable'],
      },
    ],
}, spaceId: roomId);

void main() {
  late MockShadingSpaces spaces;
  late MockShadingDevices devices;
  late BottomNavModeNotifier modes;
  late EventBus bus;
  late CoversStateModel current;
  late List<VoidCallback> listeners;
  final popup = ValueNotifier<Widget?>(null);
  setUpAll(() => registerFallbackValue(CoversMode.open));
  setUp(() {
    spaces = MockShadingSpaces();
    devices = MockShadingDevices();
    modes = BottomNavModeNotifier();
    bus = EventBus(sync: true);
    listeners = [];
    current = state(grouped: false);
    popup.value = null;
    when(() => spaces.addListener(any())).thenAnswer(
      (call) => listeners.add(call.positionalArguments.first as VoidCallback),
    );
    when(
      () => spaces.removeListener(any()),
    ).thenAnswer((call) => listeners.remove(call.positionalArguments.first));
    when(() => spaces.getCoversState(roomId)).thenAnswer((_) => current);
    when(
      () => spaces.fetchCoversState(roomId),
    ).thenAnswer((_) async => current);
    when(() => spaces.getCoversTargetsForSpace(roomId)).thenReturn([
      CoversTargetView(
        model: CoversTargetModel(
          deviceId: '00000000-0000-4000-8000-000000000002',
          deviceName: 'Cover',
          channelId: '00000000-0000-4000-8000-000000000003',
          channelName: 'Cover',
          priority: 0,
          hasPosition: true,
          hasCommand: true,
          hasTilt: false,
          role: SpacesModuleDataCoversTargetRole.primary,
          spaceId: roomId,
        ),
      ),
    ]);
    when(() => spaces.setCoversMode(roomId, any())).thenAnswer(
      (_) async => CoversIntentResult(
        success: false,
        affectedDevices: 0,
        failedDevices: 1,
      ),
    );
    locator.registerSingleton<ScreenService>(
      ScreenService(screenWidth: 1800, screenHeight: 2400, pixelRatio: 2),
      dispose: (s) => s.dispose(),
    );
    locator.registerSingleton<VisualDensityService>(
      VisualDensityService(pixelRatio: 2),
    );
    locator.registerSingleton<SpacesService>(spaces);
    locator.registerSingleton<DevicesService>(devices);
    locator.registerSingleton<BottomNavModeNotifier>(modes);
    locator.registerSingleton<EventBus>(bus);
  });
  tearDown(() async {
    Toast.dismiss();
    bus.destroy();
    modes.dispose();
    await locator.reset();
  });

  Future<void> mountPage(WidgetTester tester) async {
    tester.view.physicalSize = const Size(1800, 2400);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      ChangeNotifierProvider<DevicesService>.value(
        value: devices,
        child: MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: Scaffold(
            body: Stack(
              children: [
                const ShadingDomainViewPage(viewItem: item),
                ValueListenableBuilder<Widget?>(
                  valueListenable: popup,
                  builder: (_, child, _) => child == null
                      ? const SizedBox.shrink()
                      : Positioned(
                          bottom: 0,
                          left: 0,
                          right: 0,
                          child: Material(child: child),
                        ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    bus.fire(DeckPageActivatedEvent(itemId: item.id, item: item));
    await tester.pumpAndSettle();
  }

  Future<void> changeState(WidgetTester tester, bool grouped) async {
    current = state(grouped: grouped);
    for (final listener in List<VoidCallback>.of(listeners)) {
      listener();
    }
    await tester.pumpAndSettle();
  }

  testWidgets(
    'group rooms with configured roles have no mode popup and restore ordinary modes after transition',
    (tester) async {
      current = state(grouped: true);
      await mountPage(tester);
      expect(find.byType(GroupedCoversRoomControls), findsOneWidget);
      expect(modes.hasConfig, isFalse);
      verifyNever(() => spaces.setCoversMode(roomId, any()));
      await changeState(tester, false);
      expect(modes.hasConfig, isTrue);
      await changeState(tester, true);
      expect(modes.hasConfig, isFalse);
      verifyNever(() => spaces.setCoversMode(roomId, any()));
      Toast.dismiss();
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
  testWidgets(
    'a retained physical popup cannot send or optimistically set a mode after group transition',
    (tester) async {
      await mountPage(tester);
      final physicalConfig = modes.config!;
      final context = tester.element(find.byType(ShadingDomainViewPage));
      popup.value = physicalConfig.popupBuilder(context, () {});
      await tester.pumpAndSettle();
      await changeState(tester, true);
      expect(modes.hasConfig, isFalse);
      await tester.tap(find.text('Privacy').last);
      await tester.pumpAndSettle();
      expect(modes.hasConfig, isFalse);
      verifyNever(() => spaces.setCoversMode(roomId, any()));
      popup.value = null;
      await changeState(tester, false);
      expect(modes.config!.label, physicalConfig.label);
      Toast.dismiss();
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
  testWidgets(
    'ordinary room mode refusal is failure and does not retain a requested optimistic mode',
    (tester) async {
      await mountPage(tester);
      final original = modes.config!;
      popup.value = original.popupBuilder(
        tester.element(find.byType(ShadingDomainViewPage)),
        () {},
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('Privacy').last);
      await tester.pumpAndSettle();
      verify(() => spaces.setCoversMode(roomId, CoversMode.privacy)).called(1);
      expect(modes.config!.label, original.label);
      expect(current.detectedMode, CoversMode.open);
      // A refused response must also release the mode lock so an ordinary retry is possible.
      await tester.tap(find.text('Closed').last);
      await tester.pumpAndSettle();
      verify(() => spaces.setCoversMode(roomId, CoversMode.closed)).called(1);
      expect(modes.config!.label, original.label);
      Toast.dismiss();
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );
}
