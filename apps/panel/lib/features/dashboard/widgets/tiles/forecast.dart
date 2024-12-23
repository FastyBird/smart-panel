import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/repositories/weather.dart';
import 'package:fastybird_smart_panel/core/services/screen_scaler.dart';
import 'package:fastybird_smart_panel/core/utils/localization.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/tiles/data_source/data_source.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/tiles/weather.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/pages/weather_detail.dart';
import 'package:fastybird_smart_panel/features/dashboard/widgets/tiles/tile.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class ForecastTileWidget
    extends TileWidget<WeatherTileModel, List<TileDataSourceModel>> {
  final ScreenScalerService _scaler = locator<ScreenScalerService>();

  ForecastTileWidget(super.tile, super.dataSource, {super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      alignment: Alignment.center,
      child: Consumer<WeatherRepository>(
          builder: (context, weatherRepository, child) {
        var forecast = weatherRepository.weather.forecast;

        return GestureDetector(
          onTap: () {
            if (kDebugMode) {
              print('Open detail for weather via forecast tile');
            }

            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) => WeatherDetailPage(),
              ),
            );
          },
          child: Center(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              crossAxisAlignment: CrossAxisAlignment.center,
              children: List.generate(7, (index) {
                return FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Text(
                          LocalizationUtils.getLocalizedShortDayName(
                            forecast[index].day,
                          ),
                          style: TextStyle(
                            fontSize: AppFontSize.base,
                            color:
                                Theme.of(context).brightness == Brightness.light
                                    ? AppTextColorLight.primary
                                    : AppTextColorDark.primary,
                          ),
                        ),
                      ),
                      AppSpacings.spacingSmVertical,
                      FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Icon(
                          forecast[index].icon,
                          color:
                              Theme.of(context).brightness == Brightness.light
                                  ? AppColorsLight.warning
                                  : AppColorsDark.warning,
                          size: _scaler.scale(20),
                        ),
                      ),
                      AppSpacings.spacingSmVertical,
                      FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Text(
                          forecast[index].temp.day.toStringAsFixed(1),
                          style: TextStyle(
                            fontSize: AppFontSize.small,
                            color:
                                Theme.of(context).brightness == Brightness.light
                                    ? AppTextColorLight.secondary
                                    : AppTextColorDark.secondary,
                          ),
                        ),
                      ),
                    ],
                  ),
                );
              }),
            ),
          ),
        );
      }),
    );
  }
}
