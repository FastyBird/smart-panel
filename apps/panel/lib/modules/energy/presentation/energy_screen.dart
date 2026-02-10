// Standalone Energy Screen — whole-installation energy overview.
//
// Mirrors SecurityScreen: registered as a deck item, supports embedded mode.
// Uses spaceId='home' for whole-installation data.
//
// Sections:
// - ENERGY SCREEN (state, lifecycle, build)
// - HEADER
// - RANGE SELECTOR
// - SUMMARY CARDS
// - TIMESERIES CHART
// - TOP CONSUMERS LIST
// - EMPTY STATE

import 'dart:math';

import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';

import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/number_format.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/core/widgets/portrait_view_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/landscape_view_layout.dart';
import 'package:fastybird_smart_panel/core/widgets/section_heading.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/energy/models/energy_breakdown.dart';
import 'package:fastybird_smart_panel/modules/energy/models/energy_summary.dart';
import 'package:fastybird_smart_panel/modules/energy/models/energy_timeseries.dart';
import 'package:fastybird_smart_panel/modules/energy/repositories/energy_repository.dart';
import 'package:fastybird_smart_panel/modules/energy/services/energy_service.dart';

// =============================================================================
// CONSTANTS
// =============================================================================

const String _homeSpaceId = 'home';

// =============================================================================
// ENERGY SCREEN
// =============================================================================

class EnergyScreen extends StatefulWidget {
	/// When true, hides back/home navigation buttons (used when embedded in deck).
	final bool embedded;

	const EnergyScreen({super.key, this.embedded = false});

	@override
	State<EnergyScreen> createState() => _EnergyScreenState();
}

class _EnergyScreenState extends State<EnergyScreen> {
	@override
	Widget build(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;

		return Consumer<EnergyRepository>(
			builder: (context, repository, _) {
				final summary = repository.summary;
				final timeseries = repository.timeseries;
				final breakdown = repository.breakdown;
				final selectedRange = repository.selectedRange;

				return Scaffold(
					backgroundColor: isDark ? AppBgColorDark.page : AppBgColorLight.page,
					body: SafeArea(
						child: Column(
							children: [
								_buildHeader(context, repository),
								Expanded(
									child: LayoutBuilder(
										builder: (context, constraints) {
											final isLandscape = constraints.maxWidth > constraints.maxHeight;

											if (repository.state == EnergyDataState.loading && summary == null) {
												return _buildLoading(context);
											}

											if (repository.state == EnergyDataState.error && summary == null) {
												return _buildError(context, repository);
											}

											if (summary == null) {
												return _buildEmptyState(context);
											}

											if (isLandscape) {
												return _buildLandscape(
													context,
													summary: summary,
													timeseries: timeseries,
													breakdown: breakdown,
													selectedRange: selectedRange,
													repository: repository,
												);
											}

											return _buildPortrait(
												context,
												summary: summary,
												timeseries: timeseries,
												breakdown: breakdown,
												selectedRange: selectedRange,
												repository: repository,
											);
										},
									),
								),
							],
						),
					),
				);
			},
		);
	}

	// ===========================================================================
	// HEADER
	// ===========================================================================

	Widget _buildHeader(BuildContext context, EnergyRepository repository) {
		final localizations = AppLocalizations.of(context)!;
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final infoColor = isDark ? AppColorsDark.info : AppColorsLight.info;

		String subtitle;
		if (repository.summary != null) {
			final consumption = NumberFormatUtils.defaultFormat.formatDecimal(
				repository.summary!.consumption,
				decimalPlaces: 2,
			);
			subtitle = '$consumption ${localizations.energy_unit_kwh}';
			if (repository.summary!.hasProduction) {
				final production = NumberFormatUtils.defaultFormat.formatDecimal(
					repository.summary!.production!,
					decimalPlaces: 2,
				);
				subtitle += ' / $production ${localizations.energy_unit_kwh} ${localizations.energy_production.toLowerCase()}';
			}
		} else {
			subtitle = localizations.energy_empty_title;
		}

		return PageHeader(
			title: localizations.domain_energy,
			subtitle: subtitle,
			subtitleColor: repository.summary != null ? infoColor : null,
			onBack: widget.embedded ? null : () => Navigator.pop(context),
			leading: HeaderMainIcon(
				icon: MdiIcons.flashOutline,
				color: ThemeColors.info,
			),
		);
	}

