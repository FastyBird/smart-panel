import 'dart:math' as math;

import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/sky/sky_look.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Where the sky's layers sit (design canvas, `Sky.dc.html` and the room
/// overview), as shares of the panel's width and height; `m` is the shorter
/// side.
class SkyLayerMetrics {
  SkyLayerMetrics._();

  /// Stars, as (x, y) shares.
  static const List<(double, double)> stars = [
    (0.12, 0.08),
    (0.33, 0.2),
    (0.55, 0.06),
    (0.9, 0.36),
    (0.2, 0.46),
    (0.62, 0.52),
    (0.84, 0.72),
    (0.4, 0.82),
  ];

  /// Cloud bars, as (x, y, width) shares and a height share of `m`.
  static const List<(double, double, double, double)> clouds = [
    (0.4, 0.42, 0.55, 0.1),
    (-0.12, 0.2, 0.5, 0.09),
    (0.3, -0.03, 0.75, 0.14),
  ];

  /// Fog bands, as (y, height) shares.
  static const List<(double, double)> fog = [
    (0.3, 0.12),
    (0.52, 0.1),
    (0.72, 0.12),
  ];

  /// Snow dots, as (x, y) shares.
  static const List<(double, double)> snow = [
    (0.1, 0.3),
    (0.25, 0.55),
    (0.38, 0.35),
    (0.5, 0.7),
    (0.62, 0.42),
    (0.74, 0.62),
    (0.86, 0.3),
    (0.93, 0.78),
    (0.18, 0.8),
    (0.45, 0.2),
  ];

  static const double star = 2;
  static const double snowDot = 4;
  static const double moonMin = 14;
  static const double cloudMin = 10;
  static const double rainLine = 1;

  /// The rain lines' slant: CSS 105deg, so they lean 15° from vertical.
  static const double rainAngle = 105;

  /// The rain region starts a quarter of the way down.
  static const double rainTop = 0.25;

  /// The lightning mark: its right and top as shares, its size as a share of
  /// `m` with a floor.
  static const double lightningRight = 0.12;
  static const double lightningTop = 0.3;
  static const double lightningShare = 0.26;
  static const double lightningMin = 20;
}

/// The sky panel's background (spec §2): the three-stop gradient and at most
/// four flat layers, with no blur. Screen readers skip it.
class SkyBackdrop extends StatelessWidget {
  const SkyBackdrop({super.key, required this.look});

  final SkyLook look;

  @override
  Widget build(BuildContext context) => ExcludeSemantics(
    child: LayoutBuilder(
      builder: (context, constraints) {
        final size = constraints.biggest;
        final m = math.min(size.width, size.height);
        final bolt = math.max(
          AppSpacings.scale(SkyLayerMetrics.lightningMin),
          m * SkyLayerMetrics.lightningShare,
        );

        return Stack(
          fit: StackFit.expand,
          children: [
            RepaintBoundary(
              child: CustomPaint(
                painter: SkyPainter(look: look, unit: AppSpacings.scale(1)),
              ),
            ),
            if (look.lightning && size.isFinite)
              Positioned(
                right: size.width * SkyLayerMetrics.lightningRight,
                top: size.height * SkyLayerMetrics.lightningTop,
                child: Icon(
                  MdiIcons.lightningBolt,
                  size: bolt,
                  color: AppSkyColors.lightning,
                ),
              ),
          ],
        );
      },
    ),
  );
}

/// Paints a [SkyLook]: the gradient, then the sun or moon, stars, clouds or
/// fog, and rain or snow. [unit] is one design px.
class SkyPainter extends CustomPainter {
  const SkyPainter({required this.look, required this.unit});

  final SkyLook look;
  final double unit;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final w = size.width, h = size.height;
    final m = math.min(w, h);

    canvas.save();
    canvas.clipRect(rect);

