import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/toast.dart';
import 'package:fastybird_smart_panel/core/widgets/button_tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/mappers/data_source.dart';
import 'package:fastybird_smart_panel/modules/dashboard/presentation/widgets/tiles/tile.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/plugins/tiles-device-preview/views/view.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/device.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/view.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class DevicePreviewTileWidget extends TileWidget<DevicePreviewTileView> {
  const DevicePreviewTileWidget(super.tile, {super.key});

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    return Consumer<DevicesService>(builder: (
      context,
      devicesService,
      _,
    ) {
      final DeviceView? device = devicesService.getDevice(tile.device);

      if (device == null) {
        // A tile holds a device id from configuration, and the device behind it
        // can be gone: deleted, or hidden because a virtual device replaced it,
        // which drops it from this panel's repository. Before the first read the
        // id is simply not known yet, and a loader is right; after it, a loader
        // is a spinner that never stops.
        return devicesService.devicesLoaded
            ? _renderUnavailable(context, localizations)
            : _renderLoader(context);
      }

      return ButtonTileWidget(
        rowSpan: tile.rowSpan,
        colSpan: tile.colSpan,
        onTap: () {
          if (kDebugMode) {
            debugPrint('Open detail for device: ${device.name}');
          }

          Navigator.pushNamed(context, '/device/${device.id}');
        },
        onIconTap: device.isOn == null
            ? null
            : () async {
                if (kDebugMode) {
                  debugPrint(
                    'Toggle state for device: ${device.name}',
                  );
                }

                bool res = await devicesService.toggleDeviceOnState(
                  device.id,
                );

                if (!res && context.mounted) {
                  Toast.showError(
                    context,
                    message: localizations.action_failed,
                  );
                }
              },
        title: device.name,
        subTitle: LayoutBuilder(builder: (context, constraints) {
          List<Widget> values = tile.dataSources
              .map(
                (dataSource) => buildDataSourceWidget(dataSource),
              )
              .toList();

          return Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
            children: values
                .expand((widget) => [
                      widget,
                      if (widget != values.last) AppSpacings.spacingSmHorizontal,
                    ])
                .toList(),
          );
        }),
        icon: _getIcon(tile, device),
        isOn: device.isOn ?? false,
      );
    });
  }

  IconData _getIcon(DevicePreviewTileView tile, DeviceView device) {
    IconData? tileIcon = tile.icon;

    if (tileIcon != null) {
      return tileIcon;
    }

    IconData? deviceIcon = device.icon;

    if (deviceIcon != null) {
      return deviceIcon;
    }

    return buildDeviceIcon(device.category, device.icon);
  }

  /// Shown in place of a device that is no longer there. Same frame as the
  /// loader it replaces, so the tile keeps its footprint in the grid.
  Widget _renderUnavailable(
    BuildContext context,
    AppLocalizations localizations,
  ) {
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
          width: AppSpacings.scale(1),
        ),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Icon(
            Icons.help_outline,
            color: Theme.of(context).brightness == Brightness.light
                ? AppColorsLight.info
                : AppColorsDark.info,
          ),
          SizedBox(height: AppSpacings.pSm),
          Text(
            localizations.message_error_device_not_found_title,
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
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
          width: AppSpacings.scale(1),
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
}
