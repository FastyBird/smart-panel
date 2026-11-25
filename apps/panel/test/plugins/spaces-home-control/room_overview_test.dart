import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/modules/automations/repositories/automations.dart';
import 'package:fastybird_smart_panel/modules/automations/service.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/repositories/mode_schedule.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/sky/sky_look.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/sky/sky_panel.dart';
import 'package:fastybird_smart_panel/modules/deck/types/domain_type.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/presentation/widgets/room_domain_card.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/presentation/widgets/room_mode.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/presentation/widgets/room_overview_layout.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/presentation/widgets/room_overview_metrics.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/presentation/widgets/room_overview_pills.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/repositories/activity_modes.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/services/room_overview_model_builder.dart';
import 'package:fastybird_smart_panel/api/models/scenes_module_data_scene_category.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

const _space = 'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c6';
const _activation = 'f1e09ba1-429f-4c6a-a2fd-aca6a7c4a8c7';

Map<String, Object?> _config(String mode, int order) => {
  'id': _activation,
  'space_id': _space,
  'created_at': '2026-10-16T00:00:00Z',
  'type': 'activity_config',
  'activity_mode': mode,
  'activity_enabled': true,
  'activity_order': order,
  'activity_revision': 3,
  'activity_configuration': {
    'lighting': {'enabled': true, 'mode': 'work'},
    'climate': {'enabled': false},
    'covers': {'enabled': false, 'position': 0},
    'media': {'enabled': false, 'activity': 'off'},
    'security': {'enabled': false},
  },
};

Map<String, Object?> _state(String? mode, String status) => {
  'id': _activation,
  'space_id': _space,
  'created_at': '2026-10-16T00:00:00Z',
  'type': 'activity_state',
  'selected_activity_mode': mode,
  'activation_id': _activation,
  'selected_activity_revision': 3,
  'activity_status': status,
  'activity_actor': 'display:test',
  'activity_results': [
    {'domain': 'lighting', 'status': 'succeeded', 'reason': 'completed'},
    {'domain': 'covers', 'status': 'failed', 'reason': 'timeout'},
  ],
};

/// The activity modes API: two modes, Work [status], and a POST answered
/// with the mode it activates, active.
class _Adapter implements HttpClientAdapter {
  final requests = <RequestOptions>[];
  String mode = 'work';
  String status = 'active';

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    final Object? data;
    if (options.method == 'POST') {
      mode = options.path.split('/').reversed.skip(1).first;
      status = 'active';
      data = _state(mode, status);
    } else if (options.path.endsWith('/active')) {
      data = _state(mode, status);
    } else if (options.path == '/modules/spaces/spaces') {
      data = <Object?>[];
    } else {
      data = [_config('work', 1), _config('relax', 2)];
    }

