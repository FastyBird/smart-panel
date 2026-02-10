import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

import 'package:fastybird_smart_panel/core/utils/number_format.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/energy/repositories/energy_repository.dart';

/// Compact energy widget for the space header area.
///
/// Shows today's consumption (and production if available).
/// Displays "—" on error or when data is unavailable.
/// Does not crash on failure — silently degrades.
class EnergyHeaderWidget extends StatelessWidget {
	const EnergyHeaderWidget({super.key});

	@override
	Widget build(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final localizations = AppLocalizations.of(context)!;

		final infoFamily = ThemeColorFamily.get(
			isDark ? Brightness.dark : Brightness.light,
			ThemeColors.info,
		);

		return Consumer<EnergyRepository>(
			builder: (context, repository, _) {
				if (!repository.isSupported || !repository.supportChecked) {
					return const SizedBox.shrink();
				}

				final summary = repository.headerSummary;

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
						vertical: AppSpacings.pXs,
					),
					decoration: BoxDecoration(
						color: infoFamily.light8,
						borderRadius: BorderRadius.circular(AppBorderRadius.base),
					),
					child: Row(
						mainAxisSize: MainAxisSize.min,
						spacing: AppSpacings.pXs,
						children: [
							Icon(
								MdiIcons.flashOutline,
								size: AppSpacings.scale(14),
								color: infoFamily.base,
							),
							Text(
								consumptionText,
								style: TextStyle(
									fontSize: AppFontSize.extraSmall,
									fontWeight: FontWeight.w600,
									color: infoFamily.base,
								),
							),
							if (summary != null && summary.hasProduction) ...[
								Container(
									width: AppSpacings.scale(1),
									height: AppSpacings.scale(12),
									color: infoFamily.light5,
								),
								Icon(
									MdiIcons.solarPower,
									size: AppSpacings.scale(14),
									color: isDark ? AppColorsDark.success : AppColorsLight.success,
								),
								Text(
									'${NumberFormatUtils.defaultFormat.formatDecimal(
										summary.production!,
										decimalPlaces: 1,
									)} ${localizations.energy_unit_kwh}',
									style: TextStyle(
										fontSize: AppFontSize.extraSmall,
										fontWeight: FontWeight.w600,
										color: isDark ? AppColorsDark.success : AppColorsLight.success,
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
