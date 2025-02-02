import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen_scaler.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/features/dashboard/mappers/device.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/properties.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/tiles/data_source/data_source.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/tiles/data_source/device.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/tiles/device.dart';
import 'package:fastybird_smart_panel/features/dashboard/repositories/data/devices/devices.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/values.dart';
import 'package:fastybird_smart_panel/features/dashboard/utils/value.dart';
import 'package:fastybird_smart_panel/features/dashboard/widgets/tiles/button.dart';
import 'package:fastybird_smart_panel/features/dashboard/widgets/tiles/tile.dart';
import 'package:fastybird_smart_panel/generated_l10n/app_localizations.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class DeviceTileWidget
    extends TileWidget<DeviceTileModel, List<TileDataSourceModel>> {
  final ScreenScalerService scaler = locator<ScreenScalerService>();

  DeviceTileWidget(super.tile, super.dataSource, {super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<DevicesDataRepository>(builder: (
      context,
      devicesRepository,
      _,
    ) {
      final device = devicesRepository.getDevice(tile.device);

      if (device == null) {
        return _renderLoader(context);
      }

      final List<DeviceTileDataSourceModel> dataSources =
          dataSource.whereType<DeviceTileDataSourceModel>().toList();

      final properties = devicesRepository.getChannelsProperties(
        dataSources
            .map(
              (dataSource) => dataSource.property,
            )
            .toList(),
      );

      return ButtonTileWidget(
        tile: tile,
        onTap: () {
          if (kDebugMode) {
            print('Open detail for device: ${device.name}');
          }

          Navigator.pushNamed(context, '/device/${device.id}');
        },
        onIconTap: device.isOn == null
            ? null
            : () {
                if (kDebugMode) {
                  print(
                    'Toggle state for device: ${device.name}',
                  );
                }

                devicesRepository.toggleDeviceOnState(device.id);
              },
        title: device.name,
        subTitle: LayoutBuilder(builder: (context, constraints) {
          List<Widget> values = properties
              .map(
                (property) => _renderStateValue(context, property),
              )
              .whereType<Widget>()
              .toList();

          return Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            mainAxisAlignment: MainAxisAlignment.center,
            children: values
                .expand((widget) => [
                      widget,
                      if (widget != values.last)
                        AppSpacings.spacingSmHorizontal,
                    ])
                .toList(),
          );
        }),
        icon: buildDeviceIcon(device),
        isOn: device.isOn ?? false,
      );
    });
  }

  Widget _renderLoader(BuildContext context) {
    return Container(
      constraints: const BoxConstraints.expand(),
      decoration: BoxDecoration(
        color: Theme.of(context).brightness == Brightness.light
            ? AppColorsLight.infoLight9
            : AppColorsDark.infoLight9,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        border: Border.all(
          color: Theme.of(context).brightness == Brightness.light
              ? AppColorsLight.infoLight5
              : AppColorsDark.infoLight5,
          width: scaler.scale(1),
        ),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Theme(
            data: ThemeData(
              progressIndicatorTheme: ProgressIndicatorThemeData(
                color: Theme.of(context).brightness == Brightness.light
                    ? AppColorsLight.info
                    : AppColorsDark.info,
                linearTrackColor: AppColors.blank,
              ),
            ),
            child: const CircularProgressIndicator(),
          ),
        ],
      ),
    );
  }

  Widget? _renderStateValue(
    BuildContext context,
    ChannelPropertyDataModel property,
  ) {
    final localizations = AppLocalizations.of(context)!;

    List<Widget> parts = [];

    switch (property.category) {
      case PropertyCategoryType.on:
        final value = property.value;
        final isOn = value is BooleanValueType ? value.value : false;

        parts = [
          Baseline(
            baseline: AppFontSize.small,
            baselineType: TextBaseline.alphabetic,
            child: Icon(
              Icons.power_settings_new,
              size: AppFontSize.small,
            ),
          ),
          AppSpacings.spacingXsHorizontal,
          Baseline(
            baseline: AppFontSize.small,
            baselineType: TextBaseline.alphabetic,
            child: Text(
              isOn ? localizations.on_state_on : localizations.on_state_off,
              style: TextStyle(
                fontSize: AppFontSize.small,
                textBaseline: TextBaseline.alphabetic,
              ),
            ),
          ),
        ];
        break;
      case PropertyCategoryType.brightness:
        parts = [
          Baseline(
            baseline: AppFontSize.small,
            baselineType: TextBaseline.alphabetic,
            child: Icon(
              Icons.light_mode,
              size: AppFontSize.small,
            ),
          ),
          AppSpacings.spacingXsHorizontal,
          Baseline(
            baseline: AppFontSize.small,
            baselineType: TextBaseline.alphabetic,
            child: Text(
              ValueUtils.formatValue(property) ??
                  localizations.value_not_available,
              style: TextStyle(
                fontSize: AppFontSize.small,
                textBaseline: TextBaseline.alphabetic,
              ),
            ),
          ),
        ];
        break;
      default:
        parts = [];
        break;
    }

    if (parts.isEmpty) {
      return null;
    }

    final String? unit = property.unit;

    if (unit != null) {
      parts.add(
        Baseline(
          baseline: AppFontSize.small,
          baselineType: TextBaseline.alphabetic,
          child: Text(
            unit,
            style: TextStyle(
              fontSize: AppFontSize.small,
              textBaseline: TextBaseline.alphabetic,
            ),
          ),
        ),
      );
    }

    return Row(
      children: parts,
    );
  }
}
