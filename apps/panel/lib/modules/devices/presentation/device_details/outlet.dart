import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/outlet.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class OutletDeviceDetail extends StatelessWidget {
  final OutletDeviceView device;

  const OutletDeviceDetail({
    super.key,
    required this.device,
  });

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    return Center(
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
  }
}
