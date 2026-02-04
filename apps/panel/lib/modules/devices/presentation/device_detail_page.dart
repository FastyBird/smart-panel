import 'package:fastybird_smart_panel/api/models/devices_module_device_category.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/top_bar.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/device.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/lighting.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/sensor.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/device_details/window_covering.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/lighting.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/sensor.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/window_covering.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

/// Check whether a device category has a registered detail widget
/// (which provides its own Scaffold + header).
bool _hasCustomDetailWidget(DevicesModuleDeviceCategory category) =>
    deviceWidgetMappers.containsKey(category);

class DeviceDetailPage extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  final String id;
  final String? initialChannelId;

  DeviceDetailPage(this.id, {this.initialChannelId, super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<DevicesService>(builder: (
      context,
      devicesService,
      _,
    ) {
      var device = devicesService.getDevice(id);

      if (device == null) {
        final localizations = AppLocalizations.of(context)!;

        return Scaffold(
          body: Center(
            child: Padding(
              padding: AppSpacings.paddingMd,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    MdiIcons.alert,
                    color: Theme.of(context).warning,
                    size: _screenService.scale(
                      64,
                      density: _visualDensityService.density,
                    ),
                  ),
                  AppSpacings.spacingMdVertical,
                  Text(
                    localizations.message_error_device_not_found_title,
                    textAlign: TextAlign.center,
                  ),
                  AppSpacings.spacingSmVertical,
                  Text(
                    localizations.message_error_device_not_found_description,
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
        );
      }

      // Devices with a registered detail widget provide their own Scaffold
      if (_hasCustomDetailWidget(device.category)) {
        // For lighting devices, pass initial channel ID if available
        if (device.category == DevicesModuleDeviceCategory.lighting &&
            device is LightingDeviceView) {
          return LightingDeviceDetail(
            device: device,
            initialChannelId: initialChannelId,
          );
        }
        // For window covering devices, pass initial channel ID if available
        if (device.category == DevicesModuleDeviceCategory.windowCovering &&
            device is WindowCoveringDeviceView) {
          return WindowCoveringDeviceDetail(
            device: device,
            initialChannelId: initialChannelId,
          );
        }
        // For sensor devices, pass initial channel ID to preselect the sensor
        if (device.category == DevicesModuleDeviceCategory.sensor &&
            device is SensorDeviceView) {
          return SensorDeviceDetail(
            device: device,
            initialChannelId: initialChannelId,
          );
        }
        return buildDeviceWidget(device);
      }

      final localizations = AppLocalizations.of(context)!;

      return Scaffold(
        appBar: AppTopBar(
          title: device.name,
          icon: buildDeviceIcon(device.category, device.icon),
          actions: [
            // Offline indicator
            if (!device.isOnline) ...[
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    MdiIcons.alert,
                    size: _screenService.scale(
                      14,
                      density: _visualDensityService.density,
                    ),
                    color: Theme.of(context).warning,
                  ),
                  SizedBox(
                    width: _screenService.scale(
                      4,
                      density: _visualDensityService.density,
                    ),
                  ),
                  Text(
                    localizations.device_status_offline,
                    style: TextStyle(
                      fontSize: _screenService.scale(
                        12,
                        density: _visualDensityService.density,
                      ),
                      color: Theme.of(context).warning,
                    ),
                  ),
                ],
              ),
              SizedBox(
                width: _screenService.scale(
                  16,
                  density: _visualDensityService.density,
                ),
              ),
            ],
            GestureDetector(
              onTap: () => Navigator.pop(context),
              child: Icon(
                MdiIcons.close,
                size: _screenService.scale(
                  16,
                  density: _visualDensityService.density,
                ),
                color: Theme.of(context).brightness == Brightness.light
                    ? AppTextColorLight.regular
                    : AppTextColorDark.regular,
              ),
            ),
          ],
        ),
        body: buildDeviceWidget(device),
      );
    });
  }
}
