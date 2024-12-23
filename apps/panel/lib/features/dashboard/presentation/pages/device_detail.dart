import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen_scaler.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/features/dashboard/mappers/device.dart';
import 'package:fastybird_smart_panel/features/dashboard/repositories/data/devices/devices.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class DeviceDetailPage extends StatelessWidget {
  final ScreenScalerService scaler = locator<ScreenScalerService>();

  final String id;

  DeviceDetailPage(this.id, {super.key});

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

      var device = devicesRepository.getById(id);

      if (device == null) {
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
                  const Text(
                    'Device Not Found!',
                    textAlign: TextAlign.center,
                  ),
                  AppSpacings.spacingSmVertical,
                  const Text(
                    'Requested device could not be found in the application.',
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
        );
      }

      return buildDeviceWidget(device);
    });
  }
}
