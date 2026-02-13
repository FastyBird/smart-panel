import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

/// A simple slider widget with step labels below.
///
/// Unlike [CardSlider], this widget does not include a container, label,
/// or value display - just the slider and step labels. Useful when you want
/// to embed a slider within an existing card or layout.
///
/// Features:
/// - Continuous or discrete step modes
/// - Customizable step labels
/// - Theme-aware colors via [ThemeColorFamily] and [themeColor]
/// - Custom thumb with colored border for better visibility
/// - Optional gradient track via [trackGradientColors]
/// - Optional custom thumb fill via [thumbFillColor]
class SliderWithSteps extends StatelessWidget {
  /// Current value (0.0 to 1.0)
  final double value;

  /// Theme color key for the slider track, thumb border, and overlay.
  /// Resolved via [ThemeColorFamily.get](brightness, [themeColor]).
  final ThemeColors themeColor;

  /// Callback when value changes
  final ValueChanged<double>? onChanged;

  /// Labels to show below the slider (e.g., ['Off', 'Low', 'Med', 'High', 'Max'])
  final List<String> steps;

  /// Whether the slider is enabled
  final bool enabled;

  /// When true, the slider snaps to discrete step positions.
  /// When false, the slider allows continuous 0-100% values.
  final bool discrete;

  /// Whether to show step labels below the slider.
  final bool showSteps;

  /// When true, renders the slider vertically (bottom-to-top).
  /// Value 0 is at the bottom, value 1 at the top. Step labels are hidden.
  final bool vertical;

  /// Gradient colors for the full track. When set, replaces the default
  /// active/inactive track coloring with a continuous gradient.
  final List<Color>? trackGradientColors;

  /// Custom thumb fill color. When set, overrides the default theme-based
  /// thumb fill (useful for sliders where the thumb reflects the current
  /// value, e.g. color temperature or hue).
  final Color? thumbFillColor;

  /// Custom thumb border color. When set, overrides the default theme-based
  /// border (useful for color sliders where the border should match the thumb).
  final Color? thumbBorderColor;

  const SliderWithSteps({
    super.key,
    required this.value,
    this.themeColor = ThemeColors.primary,
    this.onChanged,
    this.steps = const ['0%', '25%', '50%', '75%', '100%'],
    this.enabled = true,
    this.discrete = false,
    this.showSteps = true,
    this.vertical = false,
    this.trackGradientColors,
    this.thumbFillColor,
    this.thumbBorderColor,
  });

  @override
  Widget build(BuildContext context) {
    final screenService = locator<ScreenService>();
    final visualDensityService = locator<VisualDensityService>();

    double scale(double val) =>
        screenService.scale(val, density: visualDensityService.density);

    final brightness = Theme.of(context).brightness;
    final isDark = brightness == Brightness.dark;
    final colorFamily = ThemeColorFamily.get(brightness, themeColor);
    final effectiveActiveColor = colorFamily.base;
    final effectiveOverlayColor = colorFamily.light7;

    final mutedColor =
        isDark ? AppTextColorDark.disabled : AppTextColorLight.disabled;
    final stepColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
    final trackColor =
        isDark ? AppFillColorDark.darker : AppFillColorLight.darker;

    // For discrete mode, calculate divisions based on steps
    final divisions = discrete && steps.length > 1 ? steps.length - 1 : null;

    // Disabled active track color (left part of track when disabled)
    final disabledActiveColor =
        isDark ? AppTextColorDark.placeholder : AppTextColorLight.disabled;

    // Active track: accent when enabled, muted gray when disabled
    final sliderActiveColor = enabled ? effectiveActiveColor : disabledActiveColor;

    // When gradient colors are provided, use a custom track shape
    final hasGradient = trackGradientColors != null && trackGradientColors!.length >= 2;

    // Thumb border: explicit override, match track border for gradient in
    // light mode, or default to active track color
    final resolvedThumbBorder = thumbBorderColor ??
        (hasGradient && !isDark
            ? AppBorderColorLight.darker
            : (enabled ? effectiveActiveColor : disabledActiveColor));
    // Thumb fill: custom color, or dark background when enabled, gray when disabled
    final resolvedThumbFill = thumbFillColor ??
        (enabled
            ? (isDark ? AppFillColorDark.base : AppFillColorLight.base)
            : isDark ? AppFillColorDark.darker : AppFillColorLight.darker);

    final clampedValue = value.clamp(0.0, 1.0);

    final sliderTheme = SliderTheme.of(context).copyWith(
      activeTrackColor: hasGradient ? Colors.transparent : sliderActiveColor,
      inactiveTrackColor: hasGradient ? Colors.transparent : trackColor,
      thumbColor: resolvedThumbFill,
      overlayColor: effectiveOverlayColor,
      trackHeight: scale(12),
      trackShape: hasGradient
          ? _GradientTrackShape(
              colors: trackGradientColors!,
              trackHeight: scale(12),
              borderColor:
                  isDark ? null : AppBorderColorLight.darker,
              borderWidth: scale(1),
            )
          : null,
      thumbShape: _SliderThumbWithBorder(
        thumbRadius: scale(12),
        fillColor: resolvedThumbFill,
        borderColor: resolvedThumbBorder,
        borderWidth: scale(2),
        outlineColor: thumbBorderColor != null && !isDark
            ? AppBorderColorLight.darker
            : null,
        outlineWidth: scale(1),
      ),
    );

    final slider = SliderTheme(
      data: sliderTheme,
      child: IgnorePointer(
        ignoring: !enabled,
        child: Slider(
          value: clampedValue,
          divisions: divisions,
          onChanged: enabled ? onChanged : null,
        ),
      ),
    );

    if (vertical) {
      return RotatedBox(
        quarterTurns: 3,
        child: slider,
      );
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      spacing: AppSpacings.pXs,
      children: [
        slider,
        if (showSteps) ...[
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: steps
                .map((s) => Text(
                      s,
                      style: TextStyle(
                        color: enabled ? stepColor : mutedColor,
                        fontSize: AppFontSize.extraSmall,
                      ),
                    ))
                .toList(),
          ),
        ],
      ],
    );
  }
}