	// ===========================================================================
	// LAYOUTS
	// ===========================================================================

	Widget _buildPortrait(
		BuildContext context, {
		required EnergySummary summary,
		required EnergyTimeseries? timeseries,
		required EnergyBreakdown? breakdown,
		required EnergyRange selectedRange,
		required EnergyRepository repository,
	}) {
		return PortraitViewLayout(
			content: Column(
				crossAxisAlignment: CrossAxisAlignment.start,
				spacing: AppSpacings.pLg,
				children: [
					_buildRangeSelector(context, selectedRange, repository),
					_buildSummaryCards(context, summary),
					if (timeseries != null && timeseries.isNotEmpty)
						_buildTimeseriesChart(context, timeseries, selectedRange),
					if (breakdown != null && breakdown.isNotEmpty)
						_buildTopConsumers(context, breakdown),
				],
			),
		);
	}

	Widget _buildLandscape(
		BuildContext context, {
		required EnergySummary summary,
		required EnergyTimeseries? timeseries,
		required EnergyBreakdown? breakdown,
		required EnergyRange selectedRange,
		required EnergyRepository repository,
	}) {
		return LandscapeViewLayout(
			mainContentScrollable: true,
			mainContent: Column(
				crossAxisAlignment: CrossAxisAlignment.start,
				spacing: AppSpacings.pLg,
				children: [
					_buildRangeSelector(context, selectedRange, repository),
					_buildSummaryCards(context, summary),
					if (timeseries != null && timeseries.isNotEmpty)
						_buildTimeseriesChart(context, timeseries, selectedRange),
				],
			),
			additionalContent: breakdown != null && breakdown.isNotEmpty
				? _buildTopConsumers(context, breakdown)
				: null,
		);
	}

	// ===========================================================================
	// RANGE SELECTOR
	// ===========================================================================

	Widget _buildRangeSelector(
		BuildContext context,
		EnergyRange selectedRange,
		EnergyRepository repository,
	) {
		final localizations = AppLocalizations.of(context)!;
		final isDark = Theme.of(context).brightness == Brightness.dark;

		final ranges = [
			(EnergyRange.today, localizations.energy_range_today),
			(EnergyRange.week, localizations.energy_range_week),
			(EnergyRange.month, localizations.energy_range_month),
		];

		final infoFamily = ThemeColorFamily.get(
			isDark ? Brightness.dark : Brightness.light,
			ThemeColors.info,
		);

		return Row(
			children: ranges.map((entry) {
				final (range, label) = entry;
				final isSelected = range == selectedRange;

				return Padding(
					padding: EdgeInsets.only(right: AppSpacings.pSm),
					child: GestureDetector(
						onTap: () => repository.setRange(_homeSpaceId, range),
						child: Container(
							padding: EdgeInsets.symmetric(
								horizontal: AppSpacings.pMd,
								vertical: AppSpacings.pSm,
							),
							decoration: BoxDecoration(
								color: isSelected ? infoFamily.light8 : Colors.transparent,
								borderRadius: BorderRadius.circular(AppBorderRadius.base),
								border: Border.all(
									color: isSelected
										? infoFamily.light5
										: (isDark ? AppFillColorDark.light : AppBorderColorLight.darker),
									width: AppSpacings.scale(1),
								),
							),
							child: Text(
								label,
								style: TextStyle(
									fontSize: AppFontSize.small,
									fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
									color: isSelected
										? infoFamily.base
										: (isDark ? AppTextColorDark.regular : AppTextColorLight.regular),
								),
							),
						),
					),
				);
			}).toList(),
		);
	}

	// ===========================================================================
	// SUMMARY CARDS
	// ===========================================================================

