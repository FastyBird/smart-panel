import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/control_colors.dart';
import 'package:flutter/material.dart';

/// Measurements of [AppSlider] in design px (docs/display-ui-design-spec.md
/// §5 and the design canvas).
@immutable
class AppSliderMetrics {
  const AppSliderMetrics({
    required this.track,
    required this.thumb,
    required this.height,
  });

  /// Track height.
  final double track;

  /// Thumb diameter.
  final double thumb;

  /// The slider's height, which is also its touch height.
  final double height;

  /// The thumb's ring while idle.
  static const double ring = 3;

  /// The thumb's dashed ring while pending, not confirmed or disabled.
  static const double dashedRing = 2;

  /// The keyboard focus ring around the thumb: its width and its gap from
  /// the thumb.
  static const double focusRing = 2;
  static const double focusGap = 2;

  /// A slider in a list row or a card: settings, device cards, sheets.
  static const AppSliderMetrics row = AppSliderMetrics(
    track: 10,
    thumb: 22,
    height: 36,
  );

  /// The hero card's slider. Track and thumb follow the canvas; the touch
  /// height is 48 at every class, the spec §4 floor for a hero slider
  /// (HeroCardMetrics gives it that slot).
  static AppSliderMetrics hero(ScreenSizeClass sizeClass) =>
      switch (sizeClass) {
        ScreenSizeClass.compact => const AppSliderMetrics(
          track: 12,
          thumb: 24,
          height: 48,
        ),
        ScreenSizeClass.regular => const AppSliderMetrics(
          track: 14,
          thumb: 28,
          height: 48,
        ),
        ScreenSizeClass.expanded => const AppSliderMetrics(
          track: 16,
          thumb: 32,
          height: 48,
        ),
      };
}

/// The one slider (docs/display-ui-design-spec.md §5): a `fill.base` track
/// filled up to the thumb in the domain colour inside a domain view and the
/// accent outside one, and a white thumb with a ring in the same colour.
///
/// Tap or drag anywhere along it; arrow keys step it when focused, and a
/// keyboard focus ring then circles the thumb. There are no step labels:
/// presets sit beside the slider instead.
///
/// - [ControlState.pending]: the thumb's ring turns dashed `text.secondary`.
/// - [ControlState.unconfirmed]: the ring is dashed in the warning colour.
/// - [ControlState.disabled], or no [onChanged] while [state] is idle: the
///   fill is `text.disabled`, the ring dashed `text.disabled`, and it does
///   not move. A pending or unconfirmed [state] keeps its ring without
///   [onChanged].
///
/// A drag cut short by a disable stays dead: it does not resume when the
/// slider is enabled again before the finger lifts.
class AppSlider extends StatefulWidget {
  const AppSlider({
    super.key,
    required this.value,
    this.onChanged,
    this.onChangeStart,
    this.onChangeEnd,
    this.color,
    this.activeColor,
    this.trackGradient,
    this.thumbColor,
    this.ringColor,
    this.divisions,
    this.state = ControlState.idle,
    this.hero = false,
    this.sizeClass,
    this.semanticLabel,
    this.semanticFormatter,
  });

  /// From 0 to 1.
  final double value;

  final ValueChanged<double>? onChanged;
  final ValueChanged<double>? onChangeStart;
  final ValueChanged<double>? onChangeEnd;

  /// The domain or status colour; null or [ThemeColors.primary] is the
  /// accent.
  final ThemeColors? color;

  /// An already resolved fill, for callers that hold a [Color]. Wins over
  /// [color].
  final Color? activeColor;

  /// A track that shows the value's meaning (colour temperature, hue,
  /// brightness). Replaces the filled track.
  final List<Color>? trackGradient;

  /// The thumb's fill, for colour sliders where it shows the picked colour.
  final Color? thumbColor;

  /// The thumb's ring while idle, for colour sliders where it shows the
  /// picked colour; defaults to the fill colour.
  final Color? ringColor;

  /// Snaps to this many steps.
  final int? divisions;

  final ControlState state;

  /// The hero card's slider ([AppSliderMetrics.hero]); otherwise
  /// [AppSliderMetrics.row].
  final bool hero;

  /// The class to size a hero slider for; defaults to the screen's.
  final ScreenSizeClass? sizeClass;

  /// What the slider sets, for screen readers ("Brightness").
  final String? semanticLabel;

  /// How screen readers say the value; defaults to a percentage.
  final String Function(double value)? semanticFormatter;

