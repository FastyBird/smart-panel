import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen_scaler.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/features/dashboard/mappers/device.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/pages/device.dart';
import 'package:fastybird_smart_panel/features/dashboard/repositories/data/devices/devices.dart';
import 'package:fastybird_smart_panel/generated_l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class DevicePage extends StatelessWidget {
  final ScreenScalerService scaler = locator<ScreenScalerService>();

  final DevicePageModel page;

  DevicePage({super.key, required this.page});

  @override
  Widget build(BuildContext context) {
    return Consumer<DevicesDataRepository>(builder: (
      context,
      devicesRepository,
      _,
    ) {
      if (devicesRepository.isLoading) {
        return Scaffold(
          body: Center(
            child: SizedBox(
              width: scaler.scale(50),
              height: scaler.scale(50),
              child: const CircularProgressIndicator(),
            ),
          ),
        );
      }

      var device = devicesRepository.getDevice(page.device);

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
                    size: scaler.scale(64),
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
