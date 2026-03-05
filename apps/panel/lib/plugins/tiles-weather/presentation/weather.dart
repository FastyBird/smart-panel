import 'package:fastybird_smart_panel/core/utils/number.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/utils/unit_converter.dart';
import 'package:fastybird_smart_panel/modules/dashboard/presentation/widgets/tiles/tile.dart';
import 'package:fastybird_smart_panel/modules/weather/presentation/weather_detail.dart';
import 'package:fastybird_smart_panel/modules/weather/utils/openweather.dart';
import 'package:fastybird_smart_panel/plugins/tiles-weather/views/weather.dart';
import 'package:fastybird_smart_panel/modules/weather/service.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:weather_icons/weather_icons.dart';

class WeatherTileWidget extends TileWidget<DayWeatherTileView> {
  const WeatherTileWidget(super.tile, {super.key});

  @override
  Widget build(BuildContext context) {
    final units = DisplayUnits.fromLocator();

    return Consumer<WeatherService>(builder: (
      context,
      weatherService,
      _,
    ) {
      // Use tile's locationId to get location-specific weather
      final currentWeather =
          weatherService.getCurrentDayByLocation(tile.locationId);

      String currentTemperature = currentWeather != null
          ? NumberUtils.formatNumber(
              UnitConverter.convertTemperature(
                currentWeather.toCelsius(currentWeather.temperature),
                units.temperature,
              ),
              1,
            )
          : NumberUtils.formatUnavailableNumber(1);

      IconData weatherIcon = currentWeather != null
          ? WeatherConditionMapper.getIcon(
              currentWeather.weatherCode,
              _isNightTime(currentWeather.sunrise, currentWeather.sunset),
            )
          : WeatherIcons.na;

      String description = currentWeather != null
          ? WeatherConditionMapper.getDescription(
              currentWeather.weatherCode, context)
          : 'Not configured';

      return GestureDetector(
        onTap: currentWeather != null
            ? () {
                if (kDebugMode) {
                  debugPrint('Open detail for weather via weather tile');
                }

                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => WeatherDetailPage(locationId: tile.locationId),
                  ),
                );
              }
            : null,
        child: Container(
          alignment: Alignment.centerLeft,
          child: Padding(
            padding: AppSpacings.paddingSm,
            child: FittedBox(
              fit: BoxFit.scaleDown,
              child: Row(
                spacing: AppSpacings.pMd,
                children: [
                  BoxedIcon(
                    weatherIcon,
                    size: AppSpacings.scale(50),
                    color: Theme.of(context).brightness == Brightness.light
                        ? AppTextColorLight.primary
                        : AppTextColorDark.primary,
                  ),
                  Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        spacing: AppSpacings.pSm,
                        mainAxisAlignment: MainAxisAlignment.start,
                        crossAxisAlignment: CrossAxisAlignment.baseline,
                        textBaseline: TextBaseline.alphabetic,
                        children: [
                          Text(
                            currentTemperature,
                            style: TextStyle(
                              fontFamily: 'DIN1451',
                              fontSize: AppSpacings.scale(40),
                              color:
                                  Theme.of(context).brightness == Brightness.light
                                      ? AppTextColorLight.primary
                                      : AppTextColorDark.primary,
                              height: 0.95,
                            ),
                          ),
                          Text(
                            _getUnit(units),
                            style: TextStyle(
                              fontFamily: 'DIN1451',
                              fontSize: AppSpacings.scale(20),
                              fontWeight: FontWeight.w600,
                              color:
                                  Theme.of(context).brightness == Brightness.light
                                      ? AppTextColorLight.primary
                                      : AppTextColorDark.primary,
                            ),
                          ),
                        ],
                      ),
                      Text(
                        description,
                        style: TextStyle(
                          fontFamily: 'DIN1451',
                          fontSize: AppFontSize.small,
                          color: Theme.of(context).brightness == Brightness.light
                              ? AppTextColorLight.secondary
                              : AppTextColorDark.secondary,
                          height: 0.95,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    });
  }

  String _getUnit(DisplayUnits units) {
    return UnitConverter.temperatureSymbol(units.temperature);
  }

  bool _isNightTime(DateTime sunrise, DateTime sunset) {
    final now = DateTime.now();

    return now.isBefore(sunrise) || now.isAfter(sunset);
  }
}
