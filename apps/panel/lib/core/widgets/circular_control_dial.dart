import 'dart:async';
import 'dart:math' as math;

import 'package:event_bus/event_bus.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/number.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/app_slider.dart';
import 'package:fastybird_smart_panel/core/widgets/app_stepper.dart';
import 'package:fastybird_smart_panel/core/widgets/control_colors.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/types/swipe_event.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

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

/// The colour of the dial's arc and thumb.
///
/// [warning] is heating (`#c2571a` / `#f0915a`), [info] is cooling (the
/// Climate colour), [success] is idle (ok), [neutral] is off
/// (`text.disabled`) and [primary] is the accent. The others are their
/// domain colours.
enum DialAccentColor {
  /// The panel accent.
  primary,

  /// Idle: the ok colour.
  success,

  /// Heating.
  warning,

  /// The danger colour.
  danger,

  /// Cooling: the Climate colour.
  info,

  /// The Shading colour.
  teal,

  /// The Sensors colour.
  cyan,

  /// The Media colour.
  pink,

  /// The Cameras colour.
  indigo,

  /// Off: `text.disabled`.
  neutral,
}

/// Base design sizes for [CircularControlDial] in device detail screens.
/// Scale with [ScreenService.scale] before passing to the dial.
class DeviceDetailDialSizes {
  DeviceDetailDialSizes._();

  /// Portrait layout (primary control card).
  static const double portrait = 190;

  /// Landscape layout on large screen (primary control card).
  static const double landscape = 220;
}

/// The dial's geometry, as fractions of its size (design canvas,
/// "Thermostat": a 200 × 200 box with the arc centred at 100, 96, radius 80,
/// stroke 12, thumbs of radius 9 with a 4 px ring and a 3 px "now" dot).
class DialGeometry {
  DialGeometry._();

  /// Where the arc starts: 150°, so the 240° arc is open at the foot.
  static const double startAngle = 150 * math.pi / 180;
  static const double sweepAngle = 240 * math.pi / 180;

  static const double centerX = 0.5;
  static const double centerY = 0.48;
  static const double radius = 0.4;
  static const double stroke = 0.06;
  static const double thumbRadius = 0.045;
  static const double thumbRing = 0.02;
  static const double nowDot = 0.015;

  /// Minus and plus are at most this share of the dial across, so they stay
  /// clear of the arc's ends on a small dial.
  static const double buttons = 0.24;

  /// The numeral: 0.27 of the dial, 0.15 with two thumbs.
  static const double numeral = 0.27;
  static const double numeralTwoThumbs = 0.15;
}

/// The thermostat dial (docs/display-ui-design-spec.md §5, §6): a 240° arc
/// with one or two thumbs, the target as a Barlow numeral, the current
/// reading and what the device is doing under it, and minus and plus at the
/// foot of the dial.
///
/// The arc fills from its start to the target (one thumb) or between the two
/// setpoints (two thumbs: heat on the first, cool on the second). Heating is
/// `#c2571a` / `#f0915a`, cooling the Climate colour.
///
/// - [ControlState.pending]: the thumbs' rings turn dashed `text.secondary`.
/// - [ControlState.unconfirmed]: they are dashed in the warning colour.
/// - [ControlState.disabled] (or [enabled] false): everything is
///   `text.disabled` and nothing moves.
///
/// Minus and plus move the thumb dragged or focused last (the first by
/// default). Screen readers step each thumb as a slider. Each thumb also
/// takes keyboard focus (Tab moves from heat to cool): the arrow keys step
/// it, and a focus ring circles it.
class CircularControlDial extends StatefulWidget {
  /// The current target value (the heat setpoint with two thumbs).
  final double value;

  /// The current reading, marked on the arc and written under the target.
  final double? currentValue;

  /// Minimum value of the range
  final double minValue;

  /// Maximum value of the range
  final double maxValue;

  /// Step increment for value changes
  final double step;

  /// Size of the dial (logical px)
  final double size;

  /// The arc's colour.
  final DialAccentColor accentType;

  /// Optional custom accent color (overrides accentType if provided)
  final Color? accentColor;

  /// Whether the device is running; when false the arc is `text.disabled`
  /// and the numeral `text.secondary` (off).
  final bool isActive;

  /// Whether the dial is enabled for interaction
  final bool enabled;

  /// What the device is doing ("Heating"), under the reading with a dot in
  /// the arc's colour.
  final String? modeLabel;

  /// Display format for the value
  final DialDisplayFormat displayFormat;