  @override
  State<AppSlider> createState() => _AppSliderState();
}

class _AppSliderState extends State<AppSlider> {
  /// Whether the slider has focus.
  bool _focused = false;

  /// Whether focus is being moved with a keyboard; a touch-focused slider
  /// shows no ring.
  bool _keyboard =
      FocusManager.instance.highlightMode == FocusHighlightMode.traditional;

  /// Bumped when the slider stops taking input; it keys the [Slider], so a
  /// drag in progress is dropped with it and cannot resume on re-enable.
  int _gesture = 0;

  static bool _enabledOf(AppSlider slider) =>
      slider.onChanged != null && slider.state != ControlState.disabled;

  @override
  void didUpdateWidget(AppSlider oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (_enabledOf(oldWidget) && !_enabledOf(widget)) _gesture++;
  }

  @override
  void initState() {
    super.initState();
    FocusManager.instance.addHighlightModeListener(_onHighlightMode);
  }

  @override
  void dispose() {
    FocusManager.instance.removeHighlightModeListener(_onHighlightMode);
    super.dispose();
  }

  void _onHighlightMode(FocusHighlightMode mode) {
    final keyboard = mode == FocusHighlightMode.traditional;
    if (keyboard != _keyboard && mounted) setState(() => _keyboard = keyboard);
  }

  @override
  Widget build(BuildContext context) {
    final AppSlider(
      :value,
      :onChanged,
      :onChangeStart,
      :onChangeEnd,
      :color,
      :activeColor,
      :trackGradient,
      :thumbColor,
      :ringColor,
      :divisions,
      :state,
      :hero,
      :sizeClass,
      :semanticLabel,
      :semanticFormatter,
    ) = widget;
    final theme = Theme.of(context);
    final neutrals = theme.neutrals;
    final metrics = hero
        ? AppSliderMetrics.hero(
            sizeClass ?? locator<ScreenService>().sizeClass,
          )
        : AppSliderMetrics.row;
    final enabled = _enabledOf(widget);
    final effectiveState = enabled || state != ControlState.idle
        ? state
        : ControlState.disabled;

    final fill = !enabled
        ? neutrals.textDisabled
        : activeColor ?? ControlTint.of(theme, color).fill;
    // A disabled slider drops its gradient for the plain disabled fill.
    final gradient =
        enabled && trackGradient != null && trackGradient.length >= 2
        ? trackGradient
        : null;
    final dash = controlDashColor(theme, effectiveState);

    final thumbRadius = AppSpacings.scale(metrics.thumb) / 2;

    final slider = SliderTheme(
      data: SliderThemeData(
        padding: EdgeInsets.zero,
        trackHeight: AppSpacings.scale(metrics.track),
        trackShape: AppSliderTrackShape(
          background: neutrals.fillBase,
          fill: fill,
          gradient: gradient,
          thumbRadius: thumbRadius,
        ),
        thumbShape: AppSliderThumbShape(
          radius: thumbRadius,
          fill: dash != null ? neutrals.surfaceCard : (thumbColor ?? AppControlColors.thumb),
          ring: dash ?? (enabled ? ringColor : null) ?? fill,
          ringWidth: AppSpacings.scale(
            dash != null ? AppSliderMetrics.dashedRing : AppSliderMetrics.ring,
          ),
          dashed: dash != null,
          focusRing: enabled && _focused && _keyboard ? fill : null,
          focusRingWidth: AppSpacings.scale(AppSliderMetrics.focusRing),
          focusGap: AppSpacings.scale(AppSliderMetrics.focusGap),
        ),
        overlayShape: SliderComponentShape.noOverlay,
        overlayColor: AppColors.blank,
        tickMarkShape: SliderTickMarkShape.noTickMark,
        showValueIndicator: ShowValueIndicator.never,
      ),
      child: Slider(
        key: ValueKey(_gesture),
        value: value.clamp(0.0, 1.0),
        divisions: divisions,
        onChanged: enabled ? onChanged : null,
        onChangeStart: enabled ? onChangeStart : null,
        onChangeEnd: enabled ? onChangeEnd : null,
        semanticFormatterCallback:
            semanticFormatter ?? (v) => '${(v * 100).round()} %',
      ),
    );

    return Semantics(
      label: semanticLabel,
      child: Focus(
        canRequestFocus: false,
        skipTraversal: true,
        onFocusChange: (focused) => setState(() => _focused = focused),
        child: SizedBox(
          height: AppSpacings.scale(metrics.height),
          child: slider,
        ),
      ),
    );
  }
}

