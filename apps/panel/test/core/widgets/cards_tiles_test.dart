import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/base_card.dart';
import 'package:fastybird_smart_panel/core/widgets/button_tile.dart';
import 'package:fastybird_smart_panel/core/widgets/hero_card.dart';
import 'package:fastybird_smart_panel/core/widgets/offline_note.dart';
import 'package:fastybird_smart_panel/core/widgets/universal_tile.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_offline_overlay.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

const _classes = [
  ScreenSizeClass.compact,
  ScreenSizeClass.regular,
  ScreenSizeClass.expanded,
];

const _brightnesses = [Brightness.light, Brightness.dark];

// Design values from docs/display-ui-design-spec.md §3, §4 and the canvas.
const _cardPadding = {
  ScreenSizeClass.compact: 6.0,
  ScreenSizeClass.regular: 8.0,
  ScreenSizeClass.expanded: 12.0,
};

ThemeData _theme(Brightness brightness) => brightness == Brightness.dark
    ? AppTheme.darkThemeFor(AppAccent.blue)
    : AppTheme.lightThemeFor(AppAccent.blue);

Future<void> _pump(
  WidgetTester tester,
  Widget child, {
  Brightness brightness = Brightness.light,
}) async {
  tester.view.physicalSize = const Size(1280, 800);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    MaterialApp(
      theme: _theme(brightness),
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: AppLocalizations.supportedLocales,
      locale: const Locale('en'),
      home: Scaffold(body: Align(alignment: Alignment.topLeft, child: child)),
    ),
  );
}

BoxDecoration _decoration(WidgetTester tester, Finder of) => tester
    .widget<Container>(find.descendant(of: of, matching: find.byType(Container)).first)
    .decoration! as BoxDecoration;

/// The decoration a [UniversalTile] or [ButtonTileBox] draws its surface with.
BoxDecoration _tileDecoration(WidgetTester tester, Finder tile) => tester
    .widgetList<Container>(find.descendant(of: tile, matching: find.byType(Container)))
    .map((c) => c.decoration)
    .whereType<BoxDecoration>()
    .firstWhere((d) => d.border != null);

/// The hero numeral: the rich text whose plain text is [text].
TextStyle _richStyle(WidgetTester tester, String text) => (tester
        .widget<Text>(
          find.byWidgetPredicate(
            (w) => w is Text && w.textSpan?.toPlainText() == text,
          ),
        )
        .textSpan! as TextSpan)
    .style!;

