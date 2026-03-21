import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/number_format.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/hero_card.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/energy/models/energy_summary.dart';
import 'package:fastybird_smart_panel/modules/energy/services/energy_service.dart';
import 'package:fastybird_smart_panel/modules/energy/utils/energy_format.dart';

/// Hero card showing consumption giant value, range badge, secondary
/// production/net tiles, and comparison status badge.
///
/// Used by both the standalone energy screen and the domain view.
class EnergyConsumptionCard extends StatelessWidget {
  final EnergySummary summary;
  final EnergyRange selectedRange;

  /// Called when the range badge pill is tapped (null = non-interactive).
  final VoidCallback? onRangeBadgeTap;

  const EnergyConsumptionCard({
    super.key,
    required this.summary,
    required this.selectedRange,
    this.onRangeBadgeTap,
  });

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final brightness = isDark ? Brightness.dark : Brightness.light;
    final screenService = locator<ScreenService>();
    final isLandscape = screenService.isLandscape;
    final infoFamily = ThemeColorFamily.get(brightness, ThemeColors.info);
    final successFamily = ThemeColorFamily.get(brightness, ThemeColors.success);
    final warningFamily = ThemeColorFamily.get(brightness, ThemeColors.warning);

    final rangeIcon = switch (selectedRange) {
      EnergyRange.today => MdiIcons.calendarToday,
      EnergyRange.week => MdiIcons.calendarWeek,
      EnergyRange.month => MdiIcons.calendarMonth,
    };
    final rangeLabel = switch (selectedRange) {
      EnergyRange.today => localizations.energy_range_today,
      EnergyRange.week => localizations.energy_range_week,
      EnergyRange.month => localizations.energy_range_month,
    };

