import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/repositories/weather.dart';
import 'package:fastybird_smart_panel/core/services/screen_scaler.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/tiles/data_source/data_source.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/tiles/weather.dart';
import 'package:fastybird_smart_panel/features/dashboard/widgets/tiles/tile.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class WeatherTileWidget
    extends TileWidget<WeatherTileModel, List<TileDataSourceModel>> {
  final ScreenScalerService scaler = locator<ScreenScalerService>();

  WeatherTileWidget(super.tile, super.dataSource, {super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      alignment: Alignment.centerLeft,
      child: Padding(
        padding: AppSpacings.paddingSm,
        child: Consumer<WeatherRepository>(builder: (
          context,
          weatherRepository,
          child,
        ) {
          var weather = weatherRepository.weather.current;

          return FittedBox(
            fit: BoxFit.scaleDown,
            child: Row(
              children: [
                Icon(
                  weather.icon,
                  size: scaler.scale(50),
                  color: Theme.of(context).brightness == Brightness.light
                      ? AppTextColorLight.primary
                      : AppTextColorDark.primary,
                ),
                AppSpacings.spacingMdHorizontal,
                Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      weather.temp.toStringAsFixed(1),
                      style: TextStyle(
                        fontSize: scaler.scale(40),
                        color: Theme.of(context).brightness == Brightness.light
                            ? AppTextColorLight.primary
                            : AppTextColorDark.primary,
                        height: 0.95,
                      ),
                    ),
                    Text(
                      weather.condition,
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
        }),
      ),
    );
  }
}
