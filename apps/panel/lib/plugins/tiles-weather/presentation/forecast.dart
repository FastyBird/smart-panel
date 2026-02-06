import 'package:fastybird_smart_panel/core/utils/datetime.dart';
import 'package:fastybird_smart_panel/core/utils/number.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/modules/weather/presentation/weather_detail.dart';
import 'package:fastybird_smart_panel/modules/dashboard/presentation/widgets/tiles/tile.dart';
import 'package:fastybird_smart_panel/modules/weather/utils/openweather.dart';
import 'package:fastybird_smart_panel/plugins/tiles-weather/views/forecast.dart';
import 'package:fastybird_smart_panel/modules/weather/service.dart';
import 'package:fastybird_smart_panel/modules/weather/types/configuration.dart';
import 'package:fastybird_smart_panel/modules/weather/views/forecast_day.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:weather_icons/weather_icons.dart';

class ForecastTileWidget extends TileWidget<ForecastWeatherTileView> {
  ForecastTileWidget(super.tile, {super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<WeatherService>(builder: (
      context,
      weatherService,
      _,
    ) {
      // Use tile's locationId to get location-specific forecast
      final weatherForecast =
          weatherService.getForecastByLocation(tile.locationId);

      return Container(
        alignment: Alignment.center,
        child: GestureDetector(
          onTap: () {
            if (kDebugMode) {
              debugPrint('Open detail for weather via forecast tile');
            }

            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) => WeatherDetailPage(),
              ),
            );
          },
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            itemCount: weatherForecast.length,
            itemBuilder: (context, index) {
              return _renderForecastDay(context, weatherForecast[index]);
            },
          ),
        ),
      );
    });
  }

  Widget _renderForecastDay(BuildContext context, ForecastDayView forecast) {
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

    return SizedBox(
      width: AppSpacings.scale(70),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.center,
        spacing: AppSpacings.pSm,
        children: [
          Text(
            DatetimeUtils.getShortDayName(forecast.dayTime),
            style: TextStyle(
              fontFamily: 'DIN1451',
              fontSize: AppFontSize.base,
              color: Theme.of(context).brightness == Brightness.light
                  ? AppTextColorLight.primary
                  : AppTextColorDark.primary,
            ),
          ),
          BoxedIcon(
            WeatherConditionMapper.getIcon(forecast.weatherCode),
            color: Theme.of(context).brightness == Brightness.light
                ? AppColorsLight.warning
                : AppColorsDark.warning,
            size: AppSpacings.scale(20),
          ),
          Row(
            spacing: AppSpacings.pXs,
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                wholeDayTemp,
                style: TextStyle(
                  fontFamily: 'DIN1451',
                  fontSize: AppFontSize.extraSmall,
                  color: Theme.of(context).brightness == Brightness.light
                      ? AppTextColorLight.secondary
                      : AppTextColorDark.secondary,
                ),
              ),
              Text(
                '/',
                style: TextStyle(
                  fontFamily: 'DIN1451',
                  fontSize: AppFontSize.extraSmall,
                  color: Theme.of(context).brightness == Brightness.light
                      ? AppTextColorLight.secondary
                      : AppTextColorDark.secondary,
                ),
              ),
              Text(
                wholeNightTemp,
                style: TextStyle(
                  fontFamily: 'DIN1451',
                  fontSize: AppFontSize.extraSmall,
                  color: Theme.of(context).brightness == Brightness.light
                      ? AppTextColorLight.secondary
                      : AppTextColorDark.secondary,
                ),
              ),
              Text(
                _getUnit(forecast),
                style: TextStyle(
                  fontFamily: 'DIN1451',
                  fontSize: AppFontSize.extraSmall,
                  color: Theme.of(context).brightness == Brightness.light
                      ? AppTextColorLight.secondary
                      : AppTextColorDark.secondary,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _getUnit(ForecastDayView? forecast) {
    if (forecast == null) {
      return '°C';
    }

    return forecast.unit == WeatherUnit.fahrenheit ? '°F' : '°C';
  }
}
