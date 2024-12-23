import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen_scaler.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/features/dashboard/mappers/device.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/device.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/properties.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/tiles/data_source/data_source.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/tiles/data_source/device.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/tiles/device.dart';
import 'package:fastybird_smart_panel/features/dashboard/repositories/data/devices/devices.dart';
import 'package:fastybird_smart_panel/features/dashboard/repositories/data/devices/properties.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';
import 'package:fastybird_smart_panel/features/dashboard/widgets/tiles/button.dart';
import 'package:fastybird_smart_panel/features/dashboard/widgets/tiles/tile.dart';
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
      var device = devicesRepository.getById(tile.device);

      if (device == null) {
        return _renderLoader(context);
      }

      return _renderButton(
        context,
        tile,
        dataSource.whereType<DeviceTileDataSourceModel>().toList(),
        device,
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

  Widget _renderButton(
    BuildContext context,
    DeviceTileModel tile,
    List<DeviceTileDataSourceModel> dataSource,
    DeviceDataModel device,
  ) {
    return Consumer<ChannelsPropertiesDataRepository>(builder: (
      context,
      channelsPropertiesRepository,
      _,
    ) {
      var properties = channelsPropertiesRepository.getByIds(
        dataSource
            .map(
              (dataSource) => dataSource.property,
            )
            .toList(),
      );

      var stateProperties = channelsPropertiesRepository
          .getByIds(
            dataSource
                .map(
                  (dataSource) => dataSource.property,
                )
                .toList(),
          )
          .where(
            (property) => property.category == PropertyCategoryType.on,
          );

      bool isOn = stateProperties.isEmpty
          ? false
          : stateProperties.every((property) => property.isActive);

      return ButtonTileWidget(
        tile: tile,
        onTap: () {
          if (kDebugMode) {
            print('Open detail for device: ${device.name}');
          }

          Navigator.pushNamed(context, '/device/${device.id}');
        },
        onIconTap: stateProperties.isEmpty
            ? null
            : () {
                if (kDebugMode) {
                  print(
                    'Toggle state for device: ${device.name}',
                  );
                }

                for (var property in stateProperties) {
                  channelsPropertiesRepository.toggleValue(property.id);
                }
              },
        title: device.name,
        subTitle: LayoutBuilder(builder: (context, constraints) {
          List<Widget> values = properties
              .map(
                (property) => _renderStateValue(property),
              )
              .whereType<Widget>()
              .toList();

          return Row(
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
        isOn: isOn,
        isLoading: channelsPropertiesRepository.isLoading,
      );
    });
  }

  Widget? _renderStateValue(ChannelPropertyDataModel property) {
    List<Widget> parts = [];

    switch (property.category) {
      case PropertyCategoryType.on:
        parts = [
          Icon(Icons.power_settings_new),
          AppSpacings.spacingXsHorizontal,
          Text(property.isActive ? 'On' : 'Off'),
        ];
        break;
      case PropertyCategoryType.brightness:
        parts = [
          Icon(Icons.light_mode),
          AppSpacings.spacingXsHorizontal,
          Text(property.formattedValue ?? 'N/A'),
        ];
        break;
      default:
        parts = [];
        break;
    }

    if (parts.isEmpty) {
      return null;
    }

    if (property.unit != null) {
      parts.add(
        Text(property.unit!),
      );
    }

    return Row(
      children: parts,
    );
  }
}
