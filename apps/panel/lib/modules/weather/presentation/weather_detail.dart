import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/datetime.dart';
import 'package:fastybird_smart_panel/core/utils/number.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/utils/unit_converter.dart';
import 'package:fastybird_smart_panel/core/widgets/vertical_scroll_with_gradient.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/sky/sky_celestial_elements.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/sky/sky_clouds_layer.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/sky/sky_glass_card.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/sky/sky_gradient_background.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/sky/sky_weather_overlays.dart';
import 'package:fastybird_smart_panel/modules/deck/types/sky_condition.dart';
import 'package:fastybird_smart_panel/modules/weather/export.dart';
import 'package:fastybird_smart_panel/modules/weather/utils/openweather.dart';
import 'package:fastybird_smart_panel/modules/weather/views/current_day.dart';
import 'package:fastybird_smart_panel/modules/weather/views/forecast_day.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:weather_icons/weather_icons.dart';

class WeatherDetailPage extends StatelessWidget {
	/// Optional weather location ID. When null, uses the primary location.
	final String? locationId;

	const WeatherDetailPage({super.key, this.locationId});

	@override
	Widget build(BuildContext context) {
		return Consumer<WeatherService>(builder: (
			context,
			weatherService,
			_,
		) {
			final currentDay = weatherService.getCurrentDayByLocation(locationId);
			final forecast = weatherService.getForecastByLocation(locationId);
			final isLandscape = MediaQuery.of(context).size.width > MediaQuery.of(context).size.height;

			final SkyVisualConfig config;
			if (currentDay != null) {
				final condition = mapWeatherCodeToSkyCondition(currentDay.weatherCode);
				final timeOfDay = resolveSkyTimeOfDay(DateTime.now(), currentDay.sunrise, currentDay.sunset);
				config = SkyVisualConfig.fromCondition(condition, timeOfDay);
			} else {
				final hour = DateTime.now().hour;
				final timeOfDay = (hour >= 6 && hour < 11)
						? SkyTimeOfDay.morning
						: (hour >= 11 && hour < 17)
								? SkyTimeOfDay.noon
								: (hour >= 17 && hour < 21)
										? SkyTimeOfDay.evening
										: SkyTimeOfDay.night;
				config = SkyVisualConfig.fromCondition(SkyCondition.clear, timeOfDay);
			}

			if (isLandscape) {
				return Scaffold(
					body: Row(
						children: [
							// Sky left panel (44%)
							SizedBox(
								width: MediaQuery.of(context).size.width * 0.44,
								child: _buildSkyPanel(context, currentDay, config, isPortrait: false),
							),
							// Content right panel (56%)
							Expanded(
								child: _buildContentArea(context, currentDay, forecast),
							),
						],
					),
				);
			}

			// Portrait layout
			final screenService = locator<ScreenService>();
			final skyHeight = (screenService.logicalHeight * 0.4).clamp(0.0, AppSpacings.scale(500));

			return Scaffold(
				body: Column(
					children: [
						SizedBox(
							height: skyHeight,
							child: _buildSkyPanel(context, currentDay, config, isPortrait: true),
						),
						Expanded(
							child: _buildContentArea(context, currentDay, forecast),
						),
					],
				),
			);
		});
	}

	// ===========================================================================
	// SKY PANEL
	// ===========================================================================

