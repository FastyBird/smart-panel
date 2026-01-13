import 'dart:math' as math;

import 'package:event_bus/event_bus.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/modules/deck/types/swipe_event.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';

/// Display format for the dial value
enum DialDisplayFormat {
  /// Temperature format with degree symbol (e.g., "22°")
  temperature,

  /// Percentage format (e.g., "45%")
  percentage,

  /// Integer format (e.g., "50")
  integer,

  /// Decimal format (e.g., "0.5")
  decimal,
}

/// Accent color types for the dial, resolved from the app theme
enum DialAccentColor {
  /// Primary color (red)
  primary,

  /// Success color (green)
  success,

  /// Warning color (orange) - use for heat mode
  warning,

  /// Danger color (red)
  danger,

  /// Info color (blue) - use for cool mode
  info,

  /// Teal color (teal/green) - use for humidity
  teal,

  /// Cyan color (light blue)
  cyan,

  /// Pink color
  pink,

  /// Indigo color (purple/blue)
  indigo,

  /// Neutral/secondary color (grey) - use for off/disabled state
  neutral,
}

/// A reusable circular control dial widget similar to a Nest thermostat.
///
/// This widget provides a circular dial with:
/// - A draggable thumb on the track
/// - +/- buttons for fine adjustment
/// - Optional current value indicator
/// - Customizable colors and value range
/// - Animated glow effect when active
class CircularControlDial extends StatefulWidget {
  /// The current target value
  final double value;

  /// Optional current/actual value to show difference from target
  final double? currentValue;

  /// Minimum value of the range
  final double minValue;

  /// Maximum value of the range
  final double maxValue;

  /// Step increment for value changes
  final double step;

  /// Size of the dial
  final double size;

  /// Accent color type from the app theme
  final DialAccentColor accentType;

  /// Optional custom accent color (overrides accentType if provided)
  final Color? accentColor;

  /// Whether the dial is active (affects glow and color intensity)
  final bool isActive;

  /// Whether the dial is enabled for interaction
  final bool enabled;

  /// Optional label to display below the value (e.g., "HEAT", "COOL")
  final String? modeLabel;

  /// Display format for the value
  final DialDisplayFormat displayFormat;

  /// Callback when value changes
  final ValueChanged<double>? onChanged;

  /// Whether to show +/- buttons
  final bool showButtons;

  /// Whether to show tick marks
  final bool showTicks;

  /// Number of major ticks to show
  final int majorTickCount;

  const CircularControlDial({
    super.key,
    required this.value,
    this.currentValue,
    required this.minValue,
    required this.maxValue,
    this.step = 1.0,
    required this.size,
    this.accentType = DialAccentColor.primary,
    this.accentColor,
    this.isActive = true,
    this.enabled = true,
    this.modeLabel,
    this.displayFormat = DialDisplayFormat.integer,
    this.onChanged,
    this.showButtons = true,
    this.showTicks = true,
    this.majorTickCount = 10,
  });

  @override
  State<CircularControlDial> createState() => _CircularControlDialState();
}

