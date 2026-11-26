import 'dart:async';

import 'package:event_bus/event_bus.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_device_category.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/config/module.dart';
import 'package:fastybird_smart_panel/modules/deck/models/deck_item.dart';
import 'package:fastybird_smart_panel/modules/deck/services/deck_service.dart';
import 'package:fastybird_smart_panel/modules/deck/services/intents_service.dart';
import 'package:fastybird_smart_panel/modules/deck/types/system_view_type.dart';
import 'package:fastybird_smart_panel/modules/displays/models/display.dart';
import 'package:fastybird_smart_panel/modules/displays/repositories/display.dart';
import 'package:fastybird_smart_panel/modules/spaces/export.dart';
import 'package:fastybird_smart_panel/modules/system/types/configuration.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/export.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/presentation/system_pages/room_overview.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/presentation/widgets/room_domain_card.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// A room with lights and a thermostat, nothing loaded beyond the counts.
class _Deck extends ChangeNotifier implements DeckService {
  @override
  bool get isLoadingDevices => false;
  @override
  List<DevicesModuleDeviceCategory> get deviceCategories => const [
    DevicesModuleDeviceCategory.lighting,
    DevicesModuleDeviceCategory.lighting,
    DevicesModuleDeviceCategory.thermostat,
  ];
  @override
  int get energyDeviceCount => 0;
  @override
  int get sensorReadingsCount => 0;
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _Display extends ChangeNotifier implements DisplayRepository {
  @override
  DisplayModel? get display => DisplayModel(
    id: 'display',
    macAddress: '00:11:22:33:44:55',
    version: '1.0.0',
    screenWidth: 800,
    screenHeight: 480,
    pixelRatio: 2,
    unitSize: 10,
    rows: 4,
    cols: 6,
    darkMode: false,
    brightness: 80,
    screenLockDuration: 60,
    screenSaver: true,
    audioOutputSupported: false,
    audioInputSupported: false,
    speaker: false,
    speakerVolume: 0,
    microphone: false,
    microphoneVolume: 0,
    spaceId: 'room',
    createdAt: DateTime(2026, 1, 1),
  );
  @override
  String? get weatherLocationId => null;
  @override
  NumberFormatSetting? get numberFormat => null;
  @override
  TemperatureUnit? get temperatureUnit => null;
  @override
  WindSpeedUnit? get windSpeedUnit => null;
  @override
  PressureUnit? get pressureUnit => null;
  @override
  PrecipitationUnit? get precipitationUnit => null;
  @override
  DistanceUnit? get distanceUnit => null;
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _Config implements ConfigModuleService {
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class _Intents extends ChangeNotifier implements IntentsService {
  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

/// Records the lighting intents the page sends.
class _Spaces extends ChangeNotifier implements SpacesService {
  final sent = <String>[];
  ClimateStateModel? climate;
  LightingStateModel? lighting;

  /// Held setpoint requests, completed by the test; null answers at once
  /// with success.
  List<Completer<ClimateIntentResult?>>? held;

  @override
  SpaceView? getSpace(String id) => null;
  @override
  LightingStateModel? getLightingState(String spaceId) => lighting;
  @override
  ClimateStateModel? getClimateState(String spaceId) => climate;
  @override
  CoversStateModel? getCoversState(String spaceId) => null;
  @override
  SensorStateModel? getSensorState(String spaceId) => null;
  @override
  Future<LightingStateModel?> fetchLightingState(String spaceId) async => null;
  @override
  Future<ClimateStateModel?> fetchClimateState(String spaceId) async => null;
  @override
  Future<CoversStateModel?> fetchCoversState(String spaceId) async => null;
  @override
  Future<SensorStateModel?> fetchSensorState(String spaceId) async => null;

  @override
  Future<LightingIntentResult?> setLightingMode(
    String spaceId,
    LightingMode mode,
  ) async {
    sent.add('lighting ${mode.name} $spaceId');

    return null;
  }

  @override
  Future<LightingIntentResult?> turnLightsOn(String spaceId) async {
    sent.add('lights on $spaceId');

    return null;
  }

  @override
  Future<LightingIntentResult?> turnRoleOn(
    String spaceId,
    LightingStateRole role,
  ) async {
    sent.add('role on ${role.name} $spaceId');

    return null;
  }

  @override
  Future<ClimateIntentResult?> setSetpoint(
    String spaceId,
    double value, {
    required ClimateMode mode,
  }) async {
    sent.add('setpoint $value ${mode.name} $spaceId');

    final held = this.held;
    if (held == null) return _ok();

    final request = Completer<ClimateIntentResult?>();
    held.add(request);

    return request.future;
  }

  @override
  Future<ClimateIntentResult?> setClimateMode(
    String spaceId,
    ClimateMode mode,
  ) async {
    sent.add('mode ${mode.name} $spaceId');

    return _ok();
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

ClimateIntentResult _ok() =>
    ClimateIntentResult(success: true, affectedDevices: 1, failedDevices: 0);

/// Heating to 22° in Heat, with a 26° cooling setpoint.
ClimateStateModel _heating() => ClimateStateModel.fromJson({
  'has_climate': true,
  'mode': 'heat',
  'current_temperature': 21.5,
  'heating_setpoint': 22.0,
  'cooling_setpoint': 26.0,
  'supports_heating': true,
  'supports_cooling': true,
  'is_heating': true,
}, spaceId: 'room');

/// Four lights, [on] of them on at [brightness] %.
LightingStateModel _lights(int on, {double? brightness}) =>
    LightingStateModel.fromJson({
      'has_lights': true,
      'total_lights': 4,
      'lights_on': on,
      'average_brightness': ?brightness,
    }, spaceId: 'room');

/// Heating to 22° in Heat, as [_heating], with a new room temperature.
ClimateStateModel _heatingAt(double temperature) => ClimateStateModel.fromJson({
  'has_climate': true,
  'mode': 'heat',
  'current_temperature': temperature,
  'heating_setpoint': 22.0,
  'cooling_setpoint': 26.0,
  'supports_heating': true,
  'supports_cooling': true,
  'is_heating': true,
}, spaceId: 'room');

/// Cooling to 26° in Cool, with a 22° heating setpoint.
ClimateStateModel _cooling() => ClimateStateModel.fromJson({
  'has_climate': true,
  'mode': 'cool',
  'current_temperature': 21.5,
  'heating_setpoint': 22.0,
  'cooling_setpoint': 26.0,
  'supports_heating': true,
  'supports_cooling': true,
  'is_cooling': true,
}, spaceId: 'room');

Finder _climate() => find.byKey(const ValueKey('room-card-climate'));

Finder _target(String text) => find.descendant(
  of: find.descendant(
    of: _climate(),
    matching: find.byKey(const ValueKey('room-card-target')),
  ),
  matching: find.text(text),
);

Finder _plus() =>
    find.descendant(of: _climate(), matching: find.byIcon(MdiIcons.plus));

Widget _page() => MaterialApp(
  theme: AppTheme.lightThemeFor(AppAccent.blue),
  localizationsDelegates: AppLocalizations.localizationsDelegates,
  supportedLocales: AppLocalizations.supportedLocales,
  locale: const Locale('en'),
  home: const Scaffold(
    body: RoomOverviewPage(
      viewItem: SystemViewItem(
        id: 'room',
        viewType: SystemViewType.room,
        roomId: 'room',
        title: 'Living room',
      ),
    ),
  ),
);

void main() {
  late _Spaces spaces;

  setUpAll(() async {
    await locator.reset();
    // A Compact landscape canvas (400 × 240): two quick actions per card.
    locator.registerSingleton<ScreenService>(
      ScreenService(screenWidth: 800, screenHeight: 480, pixelRatio: 2),
    );
    locator.registerSingleton<VisualDensityService>(
      VisualDensityService(pixelRatio: 2),
    );
    locator.registerSingleton<EventBus>(EventBus());
    locator.registerSingleton<DeckService>(_Deck());
    locator.registerSingleton<DisplayRepository>(_Display());
    locator.registerSingleton<IntentsService>(_Intents());
    locator.registerSingleton<ConfigModuleService>(_Config());
    spaces = _Spaces();
    locator.registerSingleton<SpacesService>(spaces);
  });

  tearDownAll(() async {
    await locator.reset();
  });

  testWidgets('On turns on every light in the room and shows On at once', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(350, 240);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    spaces
      ..sent.clear()
      ..climate = null;

    await tester.pumpWidget(_page());
    await tester.pump(const Duration(milliseconds: 100));

    final lights = find.byKey(const ValueKey('room-card-lights'));
    expect(
      find.descendant(of: lights, matching: find.text('Off')),
      findsWidgets,
    );

    await tester.tap(find.descendant(of: lights, matching: find.text('On')));
    await tester.pump(const Duration(milliseconds: 100));

    // The room-level intent, not the main role only.
    expect(spaces.sent, ['lights on room']);
    // The card says On before the room reports back.
    final value = tester
        .widgetList<Text>(
          find.descendant(of: lights, matching: find.byType(Text)),
        )
        .firstWhere((text) => text.textSpan != null);
    expect(value.textSpan!.toPlainText(), 'On');

    // Let the optimistic cleanup and the sky's clock go.
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(seconds: 7));
  });

  testWidgets(
    'plus shows the new target at once and the next tap steps from it',
    (tester) async {
      tester.view.physicalSize = const Size(350, 240);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      spaces
        ..sent.clear()
        ..climate = ClimateStateModel.fromJson({
          'has_climate': true,
          'mode': 'heat',
          'current_temperature': 21.5,
          'heating_setpoint': 22.0,
          'supports_heating': true,
          'is_heating': true,
        }, spaceId: 'room');
      addTearDown(() => spaces.climate = null);

      await tester.pumpWidget(_page());
      await tester.pump(const Duration(milliseconds: 100));

      final climate = find.byKey(const ValueKey('room-card-climate'));
      final target = find.descendant(
        of: climate,
        matching: find.byKey(const ValueKey('room-card-target')),
      );
      expect(
        find.descendant(of: target, matching: find.text('22°')),
        findsOneWidget,
      );

      final plus = find.descendant(
        of: climate,
        matching: find.byIcon(MdiIcons.plus),
      );
      await tester.tap(plus);
      await tester.pump(const Duration(milliseconds: 100));

      expect(spaces.sent, ['setpoint 23.0 heat room']);
      // The target follows before the room reports back; the room
      // temperature stays as measured.
      expect(
        find.descendant(of: target, matching: find.text('23°')),
        findsOneWidget,
      );
      expect(
        find.descendant(
          of: climate,
          matching: find.textContaining('21.5', findRichText: true),
        ),
        findsOneWidget,
      );

      await tester.tap(plus);
      await tester.pump(const Duration(milliseconds: 100));
      expect(spaces.sent, [
        'setpoint 23.0 heat room',
        'setpoint 24.0 heat room',
      ]);
      expect(
        find.descendant(of: target, matching: find.text('24°')),
        findsOneWidget,
      );

      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump(const Duration(seconds: 7));
    },
  );

  group('review round 5', () {
    setUp(() {
      spaces
        ..sent.clear()
        ..held = null
        ..climate = _heating();
    });
    tearDown(() {
      spaces
        ..held = null
        ..climate = null;
    });

    Future<void> pumpPage(WidgetTester tester, Size size) async {
      tester.view.physicalSize = size;
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(_page());
      await tester.pump(const Duration(milliseconds: 100));
    }

    Future<void> chooseMode(WidgetTester tester, String mode) async {
      await tester.tap(
        find.descendant(of: _climate(), matching: find.text('Heat')),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text(mode).last);
      await tester.pump(const Duration(milliseconds: 100));
    }

    Future<void> finish(WidgetTester tester) async {
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump(const Duration(seconds: 7));
    }

    testWidgets('plus after a pending Cool steps the cooling setpoint', (
      tester,
    ) async {
      // Wide enough for the mode button beside minus and plus.
      await pumpPage(tester, const Size(800, 480));

      await chooseMode(tester, 'Cool');
      await tester.tap(_plus());
      await tester.pump(const Duration(milliseconds: 100));

      // Cool 26° + 1, not Heat 22° + 1.
      expect(spaces.sent, ['mode cool room', 'setpoint 27.0 cool room']);
      expect(_target('27°'), findsOneWidget);
      await finish(tester);
    });

    testWidgets('plus after a pending Off keeps the card off', (tester) async {
      await pumpPage(tester, const Size(800, 480));

      await chooseMode(tester, 'Off');
      await tester.tap(_plus());
      await tester.pump(const Duration(milliseconds: 100));

      final card = tester.widget<RoomDomainCard>(_climate()).card;
      expect(card.isActive, isFalse);
      expect(card.actions.first.label, 'Off');
      await finish(tester);
    });

    testWidgets(
      'a failed plus puts the target back, says so, and the next tap steps '
      'from the reported one',
      (tester) async {
        spaces.held = [];
        await pumpPage(tester, const Size(350, 240));

        await tester.tap(_plus());
        await tester.pump(const Duration(milliseconds: 100));
        expect(_target('23°'), findsOneWidget);

        spaces.held!.single.complete(null);
        await tester.pump(const Duration(milliseconds: 100));
        expect(_target('22°'), findsOneWidget);
        expect(find.text('Action failed'), findsOneWidget);

        spaces.held = null;
        await tester.pump(const Duration(seconds: 5));
        await tester.tap(_plus());
        await tester.pump(const Duration(milliseconds: 100));
        expect(spaces.sent, [
          'setpoint 23.0 heat room',
          'setpoint 23.0 heat room',
        ]);
        await finish(tester);
      },
    );

    testWidgets('an older failure does not undo a newer tap', (tester) async {
      spaces.held = [];
      await pumpPage(tester, const Size(350, 240));

      await tester.tap(_plus());
      await tester.pump(const Duration(milliseconds: 100));
      await tester.tap(_plus());
      await tester.pump(const Duration(milliseconds: 100));
      expect(_target('24°'), findsOneWidget);

      spaces.held!.first.complete(null);
      await tester.pump(const Duration(milliseconds: 100));
      expect(_target('24°'), findsOneWidget);

      spaces.held!.last.complete(_ok());
      await tester.pump(const Duration(milliseconds: 100));
      expect(_target('24°'), findsOneWidget);
      await finish(tester);
    });

    // Review round 6 reuses this group's page and helpers.
    group('review round 6', () {
      testWidgets(
        'when both of two taps fail the card goes back to the reported target '
        'and the next tap steps from it',
        (tester) async {
          spaces.held = [];
          await pumpPage(tester, const Size(350, 240));

          await tester.tap(_plus());
          await tester.pump(const Duration(milliseconds: 100));
          await tester.tap(_plus());
          await tester.pump(const Duration(milliseconds: 100));
          expect(_target('24°'), findsOneWidget);

          spaces.held!.first.complete(null);
          await tester.pump(const Duration(milliseconds: 100));
          spaces.held!.last.complete(null);
          await tester.pump(const Duration(milliseconds: 100));
          expect(_target('22°'), findsOneWidget);

          spaces.held = null;
          await tester.tap(_plus());
          await tester.pump(const Duration(milliseconds: 100));
          expect(spaces.sent.last, 'setpoint 23.0 heat room');
          await finish(tester);
        },
      );

      testWidgets(
        'when the newer tap fails first and the older one after, the card '
        'goes back to the reported target',
        (tester) async {
          spaces.held = [];
          await pumpPage(tester, const Size(350, 240));

          await tester.tap(_plus());
          await tester.pump(const Duration(milliseconds: 100));
          await tester.tap(_plus());
          await tester.pump(const Duration(milliseconds: 100));

          spaces.held!.last.complete(null);
          await tester.pump(const Duration(milliseconds: 100));
          expect(_target('23°'), findsOneWidget);

          spaces.held!.first.complete(null);
          await tester.pump(const Duration(milliseconds: 100));
          expect(_target('22°'), findsOneWidget);
          await finish(tester);
        },
      );
    });

    group('review round 7', () {
      testWidgets('reopening the picker can reverse a pending mode', (
        tester,
      ) async {
        await pumpPage(tester, const Size(800, 480));

        await chooseMode(tester, 'Cool');
        await tester.tap(
          find.descendant(of: _climate(), matching: find.text('Cool')),
        );
        await tester.pumpAndSettle();
        await tester.tap(find.text('Heat').last);
        await tester.pump(const Duration(milliseconds: 100));

        expect(spaces.sent, ['mode cool room', 'mode heat room']);
        final card = tester.widget<RoomDomainCard>(_climate()).card;
        expect(card.actions.first.label, 'Heat');
        await finish(tester);
      });
    });

    group('review round 8', () {
      String? modeLabel(WidgetTester tester) =>
          tester.widget<RoomDomainCard>(_climate()).card.actions.first.label;

      Future<void> report(WidgetTester tester, ClimateStateModel state) async {
        spaces
          ..climate = state
          ..notifyListeners();
        await tester.pump(const Duration(milliseconds: 100));
      }

      testWidgets(
        'a reversed mode stays until the room reports it, past the earlier '
        'mode arriving first',
        (tester) async {
          await pumpPage(tester, const Size(800, 480));

          await chooseMode(tester, 'Cool');
          await tester.tap(
            find.descendant(of: _climate(), matching: find.text('Cool')),
          );
          await tester.pumpAndSettle();
          await tester.tap(find.text('Heat').last);
          await tester.pump(const Duration(milliseconds: 100));

          // The earlier Cool lands first; the card keeps the latest choice.
          await report(tester, _cooling());
          expect(modeLabel(tester), 'Heat');

          // Heat lands and confirms it, so the override is gone: a later
          // change made elsewhere shows at once.
          await report(tester, _heating());
          expect(modeLabel(tester), 'Heat');
          await report(tester, _cooling());
          expect(modeLabel(tester), 'Cool');
          await finish(tester);
        },
      );

      testWidgets('a plain mode change is confirmed by the room reporting it', (
        tester,
      ) async {
        await pumpPage(tester, const Size(800, 480));

        await chooseMode(tester, 'Cool');
        await report(tester, _cooling());
        expect(modeLabel(tester), 'Cool');

        // Confirmed, so the room's next report shows at once.
        await report(tester, _heating());
        expect(modeLabel(tester), 'Heat');
        await finish(tester);
      });

      testWidgets(
        'a new room temperature does not confirm a reversed mode before the '
        'earlier mode arrives',
        (tester) async {
          await pumpPage(tester, const Size(800, 480));

          await chooseMode(tester, 'Cool');
          await tester.tap(
            find.descendant(of: _climate(), matching: find.text('Cool')),
          );
          await tester.pumpAndSettle();
          await tester.tap(find.text('Heat').last);
          await tester.pump(const Duration(milliseconds: 100));

          // Only the temperature moves; Heat must stay pending.
          await report(tester, _heatingAt(21.0));
          expect(modeLabel(tester), 'Heat');
          await report(tester, _cooling());
          expect(modeLabel(tester), 'Heat');

          await report(tester, _heating());
          expect(modeLabel(tester), 'Heat');
          await report(tester, _cooling());
          expect(modeLabel(tester), 'Cool');
          await finish(tester);
        },
      );
    });
  });

  group('review round 10', () {
    setUp(() {
      spaces
        ..sent.clear()
        ..climate = null
        ..lighting = _lights(4, brightness: 80);
    });
    tearDown(() => spaces.lighting = null);

    Finder lights() => find.byKey(const ValueKey('room-card-lights'));

    String value(WidgetTester tester) => tester
        .widgetList<Text>(
          find.descendant(of: lights(), matching: find.byType(Text)),
        )
        .firstWhere((text) => text.textSpan != null)
        .textSpan!
        .toPlainText();

    Future<void> report(WidgetTester tester, LightingStateModel state) async {
      spaces
        ..lighting = state
        ..notifyListeners();
      await tester.pump(const Duration(milliseconds: 100));
    }

    testWidgets(
      'a brightness change does not confirm On before a delayed Off arrives',
      (tester) async {
        tester.view.physicalSize = const Size(350, 240);
        tester.view.devicePixelRatio = 1;
        addTearDown(tester.view.reset);
        await tester.pumpWidget(_page());
        await tester.pump(const Duration(milliseconds: 100));
        expect(value(tester), '80 %');

        await tester.tap(
          find.descendant(of: lights(), matching: find.text('Off')).first,
        );
        await tester.pump(const Duration(milliseconds: 100));
        await tester.tap(
          find.descendant(of: lights(), matching: find.text('On')).first,
        );
        await tester.pump(const Duration(milliseconds: 100));
        expect(spaces.sent, ['lighting off room', 'lights on room']);
        expect(value(tester), 'On');

        // Only the brightness moves, then the earlier Off lands: On stays.
        await report(tester, _lights(4, brightness: 60));
        expect(value(tester), 'On');
        await report(tester, _lights(0));
        expect(value(tester), 'On');

        // On lands and confirms it; the room's brightness shows.
        await report(tester, _lights(4, brightness: 60));
        expect(value(tester), '60 %');

        await tester.pumpWidget(const SizedBox.shrink());
        await tester.pump(const Duration(seconds: 7));
      },
    );
  });
}
