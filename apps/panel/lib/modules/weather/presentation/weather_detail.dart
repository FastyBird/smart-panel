import 'dart:ui';

import 'package:fastybird_smart_panel/core/utils/datetime.dart';
import 'package:fastybird_smart_panel/core/utils/number.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/utils/unit_converter.dart';
import 'package:fastybird_smart_panel/core/widgets/sky/sky_panel.dart';
import 'package:fastybird_smart_panel/core/widgets/sky/sky_condition.dart';
import 'package:fastybird_smart_panel/core/widgets/top_bar.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/weather/export.dart';
import 'package:fastybird_smart_panel/modules/weather/utils/openweather.dart';
import 'package:fastybird_smart_panel/modules/weather/utils/sky_mapper.dart';
import 'package:fastybird_smart_panel/modules/weather/views/current_day.dart';
import 'package:fastybird_smart_panel/modules/weather/views/forecast_day.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
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
			final locations = weatherService.locations;
			final selectedLocation = weatherService.selectedLocation;
			final hasMultipleLocations = weatherService.hasMultipleLocations;

			return Scaffold(
				appBar: AppTopBar(
					title: localizations.weather_forecast_title,
				),
				body: SingleChildScrollView(
					child: Column(
						crossAxisAlignment: CrossAxisAlignment.start,
						children: [
							// Sky header with current weather overlay
							_buildSkyHeader(
								context,
								currentDay,
								hasMultipleLocations,
								locations,
								selectedLocation,
								weatherService,
							),

							// Detail sections
							Padding(
								padding: AppSpacings.paddingMd,
								child: Column(
									crossAxisAlignment: CrossAxisAlignment.start,
									children: [
										// Weather detail cards
										if (currentDay != null) ...[
											SizedBox(height: AppSpacings.pSm),
											_buildDetailCards(context, currentDay),
										],

										// Sunrise/sunset section
										if (currentDay != null) ...[
											SizedBox(height: AppSpacings.pMd),
											_buildSunTimesRow(context, currentDay),
										],

										// Forecast section
										if (forecast.isNotEmpty) ...[
											SizedBox(height: AppSpacings.pLg),
											_buildForecastSection(context, forecast),
										],
									],
								),
							),
						],
					),
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
		bool hasMultipleLocations,
		List<WeatherLocationModel> locations,
		WeatherLocationModel? selectedLocation,
		WeatherService weatherService,
	) {
		final localizations = AppLocalizations.of(context)!;
		final units = DisplayUnits.fromLocator();
		final isNight = currentDay != null
			? _isNightTime(currentDay.sunrise, currentDay.sunset)
			: false;
		final skyCondition = currentDay != null
			? WeatherSkyMapper.fromWeatherCode(currentDay.weatherCode)
			: SkyCondition.clear;

		return SizedBox(
			height: AppSpacings.scale(160),
			child: SkyPanel(
				condition: skyCondition,
				isNight: isNight,
				child: Padding(
					padding: EdgeInsets.symmetric(
						horizontal: AppSpacings.pLg,
						vertical: AppSpacings.pMd,
					),
					child: Column(
						crossAxisAlignment: CrossAxisAlignment.start,
						mainAxisAlignment: MainAxisAlignment.spaceBetween,
						children: [
							// Location selector or name
							if (hasMultipleLocations)
								_buildSkyLocationSelector(
									context,
									locations,
									selectedLocation,
									weatherService,
								)
							else if (selectedLocation != null)
								_buildSkyLocationLabel(selectedLocation.name),

							const Spacer(),

							// Temperature and condition
							if (currentDay != null)
								_buildSkyWeatherInfo(context, currentDay, units)
							else
								_buildSkyNoData(localizations),
						],
					),
				),
			),
		);
	}

	Widget _buildSkyLocationSelector(
		BuildContext context,
		List<WeatherLocationModel> locations,
		WeatherLocationModel? selectedLocation,
		WeatherService weatherService,
	) {
		return ClipRRect(
			borderRadius: BorderRadius.circular(AppBorderRadius.base),
			child: BackdropFilter(
				filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
				child: Container(
					padding: EdgeInsets.symmetric(
						horizontal: AppSpacings.pMd,
					),
					decoration: BoxDecoration(
						color: Colors.white.withValues(alpha: 0.15),
						borderRadius: BorderRadius.circular(AppBorderRadius.base),
						border: Border.all(color: Colors.white.withValues(alpha: 0.25)),
					),
					child: DropdownButtonHideUnderline(
						child: DropdownButton<String>(
							value: selectedLocation?.id,
							isExpanded: true,
							isDense: true,
							icon: Icon(
								MdiIcons.mapMarker,
								size: AppFontSize.extraSmall,
								color: Colors.white.withValues(alpha: 0.8),
							),
							style: TextStyle(
								fontSize: AppFontSize.extraSmall,
								fontWeight: FontWeight.w600,
								color: Colors.white,
							),
							dropdownColor: Colors.black.withValues(alpha: 0.8),
							items: locations.map((location) {
								return DropdownMenuItem<String>(
									value: location.id,
									child: Text(location.name),
								);
							}).toList(),
							onChanged: (String? locationId) {
								if (locationId != null) {
									weatherService.selectLocation(locationId);
								}
							},
						),
					),
				),
			),
		);
	}

	Widget _buildSkyLocationLabel(String name) {
		return Row(
			children: [
				Icon(
					MdiIcons.mapMarker,
					size: AppFontSize.extraSmall,
					color: Colors.white.withValues(alpha: 0.7),
				),
				SizedBox(width: AppSpacings.pXs),
				Text(
					name,
					style: TextStyle(
						fontSize: AppFontSize.extraSmall,
						fontWeight: FontWeight.w600,
						color: Colors.white.withValues(alpha: 0.85),
						letterSpacing: 0.5,
					),
				),
			],
		);
	}

	Widget _buildSkyWeatherInfo(
		BuildContext context,
		CurrentDayView currentDay,
		DisplayUnits units,
	) {
		final localizations = AppLocalizations.of(context)!;
		final tempSymbol = UnitConverter.temperatureSymbol(units.temperature);
		final isNight = _isNightTime(currentDay.sunrise, currentDay.sunset);

		final currentTemperature = NumberUtils.formatNumber(
			UnitConverter.convertTemperature(
				currentDay.toCelsius(currentDay.temperature),
				units.temperature,
			),
			1,
		);

		final feelsLikeTemperature = NumberUtils.formatNumber(
			UnitConverter.convertTemperature(
				currentDay.toCelsius(currentDay.feelsLike),
				units.temperature,
			),
			1,
		);

		final description = WeatherConditionMapper.getDescription(
			currentDay.weatherCode,
			context,
		);

		final weatherIcon = WeatherConditionMapper.getIcon(
			currentDay.weatherCode,
			isNight,
		);

		return Row(
			crossAxisAlignment: CrossAxisAlignment.end,
			children: [
				// Temperature and description
				Expanded(
					child: Column(
						crossAxisAlignment: CrossAxisAlignment.start,
						mainAxisSize: MainAxisSize.min,
						children: [
							Row(
								crossAxisAlignment: CrossAxisAlignment.baseline,
								textBaseline: TextBaseline.alphabetic,
								children: [
									Text(
										currentTemperature,
										style: TextStyle(
											fontFamily: 'DIN1451',
											fontSize: AppSpacings.scale(42),
											fontWeight: FontWeight.w300,
											color: Colors.white,
											height: 1.0,
										),
									),
									SizedBox(width: AppSpacings.pXs),
									Text(
										tempSymbol,
										style: TextStyle(
											fontFamily: 'DIN1451',
											fontSize: AppFontSize.large,
											color: Colors.white.withValues(alpha: 0.8),
										),
									),
								],
							),
							SizedBox(height: AppSpacings.pXs),
							Row(
								children: [
									BoxedIcon(
										weatherIcon,
										size: AppSpacings.scale(14),
										color: Colors.white.withValues(alpha: 0.9),
									),
									SizedBox(width: AppSpacings.pSm),
									Flexible(
										child: Text(
											description,
											style: TextStyle(
												fontSize: AppFontSize.extraSmall,
												color: Colors.white.withValues(alpha: 0.85),
											),
											overflow: TextOverflow.ellipsis,
										),
									),
								],
							),
						],
					),
				),
				// Feels like
				ClipRRect(
					borderRadius: BorderRadius.circular(AppBorderRadius.base),
					child: BackdropFilter(
						filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
						child: Container(
							padding: EdgeInsets.symmetric(
								horizontal: AppSpacings.pMd,
								vertical: AppSpacings.pSm,
							),
							decoration: BoxDecoration(
								color: Colors.white.withValues(alpha: 0.12),
								borderRadius: BorderRadius.circular(AppBorderRadius.base),
								border: Border.all(
									color: Colors.white.withValues(alpha: 0.2),
								),
							),
							child: Column(
								mainAxisSize: MainAxisSize.min,
								children: [
									Text(
										localizations.weather_forecast_feels_like,
										style: TextStyle(
											fontSize: AppSpacings.scale(8),
											color: Colors.white.withValues(alpha: 0.65),
										),
									),
									SizedBox(height: AppSpacings.pXxs),
									Row(
										mainAxisSize: MainAxisSize.min,
										crossAxisAlignment: CrossAxisAlignment.baseline,
										textBaseline: TextBaseline.alphabetic,
										children: [
											Text(
												feelsLikeTemperature,
												style: TextStyle(
													fontSize: AppFontSize.base,
													fontWeight: FontWeight.w600,
													color: Colors.white,
												),
											),
											SizedBox(width: AppSpacings.pXxs),
											Text(
												tempSymbol,
												style: TextStyle(
													fontSize: AppSpacings.scale(8),
													color: Colors.white.withValues(alpha: 0.7),
												),
											),
										],
									),
								],
							),
						),
					),
				),
			],
		);
	}

	Widget _buildSkyNoData(AppLocalizations localizations) {
		return Text(
			localizations.weather_detail_not_configured,
			style: TextStyle(
				fontSize: AppFontSize.base,
				color: Colors.white.withValues(alpha: 0.7),
			),
		);
	}

	// ===========================================================================
	// DETAIL CARDS — adaptive based on provider capabilities
	// ===========================================================================

	Widget _buildDetailCards(BuildContext context, CurrentDayView currentDay) {
		final units = DisplayUnits.fromLocator();
		final isDark = Theme.of(context).brightness == Brightness.dark;

		final cards = <Widget>[
			// Wind — always available
			_buildWindCard(context, currentDay, units, isDark),
			// Humidity — always available
			_buildHumidityCard(context, currentDay, isDark),
			// Pressure — always available
			_buildPressureCard(context, currentDay, units, isDark),
			// Clouds — always available
			_buildCloudsCard(context, currentDay, isDark),
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

	Widget _buildWindCard(
		BuildContext context,
		CurrentDayView currentDay,
		DisplayUnits units,
		bool isDark,
	) {
		final localizations = AppLocalizations.of(context)!;
		final windSymbol = UnitConverter.windSpeedSymbol(units.windSpeed);

		final windSpeed = NumberUtils.formatNumber(
			UnitConverter.convertWindSpeed(
				currentDay.toMetersPerSecond(currentDay.windSpeed),
				units.windSpeed,
			),
			1,
		);

		String? gustValue;
		if (currentDay.windGust != null) {
			gustValue = NumberUtils.formatNumber(
				UnitConverter.convertWindSpeed(
					currentDay.toMetersPerSecond(currentDay.windGust!),
					units.windSpeed,
				),
				1,
			);
		}

		return _buildDetailCard(
			context: context,
			isDark: isDark,
			icon: WeatherIcons.strong_wind,
			label: localizations.weather_detail_wind,
			value: windSpeed,
			unit: windSymbol,
			secondaryValue: gustValue != null ? '$gustValue $windSymbol' : null,
			secondaryLabel: gustValue != null ? localizations.weather_detail_gust : null,
		);
	}

	Widget _buildHumidityCard(
		BuildContext context,
		CurrentDayView currentDay,
		bool isDark,
	) {
		final localizations = AppLocalizations.of(context)!;

		return _buildDetailCard(
			context: context,
			isDark: isDark,
			icon: WeatherIcons.humidity,
			label: localizations.weather_forecast_humidity.replaceAll(':', ''),
			value: currentDay.humidity.toString(),
			unit: '%',
		);
	}

	Widget _buildPressureCard(
		BuildContext context,
		CurrentDayView currentDay,
		DisplayUnits units,
		bool isDark,
	) {
		final localizations = AppLocalizations.of(context)!;
		final pressSymbol = UnitConverter.pressureSymbol(units.pressure);
		final pressDecimals = UnitConverter.pressureDecimals(units.pressure);

		final pressureText = NumberUtils.formatNumber(
			UnitConverter.convertPressure(
				currentDay.pressure.toDouble(),
				units.pressure,
			),
			pressDecimals,
		);

		return _buildDetailCard(
			context: context,
			isDark: isDark,
			icon: WeatherIcons.barometer,
			label: localizations.weather_detail_pressure,
			value: pressureText,
			unit: pressSymbol,
		);
	}

	Widget _buildCloudsCard(
		BuildContext context,
		CurrentDayView currentDay,
		bool isDark,
	) {
		final localizations = AppLocalizations.of(context)!;

		return _buildDetailCard(
			context: context,
			isDark: isDark,
			icon: WeatherIcons.cloud,
			label: localizations.weather_detail_clouds,
			value: currentDay.clouds.round().toString(),
			unit: '%',
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

	// ===========================================================================
	// HELPERS
	// ===========================================================================

	bool _isNightTime(DateTime sunrise, DateTime sunset) {
		final now = DateTime.now();

		return now.isBefore(sunrise) || now.isAfter(sunset);
	}
}
