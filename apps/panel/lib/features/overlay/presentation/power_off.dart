import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';

class PowerOffScreen extends StatelessWidget {
  const PowerOffScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final ScreenService screenService = locator<ScreenService>();
    final VisualDensityService visualDensityService =
        locator<VisualDensityService>();
    final localizations = AppLocalizations.of(context)!;

    return Scaffold(
      body: Center(
        child: Padding(
          padding: EdgeInsets.symmetric(
            vertical: AppSpacings.pMd,
            horizontal: AppSpacings.pLg,
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            spacing: AppSpacings.pMd,
            children: [
              SizedBox(
                width: screenService.scale(
                  50,
                  density: visualDensityService.density,
                ),
                height: screenService.scale(
                  50,
                  density: visualDensityService.density,
                ),
                child: const CircularProgressIndicator(),
              ),
              Text(
                localizations.message_info_app_power_off_title,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                ),
              ),
              Text(
                localizations.message_info_app_power_off_description,
                textAlign: TextAlign.justify,
                style: TextStyle(
                  fontSize: AppFontSize.small,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
