import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/datetime.dart';
import 'package:fastybird_smart_panel/core/utils/number.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/utils/unit_converter.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
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
	const WeatherDetailPage({super.key});

	@override
	Widget build(BuildContext context) {
		final localizations = AppLocalizations.of(context)!;

		return Consumer<WeatherService>(builder: (
			context,
			weatherService,
			_,
		) {
			final currentDay = weatherService.currentDay;
			final forecast = weatherService.forecast;

			final bottomItems = <Widget>[
				// Weather detail cards (rain/snow)
				if (currentDay != null && _buildDetailCards(context, currentDay) != null)
					_buildDetailCards(context, currentDay)!,
				// Sunrise/sunset section
				if (currentDay != null)
					_buildSunTimesRow(context, currentDay),
				// Forecast section
				if (forecast.isNotEmpty)
					_buildForecastSection(context, forecast),
			];

			return Scaffold(
				body: Column(
					children: [
						PageHeader(
							title: localizations.weather_forecast_title,
							leading: HeaderIconButton(
								icon: Icons.arrow_back,
								onTap: () => Navigator.of(context).pop(),
							),
						),
						// Sky header (fixed)
						_buildSkyHeader(
							context,
							currentDay,
						),
						// Scrollable bottom content
						if (bottomItems.isNotEmpty)
							Expanded(
								child: VerticalScrollWithGradient(
									itemCount: bottomItems.length,
									separatorHeight: AppSpacings.pMd,
									padding: AppSpacings.paddingMd,
									itemBuilder: (context, index) => bottomItems[index],
								),
							),
					],
				),
			);
		});
	}

	// ===========================================================================
	// SKY HEADER
	// ===========================================================================

	Widget _buildSkyHeader(
		BuildContext context,
		CurrentDayView? currentDay,
	) {
		final localizations = AppLocalizations.of(context)!;
		final units = DisplayUnits.fromLocator();
		final screenService = locator<ScreenService>();
		final skyHeight = (screenService.logicalHeight * 0.4).clamp(0.0, AppSpacings.scale(500));

		final SkyVisualConfig config;
		if (currentDay != null) {
			final condition = mapWeatherCodeToSkyCondition(currentDay.weatherCode);
			final timeOfDay = resolveSkyTimeOfDay(DateTime.now(), currentDay.sunrise, currentDay.sunset);
			config = SkyVisualConfig.fromCondition(condition, timeOfDay);
		} else {
			config = SkyVisualConfig.defaultSky();
		}

		return SizedBox(
			height: skyHeight,
			child: ClipRect(
				child: Stack(
					fit: StackFit.expand,
					children: [
						SkyGradientBackground(
							gradientColors: config.gradientColors,
							isPortrait: true,
						),
						SkyCelestialElements(
							config: config,
							isPortrait: true,
						),
						SkyCloudsLayer(
							config: config,
							isPortrait: true,
						),
						SkyWeatherOverlays(config: config),
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
										// Temperature, condition, feels like
										if (currentDay != null)
											_buildSkyCenterContent(context, currentDay, units, config)
										else
											_buildSkyNoData(localizations, config),

										SizedBox(height: AppSpacings.pMd),

										// Glass tiles row
										if (currentDay != null)
											_buildSkyGlassTiles(context, currentDay, units, config),
									],
								),
							),
						),
					],
				),
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
				// Temperature — large, thin
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
				// Condition text
				Text(
					description,
					style: TextStyle(
						fontSize: AppFontSize.base,
						color: config.secondaryTextColor,
					),
					textAlign: TextAlign.center,
				),
				SizedBox(height: AppSpacings.pXxs),
				// Feels like
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

		return Row(
			mainAxisAlignment: MainAxisAlignment.center,
			children: [
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
				SizedBox(width: AppSpacings.pSm),
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
				SizedBox(width: AppSpacings.pSm),
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
				SizedBox(width: AppSpacings.pSm),
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
			],
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
	// DETAIL CARDS — remaining cards (clouds, rain, snow)
	// ===========================================================================

	Widget? _buildDetailCards(BuildContext context, CurrentDayView currentDay) {
		final units = DisplayUnits.fromLocator();
		final isDark = Theme.of(context).brightness == Brightness.dark;

		final cards = <Widget>[
			// Rain — only if provider reports rain data
			if (currentDay.rain != null)
				_buildPrecipitationCard(
					context,
					currentDay.rain!,
					AppLocalizations.of(context)!.weather_detail_rain,
					WeatherIcons.rain,
					units,
					isDark,
				),
			// Snow — only if provider reports snow data
			if (currentDay.snow != null)
				_buildPrecipitationCard(
					context,
					currentDay.snow!,
					AppLocalizations.of(context)!.weather_detail_snow,
					WeatherIcons.snow,
					units,
					isDark,
				),
		];

		if (cards.isEmpty) return null;

		if (cards.length == 1) {
			return cards.first;
		}

		return GridView.count(
			crossAxisCount: 2,
			childAspectRatio: 2.2,
			mainAxisSpacing: AppSpacings.pSm,
			crossAxisSpacing: AppSpacings.pSm,
			shrinkWrap: true,
			physics: const NeverScrollableScrollPhysics(),
			children: cards,
		);
	}

	Widget _buildDetailCard({
		required BuildContext context,
		required bool isDark,
		required IconData icon,
		required String label,
		required String value,
		required String unit,
		String? secondaryValue,
		String? secondaryLabel,
	}) {
		final colorFamily = ThemeColorFamily.get(
			Theme.of(context).brightness,
			ThemeColors.info,
		);

		return Container(
			padding: EdgeInsets.all(AppSpacings.pMd),
			decoration: BoxDecoration(
				color: isDark ? AppFillColorDark.light : AppFillColorLight.blank,
				borderRadius: BorderRadius.circular(AppBorderRadius.medium),
				border: Border.all(
					color: isDark
						? AppBorderColorDark.extraLight
						: AppBorderColorLight.lighter,
				),
			),
			child: Column(
				crossAxisAlignment: CrossAxisAlignment.start,
				mainAxisAlignment: MainAxisAlignment.spaceBetween,
				children: [
					Row(
						children: [
							Icon(
								icon,
								size: AppSpacings.scale(14),
								color: colorFamily.base,
							),
							SizedBox(width: AppSpacings.pSm),
							Text(
								label,
								style: TextStyle(
									fontSize: AppFontSize.extraSmall,
									fontWeight: FontWeight.w500,
									color: isDark
										? AppTextColorDark.secondary
										: AppTextColorLight.secondary,
								),
							),
						],
					),
					Row(
						crossAxisAlignment: CrossAxisAlignment.baseline,
						textBaseline: TextBaseline.alphabetic,
						children: [
							Text(
								value,
								style: TextStyle(
									fontSize: AppFontSize.base,
									fontWeight: FontWeight.w700,
									color: isDark
										? AppTextColorDark.primary
										: AppTextColorLight.primary,
								),
							),
							SizedBox(width: AppSpacings.pXs),
							Text(
								unit,
								style: TextStyle(
									fontSize: AppSpacings.scale(8),
									color: isDark
										? AppTextColorDark.secondary
										: AppTextColorLight.secondary,
								),
							),
							if (secondaryValue != null && secondaryLabel != null) ...[
								const Spacer(),
								Text(
									'$secondaryLabel $secondaryValue',
									style: TextStyle(
										fontSize: AppSpacings.scale(8),
										color: isDark
											? AppTextColorDark.placeholder
											: AppTextColorLight.placeholder,
									),
								),
							],
						],
					),
				],
			),
		);
	}

	Widget _buildPrecipitationCard(
		BuildContext context,
		double amount,
		String label,
		IconData icon,
		DisplayUnits units,
		bool isDark,
	) {
		final precipSymbol = UnitConverter.precipitationSymbol(units.precipitation);

		final precipValue = NumberUtils.formatNumber(
			UnitConverter.convertPrecipitation(amount, units.precipitation),
			1,
		);

		return _buildDetailCard(
			context: context,
			isDark: isDark,
			icon: icon,
			label: label,
			value: precipValue,
			unit: precipSymbol,
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
				borderRadius: BorderRadius.circular(AppBorderRadius.medium),
				border: Border.all(
					color: isDark
						? AppBorderColorDark.extraLight
						: AppBorderColorLight.lighter,
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
							? AppBorderColorDark.extraLight
							: AppBorderColorLight.lighter,
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

	// ===========================================================================
	// FORECAST SECTION
	// ===========================================================================

	Widget _buildForecastSection(
		BuildContext context,
		List<ForecastDayView> forecast,
	) {
		final localizations = AppLocalizations.of(context)!;
		final isDark = Theme.of(context).brightness == Brightness.dark;

		return Column(
			crossAxisAlignment: CrossAxisAlignment.start,
			children: [
				Text(
					localizations.weather_detail_forecast,
					style: TextStyle(
						fontSize: AppFontSize.small,
						fontWeight: FontWeight.w600,
						color: isDark
							? AppTextColorDark.regular
							: AppTextColorLight.regular,
					),
				),
				SizedBox(height: AppSpacings.pSm),
				...forecast.map((day) => _buildForecastDay(context, day)),
			],
		);
	}

	Widget _buildForecastDay(BuildContext context, ForecastDayView forecast) {
		final units = DisplayUnits.fromLocator();
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final tempSymbol = UnitConverter.temperatureSymbol(units.temperature);

		final dayTemp = forecast.temperatureDay ?? forecast.temperatureMorn;
		final nightTemp = forecast.temperatureNight ?? forecast.temperatureEve;

		final wholeDayTemp = dayTemp != null
			? NumberUtils.formatNumber(
				UnitConverter.convertTemperature(
					forecast.toCelsius(dayTemp),
					units.temperature,
				),
				0,
			)
			: NumberUtils.formatUnavailableNumber(0);

		final wholeNightTemp = nightTemp != null
			? NumberUtils.formatNumber(
				UnitConverter.convertTemperature(
					forecast.toCelsius(nightTemp),
					units.temperature,
				),
				0,
			)
			: NumberUtils.formatUnavailableNumber(0);

		return Container(
			padding: EdgeInsets.symmetric(
				horizontal: AppSpacings.pMd,
				vertical: AppSpacings.pSm,
			),
			decoration: BoxDecoration(
				border: Border(
					bottom: BorderSide(
						color: isDark
							? AppBorderColorDark.extraLight
							: AppBorderColorLight.lighter,
						width: 0.5,
					),
				),
			),
			child: Row(
				children: [
					// Day name
					SizedBox(
						width: AppSpacings.scale(72),
						child: Text(
							DatetimeUtils.getShortDayName(forecast.dayTime),
							style: TextStyle(
								fontSize: AppFontSize.extraSmall,
								fontWeight: FontWeight.w600,
								color: isDark
									? AppTextColorDark.primary
									: AppTextColorLight.primary,
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

					SizedBox(width: AppSpacings.pMd),

					// Condition text
					Expanded(
						child: Text(
							forecast.weatherMain,
							style: TextStyle(
								fontSize: AppSpacings.scale(9),
								color: isDark
									? AppTextColorDark.secondary
									: AppTextColorLight.secondary,
							),
							overflow: TextOverflow.ellipsis,
						),
					),

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

					SizedBox(width: AppSpacings.pMd),

					// Temperature range
					SizedBox(
						width: AppSpacings.scale(68),
						child: Row(
							mainAxisAlignment: MainAxisAlignment.end,
							crossAxisAlignment: CrossAxisAlignment.baseline,
							textBaseline: TextBaseline.alphabetic,
							children: [
								Text(
									wholeNightTemp,
									style: TextStyle(
										fontSize: AppSpacings.scale(9),
										color: isDark
											? AppTextColorDark.secondary
											: AppTextColorLight.secondary,
									),
								),
								Text(
									' / ',
									style: TextStyle(
										fontSize: AppSpacings.scale(8),
										color: isDark
											? AppTextColorDark.placeholder
											: AppTextColorLight.placeholder,
									),
								),
								Text(
									wholeDayTemp,
									style: TextStyle(
										fontSize: AppSpacings.scale(10),
										fontWeight: FontWeight.w600,
										color: isDark
											? AppTextColorDark.primary
											: AppTextColorLight.primary,
									),
								),
								Text(
									tempSymbol,
									style: TextStyle(
										fontSize: AppSpacings.scale(8),
										color: isDark
											? AppTextColorDark.secondary
											: AppTextColorLight.secondary,
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