	Widget _buildSkyPanel(
		BuildContext context,
		CurrentDayView? currentDay,
		SkyVisualConfig config, {
		required bool isPortrait,
	}) {
		final localizations = AppLocalizations.of(context)!;
		final units = DisplayUnits.fromLocator();

		return ClipRect(
			child: Stack(
				fit: StackFit.expand,
				children: [
					SkyGradientBackground(
						gradientColors: config.gradientColors,
						isPortrait: isPortrait,
					),
					SkyCelestialElements(
						config: config,
						isPortrait: isPortrait,
					),
					SkyCloudsLayer(
						config: config,
						isPortrait: isPortrait,
					),
					SkyWeatherOverlays(config: config),
					// Glass back button
					Positioned(
						top: MediaQuery.of(context).padding.top + AppSpacings.pMd,
						left: AppSpacings.pMd,
						child: GestureDetector(
							onTap: () => Navigator.of(context).pop(),
							child: SkyGlassCard(
								isDark: config.isDark,
								padding: EdgeInsets.zero,
								child: SizedBox(
									width: AppSpacings.scale(36),
									height: AppSpacings.scale(36),
									child: Icon(
										Icons.arrow_back,
										size: AppSpacings.scale(18),
										color: config.primaryTextColor,
									),
								),
							),
						),
					),
					Positioned.fill(
						child: Padding(
							padding: EdgeInsets.symmetric(
								horizontal: AppSpacings.pLg,
								vertical: AppSpacings.pMd,
							),
							child: Column(
								crossAxisAlignment: CrossAxisAlignment.center,
								mainAxisAlignment: MainAxisAlignment.center,
								children: [
									if (currentDay != null)
										_buildSkyCenterContent(context, currentDay, units, config)
									else
										_buildSkyNoData(localizations, config),
									SizedBox(height: AppSpacings.pMd),
									if (currentDay != null)
										_buildSkyGlassTiles(context, currentDay, units, config),
								],
							),
						),
					),
				],
			),
		);
	}

	Widget _buildSkyCenterContent(
		BuildContext context,
		CurrentDayView currentDay,
		DisplayUnits units,
		SkyVisualConfig config,
	) {
		final tempSymbol = UnitConverter.temperatureSymbol(units.temperature);

		final currentTemperature = NumberUtils.formatNumber(
			UnitConverter.convertTemperature(
				currentDay.toCelsius(currentDay.temperature),
				units.temperature,
			),
			0,
		);

		final feelsLikeTemperature = NumberUtils.formatNumber(
			UnitConverter.convertTemperature(
				currentDay.toCelsius(currentDay.feelsLike),
				units.temperature,
			),
			0,
		);

		final description = WeatherConditionMapper.getDescription(
			currentDay.weatherCode,
			context,
		);

		return Column(
			mainAxisSize: MainAxisSize.min,
			children: [
				Row(
					mainAxisAlignment: MainAxisAlignment.center,
					crossAxisAlignment: CrossAxisAlignment.start,
					children: [
						Text(
							currentTemperature,
							style: TextStyle(
								fontSize: AppSpacings.scale(56),
								fontWeight: FontWeight.w100,
								color: config.primaryTextColor,
								height: 1.0,
								letterSpacing: -1.5,
							),
						),
						Padding(
							padding: EdgeInsets.only(top: AppSpacings.pSm),
							child: Text(
								tempSymbol,
								style: TextStyle(
									fontSize: AppFontSize.large,
									fontWeight: FontWeight.w100,
									color: config.secondaryTextColor,
								),
							),
						),
					],
				),
				SizedBox(height: AppSpacings.pXs),
				Text(
					description,
					style: TextStyle(
						fontSize: AppFontSize.base,
						color: config.secondaryTextColor,
					),
					textAlign: TextAlign.center,
				),
				SizedBox(height: AppSpacings.pXxs),
				Text(
					'${AppLocalizations.of(context)!.weather_forecast_feels_like} $feelsLikeTemperature$tempSymbol',
					style: TextStyle(
						fontSize: AppFontSize.extraSmall,
						color: config.secondaryTextColor,
					),
				),
			],
		);
	}