    canvas.drawRect(
      rect,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: look.stops,
          stops: SkyLook.stopPositions,
        ).createShader(rect),
    );

    if (look.showSun) _paintSun(canvas, w, h, m);

    if (look.showMoon) {
      final d = math.max(SkyLayerMetrics.moonMin * unit, m * 0.13);
      canvas.drawOval(
        Rect.fromLTWH(w * 0.76, h * 0.1, d, d),
        Paint()..color = AppSkyColors.moon,
      );
    }

    if (look.showStars) {
      final paint = Paint()..color = AppSkyColors.star;
      final d = SkyLayerMetrics.star * unit;
      for (final (x, y) in SkyLayerMetrics.stars) {
        canvas.drawOval(Rect.fromLTWH(w * x, h * y, d, d), paint);
      }
    }

    final cloud = Paint()..color = look.cloudColor;
    for (final (x, y, width, height) in SkyLayerMetrics.clouds.take(
      look.cloudBars,
    )) {
      final barHeight = math.max(SkyLayerMetrics.cloudMin * unit, m * height);
      canvas.drawRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTWH(w * x, h * y, w * width, barHeight),
          Radius.circular(barHeight / 2),
        ),
        cloud,
      );
    }

    if (look.fogBands) {
      final fog = Paint()..color = look.fogColor;
      final overhang = 10 * unit;
      for (final (y, height) in SkyLayerMetrics.fog) {
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            Rect.fromLTWH(-overhang, h * y, w + 2 * overhang, h * height),
            Radius.circular(h * height / 2),
          ),
          fog,
        );
      }
    }

    if (look.rainLines) _paintRain(canvas, w, h);

    if (look.snowDots) {
      final snow = Paint()..color = look.snowColor;
      final d = SkyLayerMetrics.snowDot * unit;
      for (final (x, y) in SkyLayerMetrics.snow) {
        canvas.drawOval(Rect.fromLTWH(w * x, h * y, d, d), snow);
      }
    }

    canvas.restore();
  }

  /// The sun is a glow, not a disc: its core colour fades out by 70 % of
  /// its radius.
  void _paintSun(Canvas canvas, double w, double h, double m) {
    final (
      Rect box,
      List<Color> colors,
      List<double> stops,
    ) = switch (look.part) {
      SkyDayPart.morning => (
        Rect.fromLTWH(-m * 0.25, h - m * 0.5, m * 0.8, m * 0.8),
        AppSkyColors.sunMorning,
        const [0.0, 0.4, 0.7],
      ),
      SkyDayPart.evening => (
        Rect.fromLTWH(w * 0.5, h - m * 0.3, m * 0.7, m * 0.7),
        AppSkyColors.sunEvening,
        const [0.0, 0.4, 0.7],
      ),
      _ => (
        Rect.fromLTWH(w - m * 0.55, -m * 0.4, m * 0.95, m * 0.95),
        AppSkyColors.sunDay,
        const [0.0, 0.38, 0.7],
      ),
    };

    canvas.drawOval(
      box,
      Paint()
        ..shader = RadialGradient(
          colors: colors,
          stops: stops,
        ).createShader(box),
    );
  }

  /// Thin slanted lines across the lower three quarters.
  void _paintRain(Canvas canvas, double w, double h) {
    final region = Rect.fromLTWH(
      0,
      h * SkyLayerMetrics.rainTop,
      w,
      h * (1 - SkyLayerMetrics.rainTop),
    );
    final angle = SkyLayerMetrics.rainAngle * math.pi / 180;
    // The gradient runs along `across`; the lines run along `along`.
    final across = Offset(math.sin(angle), -math.cos(angle));
    final along = Offset(-across.dy, across.dx);
    final gap = look.rainGap * unit;
    final reach = region.longestSide + region.shortestSide;
    final paint = Paint()
      ..color = look.rainColor
      ..strokeWidth = SkyLayerMetrics.rainLine * unit;

    canvas.save();
    canvas.clipRect(region);
    final origin = region.topLeft;
    for (var d = -reach; d <= reach; d += gap) {
      final centre = origin + across * d;
      canvas.drawLine(centre - along * reach, centre + along * reach, paint);
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(SkyPainter oldDelegate) =>
      oldDelegate.look != look || oldDelegate.unit != unit;
}
