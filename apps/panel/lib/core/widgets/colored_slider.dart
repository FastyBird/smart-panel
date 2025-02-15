import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

class ColoredSlider extends StatefulWidget {
  final num value;
  final num min;
  final num max;
  final bool enabled;
  final Widget? caption;
  final List<Widget> inner;
  final double? trackHeight;
  final double? trackWidth;
  final bool showThumb;
  final double? thumbHeight;
  final double? thumbWidth;
  final BoxDecoration? background;
  final Color thumbColor;
  final Color thumbDividerColor;
  final bool vertical;
  final Color? activeTrackColor;
  final Color? inactiveTrackColor;
  final Color? disabledActiveTrackColor;
  final Color? disabledInactiveTrackColor;

  final ValueChanged<double>? onValueChanged;

  const ColoredSlider({
    super.key,
    required this.value,
    required this.min,
    required this.max,
    this.enabled = true,
    this.caption,
    this.inner = const [],
    this.trackHeight,
    this.trackWidth,
    this.showThumb = true,
    this.thumbHeight,
    this.thumbWidth,
    this.background,
    this.thumbColor = AppColors.white,
    this.thumbDividerColor = Colors.grey,
    this.vertical = false,
    this.onValueChanged,
    this.activeTrackColor,
    this.inactiveTrackColor,
    this.disabledActiveTrackColor,
    this.disabledInactiveTrackColor,
  });

  @override
  State<ColoredSlider> createState() => _ColoredSliderState();
}

class _ColoredSliderState extends State<ColoredSlider> {
  final ScreenService screenService = locator<ScreenService>();

  late final double trackHeight;
  late final double? trackWidth;
  late final double thumbHeight;
  late final double thumbWidth;

  late num actualValue;

  @override
  void initState() {
    super.initState();

    actualValue = widget.value;

    trackHeight = widget.trackHeight != null
        ? widget.trackHeight!
        : screenService.scale(75);
    trackWidth = widget.trackWidth;
    thumbHeight = widget.thumbHeight != null
        ? widget.thumbHeight!
        : screenService.scale(60);
    thumbWidth = widget.thumbWidth != null
        ? widget.thumbWidth!
        : screenService.scale(30);
  }