/// [AppSlider]'s full-width pill track. The thumb travels inside it, from one
/// end to the other, so the thumb never pokes out of the slider.
class AppSliderTrackShape extends SliderTrackShape {
  const AppSliderTrackShape({
    required this.background,
    required this.fill,
    required this.gradient,
    required this.thumbRadius,
  });

  final Color background;
  final Color fill;
  final List<Color>? gradient;
  final double thumbRadius;

  Rect _fullRect(RenderBox parentBox, Offset offset, double height) => Rect.fromLTWH(
    offset.dx,
    offset.dy + (parentBox.size.height - height) / 2,
    parentBox.size.width,
    height,
  );

  @override
  Rect getPreferredRect({
    required RenderBox parentBox,
    Offset offset = Offset.zero,
    required SliderThemeData sliderTheme,
    bool isEnabled = false,
    bool isDiscrete = false,
  }) {
    // The thumb's travel: the track less a thumb radius at each end.
    final full = _fullRect(parentBox, offset, sliderTheme.trackHeight ?? 0);

    return Rect.fromLTRB(
      full.left + thumbRadius,
      full.top,
      full.right - thumbRadius,
      full.bottom,
    );
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
    final rect = _fullRect(parentBox, offset, sliderTheme.trackHeight ?? 0);
    final radius = Radius.circular(rect.height / 2);
    final canvas = context.canvas;
    // Right to left, the value runs from the right end.
    final rtl = textDirection == TextDirection.rtl;

    if (gradient != null) {
      // The stops follow the thumb's travel, so each colour sits under the
      // thumb at its value; the rounded ends take the end colours.
      final travel = getPreferredRect(
        parentBox: parentBox,
        offset: offset,
        sliderTheme: sliderTheme,
      );
      canvas.drawRRect(
        RRect.fromRectAndRadius(rect, radius),
        Paint()
          ..shader = LinearGradient(
            begin: rtl ? Alignment.centerRight : Alignment.centerLeft,
            end: rtl ? Alignment.centerLeft : Alignment.centerRight,
            colors: gradient!,
          ).createShader(travel),
      );

      return;
    }

    canvas.drawRRect(
      RRect.fromRectAndRadius(rect, radius),
      Paint()..color = background,
    );

    final thumbX = thumbCenter.dx.clamp(rect.left, rect.right);
    final filled = rtl
        ? Rect.fromLTRB(thumbX, rect.top, rect.right, rect.bottom)
        : Rect.fromLTRB(rect.left, rect.top, thumbX, rect.bottom);
    if (filled.width > 0) {
      canvas.drawRRect(
        RRect.fromRectAndRadius(filled, radius),
        Paint()..color = fill,
      );
    }
  }
}

/// [AppSlider]'s thumb: a disc with a solid or dashed ring, and a focus ring
/// around it while the keyboard has focus on the slider.
class AppSliderThumbShape extends SliderComponentShape {
  const AppSliderThumbShape({
    required this.radius,
    required this.fill,
    required this.ring,
    required this.ringWidth,
    required this.dashed,
    this.focusRing,
    this.focusRingWidth = 2,
    this.focusGap = 2,
  });

  final double radius;
  final Color fill;
  final Color ring;
  final double ringWidth;
  final bool dashed;

  /// The focus ring's colour; null draws none.
  final Color? focusRing;
  final double focusRingWidth;
  final double focusGap;

  @override
  Size getPreferredSize(bool isEnabled, bool isDiscrete) =>
      Size.fromRadius(radius);

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
    final canvas = context.canvas;
    canvas.drawCircle(center, radius, Paint()..color = fill);

    final ringPaint = Paint()
      ..color = ring
      ..style = PaintingStyle.stroke
      ..strokeWidth = ringWidth;
    final ringRadius = radius - ringWidth / 2;

    if (dashed) {
      paintDashedCircle(canvas, center, ringRadius, ringPaint);
    } else {
      canvas.drawCircle(center, ringRadius, ringPaint);
    }

    if (focusRing != null) {
      canvas.drawCircle(
        center,
        radius + focusGap + focusRingWidth / 2,
        Paint()
          ..color = focusRing!
          ..style = PaintingStyle.stroke
          ..strokeWidth = focusRingWidth,
      );
    }
  }
}
