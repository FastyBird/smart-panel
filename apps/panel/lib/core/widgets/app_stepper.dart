import 'dart:math' as math;

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/number.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/control_colors.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// The round minus and plus buttons of the stepper and the thermostat dial
/// (design canvas, "Thermostat"): `fill.light` with a `border.base` outline,
/// 40 / 48 / 56 across, the icon in `text.primary`.
class ControlRoundButton extends StatelessWidget {
  const ControlRoundButton({
    super.key,
    required this.icon,
    required this.onTap,
    required this.semanticLabel,
    this.sizeClass,
    this.diameter,
  });

  final IconData icon;

  /// Null disables the button: the icon turns `text.disabled`.
  final VoidCallback? onTap;

  final String semanticLabel;

  /// The class to size the button for; defaults to the screen's.
  final ScreenSizeClass? sizeClass;

  /// A smaller diameter in design px, for a small dial; never under the
  /// 36 px touch floor.
  final double? diameter;

  /// The smallest diameter, in design px (spec §4, physical floors).
  static const double minDiameter = 36;

  /// Diameter in design px.
  static double sizeFor(ScreenSizeClass sizeClass) => switch (sizeClass) {
    ScreenSizeClass.compact => 40,
    ScreenSizeClass.regular => 48,
    ScreenSizeClass.expanded => 56,
  };

  /// Icon size in design px.
  static double iconSizeFor(ScreenSizeClass sizeClass) =>
      sizeClass == ScreenSizeClass.compact ? 18 : 22;

  @override
  Widget build(BuildContext context) {
    final neutrals = Theme.of(context).neutrals;
    final resolvedClass = sizeClass ?? locator<ScreenService>().sizeClass;
    final classDiameter = sizeFor(resolvedClass);
    final side = diameter == null
        ? classDiameter
        : diameter!.clamp(minDiameter, classDiameter).toDouble();
    final shape = CircleBorder(
      side: BorderSide(
        color: neutrals.borderBase,
        width: AppSpacings.scale(1),
      ),
    );

    return Semantics(
      button: true,
      enabled: onTap != null,
      label: semanticLabel,
      onTap: onTap,
      excludeSemantics: true,
      child: SizedBox.square(
        dimension: AppSpacings.scale(side),
        child: Material(
          color: neutrals.fillLight,
          shape: shape,
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: onTap,
            customBorder: shape,
            child: Center(
              child: Icon(
                icon,
                size: AppSpacings.scale(
                  side < classDiameter ? 18 : iconSizeFor(resolvedClass),
                ),
                color: onTap != null
                    ? neutrals.textPrimary
                    : neutrals.textDisabled,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The one stepper (docs/display-ui-design-spec.md §5): minus, the value as a
/// Barlow card value (18, 28 on Expanded), plus. Minus and plus disable at
/// the ends of the range.
///
/// - [ControlState.pending]: the value turns `text.secondary`.
/// - [ControlState.unconfirmed]: the value takes the warning colour.
/// - [ControlState.disabled] (or no [onChanged]): both buttons disable and
///   the value turns `text.disabled`.
class AppStepper extends StatelessWidget {
  const AppStepper({
    super.key,
    required this.value,
    required this.min,
    required this.max,
    this.step = 1,
    this.onChanged,
    this.format,
    this.unit,
    this.state = ControlState.idle,
    this.sizeClass,
    this.semanticLabel,
  }) : assert(max > min, 'max must be greater than min'),
       assert(step > 0, 'step must be greater than zero');

  final double value;
  final double min;
  final double max;
  final double step;
  final ValueChanged<double>? onChanged;

  /// How the value is written; defaults to a locale-aware number with as
  /// many decimals as [min] and [step] need (see [decimalsOf]), so every
  /// value on the grid shows exactly.
  final String Function(double value)? format;

  /// Shown after the value in `text.secondary` ("°", " %").
  final String? unit;

  final ControlState state;

  /// The class to size the stepper for; defaults to the screen's.
  final ScreenSizeClass? sizeClass;

  /// What the stepper sets, for screen readers ("Target temperature").
  final String? semanticLabel;

  bool get _enabled => onChanged != null && state != ControlState.disabled;

  /// The decimals [value] needs, so 0.5 needs one and 0.25 or 0.01 two;
  /// at most [_maxDecimals].
  static int decimalsOf(double value) {
    var scaled = value;
    for (var decimals = 0; decimals < _maxDecimals; decimals++) {
      if ((scaled - scaled.roundToDouble()).abs() < 1e-6) return decimals;
      scaled *= 10;
    }

    return _maxDecimals;
  }

  static const int _maxDecimals = 4;

  String _format(double v) {
    if (format != null) return format!(v);
    // Values are min + k × step, so min and step together set the decimals.
    final decimals = math.max(decimalsOf(step), decimalsOf(min));
    if (decimals == 0) return NumberUtils.formatInteger(v.round());

    return NumberUtils.formatDecimal(v, decimalPlaces: decimals);
  }

  double _snap(double v) =>
      (min + ((v - min) / step).round() * step).clamp(min, max).toDouble();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final neutrals = theme.neutrals;
    final localizations = AppLocalizations.of(context)!;
    final resolvedClass = sizeClass ?? locator<ScreenService>().sizeClass;
    final enabled = _enabled;

    final canLower = enabled && value > min;
    final canRaise = enabled && value < max;
    void lower() => onChanged!(_snap(value - step));
    void raise() => onChanged!(_snap(value + step));

    final valueColor = !enabled
        ? neutrals.textDisabled
        : switch (state) {
            ControlState.pending => neutrals.textSecondary,
            ControlState.unconfirmed => theme.status(AppStatus.warning).text,
            _ => neutrals.textPrimary,
          };
    // A Barlow card value (spec §3: 18–28, 28 on Expanded); the unit is 0.6
    // of it.
    final fontSize = AppSpacings.scale(
      resolvedClass == ScreenSizeClass.expanded ? 28 : 18,
    );
    final unitFontSize = fontSize * 0.6;

    return Semantics(
      label: semanticLabel,
      value: '${_format(value)}${unit ?? ''}',
      increasedValue: canRaise ? _format(_snap(value + step)) : null,
      decreasedValue: canLower ? _format(_snap(value - step)) : null,
      onIncrease: canRaise ? raise : null,
      onDecrease: canLower ? lower : null,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        spacing: AppSpacings.pMd,
        children: [
          ControlRoundButton(
            icon: MdiIcons.minus,
            onTap: canLower ? lower : null,
            semanticLabel: localizations.control_decrease,
            sizeClass: resolvedClass,
          ),
          ConstrainedBox(
            constraints: BoxConstraints(minWidth: fontSize * 2),
            child: Text.rich(
              TextSpan(
                text: _format(value),
                children: [
                  if (unit != null)
                    TextSpan(
                      text: unit,
                      style: TextStyle(
                        color: neutrals.textSecondary,
                        fontSize: unitFontSize,
                      ),
                    ),
                ],
              ),
              textAlign: TextAlign.center,
              maxLines: 1,
              style: TextStyle(
                color: valueColor,
                fontFamily: AppNumeralFont.family,
                fontSize: fontSize,
                fontWeight: AppNumeralFont.value,
                fontFeatures: const [FontFeature.tabularFigures()],
              ),
            ),
          ),
          ControlRoundButton(
            icon: MdiIcons.plus,
            onTap: canRaise ? raise : null,
            semanticLabel: localizations.control_increase,
            sizeClass: resolvedClass,
          ),
        ],
      ),
    );
  }
}
