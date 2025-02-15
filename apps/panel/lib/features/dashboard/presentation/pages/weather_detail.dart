import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/models/general/weather.dart';
import 'package:fastybird_smart_panel/core/repositories/configuration.dart';
import 'package:fastybird_smart_panel/core/repositories/weather.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/types/weather.dart';
import 'package:fastybird_smart_panel/core/utils/number.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/screen_app_bar.dart';
import 'package:fastybird_smart_panel/features/dashboard/utils/openweather.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:weather_icons/weather_icons.dart';

class WeatherDetailPage extends StatefulWidget {
  const WeatherDetailPage({super.key});

  @override
  State<WeatherDetailPage> createState() => _WeatherDetailPageState();
}

class _WeatherDetailPageState extends State<WeatherDetailPage> {
  final ScreenService _screenService = locator<ScreenService>();

  final WeatherRepository _weatherRepository = locator<WeatherRepository>();
  final ConfigurationRepository _configurationRepository =
      locator<ConfigurationRepository>();

  late WeatherUnitType _weatherUnit;
  late CurrentDayModel? _currentWeather;
  late List<ForecastDayModel> _weatherForecast;

  @override
  void initState() {
    super.initState();

    _syncStateWithRepository();

    _configurationRepository.addListener(_syncStateWithRepository);
    _weatherRepository.addListener(_syncStateWithRepository);
  }

  @override
  void dispose() {
    _configurationRepository.removeListener(_syncStateWithRepository);
    _weatherRepository.removeListener(_syncStateWithRepository);

    super.dispose();
  }

