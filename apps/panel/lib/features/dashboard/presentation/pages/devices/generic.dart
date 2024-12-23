import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen_scaler.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/screen_app_bar.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/device.dart';
import 'package:flutter/material.dart';

class GenericDeviceDetailPage extends StatelessWidget {
  final ScreenScalerService scaler = locator<ScreenScalerService>();

  final DeviceDataModel device;

  GenericDeviceDetailPage({
    super.key,
    required this.device,
  });

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: ScreenAppBar(
        title: device.name,
      ),
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
                'No device detail!',
                textAlign: TextAlign.center,
              ),
              AppSpacings.spacingSmVertical,
              const Text(
                'For selected device is not available a detail page.',
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
