import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen_scaler.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/screen_app_bar.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/camera.dart';
import 'package:fastybird_smart_panel/generated_l10n/app_localizations.dart';
import 'package:flutter/material.dart';

class CameraDeviceDetailPage extends StatelessWidget {
  final ScreenScalerService scaler = locator<ScreenScalerService>();

  final CameraDeviceDataModel device;

  CameraDeviceDetailPage({
    super.key,
    required this.device,
  });

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

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
              Text(
                localizations.message_error_no_device_detail_preparing_title,
                textAlign: TextAlign.center,
              ),
              AppSpacings.spacingSmVertical,
              Text(
                localizations
                    .message_error_no_device_detail_preparing_description,
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
