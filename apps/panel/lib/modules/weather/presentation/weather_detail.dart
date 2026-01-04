import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/datetime.dart';
import 'package:fastybird_smart_panel/core/utils/number.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/top_bar.dart';
import 'package:fastybird_smart_panel/modules/weather/utils/openweather.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/weather/export.dart';
import 'package:fastybird_smart_panel/modules/weather/views/current_day.dart';
import 'package:fastybird_smart_panel/modules/weather/views/forecast_day.dart';
import 'package:fastybird_smart_panel/modules/weather/views/view.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:weather_icons/weather_icons.dart';

class WeatherDetailPage extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  WeatherDetailPage({super.key});

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
          child: Padding(
            padding: AppSpacings.paddingMd,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Location selector (only shown when multiple locations exist)
                if (hasMultipleLocations)
                  _renderLocationSelector(
                    context,
                    locations,
                    selectedLocation,
                    weatherService,
                  ),
                Padding(
                  padding: EdgeInsets.symmetric(
                    vertical: AppSpacings.pMd,
                    horizontal: AppSpacings.pLg,
                  ),
                  child: _renderCurrent(context, currentDay),
                ),
                Wrap(
                  spacing: AppSpacings.pSm,
                  runSpacing: AppSpacings.pSm,
                  children: forecast
                      .map((day) {
                        return _renderForecastDay(context, day);
                      })
                      .whereType<Widget>()
                      .toList(),
                ),
              ],
            ),
          ),
        ),
      );
    });
  }

  Widget _renderLocationSelector(
    BuildContext context,
    List<WeatherLocationModel> locations,
    WeatherLocationModel? selectedLocation,
    WeatherService weatherService,
  ) {
    return Padding(
      padding: EdgeInsets.symmetric(
        horizontal: AppSpacings.pLg,
        vertical: AppSpacings.pSm,
      ),
      child: Container(
        padding: EdgeInsets.symmetric(
          horizontal: AppSpacings.pMd,
        ),
        decoration: BoxDecoration(
          color: Theme.of(context).brightness == Brightness.light
              ? AppColorsLight.infoLight9
              : AppColorsDark.infoLight9,
          borderRadius: BorderRadius.circular(AppBorderRadius.base),
        ),
        child: DropdownButtonHideUnderline(
          child: DropdownButton<String>(
            value: selectedLocation?.id,
            isExpanded: true,
            icon: Icon(
              Icons.location_on,
              size: AppFontSize.small,
              color: Theme.of(context).brightness == Brightness.light
                  ? AppTextColorLight.secondary
                  : AppTextColorDark.secondary,
            ),
            style: TextStyle(
              fontSize: AppFontSize.small,
              color: Theme.of(context).brightness == Brightness.light
                  ? AppTextColorLight.primary
                  : AppTextColorDark.primary,
            ),
            dropdownColor: Theme.of(context).brightness == Brightness.light
                ? AppBgColorLight.overlay
                : AppBgColorDark.overlay,
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
    );
  }

  Widget _renderCurrent(BuildContext context, CurrentDayView? currentDay) {
    final localizations = AppLocalizations.of(context)!;

    String currentTemperature = currentDay != null
        ? NumberUtils.formatNumber(
            currentDay.temperature,
            1,
          )
        : NumberUtils.formatUnavailableNumber(1);

    String feelsLikeTemperature = currentDay != null
        ? NumberUtils.formatNumber(
            currentDay.feelsLike,
            1,
          )
        : NumberUtils.formatUnavailableNumber(1);

    IconData weatherIcon = currentDay != null
        ? WeatherConditionMapper.getIcon(
            currentDay.weatherCode,
            _isNightTime(currentDay.sunrise, currentDay.sunset),
          )
        : WeatherIcons.na;

    String description = currentDay != null
        ? WeatherConditionMapper.getDescription(currentDay.weatherCode, context)
        : 'Not configured';

    return Column(
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            BoxedIcon(
              weatherIcon,
              size: _screenService.scale(
                60,
                density: _visualDensityService.density,
              ),
              color: Theme.of(context).brightness == Brightness.light
                  ? AppTextColorLight.primary
                  : AppTextColorDark.primary,
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Text(
                      currentTemperature,
                      style: TextStyle(
                        fontFamily: 'DIN1451',
                        fontSize: _screenService.scale(
                          40,
                          density: _visualDensityService.density,
                        ),
                        color: Theme.of(context).brightness == Brightness.light
                            ? AppTextColorLight.primary
                            : AppTextColorDark.primary,
                      ),
                    ),
                    AppSpacings.spacingSmHorizontal,
                    Text(
                      _getUnit(currentDay),
                      style: TextStyle(
                        fontFamily: 'DIN1451',
                        fontSize: AppFontSize.base,
                        color: Theme.of(context).brightness == Brightness.light
                            ? AppTextColorLight.primary
                            : AppTextColorDark.primary,
                      ),
                    ),
                  ],
                ),
                Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Text(
                      localizations.weather_forecast_feels_like,
                      style: TextStyle(
                        fontSize: AppFontSize.extraSmall,
                        color: Theme.of(context).brightness == Brightness.light
                            ? AppTextColorLight.secondary
                            : AppTextColorDark.secondary,
                      ),
                    ),
                    AppSpacings.spacingSmHorizontal,
                    Text(
                      feelsLikeTemperature,
                      style: TextStyle(
                        fontSize: AppFontSize.base,
                      ),
                    ),
                    AppSpacings.spacingXsHorizontal,
                    Text(
                      _getUnit(currentDay),
                      style: TextStyle(
                        fontSize: AppFontSize.extraSmall,
                      ),
                    ),
                  ],
                ),
              ],
            )
          ],
        ),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.start,
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                WindIcon(
                  degree: currentDay?.windDeg ?? 0,
                  size: AppFontSize.extraSmall,
                ),
                AppSpacings.spacingXsHorizontal,
                Text(
                  currentDay?.windSpeed.toString() ??
                      localizations.value_not_available,
                  style: TextStyle(
                    fontSize: AppFontSize.extraSmall,
                  ),
                ),
                AppSpacings.spacingXsHorizontal,
                Text(
                  'm/s',
                  style: TextStyle(
                    fontSize: _screenService.scale(
                      8,
                      density: _visualDensityService.density,
                    ),
                  ),
                ),
                AppSpacings.spacingMdHorizontal,
                Icon(
                  WeatherIcons.barometer,
                  size: AppFontSize.extraSmall,
                ),
                AppSpacings.spacingXsHorizontal,
                Text(
                  currentDay?.pressure.toString() ??
                      localizations.value_not_available,
                  style: TextStyle(
                    fontSize: AppFontSize.extraSmall,
                  ),
                ),
                AppSpacings.spacingXsHorizontal,
                Text(
                  'hPa',
                  style: TextStyle(
                    fontSize: _screenService.scale(
                      8,
                      density: _visualDensityService.density,
                    ),
                  ),
                ),
                AppSpacings.spacingMdHorizontal,
                Icon(
                  WeatherIcons.humidity,
                  size: AppFontSize.extraSmall,
                ),
                AppSpacings.spacingXsHorizontal,
                Text(
                  currentDay?.humidity.toString() ??
                      localizations.value_not_available,
                  style: TextStyle(
                    fontSize: AppFontSize.extraSmall,
                  ),
                ),
                AppSpacings.spacingXsHorizontal,
                Text(
                  '%',
                  style: TextStyle(
                    fontSize: _screenService.scale(
                      8,
                      density: _visualDensityService.density,
                    ),
                  ),
                ),
              ],
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.start,
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                Text(
                  description,
                  style: TextStyle(
                    fontSize: AppFontSize.extraSmall,
                  ),
                ),
              ],
            ),
          ],
        ),
      ],
    );
  }

  Widget _renderForecastDay(BuildContext context, ForecastDayView forecast) {
    final localizations = AppLocalizations.of(context)!;

    double? mornTemp = forecast.temperatureMorn;
    double? dayTemp = forecast.temperatureDay;
    double? eveTemp = forecast.temperatureEve;
    double? nightTemp = forecast.temperatureNight;

    double? averageDayTemp = dayTemp ?? mornTemp;
    double? averageNightTemp = nightTemp ?? eveTemp;

    String wholeDayTemp = averageDayTemp != null
        ? NumberUtils.formatNumber(
            averageDayTemp,
            1,
          )
        : NumberUtils.formatUnavailableNumber(1);

    String wholeNightTemp = averageNightTemp != null
        ? NumberUtils.formatNumber(
            averageNightTemp,
            1,
          )
        : NumberUtils.formatUnavailableNumber(1);

    return ListTile(
      titleAlignment: ListTileTitleAlignment.center,
      iconColor: Theme.of(context).brightness == Brightness.light
          ? AppColorsLight.warning
          : AppColorsDark.warning,
      leading: BoxedIcon(
        WeatherConditionMapper.getIcon(forecast.weatherCode),
        size: _screenService.scale(
          18,
          density: _visualDensityService.density,
        ),
      ),
      title: Row(
        mainAxisAlignment: MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.baseline,
        textBaseline: TextBaseline.alphabetic,
        children: [
          Text(
            DatetimeUtils.getDayName(forecast.dayTime),
            style: TextStyle(
              fontSize: AppFontSize.extraSmall,
              fontWeight: FontWeight.w600,
            ),
          ),
          AppSpacings.spacingSmHorizontal,
          Text(
            DatetimeUtils.getShortMonthDay(forecast.dayTime),
            style: TextStyle(
              fontSize: AppFontSize.extraSmall,
            ),
          ),
        ],
      ),
      subtitle: Text(
        forecast.weatherMain,
        style: TextStyle(
          fontSize: AppFontSize.extraSmall,
        ),
      ),
      trailing: Column(
        crossAxisAlignment: CrossAxisAlignment.end,
        mainAxisAlignment: MainAxisAlignment.center,
        spacing: 0,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            spacing: AppSpacings.pXs,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                wholeNightTemp,
                style: TextStyle(
                  fontSize: _screenService.scale(
                    8,
                    density: _visualDensityService.density,
                  ),
                  color: Theme.of(context).brightness == Brightness.light
                      ? AppTextColorLight.secondary
                      : AppTextColorDark.secondary,
                ),
              ),
              Text(
                '/',
                style: TextStyle(
                  fontSize: _screenService.scale(
                    9,
                    density: _visualDensityService.density,
                  ),
                ),
              ),
              Text(
                wholeDayTemp,
                style: TextStyle(
                  fontSize: _screenService.scale(
                    9,
                    density: _visualDensityService.density,
                  ),
                  fontWeight: FontWeight.w600,
                ),
              ),
              Text(
                _getUnit(forecast),
                style: TextStyle(
                  fontSize: _screenService.scale(
                    8,
                    density: _visualDensityService.density,
                  ),
                ),
              ),
            ],
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            spacing: AppSpacings.pXs,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                localizations.weather_forecast_humidity,
                style: TextStyle(
                  fontSize: _screenService.scale(
                    7,
                    density: _visualDensityService.density,
                  ),
                  color: Theme.of(context).brightness == Brightness.light
                      ? AppTextColorLight.secondary
                      : AppTextColorDark.secondary,
                ),
              ),
              Text(
                forecast.humidity.toString(),
                style: TextStyle(
                  fontSize: _screenService.scale(
                    7,
                    density: _visualDensityService.density,
                  ),
                ),
              ),
              Text(
                '%',
                style: TextStyle(
                  fontSize: _screenService.scale(
                    7,
                    density: _visualDensityService.density,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _getUnit(WeatherView? weather) {
    if (weather == null) {
      return '°C';
    }

    return weather.unit == WeatherUnit.fahrenheit ? '°F' : '°C';
  }

  bool _isNightTime(DateTime sunrise, DateTime sunset) {
    final now = DateTime.now();

    return now.isBefore(sunrise) || now.isAfter(sunset);
  }
}
