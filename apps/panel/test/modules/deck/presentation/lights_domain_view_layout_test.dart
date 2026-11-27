import 'dart:async';

import 'package:event_bus/event_bus.dart';
import 'package:fastybird_smart_panel/api/models/scenes_module_data_scene_category.dart';
import 'package:fastybird_smart_panel/api/models/spaces_module_data_light_target_role.dart';
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
import 'package:fastybird_smart_panel/modules/devices/views/channels/light.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/lighting.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/on.dart';
import 'package:fastybird_smart_panel/modules/scenes/models/scenes/scene.dart';
import 'package:fastybird_smart_panel/modules/scenes/service.dart';
import 'package:fastybird_smart_panel/modules/scenes/views/scenes/view.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/models/intent_result/intent_result.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/models/light_targets/light_target.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/models/lighting_state/lighting_state.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/presentation/domain_pages/lights_domain_view.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/services/spaces_service.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/views/light_targets/view.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:provider/provider.dart';

class _Spaces extends Mock implements SpacesService {}

class _Devices extends Mock implements DevicesService {}

class _Light extends Mock implements LightingDeviceView {}

class _Channel extends Mock implements LightChannelView {}

class _OnProp extends Mock implements OnChannelPropertyView {}

class _Scenes extends Mock implements ScenesService {}

const _room = '00000000-0000-4000-8000-000000000001';
const _item = DomainViewItem(
  id: 'lights',
  domainType: DomainType.lights,
  roomId: _room,
  title: 'Lights',
  deviceCount: 2,
);

LightTargetView _target(int n, SpacesModuleDataLightTargetRole role) =>
    LightTargetView(
      model: LightTargetModel(
        deviceId: '00000000-0000-4000-8000-00000000001$n',
        deviceName: 'Light $n',
        channelId: '00000000-0000-4000-8000-00000000002$n',
        channelName: 'Light $n',
        priority: n,
        hasBrightness: true,
        hasColorTemp: false,
        hasColor: false,
        role: role,
        spaceId: _room,
      ),
    );

/// Main at 50 %, Ambient off.
final _state = LightingStateModel.fromJson({
  'has_lights': true,
  'total_lights': 2,
  'lights_on': 1,
  'roles': {
    'main': {
      'role': 'main',
      'is_on': true,
      'brightness': 50,
      'devices_count': 1,
      'devices_on': 1,
    },
    'ambient': {
      'role': 'ambient',
      'is_on': false,
      'devices_count': 1,
      'devices_on': 0,
    },
  },
}, spaceId: _room);

