import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/sprinkler.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class SprinklerDeviceDetail extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  final SprinklerDeviceView device;

  SprinklerDeviceDetail({
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
    );
  }
}
