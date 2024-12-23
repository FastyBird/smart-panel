import 'dart:math';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen_scaler.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

class RoundedSlider extends StatefulWidget {
  final num value;
  final num min;
  final num max;
  final bool enabled;

  final Widget? inner;
  final TextSpan? upperLabel;
  final TextSpan? lowerLabel;

  final num availableWidth;
  final num availableHeight;

  final int? startAngleDeg;
  final int? endAngleDeg;

  final ValueChanged<num>? onValueChanged;

  const RoundedSlider({
    super.key,
    required this.value,
    required this.min,
    required this.max,
    required this.enabled,
    this.inner,
    this.upperLabel,
    this.lowerLabel,
    required this.availableWidth,
    required this.availableHeight,
    this.startAngleDeg,
    this.endAngleDeg,
    required this.onValueChanged,
  });

  @override
  State<RoundedSlider> createState() => _RoundedSliderState();
}

class _RoundedSliderState extends State<RoundedSlider> {
  final ScreenScalerService scaler = locator<ScreenScalerService>();

  double knobAngle = 0;

  late num actualValue;

  late double startAngleDeg;
  late double endAngleDeg;

  late double startAngle;
  late double endAngle;

  static const double knobSize = 14.0;
  static const double knobBorder = 3.0;
  static const double trackWidth = 8.0;
  static const double barWidth = 10.0;

  late double trackRadius;
  late Offset trackOffset;

  @override
  void initState() {
    super.initState();

    actualValue = widget.value;

    startAngleDeg = widget.startAngleDeg?.toDouble() ?? 150;
    endAngleDeg = widget.endAngleDeg?.toDouble() ?? 390;

    startAngle = startAngleDeg * pi / 180;
    endAngle = endAngleDeg * pi / 180;

    knobAngle = _valueToAngle(actualValue.toDouble());
  }