	Widget _buildSkyGlassTiles(
		BuildContext context,
		CurrentDayView currentDay,
		DisplayUnits units,
		SkyVisualConfig config,
	) {
		final windSymbol = UnitConverter.windSpeedSymbol(units.windSpeed);
		final pressSymbol = UnitConverter.pressureSymbol(units.pressure);
		final pressDecimals = UnitConverter.pressureDecimals(units.pressure);

		final windSpeed = NumberUtils.formatNumber(
			UnitConverter.convertWindSpeed(
				currentDay.toMetersPerSecond(currentDay.windSpeed),
				units.windSpeed,
			),
			1,
		);

		final pressureText = NumberUtils.formatNumber(
			UnitConverter.convertPressure(
				currentDay.pressure.toDouble(),
				units.pressure,
			),
			pressDecimals,
		);

		final tiles = [
			SkyGlassCard(
				isDark: config.isDark,
				child: Row(
					mainAxisSize: MainAxisSize.min,
					children: [
						BoxedIcon(
							WeatherIcons.strong_wind,
							size: AppSpacings.scale(12),
							color: config.secondaryTextColor,
						),
						SizedBox(width: AppSpacings.pXs),
						Text(
							'$windSpeed $windSymbol',
							style: TextStyle(
								fontSize: AppFontSize.extraSmall,
								fontWeight: FontWeight.w600,
								color: config.primaryTextColor,
							),
						),
					],
				),
			),
			SkyGlassCard(
				isDark: config.isDark,
				child: Row(
					mainAxisSize: MainAxisSize.min,
					children: [
						BoxedIcon(
							WeatherIcons.humidity,
							size: AppSpacings.scale(12),
							color: config.secondaryTextColor,
						),
						SizedBox(width: AppSpacings.pXs),
						Text(
							'${currentDay.humidity}%',
							style: TextStyle(
								fontSize: AppFontSize.extraSmall,
								fontWeight: FontWeight.w600,
								color: config.primaryTextColor,
							),
						),
					],
				),
			),
			SkyGlassCard(
				isDark: config.isDark,
				child: Row(
					mainAxisSize: MainAxisSize.min,
					children: [
						BoxedIcon(
							WeatherIcons.barometer,
							size: AppSpacings.scale(12),
							color: config.secondaryTextColor,
						),
						SizedBox(width: AppSpacings.pXs),
						Text(
							'$pressureText $pressSymbol',
							style: TextStyle(
								fontSize: AppFontSize.extraSmall,
								fontWeight: FontWeight.w600,
								color: config.primaryTextColor,
							),
						),
					],
				),
			),
			SkyGlassCard(
				isDark: config.isDark,
				child: Row(
					mainAxisSize: MainAxisSize.min,
					children: [
						BoxedIcon(
							WeatherIcons.cloud,
							size: AppSpacings.scale(12),
							color: config.secondaryTextColor,
						),
						SizedBox(width: AppSpacings.pXs),
						Text(
							'${currentDay.clouds.round()}%',
							style: TextStyle(
								fontSize: AppFontSize.extraSmall,
								fontWeight: FontWeight.w600,
								color: config.primaryTextColor,
							),
						),
					],
				),
			),
		];

		return _GlassTilesRow(
			tiles: tiles,
			separator: AppSpacings.pSm,
			height: AppSpacings.scale(36),
			gradientColor: config.gradientColors[config.gradientColors.length ~/ 2],
		);
	}

	Widget _buildSkyNoData(AppLocalizations localizations, SkyVisualConfig config) {
		return Text(
			localizations.weather_detail_not_configured,
			style: TextStyle(
				fontSize: AppFontSize.base,
				color: config.secondaryTextColor,
			),
		);
	}

	// ===========================================================================
	// CONTENT AREA — shared between portrait and landscape
	// ===========================================================================

