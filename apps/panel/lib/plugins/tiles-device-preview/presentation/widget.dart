import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_bar.dart';
import 'package:fastybird_smart_panel/features/dashboard/mappers/data_source.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/widgets/tiles/button.dart';
import 'package:fastybird_smart_panel/features/dashboard/presentation/widgets/tiles/tile.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/plugins/tiles-device-preview/views/view.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/device.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/view.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class DevicePreviewTileWidget extends TileWidget<DevicePreviewTileView> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  DevicePreviewTileWidget(super.tile, {super.key});

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
        return _renderLoader(context);
      }

      return ButtonTileWidget(
        tile: tile,
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
                  AlertBar.showError(
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
          width: _screenService.scale(
            1,
            density: _visualDensityService.density,
          ),
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
