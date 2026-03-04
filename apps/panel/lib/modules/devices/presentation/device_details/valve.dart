import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/device.dart'
    show buildDeviceIcon;
import 'package:fastybird_smart_panel/modules/devices/models/device_detail_config.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/valve.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class ValveDeviceDetail extends StatelessWidget {
  final ValveDeviceView device;
  final DeviceDetailConfig? config;

  const ValveDeviceDetail({
    super.key,
    required this.device,
    this.config,
  });

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final body = Center(
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
              localizations.message_error_no_device_detail_preparing_title,
              textAlign: TextAlign.center,
            ),
            Text(
              localizations
                  .message_error_no_device_detail_preparing_description,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );

    if (!(config?.showHeader ?? true)) return body;

    final showBack = config?.showBackButton ?? true;
    final iconData =
        config?.iconOverride ?? buildDeviceIcon(device.category, device.icon);

    return Scaffold(
      backgroundColor: isDark ? AppBgColorDark.page : AppBgColorLight.page,
      body: SafeArea(
        child: Column(
          children: [
            PageHeader(
              title: config?.titleOverride ?? device.name,
              leading: showBack
                  ? Row(
                      mainAxisSize: MainAxisSize.min,
                      spacing: AppSpacings.pMd,
                      children: [
                        HeaderIconButton(
                          icon: MdiIcons.arrowLeft,
                          onTap: () => Navigator.of(context).pop(),
                        ),
                        HeaderMainIcon(icon: iconData),
                      ],
                    )
                  : HeaderMainIcon(icon: iconData),
              trailing: config?.trailing,
            ),
            Expanded(child: body),
          ],
        ),
      ),
    );
  }
}
