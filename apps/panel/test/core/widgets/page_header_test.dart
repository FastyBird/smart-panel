import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/icon_container.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_power_button.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

const _classes = [
  ScreenSizeClass.compact,
  ScreenSizeClass.regular,
  ScreenSizeClass.expanded,
];

const _brightnesses = [Brightness.light, Brightness.dark];

// Design values from docs/display-ui-design-spec.md §4 and the canvas.
const _height = {
  ScreenSizeClass.compact: 36.0,
  ScreenSizeClass.regular: 40.0,
  ScreenSizeClass.expanded: 48.0,
};
const _padding = {
  ScreenSizeClass.compact: 6.0,
  ScreenSizeClass.regular: 8.0,
  ScreenSizeClass.expanded: 12.0,
};
const _title = {
  ScreenSizeClass.compact: 14.0,
  ScreenSizeClass.regular: 16.0,
  ScreenSizeClass.expanded: 18.0,
};
const _state = {
  ScreenSizeClass.compact: 10.0,
  ScreenSizeClass.regular: 10.0,
  ScreenSizeClass.expanded: 12.0,
};
const _tile = {
  ScreenSizeClass.compact: 28.0,
  ScreenSizeClass.regular: 32.0,
  ScreenSizeClass.expanded: 40.0,
};

ThemeData _theme(Brightness brightness) => brightness == Brightness.dark
    ? AppTheme.darkThemeFor(AppAccent.blue)
    : AppTheme.lightThemeFor(AppAccent.blue);

Future<void> _pump(
  WidgetTester tester,
  Widget child, {
  Brightness brightness = Brightness.light,
  Size size = const Size(640, 400),
  NavigatorObserver? observer,
}) async {
  tester.view.physicalSize = size;
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
      navigatorObservers: [if (observer != null) observer],
      home: Scaffold(body: Column(children: [child])),
    ),
  );
}

TextStyle _style(WidgetTester tester, String text) =>
    tester.widget<Text>(find.text(text)).style!;

/// The decoration of the button's surface.
ShapeBorder _buttonShape(WidgetTester tester, Finder button) => tester
    .widget<Material>(find.descendant(of: button, matching: find.byType(Material)).first)
    .shape!;

Color _buttonFill(WidgetTester tester, Finder button) => tester
    .widget<Material>(find.descendant(of: button, matching: find.byType(Material)).first)
    .color!;

Color _iconColor(WidgetTester tester, Finder button) =>
    tester.widget<Icon>(find.descendant(of: button, matching: find.byType(Icon))).color!;