	Widget _buildContentArea(
		BuildContext context,
		CurrentDayView? currentDay,
		List<ForecastDayView> forecast,
	) {
		final localizations = AppLocalizations.of(context)!;
		final isDark = Theme.of(context).brightness == Brightness.dark;

		// Pre-compute week min/max once for all forecast rows
		final units = DisplayUnits.fromLocator();
		double weekMin = double.infinity;
		double weekMax = double.negativeInfinity;
		for (final day in forecast) {
			final min = day.temperatureMin;
			final max = day.temperatureMax;
			if (min != null) {
				final converted = UnitConverter.convertTemperature(day.toCelsius(min), units.temperature);
				if (converted < weekMin) weekMin = converted;
			}
			if (max != null) {
				final converted = UnitConverter.convertTemperature(day.toCelsius(max), units.temperature);
				if (converted > weekMax) weekMax = converted;
			}
		}

		final contentItems = <Widget>[
			// Forecast section
			if (forecast.isNotEmpty) ...[
				_buildSectionTitle(localizations.weather_detail_forecast, isDark),
				...forecast.map((day) => Padding(
					padding: EdgeInsets.only(bottom: AppSpacings.pSm),
					child: _buildForecastDay(context, day, units, weekMin, weekMax),
				)),
			],
			// Sunrise/sunset
			if (currentDay != null) ...[
				SizedBox(height: AppSpacings.pMd),
				_buildSunTimesRow(context, currentDay),
			],
		];

		if (contentItems.isEmpty) return const SizedBox.shrink();

		return VerticalScrollWithGradient(
			itemCount: contentItems.length,
			separatorHeight: 0,
			padding: AppSpacings.paddingMd,
			itemBuilder: (context, index) => contentItems[index],
		);
	}

	// ===========================================================================
	// SECTION TITLE
	// ===========================================================================

	Widget _buildSectionTitle(String title, bool isDark) {
		return Padding(
			padding: EdgeInsets.only(bottom: AppSpacings.pSm),
			child: Text(
				title.toUpperCase(),
				style: TextStyle(
					fontSize: AppFontSize.extraSmall,
					fontWeight: FontWeight.w700,
					letterSpacing: 1.2,
					color: isDark
						? AppTextColorDark.placeholder
						: AppTextColorLight.placeholder,
				),
			),
		);
	}

	// ===========================================================================
	// DAILY FORECAST WITH TEMP BAR
	// ===========================================================================

	Widget _buildForecastDay(
		BuildContext context,
		ForecastDayView forecast,
		DisplayUnits units,
		double weekMin,
		double weekMax,
	) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final localizations = AppLocalizations.of(context)!;
		final tempSymbol = UnitConverter.temperatureSymbol(units.temperature);

		final dayMin = forecast.temperatureMin != null
			? UnitConverter.convertTemperature(forecast.toCelsius(forecast.temperatureMin!), units.temperature)
			: null;
		final dayMax = forecast.temperatureMax != null
			? UnitConverter.convertTemperature(forecast.toCelsius(forecast.temperatureMax!), units.temperature)
			: null;

		final lowText = dayMin != null ? NumberUtils.formatNumber(dayMin, 0) : '--';
		final highText = dayMax != null ? NumberUtils.formatNumber(dayMax, 0) : '--';

		// Check if today
		final now = DateTime.now();
		final isToday = forecast.dayTime.year == now.year &&
			forecast.dayTime.month == now.month &&
			forecast.dayTime.day == now.day;

		final accentColor = ThemeColorFamily.get(
			Theme.of(context).brightness,
			ThemeColors.danger,
		).base;

		final infoColor = ThemeColorFamily.get(
			Theme.of(context).brightness,
			ThemeColors.info,
		).base;

		final borderRadius = BorderRadius.circular(AppBorderRadius.base);
		final borderColor = isDark ? AppFillColorDark.light : AppBorderColorLight.darker;