  /// Called when the value is set (drag end, tap, or after minus/plus).
  final ValueChanged<double>? onChanged;

  /// Whether to show minus and plus.
  final bool showButtons;

  /// No longer draws anything; the dial has no tick marks.
  final bool showTicks;

  /// No longer draws anything; the dial has no tick marks.
  final int majorTickCount;

  /// Custom temperature unit symbol (e.g. '°F') for [DialDisplayFormat.temperature].
  /// Defaults to '°C' if not provided.
  final String? temperatureUnitSymbol;

  /// The second setpoint (cool) for a two-thumb dial.
  final double? secondValue;

  /// Called when the second setpoint is set.
  final ValueChanged<double>? onSecondChanged;

  /// Pending, not confirmed or disabled look.
  final ControlState state;

  /// The class to size minus and plus for; defaults to the screen's.
  final ScreenSizeClass? sizeClass;

  /// What the dial sets, for screen readers; defaults to "Target
  /// temperature" (or "Target value" for other formats). With two thumbs it
  /// names the group, and each thumb is its own slider ("Heating setpoint",
  /// "Cooling setpoint").
  final String? semanticLabel;

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
    this.temperatureUnitSymbol,
    this.secondValue,
    this.onSecondChanged,
    this.state = ControlState.idle,
    this.sizeClass,
    this.semanticLabel,
  })  : assert(maxValue > minValue, 'maxValue must be greater than minValue'),
        assert(step > 0, 'step must be greater than zero');

  @override
  State<CircularControlDial> createState() => _CircularControlDialState();
}

class _CircularControlDialState extends State<CircularControlDial> {
  final EventBus _eventBus = locator<EventBus>();

  late double _value;
  double? _secondValue;
  bool _isDragging = false;

  /// Which thumb minus, plus and drags move: 0 the first, 1 the second.
  int _activeThumb = 0;

  /// A drag that started with both thumbs on one value: the first move
  /// decides which thumb it takes (up moves cool, down moves heat).
  bool _pickOnMove = false;

  Timer? _buttonDebounceTimer;

  /// The thumb a minus, plus or arrow-key edit moved, waiting on
  /// [_buttonDebounceTimer]. The dial shows the edit, and the timer sends
  /// what the dial shows.
  int? _pendingThumb;

  /// Keyboard focus, one node per thumb.
  final List<FocusNode> _thumbFocus = [
    FocusNode(debugLabel: 'Dial heat thumb'),
    FocusNode(debugLabel: 'Dial cool thumb'),
  ];

  /// The thumb with keyboard focus.
  int? _focusedThumb;

  /// Whether focus is being moved with a keyboard; a touch-focused thumb
  /// shows no ring.
  bool _keyboard =
      FocusManager.instance.highlightMode == FocusHighlightMode.traditional;

  /// Debounce duration for minus and plus taps (ms)
  static const int _buttonDebounceDuration = 500;

  final Map<Type, GestureRecognizerFactory> _gestures = {};

  bool get _twoThumbs => widget.secondValue != null;

  bool get _interactive =>
      widget.enabled && widget.state != ControlState.disabled;

  @override
  void initState() {
    super.initState();
    _value = widget.value;
    _secondValue = widget.secondValue;
    FocusManager.instance.addHighlightModeListener(_onHighlightMode);
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

    // Disabled: drop the edits in flight. A drag ends without reporting,
    // and the thumbs go back to the parent's values, so nothing unsent
    // stays on screen or becomes the base of the next step.
    if (!_interactive && (_isDragging || _pendingThumb != null)) {
      _discardPendingEdit();
      _endDrag();
      _value = widget.value;
      _secondValue = widget.secondValue;
    }

    // One thumb became two or two became one: the drag was on the old
    // dial, so it ends without reporting, and an edit for a removed cool
    // thumb is dropped. The thumbs take the parent's values, except a heat
    // edit still waiting, which stays on screen.
    final thumbsChanged =
        (oldWidget.secondValue == null) != (widget.secondValue == null);
    if (thumbsChanged) {
      _endDrag();
      if (!_twoThumbs && _pendingThumb == 1) _discardPendingEdit();
      if (!_twoThumbs) _activeThumb = 0;
      if (_pendingThumb != 0) _value = widget.value;
      _secondValue = widget.secondValue;
    }

    // A new value from the parent replaces an edit still waiting for the
    // same thumb.
    if (oldWidget.value != widget.value && _pendingThumb == 0) {
      _discardPendingEdit();
    }
    if (oldWidget.secondValue != widget.secondValue && _pendingThumb == 1) {
      _discardPendingEdit();
    }

    // Take the parent's values, except for the thumb being edited: under
    // the finger, or waiting to be sent.
    final held = _isDragging ? _activeThumb : _pendingThumb;
    if (oldWidget.value != widget.value && held != 0) {
      _value = widget.value;
    }
    if (oldWidget.secondValue != widget.secondValue && held != 1) {
      _secondValue = widget.secondValue;
    }

    // The edited thumb stays on its side of the other one, which may just
    // have moved; a waiting edit then sends what the dial shows.
    if (_twoThumbs && held == 0) _value = math.min(_value, _secondValue!);
    if (_twoThumbs && held == 1) {
      _secondValue = math.max(_secondValue!, _value);
    }
  }

