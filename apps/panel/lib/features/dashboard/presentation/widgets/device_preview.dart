import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_bar.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/channels/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/devices/type.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/widgets/button.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/widgets/tile.dart';
import 'package:fastybird_smart_panel/features/dashboard/services/devices.dart';
import 'package:fastybird_smart_panel/features/dashboard/utils/value.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/data_source.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/device_channel_data_source.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/device_tile.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:material_symbols_icons/symbols.dart';
import 'package:provider/provider.dart';

class DevicePreviewTileWidget
    extends TileWidget<DevicePreviewTileModel, List<DataSourceModel>> {
  final ScreenService _screenService = locator<ScreenService>();

  DevicePreviewTileWidget(super.tile, super.dataSource, {super.key});

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    return Consumer<DevicesService>(builder: (
      context,
      devicesService,
      _,
    ) {
      final deviceType = devicesService.getDevice(tile.device);

      if (deviceType == null) {
        return _renderLoader(context);
      }

      final List<DeviceChannelDataSourceModel> dataSources =
          dataSource.whereType<DeviceChannelDataSourceModel>().toList();

      return ButtonTileWidget(
        tile: tile,
        onTap: () {
          if (kDebugMode) {
            debugPrint('Open detail for device: ${deviceType.name}');
          }

          Navigator.pushNamed(context, '/device/${deviceType.id}');
        },
        onIconTap: deviceType.isOn == null
            ? null
            : () async {
                if (kDebugMode) {
                  debugPrint(
                    'Toggle state for device: ${deviceType.name}',
                  );
                }

                bool res = await devicesService.toggleDeviceOnState(
                  deviceType.id,
                );

                if (!res && context.mounted) {
                  AlertBar.showError(
                    context,
                    message: localizations.action_failed,
                  );
                }
              },
        title: deviceType.name,
        subTitle: LayoutBuilder(builder: (context, constraints) {
          List<Widget> values = dataSources
              .map(
                (dataSource) => _renderStateValue(
                  context,
                  deviceType,
                  dataSource,
                ),
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
        icon: _getIcon(tile, deviceType),
        isOn: deviceType.isOn ?? false,
      );
    });
  }

  IconData _getIcon(DevicePreviewTileModel tile, DeviceType deviceType) {
    IconData? tileIcon = tile.icon;

    if (tileIcon != null) {
      return tileIcon;
    }

    return deviceType.icon ?? Symbols.joystick;
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
          width: _screenService.scale(1),
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
    DeviceType deviceType,
    DeviceChannelDataSourceModel dataSource,
  ) {
    final localizations = AppLocalizations.of(context)!;

    Capability? capability = deviceType.getCapability(dataSource.channel);

    if (capability == null) {
      return null;
    }

    ChannelPropertyModel? property =
        capability.getProperty(dataSource.property);

    if (property == null) {
      return null;
    }

    List<Widget> parts = [];

    switch (property.category) {
      case PropertyCategory.on:
        final value = property.value;
        final isOn = value is BooleanValueType ? value.value : false;

        parts = [
          Baseline(
            baseline: AppFontSize.small,
            baselineType: TextBaseline.alphabetic,
            child: Icon(
              dataSource.icon ?? Symbols.power_settings_new,
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
      case PropertyCategory.brightness:
        parts = [
          Baseline(
            baseline: AppFontSize.small,
            baselineType: TextBaseline.alphabetic,
            child: Icon(
              dataSource.icon ?? Symbols.light_mode,
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