	Widget _buildSummaryCards(BuildContext context, EnergySummary summary) {
		final localizations = AppLocalizations.of(context)!;
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final infoColor = isDark ? AppColorsDark.info : AppColorsLight.info;
		final successColor = isDark ? AppColorsDark.success : AppColorsLight.success;

		final cards = <Widget>[];

		cards.add(Expanded(
			child: _buildSummaryCard(
				context,
				title: localizations.energy_consumption,
				value: NumberFormatUtils.defaultFormat.formatDecimal(
					summary.consumption,
					decimalPlaces: 2,
				),
				unit: localizations.energy_unit_kwh,
				icon: MdiIcons.flashOutline,
				color: infoColor,
			),
		));

		if (summary.hasProduction) {
			cards.add(Expanded(
				child: _buildSummaryCard(
					context,
					title: localizations.energy_production,
					value: NumberFormatUtils.defaultFormat.formatDecimal(
						summary.production!,
						decimalPlaces: 2,
					),
					unit: localizations.energy_unit_kwh,
					icon: MdiIcons.solarPower,
					color: successColor,
				),
			));
		}

		if (summary.hasProduction && summary.net != null) {
			final netColor = summary.net! > 0
				? (isDark ? AppColorsDark.warning : AppColorsLight.warning)
				: successColor;

			cards.add(Expanded(
				child: _buildSummaryCard(
					context,
					title: localizations.energy_net,
					value: NumberFormatUtils.defaultFormat.formatDecimal(
						summary.net!,
						decimalPlaces: 2,
					),
					unit: localizations.energy_unit_kwh,
					icon: MdiIcons.swapVertical,
					color: netColor,
				),
			));
		}

		return IntrinsicHeight(
			child: Row(
				crossAxisAlignment: CrossAxisAlignment.stretch,
				spacing: AppSpacings.pMd,
				children: cards,
			),
		);
	}

