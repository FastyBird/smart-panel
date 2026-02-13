import 'package:fastybird_smart_panel/api/models/devices_module_device_category.dart';
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
  final String id;
  final String? initialChannelId;

  const DeviceDetailPage(this.id, {this.initialChannelId, super.key});


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
        final isDark = Theme.of(context).brightness == Brightness.dark;

        final warningColor = isDark ? AppColorsDark.warning : AppColorsLight.warning;
        final warningBgColor =
            isDark ? AppColorsDark.warningLight9 : AppColorsLight.warningLight9;

        return Scaffold(
          body: Center(
            child: Padding(
              padding: AppSpacings.paddingXl,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                spacing: AppSpacings.pMd,
                children: [
                  Container(
                    width: AppSpacings.scale(80),
                    height: AppSpacings.scale(80),
                    decoration: BoxDecoration(
                      color: warningBgColor,
                      shape: BoxShape.circle,
                    ),
                    child: Icon(
                      MdiIcons.alertCircleOutline,
                      size: AppSpacings.scale(48),
                      color: warningColor,
                    ),
                  ),
                  Text(
                    localizations.message_error_device_not_found_title,
                    style: TextStyle(
                      fontSize: AppFontSize.large,
                      fontWeight: FontWeight.w600,
                      color:
                          isDark ? AppTextColorDark.primary : AppTextColorLight.primary,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  Text(
                    localizations.message_error_device_not_found_description,
                    style: TextStyle(
                      fontSize: AppFontSize.base,
                      color: isDark
                          ? AppTextColorDark.secondary
                          : AppTextColorLight.secondary,
                    ),
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
                    size: AppSpacings.scale(14),
                    color: Theme.of(context).warning,
                  ),
                  SizedBox(
                    width: AppSpacings.scale(4),
                  ),
                  Text(
                    localizations.device_status_offline,
                    style: TextStyle(
                      fontSize: AppSpacings.scale(12),
                      color: Theme.of(context).warning,
                    ),
                  ),
                ],
              ),
              SizedBox(
                width: AppSpacings.scale(16),
              ),
            ],
            GestureDetector(
              onTap: () => Navigator.pop(context),
              child: Icon(
                MdiIcons.close,
                size: AppSpacings.scale(16),
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
