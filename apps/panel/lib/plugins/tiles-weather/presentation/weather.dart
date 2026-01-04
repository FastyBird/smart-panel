import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/number.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/modules/dashboard/presentation/widgets/tiles/tile.dart';
import 'package:fastybird_smart_panel/modules/weather/utils/openweather.dart';
import 'package:fastybird_smart_panel/plugins/tiles-weather/views/weather.dart';
import 'package:fastybird_smart_panel/modules/weather/service.dart';
import 'package:fastybird_smart_panel/modules/weather/types/configuration.dart';
import 'package:fastybird_smart_panel/modules/weather/views/current_day.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:weather_icons/weather_icons.dart';

class WeatherTileWidget extends TileWidget<DayWeatherTileView> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  WeatherTileWidget(super.tile, {super.key});

  @override
  Widget build(BuildContext context) {
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
              currentWeather.temperature,
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

      return Container(
        alignment: Alignment.centerLeft,
        child: Padding(
          padding: AppSpacings.paddingSm,
          child: FittedBox(
            fit: BoxFit.scaleDown,
            child: Row(
              children: [
                BoxedIcon(
                  weatherIcon,
                  size: _screenService.scale(
                    50,
                    density: _visualDensityService.density,
                  ),
                  color: Theme.of(context).brightness == Brightness.light
                      ? AppTextColorLight.primary
                      : AppTextColorDark.primary,
                ),
                AppSpacings.spacingMdHorizontal,
                Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.start,
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
                            color:
                                Theme.of(context).brightness == Brightness.light
                                    ? AppTextColorLight.primary
                                    : AppTextColorDark.primary,
                            height: 0.95,
                          ),
                        ),
                        AppSpacings.spacingSmHorizontal,
                        Text(
                          _getUnit(currentWeather),
                          style: TextStyle(
                            fontFamily: 'DIN1451',
                            fontSize: _screenService.scale(
                              20,
                              density: _visualDensityService.density,
                            ),
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
      );
    });
  }

  String _getUnit(CurrentDayView? currentDay) {
    if (currentDay == null) {
      return '°C';
    }

    return currentDay.unit == WeatherUnit.fahrenheit ? '°F' : '°C';
  }

  bool _isNightTime(DateTime sunrise, DateTime sunset) {
    final now = DateTime.now();

    return now.isBefore(sunrise) || now.isAfter(sunset);
  }
}
