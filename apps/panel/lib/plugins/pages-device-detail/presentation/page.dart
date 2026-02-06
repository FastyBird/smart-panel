import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/top_bar.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/device.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/view.dart';
import 'package:fastybird_smart_panel/plugins/pages-device-detail/views/view.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

class DeviceDetailPage extends StatelessWidget {
  final DeviceDetailPageView page;

  const DeviceDetailPage({super.key, required this.page});

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
                spacing: AppSpacings.pMd,
                children: [
                  Icon(
                    MdiIcons.alert,
                    color: Theme.of(context).warning,
                    size: AppSpacings.scale(64),
                  ),
                  Text(
                    localizations.message_error_device_not_found_title,
                    textAlign: TextAlign.center,
                  ),
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

      return Scaffold(
        appBar: page.showTopBar
            ? AppTopBar(
                title: device.name,
                icon: page.icon ??
                    buildDeviceIcon(
                      device.category,
                      device.icon,
                    ),
              )
            : null,
        body: buildDeviceWidget(device),
      );
    });
  }
}
