import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/system_pages/export.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';

/// Full-screen error shown when network is unavailable.
///
/// This screen is displayed when the panel cannot reach the server
/// due to network connectivity issues (no WiFi, DNS failure, etc.).
class NetworkErrorScreen extends StatelessWidget {
  final VoidCallback? onRetry;
  final VoidCallback? onOpenSettings;

  const NetworkErrorScreen({
    super.key,
    this.onRetry,
    this.onOpenSettings,
  });

  @override
  Widget build(BuildContext context) {
    final screenService = locator<ScreenService>();
    final localizations = AppLocalizations.of(context)!;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: SystemPagesTheme.background(isDark),
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final isLandscape = constraints.maxWidth > constraints.maxHeight;

            return Center(
              child: Padding(
                padding: EdgeInsets.all(
                  SystemPagesLayout.getPagePadding(screenService, isLandscape),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    // Network off icon
                    SystemPagesLayout.buildIcon(
                      screenService: screenService,
                      icon: MdiIcons.networkOff,
                      color: SystemPagesTheme.error(isDark),
                      isLandscape: isLandscape,
                    ),
                    SizedBox(
                      height: SystemPagesLayout.getIconBottomSpacing(
                        screenService,
                        isLandscape,
                      ),
                    ),
                    // Title
                    Text(
                      localizations.connection_network_error_title,
                      style: TextStyle(
                        color: SystemPagesTheme.textPrimary(isDark),
                        fontSize: AppFontSize.extraLarge,
                        fontWeight: FontWeight.w500,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    SizedBox(height: AppSpacings.pMd),
                    // Message
                    Text(
                      localizations.connection_network_error_message,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: SystemPagesTheme.textMuted(isDark),
                        fontSize: AppFontSize.base,
                        height: 1.5,
                      ),
                    ),
                    SizedBox(height: AppSpacings.pXl),
                    // Buttons
                    _buildButtons(
                      screenService: screenService,
                      localizations: localizations,
                      isDark: isDark,
                      isLandscape: isLandscape,
                    ),
                  ],
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildButtons({
    required ScreenService screenService,
    required AppLocalizations localizations,
    required bool isDark,
    required bool isLandscape,
  }) {
    if (isLandscape) {
      return Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          SystemPagePrimaryButton(
            label: localizations.connection_network_error_button_retry,
            icon: MdiIcons.refresh,
            onPressed: onRetry,
            isDark: isDark,
          ),
          SizedBox(width: AppSpacings.pLg),
          SystemPageSecondaryButton(
            label: localizations.connection_network_error_button_settings,
            icon: MdiIcons.cog,
            onPressed: onOpenSettings,
            isDark: isDark,
          ),
        ],
      );
    }

    return Column(
      children: [
        SizedBox(
          width: double.infinity,
          child: SystemPagePrimaryButton(
            label: localizations.connection_network_error_button_retry,
            icon: MdiIcons.refresh,
            onPressed: onRetry,
            minWidth: double.infinity,
            isDark: isDark,
          ),
        ),
        SizedBox(height: AppSpacings.pMd + AppSpacings.pSm),
        SizedBox(
          width: double.infinity,
          child: SystemPageSecondaryButton(
            label: localizations.connection_network_error_button_settings,
            icon: MdiIcons.cog,
            onPressed: onOpenSettings,
            isDark: isDark,
            minWidth: double.infinity,
          ),
        ),
      ],
    );
  }
}
