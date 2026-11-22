import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/screen_layout.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

/// One row of the supported panels table in
/// `docs/display-ui-design-spec.md` §4.
class _Panel {
  final String name;
  final double width;
  final double height;
  final double ppi;
  final double density;
  final int canvasWidth;
  final int canvasHeight;
  final ScreenSizeClass sizeClass;
  final bool square;

  const _Panel(
    this.name,
    this.width,
    this.height,
    this.ppi,
    this.density,
    this.canvasWidth,
    this.canvasHeight,
    this.sizeClass, {
    this.square = false,
  });
}

const _panels = [
  _Panel('4″ square (YC-SM06E)', 480, 480, 170, 0.85, 282, 282, ScreenSizeClass.compact, square: true),
  _Panel('4″ tall (YC-SM41P)', 480, 800, 233, 1.15, 209, 348, ScreenSizeClass.compact),
  _Panel('7″ basic (Pi Touch Display v1)', 800, 480, 133, 0.85, 471, 282, ScreenSizeClass.compact),
  _Panel('7″ WSVGA', 1024, 600, 170, 0.85, 602, 353, ScreenSizeClass.regular),
  _Panel('5″ HD (reTerminal)', 1280, 720, 294, 1.5, 427, 240, ScreenSizeClass.compact),
  _Panel('7″ HD (Pi Touch Display 2)', 1280, 720, 210, 1.15, 557, 313, ScreenSizeClass.compact),
  _Panel('8″ WXGA (SM08P)', 1280, 800, 189, 1.0, 640, 400, ScreenSizeClass.regular),
  _Panel('10.1″ WXGA (YC-102P)', 1280, 800, 149, 0.85, 753, 471, ScreenSizeClass.regular),
  _Panel('11.6″ Full HD', 1920, 1080, 190, 1.0, 960, 540, ScreenSizeClass.expanded),
  _Panel('14″ Full HD', 1920, 1080, 157, 0.85, 1129, 635, ScreenSizeClass.expanded),
];

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('VisualDensityService', () {
    test('steps match the spec', () {
      expect(VisualDensityService.steps, [0.85, 1.0, 1.15, 1.3, 1.5]);
    });

    test('takes the smallest step at least ppi / 203.2, clamped', () {
      expect(VisualDensityService.densityForPpi(96), 0.85);
      expect(VisualDensityService.densityForPpi(203.2), 1.0);
      expect(VisualDensityService.densityForPpi(204), 1.15);
      expect(VisualDensityService.densityForPpi(250), 1.3);
      expect(VisualDensityService.densityForPpi(400), 1.5);
    });

    test('flutter-pi ppi is 96.52 × DPR', () {
      final service = VisualDensityService(pixelRatio: 2);

      expect(service.ppi, closeTo(193.04, 0.001));
      expect(service.density, 1.0);
    });

    test('Android ppi is 160 × DPR', () {
      VisualDensityService android(double dpr) => VisualDensityService(
            pixelRatio: dpr,
            ppiPerDpr: VisualDensityService.androidPpiPerDpr,
          );

      expect(android(1).density, 0.85);
      expect(android(1.5).density, 1.3);
      expect(android(2).density, 1.5);
    });

    test('a high-density panel gets a larger density, not a compact one', () {
      // The reTerminal: DPR ≈ 3 used to select the compact density.
      final service = VisualDensityService(pixelRatio: 294 / 96.52);

      expect(service.density, 1.5);
      expect(service.visualDensity, VisualDensity.standard);
    });

    group('FB_DISPLAY_DENSITY', () {
      VisualDensityService withEnv(String value) =>
          VisualDensityService(pixelRatio: 294 / 96.52, envDensity: value);

      test('accepts a step value and wins over the computed density', () {
        expect(withEnv('1.0').density, 1.0);
        expect(withEnv('1.3').density, 1.3);
        expect(withEnv('0.85').density, 0.85);
        expect(withEnv('1.0').isOverridden, isTrue);
      });

      test('snaps other numbers to a step', () {
        expect(withEnv('1.1').density, 1.15);
        expect(withEnv('0.5').density, 0.85);
        expect(withEnv('3').density, 1.5);
      });

      test('still accepts compact, normal and large', () {
        expect(withEnv('compact').density, 0.85);
        expect(withEnv('normal').density, 1.0);
        expect(withEnv('large').density, 1.15);
        expect(withEnv(' Large ').density, 1.15);
      });

      test('ignores empty and invalid values', () {
        expect(withEnv('').density, 1.5);
        expect(withEnv('huge').density, 1.5);
        expect(withEnv('-1').density, 1.5);
        expect(withEnv('').isOverridden, isFalse);
      });

      test('compact keeps the compact Material density', () {
        expect(
          withEnv('compact').visualDensity,
          const VisualDensity(horizontal: -4.0, vertical: -4.0),
        );
      });
    });
  });

  group('ScreenService size system', () {
    ScreenService screen(double width, double height, double ppi) {
      final dpr = ppi / VisualDensityService.flutterPiPpiPerDpr;
      final density = VisualDensityService(pixelRatio: dpr).density;

      return ScreenService(
        screenWidth: width,
        screenHeight: height,
        pixelRatio: dpr,
        density: density,
      );
    }

    for (final panel in _panels) {
      test(panel.name, () {
        final s = screen(panel.width, panel.height, panel.ppi);

        expect(s.density, panel.density, reason: 'density');
        expect(s.canvasWidth.round(), panel.canvasWidth, reason: 'canvas width');
        expect(s.canvasHeight.round(), panel.canvasHeight, reason: 'canvas height');
        expect(s.sizeClass, panel.sizeClass, reason: 'class');
        expect(s.isSquare, panel.square, reason: 'square');

        s.dispose();
      });
    }

    test('the same panel in both orientations gets the same class', () {
      for (final panel in _panels) {
        final landscape = screen(panel.width, panel.height, panel.ppi);
        final portrait = screen(panel.height, panel.width, panel.ppi);

        expect(portrait.sizeClass, landscape.sizeClass, reason: panel.name);

        landscape.dispose();
        portrait.dispose();
      }
    });

    test('class thresholds sit on the short side', () {
      expect(ScreenService.sizeClassFor(339.9), ScreenSizeClass.compact);
      expect(ScreenService.sizeClassFor(340), ScreenSizeClass.regular);
      expect(ScreenService.sizeClassFor(479.9), ScreenSizeClass.regular);
      expect(ScreenService.sizeClassFor(480), ScreenSizeClass.expanded);
    });

    test('a square canvas of Regular size does not use the square rules', () {
      final s = ScreenService(
        screenWidth: 720,
        screenHeight: 720,
        pixelRatio: 2,
        density: 1.0,
      );

      expect(s.sizeClass, ScreenSizeClass.regular);
      expect(s.isSquare, isFalse);

      s.dispose();
    });

    test('orientation is a separate axis', () {
      final landscape = screen(1280, 800, 189);
      final portrait = screen(800, 1280, 189);

      expect(landscape.orientation, Orientation.landscape);
      expect(portrait.orientation, Orientation.portrait);

      landscape.dispose();
      portrait.dispose();
    });

    test('scale() applies the density', () {
      final s = ScreenService(
        screenWidth: 1280,
        screenHeight: 720,
        pixelRatio: 3,
        density: 1.5,
      );

      // design value × (2 / DPR) × density
      expect(s.scale(36), closeTo(36 * 2 / 3 * 1.5, 0.0001));
      expect(s.unscale(s.scale(36)), closeTo(36, 0.0001));

      s.dispose();
    });

    test('the canvas fills the logical screen at the scale factor', () {
      final s = screen(1280, 800, 149);

      expect(s.scale(s.canvasWidth), closeTo(s.logicalWidth, 0.0001));
      expect(s.scale(s.canvasHeight), closeTo(s.logicalHeight, 0.0001));

      s.dispose();
    });

    test('legacy checks map onto the classes', () {
      final compact = screen(480, 480, 170);
      final regular = screen(1280, 800, 189);
      final expanded = screen(1920, 1080, 190);

      // ignore: deprecated_member_use_from_same_package
      expect(compact.isSmallScreen, isTrue);
      // ignore: deprecated_member_use_from_same_package
      expect(regular.isMediumScreen, isTrue);
      // ignore: deprecated_member_use_from_same_package
      expect(regular.isAtLeastMedium, isTrue);
      // ignore: deprecated_member_use_from_same_package
      expect(expanded.isLargeScreen, isTrue);
      // ignore: deprecated_member_use_from_same_package
      expect(expanded.isAtLeastLarge, isTrue);
      // ignore: deprecated_member_use_from_same_package
      expect(compact.isAtLeastMedium, isFalse);

      compact.dispose();
      regular.dispose();
      expanded.dispose();
    });
  });

  group('system page padding', () {
    // The 4″ square panel: DPR ≈ 1.76 and density 0.85, so one design px is
    // not one logical px. AppSpacings caches the registered service on first
    // use, so it must be registered before any token is read.
    final dpr = 170 / VisualDensityService.flutterPiPpiPerDpr;
    late ScreenService active;

    setUpAll(() async {
      await locator.reset();
      active = ScreenService(
        screenWidth: 480,
        screenHeight: 480,
        pixelRatio: dpr,
        density: 0.85,
      );
      locator.registerSingleton<ScreenService>(active);
    });

    tearDownAll(() async {
      active.dispose();
      await locator.reset();
    });

    test('is the scaled 6 on the active Compact screen', () {
      final expected = 6 * (2 / dpr) * 0.85;

      expect(active.sizeClass, ScreenSizeClass.compact);
      expect(active.scale(1), isNot(closeTo(1, 0.01)));
      expect(active.systemPagePadding(true), closeTo(expected, 0.0001));
      expect(active.systemPagePadding(false), closeTo(expected, 0.0001));
    });

    test('is 6, 8 or 12 design px by size class, in both orientations', () {
      final unit = active.scale(1);
      final regular = ScreenService(screenWidth: 800, screenHeight: 1280, pixelRatio: 2, density: 1.0);
      final expanded = ScreenService(screenWidth: 1920, screenHeight: 1080, pixelRatio: 2, density: 1.0);

      for (final landscape in [true, false]) {
        expect(active.systemPagePadding(landscape), closeTo(6 * unit, 0.0001));
        expect(regular.systemPagePadding(landscape), closeTo(8 * unit, 0.0001));
        expect(expanded.systemPagePadding(landscape), closeTo(12 * unit, 0.0001));
      }

      regular.dispose();
      expanded.dispose();
    });
  });
}