  @override
  void dispose() {
    // Ensure swipe is unblocked if disposed while dragging
    if (_isDragging) {
      _eventBus.fire(PageSwipeBlockEvent(blocked: false));
    }
    _buttonDebounceTimer?.cancel();
    _gestures.clear();
    FocusManager.instance.removeHighlightModeListener(_onHighlightMode);
    for (final node in _thumbFocus) {
      node.dispose();
    }
    super.dispose();
  }

  void _onHighlightMode(FocusHighlightMode mode) {
    final keyboard = mode == FocusHighlightMode.traditional;
    if (keyboard != _keyboard && mounted) setState(() => _keyboard = keyboard);
  }

  Offset get _center => Offset(
    widget.size * DialGeometry.centerX,
    widget.size * DialGeometry.centerY,
  );

  double get _radius => widget.size * DialGeometry.radius;

  double _valueToAngle(double value) {
    final range = widget.maxValue - widget.minValue;
    final normalized = range == 0
        ? 0.0
        : ((value - widget.minValue) / range).clamp(0.0, 1.0);

    return DialGeometry.startAngle + normalized * DialGeometry.sweepAngle;
  }

  double _snap(double value) {
    final snapped =
        widget.minValue +
        ((value - widget.minValue) / widget.step).round() * widget.step;

    return snapped.clamp(widget.minValue, widget.maxValue).toDouble();
  }

  /// The unsnapped value under [angle]. The ends of the arc and the gap at
  /// the foot give the minimum and maximum.
  double _rawValueAt(double angle) {
    var fromStart = angle - DialGeometry.startAngle;
    while (fromStart < 0) {
      fromStart += 2 * math.pi;
    }
    while (fromStart >= 2 * math.pi) {
      fromStart -= 2 * math.pi;
    }

    if (fromStart >= DialGeometry.sweepAngle) {
      // At the upper end, or in the gap: the nearer end.
      final gapMiddle =
          DialGeometry.sweepAngle + (2 * math.pi - DialGeometry.sweepAngle) / 2;

      return fromStart < gapMiddle ? widget.maxValue : widget.minValue;
    }
    if (fromStart <= 0) return widget.minValue;

    final normalized = fromStart / DialGeometry.sweepAngle;

    return widget.minValue + normalized * (widget.maxValue - widget.minValue);
  }

  /// The value under [angle], on the step grid. The ends of the arc and the
  /// gap at the foot give the exact minimum and maximum, even off the grid.
  double _angleToValue(double angle) {
    final raw = _rawValueAt(angle);
    if (raw == widget.minValue || raw == widget.maxValue) return raw;
    final snapped = _snap(raw);

    // An off-grid maximum is reachable: it wins when it is nearer than the
    // last step.
    return (widget.maxValue - raw).abs() < (snapped - raw).abs()
        ? widget.maxValue
        : snapped;
  }

  bool _isPointerOnTrack(Offset localPosition) {
    if (!_interactive) return false;
    final distance = (localPosition - _center).distance;
    final band = AppSpacings.scale(30);

    return distance >= _radius - band && distance <= _radius + band;
  }

  double _angleOf(Offset localPosition) {
    final delta = localPosition - _center;

    return math.atan2(delta.dy, delta.dx);
  }

  /// With two thumbs, the drag moves the thumb nearer the pointer, before
  /// the value snaps to the step grid; midway, the side of the pointer
  /// decides. An edit still waiting is sent first, for the thumb it moved.
  void _pickThumb(Offset localPosition) {
    _flushPendingEdit();
    _pickOnMove = false;
    if (!_twoThumbs) return;
    final angle = _angleOf(localPosition);
    final raw = _rawValueAt(angle);
    final toHeat = (raw - _value).abs();
    final toCool = (raw - _secondValue!).abs();
    if (toHeat < toCool) {
      _activeThumb = 0;
    } else if (toCool < toHeat) {
      _activeThumb = 1;
    } else {
      final value = _angleToValue(angle);
      if (value != _value) {
        _activeThumb = value > _value ? 1 : 0;
      } else {
        // Right on two coincident thumbs: wait for the first move.
        _pickOnMove = true;
      }
    }
  }