  @override
  void didUpdateWidget(covariant ColoredSlider oldWidget) {
    super.didUpdateWidget(oldWidget);

    // Update the local state if the parent's value changes
    if (oldWidget.value != widget.value) {
      setState(() {
        actualValue = widget.value;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    Widget slider = _renderSlider(context);

    if (widget.vertical) {
      slider = RotatedBox(
        quarterTurns: -1,
        child: slider,
      );
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.start,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        widget.caption,
        slider,
      ].whereType<Widget>().toList(),
    );
  }

  Widget _renderSlider(BuildContext context) {
    return Container(
      height: trackHeight,
      width: trackWidth,
      decoration: (widget.background ?? const BoxDecoration()).copyWith(
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
      ),
      child: Padding(
        padding: EdgeInsets.symmetric(
          horizontal: widget.showThumb ? thumbWidth / 2 : 0,
        ),
        child: Stack(
          alignment: Alignment.centerLeft,
          children: [
            SliderTheme(
              data: SliderTheme.of(context).copyWith(
                activeTrackColor: widget.background != null
                    ? Colors.transparent
                    : widget.activeTrackColor,
                inactiveTrackColor: widget.background != null
                    ? Colors.transparent
                    : widget.inactiveTrackColor,
                disabledActiveTrackColor: widget.background != null
                    ? Colors.transparent
                    : widget.disabledActiveTrackColor,
                disabledInactiveTrackColor: widget.background != null
                    ? Colors.transparent
                    : widget.disabledInactiveTrackColor,
                trackHeight: trackHeight,
                trackShape: RoundedRectTrackShape(
                  borderRadius: AppBorderRadius.base,
                ),
                thumbShape: widget.showThumb
                    ? RoundedRectThumbShape(
                        thumbWidth: thumbWidth,
                        thumbHeight: thumbHeight,
                        borderRadius: AppBorderRadius.base,
                        thumbColor: widget.thumbColor,
                        dividerColor: widget.thumbDividerColor,
                      )
                    : SliderComponentShape.noThumb,
                overlayShape: SliderComponentShape.noOverlay,
                overlayColor: Colors.transparent,
              ),
              child: Slider(
                value: actualValue.toDouble(),
                min: widget.min.toDouble(),
                max: widget.max.toDouble(),
                onChanged: widget.enabled
                    ? (value) {
                        setState(() {
                          actualValue = value;
                        });

                        widget.onValueChanged?.call(value);
                      }
                    : null,
              ),
            ),
            ...widget.inner,
          ].whereType<Widget>().toList(),
        ),
      ),
    );
  }
}

class RoundedRectThumbShape extends SliderComponentShape {
  final double thumbWidth;
  final double thumbHeight;
  final double borderRadius;
  final Color thumbColor;
  final Color dividerColor;

  const RoundedRectThumbShape({
    required this.thumbWidth,
    required this.thumbHeight,
    required this.borderRadius,
    this.thumbColor = Colors.white,
    this.dividerColor = Colors.grey,
  });

  @override
  Size getPreferredSize(bool isEnabled, bool isDiscrete) {
    return Size(thumbWidth, thumbHeight);
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

    // Thumb background: Rounded rectangle
    final Rect thumbRect = Rect.fromCenter(
      center: center,
      width: thumbWidth,
      height: thumbHeight,
    );
    final RRect roundedRect = RRect.fromRectAndRadius(
      thumbRect,
      Radius.circular(borderRadius),
    );

    final Paint thumbPaint = Paint()..color = thumbColor;
    canvas.drawRRect(roundedRect, thumbPaint);

    // Divider line in the center
    final Paint dividerPaint = Paint()
      ..color = dividerColor
      ..strokeWidth = 4.0
      ..style = PaintingStyle.stroke;

    final double lineTop = center.dy - (thumbHeight / 2) + 8;
    final double lineBottom = center.dy + (thumbHeight / 2) - 8;

    canvas.drawLine(
      Offset(center.dx, lineTop),
      Offset(center.dx, lineBottom),
      dividerPaint,
    );
  }
}

class RoundedRectTrackShape extends SliderTrackShape {
  final ScreenService screenService = locator<ScreenService>();

  final double borderRadius;

  RoundedRectTrackShape({required this.borderRadius});

  @override
  Rect getPreferredRect({
    required RenderBox parentBox,
    Offset offset = Offset.zero,
    required SliderThemeData sliderTheme,
    bool isEnabled = false,
    bool isDiscrete = false,
  }) {
    final double trackHeight = sliderTheme.trackHeight ?? 8.0;
    final double trackTop =
        offset.dy + (parentBox.size.height - trackHeight) / 2;
    final double trackBottom = trackTop + trackHeight;

    return Rect.fromLTRB(
      offset.dx,
      trackTop,
      offset.dx + parentBox.size.width,
      trackBottom,
    );
  }

  @override
  void paint(
    PaintingContext context,
    Offset offset, {
    required RenderBox parentBox,
    required SliderThemeData sliderTheme,
    required Animation<double> enableAnimation,
    required TextDirection textDirection,
    required Offset thumbCenter,
    bool isEnabled = false,
    bool isDiscrete = false,
    Offset? secondaryOffset,
  }) {
    final Canvas canvas = context.canvas;

    // Get the default track rect
    final Rect trackRect = getPreferredRect(
      parentBox: parentBox,
      sliderTheme: sliderTheme,
      offset: offset,
    );

    // Draw inactive track (background)
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        trackRect,
        Radius.circular(borderRadius),
      ),
      Paint()
        ..color = isEnabled
            ? sliderTheme.inactiveTrackColor!
            : sliderTheme.disabledInactiveTrackColor!,
    );

    // Draw active track (filled area)
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTRB(
          trackRect.left + screenService.scale(3),
          trackRect.top + screenService.scale(3),
          thumbCenter.dx,
          trackRect.bottom - screenService.scale(3),
        ),
        Radius.circular(borderRadius),
      ),
      Paint()
        ..color = isEnabled
            ? sliderTheme.activeTrackColor!
            : sliderTheme.disabledActiveTrackColor!,
    );
  }
}
