import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen_scaler.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/generated_l10n/app_localizations.dart';
import 'package:flutter/material.dart';

class ResetScreen extends StatelessWidget {
  const ResetScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final ScreenScalerService scaler = locator<ScreenScalerService>();
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
            children: [
              SizedBox(
                width: scaler.scale(50),
                height: scaler.scale(50),
                child: const CircularProgressIndicator(),
              ),
              AppSpacings.spacingLgVertical,
              Text(
                localizations.message_info_factory_reset_title,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontWeight: FontWeight.w600,
                ),
              ),
              AppSpacings.spacingSmVertical,
              Text(
                localizations.message_info_factory_reset_description,
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
