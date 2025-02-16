import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/features/dashboard/mappers/device.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/pages/device.dart';
import 'package:fastybird_smart_panel/features/dashboard/repositories/data/devices/devices_module.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class DevicePage extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();

  final DevicePageModel page;

  DevicePage({super.key, required this.page});

  @override
  Widget build(BuildContext context) {
    return Consumer<DevicesModuleRepository>(builder: (
      context,
      devicesModuleRepository,
      _,
    ) {
      if (devicesModuleRepository.isLoading) {
        return Scaffold(
          body: Center(
            child: SizedBox(
              width: _screenService.scale(50),
              height: _screenService.scale(50),
              child: const CircularProgressIndicator(),
            ),
          ),
        );
      }

      var device = devicesModuleRepository.getDevice(page.device);

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
                    Icons.warning,
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

      return buildDeviceDetail(device);
    });
  }
}