		return ClipRRect(
			borderRadius: borderRadius,
			child: Container(
				padding: EdgeInsets.symmetric(
					horizontal: AppSpacings.pMd,
					vertical: AppSpacings.pSm,
				),
				decoration: BoxDecoration(
					color: isDark ? AppFillColorDark.light : AppFillColorLight.blank,
					borderRadius: borderRadius,
					border: Border.all(color: borderColor),
				),
				foregroundDecoration: isToday
					? BoxDecoration(
						borderRadius: borderRadius,
						border: Border(
							left: BorderSide(
								color: accentColor,
								width: AppSpacings.scale(3),
							),
						),
					)
					: null,
				child: Row(
				children: [
					// Day name
					SizedBox(
						width: AppSpacings.scale(50),
						child: Text(
							isToday
								? localizations.weather_detail_today
								: DatetimeUtils.getShortDayName(forecast.dayTime),
							style: TextStyle(
								fontSize: AppFontSize.extraSmall,
								fontWeight: isToday ? FontWeight.w700 : FontWeight.w600,
								color: isToday
									? accentColor
									: (isDark ? AppTextColorDark.primary : AppTextColorLight.primary),
							),
						),
					),

					// Date (small)
					SizedBox(
						width: AppSpacings.scale(32),
						child: Text(
							'${forecast.dayTime.day}.${forecast.dayTime.month}.',
							style: TextStyle(
								fontSize: AppSpacings.scale(8),
								color: isDark
									? AppTextColorDark.placeholder
									: AppTextColorLight.placeholder,
							),
						),
					),

					// Weather icon
					BoxedIcon(
						WeatherConditionMapper.getIcon(forecast.weatherCode),
						size: AppSpacings.scale(16),
						color: isDark
							? AppTextColorDark.regular
							: AppTextColorLight.regular,
					),

					SizedBox(width: AppSpacings.pSm),

					// Condition text
					Expanded(
						child: Text(
							WeatherConditionMapper.getDescription(forecast.weatherCode, context),
							style: TextStyle(
								fontSize: AppSpacings.scale(9),
								color: isDark
									? AppTextColorDark.secondary
									: AppTextColorLight.secondary,
							),
							overflow: TextOverflow.ellipsis,
						),
					),

					SizedBox(width: AppSpacings.pSm),

					// Low temp
					Text(
						'$lowText$tempSymbol',
						style: TextStyle(
							fontSize: AppSpacings.scale(9),
							color: isDark
								? AppTextColorDark.secondary
								: AppTextColorLight.secondary,
						),
					),

					SizedBox(width: AppSpacings.pSm),

					// Gradient temp bar
					SizedBox(
						width: AppSpacings.scale(56),
						height: AppSpacings.scale(4),
						child: _buildTempBar(dayMin, dayMax, weekMin, weekMax, infoColor, accentColor, isDark),
					),

					SizedBox(width: AppSpacings.pSm),

					// High temp
					Text(
						'$highText$tempSymbol',
						style: TextStyle(
							fontSize: AppSpacings.scale(9),
							fontWeight: FontWeight.w600,
							color: isDark
								? AppTextColorDark.primary
								: AppTextColorLight.primary,
						),
					),

					SizedBox(width: AppSpacings.pMd),

					// Humidity
					Row(
						mainAxisSize: MainAxisSize.min,
						children: [
							Icon(
								WeatherIcons.humidity,
								size: AppSpacings.scale(10),
								color: isDark
									? AppTextColorDark.placeholder
									: AppTextColorLight.placeholder,
							),
							SizedBox(width: AppSpacings.pXxs),
							Text(
								'${forecast.humidity}%',
								style: TextStyle(
									fontSize: AppSpacings.scale(8),
									color: isDark
										? AppTextColorDark.placeholder
										: AppTextColorLight.placeholder,
								),
							),
						],
					),
				],
			),
		));
	}

	Widget _buildTempBar(
		double? dayMin,
		double? dayMax,
		double weekMin,
		double weekMax,
		Color coolColor,
		Color warmColor,
		bool isDark,
	) {
		if (dayMin == null || dayMax == null || weekMax <= weekMin) {
			return Container(
				decoration: BoxDecoration(
					color: isDark ? AppFillColorDark.lighter : AppFillColorLight.light,
					borderRadius: BorderRadius.circular(AppSpacings.scale(2)),
				),
			);
		}

		final range = weekMax - weekMin;
		final startFraction = ((dayMin - weekMin) / range).clamp(0.0, 1.0);
		final endFraction = ((dayMax - weekMin) / range).clamp(0.0, 1.0);

		return LayoutBuilder(
			builder: (context, constraints) {
				final totalWidth = constraints.maxWidth;
				final barLeft = startFraction * totalWidth;
				final barRight = endFraction * totalWidth;
				final barWidth = (barRight - barLeft).clamp(2.0, totalWidth);

				return Stack(
					children: [
						// Background track
						Container(
							decoration: BoxDecoration(
								color: isDark ? AppFillColorDark.lighter : AppFillColorLight.light,
								borderRadius: BorderRadius.circular(AppSpacings.scale(2)),
							),
						),
						// Gradient bar
						Positioned(
							left: barLeft,
							width: barWidth,
							top: 0,
							bottom: 0,
							child: Container(
								decoration: BoxDecoration(
									gradient: LinearGradient(
										colors: [coolColor, warmColor],
									),
									borderRadius: BorderRadius.circular(AppSpacings.scale(2)),
								),
							),
						),
					],
				);
			},
		);
	}

	// ===========================================================================
	// SUNRISE / SUNSET ROW
	// ===========================================================================

	Widget _buildSunTimesRow(BuildContext context, CurrentDayView currentDay) {
		final localizations = AppLocalizations.of(context)!;
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final colorFamily = ThemeColorFamily.get(
			Theme.of(context).brightness,
			ThemeColors.warning,
		);

		return Container(
			padding: EdgeInsets.symmetric(
				horizontal: AppSpacings.pLg,
				vertical: AppSpacings.pMd,
			),
			decoration: BoxDecoration(
				color: isDark ? AppFillColorDark.light : AppFillColorLight.blank,
				borderRadius: BorderRadius.circular(AppBorderRadius.base),
				border: Border.all(
					color: isDark
						? AppFillColorDark.light
						: AppBorderColorLight.darker,
				),
			),
			child: Row(
				children: [
					// Sunrise
					Expanded(
						child: Row(
							children: [
								Icon(
									WeatherIcons.sunrise,
									size: AppSpacings.scale(16),
									color: colorFamily.base,
								),
								SizedBox(width: AppSpacings.pMd),
								Column(
									crossAxisAlignment: CrossAxisAlignment.start,
									mainAxisSize: MainAxisSize.min,
									children: [
										Text(
											localizations.weather_detail_sunrise,
											style: TextStyle(
												fontSize: AppSpacings.scale(8),
												color: isDark
													? AppTextColorDark.secondary
													: AppTextColorLight.secondary,
											),
										),
										Text(
											DatetimeUtils.getFormattedTime(currentDay.sunrise),
											style: TextStyle(
												fontSize: AppFontSize.small,
												fontWeight: FontWeight.w600,
												color: isDark
													? AppTextColorDark.primary
													: AppTextColorLight.primary,
											),
										),
									],
								),
							],
						),
					),
					// Divider
					Container(
						width: 1,
						height: AppSpacings.scale(28),
						color: isDark
							? AppFillColorDark.light
							: AppBorderColorLight.darker,
					),
					// Sunset
					Expanded(
						child: Row(
							mainAxisAlignment: MainAxisAlignment.end,
							children: [
								Column(
									crossAxisAlignment: CrossAxisAlignment.end,
									mainAxisSize: MainAxisSize.min,
									children: [
										Text(
											localizations.weather_detail_sunset,
											style: TextStyle(
												fontSize: AppSpacings.scale(8),
												color: isDark
													? AppTextColorDark.secondary
													: AppTextColorLight.secondary,
											),
										),
										Text(
											DatetimeUtils.getFormattedTime(currentDay.sunset),
											style: TextStyle(
												fontSize: AppFontSize.small,
												fontWeight: FontWeight.w600,
												color: isDark
													? AppTextColorDark.primary
													: AppTextColorLight.primary,
											),
										),
									],
								),
								SizedBox(width: AppSpacings.pMd),
								Icon(
									WeatherIcons.sunset,
									size: AppSpacings.scale(16),
									color: colorFamily.base,
								),
							],
						),
					),
				],
			),
		);
	}

}

