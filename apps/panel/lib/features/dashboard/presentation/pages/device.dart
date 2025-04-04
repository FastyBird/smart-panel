import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/features/dashboard/mappers/device.dart';
import 'package:fastybird_smart_panel/features/dashboard/services/devices.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/device_page.dart';
import 'package:flutter/material.dart';
import 'package:material_symbols_icons/symbols.dart';
import 'package:provider/provider.dart';

class DevicePage extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();

  final DeviceDetailPageModel page;

  DevicePage({super.key, required this.page});

  @override
  Widget build(BuildContext context) {
    return Consumer<DevicesService>(builder: (
      context,
      devicesService,
      _,
    ) {
      var deviceType = devicesService.getDevice(page.device);

      if (deviceType == null) {
        final localizations = AppLocalizations.of(context)!;

        return Scaffold(
          body: Center(
            child: Padding(
              padding: AppSpacings.paddingMd,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Symbols.warning,
                    color: Theme.of(context).warning,
                    size: _screenService.scale(64),
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

      return buildDeviceDetail(deviceType);
    });
  }
}
