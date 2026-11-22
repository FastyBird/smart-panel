import 'dart:math' as math;

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/local_preferences.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/accent_swatch_picker.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_banner.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_toggle.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';

double _luminance(Color c) {
  double channel(double v) =>
      v <= 0.03928 ? v / 12.92 : math.pow((v + 0.055) / 1.055, 2.4).toDouble();

  return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
}

double _contrast(Color a, Color b) {
  final la = _luminance(a);
  final lb = _luminance(b);

  return (math.max(la, lb) + 0.05) / (math.min(la, lb) + 0.05);
}

/// Spec §2 accent table: fill L (= text L), soft L, fill D, text D, soft D.
const _spec = <AppAccent, List<int>>{
  AppAccent.blue: [0xFF2563C9, 0xFFE9EFFA, 0xFF3570D8, 0xFF8AB4F8, 0xFF212E48],
  AppAccent.teal: [0xFF0F766E, 0xFFE7F1F0, 0xFF11827A, 0xFF5FD0C5, 0xFF193333],
  AppAccent.sage: [0xFF55702F, 0xFFEEF1EA, 0xFF5F7D36, 0xFFB3CF85, 0xFF2A3124],
  AppAccent.terracotta: [0xFFB04A26, 0xFFF7EDE9, 0xFFB85230, 0xFFF2A685, 0xFF3E2823],
  AppAccent.rose: [0xFFA3476F, 0xFFF6EDF1, 0xFFAD4F78, 0xFFF0A3C2, 0xFF3B2733],
  AppAccent.violet: [0xFF6247C4, 0xFFEFEDF9, 0xFF6E54D0, 0xFFB9A8F7, 0xFF2D2846],
  AppAccent.sand: [0xFF7A6248, 0xFFF2EFED, 0xFF846B50, 0xFFD9BF9F, 0xFF322D2A],
  AppAccent.graphite: [0xFF4A5261, 0xFFEDEEEF, 0xFF5A6375, 0xFFB6BFCD, 0xFF292C32],
};

ThemeData _theme(AppAccent accent, Brightness brightness) {
  AppAccents.current = accent;

  return brightness == Brightness.dark ? AppTheme.darkTheme : AppTheme.lightTheme;
}

Widget _app(ThemeData theme, Widget child) {
  return MaterialApp(
    theme: theme,
    localizationsDelegates: const [
      AppLocalizations.delegate,
      GlobalMaterialLocalizations.delegate,
      GlobalWidgetsLocalizations.delegate,
      GlobalCupertinoLocalizations.delegate,
    ],
    supportedLocales: AppLocalizations.supportedLocales,
    locale: const Locale('en'),
    home: Scaffold(body: Center(child: child)),
  );
}

