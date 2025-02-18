import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/screen_app_bar.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/devices/sprinkler.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/devices/sprinkler.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';

class SprinklerDeviceDetailPage extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();

  final SprinklerDeviceDataModel device;
  final SprinklerDeviceCapability capability;

  SprinklerDeviceDetailPage({
    super.key,
    required this.device,
    required this.capability,
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
                size: _screenService.scale(64),
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