    return ResponseBody.fromString(
      jsonEncode({'data': data}),
      200,
      headers: {
        Headers.contentTypeHeader: ['application/json'],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

/// A repository seeded with three modes and [status] for Work, never bound.
ActivityModesRepository _modes(Dio dio, {String status = 'active'}) =>
    ActivityModesRepository(dio: dio)
      ..modes = [
        ActivityModeConfig.fromJson(_config('work', 1)),
        ActivityModeConfig.fromJson(_config('relax', 2)),
      ]
      ..state = ActivityModeState.fromJson(_state('work', status))
      ..fresh = true;

DomainCardInfo _card(DomainType domain) => DomainCardInfo(
  domain: domain,
  icon: domain.icon,
  title: domain.name,
  primaryValue: '50',
  unit: ' %',
  subtitle: '3 of 4 active',
  actions: [
    QuickActionInfo(
      type: QuickActionType.lightsOff,
      icon: MdiIcons.lightbulbOff,
      label: 'Off',
    ),
    QuickActionInfo(
      type: QuickActionType.lightsHalf,
      icon: MdiIcons.brightnessAuto,
      label: '50%',
      selected: true,
    ),
    QuickActionInfo(
      type: QuickActionType.lightsFull,
      icon: MdiIcons.brightness7,
      label: '100%',
    ),
  ],
  compactActions: [
    QuickActionInfo(
      type: QuickActionType.lightsOff,
      icon: MdiIcons.lightbulbOff,
      label: 'Off',
    ),
    QuickActionInfo(
      type: QuickActionType.lightsOn,
      icon: MdiIcons.lightbulbOn,
      label: 'On',
      selected: true,
    ),
  ],
  isActive: true,
);

final _fourCards = [
  _card(DomainType.lights),
  _card(DomainType.climate),
  _card(DomainType.shading),
  _card(DomainType.media),
];

final _scenes = [
  QuickScene(
    sceneId: 'movie',
    name: 'Movie night',
    category: ScenesModuleDataSceneCategory.movie,
    icon: MdiIcons.movieOpen,
  ),
  QuickScene(
    sceneId: 'dinner',
    name: 'Dinner',
    category: ScenesModuleDataSceneCategory.generic,
    icon: MdiIcons.silverwareForkKnife,
  ),
];

final _readings = [
  SensorReading(
    icon: MdiIcons.thermometer,
    label: 'Temperature',
    value: '21.4 °C',
  ),
  SensorReading(icon: MdiIcons.waterPercent, label: 'Humidity', value: '46 %'),
];

/// What the layout asked of the sky.
class _Sky {
  bool? landscape;
  String? readings;
  bool footer = false;

  Widget build(
    BuildContext context, {
    required bool landscape,
    required ScreenSizeClass sizeClass,
    String? readings,
    Widget Function(BuildContext context, SkyLook look)? footer,
  }) {
    this.landscape = landscape;
    this.readings = readings;
    this.footer = footer != null;

    return ColoredBox(
      key: const ValueKey('sky'),
      color: const Color(0x00000000),
      child: footer == null
          ? null
          : Align(
              alignment: Alignment.bottomLeft,
              child: footer(
                context,
                SkyLook.of(SkyDayPart.day, SkyWeather.clear),
              ),
            ),
    );
  }
}

Future<void> _pump(
  WidgetTester tester,
  Widget child, {
  required Size size,
  double textScale = 1,
}) async {
  tester.view.physicalSize = const Size(1280, 1280);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.lightThemeFor(AppAccent.blue),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      locale: const Locale('en'),
      home: MediaQuery(
        data: MediaQueryData(textScaler: TextScaler.linear(textScale)),
        child: Scaffold(
          body: Align(
            alignment: Alignment.topLeft,
            child: SizedBox.fromSize(size: size, child: child),
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

Finder _inCard(DomainType domain, Finder matching) => find.descendant(
  of: find.byKey(ValueKey('room-card-${domain.name}')),
  matching: matching,
);

void main() {
  setUpAll(() async {
    await locator.reset();
    // DPR 2 at density 1.0: one design px is one logical px.
    locator.registerSingleton<ScreenService>(
      ScreenService(screenWidth: 1280, screenHeight: 800, pixelRatio: 2),
    );
    locator.registerSingleton<VisualDensityService>(
      VisualDensityService(pixelRatio: 2),
    );
  });

  tearDownAll(() async {
    await locator.reset();
  });

  late Dio dio;
  late _Adapter adapter;

  setUp(() {
    adapter = _Adapter();
    dio = Dio(BaseOptions(baseUrl: 'http://localhost/api/v1'))
      ..httpClientAdapter = adapter;
  });

  tearDown(() => dio.close());

  RoomModeSources sources({String status = 'active'}) => RoomModeSources(
    spaceId: _space,
    activity: _modes(dio, status: status),
  );

  group('metrics', () {
    test('three quick actions when each is at least 36 wide, else two', () {
      // Compact pads 6: (inner − 8) / 3 must reach 36.
      expect(RoomOverviewMetrics.actionsFor(100, ScreenSizeClass.compact), 2);
      expect(RoomOverviewMetrics.actionsFor(128, ScreenSizeClass.compact), 3);
      expect(RoomOverviewMetrics.actionsFor(127, ScreenSizeClass.compact), 2);
      // Regular pads 8, Expanded 12.
      expect(RoomOverviewMetrics.actionsFor(132, ScreenSizeClass.regular), 3);
      expect(RoomOverviewMetrics.actionsFor(131, ScreenSizeClass.regular), 2);
      expect(RoomOverviewMetrics.actionsFor(140, ScreenSizeClass.expanded), 3);
    });

    test('small cards only on the square with more than two domains', () {
      expect(RoomOverviewMetrics.smallCards(square: true, cards: 3), isTrue);
      expect(RoomOverviewMetrics.smallCards(square: true, cards: 2), isFalse);
      expect(RoomOverviewMetrics.smallCards(square: false, cards: 4), isFalse);
      expect(RoomOverviewMetrics.columnsFor(square: true, cards: 4), 4);
      expect(RoomOverviewMetrics.columnsFor(square: false, cards: 1), 1);
      expect(RoomOverviewMetrics.columnsFor(square: false, cards: 3), 2);
    });
  });

  group('class switches', () {
    testWidgets(
      'Compact: the mode button leads the scenes row, cards keep two actions, readings go to the sky',
      (tester) async {
        final sky = _Sky();
        // XS landscape: 400 × 240 less the 44 dock and its 6 inset.
        await _pump(
          tester,
          RoomOverviewLayout(
            skyBuilder: sky.build,
            cards: _fourCards,
            scenes: _scenes,
            readings: _readings,
            modes: sources(),
            sizeClass: ScreenSizeClass.compact,
            square: false,
          ),
          size: const Size(350, 240),
        );

        expect(tester.takeException(), isNull);
        expect(find.byType(RoomModeButton), findsOneWidget);
        expect(find.byType(RoomModePanel), findsNothing);
        expect(find.byType(RoomScenePill), findsNWidgets(2));
        // The button comes first in the row.
        expect(
          tester.getTopLeft(find.byType(RoomModeButton)).dx,
          lessThan(tester.getTopLeft(find.text('Movie night')).dx),
        );
        expect(find.byType(RoomStatusPill), findsNothing);
        expect(sky.readings, '21.4 °C · 46 %');
        expect(sky.footer, isFalse);
        // Icon and value only.
        expect(_inCard(DomainType.lights, find.text('lights')), findsNothing);
        expect(
          _inCard(DomainType.lights, find.byType(RoomQuickAction)),
          findsNWidgets(2),
        );
        expect(_inCard(DomainType.lights, find.text('On')), findsOneWidget);
      },
    );

    testWidgets(
      'Regular landscape: the chip row, scenes on the sky, three actions and the status strip',
      (tester) async {
        final sky = _Sky();
        // M+ landscape: 640 × 400 less the 56 dock and its 8 inset.
        await _pump(
          tester,
          RoomOverviewLayout(
            skyBuilder: sky.build,
            cards: _fourCards,
            scenes: _scenes,
            readings: _readings,
            modes: sources(),
            sizeClass: ScreenSizeClass.regular,
            square: false,
          ),
          size: const Size(576, 400),
        );

        expect(tester.takeException(), isNull);
        expect(find.byType(RoomModePanel), findsOneWidget);
        expect(find.byType(RoomModeButton), findsNothing);
        expect(find.byType(RoomModeChip), findsNWidgets(3));
        expect(find.text('ROOM MODE'), findsOneWidget);
        expect(sky.landscape, isTrue);
        expect(sky.footer, isTrue);
        expect(sky.readings, isNull);
        expect(
          find.descendant(
            of: find.byKey(const ValueKey('sky')),
            matching: find.byType(RoomScenePill),
          ),
          findsNWidgets(2),
        );
        expect(find.byType(RoomStatusPill), findsNWidgets(2));
        expect(_inCard(DomainType.lights, find.text('lights')), findsOneWidget);
        expect(
          _inCard(DomainType.lights, find.text('3 of 4 active')),
          findsOneWidget,
        );
        expect(
          _inCard(DomainType.lights, find.byType(RoomQuickAction)),
          findsNWidgets(3),
        );
        // The sky takes 38 % of the page after its padding.
        expect(
          tester.getSize(find.byKey(const ValueKey('sky'))).width,
          closeTo(8 + 0.38 * 568, 0.01),
        );
        // Regular lists the automations in the mode details.
        expect(
          tester
              .widget<RoomModePanel>(find.byType(RoomModePanel))
              .automationsInDetails,
          isTrue,
        );
      },
    );

    testWidgets('Regular portrait: the scenes get their own row', (
      tester,
    ) async {
      final sky = _Sky();
      // M portrait: 360 × 640 less the 52 bar.
      await _pump(
        tester,
        RoomOverviewLayout(
          skyBuilder: sky.build,
          cards: _fourCards,
          scenes: _scenes,
          readings: _readings,
          modes: sources(),
          sizeClass: ScreenSizeClass.regular,
          square: false,
        ),
        size: const Size(360, 588),
      );

      expect(tester.takeException(), isNull);
      expect(sky.landscape, isFalse);
      expect(sky.footer, isFalse);
      expect(find.byType(RoomScenePill), findsNWidgets(2));
      expect(
        tester.getSize(find.byKey(const ValueKey('sky'))).height,
        (588 * 0.34).roundToDouble(),
      );
    });

    testWidgets('Expanded lists the automations on the overview instead', (
      tester,
    ) async {
      await _pump(
        tester,
        RoomOverviewLayout(
          skyBuilder: _Sky().build,
          cards: _fourCards,
          modes: sources(),
          sizeClass: ScreenSizeClass.expanded,
          square: false,
        ),
        size: const Size(864, 540),
      );

      expect(tester.takeException(), isNull);
      expect(
        tester
            .widget<RoomModePanel>(find.byType(RoomModePanel))
            .automationsInDetails,
        isFalse,
      );
      // The value is 28 on Expanded.
      final value = tester
          .widgetList<Text>(_inCard(DomainType.lights, find.byType(Text)))
          .firstWhere((text) => text.textSpan != null);
      expect(value.style!.fontSize, 28);
    });

    testWidgets(
      'the square with four domains: small cards, four to a row, no quick actions',
      (tester) async {
        await _pump(
          tester,
          RoomOverviewLayout(
            skyBuilder: _Sky().build,
            cards: _fourCards,
            modes: sources(),
            sizeClass: ScreenSizeClass.compact,
            square: true,
          ),
          size: const Size(240, 200),
        );

        expect(tester.takeException(), isNull);
        expect(find.byType(RoomQuickAction), findsNothing);
        final tops = [
          for (final domain in [
            DomainType.lights,
            DomainType.climate,
            DomainType.shading,
            DomainType.media,
          ])
            tester
                .getTopLeft(find.byKey(ValueKey('room-card-${domain.name}')))
                .dy,
        ];
        expect(tops.toSet(), hasLength(1));
        // The square's sky: 38 % of the page.
        expect(
          tester.getSize(find.byKey(const ValueKey('sky'))).height,
          (200 * 0.38).roundToDouble(),
        );
      },
    );

    testWidgets(
      'holds at 208 wide: two quick actions per card, each at least 36 wide',
      (tester) async {
        // The 4″ tall panel: 208 × 348 less the 44 bar.
        await _pump(
          tester,
          RoomOverviewLayout(
            skyBuilder: _Sky().build,
            cards: _fourCards,
            scenes: _scenes,
            readings: _readings,
            modes: sources(status: 'partial'),
            sizeClass: ScreenSizeClass.compact,
            square: false,
          ),
          size: const Size(208, 304),
        );

        expect(tester.takeException(), isNull);
        final actions = find.byType(RoomQuickAction);
        expect(actions, findsNWidgets(8));
        for (final action in actions.evaluate()) {
          expect(
            tester.getSize(find.byWidget(action.widget)).width,
            greaterThanOrEqualTo(36),
          );
          expect(
            tester.getSize(find.byWidget(action.widget)).height,
            greaterThanOrEqualTo(36),
          );
        }
        // The short portrait share.
        expect(
          tester.getSize(find.byKey(const ValueKey('sky'))).height,
          (304 * 0.3).roundToDouble(),
        );
        // A partial outcome marks the mode button.
        expect(
          find.byKey(const ValueKey('room-mode-attention')),
          findsOneWidget,
        );
      },
    );

    testWidgets('enlarged text scrolls the room mode, keeps the cards', (
      tester,
    ) async {
      await _pump(
        tester,
        RoomOverviewLayout(
          skyBuilder: _Sky().build,
          cards: _fourCards,
          readings: _readings,
          modes: sources(),
          sizeClass: ScreenSizeClass.regular,
          square: false,
        ),
        size: const Size(480, 280),
        textScale: 2.5,
      );

      expect(tester.takeException(), isNull);
      expect(
        tester.getSize(find.byKey(const ValueKey('room-card-lights'))).height,
        greaterThan(0),
      );
    });
  });

  group('climate target', () {
    DomainCardInfo climate() => DomainCardInfo(
      domain: DomainType.climate,
      icon: DomainType.climate.icon,
      title: 'Climate',
      primaryValue: '21.5',
      unit: '°',
      target: '22°',
      subtitle: 'Heating',
      spokenSubtitle: 'Heating to 22°',
    );

    for (final (sizeClass, square) in [
      (ScreenSizeClass.compact, false),
      (ScreenSizeClass.compact, true),
      (ScreenSizeClass.regular, false),
    ]) {
      testWidgets(
        'on ${sizeClass.name}${square ? ' square' : ''} the target sits under the value',
        (tester) async {
          final handle = tester.ensureSemantics();
          await _pump(
            tester,
            Column(
              children: [
                SizedBox(
                  width: 164,
                  height: 101,
                  child: RoomDomainCard(
                    card: climate(),
                    small: square,
                    onOpen: () {},
                    sizeClass: sizeClass,
                  ),
                ),
              ],
            ),
            size: const Size(240, 200),
          );

          expect(tester.takeException(), isNull);
          expect(
            find.byKey(const ValueKey('room-card-target')),
            findsOneWidget,
          );
          expect(find.text('22°'), findsOneWidget);
          // The state line fits: no "Heating to …".
          expect(
            find.text('Heating'),
            sizeClass == ScreenSizeClass.regular
                ? findsOneWidget
                : findsNothing,
          );
          final node = tester.getSemantics(
            find.bySemanticsLabel(RegExp('^Climate, 21.5°')),
          );
          expect(node.value, 'Heating to 22°');
          handle.dispose();
        },
      );
    }
  });

  group('states', () {
    testWidgets('one domain is one card at its own height', (tester) async {
      await _pump(
        tester,
        RoomOverviewLayout(
          skyBuilder: _Sky().build,
          cards: [_card(DomainType.lights)],
          sizeClass: ScreenSizeClass.regular,
          square: false,
        ),
        size: const Size(360, 588),
      );

      expect(
        tester.getSize(find.byKey(const ValueKey('room-card-lights'))).height,
        92,
      );
    });

    testWidgets('no cards keeps the sky and says why', (tester) async {
      await _pump(
        tester,
        RoomOverviewLayout(
          skyBuilder: _Sky().build,
          sizeClass: ScreenSizeClass.regular,
          square: false,
        ),
        size: const Size(576, 400),
      );
      expect(find.byKey(const ValueKey('sky')), findsOneWidget);
      expect(find.text('Nothing to control here'), findsOneWidget);

      await _pump(
        tester,
        RoomOverviewLayout(
          skyBuilder: _Sky().build,
          notSetUp: true,
          sizeClass: ScreenSizeClass.regular,
          square: false,
        ),
        size: const Size(576, 400),
      );
      expect(find.text('This room is not set up yet'), findsOneWidget);
      // A room without devices: add them first, then give them roles.
      expect(
        find.text(
          'Add devices to this room in the admin app and give them a role, and they will show up here.',
        ),
        findsOneWidget,
      );
    });

    testWidgets('loading shows skeleton blocks; an error offers Try again', (
      tester,
    ) async {
      final handle = tester.ensureSemantics();
      await _pump(
        tester,
        RoomOverviewLayout(
          skyBuilder: _Sky().build,
          body: RoomOverviewBody.loading,
          cards: _fourCards,
          sizeClass: ScreenSizeClass.regular,
          square: false,
        ),
        size: const Size(576, 400),
      );
      expect(find.byKey(const ValueKey('sky')), findsOneWidget);
      expect(find.byType(RoomDomainCard), findsNothing);
      expect(find.bySemanticsLabel('Loading'), findsOneWidget);

      var retried = 0;
      final sky = _Sky();
      await _pump(
        tester,
        RoomOverviewLayout(
          skyBuilder: sky.build,
          body: RoomOverviewBody.error,
          scenes: _scenes,
          onRetry: () => retried++,
          sizeClass: ScreenSizeClass.regular,
          square: false,
        ),
        size: const Size(576, 400),
      );
      expect(find.byKey(const ValueKey('sky')), findsOneWidget);
      expect(find.text('This room did not load'), findsOneWidget);
      // Scenes cannot run while the room has not loaded.
      expect(sky.footer, isFalse);
      expect(find.byType(RoomScenePill), findsNothing);
      await tester.tap(find.text('Try again'));
      expect(retried, 1);
      handle.dispose();
    });

    testWidgets('a card opens its domain; a quick action runs', (tester) async {
      final opened = <DomainType>[];
      final actions = <QuickActionType>[];
      await _pump(
        tester,
        RoomOverviewLayout(
          skyBuilder: _Sky().build,
          cards: _fourCards,
          onOpenDomain: opened.add,
          onAction: actions.add,
          sizeClass: ScreenSizeClass.regular,
          square: false,
        ),
        size: const Size(576, 400),
      );

      await tester.tap(_inCard(DomainType.climate, find.text('climate')));
      await tester.tap(_inCard(DomainType.lights, find.text('100%')));
      expect(opened, [DomainType.climate]);
      expect(actions, [QuickActionType.lightsFull]);
    });
  });

  group('review round 1', () {
    testWidgets('the whole card opens its domain, even its padding', (
      tester,
    ) async {
      final opened = <DomainType>[];
      final actions = <QuickActionType>[];
      await _pump(
        tester,
        RoomOverviewLayout(
          skyBuilder: _Sky().build,
          cards: [_card(DomainType.lights)],
          onOpenDomain: opened.add,
          onAction: actions.add,
          sizeClass: ScreenSizeClass.compact,
          square: false,
        ),
        size: const Size(240, 356),
      );

      // The card's top-left corner, inside its padding: not the head.
      final card = tester.getRect(
        find.byKey(const ValueKey('room-card-lights')),
      );
      await tester.tapAt(card.topLeft + const Offset(3, 3));
      // Between the head and the actions.
      await tester.tapAt(Offset(card.center.dx, card.bottom - 3));
      expect(opened, [DomainType.lights, DomainType.lights]);

      // A quick action still runs alone.
      await tester.tap(_inCard(DomainType.lights, find.text('Off')));
      expect(opened, hasLength(2));
      expect(actions, [QuickActionType.lightsOff]);
    });

    testWidgets('a lone card scrolls under the mode button on the square', (
      tester,
    ) async {
      // The square: 200 for the page, 76 for the sky, 112 for the content.
      await _pump(
        tester,
        RoomOverviewLayout(
          skyBuilder: _Sky().build,
          cards: [_card(DomainType.lights)],
          modes: sources(),
          sizeClass: ScreenSizeClass.compact,
          square: true,
        ),
        size: const Size(240, 200),
      );

      expect(tester.takeException(), isNull);
      expect(
        tester.getSize(find.byKey(const ValueKey('room-card-lights'))).height,
        80,
      );
    });

    testWidgets(
      'without modes the control stays for the schedule, occupancy and automations',
      (tester) async {
        final schedule = ModeScheduleRepository(dio: dio)
          ..state = ModeScheduleState.fromJson({
            'space_id': _space,
            'enabled': true,
            'timezone': 'Europe/Prague',
            'status': 'running',
            'manual_override': false,
            'current': null,
            'next': {
              'entry_id': 'next',
              'mode': 'sleep',
              'time': '22:30',
              'local_date': '2026-11-21',
              'timezone': 'Europe/Prague',
              'occurs_at': '2026-11-21T21:30:00Z',
            },
            'last_attempt': null,
            'last_attempt_status': null,
          })
          ..fresh = true;
        addTearDown(schedule.dispose);
        final noModes = ActivityModesRepository(dio: dio)..fresh = true;
        addTearDown(noModes.dispose);

        await _pump(
          tester,
          RoomOverviewLayout(
            skyBuilder: _Sky().build,
            cards: _fourCards,
            modes: RoomModeSources(
              spaceId: _space,
              activity: noModes,
              schedule: schedule,
            ),
            sizeClass: ScreenSizeClass.regular,
            square: false,
          ),
          size: const Size(576, 400),
        );

        // The line and the details button, without label or chips.
        expect(find.text('Sleep at 22:30'), findsOneWidget);
        expect(find.byType(RoomModeDetailsButton), findsOneWidget);
        expect(find.byType(RoomModeChip), findsNothing);
        expect(find.text('ROOM MODE'), findsNothing);

        // Compact: a details button opens them.
        await _pump(
          tester,
          RoomOverviewLayout(
            skyBuilder: _Sky().build,
            cards: _fourCards,
            modes: RoomModeSources(
              spaceId: _space,
              activity: noModes,
              schedule: schedule,
            ),
            sizeClass: ScreenSizeClass.compact,
            square: false,
          ),
          size: const Size(350, 240),
        );
        await tester.tap(find.byType(RoomModeDetailsButton));
        await tester.pumpAndSettle();
        expect(find.byKey(const ValueKey('schedule-next')), findsOneWidget);
        expect(
          find.byKey(const ValueKey('room-mode-option-manual')),
          findsNothing,
        );
      },
    );

    testWidgets('automations alone keep the control below Expanded', (
      tester,
    ) async {
      final repository = AutomationsRepository(
        apiClient: ApiClient(Dio()).automationsModule,
      );
      final automations = AutomationsService(repository: repository);
      addTearDown(automations.dispose);
      repository.insert([
        {
          'id': 'a',
          'name': 'Evening lights',
          'description': null,
          'icon': null,
          'enabled': true,
          'space_id': _space,
          'mode': 'restart',
          'revision': 1,
          'status': 'ok',
          'last_triggered_at': null,
          'last_run_status': null,
          'created_at': '2026-11-01T00:00:00Z',
          'updated_at': null,
        },
      ]);
      final noModes = ActivityModesRepository(dio: dio)..fresh = true;
      addTearDown(noModes.dispose);
      final modes = RoomModeSources(
        spaceId: _space,
        activity: noModes,
        automations: automations,
      );

      await _pump(
        tester,
        RoomOverviewLayout(
          skyBuilder: _Sky().build,
          cards: _fourCards,
          modes: modes,
          sizeClass: ScreenSizeClass.regular,
          square: false,
        ),
        size: const Size(576, 400),
      );
      expect(find.byType(RoomModeDetailsButton), findsOneWidget);
      await tester.tap(find.byType(RoomModeDetailsButton));
      await tester.pumpAndSettle();
      expect(find.text('Evening lights'), findsOneWidget);
    });

    testWidgets(
      'the details follow the selection while open: header, outcome and Retry',
      (tester) async {
        adapter.status = 'failed';
        final activity = ActivityModesRepository(dio: dio);
        addTearDown(activity.dispose);
        await tester.runAsync(() => activity.bind(_space));
        final modes = RoomModeSources(spaceId: _space, activity: activity);

        await _pump(
          tester,
          RoomOverviewLayout(
            skyBuilder: _Sky().build,
            cards: _fourCards,
            modes: modes,
            sizeClass: ScreenSizeClass.regular,
            square: false,
          ),
          size: const Size(576, 400),
        );
        await tester.tap(find.byType(RoomModeDetailsButton));
        await tester.pumpAndSettle();
        expect(find.text('Room mode: Work'), findsOneWidget);
        expect(find.text('Retry Work'), findsOneWidget);

        // Another panel selects Relax while the details are open.
        adapter
          ..mode = 'relax'
          ..status = 'active';
        await tester.runAsync(activity.refresh);
        await tester.pumpAndSettle();

        expect(find.text('Room mode: Relax'), findsOneWidget);
        expect(find.text('Room mode: Work'), findsNothing);
        expect(find.text('Retry Work'), findsNothing);
      },
    );
  });

  group('review round 2', () {
    testWidgets('Compact keeps the energy pill, at the end of the mode row', (
      tester,
    ) async {
      var opened = 0;
      await _pump(
        tester,
        RoomOverviewLayout(
          skyBuilder: _Sky().build,
          cards: _fourCards,
          scenes: _scenes,
          readings: _readings,
          modes: sources(),
          energyPill: RoomStatusPill(
            key: const ValueKey('energy'),
            icon: MdiIcons.flashOutline,
            text: '4.2 kWh',
            onTap: () => opened++,
            sizeClass: ScreenSizeClass.compact,
          ),
          sizeClass: ScreenSizeClass.compact,
          square: false,
        ),
        size: const Size(400, 240),
      );

      final energy = find.byKey(const ValueKey('energy'));
      expect(energy, findsOneWidget);
      // In the row with the room mode button, after the scenes.
      expect(
        tester.getCenter(energy).dy,
        moreOrLessEquals(
          tester.getCenter(find.byType(RoomModeButton)).dy,
          epsilon: 1,
        ),
      );
      await tester.ensureVisible(energy);
      await tester.pumpAndSettle();
      await tester.tap(energy);
      expect(opened, 1);
    });

    testWidgets('Compact shows the energy pill without modes or scenes', (
      tester,
    ) async {
      await _pump(
        tester,
        RoomOverviewLayout(
          skyBuilder: _Sky().build,
          cards: _fourCards,
          energyPill: RoomStatusPill(
            key: const ValueKey('energy'),
            icon: MdiIcons.flashOutline,
            text: '4.2 kWh',
            onTap: () {},
            sizeClass: ScreenSizeClass.compact,
          ),
          sizeClass: ScreenSizeClass.compact,
          square: false,
        ),
        size: const Size(400, 240),
      );

      expect(find.byKey(const ValueKey('energy')), findsOneWidget);
    });

    testWidgets(
      'a short landscape sky with enlarged text scrolls: weather and scenes '
      'stay reachable',
      (tester) async {
        var weather = 0;
        final ran = <String>[];

        Widget sky(
          BuildContext context, {
          required bool landscape,
          required ScreenSizeClass sizeClass,
          String? readings,
          Widget Function(BuildContext context, SkyLook look)? footer,
        }) => SkyPanelView(
          look: SkyLook.of(SkyDayPart.day, SkyWeather.partlyCloudy),
          time: '12:11',
          date: 'Saturday 21 November',
          weather: SkyWeatherInfo(
            temperature: '6°',
            label: 'Partly cloudy',
            icon: MdiIcons.weatherPartlyCloudy,
          ),
          readings: readings,
          onWeatherTap: () => weather++,
          landscape: landscape,
          sizeClass: sizeClass,
          footer: footer,
        );

        await _pump(
          tester,
          RoomOverviewLayout(
            skyBuilder: sky,
            cards: _fourCards,
            scenes: _scenes,
            readings: _readings,
            onScene: ran.add,
            sizeClass: ScreenSizeClass.regular,
            square: false,
          ),
          size: const Size(480, 280),
          textScale: 2.5,
        );

        expect(tester.takeException(), isNull);

        final card = find.byType(SkyWeatherCard);
        await tester.ensureVisible(card);
        await tester.pumpAndSettle();
        await tester.tap(card);
        expect(weather, 1);

        final dinner = find.byKey(const ValueKey('room-scene-dinner'));
        await tester.ensureVisible(dinner);
        await tester.pumpAndSettle();
        await tester.tap(dinner);
        expect(ran, ['dinner']);
      },
    );

    testWidgets('the footer still sits at the foot of a tall sky', (
      tester,
    ) async {
      await _pump(
        tester,
        SkyPanelView(
          look: SkyLook.of(SkyDayPart.day, SkyWeather.clear),
          time: '12:11',
          date: 'Saturday 21 November',
          landscape: true,
          sizeClass: ScreenSizeClass.regular,
          footer: (context, look) =>
              const SizedBox(key: ValueKey('footer'), height: 36),
        ),
        size: const Size(240, 400),
      );

      // The panel's foot less its 12 px padding.
      expect(
        tester.getBottomLeft(find.byKey(const ValueKey('footer'))).dy,
        moreOrLessEquals(400 - 12, epsilon: 0.5),
      );
    });
  });

  group('room mode on Compact', () {
    testWidgets(
      'the button opens the chooser; choosing a mode sends it and closes it',
      (tester) async {
        adapter.status = 'partial';
        final activity = ActivityModesRepository(dio: dio);
        addTearDown(activity.dispose);
        await tester.runAsync(() => activity.bind(_space));
        adapter.requests.clear();
        final modes = RoomModeSources(spaceId: _space, activity: activity);
        await _pump(
          tester,
          RoomOverviewLayout(
            skyBuilder: _Sky().build,
            cards: _fourCards,
            modes: modes,
            sizeClass: ScreenSizeClass.compact,
            square: false,
          ),
          size: const Size(240, 356),
        );

        await tester.tap(find.byType(RoomModeButton));
        await tester.pumpAndSettle();

        expect(find.text('Room mode'), findsOneWidget);
        expect(
          find.byKey(const ValueKey('room-mode-option-work')),
          findsOneWidget,
        );
        expect(
          find.byKey(const ValueKey('room-mode-option-manual')),
          findsOneWidget,
        );
        // The outcome and the per-part results are in the chooser too.
        expect(find.text('Partial · Shading did not finish'), findsWidgets);

        await tester.tap(find.byKey(const ValueKey('room-mode-option-relax')));
        await tester.pumpAndSettle();

        expect(find.byType(RoomModeDetails), findsNothing);
        final post = adapter.requests.where((r) => r.method == 'POST').single;
        expect(post.path, endsWith('/relax/activate'));
        expect(modes.activity.state?.selectedActivityMode?.json, 'relax');
      },
    );
  });
}