  /// Sets [thumb]'s value, kept on its side of the other thumb.
  void _setThumbValue(int thumb, double value) {
    setState(() {
      if (thumb == 1 && _twoThumbs) {
        _secondValue = math.max(value, _value);
      } else {
        _value = _twoThumbs ? math.min(value, _secondValue!) : value;
      }
    });
  }

  void _updateValueFromPosition(Offset localPosition) {
    final value = _angleToValue(_angleOf(localPosition));
    if (_pickOnMove && _twoThumbs) {
      if (value == _value) return;
      _activeThumb = value > _value ? 1 : 0;
      _pickOnMove = false;
    }
    // The finger supersedes an edit still waiting for its thumb.
    if (_pendingThumb == _activeThumb) _discardPendingEdit();
    _setThumbValue(_activeThumb, value);
  }

  /// Reports [value] for [thumb]. Nothing is sent while the dial is
  /// disabled, nor for a cool thumb the dial no longer has.
  void _report(int thumb, double value) {
    if (!_interactive) return;
    if (thumb == 1) {
      if (_twoThumbs) widget.onSecondChanged?.call(value);
    } else {
      widget.onChanged?.call(value);
    }
  }

  void _handleDragStart(Offset localPosition) {
    if (!_interactive) return;
    _pickThumb(localPosition);
    setState(() => _isDragging = true);
    _eventBus.fire(PageSwipeBlockEvent(blocked: true));
    _updateValueFromPosition(localPosition);
  }

  void _handleDragUpdate(Offset localPosition) {
    if (!_isDragging || !_interactive) return;
    _updateValueFromPosition(localPosition);
  }

  void _handleDragEnd() {
    if (!_isDragging) return;
    _endDrag();
    if (mounted) setState(() {});
    // The release is the last edit of its thumb: an edit made during the
    // drag (minus or plus with another finger) is not sent after it.
    if (_pendingThumb == _activeThumb) _discardPendingEdit();
    _report(_activeThumb, _thumbValue(_activeThumb));
  }

  void _handleDragCancel() {
    if (!_isDragging) return;
    _endDrag();
    if (mounted) setState(() {});
  }

  /// Ends a drag and releases the page swipe; the caller decides whether
  /// to report. Later moves of the same gesture are ignored.
  void _endDrag() {
    if (!_isDragging) return;
    // Fire the unblock first, so it fires even if the dial is disposed.
    _eventBus.fire(PageSwipeBlockEvent(blocked: false));
    _isDragging = false;
    _pickOnMove = false;
  }

  double _thumbValue(int thumb) =>
      thumb == 1 && _twoThumbs ? _secondValue! : _value;

  /// With two thumbs, heat never passes cool and cool never drops under
  /// heat.
  double _thumbMin(int thumb) =>
      thumb == 1 && _twoThumbs ? _value : widget.minValue;

  double _thumbMax(int thumb) =>
      thumb == 0 && _twoThumbs ? _secondValue! : widget.maxValue;

  bool _canRaiseThumb(int thumb) =>
      _interactive && _thumbValue(thumb) < _thumbMax(thumb);

  bool _canLowerThumb(int thumb) =>
      _interactive && _thumbValue(thumb) > _thumbMin(thumb);

  /// [thumb]'s value one full step up (1) or down (-1), within its bounds.
  /// An off-grid value keeps its offset.
  double _stepped(int thumb, int direction) =>
      (_thumbValue(thumb) + direction * widget.step)
          .clamp(_thumbMin(thumb), _thumbMax(thumb))
          .toDouble();

  /// The thumb plus moves: the active one, or cool when heat is held at
  /// cool by two coincident thumbs.
  int get _raiseThumb =>
      _twoThumbs && _activeThumb == 0 && !_canRaiseThumb(0) ? 1 : _activeThumb;

  /// The thumb minus moves: the active one, or heat when cool is held at
  /// heat by two coincident thumbs.
  int get _lowerThumb =>
      _twoThumbs && _activeThumb == 1 && !_canLowerThumb(1) ? 0 : _activeThumb;

  bool get _canRaise => _canRaiseThumb(_raiseThumb);

  bool get _canLower => _canLowerThumb(_lowerThumb);

