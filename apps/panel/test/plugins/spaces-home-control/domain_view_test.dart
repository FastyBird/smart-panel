import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/app_slider.dart';
import 'package:fastybird_smart_panel/core/widgets/hero_card.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/plugins/spaces-home-control/presentation/widgets/domain_view.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// A design canvas checkpoint (docs/display-ui-design-spec.md §4) and the
/// part of it a domain view gets once the deck's dock or bar is placed.
class _Board {
  const _Board(this.name, this.width, this.height);

  final String name;
  final double width;
  final double height;

  bool get landscape => width > height;
  bool get square => width == height && width < 340;

  ScreenSizeClass get sizeClass =>
      ScreenService.sizeClassFor(width < height ? width : height);

  /// The dock (landscape) or the bar (portrait) of DR-10.
  Size get view {
    final c = sizeClass;
    if (landscape) {
      final dock = switch (c) {
        ScreenSizeClass.compact => 44.0,
        ScreenSizeClass.regular => 56.0,
        ScreenSizeClass.expanded => 84.0,
      };
      return Size(width - dock, height);
    }
    final bar = square
        ? 40.0
        : switch (c) {
            ScreenSizeClass.compact => 44.0,
            ScreenSizeClass.regular => 52.0,
            ScreenSizeClass.expanded => 56.0,
          };
    return Size(width, height - bar);
  }

  @override
  String toString() => '$name ${width.toInt()}×${height.toInt()}';
}

const _boards = [
  _Board('square', 240, 240),
  _Board('4" square', 282, 282),
  _Board('XS', 400, 240),
  _Board('S', 512, 300),
  _Board('M', 640, 360),
  _Board('M+', 640, 400),
  _Board('L', 960, 540),
  _Board('4" tall', 208, 348),
  _Board('XS portrait', 240, 400),
  _Board('S portrait', 300, 512),
  _Board('M portrait', 360, 640),
  _Board('M+ portrait', 400, 640),
  _Board('L portrait', 540, 960),
];

/// A Lights-like view: four roles, five brightness buttons and the scene
/// pills.
Widget _view(_Board board, {bool withTiles = true, bool withScenes = true}) {
  final c = board.sizeClass;
  final orientation = board.landscape
      ? Orientation.landscape
      : Orientation.portrait;

  return DomainViewLayout(
    sizeClass: c,
    orientation: orientation,
    square: board.square,
    header: PageHeader(
      sizeClass: c,
      title: 'Lights',
      subtitle: '3 of 4 on',
      leading: HeaderMainIcon(
        icon: MdiIcons.lightbulbOn,
        color: ThemeColors.lights,
        sizeClass: c,
      ),
    ),
    hero: HeroCard.slots(
      key: const ValueKey('hero'),
      fill: true,
      sizeClass: c,
      orientation: orientation,
      value: '50',
      unit: ' %',
      badge: HeroBadge(
        icon: MdiIcons.ceilingLight,
        label: 'Main',
        color: ThemeColors.lights,
        sizeClass: c,
        onTap: () {},
      ),
      feedback: HeroFeedback(
        text: 'Brightness · Main',
        sizeClass: c,
        onTap: () {},
      ),
      slider: AppSlider(
        value: 0.5,
        hero: true,
        sizeClass: c,
        color: ThemeColors.lights,
        trackGradient: AppHeroTracks.brightness(Brightness.light),
        onChanged: (_) {},
      ),
      buttons: HeroButtonRow(
        color: ThemeColors.lights,
        sizeClass: c,
        buttons: [
          HeroButtonData(
            key: const ValueKey('button-off'),
            label: 'Off',
            onTap: () {},
          ),
          HeroButtonData(
            key: const ValueKey('button-25'),
            label: '25%',
            optional: true,
            onTap: () {},
          ),
          HeroButtonData(
            key: const ValueKey('button-50'),
            label: '50%',
            selected: true,
            onTap: () {},
          ),
          HeroButtonData(
            key: const ValueKey('button-75'),
            label: '75%',
            optional: true,
            onTap: () {},
          ),
          HeroButtonData(
            key: const ValueKey('button-100'),
            label: '100%',
            onTap: () {},
          ),
        ],
      ),
    ),
    tiles: withTiles
        ? [
            for (final (name, value) in [
              ('Main', '50 %'),
              ('Task', 'Off'),
              ('Ambient', '30 %'),
              ('Accent', 'Off'),
            ])
              DomainTile(
                key: ValueKey('tile-$name'),
                name: name,
                value: value,
                color: ThemeColors.lights,
                selected: name == 'Main',
                landscape: board.landscape,
                sizeClass: c,
                onTap: () {},
              ),
          ]
        : const [],
    below: withScenes
        ? DomainPillRow(
            key: const ValueKey('scenes'),
            sizeClass: c,
            wrap: board.landscape,
            pills: [
              for (final scene in ['Bright', 'Reading', 'Movie', 'Night'])
                DomainPillData(label: scene, onTap: () {}),
            ],
          )
        : null,
    belowLabel: 'Lighting scenes',
  );
}