/// Custom slider thumb shape with colored border for better contrast.
///
/// When the border color has low contrast against the fill (e.g. a white-ish
/// color temperature thumb on a light background), an automatic outer outline
/// ring is drawn using [outlineColor] so the thumb stays visible.
class _SliderThumbWithBorder extends SliderComponentShape {
  final double thumbRadius;
  final Color fillColor;
  final Color borderColor;
  final double borderWidth;

  /// Thin outline drawn outside the border when the border has low contrast
  /// against the fill. Pass null to disable.
  final Color? outlineColor;
  final double outlineWidth;

  const _SliderThumbWithBorder({
    required this.thumbRadius,
    required this.fillColor,
    required this.borderColor,
    required this.borderWidth,
    this.outlineColor,
    this.outlineWidth = 1.0,
  });

  @override
  Size getPreferredSize(bool isEnabled, bool isDiscrete) {
    return Size.fromRadius(thumbRadius);
  }

  @override
  void paint(
    PaintingContext context,
    Offset center, {
    required Animation<double> activationAnimation,
    required Animation<double> enableAnimation,
    required bool isDiscrete,
    required TextPainter labelPainter,
    required RenderBox parentBox,
    required SliderThemeData sliderTheme,
    required TextDirection textDirection,
    required double value,
    required double textScaleFactor,
    required Size sizeWithOverflow,
  }) {
    final Canvas canvas = context.canvas;

    // Draw outer outline when border has low contrast against fill
    if (outlineColor != null) {
      final contrast =
          (borderColor.computeLuminance() - fillColor.computeLuminance()).abs();
      if (contrast < 0.15) {
        final outlinePaint = Paint()
          ..color = outlineColor!
          ..style = PaintingStyle.stroke
          ..strokeWidth = outlineWidth;
        canvas.drawCircle(center, thumbRadius, outlinePaint);
      }
    }

    // Draw fill
    final fillPaint = Paint()
      ..color = fillColor
      ..style = PaintingStyle.fill;
    canvas.drawCircle(center, thumbRadius, fillPaint);

    // Draw colored border
    final borderPaint = Paint()
      ..color = borderColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = borderWidth;
    canvas.drawCircle(center, thumbRadius - borderWidth / 2, borderPaint);
  }
}

/// Custom track shape that paints a gradient across the full track.
class _GradientTrackShape extends SliderTrackShape {
  final List<Color> colors;
  final double trackHeight;
  final Color? borderColor;
  final double borderWidth;

  const _GradientTrackShape({
    required this.colors,
    required this.trackHeight,
    this.borderColor,
    this.borderWidth = 1.0,
  });

  @override
  Rect getPreferredRect({
    required RenderBox parentBox,
    Offset offset = Offset.zero,
    required SliderThemeData sliderTheme,
    bool isEnabled = false,
    bool isDiscrete = false,
  }) {
    final double trackLeft = offset.dx;
    final double trackTop =
        offset.dy + (parentBox.size.height - trackHeight) / 2;
    final double trackWidth = parentBox.size.width;
    return Rect.fromLTWH(trackLeft, trackTop, trackWidth, trackHeight);
  }

  @override
  void paint(
    PaintingContext context,
    Offset offset, {
    required RenderBox parentBox,
    required SliderThemeData sliderTheme,
    required Animation<double> enableAnimation,
    required Offset thumbCenter,
    Offset? secondaryOffset,
    bool isEnabled = false,
    bool isDiscrete = false,
    required TextDirection textDirection,
  }) {
    final rect = getPreferredRect(
      parentBox: parentBox,
      offset: offset,
      sliderTheme: sliderTheme,
    );

    final radius = Radius.circular(trackHeight / 2);
    final rrect = RRect.fromRectAndRadius(rect, radius);

    final gradient = LinearGradient(colors: colors);
    final paint = Paint()..shader = gradient.createShader(rect);

    context.canvas.drawRRect(rrect, paint);

    if (borderColor != null) {
      final borderPaint = Paint()
        ..color = borderColor!
        ..style = PaintingStyle.stroke
        ..strokeWidth = borderWidth;
      context.canvas.drawRRect(rrect, borderPaint);
    }
  }
}