/// Displays glass tiles centered when they fit, or in a horizontal scroll
/// with gradient edge overlays when they overflow.
class _GlassTilesRow extends StatefulWidget {
	final List<Widget> tiles;
	final double separator;
	final double height;
	final Color gradientColor;

	const _GlassTilesRow({
		required this.tiles,
		required this.separator,
		required this.height,
		required this.gradientColor,
	});

	@override
	State<_GlassTilesRow> createState() => _GlassTilesRowState();
}

class _GlassTilesRowState extends State<_GlassTilesRow> {
	final _scrollController = ScrollController();
	bool _showLeft = false;
	bool _showRight = false;

	@override
	void initState() {
		super.initState();
		_scrollController.addListener(_updateGradients);
		WidgetsBinding.instance.addPostFrameCallback((_) => _updateGradients());
	}

	@override
	void didUpdateWidget(_GlassTilesRow oldWidget) {
		super.didUpdateWidget(oldWidget);
		WidgetsBinding.instance.addPostFrameCallback((_) => _updateGradients());
	}

	@override
	void dispose() {
		_scrollController.removeListener(_updateGradients);
		_scrollController.dispose();
		super.dispose();
	}

	void _updateGradients() {
		if (!mounted || !_scrollController.hasClients) return;
		final pos = _scrollController.position;
		final showLeft = pos.pixels > 0;
		final showRight = pos.pixels < pos.maxScrollExtent;

		if (showLeft != _showLeft || showRight != _showRight) {
			setState(() {
				_showLeft = showLeft;
				_showRight = showRight;
			});
		}
	}