  /// Moves [thumb] one step up (1) or down (-1) and makes it the thumb
  /// minus and plus move (a drag keeps its own thumb); reported once minus
  /// and plus are quiet.
  void _stepThumb(int thumb, int direction) {
    if (direction > 0 ? !_canRaiseThumb(thumb) : !_canLowerThumb(thumb)) {
      return;
    }
    if (!_isDragging) _activeThumb = thumb;
    _setThumbValue(thumb, _stepped(thumb, direction));
    _scheduleEdit(thumb);
  }

  /// The arrow keys step the focused [thumb]: up and right raise it, down
  /// and left lower it.
  KeyEventResult _handleKey(int thumb, KeyEvent event) {
    if (event is! KeyDownEvent && event is! KeyRepeatEvent) {
      return KeyEventResult.ignored;
    }
    final key = event.logicalKey;
    final direction = key == LogicalKeyboardKey.arrowUp ||
            key == LogicalKeyboardKey.arrowRight
        ? 1
        : key == LogicalKeyboardKey.arrowDown ||
                key == LogicalKeyboardKey.arrowLeft
            ? -1
            : 0;
    if (direction == 0 || !_interactive) return KeyEventResult.ignored;
    _stepThumb(thumb, direction);

    return KeyEventResult.handled;
  }

  /// Keyboard focus for [thumb]; a focused thumb becomes the one minus and
  /// plus move.
  Widget _thumbFocusable(int thumb, Widget child) => Focus(
    focusNode: _thumbFocus[thumb],
    canRequestFocus: _interactive,
    skipTraversal: !_interactive,
    onFocusChange: (focused) => setState(() {
      if (focused) {
        _focusedThumb = thumb;
        if (!_isDragging) _activeThumb = thumb;
      } else if (_focusedThumb == thumb) {
        _focusedThumb = null;
      }
    }),
    onKeyEvent: (_, event) => _handleKey(thumb, event),
    child: child,
  );

  void _increment() => _stepThumb(_raiseThumb, 1);

  void _decrement() => _stepThumb(_lowerThumb, -1);

  /// What screen readers hear for [value], with the unit.
  String _spoken(double value) => '${_formatNumber(value)}$_unit';

  /// A screen-reader slider for one thumb of a two-thumb dial, so either
  /// setpoint can be stepped without touch.
  Widget _thumbSemantics(int thumb, String label) {
    final canRaise = _canRaiseThumb(thumb);
    final canLower = _canLowerThumb(thumb);

    return Semantics(
      container: true,
      slider: true,
      label: label,
      value: _spoken(_thumbValue(thumb)),
      enabled: _interactive,
      increasedValue: canRaise ? _spoken(_stepped(thumb, 1)) : null,
      decreasedValue: canLower ? _spoken(_stepped(thumb, -1)) : null,
      onIncrease: canRaise ? () => _stepThumb(thumb, 1) : null,
      onDecrease: canLower ? () => _stepThumb(thumb, -1) : null,
      child: _thumbFocusable(thumb, const SizedBox.expand()),
    );
  }

  /// Holds [thumb]'s new value until minus and plus have been quiet for
  /// [_buttonDebounceDuration] ms. An edit waiting for the other thumb is
  /// sent first.
  void _scheduleEdit(int thumb) {
    if (_pendingThumb != null && _pendingThumb != thumb) {
      _flushPendingEdit();
    }
    _buttonDebounceTimer?.cancel();
    _pendingThumb = thumb;
    _buttonDebounceTimer = Timer(
      const Duration(milliseconds: _buttonDebounceDuration),
      _flushPendingEdit,
    );
  }

  /// Sends the waiting edit: the value the dial shows for its thumb, kept
  /// within the thumb's bounds. Does nothing when none is waiting.
  void _flushPendingEdit() {
    final thumb = _pendingThumb;
    _discardPendingEdit();
    if (thumb == null || !mounted) return;
    if (thumb == 1 && !_twoThumbs) return;
    _report(
      thumb,
      _thumbValue(thumb).clamp(_thumbMin(thumb), _thumbMax(thumb)).toDouble(),
    );
  }

  void _discardPendingEdit() {
    _buttonDebounceTimer?.cancel();
    _buttonDebounceTimer = null;
    _pendingThumb = null;
  }

  String _formatNumber(double value) {
    switch (widget.displayFormat) {
      case DialDisplayFormat.temperature:
        return value == value.roundToDouble()
            ? NumberUtils.formatInteger(value.toInt())
            : NumberUtils.formatDecimal(value, decimalPlaces: 1);
      case DialDisplayFormat.percentage:
        return NumberUtils.formatInteger((value * 100).toInt());
      case DialDisplayFormat.integer:
        return NumberUtils.formatInteger(value.toInt());
      case DialDisplayFormat.decimal:
        return NumberUtils.formatDecimal(value, decimalPlaces: 1);
    }
  }

