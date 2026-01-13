import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

/// Mode Button
class DeviceModeButton extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  final IconData icon;
  final String label;
  final bool isSelected;
  final Color? activeColor;
  final Color? selectedBgColor;
  final VoidCallback? onTap;

  DeviceModeButton({
    super.key,
    required this.icon,
    required this.label,
    required this.isSelected,
    this.activeColor,
    this.selectedBgColor,
    this.onTap,
  });

  double _scale(double val) =>
      _screenService.scale(val, density: _visualDensityService.density);

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final effectiveActiveColor =
        activeColor ?? (isDark ? AppColorsDark.primary : AppColorsLight.primary);
    final effectiveSelectedBgColor = selectedBgColor ??
        (isDark ? AppColorsDark.primaryLight9 : AppColorsLight.primaryLight9);
    final secondaryColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
    final mutedColor =
        isDark ? AppTextColorDark.disabled : AppTextColorLight.disabled;

    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: EdgeInsets.symmetric(
            vertical: _scale(12),
            horizontal: _scale(8),
          ),
          decoration: BoxDecoration(
            color: isSelected ? effectiveSelectedBgColor : Colors.transparent,
            borderRadius: BorderRadius.circular(AppBorderRadius.small),
            border: Border.all(
              color: isSelected ? effectiveActiveColor : Colors.transparent,
              width: _scale(2),
            ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                icon,
                size: _scale(22),
                color: isSelected ? effectiveActiveColor : mutedColor,
              ),
              AppSpacings.spacingXsVertical,
              Text(
                label,
                style: TextStyle(
                  fontSize: AppFontSize.extraSmall,
                  color: isSelected ? effectiveActiveColor : secondaryColor,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
