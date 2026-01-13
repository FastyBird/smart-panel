import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

/// A compact info tile displaying a label and value with optional unit.
///
/// Features:
/// - Responsive font sizing based on screen size
/// - Warning state with colored background and border
/// - Optional unit suffix displayed in smaller font
/// - Custom value color support
class InfoTile extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  /// Label text shown above the value
  final String label;

  /// Main value to display
  final String value;

  /// Optional unit suffix (e.g., '%', '°C', 'µg/m³')
  final String? unit;

  /// Custom color for the value text
  final Color? valueColor;

  /// When true, displays warning styling (amber background/border)
  final bool isWarning;

  InfoTile({
    super.key,
    required this.label,
    required this.value,
    this.unit,
    this.valueColor,
    this.isWarning = false,
  });

  double _scale(double val) =>
      _screenService.scale(val, density: _visualDensityService.density);

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // Use smaller font on small devices in portrait to fit 3 tiles per row
    // Also use smaller font on large landscape to balance the layout
    double valueFontSize;
    if (_screenService.isPortrait && _screenService.isSmallScreen) {
      valueFontSize = AppFontSize.base;
    } else if (_screenService.isPortrait && _screenService.isMediumScreen) {
      valueFontSize = AppFontSize.large;
    } else if (_screenService.isLandscape && _screenService.isLargeScreen) {
      valueFontSize = AppFontSize.large;
    } else {
      valueFontSize = AppFontSize.extraLarge;
    }

    final cardColor = isDark ? AppFillColorDark.light : AppFillColorLight.blank;
    final borderColor =
        isDark ? AppBorderColorDark.light : AppBorderColorLight.light;
    final textColor =
        isDark ? AppTextColorDark.primary : AppTextColorLight.primary;
    final mutedColor =
        isDark ? AppTextColorDark.disabled : AppTextColorLight.disabled;
    final warningColor =
        isDark ? AppColorsDark.warning : AppColorsLight.warning;
    final warningBgColor =
        isDark ? AppColorsDark.warningLight9 : AppColorsLight.warningLight9;
    final warningBorderColor =
        isDark ? AppColorsDark.warningLight7 : AppColorsLight.warningLight7;

    return Container(
      padding: EdgeInsets.all(_scale(14)),
      decoration: BoxDecoration(
        color: isWarning ? warningBgColor : cardColor,
        borderRadius: BorderRadius.circular(AppBorderRadius.medium),
        border: Border.all(
          color: isWarning ? warningBorderColor : borderColor,
          width: _scale(1),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(
              color: isWarning ? warningColor : mutedColor,
              fontSize: AppFontSize.extraSmall,
            ),
          ),
          AppSpacings.spacingXsVertical,
          RichText(
            text: TextSpan(
              style: TextStyle(
                color: isWarning ? warningColor : (valueColor ?? textColor),
                fontSize: valueFontSize,
                fontWeight: FontWeight.w600,
              ),
              children: [
                TextSpan(text: value),
                if (unit != null)
                  TextSpan(
                    text: ' $unit',
                    style: TextStyle(
                      fontSize: AppFontSize.extraSmall,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
