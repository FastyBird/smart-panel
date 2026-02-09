import 'dart:math';

import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/modules/devices/services/property_timeseries.dart';
import 'package:flutter/material.dart';

/// Custom painter for the sensor history line chart. Draws grid, labels, area
/// fill and line from [PropertyTimeseries] with nice tick computation.
class SensorChartPainter extends CustomPainter {
  final Color color;
  final Color labelColor;
  final double? _fontSize;
  final PropertyTimeseries? timeseries;

  static double get labelWidth => AppSpacings.scale(26);
  static double get _labelGap => AppSpacings.scale(6);

  double get fontSize => _fontSize ?? AppFontSize.extraSmall;

  SensorChartPainter({
    required this.color,
    required this.labelColor,
    double? fontSize,
    this.timeseries,
  }) : _fontSize = fontSize;

  @override
  void paint(Canvas canvas, Size size) {
    final chartLeft = labelWidth + _labelGap;
    final chartWidth = size.width - chartLeft;
    final chartHeight = size.height;
    double niceMin = 0;
    double niceMax = 1;
    List<double> ticks = [0, 0.5, 1];
    if (timeseries != null && timeseries!.isNotEmpty) {
      ticks = _computeNiceTicks(timeseries!.minValue, timeseries!.maxValue);
      niceMin = ticks.first;
      niceMax = ticks.last;
    }
    final niceRange = niceMax - niceMin;
    final gridPaint = Paint()
      ..color = color.withValues(alpha: 0.1)
      ..strokeWidth = 0.5;
    for (final tick in ticks) {
      final normalized = niceRange == 0 ? 0.5 : (tick - niceMin) / niceRange;
      final y = chartHeight * (1 - normalized);
      canvas.drawLine(
          Offset(chartLeft, y), Offset(size.width, y), gridPaint);
      if (timeseries != null && timeseries!.isNotEmpty) {
        final label = _formatLabel(tick);
        final textPainter = TextPainter(
          text: TextSpan(
              text: label,
              style: TextStyle(color: labelColor, fontSize: fontSize)),
          textDirection: TextDirection.ltr,
        )..layout(maxWidth: labelWidth);
        textPainter.paint(canvas,
            Offset(labelWidth - textPainter.width, y - textPainter.height / 2));
      }
    }
    final points = <Offset>[];
    if (timeseries != null && timeseries!.isNotEmpty) {
      final data = timeseries!.points;
      for (int i = 0; i < data.length; i++) {
        final x = chartLeft +
            chartWidth * i / (data.length - 1).clamp(1, double.infinity);
        final normalizedValue = niceRange == 0
            ? 0.5
            : (data[i].numericValue - niceMin) / niceRange;
        final y = chartHeight * (1 - normalizedValue.clamp(0.0, 1.0));
        points.add(Offset(x, y));
      }
    }
    if (points.isEmpty) return;
    final areaPath = Path()..moveTo(chartLeft, chartHeight);
    for (final point in points) {
      areaPath.lineTo(point.dx, point.dy);
    }
    areaPath.lineTo(points.last.dx, chartHeight);
    areaPath.close();
    canvas.drawPath(
        areaPath,
        Paint()
          ..color = color.withValues(alpha: 0.1)
          ..style = PaintingStyle.fill);
    final linePath = Path()..moveTo(points.first.dx, points.first.dy);
    for (int i = 1; i < points.length; i++) {
      linePath.lineTo(points[i].dx, points[i].dy);
    }
    canvas.drawPath(
        linePath,
        Paint()
          ..color = color
          ..strokeWidth = 2
          ..style = PaintingStyle.stroke);
    if (timeseries != null && timeseries!.isNotEmpty) {
      canvas.drawCircle(points.last, 4, Paint()..color = color);
    }
  }

  static const double _ln10 = 2.302585092994046;

  List<double> _computeNiceTicks(double dataMin, double dataMax,
      {int targetTicks = 5}) {
    if (dataMin == dataMax) {
      final v = dataMin;
      if (v == 0) return [-1, -0.5, 0, 0.5, 1];
      final offset = v.abs() * 0.1;
      final step = _niceStep(offset * 2 / (targetTicks - 1));
      final nMin = ((v - offset) / step).floor() * step;
      return List.generate(
          targetTicks, (i) => _roundToStep(nMin + i * step, step));
    }
    final rawStep = (dataMax - dataMin) / (targetTicks - 1);
    final step = _niceStep(rawStep);
    final niceMin = (dataMin / step).floor() * step;
    final niceMax = (dataMax / step).ceil() * step;
    final ticks = <double>[];
    var tick = niceMin;
    while (tick <= niceMax + step * 0.5) {
      ticks.add(_roundToStep(tick, step));
      tick += step;
    }
    return ticks;
  }

  double _niceStep(double rawStep) {
    if (rawStep <= 0) return 1;
    final magnitude = pow(10, (log(rawStep) / _ln10).floor().toDouble());
    final fraction = rawStep / magnitude;
    double niceFraction =
        fraction <= 1.5 ? 1 : (fraction <= 3 ? 2 : (fraction <= 7 ? 5 : 10));
    return niceFraction * magnitude;
  }

  double _roundToStep(double value, double step) {
    if (step >= 1) return (value / step).round() * step;
    final decimals = -(log(step) / _ln10).floor();
    final factor = pow(10, decimals.toDouble());
    return (value * factor).round() / factor;
  }

  String _formatLabel(double value) {
    if (value.abs() >= 1000) return '${(value / 1000).toStringAsFixed(1)}k';
    if (value == value.roundToDouble()) return value.round().toString();
    return value.toStringAsFixed(1);
  }

  @override
  bool shouldRepaint(covariant SensorChartPainter oldDelegate) =>
      oldDelegate.color != color || oldDelegate.timeseries != timeseries;
}