  @override
  void didUpdateWidget(covariant RoundedSlider oldWidget) {
    super.didUpdateWidget(oldWidget);

    // Update the local state if the parent's value changes
    if (oldWidget.value != widget.value) {
      setState(() {
        actualValue = widget.value;
        knobAngle = _valueToAngle(widget.value.toDouble());
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final double dialWidth = widget.availableWidth.toDouble();
    final double dialHeight = widget.availableHeight.toDouble().clamp(
          0,
          dialWidth,
        );

    double calculatedTrackRadius = min(dialWidth, dialHeight) / 2;
    double calculatedTrackOffset = _calculateCircleOffset(
      calculatedTrackRadius,
      0,
      _calculateDegreesBetween(
        startAngleDeg,
        endAngleDeg,
      ),
    );

    if ((calculatedTrackRadius * 2) + calculatedTrackOffset >
        min(dialWidth, dialHeight)) {
      calculatedTrackOffset =
          min(dialWidth, dialHeight) - (calculatedTrackRadius * 2);
    }

    setState(() {
      trackOffset = Offset(
        0,
        calculatedTrackOffset + scaler.scale(barWidth),
      );
      trackRadius = calculatedTrackRadius + calculatedTrackOffset;
    });

    return Center(
      child: SizedBox(
        width: dialWidth,
        height: widget.availableHeight.toDouble(),
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTapUp: (details) => _updateValue(details.globalPosition),
          onPanUpdate: (details) => _updateValue(details.globalPosition),
          child: CustomPaint(
            size: Size(dialWidth, dialHeight),
            painter: SliderDialPainter(
              value: actualValue.toDouble(),
              min: widget.min.toDouble(),
              max: widget.max.toDouble(),
              barColor: Theme.of(context).brightness == Brightness.light
                  ? (widget.enabled
                      ? AppColorsLight.primary
                      : AppTextColorLight.disabled)
                  : (widget.enabled
                      ? AppColorsDark.primary
                      : AppTextColorDark.placeholder),
              barWidth: scaler.scale(barWidth),
              trackColor: Theme.of(context).brightness == Brightness.light
                  ? AppBorderColorLight.light
                  : AppBorderColorDark.light,
              knobColor: AppColors.white,
              knobAngle: knobAngle,
              knobSize: scaler.scale(knobSize),
              knobBorder: scaler.scale(knobBorder),
              startAngle: startAngle,
              endAngle: endAngle,
              trackRadius: trackRadius,
              trackOffset: trackOffset,
              trackWidth: scaler.scale(trackWidth),
              isLightTheme: Theme.of(context).brightness == Brightness.light,
              upperLabel: widget.upperLabel,
              lowerLabel: widget.lowerLabel,
            ),
            child: widget.inner != null
                ? Center(
                    child: widget.inner,
                  )
                : null,
          ),
        ),
      ),
    );
  }

  void _updateValue(Offset globalPosition) {
    final RenderBox box = context.findRenderObject() as RenderBox;
    final Offset localPosition = box.globalToLocal(globalPosition);

    final Offset center = Offset(
      box.size.width / 2 + trackOffset.dx,
      box.size.height / 2 + trackOffset.dy,
    );
    final double angle = (localPosition - center).direction;

    // Normalize angle to [0, 2π] range
    final double normalizedAngle = (angle + 2 * pi) % (2 * pi);

    // Handle angle clamping
    double clampedAngle;

    if (normalizedAngle >= startAngle && normalizedAngle <= 2 * pi) {
      // Angle is between startAngle and 2π
      clampedAngle = normalizedAngle.clamp(startAngle, 2 * pi);
    } else if (normalizedAngle >= 0 && normalizedAngle <= endAngle % (2 * pi)) {
      // Angle is between 0 and endAngle (wrapped around)
      clampedAngle = normalizedAngle.clamp(0, endAngle % (2 * pi));
    } else {
      // Angle is out of range, could be ignored
      return;

      // Angle is out of range, determine the closer end
      // final double distanceToStart = (normalizedAngle - startAngle).abs(); // Distance to start angle
      // final double distanceToEnd = (normalizedAngle - (endAngle % (2 * pi))).abs(); // Distance to end angle

      // if (distanceToStart < distanceToEnd) {
      //  clampedAngle = startAngle;
      //} else {
      //  clampedAngle = endAngle % (2 * pi); // Wrap around end angle
      //}
    }

    // Calculate the new value based on the clamped angle
    final double angleRange = (endAngle - startAngle) % (2 * pi);
    final double valueRange = (widget.max - widget.min).toDouble();
    final double value =
        ((clampedAngle - startAngle + 2 * pi) % (2 * pi) / angleRange) *
                valueRange +
            widget.min;

    final double touchDistance = (localPosition - center).distance;

    final double minRadius = trackRadius - (knobSize + knobSize / 2);
    final double maxRadius = trackRadius + (knobSize + knobSize / 2);

    // Check if touch is within slider path
    if (touchDistance < minRadius || touchDistance > maxRadius) {
      // Ignore touch outside the slider path
      return;
    }

    setState(() {
      actualValue = value.clamp(widget.min, widget.max);
      knobAngle = clampedAngle;
    });

    widget.onValueChanged?.call(
      actualValue,
    );
  }

  double _valueToAngle(double value) {
    final num valueRange = widget.max - widget.min;
    final num angleRange = endAngle - startAngle;

    return ((value - widget.min) / valueRange) * angleRange + startAngle;
  }

  double _calculateCircleOffset(
    double radius,
    double startAngleDeg,
    double endAngleDeg,
  ) {
    double startAngleRad = startAngleDeg * pi / 180;
    double endAngleRad = endAngleDeg * pi / 180;

    // Calculate the y-coordinates of the points
    double yStart = radius * sin(startAngleRad);
    double yEnd = radius * sin(endAngleRad);

    // Calculate and return the height
    return radius - (yEnd - yStart).abs();
  }

  double _calculateDegreesBetween(double startAngleDeg, double endAngleDeg) {
    double degreesBetween = (endAngleDeg - startAngleDeg) % 360;

    if (degreesBetween < 0) {
      degreesBetween += 360; // Wrap negative to positive
    }

    // Shortest path: use 360 - degreesBetween if the other side is shorter
    return degreesBetween > 180 ? 360 - degreesBetween : degreesBetween;
  }
}

class SliderDialPainter extends CustomPainter {
  final double value;
  final double min;
  final double max;
  final double knobAngle;
  final Color trackColor;
  final double trackRadius;
  final Offset trackOffset;
  final double trackWidth;
  final Color barColor;
  final double barWidth;
  final Color knobColor;
  final double knobSize;
  final double knobBorder;
  final double startAngle;
  final double endAngle;
  final bool isLightTheme;
  final TextSpan? upperLabel;
  final TextSpan? lowerLabel;

  SliderDialPainter({
    required this.value,
    required this.min,
    required this.max,
    required this.knobAngle,
    required this.trackColor,
    required this.trackRadius,
    required this.trackOffset,
    required this.trackWidth,
    required this.barColor,
    required this.barWidth,
    required this.knobColor,
    required this.knobSize,
    required this.knobBorder,
    required this.startAngle,
    required this.endAngle,
    required this.isLightTheme,
    this.upperLabel,
    this.lowerLabel,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(
      size.width / 2 + trackOffset.dx,
      size.height / 2 + trackOffset.dy,
    );

    // Draw background circle
    final backgroundPaint = Paint()
      ..color = trackColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = trackWidth
      ..strokeCap = StrokeCap.round;

    canvas.drawArc(
      Rect.fromCircle(center: center, radius: trackRadius),
      startAngle,
      endAngle - startAngle,
      false,
      backgroundPaint,
    );

    // Calculate sweep angle based on current value
    final double sliderSweepAngle =
        (value - min) / (max - min) * (endAngle - startAngle);

    final sliderPaint = Paint()
      ..color = barColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = barWidth
      ..strokeCap = StrokeCap.round;

    canvas.drawArc(
      Rect.fromCircle(center: center, radius: trackRadius),
      startAngle,
      sliderSweepAngle,
      false,
      sliderPaint,
    );

    // Draw knob
    final knobBorderPaint = Paint()
      ..color = barColor // Border color
      ..style = PaintingStyle.stroke
      ..strokeWidth = knobBorder; // Border width

    final knobPaint = Paint()
      ..color = knobColor
      ..style = PaintingStyle.fill;

    final Offset knobPosition = Offset(
      center.dx + trackRadius * cos(knobAngle),
      center.dy + trackRadius * sin(knobAngle),
    );

    // Draw the border (outer circle)
    canvas.drawCircle(knobPosition, knobSize, knobBorderPaint);

    // Draw the fill (inner circle)
    canvas.drawCircle(
      knobPosition,
      knobSize - knobBorder / 2,
      knobPaint,
    );

    // Draw min and max labels
    if (lowerLabel != null) {
      _drawLabel(
        canvas,
        center,
        trackRadius,
        startAngle,
        lowerLabel!,
      );
    }

    if (upperLabel != null) {
      _drawLabel(
        canvas,
        center,
        trackRadius,
        endAngle,
        upperLabel!,
      );
    }
  }

  void _drawLabel(
    Canvas canvas,
    Offset center,
    double radius,
    double angle,
    TextSpan text,
  ) {
    final x = center.dx + radius * cos(angle);
    final y = center.dy + radius * sin(angle);

    final textPainter = TextPainter(
      text: text,
      textDirection: TextDirection.ltr,
    );

    textPainter.layout();

    if (x < center.dx) {
      final offset = Offset(
        x,
        (y - textPainter.height / 2) + AppFontSize.extraSmall + AppSpacings.pMd,
      );

      textPainter.paint(canvas, offset);
    } else {
      final offset = Offset(
        x - textPainter.width,
        (y - textPainter.height / 2) + AppFontSize.extraSmall + AppSpacings.pMd,
      );

      textPainter.paint(canvas, offset);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}