class _Pops extends NavigatorObserver {
  int pops = 0;

  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) => pops++;
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

  group('PageHeader', () {
    for (final sizeClass in _classes) {
      for (final brightness in _brightnesses) {
        testWidgets('lays out at ${sizeClass.name} in ${brightness.name}', (tester) async {
          await _pump(
            tester,
            PageHeader(
              sizeClass: sizeClass,
              title: 'Ceiling fan',
              subtitle: 'On · speed 2 of 5',
              icon: MdiIcons.fan,
              iconColor: ThemeColors.climate,
              onBack: () {},
              trailing: DevicePowerButton(isOn: true, onTap: () {}),
            ),
            brightness: brightness,
          );

          final neutrals = AppNeutralPalette.of(brightness);
          final padding = _padding[sizeClass]!;

          // Row height plus the page padding above and below.
          expect(
            tester.getSize(find.byType(PageHeader)).height,
            _height[sizeClass]! + 2 * padding,
          );
          expect(tester.getTopLeft(find.byType(HeaderBackButton)).dx, padding);

          final title = _style(tester, 'Ceiling fan');
          expect(title.fontSize, _title[sizeClass]);
          expect(title.fontWeight, FontWeight.w500);
          expect(title.color, neutrals.textPrimary);

          final state = _style(tester, 'On · speed 2 of 5');
          expect(state.fontSize, _state[sizeClass]);
          expect(state.color, neutrals.textSecondary);

          expect(
            tester.getSize(find.byType(HeaderMainIcon)),
            Size.square(_tile[sizeClass]!),
          );

          // Every target is at least 36 design px.
          for (final button in [
            find.byType(HeaderBackButton),
            find.byType(DevicePowerButton),
          ]) {
            expect(tester.getSize(button), const Size.square(36));
          }

          // Back button, icon tile, title and actions are 8 apart.
          expect(
            tester.getTopLeft(find.byType(HeaderMainIcon)).dx -
                tester.getTopRight(find.byType(HeaderBackButton)).dx,
            8,
          );

          final background = tester
              .widget<Container>(
                find.descendant(of: find.byType(PageHeader), matching: find.byType(Container)).first,
              )
              .decoration as BoxDecoration;
          expect(background.color, neutrals.surfacePage);
        });
      }

      testWidgets('keeps a long title on one line at ${sizeClass.name}', (tester) async {
        await _pump(
          tester,
          PageHeader(
            sizeClass: sizeClass,
            title: 'Living room ceiling light above the dining table and the sofa',
            subtitle: 'On · 80 % · warm white · scene Evening, set by the schedule',
            icon: MdiIcons.lightbulbOutline,
            onBack: () {},
            trailing: DevicePowerButton(isOn: true, onTap: () {}),
          ),
          // The narrowest Compact canvas (4″ tall panel).
          size: const Size(208, 348),
        );

        expect(tester.takeException(), isNull);
        expect(
          tester.getSize(find.byType(PageHeader)).height,
          _height[sizeClass]! + 2 * _padding[sizeClass]!,
        );
      });
    }

    testWidgets('takes the class from the screen when none is passed', (tester) async {
      // 1280 × 800 physical px is a 640 × 400 design px canvas: Regular.
      await _pump(
        tester,
        const PageHeader(title: 'Settings', icon: Icons.settings),
        size: const Size(1280, 800),
      );

      expect(locator<ScreenService>().sizeClass, ScreenSizeClass.regular);
      expect(tester.getSize(find.byType(PageHeader)).height, 40 + 2 * 8);
      expect(tester.getSize(find.byType(HeaderMainIcon)), const Size.square(32));
    });

    testWidgets('sizes a caller-built icon tile from the header class', (tester) async {
      await _pump(
        tester,
        const PageHeader(
          sizeClass: ScreenSizeClass.expanded,
          title: 'Fan',
          leading: HeaderMainIcon(icon: Icons.ac_unit),
        ),
      );

      expect(tester.getSize(find.byType(HeaderMainIcon)), const Size.square(40));
    });

    testWidgets('shows the warning state with its icon', (tester) async {
      final warning = AppStatusPalette.of(Brightness.light, AppStatus.warning).text;

      await _pump(
        tester,
        PageHeader(
          title: 'Ceiling light',
          subtitle: 'Offline',
          subtitleIcon: MdiIcons.alert,
          subtitleColor: warning,
        ),
      );

      expect(_style(tester, 'Offline').color, warning);
      expect(tester.widget<Icon>(find.byIcon(MdiIcons.alert)).color, warning);
      expect(tester.getSize(find.byIcon(MdiIcons.alert)), const Size.square(11));
    });

    testWidgets('has no leading gap without a back button or icon', (tester) async {
      await _pump(tester, const PageHeader(sizeClass: ScreenSizeClass.regular, title: 'Plain'));

      expect(tester.getTopLeft(find.text('Plain')).dx, 8);
    });

    testWidgets('shows the landscape action only in landscape', (tester) async {
      const action = SizedBox(key: ValueKey('mode'), width: 10, height: 10);

      await _pump(tester, const PageHeader(title: 'Lights', landscapeAction: action));
      expect(find.byKey(const ValueKey('mode')), findsOneWidget);

      await _pump(
        tester,
        const PageHeader(title: 'Lights', landscapeAction: action),
        size: const Size(400, 640),
      );
      expect(find.byKey(const ValueKey('mode')), findsNothing);
    });

    testWidgets('the back button calls onBack', (tester) async {
      var backs = 0;

      await _pump(tester, PageHeader(title: 'Fan', onBack: () => backs++));
      await tester.tap(find.byType(HeaderBackButton));

      expect(backs, 1);
      expect(find.byIcon(MdiIcons.chevronLeft), findsOneWidget);
    });
  });

  group('HeaderBackButton', () {
    testWidgets('pops the route without a callback', (tester) async {
      final observer = _Pops();

      await _pump(tester, const SizedBox.shrink(), observer: observer);

      final navigator = tester.state<NavigatorState>(find.byType(Navigator));
      navigator.push(
        MaterialPageRoute<void>(
          builder: (_) => const Scaffold(body: Column(children: [HeaderBackButton()])),
        ),
      );
      await tester.pumpAndSettle();

      await tester.tap(find.byType(HeaderBackButton));
      await tester.pumpAndSettle();

      expect(observer.pops, 1);
      expect(find.byType(HeaderBackButton), findsNothing);
    });

    testWidgets('is labelled for screen readers', (tester) async {
      final semantics = tester.ensureSemantics();

      var taps = 0;
      await _pump(tester, HeaderBackButton(onTap: () => taps++));

      expect(find.bySemanticsLabel('Back'), findsOneWidget);
      expect(
        tester.getSemantics(find.byType(HeaderBackButton)),
        isSemantics(label: 'Back', isButton: true, hasTapAction: true),
      );

      // A screen reader's activation reaches the callback.
      tester.semantics.tap(find.semantics.byLabel('Back'));
      expect(taps, 1);
      semantics.dispose();
    });
  });

  group('HeaderIconButton', () {
    for (final brightness in _brightnesses) {
      testWidgets('draws plain, active, accent and disabled in ${brightness.name}', (tester) async {
        await _pump(
          tester,
          Row(
            children: [
              HeaderIconButton(key: const ValueKey('plain'), icon: Icons.tune, onTap: () {}),
              HeaderIconButton(
                key: const ValueKey('active'),
                icon: Icons.tv,
                color: ThemeColors.media,
                onTap: () {},
              ),
              HeaderIconButton(
                key: const ValueKey('accent'),
                icon: Icons.layers,
                color: ThemeColors.primary,
                onTap: () {},
              ),
              const HeaderIconButton(key: ValueKey('disabled'), icon: Icons.refresh),
            ],
          ),
          brightness: brightness,
        );

        final neutrals = AppNeutralPalette.of(brightness);
        final media = ThemeColorFamily.get(brightness, ThemeColors.media);
        final accent = AppAccentPalette.of(AppAccent.blue, brightness);

        final plain = find.byKey(const ValueKey('plain'));
        expect(_buttonFill(tester, plain), neutrals.surfaceCard);
        expect(
          (_buttonShape(tester, plain) as RoundedRectangleBorder).side.color,
          neutrals.borderLight,
        );
        expect(_iconColor(tester, plain), neutrals.textPrimary);

        final active = find.byKey(const ValueKey('active'));
        expect(_buttonFill(tester, active), media.soft);
        expect((_buttonShape(tester, active) as RoundedRectangleBorder).side.color, media.base);
        expect(_iconColor(tester, active), media.base);

        final accentButton = find.byKey(const ValueKey('accent'));
        expect(_buttonFill(tester, accentButton), accent.soft);
        expect(_iconColor(tester, accentButton), accent.text);

        final disabled = find.byKey(const ValueKey('disabled'));
        expect(_buttonFill(tester, disabled), neutrals.fillLight);
        expect(_iconColor(tester, disabled), neutrals.textDisabled);

        for (final key in ['plain', 'active', 'accent', 'disabled']) {
          final button = find.byKey(ValueKey(key));
          expect(tester.getSize(button), const Size.square(36), reason: key);
          expect(
            (_buttonShape(tester, button) as RoundedRectangleBorder).borderRadius,
            BorderRadius.circular(8),
            reason: key,
          );
          expect(
            tester.getSize(find.descendant(of: button, matching: find.byType(Icon))),
            const Size.square(18),
            reason: key,
          );
        }
      });
    }

    testWidgets('is 36 design px at every class', (tester) async {
      for (final sizeClass in _classes) {
        await _pump(
          tester,
          PageHeader(
            sizeClass: sizeClass,
            title: 'Lights',
            trailing: HeaderIconButton(icon: Icons.tune, onTap: () {}),
          ),
        );

        expect(tester.getSize(find.byType(HeaderIconButton)), const Size.square(36), reason: sizeClass.name);
      }
    });
  });

  group('DevicePowerButton', () {
    testWidgets('is tinted while on, plain while off and disabled without a callback', (tester) async {
      var taps = 0;

      await _pump(
        tester,
        Row(
          children: [
            DevicePowerButton(
              key: const ValueKey('on'),
              isOn: true,
              themeColor: ThemeColors.climate,
              onTap: () => taps++,
            ),
            DevicePowerButton(key: const ValueKey('off'), isOn: false, onTap: () => taps++),
            const DevicePowerButton(key: ValueKey('none'), isOn: true),
          ],
        ),
      );

      final climate = ThemeColorFamily.get(Brightness.light, ThemeColors.climate);
      final neutrals = AppNeutralPalette.light;

      expect(_iconColor(tester, find.byKey(const ValueKey('on'))), climate.base);
      expect(_iconColor(tester, find.byKey(const ValueKey('off'))), neutrals.textPrimary);
      expect(_iconColor(tester, find.byKey(const ValueKey('none'))), neutrals.textDisabled);

      await tester.tap(find.byKey(const ValueKey('on')));
      await tester.tap(find.byKey(const ValueKey('off')));
      await tester.tap(find.byKey(const ValueKey('none')));

      expect(taps, 2);
    });

    testWidgets('says what a tap does', (tester) async {
      final semantics = tester.ensureSemantics();

      await _pump(tester, DevicePowerButton(isOn: true, onTap: () {}));
      expect(find.bySemanticsLabel('Tap to turn off'), findsOneWidget);

      await _pump(tester, DevicePowerButton(isOn: false, onTap: () {}));
      expect(find.bySemanticsLabel('Tap to turn on'), findsOneWidget);

      semantics.dispose();
    });

    testWidgets('can be activated by a screen reader only while enabled', (tester) async {
      final semantics = tester.ensureSemantics();
      var taps = 0;

      await _pump(tester, DevicePowerButton(isOn: true, onTap: () => taps++));
      expect(
        tester.getSemantics(find.byType(DevicePowerButton)),
        isSemantics(label: 'Tap to turn off', isEnabled: true, hasTapAction: true),
      );
      tester.semantics.tap(find.semantics.byLabel('Tap to turn off'));
      expect(taps, 1);

      await _pump(tester, const DevicePowerButton(isOn: true));
      expect(
        tester.getSemantics(find.byType(DevicePowerButton)),
        isSemantics(label: 'Tap to turn off', isEnabled: false, hasTapAction: false),
      );

      semantics.dispose();
    });
  });

  group('DevicePowerState', () {
    testWidgets('only shows the state while the header has the button', (tester) async {
      await _pump(tester, const DevicePowerState(isOn: true));

      expect(find.text('On'), findsOneWidget);
      expect(find.byType(DevicePowerButton), findsNothing);
    });

    testWidgets('carries the power button on a screen without a header', (tester) async {
      var taps = 0;

      await _pump(tester, DevicePowerState(isOn: false, onTap: () => taps++));

      expect(find.text('Off'), findsOneWidget);
      expect(find.byType(DevicePowerButton), findsOneWidget);

      await tester.tap(find.byType(DevicePowerButton));
      expect(taps, 1);
    });
  });

  group('IconContainer', () {
    for (final (sizeClass, circle, icon) in [
      (ScreenSizeClass.compact, 36.0, 18.0),
      (ScreenSizeClass.regular, 44.0, 22.0),
      (ScreenSizeClass.expanded, 56.0, 28.0),
    ]) {
      for (final brightness in _brightnesses) {
        testWidgets('is a $circle px circle at ${sizeClass.name} in ${brightness.name}', (tester) async {
          final status = AppStatusPalette.of(brightness, AppStatus.danger);

          await _pump(
            tester,
            IconContainer(
              screenService: locator<ScreenService>(),
              icon: Icons.error_outline,
              color: status.text,
              softColor: status.soft,
              isLandscape: false,
              sizeClass: sizeClass,
            ),
            brightness: brightness,
          );

          expect(tester.getSize(find.byType(IconContainer)), Size.square(circle));
          expect(tester.getSize(find.byType(Icon)), Size.square(icon));

          final decoration = tester
              .widget<Container>(find.descendant(of: find.byType(IconContainer), matching: find.byType(Container)))
              .decoration as BoxDecoration;
          expect(decoration.shape, BoxShape.circle);
          expect(decoration.color, status.soft);
          expect(tester.widget<Icon>(find.byType(Icon)).color, status.text);
        });
      }
    }

    testWidgets('defaults the fill to a tint of the colour', (tester) async {
      const color = Color(0xFF2563C9);

      await _pump(
        tester,
        IconContainer(
          screenService: locator<ScreenService>(),
          icon: Icons.error_outline,
          color: color,
          isLandscape: true,
        ),
      );

      final decoration = tester
          .widget<Container>(find.descendant(of: find.byType(IconContainer), matching: find.byType(Container)))
          .decoration as BoxDecoration;
      expect(
        decoration.color,
        Color.alphaBlend(color.withValues(alpha: 0.12), AppNeutralPalette.light.surfacePage),
      );
    });
  });
}