  String get _unit => switch (widget.displayFormat) {
    DialDisplayFormat.temperature => widget.temperatureUnitSymbol ?? '°C',
    DialDisplayFormat.percentage => '%',
    _ => '',
  };

  Color _accent(ThemeData theme) {
    if (widget.accentColor != null) return widget.accentColor!;
    final brightness = theme.brightness;
    Color domain(ThemeColors key) => ThemeColorFamily.get(brightness, key).base;

    return switch (widget.accentType) {
      DialAccentColor.primary => theme.accent.fill,
      DialAccentColor.success => theme.status(AppStatus.ok).text,
      DialAccentColor.warning => AppClimateColors.heating(brightness),
      DialAccentColor.danger => theme.status(AppStatus.danger).text,
      DialAccentColor.info => domain(ThemeColors.climate),
      DialAccentColor.teal => domain(ThemeColors.shading),
      DialAccentColor.cyan => domain(ThemeColors.sensors),
      DialAccentColor.pink => domain(ThemeColors.media),
      DialAccentColor.indigo => domain(ThemeColors.cameras),
      DialAccentColor.neutral => theme.neutrals.textDisabled,
    };
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final neutrals = theme.neutrals;
    final localizations = AppLocalizations.of(context)!;
    final resolvedClass = widget.sizeClass ?? locator<ScreenService>().sizeClass;

    final off = !widget.isActive || !_interactive;
    final mainColor = off ? neutrals.textDisabled : _accent(theme);
    final coolColor = off
        ? neutrals.textDisabled
        : ThemeColorFamily.get(theme.brightness, ThemeColors.climate).base;
    final dash = controlDashColor(
      theme,
      _interactive ? widget.state : ControlState.disabled,
    );

    final designSize = AppSpacings.unscale(widget.size);
    final buttonDiameter = designSize * DialGeometry.buttons;
    final captionSize = AppSpacings.scale(
      designSize < 200 ? 10 : (designSize < 320 ? 12 : 16),
    );
    final numeralSize =
        widget.size *
        (_twoThumbs ? DialGeometry.numeralTwoThumbs : DialGeometry.numeral);
    final valueText = _twoThumbs
        ? '${_formatNumber(_value)}–${_formatNumber(_secondValue!)}'
        : _formatNumber(_value);
    final currentText = widget.currentValue == null
        ? null
        : '${_formatNumber(widget.currentValue!)}$_unit';

    // The arc and its centre take drags and taps. Minus and plus sit beside
    // it in the stack, above it, so the arc never claims their taps.
    final arc = RawGestureDetector(
      gestures: _gestures,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapUp: (details) {
          if (!_isPointerOnTrack(details.localPosition)) return;
          _pickThumb(details.localPosition);
          _updateValueFromPosition(details.localPosition);
          _report(_activeThumb, _thumbValue(_activeThumb));
        },
        child: CustomPaint(
          painter: _DialPainter(
            startValueAngle: _twoThumbs
                ? _valueToAngle(_value)
                : DialGeometry.startAngle,
            endValueAngle: _twoThumbs
                ? _valueToAngle(_secondValue!)
                : _valueToAngle(_value),
            thumbAngles: [
              _valueToAngle(_value),
              if (_twoThumbs) _valueToAngle(_secondValue!),
            ],
            thumbColors: [
              mainColor,
              if (_twoThumbs) coolColor,
            ],
            nowAngle: widget.currentValue == null
                ? null
                : _valueToAngle(widget.currentValue!),
            trackColor: neutrals.fillBase,
            arcColor: mainColor,
            thumbFill: neutrals.surfaceCard,
            nowColor: neutrals.textPrimary,
            dashColor: dash,
            focusedThumb: _keyboard && _interactive ? _focusedThumb : null,
            focusRingWidth: AppSpacings.scale(AppSliderMetrics.focusRing),
            focusGap: AppSpacings.scale(AppSliderMetrics.focusGap),
          ),
          child: Padding(
            padding: EdgeInsets.only(bottom: widget.size * 0.04),
            child: _DialCenter(
              valueText: valueText,
              unit: _unit,
              numeralSize: numeralSize,
              captionSize: captionSize,
              numeralColor: off ? neutrals.textSecondary : neutrals.textPrimary,
              currentText: currentText == null
                  ? null
                  : localizations.dial_now(currentText),
              modeLabel: widget.modeLabel,
              dotColor: mainColor,
            ),
          ),
        ),
      ),
    );

