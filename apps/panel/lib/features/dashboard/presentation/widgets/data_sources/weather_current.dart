import 'package:fastybird_smart_panel/core/utils/number.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/widgets/data_sources/data_source.dart';
import 'package:fastybird_smart_panel/features/dashboard/utils/openweather.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/weather_data_field.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/data_sources/weather_current.dart';
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
    return Consumer<WeatherService>(builder: (
      context,
      weatherService,
      _,
    ) {
      // Use data source's locationId to get location-specific weather
      final CurrentDayView? currentDay = weatherService.getCurrentDayByLocation(dataSource.locationId);

      if (currentDay == null) {
        return _renderLoader(context);
      }

      final value = _getValue(currentDay, context);
      final icon = _getIcon(currentDay);

      final List<Widget> parts = [
        Icon(
          icon,
          size: AppFontSize.small,
        ),
        AppSpacings.spacingSmHorizontal,
        Text(
          value,
          style: TextStyle(
            fontFamily: 'DIN1451',
            fontSize: AppFontSize.small,
          ),
        ),
      ];

      final String? unit = dataSource.unit ?? _getDefaultUnit(dataSource.field);

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

  String _getValue(CurrentDayView currentDay, BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    switch (dataSource.field) {
      case WeatherDataField.temperature:
        return NumberUtils.formatNumber(currentDay.temperature, 1);
      case WeatherDataField.feelsLike:
        return NumberUtils.formatNumber(currentDay.feelsLike, 1);
      case WeatherDataField.humidity:
        return currentDay.humidity.toString();
      case WeatherDataField.pressure:
        return currentDay.pressure.toString();
      case WeatherDataField.weatherIcon:
        return '';
      case WeatherDataField.weatherMain:
      case WeatherDataField.weatherDescription:
        return WeatherConditionMapper.getDescription(
            currentDay.weatherCode, context);
      case WeatherDataField.windSpeed:
        return NumberUtils.formatNumber(currentDay.windSpeed, 1);
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
        AppSpacings.spacingSmHorizontal,
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
