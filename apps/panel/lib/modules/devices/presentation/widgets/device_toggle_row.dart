import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_toggle_switch.dart';
import 'package:flutter/material.dart';

/// Toggle Row Widget with icon, label and switch
class DeviceToggleRow extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  final IconData icon;
  final String label;
  final bool value;
  final Color? activeColor;
  final ValueChanged<bool>? onChanged;

  DeviceToggleRow({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
    this.activeColor,
    this.onChanged,
  });

  double _scale(double val) =>
      _screenService.scale(val, density: _visualDensityService.density);

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardColor = isDark ? AppFillColorDark.light : AppFillColorLight.blank;
    final borderColor =
        isDark ? AppBorderColorDark.light : AppBorderColorLight.light;
    final textColor =
        isDark ? AppTextColorDark.primary : AppTextColorLight.primary;
    final iconColor =
        isDark ? AppTextColorDark.disabled : AppTextColorLight.disabled;

    return Container(
      margin: EdgeInsets.symmetric(vertical: _scale(4)),
      padding: EdgeInsets.symmetric(
        horizontal: AppSpacings.pMd,
        vertical: _scale(14),
      ),
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(AppBorderRadius.medium),
        border: Border.all(color: borderColor, width: _scale(1)),
      ),
      child: Row(
        children: [
          Icon(icon, color: iconColor, size: _scale(20)),
          AppSpacings.spacingSmHorizontal,
          Expanded(
            child: Text(
              label,
              style: TextStyle(color: textColor, fontSize: AppFontSize.base),
            ),
          ),
          DeviceToggleSwitch(
            value: value,
            activeColor: activeColor,
            onChanged: onChanged,
          ),
        ],
      ),
    );
  }
}
