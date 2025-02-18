import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/models/general/weather.dart';
import 'package:fastybird_smart_panel/core/repositories/config_module.dart';
import 'package:fastybird_smart_panel/core/repositories/weather_module.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/types/configuration.dart';
import 'package:fastybird_smart_panel/core/utils/datetime.dart';
import 'package:fastybird_smart_panel/core/utils/number.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/data_source/data_source.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/tiles/weather.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/weather_detail.dart';
import 'package:fastybird_smart_panel/features/dashboard/utils/openweather.dart';
import 'package:fastybird_smart_panel/features/dashboard/widgets/tiles/tile.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

class ForecastTileWidget
    extends TileWidget<WeatherTileModel, List<DataSourceModel>> {
  const ForecastTileWidget(super.tile, super.dataSource, {super.key});

  @override
  Widget build(BuildContext context) {
    return ForecastTileWidgetInner();
  }
}

class ForecastTileWidgetInner extends StatefulWidget {
  const ForecastTileWidgetInner({super.key});

  @override
  State<ForecastTileWidgetInner> createState() =>
      _ForecastTileWidgetInnerState();
}

class _ForecastTileWidgetInnerState extends State<ForecastTileWidgetInner> {
  final ScreenService _screenService = locator<ScreenService>();

  final WeatherModuleRepository _weatherModuleRepository =
      locator<WeatherModuleRepository>();
  final ConfigModuleRepository _configModuleRepository =
      locator<ConfigModuleRepository>();

  late WeatherUnit _weatherUnit;
  late List<ForecastDayModel> _weatherForecast;

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
      _weatherForecast = _weatherModuleRepository.forecast;
    });
  }

  @override
  Widget build(BuildContext context) {
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
          itemCount: _weatherForecast.length,
          itemBuilder: (context, index) {
            return _renderForecastDay(context, _weatherForecast[index]);
          },
        ),
      ),
    );
  }

  Widget _renderForecastDay(BuildContext context, ForecastDayModel forecast) {
    double? mornTemp = forecast.temperature.morn;
    double? dayTemp = forecast.temperature.day;
    double? eveTemp = forecast.temperature.eve;
    double? nightTemp = forecast.temperature.night;

    double? averageDayTemp = dayTemp ?? mornTemp;
    double? averageNightTemp = nightTemp ?? eveTemp;

    String wholeDayTemp = averageDayTemp != null
        ? NumberUtils.formatNumber(
            averageDayTemp,
            1,
          )
        : NumberUtils.formatUnavailableNumber();

    String wholeNightTemp = averageNightTemp != null
        ? NumberUtils.formatNumber(
            averageNightTemp,
            1,
          )
        : NumberUtils.formatUnavailableNumber();

    return SizedBox(
      width: _screenService.scale(70),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Text(
            DatetimeUtils.getShortDayName(forecast.dayTime),
            style: TextStyle(
              fontSize: AppFontSize.base,
              color: Theme.of(context).brightness == Brightness.light
                  ? AppTextColorLight.primary
                  : AppTextColorDark.primary,
            ),
          ),
          AppSpacings.spacingSmVertical,
          Icon(
            WeatherConditionMapper.getIcon(forecast.weather.code),
            color: Theme.of(context).brightness == Brightness.light
                ? AppColorsLight.warning
                : AppColorsDark.warning,
            size: _screenService.scale(20),
          ),
          AppSpacings.spacingSmVertical,
          Row(
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
              AppSpacings.spacingXsHorizontal,
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
              AppSpacings.spacingXsHorizontal,
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
              AppSpacings.spacingXsHorizontal,
              Text(
                _getUnit(),
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

  String _getUnit() {
    return _weatherUnit == WeatherUnit.fahrenheit ? '°F' : '°C';
  }
}
