import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/models/general/weather.dart';
import 'package:fastybird_smart_panel/core/repositories/config_module.dart';
import 'package:fastybird_smart_panel/core/repositories/weather_module.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/types/configuration.dart';
import 'package:fastybird_smart_panel/core/utils/number.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/data_source/data_source.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/tiles/weather.dart';
import 'package:fastybird_smart_panel/features/dashboard/utils/openweather.dart';
import 'package:fastybird_smart_panel/features/dashboard/widgets/tiles/tile.dart';
import 'package:flutter/material.dart';
import 'package:weather_icons/weather_icons.dart';

class WeatherTileWidget
    extends TileWidget<WeatherTileModel, List<DataSourceModel>> {
  const WeatherTileWidget(super.tile, super.dataSource, {super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      alignment: Alignment.centerLeft,
      child: Padding(
        padding: AppSpacings.paddingSm,
        child: WeatherTileWidgetInner(),
      ),
    );
  }
}

class WeatherTileWidgetInner extends StatefulWidget {
  const WeatherTileWidgetInner({super.key});

  @override
  State<WeatherTileWidgetInner> createState() => _WeatherTileWidgetInnerState();
}

class _WeatherTileWidgetInnerState extends State<WeatherTileWidgetInner> {
  final ScreenService _screenService = locator<ScreenService>();

  final WeatherModuleRepository _weatherModuleRepository =
      locator<WeatherModuleRepository>();
  final ConfigModuleRepository _configModuleRepository =
      locator<ConfigModuleRepository>();

  late WeatherUnit _weatherUnit;
  late CurrentDayModel? _currentWeather;

  @override
  void initState() {
    super.initState();

    _syncStateWithRepository();

    _configModuleRepository.addListener(_syncStateWithRepository);
    _weatherModuleRepository.addListener(_syncStateWithRepository);
  }

  @override
  void dispose() {
    _configModuleRepository.removeListener(_syncStateWithRepository);
    _weatherModuleRepository.removeListener(_syncStateWithRepository);

    super.dispose();
  }

  void _syncStateWithRepository() {
    setState(() {
      _weatherUnit = _configModuleRepository.weatherConfiguration.unit;
      _currentWeather = _weatherModuleRepository.currentWeather;
    });
  }

  @override
  Widget build(BuildContext context) {
    final currentWeather = _currentWeather;

    String currentTemperature = currentWeather != null
        ? NumberUtils.formatNumber(
            currentWeather.temperature,
            1,
          )
        : NumberUtils.formatUnavailableNumber();

    IconData weatherIcon = currentWeather != null
        ? WeatherConditionMapper.getIcon(
            currentWeather.weather.code,
            _isNightTime(currentWeather.sunrise, currentWeather.sunset),
          )
        : WeatherIcons.na;

    String description = currentWeather != null
        ? WeatherConditionMapper.getDescription(
            currentWeather.weather.code, context)
        : 'Not configured';

    return FittedBox(
      fit: BoxFit.scaleDown,
      child: Row(
        children: [
          BoxedIcon(
            weatherIcon,
            size: _screenService.scale(50),
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
                      fontSize: _screenService.scale(40),
                      color: Theme.of(context).brightness == Brightness.light
                          ? AppTextColorLight.primary
                          : AppTextColorDark.primary,
                      height: 0.95,
                    ),
                  ),
                  AppSpacings.spacingSmHorizontal,
                  Text(
                    _getUnit(),
                    style: TextStyle(
                      fontFamily: 'DIN1451',
                      fontSize: _screenService.scale(20),
                      fontWeight: FontWeight.w600,
                      color: Theme.of(context).brightness == Brightness.light
                          ? AppTextColorLight.primary
                          : AppTextColorDark.primary,
                    ),
                  ),
                ],
              ),
              Text(
                description,
                style: TextStyle(
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
    );
  }

  String _getUnit() {
    return _weatherUnit == WeatherUnit.fahrenheit ? '°F' : '°C';
  }

  bool _isNightTime(DateTime sunrise, DateTime sunset) {
    final now = DateTime.now();

    return now.isBefore(sunrise) || now.isAfter(sunset);
  }
}
