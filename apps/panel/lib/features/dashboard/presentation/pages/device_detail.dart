import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/features/dashboard/mappers/device.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/device_detail.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/view.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

class DeviceDetailPage extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  final DeviceDetailPageView page;

  DeviceDetailPage({super.key, required this.page});

  @override
  Widget build(BuildContext context) {
    return Consumer<DevicesService>(builder: (
      context,
      devicesService,
      _,
    ) {
      final DeviceView? device = devicesService.getDevice(page.device);

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

      return buildDeviceDetail(device);
    });
  }
}
