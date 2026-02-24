import 'package:fastybird_smart_panel/core/utils/number.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/utils/unit_converter.dart';
import 'package:fastybird_smart_panel/modules/dashboard/presentation/widgets/data_sources/data_source.dart';
import 'package:fastybird_smart_panel/modules/weather/utils/openweather.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/plugins/data-sources-weather/types/weather_data_field.dart';
import 'package:fastybird_smart_panel/plugins/data-sources-weather/views/weather_current.dart';
import 'package:fastybird_smart_panel/modules/weather/service.dart';
import 'package:fastybird_smart_panel/modules/weather/views/current_day.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

class WeatherCurrentDataSourceWidget
    extends DataSourceWidget<WeatherCurrentDataSourceView> {
  const WeatherCurrentDataSourceWidget(super.dataSource, {super.key});

  @override
  Widget build(BuildContext context) {
    final units = DisplayUnits.fromLocator();

    return Consumer<WeatherService>(builder: (
      context,
      weatherService,
      _,
    ) {
      // Use data source's locationId to get location-specific weather
      final CurrentDayView? currentDay =
          weatherService.getCurrentDayByLocation(dataSource.locationId);

      if (currentDay == null) {
        return _renderLoader(context);
      }

      final value = _getValue(currentDay, context, units);
      final icon = _getIcon(currentDay);

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
          dataSource.unit ?? _getDefaultUnit(dataSource.field, units);

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

  IconData _getIcon(CurrentDayView currentDay) {
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
        final now = DateTime.now();
        final isNight =
            now.isBefore(currentDay.sunrise) || now.isAfter(currentDay.sunset);
        return WeatherConditionMapper.getIcon(currentDay.weatherCode, isNight);
      case WeatherDataField.windSpeed:
        return MdiIcons.weatherWindy;
      default:
        return MdiIcons.weatherPartlyCloudy;
    }
  }

  String _getValue(
      CurrentDayView currentDay, BuildContext context, DisplayUnits units) {
    final localizations = AppLocalizations.of(context)!;

    switch (dataSource.field) {
      case WeatherDataField.temperature:
        return NumberUtils.formatNumber(
          UnitConverter.convertTemperature(
              currentDay.temperature, units.temperature),
          1,
        );
      case WeatherDataField.feelsLike:
        return NumberUtils.formatNumber(
          UnitConverter.convertTemperature(
              currentDay.feelsLike, units.temperature),
          1,
        );
      case WeatherDataField.humidity:
        return currentDay.humidity.toString();
      case WeatherDataField.pressure:
        final decimals = UnitConverter.pressureDecimals(units.pressure);
        return NumberUtils.formatNumber(
          UnitConverter.convertPressure(
              currentDay.pressure.toDouble(), units.pressure),
          decimals,
        );
      case WeatherDataField.weatherIcon:
        return '';
      case WeatherDataField.weatherMain:
      case WeatherDataField.weatherDescription:
        return WeatherConditionMapper.getDescription(
            currentDay.weatherCode, context);
      case WeatherDataField.windSpeed:
        return NumberUtils.formatNumber(
          UnitConverter.convertWindSpeed(currentDay.windSpeed, units.windSpeed),
          1,
        );
      default:
        return localizations.value_not_available;
    }
  }

  String? _getDefaultUnit(WeatherDataField field, DisplayUnits units) {
    switch (field) {
      case WeatherDataField.temperature:
      case WeatherDataField.temperatureMin:
      case WeatherDataField.temperatureMax:
      case WeatherDataField.feelsLike:
        return UnitConverter.temperatureDegreeSymbol(units.temperature);
      case WeatherDataField.humidity:
        return '%';
      case WeatherDataField.pressure:
        return UnitConverter.pressureSymbol(units.pressure);
      case WeatherDataField.windSpeed:
        return UnitConverter.windSpeedSymbol(units.windSpeed);
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