    final dial = SizedBox.square(
      dimension: widget.size,
      child: Stack(
        children: [
          Positioned.fill(child: arc),
          // Two thumbs: one screen-reader slider per setpoint, laid over the
          // arc above minus and plus, heat on the left and cool on the
          // right. They draw nothing and let touches through to the arc.
          if (_twoThumbs)
            Positioned(
              left: 0,
              top: 0,
              right: 0,
              bottom: widget.size * DialGeometry.buttons,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Expanded(
                    child: _thumbSemantics(0, localizations.dial_heat_setpoint),
                  ),
                  Expanded(
                    child: _thumbSemantics(1, localizations.dial_cool_setpoint),
                  ),
                ],
              ),
            ),
          if (widget.showButtons) ...[
            Positioned(
              left: 0,
              bottom: 0,
              child: ControlRoundButton(
                icon: MdiIcons.minus,
                onTap: _canLower ? _decrement : null,
                semanticLabel: localizations.control_decrease,
                sizeClass: resolvedClass,
                diameter: buttonDiameter,
              ),
            ),
            Positioned(
              right: 0,
              bottom: 0,
              child: ControlRoundButton(
                icon: MdiIcons.plus,
                onTap: _canRaise ? _increment : null,
                semanticLabel: localizations.control_increase,
                sizeClass: resolvedClass,
                diameter: buttonDiameter,
              ),
            ),
          ],
        ],
      ),
    );

    // What the dial sets, when the caller does not say.
    final label =
        widget.semanticLabel ??
        (widget.displayFormat == DialDisplayFormat.temperature
            ? localizations.dial_target_temperature
            : localizations.dial_target_value);

    if (!_twoThumbs) {
      return Semantics(
        container: true,
        slider: true,
        label: label,
        value: _spoken(_value),
        enabled: _interactive,
        increasedValue: _canRaise ? _spoken(_stepped(0, 1)) : null,
        decreasedValue: _canLower ? _spoken(_stepped(0, -1)) : null,
        onIncrease: _canRaise ? _increment : null,
        onDecrease: _canLower ? _decrement : null,
        child: _thumbFocusable(0, dial),
      );
    }

    return Semantics(
      container: true,
      label: label,
      enabled: _interactive,
      child: dial,
    );
  }
}

class _DialCenter extends StatelessWidget {
  const _DialCenter({
    required this.valueText,
    required this.unit,
    required this.numeralSize,
    required this.captionSize,
    required this.numeralColor,
    required this.currentText,
    required this.modeLabel,
    required this.dotColor,
  });

  final String valueText;
  final String unit;
  final double numeralSize;
  final double captionSize;
  final Color numeralColor;
  final String? currentText;
  final String? modeLabel;
  final Color dotColor;

