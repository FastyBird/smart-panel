import 'dart:math';

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/number.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/base_card.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/energy/models/energy_timeseries.dart';
import 'package:fastybird_smart_panel/modules/energy/services/energy_service.dart';
import 'package:fastybird_smart_panel/modules/energy/utils/energy_format.dart';

/// Bar chart of consumption (and production) over the selected range.
///
/// Used by both the standalone energy screen and the domain view.
class EnergyTimeseriesChart extends StatelessWidget {
  final EnergyTimeseries timeseries;
  final EnergyRange selectedRange;

  const EnergyTimeseriesChart({
    super.key,
    required this.timeseries,
    required this.selectedRange,
  });

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final screenService = locator<ScreenService>();
    final infoFamily = ThemeColorFamily.get(
      isDark ? Brightness.dark : Brightness.light,
      ThemeColors.info,
    );
    final successFamily = ThemeColorFamily.get(
      isDark ? Brightness.dark : Brightness.light,
      ThemeColors.success,
    );

    final points = timeseries.points;
    final hasProduction = timeseries.hasProduction;

    double maxY = 0;
    for (final p in points) {
      maxY = max(maxY, p.consumption);
      if (hasProduction) {
        maxY = max(maxY, p.production);
      }
    }
    maxY = maxY > 0 ? maxY * 1.2 : 1.0;

    final isCompact = screenService.isSmallScreen ||
        (screenService.isMediumScreen && !screenService.isPortrait);
    final barWidth = points.length > 24
        ? AppSpacings.scale(isCompact ? 5 : 8)
        : AppSpacings.scale(isCompact ? 6 : 12);

    final yInterval = maxY / 4;
    final int yDecimals;
    if (yInterval >= 10) {
      yDecimals = 0;
    } else if (yInterval >= 1) {
      yDecimals = 1;
    } else if (yInterval >= 0.1) {
      yDecimals = 2;
    } else {
      yDecimals = 3;
    }

    final widestLabel = NumberUtils.formatDecimal(
      maxY,
      decimalPlaces: yDecimals,
    );
    final yReservedSize = AppSpacings.scale(widestLabel.length * 7.0 + 4);

