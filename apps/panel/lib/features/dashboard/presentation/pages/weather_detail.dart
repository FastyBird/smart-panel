import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/repositories/configuration.dart';
import 'package:fastybird_smart_panel/core/repositories/weather.dart';
import 'package:fastybird_smart_panel/core/services/screen_scaler.dart';
import 'package:fastybird_smart_panel/core/types/weather.dart';
import 'package:fastybird_smart_panel/core/utils/localization.dart';
import 'package:fastybird_smart_panel/core/utils/number.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/screen_app_bar.dart';
import 'package:fastybird_smart_panel/generated_l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class WeatherDetailPage extends StatefulWidget {
  const WeatherDetailPage({super.key});

  @override
  State<WeatherDetailPage> createState() => _WeatherDetailPageState();
}

class _WeatherDetailPageState extends State<WeatherDetailPage> {
  final ScreenScalerService _scaler = locator<ScreenScalerService>();
  final ConfigurationRepository _configurationRepository =
      locator<ConfigurationRepository>();

  bool _fahrenheit = false;

  @override
  void initState() {
    super.initState();

    _fahrenheit = _configurationRepository.weatherConfiguration.unit ==
        UnitType.fahrenheit;

    _configurationRepository.addListener(_onConfigurationChanged);
  }

  @override
  void dispose() {
    _configurationRepository.removeListener(_onConfigurationChanged);

    super.dispose();
  }

  void _onConfigurationChanged() {
    setState(() {
      _fahrenheit = _configurationRepository.weatherConfiguration.unit ==
          UnitType.fahrenheit;
    });
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    return Consumer<WeatherRepository>(builder: (
      context,
      weatherRepository,
      _,
    ) {
      var weather = weatherRepository.weather;

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
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Icon(
                        weather.current.icon,
                        size: _scaler.scale(120),
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.end,
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                NumberUtils.formatNumber(
                                  _convertTemperature(weather.current.temp),
                                  1,
                                ),
                                style: TextStyle(
                                  fontFamily: 'DIN1451',
                                  fontSize: _scaler.scale(40),
                                ),
                              ),
                              Text(
                                _fahrenheit ? '°F' : '°C',
                                style: TextStyle(
                                  fontSize: AppFontSize.base,
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
                                  color: Theme.of(context).brightness ==
                                          Brightness.light
                                      ? AppTextColorLight.secondary
                                      : AppTextColorDark.secondary,
                                ),
                              ),
                              AppSpacings.spacingXsHorizontal,
                              Text(
                                NumberUtils.formatNumber(
                                  _convertTemperature(weather.current.temp),
                                  1,
                                ),
                                style: TextStyle(
                                  fontSize: AppFontSize.base,
                                ),
                              ),
                              Text(
                                _fahrenheit ? '°F' : '°C',
                                style: TextStyle(
                                  fontSize: AppFontSize.base,
                                ),
                              ),
                            ],
                          ),
                          Text(
                            weather.current.condition,
                          )
                        ],
                      )
                    ],
                  ),
                ),
                Wrap(
                  spacing: AppSpacings.pSm,
                  runSpacing: AppSpacings.pSm,
                  children: weather.forecast
                      .map((forecast) {
                        return ListTile(
                          contentPadding: EdgeInsets.symmetric(
                            horizontal: AppSpacings.pMd,
                          ),
                          dense: true,
                          shape: RoundedRectangleBorder(
                            borderRadius:
                                BorderRadius.circular(AppBorderRadius.base),
                            side: BorderSide(
                              color: Theme.of(context).brightness ==
                                      Brightness.light
                                  ? AppBorderColorLight.base
                                  : AppBorderColorDark.base,
                              width: _scaler.scale(1),
                            ),
                          ),
                          textColor:
                              Theme.of(context).brightness == Brightness.light
                                  ? AppTextColorLight.regular
                                  : AppTextColorDark.regular,
                          leading: Icon(
                            forecast.icon,
                            size: _scaler.scale(32),
                          ),
                          title: Text(
                            LocalizationUtils.getLocalizedDayName(forecast.day),
                            style: TextStyle(
                              fontSize: AppFontSize.extraSmall,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          subtitle: Text(
                            forecast.condition,
                            style: TextStyle(
                              fontSize: _scaler.scale(8),
                            ),
                          ),
                          trailing: Column(
                            crossAxisAlignment: CrossAxisAlignment.end,
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              SizedBox(
                                width: 120,
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.end,
                                  crossAxisAlignment:
                                      CrossAxisAlignment.baseline,
                                  textBaseline: TextBaseline.alphabetic,
                                  children: [
                                    Text(
                                      NumberUtils.formatNumber(
                                        _convertTemperature(
                                          forecast.temp.night,
                                        ),
                                        1,
                                      ),
                                      style: TextStyle(
                                        fontSize: AppFontSize.small,
                                        color: Theme.of(context).brightness ==
                                                Brightness.light
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
                                      NumberUtils.formatNumber(
                                        _convertTemperature(
                                          forecast.temp.day,
                                        ),
                                        1,
                                      ),
                                      style: TextStyle(
                                        fontSize: AppFontSize.base,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                    Text(
                                      _fahrenheit ? '°F' : '°C',
                                      style: TextStyle(
                                        fontSize: AppFontSize.base,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              SizedBox(
                                width: 120,
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.end,
                                  crossAxisAlignment:
                                      CrossAxisAlignment.baseline,
                                  textBaseline: TextBaseline.alphabetic,
                                  children: [
                                    Text(
                                      localizations.weather_forecast_humidity,
                                      style: TextStyle(
                                        fontSize: _scaler.scale(7),
                                        color: Theme.of(context).brightness ==
                                                Brightness.light
                                            ? AppTextColorLight.secondary
                                            : AppTextColorDark.secondary,
                                      ),
                                    ),
                                    AppSpacings.spacingXsHorizontal,
                                    Text(
                                      '${NumberUtils.formatNumber(forecast.humidity.toDouble(), 0)}%',
                                      style: TextStyle(
                                        fontSize: AppFontSize.extraSmall,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        );
                      })
                      .whereType<Widget>()
                      .toList(),
                ),
              ],
            ),
          ),
        ),
      );
    });
  }

  double _convertTemperature(double celsius) {
    if (_fahrenheit) {
      return (celsius * 9 / 5) + 32;
    }

    return celsius;
  }
}
