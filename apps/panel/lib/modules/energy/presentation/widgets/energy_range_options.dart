import 'package:flutter/material.dart';

import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/energy/services/energy_service.dart';

/// Returns the standard today/week/month range options.
List<ModeOption<EnergyRange>> getEnergyRangeOptions(
  AppLocalizations localizations,
) {
  return [
    ModeOption(
      value: EnergyRange.today,
      icon: Icons.calendar_today,
      label: localizations.energy_range_today,
    ),
    ModeOption(
      value: EnergyRange.week,
      icon: Icons.calendar_view_week,
      label: localizations.energy_range_week,
    ),
    ModeOption(
      value: EnergyRange.month,
      icon: Icons.calendar_month,
      label: localizations.energy_range_month,
    ),
  ];
}

/// Range selector options list (header label + option tiles).
///
/// Shared by both the embedded bottom-nav popup and the standalone dialog.
class EnergyRangeOptionsList extends StatelessWidget {
  final EnergyRange selectedRange;
  final ValueChanged<EnergyRange> onSelected;
  final List<ModeOption<EnergyRange>> rangeOptions;

  const EnergyRangeOptionsList({
    super.key,
    required this.selectedRange,
    required this.onSelected,
    required this.rangeOptions,
  });

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final infoFamily = ThemeColorFamily.get(
      isDark ? Brightness.dark : Brightness.light,
      ThemeColors.info,
    );

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsets.only(bottom: AppSpacings.pSm),
          child: Text(
            localizations.popup_label_mode.toUpperCase(),
            style: TextStyle(
              fontSize: AppFontSize.extraSmall,
              fontWeight: FontWeight.w600,
              letterSpacing: AppSpacings.scale(1),
              color: isDark
                  ? AppTextColorDark.placeholder
                  : AppTextColorLight.placeholder,
            ),
          ),
        ),
        for (final option in rangeOptions)
          GestureDetector(
            onTap: () => onSelected(option.value),
            behavior: HitTestBehavior.opaque,
            child: Container(
              padding: EdgeInsets.symmetric(
                vertical: AppSpacings.pMd,
                horizontal: AppSpacings.pMd,
              ),
              margin: EdgeInsets.only(bottom: AppSpacings.pXs),
              decoration: BoxDecoration(
                color: option.value == selectedRange
                    ? infoFamily.light9
                    : Colors.transparent,
                borderRadius: BorderRadius.circular(AppBorderRadius.small),
                border: option.value == selectedRange
                    ? Border.all(
                        color: infoFamily.light7,
                        width: AppSpacings.scale(1),
                      )
                    : null,
              ),
              child: Row(
                spacing: AppSpacings.pMd,
                children: [
                  Icon(
                    option.icon,
                    color: option.value == selectedRange
                        ? infoFamily.base
                        : (isDark
                            ? AppTextColorDark.secondary
                            : AppTextColorLight.secondary),
                    size: AppSpacings.scale(20),
                  ),
                  Expanded(
                    child: Text(
                      option.label,
                      style: TextStyle(
                        fontSize: AppFontSize.base,
                        fontWeight: option.value == selectedRange
                            ? FontWeight.w600
                            : FontWeight.w400,
                        color: option.value == selectedRange
                            ? infoFamily.base
                            : (isDark
                                ? AppTextColorDark.regular
                                : AppTextColorLight.regular),
                      ),
                    ),
                  ),
                  if (option.value == selectedRange)
                    Icon(
                      Icons.check,
                      color: infoFamily.base,
                      size: AppSpacings.scale(16),
                    ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}
