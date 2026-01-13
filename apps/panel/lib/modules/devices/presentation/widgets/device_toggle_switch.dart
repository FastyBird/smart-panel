import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

/// Toggle Switch Widget
class DeviceToggleSwitch extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  final bool value;
  final Color? activeColor;
  final ValueChanged<bool>? onChanged;

  DeviceToggleSwitch({
    super.key,
    required this.value,
    this.activeColor,
    this.onChanged,
  });

  double _scale(double val) =>
      _screenService.scale(val, density: _visualDensityService.density);

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final effectiveActiveColor =
        activeColor ?? (isDark ? AppColorsDark.primary : AppColorsLight.primary);
    final inactiveColor =
        isDark ? AppFillColorDark.darker : AppFillColorLight.darker;
    final thumbColor = isDark ? AppFillColorDark.blank : AppFillColorLight.blank;

    return GestureDetector(
      onTap: () => onChanged?.call(!value),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        width: _scale(48),
        height: _scale(28),
        decoration: BoxDecoration(
          color: value ? effectiveActiveColor : inactiveColor,
          borderRadius: BorderRadius.circular(_scale(14)),
        ),
        child: AnimatedAlign(
          duration: const Duration(milliseconds: 200),
          alignment: value ? Alignment.centerRight : Alignment.centerLeft,
          child: Container(
            width: _scale(22),
            height: _scale(22),
            margin: AppSpacings.paddingXs,
            decoration: BoxDecoration(
              color: thumbColor,
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: AppShadowColor.medium,
                  blurRadius: _scale(4),
                  offset: Offset(0, _scale(2)),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
