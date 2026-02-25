import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

import 'package:fastybird_smart_panel/core/utils/number_format.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/energy/models/energy_summary.dart';
import 'package:fastybird_smart_panel/modules/energy/repositories/energy_repository.dart';

/// Compact energy pill showing today's consumption (and production if available).
///
/// Renders as a pill-shaped badge matching the security screen badge style.
/// Color adapts based on production-to-consumption ratio:
/// - No production data → info (blue)
/// - Production >= consumption → success (green)
/// - Production covers 50-99% → info (blue)
/// - Production covers < 50% → warning (orange)
///
/// Returns [SizedBox.shrink] when energy is not supported or not yet checked.
/// Displays "\u2014" on error or when data is unavailable.
class EnergySummaryPill extends StatelessWidget {
	final bool showProduction;

	const EnergySummaryPill({
		super.key,
		this.showProduction = true,
	});

	/// Determine pill color based on production/consumption ratio.
	ThemeColors _resolveColor(EnergySummary? summary) {
		if (summary == null || !showProduction || !summary.hasProduction) {
			return ThemeColors.info;
		}

		final ratio = summary.production! / summary.consumption.clamp(0.001, double.infinity);

		if (ratio >= 1.0) return ThemeColors.success;
		if (ratio >= 0.5) return ThemeColors.info;
		return ThemeColors.warning;
	}

	@override
	Widget build(BuildContext context) {
		final brightness = Theme.of(context).brightness;
		final localizations = AppLocalizations.of(context)!;

		return Consumer<EnergyRepository>(
			builder: (context, repository, _) {
				if (!repository.isSupported || !repository.supportChecked) {
					return const SizedBox.shrink();
				}

				final summary = repository.headerSummary;
				final pillColor = _resolveColor(summary);
				final colorFamily = ThemeColorFamily.get(brightness, pillColor);

				final String consumptionText;
				if (summary != null) {
					consumptionText = '${NumberFormatUtils.defaultFormat.formatDecimal(
						summary.consumption,
						decimalPlaces: 1,
					)} ${localizations.energy_unit_kwh}';
				} else {
					consumptionText = '\u2014'; // em dash
				}

				return Container(
					padding: EdgeInsets.symmetric(
						horizontal: AppSpacings.pMd,
						vertical: AppSpacings.pSm,
					),
					decoration: BoxDecoration(
						color: colorFamily.light8,
						borderRadius: BorderRadius.circular(AppBorderRadius.base),
					),
					child: Row(
						mainAxisSize: MainAxisSize.min,
						spacing: AppSpacings.pXs,
						children: [
							Icon(
								MdiIcons.flashOutline,
								size: AppSpacings.scale(14),
								color: colorFamily.base,
							),
							Text(
								consumptionText,
								style: TextStyle(
									fontSize: AppFontSize.extraSmall,
									fontWeight: FontWeight.w700,
									color: colorFamily.base,
									letterSpacing: 0.3,
								),
							),
							if (showProduction && summary != null && summary.hasProduction) ...[
								Container(
									width: AppSpacings.scale(1),
									height: AppSpacings.scale(12),
									color: colorFamily.light5,
								),
								Icon(
									MdiIcons.solarPower,
									size: AppSpacings.scale(14),
									color: colorFamily.base,
								),
								Text(
									'${NumberFormatUtils.defaultFormat.formatDecimal(
										summary.production!,
										decimalPlaces: 1,
									)} ${localizations.energy_unit_kwh}',
									style: TextStyle(
										fontSize: AppFontSize.extraSmall,
										fontWeight: FontWeight.w700,
										color: colorFamily.base,
										letterSpacing: 0.3,
									),
								),
							],
						],
					),
				);
			},
		);
	}
}