  @override
  Widget build(BuildContext context) {
    final neutrals = Theme.of(context).neutrals;
    // The unit is 0.45 of the numeral (design canvas, "Thermostat").
    final unitSize = numeralSize * 0.45;
    final label = modeLabel == null || modeLabel!.isEmpty
        ? null
        : modeLabel![0].toUpperCase() + modeLabel!.substring(1);

    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      spacing: AppSpacings.scale(2),
      children: [
        // The slider announces the target; the reading and the mode are
        // status lines of their own.
        ExcludeSemantics(
          child: FittedBox(
            fit: BoxFit.scaleDown,
            child: Text.rich(
              TextSpan(
                text: valueText,
                children: [
                  if (unit.isNotEmpty)
                    TextSpan(
                      text: unit,
                      style: TextStyle(
                        fontSize: unitSize,
                        fontWeight: AppNumeralFont.value,
                        color: neutrals.textSecondary,
                      ),
                    ),
                ],
              ),
              maxLines: 1,
              style: TextStyle(
                fontFamily: AppNumeralFont.family,
                fontSize: numeralSize,
                fontWeight: AppNumeralFont.display,
                height: 0.9,
                color: numeralColor,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ),
        ),
        if (currentText != null)
          Semantics(
            container: true,
            child: Text(
              currentText!,
              maxLines: 1,
              style: TextStyle(
                fontSize: captionSize,
                color: neutrals.textSecondary,
              ),
            ),
          ),
        if (label != null)
          Semantics(
            container: true,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              spacing: AppSpacings.pSm,
              children: [
                Container(
                  width: AppSpacings.scale(6),
                  height: AppSpacings.scale(6),
                  decoration: BoxDecoration(
                    color: dotColor,
                    shape: BoxShape.circle,
                  ),
                ),
                Text(
                  label,
                  maxLines: 1,
                  style: TextStyle(
                    fontSize: captionSize,
                    fontWeight: FontWeight.w500,
                    color: neutrals.textPrimary,
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class _DialPainter extends CustomPainter {
  _DialPainter({
    required this.startValueAngle,
    required this.endValueAngle,
    required this.thumbAngles,
    required this.thumbColors,
    required this.nowAngle,
    required this.trackColor,
    required this.arcColor,
    required this.thumbFill,
    required this.nowColor,
    required this.dashColor,
    required this.focusedThumb,
    required this.focusRingWidth,
    required this.focusGap,
  });

  final double startValueAngle;
  final double endValueAngle;
  final List<double> thumbAngles;
  final List<Color> thumbColors;
  final double? nowAngle;
  final Color trackColor;
  final Color arcColor;
  final Color thumbFill;
  final Color nowColor;
  final Color? dashColor;

  /// The thumb with keyboard focus, ringed in its colour; null rings none.
  final int? focusedThumb;
  final double focusRingWidth;
  final double focusGap;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(
      size.width * DialGeometry.centerX,
      size.height * DialGeometry.centerY,
    );
    final radius = size.width * DialGeometry.radius;
    final rect = Rect.fromCircle(center: center, radius: radius);
    Offset at(double angle, [double r = 0]) =>
        center + Offset(math.cos(angle), math.sin(angle)) * (r == 0 ? radius : r);

    final arcPaint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = size.width * DialGeometry.stroke
      ..strokeCap = StrokeCap.round;

    canvas.drawArc(
      rect,
      DialGeometry.startAngle,
      DialGeometry.sweepAngle,
      false,
      arcPaint..color = trackColor,
    );

    final sweep = endValueAngle - startValueAngle;
    if (sweep > 0.001) {
      canvas.drawArc(rect, startValueAngle, sweep, false, arcPaint..color = arcColor);
    }

    if (nowAngle != null) {
      canvas.drawCircle(
        at(nowAngle!),
        size.width * DialGeometry.nowDot,
        Paint()..color = nowColor,
      );
    }

    final thumbRadius = size.width * DialGeometry.thumbRadius;
    final ringWidth = size.width * DialGeometry.thumbRing;
    for (var i = 0; i < thumbAngles.length; i++) {
      final position = at(thumbAngles[i]);
      canvas.drawCircle(position, thumbRadius, Paint()..color = thumbFill);
      final ring = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = dashColor != null ? ringWidth * 0.6 : ringWidth
        ..color = dashColor ?? thumbColors[i];
      if (dashColor != null) {
        paintDashedCircle(canvas, position, thumbRadius, ring, dashes: 10);
      } else {
        canvas.drawCircle(position, thumbRadius, ring);
      }
      if (i == focusedThumb) {
        canvas.drawCircle(
          position,
          thumbRadius + ringWidth / 2 + focusGap + focusRingWidth / 2,
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = focusRingWidth
            ..color = thumbColors[i],
        );
      }
    }
  }

  @override
  bool shouldRepaint(covariant _DialPainter old) =>
      old.startValueAngle != startValueAngle ||
      old.endValueAngle != endValueAngle ||
      old.nowAngle != nowAngle ||
      old.arcColor != arcColor ||
      old.trackColor != trackColor ||
      old.dashColor != dashColor ||
      old.thumbFill != thumbFill ||
      old.focusedThumb != focusedThumb ||
      old.focusRingWidth != focusRingWidth ||
      old.focusGap != focusGap ||
      old.thumbColors.length != thumbColors.length ||
      old.thumbAngles.length != thumbAngles.length ||
      !_listEquals(old.thumbAngles, thumbAngles) ||
      !_listEquals(old.thumbColors, thumbColors);

  static bool _listEquals<T>(List<T> a, List<T> b) {
    if (a.length != b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (a[i] != b[i]) return false;
    }
    return true;
  }
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
    final onTrack = isOnTrack(event.localPosition);
    if (onTrack) {
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
      // Set _isDragging to false BEFORE stopTrackingPointer to prevent
      // didStopTrackingLastPointer from calling onCancel
      _isDragging = false;
      stopTrackingPointer(event.pointer);
      onEnd?.call();
    } else if (event is PointerCancelEvent) {
      _isDragging = false;
      stopTrackingPointer(event.pointer);
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