Widget _hero(
  ScreenSizeClass sizeClass, {
  required double height,
  bool badge = true,
  bool offline = false,
  bool dimmed = false,
  Orientation orientation = Orientation.landscape,
  VoidCallback? onFeedbackTap,
}) =>
    SizedBox(
      width: 600,
      height: height,
      child: HeroCard.slots(
        sizeClass: sizeClass,
        orientation: orientation,
        value: '50',
        unit: ' %',
        dimmed: dimmed,
        offline: offline,
        lastSeenText: '21:10',
        badge: badge
            ? HeroBadge(
                icon: MdiIcons.lightbulbOutline,
                label: 'Main',
                color: ThemeColors.lights,
                onTap: () {},
                sizeClass: sizeClass,
              )
            : null,
        feedback: HeroFeedback(text: 'Brightness · Main', onTap: onFeedbackTap, sizeClass: sizeClass),
        slider: const SizedBox.expand(key: ValueKey('slider')),
        buttons: const SizedBox.expand(key: ValueKey('buttons')),
      ),
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

  group('BaseCard', () {
    for (final sizeClass in _classes) {
      for (final brightness in _brightnesses) {
        testWidgets('is the card surface at ${sizeClass.name} in ${brightness.name}', (tester) async {
          await _pump(
            tester,
            BaseCard(sizeClass: sizeClass, child: const SizedBox(width: 40, height: 20)),
            brightness: brightness,
          );

          final neutrals = AppNeutralPalette.of(brightness);
          final container = tester.widget<Container>(
            find.descendant(of: find.byType(BaseCard), matching: find.byType(Container)).first,
          );
          final decoration = container.decoration! as BoxDecoration;

          expect(decoration.color, neutrals.surfaceCard);
          expect((decoration.border! as Border).top.color, neutrals.borderLight);
          expect((decoration.border! as Border).top.width, 1);
          expect(decoration.borderRadius, BorderRadius.circular(8));
          expect(decoration.boxShadow, isNull);
          expect(container.padding, EdgeInsets.all(_cardPadding[sizeClass]!));
          // 40 × 20 content, the padding and the 1 px outline on each side.
          expect(
            tester.getSize(find.byType(BaseCard)),
            Size(40 + 2 * (_cardPadding[sizeClass]! + 1), 20 + 2 * (_cardPadding[sizeClass]! + 1)),
          );
        });
      }
    }

    testWidgets('keeps a caller padding', (tester) async {
      await _pump(
        tester,
        const BaseCard(padding: EdgeInsets.all(3), child: SizedBox(width: 10, height: 10)),
      );

      expect(
        tester.widget<Container>(
          find.descendant(of: find.byType(BaseCard), matching: find.byType(Container)).first,
        ).padding,
        const EdgeInsets.all(3),
      );
    });
  });

  group('HeroCard', () {
    // Height left = card − 2 × (padding + 1 px outline) − badge, slider and
    // buttons with their gaps; the numeral takes it less the feedback line,
    // clamped to 48 … 88 (Compact) or 160.
    const cases = {
      ScreenSizeClass.compact: (height: 320.0, numeral: 88.0),
      ScreenSizeClass.regular: (height: 320.0, numeral: 122.0),
      ScreenSizeClass.expanded: (height: 400.0, numeral: 160.0),
    };

    for (final sizeClass in _classes) {
      for (final brightness in _brightnesses) {
        testWidgets('sizes the numeral from the height left at ${sizeClass.name} in ${brightness.name}',
            (tester) async {
          final c = cases[sizeClass]!;
          final metrics = HeroCardMetrics.of(sizeClass);

          // Portrait: Compact landscape drops the badge.
          await _pump(
            tester,
            _hero(sizeClass, height: c.height, orientation: Orientation.portrait),
            brightness: brightness,
          );

          final neutrals = AppNeutralPalette.of(brightness);
          final style = _richStyle(tester, '50 %');
          expect(style.fontSize, c.numeral);
          expect(style.fontFamily, AppNumeralFont.family);
          expect(style.fontWeight, FontWeight.w300);
          expect(style.color, neutrals.textPrimary);

          expect(tester.getSize(find.byKey(const ValueKey('slider'))).height, metrics.sliderHeight);
          expect(tester.getSize(find.byKey(const ValueKey('buttons'))).height, metrics.buttonsHeight);
          expect(tester.getSize(find.byType(HeroBadge)).height, metrics.badgeHeight);

          final card = _decoration(tester, find.byType(BaseCard));
          expect(card.color, neutrals.surfaceCard);
          expect(
            tester.widget<Container>(
              find.descendant(of: find.byType(BaseCard), matching: find.byType(Container)).first,
            ).padding,
            EdgeInsets.all(metrics.padding),
          );
          expect(tester.takeException(), isNull);
        });
      }
    }

    test('never takes the numeral under 48 or over the class cap', () {
      expect(HeroCardMetrics.compact.numeralFor(20), 48);
      expect(HeroCardMetrics.compact.numeralFor(500), 88);
      expect(HeroCardMetrics.regular.numeralFor(500), 160);
      expect(HeroCardMetrics.expanded.numeralFor(500), 160);
      expect(HeroCardMetrics.regular.numeralFor(100), 80);
      expect(HeroCardMetrics.regular.numeralFor(100, hasFeedback: false), 100);
    });

    testWidgets('moves the value beside the badge when under 50 px are left', (tester) async {
      await _pump(tester, _hero(ScreenSizeClass.regular, height: 200));

      final style = _richStyle(tester, '50 %');
      expect(style.fontSize, HeroCardMetrics.inlineValueSize);
      expect(style.fontWeight, AppNumeralFont.value);
      expect(
        find.descendant(of: find.byType(Row), matching: find.byWidgetPredicate(
          (w) => w is Text && w.textSpan?.toPlainText() == '50 %',
        )),
        findsOneWidget,
      );
      expect(find.text('Brightness · Main'), findsNothing);
      expect(tester.takeException(), isNull);
    });

    for (final (sizeClass, orientation) in [
      (ScreenSizeClass.compact, Orientation.landscape),
      (ScreenSizeClass.regular, Orientation.landscape),
      (ScreenSizeClass.compact, Orientation.portrait),
    ]) {
      testWidgets('keeps a tappable feedback line reachable at every height at ${sizeClass.name} ${orientation.name}',
          (tester) async {
        // The light property chooser lives on this line: the inline, small
        // and scrolling layouts must not drop it like a plain caption.
        for (var height = 120.0; height <= 300; height += 6) {
          var taps = 0;
          await _pump(
            tester,
            _hero(sizeClass, height: height, orientation: orientation, onFeedbackTap: () => taps++),
          );
          expect(tester.takeException(), isNull, reason: 'at $height');
          final line = find.text('Brightness · Main');
          expect(line, findsOneWidget, reason: 'at $height');
          await tester.ensureVisible(line);
          await tester.pumpAndSettle();
          await tester.tap(line);
          expect(taps, 1, reason: 'at $height');
        }
      });
    }

    testWidgets('drops the role badge in Compact landscape only', (tester) async {
      await _pump(tester, _hero(ScreenSizeClass.compact, height: 320));
      expect(find.byType(HeroBadge), findsNothing);

      await _pump(
        tester,
        _hero(ScreenSizeClass.compact, height: 320, orientation: Orientation.portrait),
      );
      expect(find.byType(HeroBadge), findsOneWidget);

      await _pump(tester, _hero(ScreenSizeClass.regular, height: 320));
      expect(find.byType(HeroBadge), findsOneWidget);
    });

    testWidgets('drops the badge first when even the controls do not fit', (tester) async {
      // Expanded: 209 − 2 × 17 = 175 inside; badge, slider and buttons need
      // 180, without the badge 120, leaving 55 for the numeral.
      await _pump(
        tester,
        _hero(ScreenSizeClass.expanded, height: 209, orientation: Orientation.portrait),
      );

      expect(tester.takeException(), isNull);
      expect(find.byType(HeroBadge), findsNothing);
      expect(_richStyle(tester, '50 %').fontSize, HeroCardMetrics.numeralMin);
      expect(find.byType(SingleChildScrollView), findsNothing);
    });

    testWidgets('scrolls rather than overflows when the numeral cannot fit', (tester) async {
      await _pump(
        tester,
        _hero(ScreenSizeClass.expanded, height: 170, orientation: Orientation.portrait),
      );

      expect(tester.takeException(), isNull);
      expect(find.byType(HeroBadge), findsNothing);
      expect(find.byType(SingleChildScrollView), findsOneWidget);
      expect(_richStyle(tester, '50 %').fontSize, HeroCardMetrics.numeralMin);
      // Every control is still there.
      expect(find.byKey(const ValueKey('slider')), findsOneWidget);
      expect(find.byKey(const ValueKey('buttons')), findsOneWidget);
    });

    for (final sizeClass in _classes) {
      testWidgets('takes its content height inside a scroll view at ${sizeClass.name}', (tester) async {
        // Landscape, so the hero gets the scroll view's unbounded height.
        await _pump(
          tester,
          SizedBox(
            width: 600,
            height: 700,
            child: SingleChildScrollView(
              child: HeroCard.slots(
                sizeClass: sizeClass,
                orientation: Orientation.landscape,
                value: '50',
                unit: ' %',
                badge: HeroBadge(
                  icon: MdiIcons.lightbulbOutline,
                  label: 'Main',
                  color: ThemeColors.lights,
                  sizeClass: sizeClass,
                ),
                feedback: HeroFeedback(text: 'Brightness · Main', sizeClass: sizeClass),
                slider: const SizedBox.expand(key: ValueKey('slider')),
                buttons: const SizedBox.expand(key: ValueKey('buttons')),
              ),
            ),
          ),
        );

        expect(tester.takeException(), isNull);
        expect(_richStyle(tester, '50 %').fontSize, HeroCardMetrics.of(sizeClass).numeralMax);
        expect(find.byKey(const ValueKey('slider')), findsOneWidget);
        expect(find.byKey(const ValueKey('buttons')), findsOneWidget);
        expect(tester.getSize(find.byType(HeroCard)).height, lessThan(700));
      });
    }

    testWidgets('dims the numeral while pending', (tester) async {
      await _pump(tester, _hero(ScreenSizeClass.regular, height: 320, dimmed: true));

      expect(_richStyle(tester, '50 %').color, AppNeutralPalette.light.textSecondary);
    });

    testWidgets('offline: shows the note, dims the numeral and pauses the controls', (tester) async {
      await _pump(tester, _hero(ScreenSizeClass.regular, height: 360, offline: true));

      expect(find.byType(OfflineNote), findsOneWidget);
      expect(_richStyle(tester, '50 %').color, AppNeutralPalette.light.textSecondary);
      for (final key in ['slider', 'buttons']) {
        expect(
          find.ancestor(of: find.byKey(ValueKey(key)), matching: find.byType(IgnorePointer)),
          findsWidgets,
        );
      }
      expect(tester.takeException(), isNull);
    });

    testWidgets('the badge is the domain tint with the domain icon colour', (tester) async {
      var taps = 0;

      await _pump(
        tester,
        SizedBox(
          height: 36,
          child: HeroBadge(
            icon: MdiIcons.lightbulbOutline,
            label: 'Main',
            color: ThemeColors.lights,
            onTap: () => taps++,
            sizeClass: ScreenSizeClass.regular,
          ),
        ),
        brightness: Brightness.dark,
      );

      final lights = ThemeColorFamily.get(Brightness.dark, ThemeColors.lights);
      final material = tester.widget<Material>(
        find.descendant(of: find.byType(HeroBadge), matching: find.byType(Material)),
      );
      expect(material.color, lights.soft);
      expect(tester.widget<Icon>(find.byIcon(MdiIcons.lightbulbOutline)).color, lights.base);
      expect(tester.widget<Text>(find.text('Main')).style!.color, AppNeutralPalette.dark.textPrimary);

      await tester.tap(find.byType(HeroBadge));
      expect(taps, 1);
    });

    testWidgets('keeps wrapping caller content', (tester) async {
      await _pump(
        tester,
        const SizedBox(
          width: 300,
          height: 200,
          child: HeroCard(
            orientation: Orientation.landscape,
            sizeClass: ScreenSizeClass.expanded,
            child: Text('Custom'),
          ),
        ),
      );

      expect(find.text('Custom'), findsOneWidget);
      expect(
        tester.widget<Container>(
          find.descendant(of: find.byType(BaseCard), matching: find.byType(Container)).first,
        ).padding,
        const EdgeInsets.all(16),
      );
    });
  });

  group('UniversalTile', () {
    for (final brightness in _brightnesses) {
      test('colours each state in ${brightness.name}', () {
        final theme = _theme(brightness);
        final neutrals = AppNeutralPalette.of(brightness);
        final lights = ThemeColorFamily.get(brightness, ThemeColors.lights);
        final sensors = ThemeColorFamily.get(brightness, ThemeColors.sensors);
        final accent = AppAccentPalette.of(AppAccent.blue, brightness);
        final warning = AppStatusPalette.of(brightness, AppStatus.warning);

        final idle = UniversalTile.tileColors(theme, activeColor: ThemeColors.lights);
        expect(idle.background, neutrals.surfaceCard);
        expect(idle.border, neutrals.borderLight);
        expect(idle.icon, neutrals.textSecondary);
        expect(idle.text, neutrals.textPrimary);
        expect(idle.status, neutrals.textSecondary);

        final active = UniversalTile.tileColors(theme, activeColor: ThemeColors.lights, isActive: true);
        expect(active.background, lights.soft);
        expect(active.border, lights.soft);
        expect(active.icon, lights.base);
        expect(active.text, neutrals.textPrimary);

        final selected = UniversalTile.tileColors(
          theme,
          activeColor: ThemeColors.lights,
          isActive: true,
          isSelected: true,
        );
        expect(selected.background, lights.soft);
        expect(selected.border, lights.base);
        expect(selected.text, neutrals.textPrimary);

        final sensor = UniversalTile.tileColors(theme, iconAccentColor: ThemeColors.sensors);
        expect(sensor.background, neutrals.surfaceCard);
        expect(sensor.icon, sensors.base);
        expect(sensor.iconBackground, sensors.soft);

        final offline = UniversalTile.tileColors(
          theme,
          activeColor: ThemeColors.lights,
          isActive: true,
          isOffline: true,
        );
        expect(offline.background, neutrals.surfaceCard);
        expect(offline.border, neutrals.borderLight);
        expect(offline.icon, neutrals.textDisabled);
        expect(offline.text, neutrals.textPrimary);
        expect(offline.status, warning.text);
        expect(offline.badge, warning.text);

        // No domain: the panel accent.
        final accentActive = UniversalTile.tileColors(theme, isActive: true);
        expect(accentActive.background, accent.soft);
        expect(accentActive.icon, accent.text);
      });
    }

    for (final sizeClass in _classes) {
      for (final brightness in _brightnesses) {
        testWidgets('lays out horizontally at ${sizeClass.name} in ${brightness.name}', (tester) async {
          await _pump(
            tester,
            SizedBox(
              width: 200,
              height: 50,
              child: UniversalTile(
                layout: TileLayout.horizontal,
                sizeClass: sizeClass,
                icon: MdiIcons.lightbulbOutline,
                name: 'Main',
                status: '50 %',
                isActive: true,
                activeColor: ThemeColors.lights,
              ),
            ),
            brightness: brightness,
          );

          final lights = ThemeColorFamily.get(brightness, ThemeColors.lights);
          final surface = _tileDecoration(tester, find.byType(UniversalTile));
          expect(surface.color, lights.soft);
          expect(surface.borderRadius, BorderRadius.circular(8));
          expect(surface.boxShadow, isNull);

          // The icon tile is the 36 px on/off zone, radius 6.
          final iconTile = find.ancestor(
            of: find.byIcon(MdiIcons.lightbulbOutline),
            matching: find.byType(Container),
          ).first;
          expect(tester.getSize(iconTile), const Size.square(36));
          expect(
            (tester.widget<Container>(iconTile).decoration! as BoxDecoration).borderRadius,
            BorderRadius.circular(6),
          );

          final name = tester.widget<Text>(find.text('Main')).style!;
          expect(name.fontSize, sizeClass == ScreenSizeClass.expanded ? 14 : 12);
          expect(name.fontWeight, FontWeight.w500);
          expect(name.color, AppNeutralPalette.of(brightness).textPrimary);
          expect(
            tester.widget<Text>(find.text('50 %')).style!.fontSize,
            sizeClass == ScreenSizeClass.expanded ? 12 : 10,
          );
          expect(tester.takeException(), isNull);
        });
      }
    }

    testWidgets('vertical: icon over name and state', (tester) async {
      await _pump(
        tester,
        SizedBox.square(
          dimension: 96,
          child: UniversalTile(
            sizeClass: ScreenSizeClass.regular,
            icon: MdiIcons.lightbulbOutline,
            name: 'Main',
            status: '50 %',
          ),
        ),
      );

      final icon = tester.getCenter(find.byIcon(MdiIcons.lightbulbOutline));
      final name = tester.getCenter(find.text('Main'));
      final status = tester.getCenter(find.text('50 %'));
      expect(icon.dy, lessThan(name.dy));
      expect(name.dy, lessThan(status.dy));
      expect(tester.takeException(), isNull);
    });

    testWidgets('offline: warning badge in the corner, state in the warning colour', (tester) async {
      await _pump(
        tester,
        SizedBox(
          width: 200,
          height: 50,
          child: UniversalTile(
            layout: TileLayout.horizontal,
            sizeClass: ScreenSizeClass.regular,
            icon: MdiIcons.lightbulbOutline,
            name: 'Desk lamp',
            status: 'Offline · last seen 21:10',
            isOffline: true,
          ),
        ),
      );

      final warning = AppStatusPalette.of(Brightness.light, AppStatus.warning);
      final badge = find.byIcon(MdiIcons.alert);
      expect(badge, findsOneWidget);
      expect(tester.widget<Icon>(badge).color, warning.text);
      expect(tester.widget<Icon>(badge).size, UniversalTile.badgeSize);
      // Top-right corner, 4 px inside the 1 px outline.
      final tile = tester.getRect(find.byType(UniversalTile));
      final at = tester.getRect(badge);
      expect(at.top - tile.top, 5);
      expect(tile.right - at.right, 5);
      expect(
        tester.widget<Text>(find.text('Offline · last seen 21:10')).style!.color,
        warning.text,
      );
    });

    testWidgets('the icon and the body are separate tap zones', (tester) async {
      var icon = 0;
      var body = 0;

      await _pump(
        tester,
        SizedBox(
          width: 200,
          height: 50,
          child: UniversalTile(
            layout: TileLayout.horizontal,
            sizeClass: ScreenSizeClass.regular,
            icon: MdiIcons.lightbulbOutline,
            name: 'Main',
            onIconTap: () => icon++,
            onTileTap: () => body++,
          ),
        ),
      );

      await tester.tap(find.byIcon(MdiIcons.lightbulbOutline));
      await tester.tap(find.text('Main'));
      expect(icon, 1);
      expect(body, 1);
    });
  });

  group('ButtonTileWidget', () {
    Widget tile({
      double width = 88,
      double height = 88,
      int cols = 1,
      bool on = false,
      bool offline = false,
      bool disabled = false,
      VoidCallback? onTap,
      VoidCallback? onIconTap,
    }) =>
        SizedBox(
          width: width,
          height: height,
          child: ButtonTileWidget(
            onTap: onTap ?? () {},
            onIconTap: onIconTap ?? () {},
            title: 'Floor lamp',
            subTitle: const Text('On · 60 %'),
            icon: MdiIcons.lightbulbOutline,
            isOn: on,
            isOffline: offline,
            isDisabled: disabled,
            activeColor: ThemeColors.lights,
            colSpan: cols,
          ),
        );

    for (final brightness in _brightnesses) {
      testWidgets('draws off, on, offline and disabled in ${brightness.name}', (tester) async {
        final neutrals = AppNeutralPalette.of(brightness);
        final lights = ThemeColorFamily.get(brightness, ThemeColors.lights);
        final warning = AppStatusPalette.of(brightness, AppStatus.warning);

        await _pump(tester, tile(width: 200, cols: 2), brightness: brightness);
        var surface = _tileDecoration(tester, find.byType(ButtonTileBox));
        expect(surface.color, neutrals.surfaceCard);
        expect((surface.border! as Border).top.color, neutrals.borderLight);
        expect(surface.boxShadow, isNull);
        expect(tester.widget<Icon>(find.byIcon(MdiIcons.lightbulbOutline)).color, neutrals.textSecondary);

        await _pump(tester, tile(width: 200, cols: 2, on: true), brightness: brightness);
        surface = _tileDecoration(tester, find.byType(ButtonTileBox));
        expect(surface.color, lights.soft);
        expect(tester.widget<Icon>(find.byIcon(MdiIcons.lightbulbOutline)).color, lights.base);
        expect(tester.widget<Text>(find.text('Floor lamp')).style!.color, neutrals.textPrimary);

        await _pump(tester, tile(width: 200, cols: 2, on: true, offline: true), brightness: brightness);
        surface = _tileDecoration(tester, find.byType(ButtonTileBox));
        expect(surface.color, neutrals.surfaceCard);
        expect(tester.widget<Icon>(find.byIcon(MdiIcons.lightbulbOutline)).color, neutrals.textDisabled);
        expect(tester.widget<Icon>(find.byIcon(MdiIcons.alert)).color, warning.text);

        await _pump(tester, tile(width: 200, cols: 2, disabled: true), brightness: brightness);
        surface = _tileDecoration(tester, find.byType(ButtonTileBox));
        expect(surface.color, neutrals.fillLight);
        expect(tester.widget<Icon>(find.byIcon(MdiIcons.lightbulbOutline)).color, neutrals.textDisabled);
      });
    }

    testWidgets('the state line keeps the theme font', (tester) async {
      await _pump(tester, tile(width: 200, cols: 2));

      final family = _theme(Brightness.light).textTheme.bodyMedium!.fontFamily;
      expect(family, isNotNull);
      final style = DefaultTextStyle.of(tester.element(find.text('On · 60 %'))).style;
      expect(style.fontFamily, family);
      expect(style.fontSize, 10);
      expect(style.color, AppNeutralPalette.light.textSecondary);
    });

    testWidgets('pads by the cell: 4 under 60, 8 under 90, else 12', (tester) async {
      expect(ButtonTileBox.paddingFor(56), 4);
      expect(ButtonTileBox.paddingFor(88), 8);
      expect(ButtonTileBox.paddingFor(112), 12);

      await _pump(tester, tile(width: 56, height: 56));
      expect(
        find.descendant(
          of: find.byType(ButtonTileBox),
          matching: find.byWidgetPredicate(
            (w) => w is Padding && w.padding == const EdgeInsets.all(4),
          ),
        ),
        findsOneWidget,
      );
    });

    testWidgets('the icon tap zone is at least 36 px', (tester) async {
      await _pump(tester, tile(width: 56, height: 56));

      final zone = find.ancestor(
        of: find.byIcon(MdiIcons.lightbulbOutline),
        matching: find.byType(SizedBox),
      ).first;
      expect(tester.getSize(zone).shortestSide, greaterThanOrEqualTo(36));
    });

    testWidgets('the icon toggle takes focus and Enter and Space', (tester) async {
      var toggles = 0;
      var opens = 0;

      await _pump(
        tester,
        tile(width: 200, cols: 2, onTap: () => opens++, onIconTap: () => toggles++),
      );

      // The icon toggle is the tile's first focusable control.
      await tester.sendKeyEvent(LogicalKeyboardKey.tab);
      await tester.pump();
      final focused = FocusManager.instance.primaryFocus?.context;
      expect(focused, isNotNull);
      expect(
        find.descendant(
          of: find.byWidget(focused!.widget),
          matching: find.byIcon(MdiIcons.lightbulbOutline),
        ),
        findsOneWidget,
      );

      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.space);
      await tester.pump();
      expect((toggles, opens), (2, 0));

      // Offline, the icon is not a control.
      await _pump(
        tester,
        tile(width: 200, cols: 2, offline: true, onTap: () => opens++, onIconTap: () => toggles++),
      );
      expect(
        tester
            .widget<InkWell>(
              find.ancestor(of: find.byIcon(MdiIcons.lightbulbOutline), matching: find.byType(InkWell)),
            )
            .onTap,
        isNull,
      );
    });

    testWidgets('icon toggles and body opens; offline the whole tile opens', (tester) async {
      var toggles = 0;
      var opens = 0;

      await _pump(
        tester,
        tile(width: 200, cols: 2, onTap: () => opens++, onIconTap: () => toggles++),
      );
      await tester.tap(find.byIcon(MdiIcons.lightbulbOutline));
      await tester.tap(find.text('Floor lamp'));
      expect((toggles, opens), (1, 1));

      await _pump(
        tester,
        tile(width: 200, cols: 2, offline: true, onTap: () => opens++, onIconTap: () => toggles++),
      );
      await tester.tap(find.byIcon(MdiIcons.lightbulbOutline));
      expect((toggles, opens), (1, 2));
    });
  });

  group('Offline treatment', () {
    for (final sizeClass in _classes) {
      for (final brightness in _brightnesses) {
        testWidgets('the note at ${sizeClass.name} in ${brightness.name}', (tester) async {
          await _pump(
            tester,
            SizedBox(
              width: 500,
              child: OfflineNote(lastSeenText: '5 min ago', sizeClass: sizeClass),
            ),
            brightness: brightness,
          );

          final warning = AppStatusPalette.of(brightness, AppStatus.warning);
          final decoration = _decoration(tester, find.byType(OfflineNote));
          expect(decoration.color, warning.soft);
          expect((decoration.border! as Border).top.color, warning.border);
          expect(decoration.borderRadius, BorderRadius.circular(8));
          expect(tester.getSize(find.byType(OfflineNote)).height, greaterThanOrEqualTo(36));
          expect(tester.widget<Icon>(find.byIcon(MdiIcons.wifiOff)).color, warning.text);

          final expected = sizeClass == ScreenSizeClass.compact
              ? 'Offline · last seen 5 min ago. Controls paused'
              : 'Offline · last seen 5 min ago. Controls are paused until the device is back';
          final text = tester.widget<Text>(find.text(expected));
          expect(text.style!.color, AppNeutralPalette.of(brightness).textPrimary);
          expect(text.style!.fontSize, sizeClass == ScreenSizeClass.expanded ? 12 : 10);
        });
      }
    }

    testWidgets('says just "Offline" without a last-seen time', (tester) async {
      await _pump(
        tester,
        const SizedBox(width: 500, child: OfflineNote(sizeClass: ScreenSizeClass.regular)),
      );

      expect(find.text('Offline. Controls are paused until the device is back'), findsOneWidget);
    });

    testWidgets('the device detail state pauses the controls under it', (tester) async {
      var taps = 0;

      await _pump(
        tester,
        SizedBox(
          width: 400,
          height: 300,
          child: Stack(
            children: [
              Positioned.fill(
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => taps++,
                ),
              ),
              const DeviceOfflineState(
                isDark: false,
                lastSeenText: '21:10',
                sizeClass: ScreenSizeClass.regular,
              ),
            ],
          ),
        ),
      );

      await tester.tapAt(const Offset(200, 250));
      expect(taps, 0);

      // The note sits in the page padding.
      final note = tester.getRect(find.byType(OfflineNote));
      expect(note.left, 8);
      expect(note.top, 8);
      expect(find.text('Offline · last seen 21:10. Controls are paused until the device is back'), findsOneWidget);
    });
  });
}
