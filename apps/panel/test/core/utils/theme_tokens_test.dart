import 'dart:math' as math;

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/modules/deck/types/domain_type.dart';
import 'package:flutter/material.dart';
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

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() async {
    await locator.reset();
    // DPR 2 gives a scale factor of 1, so design px equal logical px.
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

  group('neutral tokens', () {
    test('match the design spec', () {
      expect(AppNeutralPalette.light.surfacePage, const Color(0xFFF3F4F6));
      expect(AppNeutralPalette.light.surfaceCard, const Color(0xFFFFFFFF));
      expect(AppNeutralPalette.light.textPrimary, const Color(0xFF1B1F26));
      expect(AppNeutralPalette.dark.surfacePage, const Color(0xFF121315));
      expect(AppNeutralPalette.dark.surfaceCard, const Color(0xFF1B1C1F));
      expect(AppNeutralPalette.dark.surfaceRaised, const Color(0xFF232428));
      expect(AppBrandColors.app, const Color(0xFFD9230F));
    });

    test('legacy neutral classes are adapters onto the tokens', () {
      expect(AppBgColorLight.page, AppNeutralPalette.light.surfacePage);
      expect(AppBgColorLight.base, AppNeutralPalette.light.surfaceCard);
      expect(AppBgColorDark.page, AppNeutralPalette.dark.surfacePage);
      expect(AppBgColorDark.base, AppNeutralPalette.dark.surfaceCard);
      expect(AppBgColorDark.overlay, AppNeutralPalette.dark.surfaceRaised);
      expect(AppTextColorLight.primary, AppNeutralPalette.light.textPrimary);
      expect(AppTextColorDark.primary, AppNeutralPalette.dark.textPrimary);
      expect(AppBorderColorLight.light, AppNeutralPalette.light.borderLight);
      expect(AppBorderColorDark.light, AppNeutralPalette.dark.borderLight);
    });

    test('secondary text passes AA on every surface', () {
      for (final n in [AppNeutralPalette.light, AppNeutralPalette.dark]) {
        for (final surface in [n.surfaceCard, n.surfaceRaised, n.surfacePage]) {
          expect(_contrast(n.textSecondary, surface), greaterThanOrEqualTo(4.5));
        }
      }
    });

    test('legacy secondary text passes AA on the page', () {
      expect(
        _contrast(AppTextColorLight.secondary, AppBgColorLight.page),
        greaterThanOrEqualTo(4.5),
      );
      expect(
        _contrast(AppTextColorDark.secondary, AppBgColorDark.page),
        greaterThanOrEqualTo(4.5),
      );
    });

    test('muted text passes AA on cards and raised surfaces', () {
      // Not on the light page (4.2:1): the spec keeps muted text off the page.
      for (final n in [AppNeutralPalette.light, AppNeutralPalette.dark]) {
        for (final surface in [n.surfaceCard, n.surfaceRaised]) {
          expect(_contrast(n.textMuted, surface), greaterThanOrEqualTo(4.5));
        }
      }
    });
  });

  group('status tokens', () {
    for (final brightness in Brightness.values) {
      for (final status in AppStatus.values) {
        test('$status in $brightness passes AA', () {
          final p = AppStatusPalette.of(brightness, status);
          final n = AppNeutralPalette.of(brightness);

          expect(_contrast(p.text, n.surfaceCard), greaterThanOrEqualTo(4.5));
          expect(_contrast(AppColors.white, p.fill), greaterThanOrEqualTo(4.5));

          // Design value that misses AA, reported to design (spec §11,
          // "Contrast open with design"); fails once a fix lands.
          final textOnSoft = _contrast(p.text, p.soft);
          if (brightness == Brightness.light && status == AppStatus.ok) {
            expect(textOnSoft, lessThan(4.5), reason: 'fixed in design: drop this exception');
            expect(textOnSoft, greaterThan(4.49));
          } else {
            expect(textOnSoft, greaterThanOrEqualTo(4.5));
          }
        });
      }
    }

    test('danger is not the brand red', () {
      expect(
        AppStatusPalette.of(Brightness.light, AppStatus.danger).fill,
        isNot(AppBrandColors.app),
      );
    });
  });

  group('domain families', () {
    const twins = {
      ThemeColors.lights: ThemeColors.warning,
      ThemeColors.climate: ThemeColors.info,
      ThemeColors.shading: ThemeColors.teal,
      ThemeColors.media: ThemeColors.pink,
      ThemeColors.sensors: ThemeColors.cyan,
      ThemeColors.energy: ThemeColors.success,
      ThemeColors.cameras: ThemeColors.indigo,
    };

    for (final brightness in Brightness.values) {
      test('domain keys share colour and soft with their legacy key in $brightness', () {
        twins.forEach((domain, legacy) {
          final d = ThemeColorFamily.get(brightness, domain);
          final l = ThemeColorFamily.get(brightness, legacy);

          expect(d.base, l.base, reason: '$domain');
          expect(d.soft, l.soft, reason: '$domain');
        });
      });
    }

    test('media is magenta, not red', () {
      expect(DomainType.media.themeColor, ThemeColors.media);
      expect(
        ThemeColorFamily.get(Brightness.light, ThemeColors.media).base,
        const Color(0xFFC2185B),
      );
      expect(
        ThemeColorFamily.get(Brightness.dark, ThemeColors.media).base,
        const Color(0xFFF06292),
      );
    });

    test('every deck domain uses its own domain key', () {
      expect(DomainType.lights.themeColor, ThemeColors.lights);
      expect(DomainType.climate.themeColor, ThemeColors.climate);
      expect(DomainType.shading.themeColor, ThemeColors.shading);
      expect(DomainType.sensors.themeColor, ThemeColors.sensors);
      expect(DomainType.energy.themeColor, ThemeColors.energy);
    });

    test('the legacy primary key is the default accent, blue', () {
      expect(AppColorsLight.primary, const Color(0xFF2563C9));
      expect(AppColorsDark.primary, const Color(0xFF3570D8));
      expect(_contrast(AppColors.white, AppColorsLight.primary), greaterThanOrEqualTo(4.5));
    });

    test('icon containers use the soft tint', () {
      final family = ThemeColorFamily.get(Brightness.light, ThemeColors.climate);

      expect(family.iconContainer.backgroundColor, const Color(0xFFE3F2FA));
    });
  });

  group('theme', () {
    test('scaffold is the page surface and cards are flat', () {
      final light = AppTheme.lightTheme;
      final dark = AppTheme.darkTheme;

      expect(light.scaffoldBackgroundColor, AppNeutralPalette.light.surfacePage);
      expect(dark.scaffoldBackgroundColor, AppNeutralPalette.dark.surfacePage);
      expect(light.cardTheme.elevation, 0);
      expect(light.cardTheme.color, AppNeutralPalette.light.surfaceCard);
      expect(dark.dialogTheme.backgroundColor, AppNeutralPalette.dark.surfaceRaised);
      expect(light.colorScheme.primary, AppColorsLight.primary);
    });

    test('the error role pair passes AA in both themes', () {
      for (final theme in [AppTheme.lightTheme, AppTheme.darkTheme]) {
        final scheme = theme.colorScheme;

        expect(_contrast(scheme.onError, scheme.error), greaterThanOrEqualTo(4.5));
        expect(_contrast(scheme.error, scheme.surface), greaterThanOrEqualTo(4.5));
      }
    });

    for (final dark in [false, true]) {
      test('filled buttons pass AA in ${dark ? 'dark' : 'light'}', () {
        final failures = <String>[];

        for (final key in ThemeColors.values) {
          final style = (dark
                  ? AppFilledButtonsDarkThemes.forThemeColor(key)
                  : AppFilledButtonsLightThemes.forThemeColor(key))
              .style!;

          for (final states in [
            <WidgetState>{},
            {WidgetState.pressed},
            {WidgetState.hovered},
          ]) {
            final bg = style.backgroundColor!.resolve(states)!;
            final fg = style.foregroundColor!.resolve(states)!;
            final ratio = _contrast(fg, bg);

            if (ratio < 4.5) {
              failures.add('${key.name} ${states.map((s) => s.name)} ${ratio.toStringAsFixed(2)}');
            }
          }
        }

        expect(failures, isEmpty);
      });
    }

    test('the startup spinner uses the app colour', () {
      expect(AppTheme.startThemeLight.progressIndicatorTheme.color, AppBrandColors.app);
      expect(AppTheme.startThemeDark.progressIndicatorTheme.color, AppBrandColors.app);
    });
  });

  group('sizes', () {
    test('radius steps', () {
      expect(AppBorderRadius.small, 4);
      expect(AppBorderRadius.inner, 6);
      expect(AppBorderRadius.base, 8);
      expect(AppBorderRadius.medium, 12);
    });

    test('the 8 px type step renders at the caption size', () {
      expect(AppFontSize.extraSmall, 10);
      expect(AppFontSize.extraExtraSmall, AppFontSize.extraSmall);
    });

    test('new spacing steps', () {
      expect(AppSpacings.pSmMd, 6);
      expect(AppSpacings.pMdLg, 12);
      expect(AppSpacings.pLgXl, 24);
    });

    test('numerals use Barlow Semi Condensed', () {
      expect(AppNumeralFont.family, 'BarlowSemiCondensed');
      expect(AppNumeralFont.display, FontWeight.w300);
      expect(AppNumeralFont.value, FontWeight.w500);
    });
  });
}
