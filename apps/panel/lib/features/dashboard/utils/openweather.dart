import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:weather_icons/weather_icons.dart';

class WeatherConditionMapper {
  static IconData getIcon(int conditionCode, [bool night = false]) {
    if (conditionCode >= 200 && conditionCode < 300) {
      return night
          ? WeatherIcons.night_thunderstorm
          : WeatherIcons.day_thunderstorm;
    } else if (conditionCode >= 300 && conditionCode < 400) {
      return night ? WeatherIcons.night_showers : WeatherIcons.day_showers;
    } else if (conditionCode >= 500 && conditionCode <= 504) {
      return night ? WeatherIcons.night_rain : WeatherIcons.day_rain;
    } else if (conditionCode == 511) {
      return night ? WeatherIcons.night_snow : WeatherIcons.day_snow;
    } else if (conditionCode > 520 && conditionCode < 600) {
      return night ? WeatherIcons.night_showers : WeatherIcons.day_showers;
    } else if (conditionCode >= 600 && conditionCode < 700) {
      return night ? WeatherIcons.night_snow : WeatherIcons.day_snow;
    } else if (conditionCode >= 700 && conditionCode < 800) {
      return night ? WeatherIcons.night_fog : WeatherIcons.day_fog;
    } else if (conditionCode == 800) {
      return night ? WeatherIcons.night_clear : WeatherIcons.day_sunny;
    } else if (conditionCode == 801) {
      return WeatherIcons.cloud;
    } else if (conditionCode == 802) {
      return night ? WeatherIcons.night_cloudy : WeatherIcons.day_cloudy;
    } else if (conditionCode == 803 || conditionCode == 804) {
      return night
          ? WeatherIcons.night_cloudy_windy
          : WeatherIcons.day_cloudy_windy;
    } else {
      return WeatherIcons.na;
    }
  }

  static String getDescription(int conditionCode, BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    if (conditionCode == 200) {
      return localizations.weather_condition_thunderstorm_with_light_rain;
    } else if (conditionCode == 201) {
      return localizations.weather_condition_thunderstorm_with_rain;
    } else if (conditionCode == 202) {
      return localizations.weather_condition_thunderstorm_with_heavy_rain;
    } else if (conditionCode == 210) {
      return localizations.weather_condition_light_thunderstorm;
    } else if (conditionCode == 211) {
      return localizations.weather_condition_thunderstorm;
    } else if (conditionCode == 212) {
      return localizations.weather_condition_heavy_thunderstorm;
    } else if (conditionCode == 221) {
      return localizations.weather_condition_ragged_thunderstorm;
    } else if (conditionCode == 230) {
      return localizations.weather_condition_thunderstorm_with_light_drizzle;
    } else if (conditionCode == 231) {
      return localizations.weather_condition_thunderstorm_with_drizzle;
    } else if (conditionCode == 232) {
      return localizations.weather_condition_thunderstorm_with_heavy_drizzle;
    } else if (conditionCode == 300) {
      return localizations.weather_condition_light_intensity_drizzle;
    } else if (conditionCode == 301) {
      return localizations.weather_condition_drizzle;
    } else if (conditionCode == 302) {
      return localizations.weather_condition_heavy_intensity_drizzle;
    } else if (conditionCode == 310) {
      return localizations.weather_condition_light_intensity_drizzle_rain;
    } else if (conditionCode == 311) {
      return localizations.weather_condition_drizzle_rain;
    } else if (conditionCode == 312) {
      return localizations.weather_condition_heavy_intensity_drizzle_rain;
    } else if (conditionCode == 313) {
      return localizations.weather_condition_shower_rain_and_drizzle;
    } else if (conditionCode == 314) {
      return localizations.weather_condition_shower_rain_and_drizzle;
    } else if (conditionCode == 321) {
      return localizations.weather_condition_shower_drizzle;
    } else if (conditionCode == 500) {
      return localizations.weather_condition_light_rain;
    } else if (conditionCode == 501) {
      return localizations.weather_condition_moderate_rain;
    } else if (conditionCode == 502) {
      return localizations.weather_condition_heavy_intensity_rain;
    } else if (conditionCode == 503) {
      return localizations.weather_condition_very_heavy_rain;
    } else if (conditionCode == 504) {
      return localizations.weather_condition_extreme_rain;
    } else if (conditionCode == 511) {
      return localizations.weather_condition_freezing_rain;
    } else if (conditionCode == 520) {
      return localizations.weather_condition_light_intensity_shower_rain;
    } else if (conditionCode == 521) {
      return localizations.weather_condition_shower_rain;
    } else if (conditionCode == 522) {
      return localizations.weather_condition_heavy_intensity_shower_rain;
    } else if (conditionCode == 531) {
      return localizations.weather_condition_ragged_shower_rain;
    } else if (conditionCode == 600) {
      return localizations.weather_condition_light_snow;
    } else if (conditionCode == 601) {
      return localizations.weather_condition_snow;
    } else if (conditionCode == 602) {
      return localizations.weather_condition_heavy_snow;
    } else if (conditionCode == 611) {
      return localizations.weather_condition_sleet;
    } else if (conditionCode == 612) {
      return localizations.weather_condition_light_shower_sleet;
    } else if (conditionCode == 613) {
      return localizations.weather_condition_shower_sleet;
    } else if (conditionCode == 615) {
      return localizations.weather_condition_light_rain_and_snow;
    } else if (conditionCode == 616) {
      return localizations.weather_condition_rain_and_snow;
    } else if (conditionCode == 620) {
      return localizations.weather_condition_light_shower_snow;
    } else if (conditionCode == 621) {
      return localizations.weather_condition_shower_snow;
    } else if (conditionCode == 622) {
      return localizations.weather_condition_heavy_shower_snow;
    } else if (conditionCode == 701) {
      return localizations.weather_condition_mist;
    } else if (conditionCode == 711) {
      return localizations.weather_condition_smoke;
    } else if (conditionCode == 721) {
      return localizations.weather_condition_haze;
    } else if (conditionCode == 731) {
      return localizations.weather_condition_dust;
    } else if (conditionCode == 741) {
      return localizations.weather_condition_fog;
    } else if (conditionCode == 751) {
      return localizations.weather_condition_sand;
    } else if (conditionCode == 761) {
      return localizations.weather_condition_dust;
    } else if (conditionCode == 762) {
      return localizations.weather_condition_volcanic_ash;
    } else if (conditionCode == 771) {
      return localizations.weather_condition_squalls;
    } else if (conditionCode == 781) {
      return localizations.weather_condition_tornado;
    } else if (conditionCode == 800) {
      return localizations.weather_condition_clear_sky;
    } else if (conditionCode == 801) {
      return localizations.weather_condition_few_clouds;
    } else if (conditionCode == 802) {
      return localizations.weather_condition_scattered_clouds;
    } else if (conditionCode == 803) {
      return localizations.weather_condition_broken_clouds;
    } else if (conditionCode == 804) {
      return localizations.weather_condition_overcast_clouds;
    } else {
      return localizations.weather_condition_unknown;
    }
  }
}
