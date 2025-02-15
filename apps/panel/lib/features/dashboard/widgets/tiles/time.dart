import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/datetime.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/tiles/data_source/data_source.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/tiles/time.dart';
import 'package:fastybird_smart_panel/features/dashboard/widgets/tiles/tile.dart';
import 'package:flutter/material.dart';

class TimeTileWidget
    extends TileWidget<TimeTileModel, List<TileDataSourceModel>> {
  final ScreenService _screenService = locator<ScreenService>();

  TimeTileWidget(super.tile, super.dataSource, {super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      alignment: Alignment.centerLeft,
      child: Padding(
        padding: AppSpacings.paddingSm,
        child: StreamBuilder<DateTime>(
            stream: DatetimeUtils.getTimeStream(),
            builder: (context, snapshot) {
              final now = snapshot.data ?? DateTime.now();

              return FittedBox(
                fit: BoxFit.scaleDown,
                child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        DatetimeUtils.getFormattedTime(now),
                        style: TextStyle(
                          fontSize: _screenService.scale(90),
                          color:
                              Theme.of(context).brightness == Brightness.light
                                  ? AppTextColorLight.primary
                                  : AppTextColorDark.primary,
                          fontWeight: FontWeight.bold,
                          height: 0.95,
                        ),
                      ),
                      Text(
                        DatetimeUtils.getFormattedDate(now),
                        style: TextStyle(
                          fontSize: _screenService.scale(25),
                          color:
                              Theme.of(context).brightness == Brightness.light
                                  ? AppTextColorLight.secondary
                                  : AppTextColorDark.secondary,
                          height: 0.95,
                        ),
                      ),
                    ]),
              );
            }),
      ),
    );
  }
}