Future<void> _pump(
  WidgetTester tester,
  _Board board, {
  double textScale = 1,
  bool withTiles = true,
  bool withScenes = true,
}) async {
  tester.view.physicalSize = board.view;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.lightThemeFor(AppAccent.blue),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      locale: const Locale('en'),
      home: Builder(
        builder: (context) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(textScaler: TextScaler.linear(textScale)),
          child: _view(board, withTiles: withTiles, withScenes: withScenes),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

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

  group('metrics', () {
    test('tiles are 36 / 40 / 52 as rows and 44 / 52 / 60 side by side', () {
      expect(
        [
          for (final c in ScreenSizeClass.values)
            DomainViewMetrics.tileHeightFor(c, landscape: true),
        ],
        [36, 40, 52],
      );
      expect(
        [
          for (final c in ScreenSizeClass.values)
            DomainViewMetrics.tileHeightFor(c, landscape: false),
        ],
        [44, 52, 60],
      );
    });

    test('a narrow row drops its optional buttons from the end', () {
      final buttons = [
        const HeroButtonData(label: 'Off'),
        const HeroButtonData(label: '25%', optional: true),
        const HeroButtonData(label: '50%'),
        const HeroButtonData(label: '75%', optional: true),
        const HeroButtonData(label: '100%'),
      ];
      // Five fit at 196: (196 − 16) / 5 = 36.
      expect(HeroButtonRow.fitting(buttons, 196), hasLength(5));
      // Four need (w − 12) / 4 ≥ 36: 75% goes first.
      expect(HeroButtonRow.fitting(buttons, 170).map((b) => b.label), [
        'Off',
        '25%',
        '50%',
        '100%',
      ]);
      // Then 25%; Off, 50% and 100% always stay.
      expect(HeroButtonRow.fitting(buttons, 100).map((b) => b.label), [
        'Off',
        '50%',
        '100%',
      ]);
    });
  });

  group('every checkpoint', () {
    for (final board in _boards) {
      testWidgets('$board holds the hero, its controls and the tiles', (
        tester,
      ) async {
        await _pump(tester, board);
        expect(tester.takeException(), isNull);

        final hero = tester.getRect(find.byKey(const ValueKey('hero')));
        expect(hero.width, greaterThan(0));

        // Every shown hero button is a touch target.
        for (final key in [
          'button-off',
          'button-25',
          'button-50',
          'button-75',
          'button-100',
        ]) {
          final finder = find.byKey(ValueKey(key));
          if (finder.evaluate().isEmpty) {
            expect(key, isIn(['button-25', 'button-75']));
            continue;
          }
          expect(
            tester.getSize(finder).width,
            greaterThanOrEqualTo(36),
            reason: '$key on $board',
          );
        }

        final tile = find.byKey(const ValueKey('tile-Main'));
        if (board.square) {
          // The square keeps the hero alone; the roles go behind a header
          // button (spec §4, "Secondary lists").
          expect(tile, findsNothing);
          expect(find.byKey(const ValueKey('scenes')), findsNothing);
          return;
        }

        final tileRect = tester.getRect(tile);
        if (board.landscape) {
          // The list sits left of the hero, one part to its two.
          expect(tileRect.right, lessThan(hero.left));
          expect(hero.width, greaterThan(tileRect.width));
          expect(
            tileRect.height,
            DomainViewMetrics.tileHeightFor(board.sizeClass, landscape: true),
          );
        } else {
          // The tiles sit under the hero.
          expect(tileRect.top, greaterThan(hero.bottom));
          expect(tileRect.height, greaterThanOrEqualTo(44));
        }
        // The hero keeps at least the smallest numeral's room.
        expect(hero.height, greaterThan(HeroCardMetrics.numeralMin));
      });
    }
  });

  group('text scale 2', () {
    for (final board in [_boards[2], _boards[7], _boards[0], _boards[6]]) {
      testWidgets('$board does not overflow', (tester) async {
        await _pump(tester, board, textScale: 2);
        expect(tester.takeException(), isNull);
      });
    }
  });

  testWidgets('portrait tiles too narrow to share the row scroll sideways', (
    tester,
  ) async {
    await _pump(tester, _boards[7]);
    // Four tiles on 208 − 12 = 196: under 80 each, so they keep 80 and
    // scroll.
    expect(
      find.ancestor(
        of: find.byKey(const ValueKey('tile-Main')),
        matching: find.byWidgetPredicate(
          (w) =>
              w is SingleChildScrollView &&
              w.scrollDirection == Axis.horizontal,
        ),
      ),
      findsOneWidget,
    );
    expect(
      tester.getSize(find.byKey(const ValueKey('tile-Main'))).width,
      DomainViewMetrics.tileMinWidth,
    );
  });

  testWidgets('a view without tiles or pills gives the hero the whole body', (
    tester,
  ) async {
    await _pump(tester, _boards[4], withTiles: false, withScenes: false);
    final hero = tester.getRect(find.byKey(const ValueKey('hero')));
    // M: 640 − 56 dock, less 8 padding either side.
    expect(hero.width, 640 - 56 - 16);
  });
}
