import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/modules/energy/utils/energy_format.dart';

import 'package:fastybird_smart_panel/modules/energy/models/energy_summary.dart';
import 'package:fastybird_smart_panel/modules/energy/repositories/energy_repository.dart';
import 'package:fastybird_smart_panel/modules/energy/services/energy_service.dart';

/// Compact energy pill showing consumption (and optionally production).
///
/// Fetches data for the given [spaceId] and [range] on mount and whenever
/// those parameters change. Use `spaceId: 'home'` for whole-installation
/// data (entry/master overviews) and a room ID for room-specific data.
///
/// Returns [SizedBox.shrink] when energy is not supported or not yet checked.
class EnergySummaryPill extends StatefulWidget {
	final String spaceId;
	final EnergyRange range;
	final bool showProduction;
	final VoidCallback? onTap;

	const EnergySummaryPill({
		super.key,
		this.spaceId = 'home',
		this.range = EnergyRange.today,
		this.showProduction = true,
		this.onTap,
	});

	@override
	State<EnergySummaryPill> createState() => _EnergySummaryPillState();
}

class _EnergySummaryPillState extends State<EnergySummaryPill> {
	@override
	void initState() {
		super.initState();
		_fetchData();
	}

	@override
	void didUpdateWidget(EnergySummaryPill oldWidget) {
		super.didUpdateWidget(oldWidget);

		if (oldWidget.spaceId != widget.spaceId || oldWidget.range != widget.range) {
			_fetchData();
		}
	}

	void _fetchData() {
		final repository = context.read<EnergyRepository>();

		if (repository.isSupported) {
			repository.refreshHeaderSummary(widget.spaceId, widget.range);
		}
	}

	/// Determine pill color based on production/consumption ratio.
	ThemeColors _resolveColor(EnergySummary? summary) {
		if (summary == null || !widget.showProduction || !summary.hasProduction) {
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
					final scaled = formatEnergyScaled(summary.consumption);
					consumptionText = '${scaled.value} ${scaled.unit}';
				} else {
					consumptionText = '\u2014'; // em dash
				}

				return GestureDetector(
				onTap: widget.onTap,
				child: Container(
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
							if (widget.showProduction && summary != null && summary.hasProduction) ...[
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
								Builder(
									builder: (context) {
										final prodScaled = formatEnergyScaled(summary.production!);
										return Text(
											'${prodScaled.value} ${prodScaled.unit}',
											style: TextStyle(
												fontSize: AppFontSize.extraSmall,
												fontWeight: FontWeight.w700,
												color: colorFamily.base,
												letterSpacing: 0.3,
											),
										);
									},
								),
							],
						],
					),
				),
			);
			},
		);
	}
}