	@override
	Widget build(BuildContext context) {
		final gradientWidth = AppSpacings.pLg;

		return SizedBox(
			height: widget.height,
			child: LayoutBuilder(
				builder: (context, constraints) {
					return Stack(
						children: [
							SingleChildScrollView(
								controller: _scrollController,
								scrollDirection: Axis.horizontal,
								child: ConstrainedBox(
									constraints: BoxConstraints(minWidth: constraints.maxWidth),
									child: Row(
										mainAxisSize: MainAxisSize.min,
										mainAxisAlignment: MainAxisAlignment.center,
										children: [
											for (var i = 0; i < widget.tiles.length; i++) ...[
												if (i > 0) SizedBox(width: widget.separator),
												widget.tiles[i],
											],
										],
									),
								),
							),
							// Left gradient
							Positioned(
								left: 0,
								top: 0,
								bottom: 0,
								width: gradientWidth,
								child: IgnorePointer(
									child: AnimatedOpacity(
										opacity: _showLeft ? 1.0 : 0.0,
										duration: const Duration(milliseconds: 200),
										child: Container(
											decoration: BoxDecoration(
												gradient: LinearGradient(
													begin: Alignment.centerLeft,
													end: Alignment.centerRight,
													colors: [
														widget.gradientColor,
														widget.gradientColor.withValues(alpha: 0),
													],
												),
											),
										),
									),
								),
							),
							// Right gradient
							Positioned(
								right: 0,
								top: 0,
								bottom: 0,
								width: gradientWidth,
								child: IgnorePointer(
									child: AnimatedOpacity(
										opacity: _showRight ? 1.0 : 0.0,
										duration: const Duration(milliseconds: 200),
										child: Container(
											decoration: BoxDecoration(
												gradient: LinearGradient(
													begin: Alignment.centerRight,
													end: Alignment.centerLeft,
													colors: [
														widget.gradientColor,
														widget.gradientColor.withValues(alpha: 0),
													],
												),
											),
										),
									),
								),
							),
						],
					);
				},
			),
		);
	}
}