	Widget _buildSummaryCard(
		BuildContext context, {
		required String title,
		required String value,
		required String unit,
		required IconData icon,
		required Color color,
	}) {
		final isDark = Theme.of(context).brightness == Brightness.dark;

		return Container(
			padding: AppSpacings.paddingMd,
			decoration: BoxDecoration(
				color: isDark ? AppFillColorDark.light : AppFillColorLight.blank,
				borderRadius: BorderRadius.circular(AppBorderRadius.base),
				border: Border.all(
					color: isDark ? AppFillColorDark.light : AppBorderColorLight.darker,
					width: AppSpacings.scale(1),
				),
			),
			child: Column(
				crossAxisAlignment: CrossAxisAlignment.start,
				spacing: AppSpacings.pSm,
				children: [
					Row(
						spacing: AppSpacings.pSm,
						children: [
							Icon(icon, size: AppSpacings.scale(18), color: color),
							Expanded(
								child: Text(
									title,
									style: TextStyle(
										color: isDark
											? AppTextColorDark.secondary
											: AppTextColorLight.secondary,
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
						alignment: Alignment.centerLeft,
						child: RichText(
							maxLines: 1,
							text: TextSpan(
								children: [
									TextSpan(
										text: value,
										style: TextStyle(
											color: color,
											fontSize: AppSpacings.scale(28),
											fontWeight: FontWeight.w300,
										),
									),
									TextSpan(
										text: ' $unit',
										style: TextStyle(
											color: color,
											fontSize: AppFontSize.base,
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

	// ===========================================================================
	// TIMESERIES CHART
	// ===========================================================================

	Widget _buildTimeseriesChart(BuildContext context, EnergyTimeseries timeseries, EnergyRange selectedRange) {
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

		final barWidth = screenService.isSmallScreen
			? AppSpacings.scale(8)
			: AppSpacings.scale(12);

		return Column(
			crossAxisAlignment: CrossAxisAlignment.start,
			spacing: AppSpacings.pMd,
			children: [
				SectionTitle(
					icon: MdiIcons.chartBar,
					title: localizations.energy_chart_title,
				),
				Container(
					height: AppSpacings.scale(200),
					padding: AppSpacings.paddingMd,
					decoration: BoxDecoration(
						color: isDark ? AppFillColorDark.light : AppFillColorLight.blank,
						borderRadius: BorderRadius.circular(AppBorderRadius.base),
						border: Border.all(
							color: isDark ? AppFillColorDark.light : AppBorderColorLight.darker,
							width: AppSpacings.scale(1),
						),
					),
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
										horizontal: AppSpacings.pSm,
										vertical: AppSpacings.pXs,
									),
									getTooltipItem: (group, groupIndex, rod, rodIndex) {
										final value = NumberFormatUtils.defaultFormat.formatDecimal(
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
								topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
								rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
								leftTitles: AxisTitles(
									sideTitles: SideTitles(
										showTitles: true,
										reservedSize: AppSpacings.scale(40),
										getTitlesWidget: (value, meta) {
											return Text(
												NumberFormatUtils.defaultFormat.formatDecimal(
													value,
													decimalPlaces: 1,
												),
												style: TextStyle(
													fontSize: AppFontSize.extraSmall,
													color: isDark
														? AppTextColorDark.placeholder
														: AppTextColorLight.placeholder,
												),
											);
										},
									),
								),
								bottomTitles: AxisTitles(
									sideTitles: SideTitles(
										showTitles: true,
										getTitlesWidget: (value, meta) {
											final index = value.toInt();
											if (index < 0 || index >= points.length) {
												return const SizedBox.shrink();
											}
											final step = (points.length / 6).ceil().clamp(1, points.length);
											if (index % step != 0 && index != points.length - 1) {
												return const SizedBox.shrink();
											}
											final point = points[index];
											final hour = point.timestamp.hour.toString().padLeft(2, '0');
											String label;
											if (selectedRange == EnergyRange.month) {
												label = '${point.timestamp.day}';
											} else if (selectedRange == EnergyRange.week) {
												label = '${point.timestamp.day}/${point.timestamp.month} $hour:00';
											} else {
												label = '$hour:00';
											}
											return Padding(
												padding: EdgeInsets.only(top: AppSpacings.pXs),
												child: Text(
													label,
													style: TextStyle(
														fontSize: AppFontSize.extraSmall,
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
							_buildLegendItem(context, color: infoFamily.base, label: localizations.energy_consumption),
							_buildLegendItem(context, color: successFamily.base, label: localizations.energy_production),
						],
					),
			],
		);
	}

	Widget _buildLegendItem(BuildContext context, {required Color color, required String label}) {
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

	// ===========================================================================
	// TOP CONSUMERS
	// ===========================================================================

	Widget _buildTopConsumers(BuildContext context, EnergyBreakdown breakdown) {
		final localizations = AppLocalizations.of(context)!;
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final infoFamily = ThemeColorFamily.get(
			isDark ? Brightness.dark : Brightness.light,
			ThemeColors.info,
		);

		final devices = breakdown.devices;

		final maxConsumption = devices.isNotEmpty
			? devices.map((d) => d.consumption).reduce(max)
			: 1.0;

		return Column(
			crossAxisAlignment: CrossAxisAlignment.start,
			spacing: AppSpacings.pMd,
			children: [
				SectionTitle(
					icon: MdiIcons.formatListBulleted,
					title: localizations.energy_top_consumers,
					trailing: Text(
						localizations.energy_device_count(devices.length),
						style: TextStyle(
							color: isDark
								? AppTextColorDark.placeholder
								: AppTextColorLight.placeholder,
							fontSize: AppFontSize.extraSmall,
						),
					),
				),
				Container(
					decoration: BoxDecoration(
						color: isDark ? AppFillColorDark.light : AppFillColorLight.blank,
						borderRadius: BorderRadius.circular(AppBorderRadius.base),
						border: Border.all(
							color: isDark ? AppFillColorDark.light : AppBorderColorLight.darker,
							width: AppSpacings.scale(1),
						),
					),
					child: Column(
						children: List.generate(devices.length, (index) {
							final device = devices[index];
							final isLast = index == devices.length - 1;
							final ratio = maxConsumption > 0
								? device.consumption / maxConsumption
								: 0.0;

							return Container(
								padding: AppSpacings.paddingMd,
								decoration: !isLast
									? BoxDecoration(
											border: Border(
												bottom: BorderSide(
													color: isDark
														? AppFillColorDark.darker
														: AppBorderColorLight.base,
													width: AppSpacings.scale(1),
												),
											),
										)
									: null,
								child: Column(
									crossAxisAlignment: CrossAxisAlignment.start,
									spacing: AppSpacings.pSm,
									children: [
										Row(
											children: [
												Icon(
													MdiIcons.flashOutline,
													size: AppSpacings.scale(16),
													color: infoFamily.base,
												),
												AppSpacings.spacingSmHorizontal,
												Expanded(
													child: Text(
														device.deviceName,
														style: TextStyle(
															fontSize: AppFontSize.base,
															fontWeight: FontWeight.w500,
															color: isDark
																? AppTextColorDark.primary
																: AppTextColorLight.primary,
														),
														maxLines: 1,
														overflow: TextOverflow.ellipsis,
													),
												),
												Text(
													'${NumberFormatUtils.defaultFormat.formatDecimal(device.consumption, decimalPlaces: 2)} ${localizations.energy_unit_kwh}',
													style: TextStyle(
														fontSize: AppFontSize.base,
														fontWeight: FontWeight.w600,
														color: infoFamily.base,
													),
												),
											],
										),
										ClipRRect(
											borderRadius: BorderRadius.circular(AppSpacings.scale(2)),
											child: LinearProgressIndicator(
												value: ratio,
												minHeight: AppSpacings.scale(4),
												backgroundColor: isDark
													? AppFillColorDark.darker
													: AppBorderColorLight.base,
												valueColor: AlwaysStoppedAnimation<Color>(
													infoFamily.base.withValues(alpha: 0.6),
												),
											),
										),
										if (device.roomName != null)
											Text(
												device.roomName!,
												style: TextStyle(
													fontSize: AppFontSize.extraSmall,
													color: isDark
														? AppTextColorDark.placeholder
														: AppTextColorLight.placeholder,
												),
											),
									],
								),
							);
						}),
					),
				),
			],
		);
	}

	// ===========================================================================
	// LOADING / ERROR / EMPTY
	// ===========================================================================

	Widget _buildLoading(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final screenService = locator<ScreenService>();

		return Center(
			child: SizedBox(
				width: screenService.scale(20),
				height: screenService.scale(20),
				child: CircularProgressIndicator(
					strokeWidth: 2,
					color: isDark
						? AppTextColorDark.placeholder
						: AppTextColorLight.placeholder,
				),
			),
		);
	}

	Widget _buildError(BuildContext context, EnergyRepository repository) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final localizations = AppLocalizations.of(context)!;

		return Center(
			child: Column(
				mainAxisSize: MainAxisSize.min,
				spacing: AppSpacings.pMd,
				children: [
					Text(
						localizations.energy_load_failed,
						style: TextStyle(
							fontSize: AppFontSize.base,
							color: isDark
								? AppTextColorDark.secondary
								: AppTextColorLight.secondary,
						),
					),
					Theme(
						data: Theme.of(context).copyWith(
							filledButtonTheme: isDark
								? AppFilledButtonsDarkThemes.primary
								: AppFilledButtonsLightThemes.primary,
						),
						child: FilledButton.icon(
							onPressed: () => repository.fetchData(_homeSpaceId),
							style: FilledButton.styleFrom(
								padding: EdgeInsets.symmetric(
									horizontal: AppSpacings.scale(AppSpacings.pMd),
									vertical: AppSpacings.scale(AppSpacings.pSm),
								),
							),
							icon: Icon(
								MdiIcons.refresh,
								size: AppFontSize.small,
								color: isDark
									? AppFilledButtonsDarkThemes.primaryForegroundColor
									: AppFilledButtonsLightThemes.primaryForegroundColor,
							),
							label: Text(
								localizations.button_retry,
								style: TextStyle(
									fontSize: AppFontSize.small,
								),
							),
						),
					),
				],
			),
		);
	}

	Widget _buildEmptyState(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final localizations = AppLocalizations.of(context)!;
		final infoColor = isDark ? AppColorsDark.info : AppColorsLight.info;
		final infoBgColor = isDark ? AppColorsDark.infoLight9 : AppColorsLight.infoLight9;

		return Center(
			child: Padding(
				padding: AppSpacings.paddingXl,
				child: Column(
					mainAxisAlignment: MainAxisAlignment.center,
					spacing: AppSpacings.pMd,
					children: [
						Container(
							width: AppSpacings.scale(80),
							height: AppSpacings.scale(80),
							decoration: BoxDecoration(
								color: infoBgColor,
								shape: BoxShape.circle,
							),
							child: Icon(
								MdiIcons.flashOff,
								size: AppSpacings.scale(48),
								color: infoColor,
							),
						),
						Text(
							localizations.energy_empty_title,
							style: TextStyle(
								fontSize: AppFontSize.large,
								fontWeight: FontWeight.w600,
								color: isDark
									? AppTextColorDark.primary
									: AppTextColorLight.primary,
							),
							textAlign: TextAlign.center,
						),
						Text(
							localizations.energy_empty_description,
							style: TextStyle(
								fontSize: AppFontSize.base,
								color: isDark
									? AppTextColorDark.secondary
									: AppTextColorLight.secondary,
							),
							textAlign: TextAlign.center,
						),
					],
				),
			),
		);
	}
}