class _CircularControlDialState extends State<CircularControlDial>
    with SingleTickerProviderStateMixin {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();
  final EventBus _eventBus = locator<EventBus>();

  late double _value;
  late AnimationController _glowController;
  bool _isDragging = false;

  final Map<Type, GestureRecognizerFactory> _gestures = {};

  double _scale(double size) =>
      _screenService.scale(size, density: _visualDensityService.density);

  /// Resolves the accent color from the theme based on accentType,
  /// or returns the custom accentColor if provided.
  Color _resolveAccentColor(BuildContext context) {
    // If custom color is provided, use it
    if (widget.accentColor != null) {
      return widget.accentColor!;
    }

    // Otherwise, resolve from theme based on accentType
    final isDark = Theme.of(context).brightness == Brightness.dark;

    switch (widget.accentType) {
      case DialAccentColor.primary:
        return isDark ? AppColorsDark.primary : AppColorsLight.primary;
      case DialAccentColor.success:
        return isDark ? AppColorsDark.success : AppColorsLight.success;
      case DialAccentColor.warning:
        return isDark ? AppColorsDark.warning : AppColorsLight.warning;
      case DialAccentColor.danger:
        return isDark ? AppColorsDark.danger : AppColorsLight.danger;
      case DialAccentColor.info:
        return isDark ? AppColorsDark.info : AppColorsLight.info;
      case DialAccentColor.teal:
        return isDark ? AppColorsDark.teal : AppColorsLight.teal;
      case DialAccentColor.cyan:
        return isDark ? AppColorsDark.cyan : AppColorsLight.cyan;
      case DialAccentColor.pink:
        return isDark ? AppColorsDark.pink : AppColorsLight.pink;
      case DialAccentColor.indigo:
        return isDark ? AppColorsDark.indigo : AppColorsLight.indigo;
      case DialAccentColor.neutral:
        return isDark ? AppColorsDark.neutral : AppColorsLight.neutral;
    }
  }

  @override
  void initState() {
    super.initState();
    _value = widget.value;
    _glowController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat(reverse: true);
    _setupGestures();
  }

  void _setupGestures() {
    _gestures[_DialDragGestureRecognizer] =
        GestureRecognizerFactoryWithHandlers<_DialDragGestureRecognizer>(
      () => _DialDragGestureRecognizer(
        isOnTrack: _isPointerOnTrack,
        debugOwner: this,
      ),
      (_DialDragGestureRecognizer instance) {
        instance
          ..onStart = _handleDragStart
          ..onUpdate = _handleDragUpdate
          ..onEnd = _handleDragEnd
          ..onCancel = _handleDragCancel;
      },
    );
  }

  @override
  void didUpdateWidget(covariant CircularControlDial oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.value != widget.value && !_isDragging) {
      _value = widget.value;
    }
  }

  @override
  void dispose() {
    _glowController.dispose();
    super.dispose();
  }

  bool get _showActiveGlow {
    if (!widget.isActive || !widget.enabled) return false;
    if (widget.currentValue == null) return true;
    return widget.currentValue != _value;
  }

  double _valueToAngle(double value) {
    final normalized =
        (value - widget.minValue) / (widget.maxValue - widget.minValue);
    return (math.pi * 0.75) + (normalized.clamp(0.0, 1.0) * math.pi * 1.5);
  }

  double _angleToValue(double angle) {
    var normalizedAngle = angle - (math.pi * 0.75);
    if (normalizedAngle < 0) normalizedAngle += math.pi * 2;
    if (normalizedAngle > math.pi * 1.5) {
      normalizedAngle = normalizedAngle > math.pi * 1.75 ? 0 : math.pi * 1.5;
    }
    final normalized = normalizedAngle / (math.pi * 1.5);
    final value =
        widget.minValue + (normalized * (widget.maxValue - widget.minValue));
    return (value / widget.step).round() * widget.step;
  }

  bool _isPointerOnTrack(Offset localPosition) {
    final center = Offset(widget.size / 2, widget.size / 2);
    final radius = widget.size / 2 - 10;

    final dx = localPosition.dx - center.dx;
    final dy = localPosition.dy - center.dy;
    final touchDistance = math.sqrt(dx * dx + dy * dy);

    final minRadius = radius - _scale(30);
    final maxRadius = radius + _scale(30);
    return touchDistance >= minRadius && touchDistance <= maxRadius;
  }

  void _updateValueFromPosition(Offset localPosition) {
    if (!widget.enabled) return;

    final center = Offset(widget.size / 2, widget.size / 2);

    final dx = localPosition.dx - center.dx;
    final dy = localPosition.dy - center.dy;

    final angle = math.atan2(dy, dx);
    final newValue =
        _angleToValue(angle).clamp(widget.minValue, widget.maxValue);

    if (newValue != _value) {
      setState(() {
        _value = newValue;
      });
    }
  }

  void _handleDragStart(Offset localPosition) {
    if (!widget.enabled) return;
    setState(() => _isDragging = true);
    _eventBus.fire(PageSwipeBlockEvent(blocked: true));
    _updateValueFromPosition(localPosition);
  }

  void _handleDragUpdate(Offset localPosition) {
    if (!_isDragging || !widget.enabled) return;
    _updateValueFromPosition(localPosition);
  }

  void _handleDragEnd() {
    if (_isDragging) {
      setState(() => _isDragging = false);
      _eventBus.fire(PageSwipeBlockEvent(blocked: false));
      widget.onChanged?.call(_value);
    }
  }

  void _handleDragCancel() {
    if (_isDragging) {
      setState(() => _isDragging = false);
      _eventBus.fire(PageSwipeBlockEvent(blocked: false));
    }
  }

  void _handleTap(Offset localPosition) {
    if (!widget.enabled) return;
    if (_isPointerOnTrack(localPosition)) {
      _updateValueFromPosition(localPosition);
      widget.onChanged?.call(_value);
    }
  }

  void _incrementValue() {
    if (!widget.enabled) return;
    final newValue = (_value + widget.step).clamp(widget.minValue, widget.maxValue);
    setState(() => _value = newValue);
    widget.onChanged?.call(_value);
  }

  void _decrementValue() {
    if (!widget.enabled) return;
    final newValue = (_value - widget.step).clamp(widget.minValue, widget.maxValue);
    setState(() => _value = newValue);
    widget.onChanged?.call(_value);
  }

  Offset _getThumbPosition() {
    final center = Offset(widget.size / 2, widget.size / 2);
    final radius = widget.size / 2 - 10;
    final angle = _valueToAngle(_value);
    return Offset(
      center.dx + radius * math.cos(angle),
      center.dy + radius * math.sin(angle),
    );
  }

  String _formatValue(double value) {
    switch (widget.displayFormat) {
      case DialDisplayFormat.temperature:
        return value == value.roundToDouble()
            ? '${value.toInt()}°'
            : '${value.toStringAsFixed(1)}°';
      case DialDisplayFormat.percentage:
        return '${(value * 100).toInt()}%';
      case DialDisplayFormat.integer:
        return '${value.toInt()}';
      case DialDisplayFormat.decimal:
        return value.toStringAsFixed(1);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final trackColor =
        isDark ? AppFillColorDark.darker : AppFillColorLight.darker;
    final tickColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
    final cardColor = isDark ? AppFillColorDark.light : AppFillColorLight.light;
    final disabledColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;

    final accentColor = _resolveAccentColor(context);
    final displayColor = widget.enabled ? accentColor : disabledColor;
    final glowColor = accentColor.withValues(alpha: 0.35);
    final thumbPosition = _getThumbPosition();

    return RawGestureDetector(
      gestures: _gestures,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapUp: (details) => _handleTap(details.localPosition),
        child: SizedBox(
          width: widget.size,
          height: widget.size,
          child: AnimatedBuilder(
            animation: _glowController,
            builder: (context, child) {
              return CustomPaint(
                painter: _DialPainter(
                  value: _value,
                  currentValue: widget.currentValue,
                  minValue: widget.minValue,
                  maxValue: widget.maxValue,
                  step: widget.step,
                  accentColor: displayColor,
                  glowColor: glowColor,
                  trackColor: trackColor,
                  tickColor: tickColor,
                  glowIntensity: _showActiveGlow ? _glowController.value : 0,
                  isActive: widget.enabled,
                  showTicks: widget.showTicks,
                  majorTickCount: widget.majorTickCount,
                ),
                child: child,
              );
            },
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                // Center display
                Center(
                  child: Container(
                    width: widget.size * 0.7,
                    height: widget.size * 0.7,
                    decoration: BoxDecoration(
                      color: cardColor,
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: AppShadowColor.light,
                          blurRadius: _scale(16),
                          offset: Offset(0, _scale(4)),
                        ),
                        if (_showActiveGlow)
                          BoxShadow(
                            color: glowColor,
                            blurRadius: _scale(24),
                            spreadRadius: _scale(4),
                          ),
                      ],
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          _formatValue(_value),
                          style: TextStyle(
                            color: displayColor,
                            fontSize: widget.size * 0.16,
                            fontWeight: FontWeight.w300,
                          ),
                        ),
                        if (widget.modeLabel != null)
                          Container(
                            padding: EdgeInsets.symmetric(
                              horizontal: _scale(10),
                              vertical: _scale(3),
                            ),
                            decoration: BoxDecoration(
                              color: widget.enabled
                                  ? displayColor.withValues(alpha: 0.12)
                                  : (isDark
                                      ? AppFillColorDark.darker
                                      : AppFillColorLight.darker),
                              borderRadius:
                                  BorderRadius.circular(AppBorderRadius.base),
                            ),
                            child: Text(
                              widget.modeLabel!.toUpperCase(),
                              style: TextStyle(
                                color: displayColor,
                                fontSize: _scale(9),
                                fontWeight: FontWeight.w600,
                                letterSpacing: 1,
                              ),
                            ),
                          ),
                        if (widget.showButtons) ...[
                          AppSpacings.spacingMdVertical,
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              _buildButton(
                                  context, Icons.remove, _decrementValue),
                              SizedBox(width: widget.size * 0.08),
                              _buildButton(context, Icons.add, _incrementValue),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),
                ),

                // Draggable thumb on the ring
                if (widget.enabled)
                  Positioned(
                    left: thumbPosition.dx - _scale(14),
                    top: thumbPosition.dy - _scale(14),
                    child: AnimatedContainer(
                      duration: _isDragging
                          ? Duration.zero
                          : const Duration(milliseconds: 150),
                      width: _scale(28),
                      height: _scale(28),
                      decoration: BoxDecoration(
                        color: cardColor,
                        shape: BoxShape.circle,
                        border:
                            Border.all(color: displayColor, width: _scale(3)),
                        boxShadow: [
                          BoxShadow(
                            color: glowColor,
                            blurRadius: _isDragging ? _scale(12) : _scale(8),
                            spreadRadius: _isDragging ? _scale(2) : 0,
                          ),
                        ],
                      ),
                      child: Center(
                        child: Container(
                          width: _scale(10),
                          height: _scale(10),
                          decoration: BoxDecoration(
                            color: displayColor,
                            shape: BoxShape.circle,
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildButton(BuildContext context, IconData icon, VoidCallback onTap) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final size = widget.size * 0.12;
    final bgColor = isDark ? AppFillColorDark.darker : AppFillColorLight.darker;
    final borderColor =
        isDark ? AppBorderColorDark.light : AppBorderColorLight.light;
    final iconColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;

    return GestureDetector(
      onTap: widget.enabled ? onTap : null,
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          color: widget.enabled ? bgColor : bgColor.withValues(alpha: 0.5),
          shape: BoxShape.circle,
          border: Border.all(color: borderColor, width: _scale(1)),
        ),
        child: Icon(
          icon,
          size: size * 0.6,
          color: widget.enabled ? iconColor : iconColor.withValues(alpha: 0.5),
        ),
      ),
    );
  }
}

class _DialPainter extends CustomPainter {
  final double value;
  final double? currentValue;
  final double minValue;
  final double maxValue;
  final double step;
  final Color accentColor;
  final Color glowColor;
  final Color trackColor;
  final Color tickColor;
  final double glowIntensity;
  final bool isActive;
  final bool showTicks;
  final int majorTickCount;

  _DialPainter({
    required this.value,
    this.currentValue,
    required this.minValue,
    required this.maxValue,
    required this.step,
    required this.accentColor,
    required this.glowColor,
    required this.trackColor,
    required this.tickColor,
    required this.glowIntensity,
    required this.isActive,
    required this.showTicks,
    required this.majorTickCount,
  });

  double _valueToAngle(double val) {
    final normalized = (val - minValue) / (maxValue - minValue);
    return (math.pi * 0.75) + (normalized.clamp(0.0, 1.0) * math.pi * 1.5);
  }

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2 - 10;

    // Track
    final trackPaint = Paint()
      ..color = trackColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = 14
      ..strokeCap = StrokeCap.round;

    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      math.pi * 0.75,
      math.pi * 1.5,
      false,
      trackPaint,
    );

    // Active arc (between current and target)
    if (isActive && currentValue != null && currentValue != value) {
      final currentAngle = _valueToAngle(currentValue!);
      final targetAngle = _valueToAngle(value);
      final startAngle = math.min(currentAngle, targetAngle);
      final sweepAngle = (targetAngle - currentAngle).abs();

      if (sweepAngle > 0.01) {
        // Glow
        final glowPaint = Paint()
          ..color = glowColor.withValues(alpha: 0.3 + glowIntensity * 0.3)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 20
          ..strokeCap = StrokeCap.round
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 8);
        canvas.drawArc(
          Rect.fromCircle(center: center, radius: radius),
          startAngle,
          sweepAngle,
          false,
          glowPaint,
        );

        // Arc
        final arcPaint = Paint()
          ..color = accentColor
          ..style = PaintingStyle.stroke
          ..strokeWidth = 14
          ..strokeCap = StrokeCap.round;
        canvas.drawArc(
          Rect.fromCircle(center: center, radius: radius),
          startAngle,
          sweepAngle,
          false,
          arcPaint,
        );
      }
    }

    // Tick marks
    if (showTicks) {
      final range = maxValue - minValue;
      final tickStep = range / majorTickCount;
      final minorTickCount = (range / step).round();

      for (int i = 0; i <= minorTickCount; i++) {
        final tickValue = minValue + (i * step);
        final angle = _valueToAngle(tickValue);

        // Check if this is a major tick
        final isMajor = ((tickValue - minValue) % tickStep).abs() < step / 2;

        final outerR = radius + 6;
        final innerR = radius - (isMajor ? 8 : 4);

        final outer = Offset(
          center.dx + outerR * math.cos(angle),
          center.dy + outerR * math.sin(angle),
        );
        final inner = Offset(
          center.dx + innerR * math.cos(angle),
          center.dy + innerR * math.sin(angle),
        );

        final tickPaint = Paint()
          ..color = tickColor.withValues(alpha: isMajor ? 0.5 : 0.25)
          ..strokeWidth = isMajor ? 2 : 1
          ..strokeCap = StrokeCap.round;

        canvas.drawLine(inner, outer, tickPaint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant _DialPainter old) =>
      old.value != value ||
      old.currentValue != currentValue ||
      old.glowIntensity != glowIntensity ||
      old.accentColor != accentColor;
}

/// Custom gesture recognizer for dial drag that immediately claims the gesture
/// when touch is on the track, preventing parent widgets from intercepting.
class _DialDragGestureRecognizer extends OneSequenceGestureRecognizer {
  final bool Function(Offset) isOnTrack;

  void Function(Offset)? onStart;
  void Function(Offset)? onUpdate;
  VoidCallback? onEnd;
  VoidCallback? onCancel;

  _DialDragGestureRecognizer({
    required this.isOnTrack,
    super.debugOwner,
  });

  bool _isDragging = false;

  @override
  void addPointer(PointerDownEvent event) {
    if (isOnTrack(event.localPosition)) {
      startTrackingPointer(event.pointer, event.transform);
      resolve(GestureDisposition.accepted);
      _isDragging = true;
      onStart?.call(event.localPosition);
    } else {
      resolve(GestureDisposition.rejected);
    }
  }

  @override
  void handleEvent(PointerEvent event) {
    if (!_isDragging) return;

    if (event is PointerMoveEvent) {
      onUpdate?.call(event.localPosition);
    } else if (event is PointerUpEvent) {
      stopTrackingPointer(event.pointer);
      _isDragging = false;
      onEnd?.call();
    } else if (event is PointerCancelEvent) {
      stopTrackingPointer(event.pointer);
      _isDragging = false;
      onCancel?.call();
    }
  }

  @override
  String get debugDescription => '_DialDragGestureRecognizer';

  @override
  void didStopTrackingLastPointer(int pointer) {
    if (_isDragging) {
      _isDragging = false;
      onCancel?.call();
    }
  }
}
