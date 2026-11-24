import 'dart:math' as math;

import 'package:event_bus/event_bus.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/app_slider.dart';
import 'package:fastybird_smart_panel/core/widgets/app_stepper.dart';
import 'package:fastybird_smart_panel/core/widgets/app_switch.dart';
import 'package:fastybird_smart_panel/core/widgets/card_slider.dart';
import 'package:fastybird_smart_panel/core/widgets/circular_control_dial.dart';
import 'package:fastybird_smart_panel/core/widgets/control_colors.dart';
import 'package:fastybird_smart_panel/core/widgets/icon_switch.dart';
import 'package:fastybird_smart_panel/core/widgets/intent_mode_selector.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/slider_with_steps.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_slider.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_toggle.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/models/bottom_nav_mode_config.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/deck_mode_chip.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/deck_mode_popup.dart';
import 'package:fastybird_smart_panel/modules/deck/types/swipe_event.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
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

ThemeData _theme(Brightness brightness, [AppAccent accent = AppAccent.blue]) =>
    brightness == Brightness.dark
    ? AppTheme.darkThemeFor(accent)
    : AppTheme.lightThemeFor(accent);

Future<void> _pump(
  WidgetTester tester,
  Widget child, {
  Brightness brightness = Brightness.light,
  AppAccent accent = AppAccent.blue,
}) async {
  tester.view.physicalSize = const Size(1280, 800);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    MaterialApp(
      theme: _theme(brightness, accent),
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

ThemeData _themeOf(WidgetTester tester, Finder finder) =>
    Theme.of(tester.element(finder));

SliderThemeData _sliderTheme(WidgetTester tester) =>
    SliderTheme.of(tester.element(find.byType(Slider)));

AppSliderTrackShape _track(WidgetTester tester) =>
    _sliderTheme(tester).trackShape! as AppSliderTrackShape;

AppSliderThumbShape _thumb(WidgetTester tester) =>
    _sliderTheme(tester).thumbShape! as AppSliderThumbShape;

/// The decoration of the switch's track.
BoxDecoration _switchTrack(WidgetTester tester) =>
    tester
            .widget<AnimatedContainer>(
              find.descendant(
                of: find.byType(AppSwitch),
                matching: find.byType(AnimatedContainer),
              ),
            )
            .decoration!
        as BoxDecoration;

/// The background and outline of the segment labelled [label].
({Color background, Color outline}) _segment(WidgetTester tester, String label) {
  final material = tester.widget<Material>(
    find
        .ancestor(of: find.text(label), matching: find.byType(Material))
        .first,
  );
  final shape = material.shape! as RoundedRectangleBorder;

  return (background: material.color!, outline: shape.side.color);
}

List<ModeOption<String>> _modes() => [
  ModeOption(value: 'heat', icon: MdiIcons.fire, label: 'Heat'),
  ModeOption(value: 'cool', icon: MdiIcons.snowflake, label: 'Cool'),
  ModeOption(value: 'off', icon: MdiIcons.power, label: 'Off'),
];

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
    locator.registerSingleton<EventBus>(EventBus());
  });

  tearDownAll(() async {
    await locator.reset();
  });

  group('ControlTint', () {
    for (final brightness in _brightnesses) {
      test('accent outside a domain, the domain colour inside, in ${brightness.name}', () {
        final theme = _theme(brightness, AppAccent.teal);
        final accent = AppAccentPalette.of(AppAccent.teal, brightness);

        final outside = ControlTint.of(theme);
        expect(outside.fill, accent.fill);
        expect(outside.text, accent.text);
        expect(outside.soft, accent.soft);
        expect(ControlTint.of(theme, ThemeColors.primary).fill, accent.fill);

        final climate = ThemeColorFamily.get(brightness, ThemeColors.climate);
        final inside = ControlTint.of(theme, ThemeColors.climate);
        expect(inside.fill, climate.base);
        expect(inside.text, climate.base);
        expect(inside.soft, climate.soft);

        // A filled Lights control is the warning fill in light, the bright
        // shade on dark surfaces (spec §2).
        expect(
          ControlTint.of(theme, ThemeColors.lights).fill,
          brightness == Brightness.light
              ? AppStatusPalette.of(brightness, AppStatus.warning).fill
              : ThemeColorFamily.get(brightness, ThemeColors.lights).base,
        );
      });
    }
  });

  group('AppSlider', () {
    for (final brightness in _brightnesses) {
      testWidgets('a row slider in ${brightness.name}: fill.base track, accent fill, white thumb', (tester) async {
        await _pump(
          tester,
          SizedBox(width: 300, child: AppSlider(value: 0.5, onChanged: (_) {})),
          brightness: brightness,
        );

        final neutrals = AppNeutralPalette.of(brightness);
        final accent = AppAccentPalette.of(AppAccent.blue, brightness);

        expect(tester.getSize(find.byType(AppSlider)).height, AppSliderMetrics.row.height);
        expect(_sliderTheme(tester).trackHeight, AppSliderMetrics.row.track);
        expect(_track(tester).background, neutrals.fillBase);
        expect(_track(tester).fill, accent.fill);
        expect(_track(tester).gradient, isNull);
        expect(_thumb(tester).radius, AppSliderMetrics.row.thumb / 2);
        expect(_thumb(tester).fill, AppControlColors.thumb);
        expect(_thumb(tester).ring, accent.fill);
        expect(_thumb(tester).ringWidth, AppSliderMetrics.ring);
        expect(_thumb(tester).dashed, isFalse);
      });

      testWidgets('a domain slider takes the domain colour in ${brightness.name}', (tester) async {
        await _pump(
          tester,
          SizedBox(
            width: 300,
            child: AppSlider(value: 0.5, color: ThemeColors.shading, onChanged: (_) {}),
          ),
          brightness: brightness,
        );

        final shading = ThemeColorFamily.get(brightness, ThemeColors.shading).base;
        expect(_track(tester).fill, shading);
        expect(_thumb(tester).ring, shading);
      });
    }

    for (final sizeClass in _classes) {
      for (final brightness in _brightnesses) {
        testWidgets('the hero slider at ${sizeClass.name} in ${brightness.name}', (tester) async {
          final metrics = AppSliderMetrics.hero(sizeClass);

          await _pump(
            tester,
            SizedBox(
              width: 300,
              child: AppSlider(
                value: 0.4,
                hero: true,
                sizeClass: sizeClass,
                color: ThemeColors.lights,
                onChanged: (_) {},
              ),
            ),
            brightness: brightness,
          );

          // Track, thumb and height follow the hero's slider slot.
          expect(tester.getSize(find.byType(AppSlider)).height, metrics.height);
          expect(_sliderTheme(tester).trackHeight, metrics.track);
          expect(_thumb(tester).radius, metrics.thumb / 2);
          expect(
            _track(tester).fill,
            ControlTint.of(_theme(brightness), ThemeColors.lights).fill,
          );
        });
      }
    }

    testWidgets('hero sliders are 48 high (the touch floor) with 24 / 28 / 32 thumbs', (tester) async {
      expect(
        _classes.map((c) => AppSliderMetrics.hero(c).height),
        [48, 48, 48],
      );
      expect(
        _classes.map((c) => AppSliderMetrics.hero(c).thumb),
        [24, 28, 32],
      );
      expect(
        _classes.map((c) => AppSliderMetrics.hero(c).track),
        [12, 14, 16],
      );
    });

    for (final brightness in _brightnesses) {
      testWidgets('pending, not confirmed and disabled thumbs in ${brightness.name}', (tester) async {
        final theme = _theme(brightness);
        final neutrals = theme.neutrals;

        for (final (state, ring) in [
          (ControlState.pending, neutrals.textSecondary),
          (ControlState.unconfirmed, theme.status(AppStatus.warning).text),
          (ControlState.disabled, neutrals.textDisabled),
        ]) {
          await _pump(
            tester,
            SizedBox(
              width: 300,
              child: AppSlider(value: 0.5, state: state, onChanged: (_) {}),
            ),
            brightness: brightness,
          );

          expect(_thumb(tester).dashed, isTrue, reason: state.name);
          expect(_thumb(tester).ring, ring, reason: state.name);
          expect(_thumb(tester).fill, neutrals.surfaceCard, reason: state.name);
          expect(_thumb(tester).ringWidth, AppSliderMetrics.dashedRing);
        }

        // Disabled: the fill is text.disabled and the slider does not move.
        expect(_track(tester).fill, neutrals.textDisabled);
        expect(tester.widget<Slider>(find.byType(Slider)).onChanged, isNull);
      });
    }

    testWidgets('a disabled slider drops its gradient', (tester) async {
      final gradient = [AppColors.black, AppColors.white];

      await _pump(
        tester,
        SizedBox(
          width: 300,
          child: AppSlider(value: 0.5, trackGradient: gradient, onChanged: (_) {}),
        ),
      );
      expect(_track(tester).gradient, gradient);

      await _pump(
        tester,
        SizedBox(width: 300, child: AppSlider(value: 0.5, trackGradient: gradient)),
      );
      expect(_track(tester).gradient, isNull);
    });

    testWidgets('a tap sets the value; the thumb travels inside the track', (tester) async {
      double? value;
      await _pump(
        tester,
        SizedBox(width: 322, child: AppSlider(value: 0, onChanged: (v) => value = v)),
      );

      // 322 wide less a thumb (22) is 300 of travel, starting at 11.
      final left = tester.getTopLeft(find.byType(AppSlider));
      await tester.tapAt(left + const Offset(11 + 75, 18));
      await tester.pump();
      expect(value, closeTo(0.25, 0.01));

      await tester.tapAt(left + const Offset(321, 18));
      await tester.pump();
      expect(value, 1.0);
    });

    testWidgets('takes focus and steps with the arrow keys', (tester) async {
      var value = 0.5;
      await _pump(
        tester,
        StatefulBuilder(
          builder: (context, setState) => SizedBox(
            width: 300,
            child: AppSlider(
              value: value,
              divisions: 10,
              onChanged: (v) => setState(() => value = v),
            ),
          ),
        ),
      );

      await tester.sendKeyEvent(LogicalKeyboardKey.tab);
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowRight);
      await tester.pump();

      expect(value, closeTo(0.6, 0.001));
    });

    testWidgets('a keyboard-focused slider rings its thumb; touch shows no ring', (tester) async {
      await _pump(
        tester,
        SizedBox(width: 300, child: AppSlider(value: 0.5, onChanged: (_) {})),
      );
      expect(_thumb(tester).focusRing, isNull);

      await tester.sendKeyEvent(LogicalKeyboardKey.tab);
      await tester.pump();
      expect(_thumb(tester).focusRing, AppAccentPalette.of(AppAccent.blue, Brightness.light).fill);

      // A touch puts focus highlighting away.
      await tester.tap(find.byType(Slider));
      await tester.pump();
      expect(_thumb(tester).focusRing, isNull);
    });

    testWidgets('CardSlider follows the device again after a disable mid-drag', (tester) async {
      Widget card(double value, ControlState state) => SizedBox(
        width: 300,
        child: CardSlider(label: 'Speed', value: value, state: state, onChanged: (_) {}),
      );
      await _pump(tester, card(0.4, ControlState.idle));

      final gesture = await tester.startGesture(tester.getCenter(find.byType(Slider)));
      await gesture.moveBy(const Offset(40, 0));
      await tester.pump();
      await _pump(tester, card(0.4, ControlState.disabled));
      await gesture.up();
      await tester.pump();

      await _pump(tester, card(0.8, ControlState.idle));
      expect(find.text('80 %'), findsOneWidget);
    });

    testWidgets('SliderWithSteps draws the one slider without step labels', (tester) async {
      await _pump(
        tester,
        SizedBox(
          width: 300,
          child: SliderWithSteps(
            value: 0.5,
            steps: const ['Off', 'Low', 'High'],
            discrete: true,
            themeColor: ThemeColors.climate,
            thumbBorderColor: AppColors.black,
            onChanged: (_) {},
          ),
        ),
      );

      expect(find.byType(AppSlider), findsOneWidget);
      expect(find.text('Low'), findsNothing);
      expect(tester.widget<Slider>(find.byType(Slider)).divisions, 2);
      // A colour slider's ring still shows the picked colour.
      expect(_thumb(tester).ring, AppColors.black);
    });

    testWidgets('SliderWithSteps disabled is the disabled look', (tester) async {
      await _pump(
        tester,
        SizedBox(
          width: 300,
          child: SliderWithSteps(value: 0.5, enabled: false, onChanged: (_) {}),
        ),
      );

      expect(tester.widget<Slider>(find.byType(Slider)).onChanged, isNull);
      expect(_track(tester).fill, AppNeutralPalette.light.textDisabled);
    });

    testWidgets('CardSlider shows a Barlow card value and the one slider', (tester) async {
      await _pump(
        tester,
        SizedBox(
          width: 300,
          child: CardSlider(label: 'Speed', value: 0.4, onChanged: (_) {}),
        ),
      );

      final value = tester.widget<Text>(find.text('40 %'));
      expect(value.style!.fontFamily, AppNumeralFont.family);
      expect(value.style!.fontSize, 18);
      expect(value.style!.fontWeight, AppNumeralFont.value);
      expect(find.byType(AppSlider), findsOneWidget);
      expect(find.text('Off'), findsNothing);
    });

    testWidgets('SettingsSlider is the accent slider between its icons', (tester) async {
      await _pump(
        tester,
        SizedBox(
          width: 300,
          child: SettingsSlider(
            value: 0.7,
            iconSmall: MdiIcons.brightness5,
            iconLarge: MdiIcons.brightness7,
            onChanged: (_) {},
          ),
        ),
        accent: AppAccent.rose,
      );

      expect(_track(tester).fill, AppAccentPalette.of(AppAccent.rose, Brightness.light).fill);
    });
  });

  group('AppSwitch', () {
    for (final brightness in _brightnesses) {
      testWidgets('sizes and colours in ${brightness.name}', (tester) async {
        final theme = _theme(brightness, AppAccent.violet);
        final neutrals = theme.neutrals;

        Future<void> show(bool value, {ThemeColors? color, ControlState state = ControlState.idle}) =>
            _pump(
              tester,
              AppSwitch(value: value, color: color, state: state, onChanged: (_) {}),
              brightness: brightness,
              accent: AppAccent.violet,
            );

        await show(true);
        // A 52 × 36 tap zone around a 40 × 22 track.
        expect(tester.getSize(find.byType(AppSwitch)), const Size(52, 36));
        expect(
          tester.getSize(
            find.descendant(of: find.byType(AppSwitch), matching: find.byType(AnimatedContainer)),
          ),
          const Size(40, 22),
        );
        expect(_switchTrack(tester).color, theme.accent.fill);

        await show(false);
        expect(_switchTrack(tester).color, AppControlColors.switchOff(brightness));

        await show(true, color: ThemeColors.climate);
        expect(
          _switchTrack(tester).color,
          ThemeColorFamily.get(brightness, ThemeColors.climate).base,
        );

        await show(true, state: ControlState.disabled);
        expect(_switchTrack(tester).color, neutrals.textDisabled);

        await show(false, state: ControlState.disabled);
        expect(_switchTrack(tester).color, neutrals.fillBase);
      });
    }

    testWidgets('toggles on tap, Enter and Space; never while disabled', (tester) async {
      var value = false;
      await _pump(
        tester,
        StatefulBuilder(
          builder: (context, setState) => AppSwitch(
            value: value,
            onChanged: (v) => setState(() => value = v),
          ),
        ),
      );

      await tester.tap(find.byType(AppSwitch));
      await tester.pump();
      expect(value, isTrue);

      await tester.sendKeyEvent(LogicalKeyboardKey.tab);
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pump();
      expect(value, isFalse);
      await tester.sendKeyEvent(LogicalKeyboardKey.space);
      await tester.pump();
      expect(value, isTrue);

      var calls = 0;
      await _pump(
        tester,
        AppSwitch(value: true, state: ControlState.disabled, onChanged: (_) => calls++),
      );
      await tester.tap(find.byType(AppSwitch));
      expect(calls, 0);
    });

    testWidgets('reads as a toggle to screen readers', (tester) async {
      final handle = tester.ensureSemantics();
      await _pump(
        tester,
        AppSwitch(value: true, semanticLabel: 'Screen saver', onChanged: (_) {}),
      );

      expect(
        tester.getSemantics(find.byType(AppSwitch)),
        isSemantics(
          label: 'Screen saver',
          hasToggledState: true,
          isToggled: true,
          hasEnabledState: true,
          isEnabled: true,
          hasTapAction: true,
          isFocusable: true,
          hasFocusAction: true,
        ),
      );
      handle.dispose();
    });

    testWidgets('IconSwitch and SettingsToggle draw the one switch', (tester) async {
      var value = false;
      await _pump(
        tester,
        IconSwitch(
          switchState: false,
          iconOn: MdiIcons.check,
          iconOff: MdiIcons.close,
          onChanged: (v) => value = v,
        ),
      );
      expect(find.byType(AppSwitch), findsOneWidget);
      await tester.tap(find.byType(AppSwitch));
      await tester.pumpAndSettle();
      expect(value, isTrue);
      // It flips at once.
      expect(tester.widget<AppSwitch>(find.byType(AppSwitch)).value, isTrue);

      await _pump(tester, SettingsToggle(value: true, onChanged: (_) {}));
      expect(find.byType(AppSwitch), findsOneWidget);
    });
  });

  group('AppStepper', () {
    for (final sizeClass in _classes) {
      for (final brightness in _brightnesses) {
        testWidgets('layout at ${sizeClass.name} in ${brightness.name}', (tester) async {
          await _pump(
            tester,
            AppStepper(
              value: 21.5,
              min: 10,
              max: 30,
              step: 0.5,
              unit: '°',
              sizeClass: sizeClass,
              onChanged: (_) {},
            ),
            brightness: brightness,
          );

          final neutrals = AppNeutralPalette.of(brightness);
          final buttons = find.byType(ControlRoundButton);
          expect(buttons, findsNWidgets(2));
          final side = ControlRoundButton.sizeFor(sizeClass);
          expect(tester.getSize(buttons.first), Size.square(side));
          expect(side, {ScreenSizeClass.compact: 40, ScreenSizeClass.regular: 48, ScreenSizeClass.expanded: 56}[sizeClass]);

          final button = tester.widget<Material>(
            find.descendant(of: buttons.first, matching: find.byType(Material)),
          );
          expect(button.color, neutrals.fillLight);
          expect((button.shape! as CircleBorder).side.color, neutrals.borderBase);

          final value = tester.widget<Text>(
            find.byWidgetPredicate((w) => w is Text && w.textSpan?.toPlainText() == '21.5°'),
          );
          expect(value.style!.fontFamily, AppNumeralFont.family);
          expect(value.style!.fontSize, sizeClass == ScreenSizeClass.expanded ? 28 : 18);
          expect(value.style!.color, neutrals.textPrimary);
        });
      }
    }

    testWidgets('steps, snaps and stops at the ends', (tester) async {
      var value = 29.5;
      await _pump(
        tester,
        StatefulBuilder(
          builder: (context, setState) => AppStepper(
            value: value,
            min: 10,
            max: 30,
            step: 0.5,
            onChanged: (v) => setState(() => value = v),
          ),
        ),
      );

      await tester.tap(find.byIcon(MdiIcons.plus));
      await tester.pump();
      expect(value, 30);

      // At the top, plus disables.
      final plus = tester.widget<ControlRoundButton>(
        find.ancestor(of: find.byIcon(MdiIcons.plus), matching: find.byType(ControlRoundButton)),
      );
      expect(plus.onTap, isNull);

      await tester.tap(find.byIcon(MdiIcons.minus));
      await tester.pump();
      expect(value, 29.5);
    });

    test('counts the decimals a step or minimum needs', () {
      expect(AppStepper.decimalsOf(1), 0);
      expect(AppStepper.decimalsOf(5), 0);
      expect(AppStepper.decimalsOf(0.5), 1);
      expect(AppStepper.decimalsOf(0.1), 1);
      expect(AppStepper.decimalsOf(0.25), 2);
      expect(AppStepper.decimalsOf(0.01), 2);
      expect(AppStepper.decimalsOf(0.005), 3);
      // A step with no short decimal form stops at four.
      expect(AppStepper.decimalsOf(1 / 3), 4);
    });

    testWidgets('a step under 0.1 keeps neighbouring values apart', (tester) async {
      var value = 0.21;
      await _pump(
        tester,
        StatefulBuilder(
          builder: (context, setState) => AppStepper(
            value: value,
            min: 0,
            max: 1,
            step: 0.01,
            onChanged: (v) => setState(() => value = v),
          ),
        ),
      );
      expect(find.text('0.21'), findsOneWidget);

      await tester.tap(find.byIcon(MdiIcons.plus));
      await tester.pump();
      expect(value, closeTo(0.22, 1e-9));
      expect(find.text('0.22'), findsOneWidget);
    });

    testWidgets('a range offset from its step shows and announces exact values', (tester) async {
      final handle = tester.ensureSemantics();
      var value = 0.25;
      await _pump(
        tester,
        StatefulBuilder(
          builder: (context, setState) => AppStepper(
            value: value,
            min: 0.25,
            max: 2.25,
            step: 0.5,
            semanticLabel: 'Offset',
            onChanged: (v) => setState(() => value = v),
          ),
        ),
      );
      expect(find.text('0.25'), findsOneWidget);

      await tester.tap(find.byIcon(MdiIcons.plus));
      await tester.pump();
      expect(value, 0.75);
      expect(find.text('0.75'), findsOneWidget);
      final node = tester.getSemantics(find.bySemanticsLabel(RegExp('^Offset')));
      expect(node.value, '0.75');
      expect(node.increasedValue, '1.25');
      expect(node.decreasedValue, '0.25');

      // A whole step on a half offset keeps the half.
      await _pump(
        tester,
        AppStepper(value: 1.5, min: 0.5, max: 5.5, onChanged: (_) {}),
      );
      expect(find.text('1.5'), findsOneWidget);
      handle.dispose();
    });

    testWidgets('a maximum off the step shows exactly once plus reaches it', (tester) async {
      var value = 2.0;
      await _pump(
        tester,
        StatefulBuilder(
          builder: (context, setState) => AppStepper(
            value: value,
            min: 0,
            max: 2.25,
            onChanged: (v) => setState(() => value = v),
          ),
        ),
      );

      await tester.tap(find.byIcon(MdiIcons.plus));
      await tester.pump();
      expect(value, 2.25);
      expect(find.text('2.25'), findsOneWidget);
    });

    testWidgets('the next and previous values carry the unit', (tester) async {
      final handle = tester.ensureSemantics();
      await _pump(
        tester,
        AppStepper(value: 20, min: 10, max: 30, unit: '°', semanticLabel: 'Target', onChanged: (_) {}),
      );

      final node = tester.getSemantics(find.bySemanticsLabel(RegExp('^Target')));
      expect(node.value, '20°');
      expect(node.increasedValue, '21°');
      expect(node.decreasedValue, '19°');
      handle.dispose();
    });

    testWidgets('pending, not confirmed and disabled values', (tester) async {
      final theme = _theme(Brightness.light);

      for (final (state, colour) in [
        (ControlState.pending, theme.neutrals.textSecondary),
        (ControlState.unconfirmed, theme.status(AppStatus.warning).text),
        (ControlState.disabled, theme.neutrals.textDisabled),
      ]) {
        await _pump(
          tester,
          AppStepper(value: 20, min: 10, max: 30, state: state, onChanged: (_) {}),
        );

        final value = tester.widget<Text>(
          find.byWidgetPredicate((w) => w is Text && w.textSpan?.toPlainText() == '20'),
        );
        expect(value.style!.color, colour, reason: state.name);
      }

      // Disabled: both buttons do nothing.
      for (final button in tester.widgetList<ControlRoundButton>(find.byType(ControlRoundButton))) {
        expect(button.onTap, isNull);
      }
    });
  });

  group('ModeSelector (segmented control)', () {
    for (final brightness in _brightnesses) {
      testWidgets('segments and colours in ${brightness.name}', (tester) async {
        await _pump(
          tester,
          SizedBox(
            width: 400,
            child: ModeSelector<String>(
              modes: _modes(),
              selectedValue: 'heat',
              onChanged: (_) {},
            ),
          ),
          brightness: brightness,
          accent: AppAccent.sage,
        );

        final theme = _themeOf(tester, find.byType(ModeSelector<String>));
        final neutrals = theme.neutrals;

        // 36 high, 4 apart.
        final heat = tester.getRect(find.ancestor(of: find.text('Heat'), matching: find.byType(Material)).first);
        final cool = tester.getRect(find.ancestor(of: find.text('Cool'), matching: find.byType(Material)).first);
        expect(heat.height, ModeSelector.segmentHeight);
        expect(cool.left - heat.right, ModeSelector.gap);

        // Selected: the accent's soft and text; unselected: fill.light and
        // border.light.
        expect(_segment(tester, 'Heat').background, theme.accent.soft);
        expect(_segment(tester, 'Heat').outline, theme.accent.text);
        expect(_segment(tester, 'Cool').background, neutrals.fillLight);
        expect(_segment(tester, 'Cool').outline, neutrals.borderLight);
        expect(tester.widget<Text>(find.text('Cool')).style!.color, neutrals.textPrimary);
      });

      testWidgets('inside a domain view the selected segment is the domain colour in ${brightness.name}', (tester) async {
        await _pump(
          tester,
          SizedBox(
            width: 400,
            child: ModeSelector<String>(
              modes: _modes(),
              selectedValue: 'cool',
              color: ThemeColors.climate,
              onChanged: (_) {},
            ),
          ),
          brightness: brightness,
        );

        final climate = ThemeColorFamily.get(brightness, ThemeColors.climate);
        expect(_segment(tester, 'Cool').background, climate.soft);
        expect(_segment(tester, 'Cool').outline, climate.base);
        expect(tester.widget<Text>(find.text('Cool')).style!.color, climate.base);
      });
    }

    testWidgets('pending and not confirmed mark the selected segment', (tester) async {
      await _pump(
        tester,
        SizedBox(
          width: 400,
          child: ModeSelector<String>(
            modes: _modes(),
            selectedValue: 'heat',
            state: ControlState.pending,
            onChanged: (_) {},
          ),
        ),
      );
      expect(find.byIcon(MdiIcons.refresh), findsOneWidget);

      await _pump(
        tester,
        SizedBox(
          width: 400,
          child: ModeSelector<String>(
            modes: _modes(),
            selectedValue: 'heat',
            state: ControlState.unconfirmed,
            onChanged: (_) {},
          ),
        ),
      );
      expect(find.byIcon(MdiIcons.alert), findsOneWidget);
      expect(
        tester.widget<Icon>(find.byIcon(MdiIcons.alert)).color,
        AppStatusPalette.of(Brightness.light, AppStatus.warning).text,
      );
    });

    testWidgets('disabled: every segment is plain and nothing reacts', (tester) async {
      var calls = 0;
      await _pump(
        tester,
        SizedBox(
          width: 400,
          child: ModeSelector<String>(
            modes: _modes(),
            selectedValue: 'heat',
            state: ControlState.disabled,
            onChanged: (_) => calls++,
          ),
        ),
      );

      final neutrals = AppNeutralPalette.light;
      expect(_segment(tester, 'Heat').background, neutrals.fillLight);
      expect(tester.widget<Text>(find.text('Heat')).style!.color, neutrals.textDisabled);
      await tester.tap(find.text('Cool'));
      expect(calls, 0);
    });

    testWidgets('selects on tap and on Enter', (tester) async {
      String? selected;
      await _pump(
        tester,
        SizedBox(
          width: 400,
          child: ModeSelector<String>(
            modes: _modes(),
            selectedValue: 'heat',
            onChanged: (v) => selected = v,
          ),
        ),
      );

      await tester.tap(find.text('Off'));
      expect(selected, 'off');

      await tester.sendKeyEvent(LogicalKeyboardKey.tab);
      await tester.sendKeyEvent(LogicalKeyboardKey.tab);
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pump();
      expect(selected, 'cool');
    });

    testWidgets('hides labels when a segment is narrower than its minimum', (tester) async {
      await _pump(
        tester,
        SizedBox(
          width: 150,
          child: ModeSelector<String>(
            modes: _modes(),
            selectedValue: 'heat',
            onChanged: (_) {},
          ),
        ),
      );

      expect(find.text('Heat'), findsNothing);
      expect(find.byIcon(MdiIcons.fire), findsOneWidget);
    });

    List<ModeOption<String>> manyModes() => [
      for (final (value, icon) in [
        ('a', MdiIcons.numeric1),
        ('b', MdiIcons.numeric2),
        ('c', MdiIcons.numeric3),
        ('d', MdiIcons.numeric4),
        ('e', MdiIcons.numeric5),
        ('f', MdiIcons.numeric6),
      ])
        ModeOption(value: value, icon: icon, label: value.toUpperCase()),
    ];

    testWidgets('a row too narrow for the touch floor scrolls instead of compressing', (tester) async {
      await _pump(
        tester,
        SizedBox(
          width: 150,
          child: ModeSelector<String>(modes: manyModes(), selectedValue: 'f', onChanged: (_) {}),
        ),
      );
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.byType(SingleChildScrollView), findsOneWidget);
      for (final element in find.byType(Material).evaluate()) {
        final box = element.renderObject! as RenderBox;
        if (box.size.height < 36) continue;
        expect(box.size.width, greaterThanOrEqualTo(36));
      }
      // The selected segment is scrolled into view.
      final position = tester.state<ScrollableState>(find.byType(Scrollable)).position;
      expect(position.pixels, greaterThan(0));
    });

    testWidgets('scrolls to the selection when scrolling turns on', (tester) async {
      Widget selector(bool scrollable) => SizedBox(
        width: 300,
        child: ModeSelector<String>(
          modes: manyModes(),
          selectedValue: 'f',
          scrollable: scrollable,
          showLabels: false,
          onChanged: (_) {},
        ),
      );
      await _pump(tester, selector(false));
      await tester.pumpAndSettle();
      await _pump(tester, selector(true));
      await tester.pumpAndSettle();

      final position = tester.state<ScrollableState>(find.byType(Scrollable)).position;
      expect(position.maxScrollExtent, greaterThan(0));
      expect(position.pixels, greaterThan(0));
    });

    testWidgets('centres an icon in a wider scrolling segment', (tester) async {
      await _pump(
        tester,
        SizedBox(
          width: 400,
          child: ModeSelector<String>(
            modes: _modes(),
            selectedValue: 'heat',
            scrollable: true,
            showLabels: false,
            onChanged: (_) {},
          ),
        ),
      );
      await tester.pumpAndSettle();

      final segment = tester.getRect(
        find.ancestor(of: find.byIcon(MdiIcons.fire), matching: find.byType(Material)).first,
      );
      expect(segment.width, 48);
      expect(tester.getCenter(find.byIcon(MdiIcons.fire)).dx, closeTo(segment.center.dx, 0.01));
      expect(tester.getCenter(find.byIcon(MdiIcons.fire)).dy, closeTo(segment.center.dy, 0.01));
    });

    testWidgets('screen readers hear a segment\'s value and its command outcome', (tester) async {
      final handle = tester.ensureSemantics();
      Widget selector(ControlState state) => SizedBox(
        width: 400,
        child: ModeSelector<String>(
          modes: [
            ModeOption(
              value: 'main',
              icon: MdiIcons.lightbulb,
              label: 'Main',
              semanticValue: '50%',
              labelBuilder: (isSelected, color) => const Text('Main 50%'),
            ),
            ModeOption(value: 'desk', icon: MdiIcons.deskLamp, label: 'Desk', semanticValue: 'Off'),
          ],
          selectedValue: 'main',
          state: state,
          onChanged: (_) {},
        ),
      );

      await _pump(tester, selector(ControlState.idle));
      expect(tester.getSemantics(find.bySemanticsLabel('Main')).value, '50%');
      expect(tester.getSemantics(find.bySemanticsLabel('Desk')).value, 'Off');

      await _pump(tester, selector(ControlState.pending));
      expect(tester.getSemantics(find.bySemanticsLabel('Main')).value, '50%, Sending');
      expect(tester.getSemantics(find.bySemanticsLabel('Desk')).value, 'Off');

      await _pump(tester, selector(ControlState.unconfirmed));
      expect(tester.getSemantics(find.bySemanticsLabel('Main')).value, '50%, Not confirmed');
      handle.dispose();
    });

    testWidgets('IntentModeSelector marks active, matched and last intent', (tester) async {
      await _pump(
        tester,
        SizedBox(
          width: 400,
          child: IntentModeSelector<String>(
            modes: _modes(),
            activeValue: 'heat',
            lastIntentValue: 'off',
            color: ThemeColors.lights,
            onChanged: (_) {},
          ),
        ),
      );

      expect(find.byIcon(MdiIcons.check), findsOneWidget);
      expect(find.byIcon(MdiIcons.history), findsOneWidget);
      final lights = ThemeColorFamily.get(Brightness.light, ThemeColors.lights);
      expect(_segment(tester, 'Heat').background, lights.soft);

      await _pump(
        tester,
        SizedBox(
          width: 400,
          child: IntentModeSelector<String>(
            modes: _modes(),
            matchedValue: 'cool',
            onChanged: (_) {},
          ),
        ),
      );
      expect(find.byIcon(MdiIcons.approximatelyEqual), findsOneWidget);
      expect(
        _segment(tester, 'Cool').background,
        AppAccentPalette.of(AppAccent.blue, Brightness.light).soft,
      );
    });
  });

  group('IntentModeSelector command feedback', () {
    for (final (state, icon) in [
      (ControlState.pending, MdiIcons.refresh),
      (ControlState.unconfirmed, MdiIcons.alert),
    ]) {
      testWidgets('${state.name} shows over the intent icon of the selected mode', (tester) async {
        await _pump(
          tester,
          SizedBox(
            width: 400,
            child: IntentModeSelector<String>(
              modes: _modes(),
              activeValue: 'heat',
              lastIntentValue: 'off',
              state: state,
              onChanged: (_) {},
            ),
          ),
        );

        expect(
          find.descendant(
            of: find.ancestor(of: find.text('Heat'), matching: find.byType(Material)).first,
            matching: find.byIcon(icon),
          ),
          findsOneWidget,
        );
        expect(find.byIcon(MdiIcons.check), findsNothing);
        // Other modes keep their intent icons.
        expect(find.byIcon(MdiIcons.history), findsOneWidget);
      });
    }

    testWidgets('idle keeps the intent icon of the selected mode', (tester) async {
      await _pump(
        tester,
        SizedBox(
          width: 400,
          child: IntentModeSelector<String>(
            modes: _modes(),
            matchedValue: 'cool',
            onChanged: (_) {},
          ),
        ),
      );

      expect(find.byIcon(MdiIcons.approximatelyEqual), findsOneWidget);
      expect(find.byIcon(MdiIcons.refresh), findsNothing);
      expect(find.byIcon(MdiIcons.alert), findsNothing);
    });
  });

  group('Mode chip and popup', () {
    BottomNavModeConfig config({String? title = 'Lights mode'}) => BottomNavModeConfig(
      icon: MdiIcons.sofaOutline,
      label: 'Relax',
      title: title,
      color: ThemeColors.lights,
      popupBuilder: (context, dismiss) => const SizedBox.shrink(),
    );

    for (final sizeClass in _classes) {
      for (final brightness in _brightnesses) {
        testWidgets('the chip names its domain at ${sizeClass.name} in ${brightness.name}', (tester) async {
          final handle = tester.ensureSemantics();
          await _pump(
            tester,
            DeckModeChipButton(config: config(), onTap: (_) {}, sizeClass: sizeClass),
            brightness: brightness,
          );

          final lights = ThemeColorFamily.get(brightness, ThemeColors.lights);
          final neutrals = AppNeutralPalette.of(brightness);

          expect(tester.getSize(find.byType(DeckModeChipButton)).height, 36);
          final material = tester.widget<Material>(
            find.descendant(of: find.byType(DeckModeChipButton), matching: find.byType(Material)),
          );
          expect(material.color, lights.soft);

          // Every class names the domain.
          const shown = 'Lights mode: Relax';
          expect(find.text(shown), findsOneWidget);
          expect(tester.widget<Text>(find.text(shown)).style!.color, neutrals.textPrimary);
          expect(find.bySemanticsLabel('Lights mode: Relax'), findsOneWidget);
          handle.dispose();
        });

        testWidgets('the popup at ${sizeClass.name} in ${brightness.name}', (tester) async {
          await _pump(
            tester,
            DeckModePopupFrame(
              title: 'Lights mode',
              sizeClass: sizeClass,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  DeckModePopupOption(
                    icon: MdiIcons.sofaOutline,
                    label: 'Relax',
                    isSelected: true,
                    color: ThemeColors.lights,
                    sizeClass: sizeClass,
                    onTap: () {},
                  ),
                  DeckModePopupOption(
                    icon: MdiIcons.weatherNight,
                    label: 'Night',
                    isSelected: false,
                    color: ThemeColors.lights,
                    sizeClass: sizeClass,
                    onTap: () {},
                  ),
                ],
              ),
            ),
            brightness: brightness,
          );

          final neutrals = AppNeutralPalette.of(brightness);
          final lights = ThemeColorFamily.get(brightness, ThemeColors.lights);

          expect(
            tester.getSize(find.byType(DeckModePopupFrame)).width,
            DeckModePopupMetrics.widthFor(sizeClass),
          );
          final frame = tester.widget<Container>(
            find.descendant(of: find.byType(DeckModePopupFrame), matching: find.byType(Container)).first,
          );
          final decoration = frame.decoration! as BoxDecoration;
          expect(decoration.color, neutrals.surfaceRaised);
          expect(decoration.border!.top.color, neutrals.borderLight);
          // One soft shadow in light; surface steps instead in dark.
          expect(decoration.boxShadow, brightness == Brightness.light ? isNotEmpty : isNull);

          // The title names the domain.
          expect(find.text('LIGHTS MODE'), findsOneWidget);

          final option = find.byType(DeckModePopupOption).first;
          expect(tester.getSize(option).height, DeckModePopupMetrics.optionHeightFor(sizeClass));
          final selected = tester.widget<Material>(
            find.descendant(of: option, matching: find.byType(Material)),
          );
          expect(selected.color, lights.soft);
          expect(find.byIcon(MdiIcons.check), findsOneWidget);
          expect(tester.widget<Icon>(find.byIcon(MdiIcons.check)).color, lights.base);
        });
      }
    }

    testWidgets('in a narrow header a long label ellipsizes within half the row', (tester) async {
      await _pump(
        tester,
        SizedBox(
          width: 400,
          child: PageHeader(
            title: 'Living room',
            sizeClass: ScreenSizeClass.regular,
            landscapeAction: DeckModeChipButton(
              config: BottomNavModeConfig(
                icon: MdiIcons.sofaOutline,
                label: 'Relax with a very long translated mode name',
                title: 'Lights mode',
                color: ThemeColors.lights,
                popupBuilder: (context, dismiss) => const SizedBox.shrink(),
              ),
              onTap: (_) {},
              sizeClass: ScreenSizeClass.regular,
            ),
          ),
        ),
      );

      expect(tester.takeException(), isNull);
      final header = tester.getRect(find.byType(PageHeader));
      final chip = tester.getRect(find.byType(DeckModeChipButton));
      expect(chip.right, lessThanOrEqualTo(header.right));
      // The row is the header less its 8 px padding on each side.
      expect(chip.width, lessThanOrEqualTo((400 - 16) * PageHeaderMetrics.landscapeActionShare));
      final label = tester.renderObject<RenderParagraph>(
        find.text('Lights mode: Relax with a very long translated mode name'),
      );
      expect(label.didExceedMaxLines, isTrue);
      // The title keeps the rest.
      expect(find.text('Living room'), findsOneWidget);
      expect(tester.getRect(find.text('Living room')).left, greaterThanOrEqualTo(header.left));
    });

    testWidgets('without a title the chip shows the mode alone', (tester) async {
      await _pump(
        tester,
        DeckModeChipButton(
          config: config(title: null),
          onTap: (_) {},
          sizeClass: ScreenSizeClass.regular,
        ),
      );

      expect(find.text('Relax'), findsOneWidget);
    });
  });

  group('CircularControlDial', () {
    Widget dial({
      double value = 22,
      double? second,
      ValueChanged<double>? onChanged,
      ValueChanged<double>? onSecondChanged,
      bool enabled = true,
      bool isActive = true,
      ControlState state = ControlState.idle,
      ScreenSizeClass sizeClass = ScreenSizeClass.regular,
      double size = 240,
      double min = 10,
      double max = 30,
      double step = 0.5,
    }) => CircularControlDial(
      value: value,
      secondValue: second,
      currentValue: 21.4,
      minValue: min,
      maxValue: max,
      step: step,
      size: size,
      accentType: DialAccentColor.warning,
      modeLabel: 'Heating',
      displayFormat: DialDisplayFormat.temperature,
      temperatureUnitSymbol: '°',
      enabled: enabled,
      isActive: isActive,
      state: state,
      sizeClass: sizeClass,
      onChanged: onChanged ?? (_) {},
      onSecondChanged: onSecondChanged,
    );

    for (final sizeClass in _classes) {
      for (final brightness in _brightnesses) {
        testWidgets('layout at ${sizeClass.name} in ${brightness.name}', (tester) async {
          await _pump(tester, dial(sizeClass: sizeClass), brightness: brightness);

          final neutrals = AppNeutralPalette.of(brightness);

          // The numeral is 0.27 of the dial, Barlow 300.
          final numeral = tester.widget<Text>(
            find.byWidgetPredicate((w) => w is Text && w.textSpan?.toPlainText() == '22°'),
          );
          expect(numeral.style!.fontFamily, AppNumeralFont.family);
          expect(numeral.style!.fontWeight, AppNumeralFont.display);
          expect(numeral.style!.fontSize, closeTo(240 * DialGeometry.numeral, 0.01));
          expect(numeral.style!.color, neutrals.textPrimary);

          expect(find.text('Now 21.4°'), findsOneWidget);
          expect(find.text('Heating'), findsOneWidget);

          // Minus and plus at the foot, inside the dial's box.
          final buttons = find.byType(ControlRoundButton);
          expect(buttons, findsNWidgets(2));
          final box = tester.getRect(find.byType(CircularControlDial));
          final minus = tester.getRect(buttons.first);
          final plus = tester.getRect(buttons.last);
          expect(minus.bottomLeft, box.bottomLeft);
          expect(plus.bottomRight, box.bottomRight);
          // The class size, at most a quarter of the dial.
          final expected = ControlRoundButton.sizeFor(sizeClass)
              .clamp(ControlRoundButton.minDiameter, 240 * DialGeometry.buttons);
          expect(minus.width, expected);
        });
      }
    }

    test('the arc is 240° and open at the foot', () {
      expect(DialGeometry.sweepAngle, closeTo(240 * 3.141592653589793 / 180, 1e-9));
      expect(DialGeometry.startAngle, closeTo(150 * 3.141592653589793 / 180, 1e-9));
    });

    testWidgets('minus and plus step the target and report it once settled', (tester) async {
      final reported = <double>[];
      await _pump(tester, dial(onChanged: reported.add));

      await tester.tap(find.byIcon(MdiIcons.plus));
      await tester.pump();
      await tester.tap(find.byIcon(MdiIcons.plus));
      await tester.pump();
      expect(
        find.byWidgetPredicate((w) => w is Text && w.textSpan?.toPlainText() == '23°'),
        findsOneWidget,
      );
      expect(reported, isEmpty);

      await tester.pump(const Duration(milliseconds: 600));
      expect(reported, [23]);
    });

    testWidgets('two thumbs: the second is the cool setpoint', (tester) async {
      final heat = <double>[];
      final cool = <double>[];
      await _pump(
        tester,
        dial(value: 20, second: 24, onChanged: heat.add, onSecondChanged: cool.add),
      );

      expect(
        find.byWidgetPredicate((w) => w is Text && w.textSpan?.toPlainText() == '20–24°'),
        findsOneWidget,
      );
      final numeral = tester.widget<Text>(
        find.byWidgetPredicate((w) => w is Text && w.textSpan?.toPlainText() == '20–24°'),
      );
      expect(numeral.style!.fontSize, closeTo(240 * DialGeometry.numeralTwoThumbs, 0.01));

      // Minus and plus move the first thumb until another is dragged.
      await tester.tap(find.byIcon(MdiIcons.minus));
      await tester.pump(const Duration(milliseconds: 600));
      expect(heat, [19.5]);
      expect(cool, isEmpty);
    });

    testWidgets('a pending minus or plus change is sent for its own thumb when the other is picked', (tester) async {
      final heat = <double>[];
      final cool = <double>[];
      await _pump(
        tester,
        dial(value: 20, second: 24, onChanged: heat.add, onSecondChanged: cool.add),
      );

      await tester.tap(find.byIcon(MdiIcons.plus));
      await tester.pump();
      expect(heat, isEmpty);

      // Within the debounce, tap the track at the cool thumb.
      final origin = tester.getTopLeft(find.byType(CircularControlDial));
      const size = 240.0;
      final angle = DialGeometry.startAngle + (24 - 10) / (30 - 10) * DialGeometry.sweepAngle;
      final onCool = origin +
          Offset(
            size * DialGeometry.centerX + size * DialGeometry.radius * math.cos(angle),
            size * DialGeometry.centerY + size * DialGeometry.radius * math.sin(angle),
          );
      await tester.tapAt(onCool);
      await tester.pump();
      expect(heat, [20.5]);
      expect(cool, [24]);

      // The debounce does not fire again for the other thumb.
      await tester.pump(const Duration(milliseconds: 600));
      expect(heat, [20.5]);
      expect(cool, [24]);

      // Minus and plus now move the cool thumb, and report it.
      await tester.tap(find.byIcon(MdiIcons.plus));
      await tester.pump(const Duration(milliseconds: 600));
      expect(heat, [20.5]);
      expect(cool, [24, 24.5]);
    });

    testWidgets('two thumbs: each setpoint is its own slider for screen readers', (tester) async {
      final handle = tester.ensureSemantics();
      final heat = <double>[];
      final cool = <double>[];
      await _pump(
        tester,
        dial(value: 20, second: 24, onChanged: heat.add, onSecondChanged: cool.add),
      );

      Semantics thumb(String label) => tester.widget<Semantics>(
        find.byWidgetPredicate((w) => w is Semantics && w.properties.label == label),
      );

      final heatNode = tester.getSemantics(find.bySemanticsLabel('Heating setpoint'));
      final coolNode = tester.getSemantics(find.bySemanticsLabel('Cooling setpoint'));
      expect(heatNode.value, '20°');
      expect(coolNode.value, '24°');
      expect(heatNode.id, isNot(coolNode.id));
      expect(thumb('Heating setpoint').properties.slider, isTrue);
      expect(thumb('Cooling setpoint').properties.slider, isTrue);

      // Raise the cool setpoint without touching the dial.
      thumb('Cooling setpoint').properties.onIncrease!();
      await tester.pump(const Duration(milliseconds: 600));
      expect(cool, [24.5]);
      expect(heat, isEmpty);
      expect(tester.getSemantics(find.bySemanticsLabel('Cooling setpoint')).value, '24.5°');

      // Then the heat setpoint; the cool change is not sent again.
      thumb('Heating setpoint').properties.onDecrease!();
      await tester.pump(const Duration(milliseconds: 600));
      expect(heat, [19.5]);
      expect(cool, [24.5]);
      handle.dispose();
    });

    testWidgets('two thumbs: heat stops at cool and cool at heat', (tester) async {
      final handle = tester.ensureSemantics();
      await _pump(tester, dial(value: 22, second: 22, onSecondChanged: (_) {}));

      final heat = tester.getSemantics(find.bySemanticsLabel('Heating setpoint'));
      final cool = tester.getSemantics(find.bySemanticsLabel('Cooling setpoint'));
      expect(heat.increasedValue, isEmpty);
      expect(heat.decreasedValue, '21.5°');
      expect(cool.decreasedValue, isEmpty);
      expect(cool.increasedValue, '22.5°');
      handle.dispose();
    });

    testWidgets('two coincident thumbs: plus raises cool and minus lowers heat', (tester) async {
      final heat = <double>[];
      final cool = <double>[];
      await _pump(
        tester,
        dial(value: 22, second: 22, onChanged: heat.add, onSecondChanged: cool.add),
      );

      await tester.tap(find.byIcon(MdiIcons.plus));
      await tester.pump(const Duration(milliseconds: 600));
      expect(cool, [22.5]);
      expect(heat, isEmpty);

      // A fresh dial: minus lowers heat.
      await tester.pumpWidget(const SizedBox.shrink());
      await _pump(
        tester,
        dial(value: 22, second: 22, onChanged: heat.add, onSecondChanged: cool.add),
      );
      await tester.tap(find.byIcon(MdiIcons.minus));
      await tester.pump(const Duration(milliseconds: 600));
      expect(heat, [21.5]);
    });

    testWidgets('two coincident thumbs: dragging up from them moves cool', (tester) async {
      final heat = <double>[];
      final cool = <double>[];
      await _pump(
        tester,
        dial(value: 22, second: 22, onChanged: heat.add, onSecondChanged: cool.add),
      );

      final origin = tester.getTopLeft(find.byType(CircularControlDial));
      Offset at(double value) {
        final angle = DialGeometry.startAngle + (value - 10) / (30 - 10) * DialGeometry.sweepAngle;
        return origin +
            Offset(
              240 * DialGeometry.centerX + 240 * DialGeometry.radius * math.cos(angle),
              240 * DialGeometry.centerY + 240 * DialGeometry.radius * math.sin(angle),
            );
      }

      final gesture = await tester.startGesture(at(22));
      for (final value in [22.5, 23.0, 24.0]) {
        await gesture.moveTo(at(value));
        await tester.pump();
      }
      await gesture.up();
      await tester.pump();
      expect(cool, [24]);
      expect(heat, isEmpty);
    });

    /// The point on a 240 px dial's arc for [value], in global coordinates.
    Offset onArc(WidgetTester tester, double value, {double min = 10, double max = 30}) {
      final origin = tester.getTopLeft(find.byType(CircularControlDial));
      final angle = DialGeometry.startAngle + (value - min) / (max - min) * DialGeometry.sweepAngle;

      return origin +
          Offset(
            240 * DialGeometry.centerX + 240 * DialGeometry.radius * math.cos(angle),
            240 * DialGeometry.centerY + 240 * DialGeometry.radius * math.sin(angle),
          );
    }

    Semantics thumbSemantics(WidgetTester tester, String label) => tester.widget<Semantics>(
      find.byWidgetPredicate((w) => w is Semantics && w.properties.label == label),
    );

    testWidgets('plus takes a tap where it overlaps the arc', (tester) async {
      final reported = <double>[];
      await _pump(tester, dial(onChanged: reported.add));

      // Inside plus (48 px at the bottom-right corner) and inside the arc's
      // hit band.
      final origin = tester.getTopLeft(find.byType(CircularControlDial));
      await tester.tapAt(origin + const Offset(200, 200));
      await tester.pump(const Duration(milliseconds: 600));
      expect(reported, [22.5]);
    });

    testWidgets('the ends of the arc give the exact minimum and maximum', (tester) async {
      final reported = <double>[];
      await _pump(tester, dial(value: 20, min: 10, max: 30.25, step: 1, onChanged: reported.add));

      await tester.tapAt(onArc(tester, 30.25, max: 30.25));
      await tester.pump();
      expect(reported.last, 30.25);

      await tester.tapAt(onArc(tester, 10, max: 30.25));
      await tester.pump();
      expect(reported.last, 10);
    });

    testWidgets('plus and minus keep an off-grid value\'s offset', (tester) async {
      final reported = <double>[];
      await _pump(tester, dial(value: 30.25, min: 10, max: 40, step: 1, onChanged: reported.add));

      await tester.tap(find.byIcon(MdiIcons.plus));
      await tester.pump(const Duration(milliseconds: 600));
      expect(reported, [31.25]);
    });

    testWidgets('disabled mid-drag: the drag ends without reporting', (tester) async {
      final reported = <double>[];
      final swipe = <bool>[];
      final subscription = locator<EventBus>().on<PageSwipeBlockEvent>().listen((e) => swipe.add(e.blocked));
      addTearDown(subscription.cancel);
      await _pump(tester, dial(onChanged: reported.add));

      final gesture = await tester.startGesture(onArc(tester, 22));
      await gesture.moveTo(onArc(tester, 24));
      await tester.pump();
      await _pump(tester, dial(onChanged: reported.add, state: ControlState.disabled));
      await gesture.moveTo(onArc(tester, 26));
      await gesture.up();
      await tester.pump();

      expect(reported, isEmpty);
      expect(swipe, [true, false]);
    });

    testWidgets('disabled while minus or plus waits: nothing is sent', (tester) async {
      final reported = <double>[];
      await _pump(tester, dial(onChanged: reported.add));

      await tester.tap(find.byIcon(MdiIcons.plus));
      await tester.pump();
      await _pump(tester, dial(onChanged: reported.add, enabled: false));
      await tester.pump(const Duration(milliseconds: 600));
      expect(reported, isEmpty);

      // Re-enabled with the parent still at 22: the dial shows 22 again, and
      // the next plus starts from it.
      await _pump(tester, dial(onChanged: reported.add));
      expect(
        find.byWidgetPredicate((w) => w is Text && w.textSpan?.toPlainText() == '22°'),
        findsOneWidget,
      );
      await tester.tap(find.byIcon(MdiIcons.plus));
      await tester.pump(const Duration(milliseconds: 600));
      expect(reported, [22.5]);
    });

    testWidgets('a cool setpoint moved by the parent mid-drag still limits heat', (tester) async {
      final heat = <double>[];
      await _pump(tester, dial(value: 22, second: 26, onChanged: heat.add, onSecondChanged: (_) {}));

      final gesture = await tester.startGesture(onArc(tester, 22));
      await gesture.moveTo(onArc(tester, 22.5));
      await tester.pump();
      await _pump(tester, dial(value: 22, second: 23, onChanged: heat.add, onSecondChanged: (_) {}));
      await gesture.moveTo(onArc(tester, 25));
      await tester.pump();
      // The cool thumb shows the parent's value.
      expect(
        find.byWidgetPredicate((w) => w is Text && w.textSpan?.toPlainText() == '23–23°'),
        findsOneWidget,
      );
      await gesture.up();
      await tester.pump();
      expect(heat, [23]);
    });

    testWidgets('a cool thumb added mid-drag ends the drag without a crash', (tester) async {
      final heat = <double>[];
      final swipe = <bool>[];
      final subscription = locator<EventBus>().on<PageSwipeBlockEvent>().listen((e) => swipe.add(e.blocked));
      addTearDown(subscription.cancel);
      await _pump(tester, dial(value: 22, onChanged: heat.add));

      final gesture = await tester.startGesture(onArc(tester, 22));
      await gesture.moveTo(onArc(tester, 23));
      await tester.pump();
      await _pump(tester, dial(value: 22, second: 26, onChanged: heat.add, onSecondChanged: (_) {}));
      expect(tester.takeException(), isNull);
      await gesture.moveTo(onArc(tester, 24));
      await gesture.up();
      await tester.pump();
      expect(heat, isEmpty);
      expect(swipe, [true, false]);
      expect(
        find.byWidgetPredicate((w) => w is Text && w.textSpan?.toPlainText() == '22–26°'),
        findsOneWidget,
      );
    });

    testWidgets('a waiting edit is sent with the value it set', (tester) async {
      final handle = tester.ensureSemantics();
      final cool = <double>[];
      await _pump(tester, dial(value: 20, second: 26, onSecondChanged: cool.add));

      thumbSemantics(tester, 'Cooling setpoint').properties.onIncrease!();
      await tester.pump();
      // The parent moves heat meanwhile; the cool edit still sends 26.5.
      await _pump(tester, dial(value: 21, second: 26, onSecondChanged: cool.add));
      await tester.pump(const Duration(milliseconds: 600));
      expect(cool, [26.5]);
      handle.dispose();
    });

    testWidgets('a parent value for the same thumb replaces a waiting edit', (tester) async {
      final handle = tester.ensureSemantics();
      final cool = <double>[];
      await _pump(tester, dial(value: 20, second: 26, onSecondChanged: cool.add));

      thumbSemantics(tester, 'Cooling setpoint').properties.onIncrease!();
      await tester.pump();
      await _pump(tester, dial(value: 20, second: 27, onSecondChanged: cool.add));
      await tester.pump(const Duration(milliseconds: 600));
      expect(cool, isEmpty);
      handle.dispose();
    });

    testWidgets('an edit for a removed cool thumb is dropped', (tester) async {
      final handle = tester.ensureSemantics();
      final heat = <double>[];
      final cool = <double>[];
      await _pump(tester, dial(value: 20, second: 26, onChanged: heat.add, onSecondChanged: cool.add));

      thumbSemantics(tester, 'Cooling setpoint').properties.onIncrease!();
      await tester.pump();
      await _pump(tester, dial(value: 20, onChanged: heat.add));
      await tester.pump(const Duration(milliseconds: 600));
      expect(heat, isEmpty);
      expect(cool, isEmpty);
      handle.dispose();
    });

    testWidgets('disabled or off: dimmed and does not move', (tester) async {
      var calls = 0;
      await _pump(tester, dial(enabled: false, isActive: false, onChanged: (_) => calls++));

      final neutrals = AppNeutralPalette.light;
      final numeral = tester.widget<Text>(
        find.byWidgetPredicate((w) => w is Text && w.textSpan?.toPlainText() == '22°'),
      );
      expect(numeral.style!.color, neutrals.textSecondary);
      for (final button in tester.widgetList<ControlRoundButton>(find.byType(ControlRoundButton))) {
        expect(button.onTap, isNull);
      }
      await tester.tap(find.byIcon(MdiIcons.plus));
      await tester.pump(const Duration(milliseconds: 600));
      expect(calls, 0);
    });

    testWidgets('steps as a slider for screen readers', (tester) async {
      final handle = tester.ensureSemantics();
      final reported = <double>[];
      await _pump(tester, dial(onChanged: reported.add));

      final node = tester.getSemantics(find.byType(CircularControlDial));
      expect(node.value, '22°');
      // The next value carries the unit, like the value.
      expect(node.increasedValue, '22.5°');
      // Without a label from the screen, it says what it sets.
      expect(node.label, 'Target temperature');
      final semantics = tester.widget<Semantics>(
        find.descendant(of: find.byType(CircularControlDial), matching: find.byType(Semantics)).first,
      );
      expect(semantics.properties.slider, isTrue);
      semantics.properties.onIncrease!();
      await tester.pump(const Duration(milliseconds: 600));
      expect(reported, [22.5]);
      handle.dispose();
    });
  });
}
