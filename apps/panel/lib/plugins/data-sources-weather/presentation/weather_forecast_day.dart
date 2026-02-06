import 'package:fastybird_smart_panel/core/utils/number.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/modules/dashboard/presentation/widgets/data_sources/data_source.dart';
import 'package:fastybird_smart_panel/modules/weather/utils/openweather.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/plugins/data-sources-weather/types/weather_data_field.dart';
import 'package:fastybird_smart_panel/plugins/data-sources-weather/views/weather_forecast_day.dart';
import 'package:fastybird_smart_panel/modules/weather/service.dart';
import 'package:fastybird_smart_panel/modules/weather/views/forecast_day.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

class WeatherForecastDayDataSourceWidget
    extends DataSourceWidget<WeatherForecastDayDataSourceView> {
  const WeatherForecastDayDataSourceWidget(super.dataSource, {super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<WeatherService>(builder: (
      context,
      weatherService,
      _,
    ) {
      // Use data source's locationId to get location-specific forecast
      final List<ForecastDayView> forecast =
          weatherService.getForecastByLocation(dataSource.locationId);

      if (forecast.isEmpty || dataSource.dayOffset >= forecast.length) {
        return _renderLoader(context);
      }

      final ForecastDayView forecastDay = forecast[dataSource.dayOffset];
      final value = _getValue(forecastDay, context);
      final icon = _getIcon(forecastDay);

      final List<Widget> parts = [
        Icon(
          icon,
          size: AppFontSize.small,
        ),
        Text(
          value,
          style: TextStyle(
            fontFamily: 'DIN1451',
            fontSize: AppFontSize.small,
          ),
        ),
      ];

      final String? unit =
          dataSource.unit ?? _getDefaultUnit(dataSource.field);

      if (unit != null && value.isNotEmpty) {
        parts.add(
          Text(
            unit,
            style: TextStyle(
              fontFamily: 'DIN1451',
              fontSize: AppFontSize.small,
            ),
          ),
        );
      }

      return Row(
        spacing: AppSpacings.pSm,
        crossAxisAlignment: CrossAxisAlignment.center,
        mainAxisAlignment: MainAxisAlignment.start,
        children: parts,
      );
    });
  }

  IconData _getIcon(ForecastDayView forecastDay) {
    IconData? customIcon = dataSource.icon;

    if (customIcon != null) {
      return customIcon;
    }

    switch (dataSource.field) {
      case WeatherDataField.temperature:
      case WeatherDataField.temperatureMin:
      case WeatherDataField.temperatureMax:
      case WeatherDataField.feelsLike:
        return MdiIcons.thermometer;
      case WeatherDataField.humidity:
        return MdiIcons.waterPercent;
      case WeatherDataField.pressure:
        return MdiIcons.gauge;
      case WeatherDataField.weatherIcon:
        return WeatherConditionMapper.getIcon(forecastDay.weatherCode, false);
      case WeatherDataField.windSpeed:
        return MdiIcons.weatherWindy;
      default:
        return MdiIcons.weatherPartlyCloudy;
    }
  }

  String _getValue(ForecastDayView forecastDay, BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    switch (dataSource.field) {
      case WeatherDataField.temperature:
        final temp = forecastDay.temperatureDay;
        return temp != null
            ? NumberUtils.formatNumber(temp, 1)
            : localizations.value_not_available;
      case WeatherDataField.temperatureMin:
        final temp = forecastDay.temperatureNight;
        return temp != null
            ? NumberUtils.formatNumber(temp, 1)
            : localizations.value_not_available;
      case WeatherDataField.temperatureMax:
        final temp = forecastDay.temperatureDay;
        return temp != null
            ? NumberUtils.formatNumber(temp, 1)
            : localizations.value_not_available;
      case WeatherDataField.humidity:
        return forecastDay.humidity.toString();
      case WeatherDataField.weatherIcon:
        return '';
      case WeatherDataField.weatherMain:
      case WeatherDataField.weatherDescription:
        return WeatherConditionMapper.getDescription(
            forecastDay.weatherCode, context);
      default:
        return localizations.value_not_available;
    }
  }

  String? _getDefaultUnit(WeatherDataField field) {
    switch (field) {
      case WeatherDataField.temperature:
      case WeatherDataField.temperatureMin:
      case WeatherDataField.temperatureMax:
      case WeatherDataField.feelsLike:
        return '°';
      case WeatherDataField.humidity:
        return '%';
      case WeatherDataField.pressure:
        return 'hPa';
      case WeatherDataField.windSpeed:
        return 'm/s';
      default:
        return null;
    }
  }

  Widget _renderLoader(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    return Row(
      spacing: AppSpacings.pSm,
      crossAxisAlignment: CrossAxisAlignment.center,
      mainAxisAlignment: MainAxisAlignment.start,
      children: [
        SizedBox(
          width: AppFontSize.extraSmall,
          height: AppFontSize.extraSmall,
          child: Theme(
            data: ThemeData(
              progressIndicatorTheme: ProgressIndicatorThemeData(
                color: Theme.of(context).brightness == Brightness.light
                    ? AppColorsLight.info
                    : AppColorsDark.info,
                linearTrackColor: AppColors.blank,
              ),
            ),
            child: const CircularProgressIndicator(strokeWidth: 2),
          ),
        ),
        Text(
          localizations.value_loading,
          style: TextStyle(
            fontFamily: 'DIN1451',
            fontSize: AppFontSize.small,
          ),
        ),
      ],
    );
  }
}
