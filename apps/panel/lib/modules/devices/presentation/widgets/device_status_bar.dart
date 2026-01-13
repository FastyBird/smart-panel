import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

/// Progress Bar for filter/tank status
class DeviceStatusBar extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  final String title;
  final double value;
  final String valueLabel;
  final String? hint;
  final Color? color;
  final bool isWarning;

  DeviceStatusBar({
    super.key,
    required this.title,
    required this.value,
    required this.valueLabel,
    this.hint,
    this.color,
    this.isWarning = false,
  });

  double _scale(double val) =>
      _screenService.scale(val, density: _visualDensityService.density);

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final defaultColor =
        isDark ? AppColorsDark.success : AppColorsLight.success;
    final warningColor =
        isDark ? AppColorsDark.warning : AppColorsLight.warning;
    final barColor = isWarning ? warningColor : (color ?? defaultColor);
    final cardColor = isDark ? AppFillColorDark.light : AppFillColorLight.blank;
    final borderColor =
        isDark ? AppBorderColorDark.light : AppBorderColorLight.light;
    final textColor =
        isDark ? AppTextColorDark.primary : AppTextColorLight.primary;
    final mutedColor =
        isDark ? AppTextColorDark.disabled : AppTextColorLight.disabled;
    final trackColor =
        isDark ? AppFillColorDark.darker : AppFillColorLight.darker;

    return Container(
      padding: EdgeInsets.all(AppSpacings.pMd),
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(AppBorderRadius.medium),
        border: Border.all(color: borderColor, width: _scale(1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title,
                style: TextStyle(
                  color: textColor,
                  fontSize: AppFontSize.small,
                  fontWeight: FontWeight.w500,
                ),
              ),
              Text(
                valueLabel,
                style: TextStyle(
                  color: barColor,
                  fontSize: AppFontSize.base,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          AppSpacings.spacingMdVertical,
          ClipRRect(
            borderRadius: BorderRadius.circular(AppBorderRadius.small),
            child: LinearProgressIndicator(
              value: value,
              minHeight: _scale(6),
              backgroundColor: trackColor,
              valueColor: AlwaysStoppedAnimation(barColor),
            ),
          ),
          if (hint != null) ...[
            AppSpacings.spacingSmVertical,
            Text(
              hint!,
              style: TextStyle(
                color: mutedColor,
                fontSize: AppFontSize.extraSmall,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