/// Every colour a subtree paints through containers, icons and text.
Set<Color> _paintedColors(WidgetTester tester, Finder root) {
  final colors = <Color>{};

  for (final container in tester.widgetList<Container>(
    find.descendant(of: root, matching: find.byType(Container)),
  )) {
    final decoration = container.decoration;

    if (decoration is BoxDecoration) {
      if (decoration.color != null) colors.add(decoration.color!);
      final border = decoration.border;
      if (border is Border) colors.add(border.top.color);
    }
    if (container.color != null) colors.add(container.color!);
  }

  for (final icon in tester.widgetList<Icon>(
    find.descendant(of: root, matching: find.byType(Icon)),
  )) {
    if (icon.color != null) colors.add(icon.color!);
  }

  for (final text in tester.widgetList<Text>(
    find.descendant(of: root, matching: find.byType(Text)),
  )) {
    if (text.style?.color != null) colors.add(text.style!.color!);
  }

  return colors;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    await locator.reset();
    locator.registerSingleton<ScreenService>(
      ScreenService(screenWidth: 1280, screenHeight: 800, pixelRatio: 2),
    );
    locator.registerSingleton<VisualDensityService>(
      VisualDensityService(pixelRatio: 2),
    );
  });

  tearDown(() {
    AppAccents.current = AppAccent.blue;
  });

  tearDownAll(() async {
    await locator.reset();
  });

  group('accent palettes', () {
    test('match the spec table', () {
      expect(AppAccent.values.length, 8);

      _spec.forEach((accent, v) {
        final light = AppAccentPalette.of(accent, Brightness.light);
        final dark = AppAccentPalette.of(accent, Brightness.dark);

        expect(light.fill, Color(v[0]), reason: '$accent fill L');
        expect(light.text, Color(v[0]), reason: '$accent text L');
        expect(light.soft, Color(v[1]), reason: '$accent soft L');
        expect(dark.fill, Color(v[2]), reason: '$accent fill D');
        expect(dark.text, Color(v[3]), reason: '$accent text D');
        expect(dark.soft, Color(v[4]), reason: '$accent soft D');
      });
    });

    test('blue is the default', () {
      expect(AppAccents.current, AppAccent.blue);
      expect(AppAccent.fromValue(null), AppAccent.blue);
      expect(AppAccent.fromValue('amber'), AppAccent.blue);
      expect(AppAccent.fromValue('violet'), AppAccent.violet);
    });

    for (final brightness in Brightness.values) {
      test('every accent passes AA in $brightness', () {
        final failures = <String>[];
        final n = AppNeutralPalette.of(brightness);

        for (final accent in AppAccent.values) {
          final p = AppAccentPalette.of(accent, brightness);
          final pairs = {
            'white/fill': _contrast(p.onFill, p.fill),
            'white/pressed': _contrast(p.onFill, p.pressed),
            'text/card': _contrast(p.text, n.surfaceCard),
            'text/soft': _contrast(p.text, p.soft),
          };

          pairs.forEach((pair, ratio) {
            if (ratio < 4.5) {
              failures.add('${accent.name} $pair ${ratio.toStringAsFixed(3)}');
            }
          });
        }

        expect(failures, isEmpty);
      });
    }

    test('pressed is darker than the fill', () {
      for (final brightness in Brightness.values) {
        for (final accent in AppAccent.values) {
          final p = AppAccentPalette.of(accent, brightness);

          expect(_luminance(p.pressed), lessThan(_luminance(p.fill)));
        }
      }
    });
  });

  group('accent scope', () {
    for (final brightness in Brightness.values) {
      test('the theme carries the current accent in $brightness', () {
        for (final accent in AppAccent.values) {
          final theme = _theme(accent, brightness);
          final p = AppAccentPalette.of(accent, brightness);

          expect(theme.extension<AppAccentTheme>()!.accent, accent);
          expect(theme.accent, p);
          expect(theme.colorScheme.primary, p.fill);
          expect(theme.colorScheme.onPrimary, AppColors.white);
          expect(theme.sliderTheme.thumbColor, p.fill);
          expect(theme.progressIndicatorTheme.color, p.fill);
          expect(
            theme.switchTheme.trackColor!.resolve({WidgetState.selected}),
            p.fill,
          );
        }
      });
    }

    test('accent buttons use the fill, the pressed shade and the soft', () {
      for (final brightness in Brightness.values) {
        for (final accent in AppAccent.values) {
          final theme = _theme(accent, brightness);
          final p = theme.accent;
          final filled = AppAccentButtons.filled(theme).style!;
          final outlined = AppAccentButtons.outlined(theme).style!;

          expect(filled.backgroundColor!.resolve({}), p.fill);
          expect(filled.backgroundColor!.resolve({WidgetState.pressed}), p.pressed);
          expect(filled.foregroundColor!.resolve({}), AppColors.white);
          expect(outlined.backgroundColor!.resolve({}), p.soft);
          expect(outlined.foregroundColor!.resolve({}), p.text);
          expect(
            _contrast(
              outlined.foregroundColor!.resolve({WidgetState.pressed})!,
              outlined.backgroundColor!.resolve({WidgetState.pressed})!,
            ),
            greaterThanOrEqualTo(4.5),
          );
        }
      }
    });
  });

  group('the accent never colours', () {
    for (final brightness in Brightness.values) {
      test('status or domain tokens in $brightness', () {
        final blue = _theme(AppAccent.blue, brightness);

        for (final accent in AppAccent.values) {
          final theme = _theme(accent, brightness);

          for (final status in AppStatus.values) {
            expect(theme.status(status).fill, blue.status(status).fill);
            expect(theme.status(status).text, blue.status(status).text);
          }

          for (final domain in [
            ThemeColors.lights,
            ThemeColors.climate,
            ThemeColors.shading,
            ThemeColors.media,
            ThemeColors.sensors,
            ThemeColors.energy,
            ThemeColors.cameras,
          ]) {
            expect(theme.domain(domain).base, blue.domain(domain).base);
            expect(theme.domain(domain).soft, blue.domain(domain).soft);
          }
        }
      });
    }

    test('the legacy primary colours that overlays and alarm screens use', () {
      final light = AppOutlinedButtonsLightThemes.primary.style!.backgroundColor!.resolve({});
      final dark = AppOutlinedButtonsDarkThemes.primary.style!.backgroundColor!.resolve({});

      for (final accent in AppAccent.values) {
        AppAccents.current = accent;

        expect(ThemeColorFamily.get(Brightness.light, ThemeColors.primary).base, AppColorsLight.primary);
        expect(AppOutlinedButtonsLightThemes.primary.style!.backgroundColor!.resolve({}), light);
        expect(AppOutlinedButtonsDarkThemes.primary.style!.backgroundColor!.resolve({}), dark);
        expect(AppFilledButtonsLightThemes.primary.style!.backgroundColor!.resolve({}), AppColorsLight.primary);
      }
    });

    for (final key in [ThemeColors.danger, ThemeColors.warning, ThemeColors.lights, ThemeColors.climate]) {
      testWidgets('an alert banner in ${key.name}', (tester) async {
        Future<Set<Color>> paint(AppAccent accent) async {
          await tester.pumpWidget(_app(
            _theme(accent, Brightness.light),
            AlertBanner(text: 'Window open', color: key, onTap: () {}),
          ));
          await tester.pumpAndSettle();

          return _paintedColors(tester, find.byType(AlertBanner));
        }

        final reference = await paint(AppAccent.blue);

        for (final accent in AppAccent.values.where((a) => a != AppAccent.blue)) {
          final colors = await paint(accent);

          expect(colors, reference, reason: accent.name);
          expect(
            colors.contains(AppAccentPalette.of(accent, Brightness.light).fill),
            isFalse,
            reason: accent.name,
          );
        }
      });
    }
  });

  group('accent-owned widgets', () {
    testWidgets('a settings switch that is on takes the accent', (tester) async {
      for (final brightness in Brightness.values) {
        for (final accent in AppAccent.values) {
          await tester.pumpWidget(_app(
            _theme(accent, brightness),
            const SettingsToggle(value: true),
          ));
          await tester.pumpAndSettle();

          final track = tester.widget<AnimatedContainer>(find.descendant(
            of: find.byType(SettingsToggle),
            matching: find.byType(AnimatedContainer),
          ));

          expect(
            (track.decoration as BoxDecoration).color,
            AppAccentPalette.of(accent, brightness).fill,
            reason: '${accent.name} $brightness',
          );
        }
      }
    });
  });

  group('AccentSwatchPicker', () {
    testWidgets('offers the eight accents, blue first, and no room default', (tester) async {
      await tester.pumpWidget(_app(
        _theme(AppAccent.blue, Brightness.light),
        AccentSwatchPicker(value: AppAccent.blue, onChanged: (_) {}),
      ));

      for (final accent in AppAccent.values) {
        expect(find.byKey(ValueKey('accent-swatch-${accent.name}')), findsOneWidget);
      }
      expect(find.bySemanticsLabel('Blue'), findsOneWidget);
      expect(find.bySemanticsLabel('Graphite'), findsOneWidget);
      expect(find.textContaining('Room'), findsNothing);
    });

    testWidgets('marks the selected accent and reports taps', (tester) async {
      final handle = tester.ensureSemantics();
      AppAccent? picked;

      await tester.pumpWidget(_app(
        _theme(AppAccent.blue, Brightness.light),
        AccentSwatchPicker(value: AppAccent.sage, onChanged: (a) => picked = a),
      ));

      expect(
        tester.getSemantics(find.byKey(const ValueKey('accent-swatch-sage'))),
        matchesSemantics(
          label: 'Sage',
          isButton: true,
          hasCheckedState: true,
          isChecked: true,
          isInMutuallyExclusiveGroup: true,
          hasTapAction: true,
        ),
      );
      expect(
        tester.getSemantics(find.byKey(const ValueKey('accent-swatch-violet'))),
        matchesSemantics(
          label: 'Violet',
          isButton: true,
          hasCheckedState: true,
          isChecked: false,
          isInMutuallyExclusiveGroup: true,
          hasTapAction: true,
        ),
      );

      await tester.tap(find.byKey(const ValueKey('accent-swatch-violet')));
      expect(picked, AppAccent.violet);

      handle.dispose();
    });

    testWidgets('previews the chosen accent and hides the preview when asked', (tester) async {
      for (final brightness in Brightness.values) {
        await tester.pumpWidget(_app(
          _theme(AppAccent.blue, brightness),
          AccentSwatchPicker(value: AppAccent.terracotta, onChanged: (_) {}),
        ));
        await tester.pumpAndSettle();

        final p = AppAccentPalette.of(AppAccent.terracotta, brightness);
        final button = tester.widget<Container>(find.byKey(const ValueKey('accent-preview-button')));
        final chip = tester.widget<Container>(find.byKey(const ValueKey('accent-preview-chip')));

        expect((button.decoration as BoxDecoration).color, p.fill);
        expect((chip.decoration as BoxDecoration).color, p.soft);
      }

      await tester.pumpWidget(_app(
        _theme(AppAccent.blue, Brightness.light),
        AccentSwatchPicker(value: AppAccent.blue, onChanged: (_) {}, showPreview: false),
      ));

      expect(find.byKey(const ValueKey('accent-preview')), findsNothing);
    });

    testWidgets('names every accent in every locale', (tester) async {
      for (final locale in AppLocalizations.supportedLocales) {
        final l = await AppLocalizations.delegate.load(locale);

        for (final accent in AppAccent.values) {
          expect(AccentSwatchPicker.labelFor(l, accent), isNotEmpty);
        }
        expect(l.settings_display_settings_accent_title, isNotEmpty);
      }
    });
  });

  group('LocalPreferencesService', () {
    test('stores the accent and applies it to new themes', () async {
      final prefs = LocalPreferencesService();

      await prefs.load();
      expect(prefs.accent, AppAccent.blue);

      await prefs.setAccent(AppAccent.rose);
      expect(prefs.accent, AppAccent.rose);
      expect(AppAccents.current, AppAccent.rose);
      expect(AppTheme.lightTheme.colorScheme.primary, AppAccentPalette.of(AppAccent.rose, Brightness.light).fill);

      await prefs.clearAll();
      expect(prefs.accent, AppAccent.blue);
      expect(AppAccents.current, AppAccent.blue);
    });
  });
}