    return BaseCard(
      expanded: true,
      headerIcon: MdiIcons.chartBar,
      headerTitle: localizations.energy_chart_title,
      child: Expanded(
        child: Padding(
          padding: EdgeInsets.only(
            left: AppSpacings.pMd,
            right: AppSpacings.pMd,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            spacing: AppSpacings.pMd,
            children: [
              Expanded(
                child: BarChart(
                  BarChartData(
                    alignment: BarChartAlignment.spaceAround,
                    maxY: maxY,
                    barTouchData: BarTouchData(
                      enabled: true,
                      touchTooltipData: BarTouchTooltipData(
                        getTooltipColor: (group) => isDark
                            ? AppFillColorDark.darker
                            : AppFillColorLight.darker,
                        tooltipPadding: EdgeInsets.symmetric(
                          horizontal: AppSpacings.pMd,
                          vertical: AppSpacings.pSm,
                        ),
                        maxContentWidth: AppSpacings.scale(150),
                        getTooltipItem: (group, groupIndex, rod, rodIndex) {
                          final value =
                              NumberUtils.formatDecimal(
                            rod.toY,
                            decimalPlaces: 2,
                          );
                          final label = rodIndex == 0
                              ? localizations.energy_consumption
                              : localizations.energy_production;
                          return BarTooltipItem(
                            '$label\n$value ${localizations.energy_unit_kwh}',
                            TextStyle(
                              color: isDark
                                  ? AppTextColorDark.primary
                                  : AppTextColorLight.primary,
                              fontSize: AppFontSize.extraSmall,
                              fontWeight: FontWeight.w500,
                            ),
                          );
                        },
                      ),
                    ),
                    titlesData: FlTitlesData(
                      show: true,
                      topTitles: const AxisTitles(
                          sideTitles: SideTitles(showTitles: false)),
                      rightTitles: const AxisTitles(
                          sideTitles: SideTitles(showTitles: false)),
                      leftTitles: AxisTitles(
                        sideTitles: SideTitles(
                          showTitles: true,
                          interval: yInterval,
                          reservedSize: yReservedSize,
                          getTitlesWidget: (value, meta) {
                            return SizedBox(
                              width: yReservedSize,
                              child: Padding(
                                padding:
                                    EdgeInsets.only(right: AppSpacings.pXs),
                                child: Text(
                                  NumberUtils.formatDecimal(
                                    value,
                                    decimalPlaces: yDecimals,
                                  ),
                                  textAlign: TextAlign.right,
                                  style: TextStyle(
                                    fontSize: AppFontSize.extraExtraSmall,
                                    color: isDark
                                        ? AppTextColorDark.placeholder
                                        : AppTextColorLight.placeholder,
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                      bottomTitles: AxisTitles(
                        sideTitles: SideTitles(
                          showTitles: true,
                          reservedSize: AppSpacings.scale(20),
                          getTitlesWidget: (value, meta) {
                            final index = value.toInt();
                            if (index < 0 || index >= points.length) {
                              return const SizedBox.shrink();
                            }
                            final point = points[index];

                            final bool show;
                            String label;
                            if (selectedRange == EnergyRange.month) {
                              show = isCompact
                                  ? point.timestamp.day % 5 == 0
                                  : point.timestamp.day.isEven;
                              label = '${point.timestamp.day}';
                            } else if (selectedRange == EnergyRange.week) {
                              show = true;
                              label = getShortDayName(
                                localizations,
                                point.timestamp.weekday,
                              );
                            } else {
                              show = isCompact
                                  ? point.timestamp.hour % 4 == 0
                                  : point.timestamp.hour.isEven;
                              label =
                                  '${point.timestamp.hour.toString().padLeft(2, '0')}:00';
                            }

                            if (!show) {
                              return const SizedBox.shrink();
                            }

                            return Padding(
                              padding: EdgeInsets.only(top: AppSpacings.pXs),
                              child: Text(
                                label,
                                style: TextStyle(
                                  fontSize: AppFontSize.extraExtraSmall,
                                  color: isDark
                                      ? AppTextColorDark.placeholder
                                      : AppTextColorLight.placeholder,
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                    ),
                    gridData: FlGridData(
                      show: true,
                      drawVerticalLine: false,
                      horizontalInterval: maxY > 0 ? maxY / 4 : 1,
                      getDrawingHorizontalLine: (value) {
                        return FlLine(
                          color: isDark
                              ? AppFillColorDark.darker
                              : AppBorderColorLight.base,
                          strokeWidth: AppSpacings.scale(1),
                        );
                      },
                    ),
                    borderData: FlBorderData(show: false),
                    barGroups: List.generate(points.length, (index) {
                      final point = points[index];
                      final rods = <BarChartRodData>[
                        BarChartRodData(
                          toY: point.consumption,
                          color: infoFamily.base,
                          width: barWidth,
                          borderRadius: BorderRadius.vertical(
                            top: Radius.circular(AppSpacings.scale(2)),
                          ),
                        ),
                      ];

                      if (hasProduction) {
                        rods.add(BarChartRodData(
                          toY: point.production,
                          color: successFamily.base,
                          width: barWidth,
                          borderRadius: BorderRadius.vertical(
                            top: Radius.circular(AppSpacings.scale(2)),
                          ),
                        ));
                      }

                      return BarChartGroupData(
                        x: index,
                        barRods: rods,
                        barsSpace: hasProduction ? AppSpacings.scale(2) : 0,
                      );
                    }),
                  ),
                ),
              ),
              if (hasProduction)
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  spacing: AppSpacings.pLg,
                  children: [
                    _buildLegendItem(
                      context,
                      color: infoFamily.base,
                      label: localizations.energy_consumption,
                    ),
                    _buildLegendItem(
                      context,
                      color: successFamily.base,
                      label: localizations.energy_production,
                    ),
                  ],
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLegendItem(
    BuildContext context, {
    required Color color,
    required String label,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Row(
      mainAxisSize: MainAxisSize.min,
      spacing: AppSpacings.pXs,
      children: [
        Container(
          width: AppSpacings.scale(12),
          height: AppSpacings.scale(12),
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(AppSpacings.scale(2)),
          ),
        ),
        Text(
          label,
          style: TextStyle(
            fontSize: AppFontSize.extraSmall,
            color: isDark
                ? AppTextColorDark.secondary
                : AppTextColorLight.secondary,
          ),
        ),
      ],
    );
  }
}