    return HeroCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        mainAxisAlignment: MainAxisAlignment.center,
        spacing: AppSpacings.pSm,
        children: [
          // Hero row: badge (portrait only) + giant value
          LayoutBuilder(
            builder: (context, constraints) {
              final isCompactFont = screenService.isPortrait
                  ? screenService.isSmallScreen
                  : screenService.isSmallScreen ||
                      screenService.isMediumScreen;
              final fontSize = isCompactFont
                  ? (constraints.maxWidth * 0.18).clamp(
                      AppSpacings.scale(32),
                      AppSpacings.scale(96),
                    )
                  : (constraints.maxWidth * 0.22).clamp(
                      AppSpacings.scale(32),
                      AppSpacings.scale(96),
                    );
              final unitFontSize = fontSize * 0.27;
              final textColor =
                  isDark ? AppTextColorDark.regular : AppTextColorLight.regular;
              final unitColor = isDark
                  ? AppTextColorDark.placeholder
                  : AppTextColorLight.placeholder;
              final badgeFontSize =
                  isCompactFont ? AppFontSize.small : AppFontSize.base;

              return Row(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.end,
                spacing: AppSpacings.pSm,
                children: [
                  // Badge pill (portrait only)
                  if (!isLandscape)
                    GestureDetector(
                      onTap: onRangeBadgeTap,
                      child: Container(
                        padding: EdgeInsets.symmetric(
                          horizontal: AppSpacings.pMd,
                          vertical: AppSpacings.pXs,
                        ),
                        height: AppSpacings.scale(24),
                        decoration: BoxDecoration(
                          color: infoFamily.light9,
                          borderRadius: BorderRadius.circular(
                            AppBorderRadius.round,
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          spacing: AppSpacings.pSm,
                          children: [
                            Icon(
                              rangeIcon,
                              size: badgeFontSize,
                              color: infoFamily.base,
                            ),
                            Text(
                              rangeLabel.toUpperCase(),
                              style: TextStyle(
                                fontSize: badgeFontSize,
                                fontWeight: FontWeight.w700,
                                color: infoFamily.base,
                                letterSpacing: AppSpacings.scale(0.3),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  // Giant value
                  Stack(
                    clipBehavior: Clip.none,
                    children: [
                      Text(
                        NumberFormatUtils.defaultFormat.formatDecimal(
                          summary.consumption,
                          decimalPlaces:
                              energyDecimals(summary.consumption),
                        ),
                        style: TextStyle(
                          fontSize: fontSize,
                          fontWeight: FontWeight.w300,
                          fontFamily: 'DIN1451',
                          color: textColor,
                          height: 0.7,
                        ),
                      ),
                      Positioned(
                        top: 0,
                        right: -unitFontSize * 2.25,
                        child: Text(
                          localizations.energy_unit_kwh,
                          style: TextStyle(
                            fontSize: unitFontSize,
                            fontWeight: FontWeight.w300,
                            color: unitColor,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              );
            },
          ),
          AppSpacings.spacingSmVertical,
          // Description text
          Text(
            switch (selectedRange) {
              EnergyRange.today => localizations.energy_consumed_today,
              EnergyRange.week => localizations.energy_consumed_week,
              EnergyRange.month => localizations.energy_consumed_month,
            },
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: AppFontSize.small,
              fontWeight: FontWeight.w400,
              color: isDark
                  ? AppTextColorDark.placeholder
                  : AppTextColorLight.placeholder,
            ),
          ),
          // Production & Net row (portrait only, landscape has separate cards)
          if (!isLandscape && summary.hasProduction) ...[
            AppSpacings.spacingXsVertical,
            IntrinsicHeight(
              child: Row(
                spacing: AppSpacings.pSm,
                children: [
                  Expanded(
                    child: EnergySecondaryValue(
                      icon: MdiIcons.solarPower,
                      label: localizations.energy_production,
                      value: NumberFormatUtils.defaultFormat.formatDecimal(
                        summary.production!,
                        decimalPlaces:
                            energyDecimals(summary.production!),
                      ),
                      unit: localizations.energy_unit_kwh,
                      colorFamily: successFamily,
                    ),
                  ),
                  if (summary.net != null)
                    Expanded(
                      child: EnergySecondaryValue(
                        icon: MdiIcons.swapVertical,
                        label: localizations.energy_net,
                        value: NumberFormatUtils.defaultFormat.formatDecimal(
                          summary.net!,
                          decimalPlaces:
                              energyDecimals(summary.net!),
                        ),
                        unit: localizations.energy_unit_kwh,
                        colorFamily:
                            summary.net! > 0 ? warningFamily : successFamily,
                      ),
                    ),
                ],
              ),
            ),
          ],
          // Comparison status
          if (summary.hasConsumptionComparison) ...[
            AppSpacings.spacingSmVertical,
            EnergyComparisonBadge(
              changePercent: summary.consumptionChangePercent!,
              selectedRange: selectedRange,
            ),
          ]
        ],
      ),
    );
  }
}

/// Colored tile showing a secondary energy metric (production, net, etc.).
class EnergySecondaryValue extends StatelessWidget {
  final IconData icon;
  final String label;
  final String value;
  final String unit;
  final ThemeColorFamily colorFamily;

  const EnergySecondaryValue({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
    required this.unit,
    required this.colorFamily,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: AppSpacings.pMd,
        vertical: AppSpacings.pSm,
      ),
      decoration: BoxDecoration(
        color: colorFamily.light9,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        border: Border.all(
          color: colorFamily.light7,
          width: AppSpacings.scale(1),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.center,
        mainAxisAlignment: MainAxisAlignment.center,
        spacing: AppSpacings.pXs,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            spacing: AppSpacings.pXs,
            children: [
              Icon(icon, size: AppSpacings.scale(14), color: colorFamily.base),
              Flexible(
                child: Text(
                  label,
                  style: TextStyle(
                    color: colorFamily.base,
                    fontSize: AppFontSize.extraSmall,
                    fontWeight: FontWeight.w500,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          FittedBox(
            fit: BoxFit.scaleDown,
            child: RichText(
              maxLines: 1,
              text: TextSpan(
                children: [
                  TextSpan(
                    text: value,
                    style: TextStyle(
                      color: colorFamily.base,
                      fontSize: AppFontSize.base,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  TextSpan(
                    text: ' $unit',
                    style: TextStyle(
                      color: colorFamily.base,
                      fontSize: AppFontSize.extraSmall,
                      fontWeight: FontWeight.w400,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Badge showing consumption change vs previous period (up/down/same).
class EnergyComparisonBadge extends StatelessWidget {
  final double changePercent;
  final EnergyRange selectedRange;

  const EnergyComparisonBadge({
    super.key,
    required this.changePercent,
    required this.selectedRange,
  });

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final brightness = isDark ? Brightness.dark : Brightness.light;

    // "vs yesterday" / "oproti včerejšku" — used with percentage values
    final periodLabel = switch (selectedRange) {
      EnergyRange.today => localizations.energy_comparison_vs_yesterday,
      EnergyRange.week => localizations.energy_comparison_vs_last_week,
      EnergyRange.month => localizations.energy_comparison_vs_last_month,
    };

    // Bare period name — used with "Same as {period}" template
    final barePeriod = switch (selectedRange) {
      EnergyRange.today => localizations.energy_period_yesterday,
      EnergyRange.week => localizations.energy_period_last_week,
      EnergyRange.month => localizations.energy_period_last_month,
    };

    final bool isZero = changePercent.abs() < 0.1;
    final bool isDown = !isZero && changePercent < 0;

    final IconData arrowIcon;
    final ThemeColorFamily colorFamily;
    final String text;

    if (isZero) {
      arrowIcon = MdiIcons.minus;
      colorFamily = ThemeColorFamily.get(brightness, ThemeColors.neutral);
      text = localizations.energy_comparison_same(barePeriod);
    } else if (isDown) {
      arrowIcon = MdiIcons.arrowDown;
      colorFamily = ThemeColorFamily.get(brightness, ThemeColors.success);
      text = '${changePercent.abs().toStringAsFixed(1)}% $periodLabel';
    } else {
      arrowIcon = MdiIcons.arrowUp;
      colorFamily = ThemeColorFamily.get(brightness, ThemeColors.warning);
      text = '${changePercent.abs().toStringAsFixed(1)}% $periodLabel';
    }

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: AppSpacings.pMd,
        vertical: AppSpacings.pXs,
      ),
      decoration: BoxDecoration(
        color: colorFamily.light8,
        borderRadius: BorderRadius.circular(AppBorderRadius.round),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        spacing: AppSpacings.pXs,
        children: [
          Icon(
            arrowIcon,
            size: AppFontSize.small,
            color: colorFamily.base,
          ),
          Text(
            text,
            style: TextStyle(
              fontSize: AppFontSize.extraSmall,
              fontWeight: FontWeight.w600,
              color: colorFamily.base,
            ),
          ),
        ],
      ),
    );
  }
}
