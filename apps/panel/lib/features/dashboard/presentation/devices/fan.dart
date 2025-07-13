import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/top_bar.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/device_detail.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/fan.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class FanDeviceDetailPage extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  final FanDeviceView device;
  final DeviceDetailPageView? page;

  FanDeviceDetailPage({
    super.key,
    required this.device,
    required this.page,
  });

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    return Scaffold(
      appBar: AppTopBar(
        title: device.name,
      ),
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