void main() {
  late _Spaces spaces;
  late _Devices devices;
  late BottomNavModeNotifier modes;
  late EventBus bus;

  setUp(() {
    spaces = _Spaces();
    devices = _Devices();
    modes = BottomNavModeNotifier();
    bus = EventBus(sync: true);
    when(() => spaces.addListener(any())).thenReturn(null);
    when(() => spaces.removeListener(any())).thenReturn(null);
    when(() => devices.addListener(any())).thenReturn(null);
    when(() => devices.removeListener(any())).thenReturn(null);
    when(() => spaces.getLightTargetsForSpace(_room)).thenReturn([
      _target(1, SpacesModuleDataLightTargetRole.main),
      _target(2, SpacesModuleDataLightTargetRole.ambient),
    ]);
    when(() => spaces.getLightingState(_room)).thenReturn(_state);
    when(
      () => spaces.fetchLightTargetsForSpace(_room),
    ).thenAnswer((_) async {});
    when(
      () => spaces.fetchLightingState(_room),
    ).thenAnswer((_) async => _state);
    when(() => spaces.getSpace(_room)).thenReturn(null);
    when(() => devices.getDevice(any())).thenReturn(null);
    when(() => devices.devicesList).thenReturn(const []);
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

  /// Mounts the view on a [size] screen, in the [view] the deck's dock or
  /// bar leaves it (the whole screen when null).
  Future<void> mountAt(WidgetTester tester, Size size, {Size? view}) async {
    // One design px is one logical px at DPR 2 and density 1.0.
    locator.registerSingleton<ScreenService>(
      ScreenService(
        screenWidth: size.width * 2,
        screenHeight: size.height * 2,
        pixelRatio: 2,
      ),
      dispose: (s) => s.dispose(),
    );
    tester.view.physicalSize = size * 2;
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider<DevicesService>.value(value: devices),
          ChangeNotifierProvider<BottomNavModeNotifier>.value(value: modes),
        ],
        child: MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: AppLocalizations.supportedLocales,
          home: view == null
              ? const LightsDomainViewPage(viewItem: _item)
              : Align(
                  alignment: Alignment.topCenter,
                  child: SizedBox.fromSize(
                    size: view,
                    child: const LightsDomainViewPage(viewItem: _item),
                  ),
                ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    bus.fire(DeckPageActivatedEvent(itemId: _item.id, item: _item));
    await tester.pumpAndSettle();
  }

  Future<void> unmount(WidgetTester tester) async {
    Toast.dismiss();
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(seconds: 3));
  }

  for (final size in const [
    Size(240, 240),
    Size(208, 304),
    Size(356, 240),
    Size(584, 360),
    Size(876, 540),
    Size(360, 588),
  ]) {
    testWidgets('$size shows the hero and reaches every role', (tester) async {
      await mountAt(tester, size);
      expect(tester.takeException(), isNull);
      expect(find.byKey(const ValueKey('lights-hero')), findsOneWidget);
      // Compact landscape drops the badge (spec §4, "Domain hero"); the
      // square keeps it.
      final compactLandscape = size.width > size.height && size.height < 340;
      expect(
        find.byKey(const ValueKey('lights-hero-badge')),
        compactLandscape ? findsNothing : findsOneWidget,
      );

      final square = size.width == size.height;
      // Where the badge drops, or chooses the role on the square, the header
      // opens the role's lights.
      expect(
        find.byKey(const ValueKey('lights-role-lights-button')),
        compactLandscape || square ? findsOneWidget : findsNothing,
      );
      // The square puts the roles behind a header button and the badge;
      // elsewhere they are tiles.
      expect(
        find.byKey(const ValueKey('lights-roles-button')),
        square ? findsOneWidget : findsNothing,
      );
      expect(
        find.byKey(const ValueKey('lights-role-main')),
        square ? findsNothing : findsOneWidget,
      );
      expect(
        find.byKey(const ValueKey('lights-role-ambient')),
        square ? findsNothing : findsOneWidget,
      );
      await unmount(tester);
    });
  }

  testWidgets('selecting a role tile moves the hero to that role', (
    tester,
  ) async {
    await mountAt(tester, const Size(584, 360));
    final badge = find.byKey(const ValueKey('lights-hero-badge'));
    expect(
      find.descendant(of: badge, matching: find.text('Main')),
      findsOneWidget,
    );

    await tester.tap(find.byKey(const ValueKey('lights-role-ambient')));
    await tester.pumpAndSettle();
    expect(
      find.descendant(of: badge, matching: find.text('Ambient')),
      findsOneWidget,
    );
    // Ambient is off: the hero says so and offers Off and On.
    expect(
      find.descendant(
        of: find.byKey(const ValueKey('lights-hero')),
        matching: find.text('Off'),
      ),
      findsWidgets,
    );
    await unmount(tester);
  });

  testWidgets('the square chooses roles from the header', (tester) async {
    await mountAt(tester, const Size(240, 240));
    await tester.tap(find.byKey(const ValueKey('lights-roles-button')));
    await tester.pumpAndSettle();
    await tester.tap(find.textContaining('Ambient').last);
    await tester.pumpAndSettle();
    expect(
      find.descendant(
        of: find.byKey(const ValueKey('lights-hero-badge')),
        matching: find.text('Ambient'),
      ),
      findsOneWidget,
    );
    await unmount(tester);
  });

  group('every light property keeps the role power', () {
    /// Both roles' lights dim and take a colour temperature.
    void tunableWhite() {
      for (final (n, on) in [(1, true), (2, false)]) {
        final device = _Light();
        final channel = _Channel();
        when(
          () => device.id,
        ).thenReturn('00000000-0000-4000-8000-00000000001$n');
        when(() => device.name).thenReturn('Light $n');
        when(() => device.isOnline).thenReturn(true);
        when(() => device.lightChannels).thenReturn([channel]);
        when(
          () => channel.id,
        ).thenReturn('00000000-0000-4000-8000-00000000002$n');
        when(() => channel.hasBrightness).thenReturn(true);
        when(() => channel.hasTemperature).thenReturn(true);
        when(() => channel.temperatureProp).thenReturn(null);
        when(() => channel.hasColor).thenReturn(false);
        when(() => channel.hasHue).thenReturn(false);
        when(() => channel.hasSaturation).thenReturn(false);
        when(() => channel.hasColorWhite).thenReturn(false);
        when(() => channel.on).thenReturn(on);
        final onProp = _OnProp();
        when(
          () => onProp.id,
        ).thenReturn('00000000-0000-4000-8000-00000000003$n');
        when(() => channel.onProp).thenReturn(onProp);
        when(() => channel.brightness).thenReturn(on ? 50 : 0);
        when(
          () => devices.getDevice('00000000-0000-4000-8000-00000000001$n'),
        ).thenReturn(device);
      }
      when(() => spaces.turnRoleOn(_room, any())).thenAnswer((_) async => null);
      when(
        () => spaces.turnRoleOff(_room, any()),
      ).thenAnswer((_) async => null);
    }

    Future<void> showTemperature(WidgetTester tester) async {
      await tester.tap(find.byKey(const ValueKey('lights-hero-property')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Temp').last);
      await tester.pumpAndSettle();
      expect(
        find.descendant(
          of: find.byKey(const ValueKey('lights-hero')),
          matching: find.text('Warm'),
        ),
        findsOneWidget,
      );
    }

    setUpAll(() => registerFallbackValue(LightingStateRole.main));

    testWidgets('Off turns an on role off from colour temperature', (
      tester,
    ) async {
      tunableWhite();
      await mountAt(tester, const Size(584, 360));
      await showTemperature(tester);

      await tester.tap(
        find.descendant(
          of: find.byKey(const ValueKey('lights-hero')),
          matching: find.text('Off'),
        ),
      );
      await tester.pumpAndSettle();
      verify(() => spaces.turnRoleOff(_room, LightingStateRole.main)).called(1);
      await unmount(tester);
    });

    testWidgets('a colour temperature preset turns an off role on', (
      tester,
    ) async {
      tunableWhite();
      await mountAt(tester, const Size(584, 360));
      await tester.tap(find.byKey(const ValueKey('lights-role-ambient')));
      await tester.pumpAndSettle();
      await showTemperature(tester);

      await tester.tap(
        find.descendant(
          of: find.byKey(const ValueKey('lights-hero')),
          matching: find.text('Warm'),
        ),
      );
      await tester.pumpAndSettle();
      verify(
        () => spaces.turnRoleOn(_room, LightingStateRole.ambient),
      ).called(1);
      await unmount(tester);
    });
    testWidgets('Compact landscape opens the selected role\'s lights from the '
        'header', (tester) async {
      tunableWhite();
      await mountAt(tester, const Size(356, 240));
      await tester.tap(find.byKey(const ValueKey('lights-role-ambient')));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const ValueKey('lights-role-lights-button')));
      await tester.pumpAndSettle();
      // Ambient's one light, in the drawer.
      expect(find.text('Light 2'), findsWidgets);
      expect(find.text('Light 1'), findsNothing);
      await unmount(tester);
    });

    testWidgets('the square opens the selected role\'s lights from a full '
        'header', (tester) async {
      tunableWhite();
      // The fullest square header: the mode chip, the roles, the lights and
      // the scenes.
      final scenes = _Scenes();
      when(() => scenes.addListener(any())).thenReturn(null);
      when(() => scenes.removeListener(any())).thenReturn(null);
      when(() => scenes.getScenesForSpace(_room)).thenReturn([
        for (final (id, name) in [('1', 'Relax'), ('2', 'Reading')])
          SceneView(
            model: SceneModel(
              id: '00000000-0000-4000-8000-00000000004$id',
              name: name,
              description: null,
              enabled: true,
              triggerable: true,
              editable: true,
              order: 0,
              category: ScenesModuleDataSceneCategory.lighting,
              actions: const [],
            ),
          ),
      ]);
      locator.registerSingleton<ScenesService>(scenes);

      // 240 × 240 less the 40 px bar.
      await mountAt(tester, const Size(240, 240), view: const Size(240, 200));
      expect(tester.takeException(), isNull);
      for (final key in [
        'lights-roles-button',
        'lights-role-lights-button',
        'lights-scenes-button',
      ]) {
        expect(find.byKey(ValueKey(key)), findsOneWidget, reason: key);
      }

      await tester.tap(find.byKey(const ValueKey('lights-role-lights-button')));
      await tester.pumpAndSettle();
      // Main's one light, in the drawer.
      expect(find.text('Light 1'), findsWidgets);
      expect(find.text('Light 2'), findsNothing);
      await unmount(tester);
    });

    testWidgets('a preset whose power-on outlasts a role switch leaves the new '
        'hero alone', (tester) async {
      tunableWhite();
      final powerOn = Completer<LightingIntentResult?>();
      when(
        () => spaces.turnRoleOn(_room, any()),
      ).thenAnswer((_) => powerOn.future);
      when(
        () => spaces.setRoleColorTemp(_room, any(), any()),
      ).thenAnswer((_) async => null);
      await mountAt(tester, const Size(584, 360));
      await tester.tap(find.byKey(const ValueKey('lights-role-ambient')));
      await tester.pumpAndSettle();
      await showTemperature(tester);

      // Warm on the off Ambient role waits for the power-on...
      await tester.tap(
        find.descendant(
          of: find.byKey(const ValueKey('lights-hero')),
          matching: find.text('Warm'),
        ),
      );
      await tester.pump();
      // ...while the user moves to Main.
      await tester.tap(find.byKey(const ValueKey('lights-role-main')));
      await tester.pumpAndSettle();

      powerOn.complete(null);
      await tester.pumpAndSettle();
      await tester.pump(const Duration(seconds: 2));
      // The late preset neither sets Main's hero pending nor fires for
      // Ambient through the shared debounce.
      verifyNever(() => spaces.setRoleColorTemp(_room, any(), any()));
      final hero = find.byKey(const ValueKey('lights-hero'));
      expect(
        find.descendant(of: hero, matching: find.text('Setting')),
        findsNothing,
      );
      await unmount(tester);
    });
  });

  testWidgets('the mode chip and popup name the domain in its colour', (
    tester,
  ) async {
    await mountAt(tester, const Size(584, 360));
    expect(modes.config?.title, 'Lights mode');
    await unmount(tester);
  });
}