  void _syncStateWithRepository() {
    setState(() {
      _weatherUnit = _configurationRepository.weatherConfiguration.unit;
      _currentWeather = _weatherRepository.currentWeather;
      _weatherForecast = _weatherRepository.forecast;
    });
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    return Scaffold(
      appBar: ScreenAppBar(
        title: localizations.weather_forecast_title,
      ),
      body: SingleChildScrollView(
        child: Padding(
          padding: AppSpacings.paddingMd,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: EdgeInsets.symmetric(
                  vertical: AppSpacings.pMd,
                  horizontal: AppSpacings.pLg,
                ),
                child: _renderCurrent(context),
              ),
              Wrap(
                spacing: AppSpacings.pSm,
                runSpacing: AppSpacings.pSm,
                children: _weatherForecast
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
  }

  Widget _renderCurrent(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    final currentWeather = _currentWeather;

    String currentTemperature = currentWeather != null
        ? NumberUtils.formatNumber(
            currentWeather.temperature,
            1,
          )
        : '-';

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

    return Column(
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Icon(
              weatherIcon,
              size: _screenService.scale(80),
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
                        fontSize: _screenService.scale(40),
                        color: Theme.of(context).brightness == Brightness.light
                            ? AppTextColorLight.primary
                            : AppTextColorDark.primary,
                      ),
                    ),
                    Text(
                      _getUnit(),
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
                        fontSize: AppFontSize.small,
                        color: Theme.of(context).brightness == Brightness.light
                            ? AppTextColorLight.secondary
                            : AppTextColorDark.secondary,
                      ),
                    ),
                    AppSpacings.spacingXsHorizontal,
                    Text(
                      currentTemperature,
                      style: TextStyle(
                        fontSize: AppFontSize.base,
                      ),
                    ),
                    Text(
                      _getUnit(),
                      style: TextStyle(
                        fontSize: AppFontSize.base,
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
                  degree: currentWeather?.wind.deg ?? 0,
                  size: AppFontSize.extraSmall,
                ),
                AppSpacings.spacingXsHorizontal,
                Text(
                  currentWeather?.wind.speed.toString() ?? 'N/A',
                  style: TextStyle(
                    fontSize: AppFontSize.extraSmall,
                  ),
                ),
                AppSpacings.spacingXsHorizontal,
                Text(
                  'm/s',
                  style: TextStyle(
                    fontSize: _screenService.scale(8),
                  ),
                ),
                AppSpacings.spacingMdHorizontal,
                Icon(
                  WeatherIcons.barometer,
                  size: AppFontSize.extraSmall,
                ),
                AppSpacings.spacingXsHorizontal,
                Text(
                  currentWeather?.pressure.toString() ?? 'N/A',
                  style: TextStyle(
                    fontSize: AppFontSize.extraSmall,
                  ),
                ),
                AppSpacings.spacingXsHorizontal,
                Text(
                  'hPa',
                  style: TextStyle(
                    fontSize: _screenService.scale(8),
                  ),
                ),
                AppSpacings.spacingMdHorizontal,
                Icon(
                  WeatherIcons.humidity,
                  size: AppFontSize.extraSmall,
                ),
                AppSpacings.spacingXsHorizontal,
                Text(
                  currentWeather?.humidity.toString() ?? 'N/A',
                  style: TextStyle(
                    fontSize: AppFontSize.extraSmall,
                  ),
                ),
                AppSpacings.spacingXsHorizontal,
                Text(
                  '%',
                  style: TextStyle(
                    fontSize: _screenService.scale(8),
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

  Widget _renderForecastDay(BuildContext context, ForecastDayModel forecast) {
    final localizations = AppLocalizations.of(context)!;

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
        : '-';

    String wholeNightTemp = averageNightTemp != null
        ? NumberUtils.formatNumber(
            averageNightTemp,
            1,
          )
        : '-';

    return SizedBox(
      height: _screenService.scale(45),
      child: IntrinsicHeight(
        // Allows content to expand properly
        child: ListTile(
          contentPadding: EdgeInsets.symmetric(
            horizontal: AppSpacings.pMd,
          ),
          visualDensity: const VisualDensity(vertical: 4),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppBorderRadius.base),
            side: BorderSide(
              color: Theme.of(context).brightness == Brightness.light
                  ? AppBorderColorLight.base
                  : AppBorderColorDark.base,
              width: _screenService.scale(1),
            ),
          ),
          textColor: Theme.of(context).brightness == Brightness.light
              ? AppTextColorLight.regular
              : AppTextColorDark.regular,
          leading: SizedBox(
            width: _screenService.scale(28),
            child: Icon(
              WeatherConditionMapper.getIcon(forecast.weather.code),
              size: _screenService.scale(18),
              color: Theme.of(context).brightness == Brightness.light
                  ? AppColorsLight.warning
                  : AppColorsDark.warning,
            ),
          ),
          title: Row(
            mainAxisAlignment: MainAxisAlignment.start,
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Text(
                forecast.localizedDayName,
                style: TextStyle(
                  fontSize: AppFontSize.extraSmall,
                  fontWeight: FontWeight.w600,
                ),
              ),
              AppSpacings.spacingSmHorizontal,
              Text(
                forecast.localizedShortMonthDay,
                style: TextStyle(
                  fontSize: _screenService.scale(8),
                ),
              ),
            ],
          ),
          subtitle: Text(
            forecast.weather.main,
            style: TextStyle(
              fontSize: _screenService.scale(8),
            ),
          ),
          trailing: IntrinsicHeight(
            // Ensures trailing content expands
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                SizedBox(
                  width: 150,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      Text(
                        wholeNightTemp,
                        style: TextStyle(
                          fontSize: AppFontSize.extraSmall,
                          color:
                              Theme.of(context).brightness == Brightness.light
                                  ? AppTextColorLight.secondary
                                  : AppTextColorDark.secondary,
                        ),
                      ),
                      AppSpacings.spacingXsHorizontal,
                      Text(
                        '/',
                        style: TextStyle(
                          fontSize: AppFontSize.extraSmall,
                        ),
                      ),
                      AppSpacings.spacingXsHorizontal,
                      Text(
                        wholeDayTemp,
                        style: TextStyle(
                          fontSize: AppFontSize.base,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      Text(
                        _getUnit(),
                        style: TextStyle(
                          fontSize: AppFontSize.small,
                        ),
                      ),
                    ],
                  ),
                ),
                SizedBox(
                  width: 150,
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.end,
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      Text(
                        localizations.weather_forecast_humidity,
                        style: TextStyle(
                          fontSize: _screenService.scale(7),
                          color:
                              Theme.of(context).brightness == Brightness.light
                                  ? AppTextColorLight.secondary
                                  : AppTextColorDark.secondary,
                        ),
                      ),
                      AppSpacings.spacingXsHorizontal,
                      Text(
                        '${forecast.humidity}%',
                        style: TextStyle(
                          fontSize: AppFontSize.extraSmall,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _getUnit() {
    return _weatherUnit == WeatherUnitType.fahrenheit ? '°F' : '°C';
  }

  bool _isNightTime(DateTime sunrise, DateTime sunset) {
    final now = DateTime.now();

    return now.isBefore(sunrise) || now.isAfter(sunset);
  }
}
