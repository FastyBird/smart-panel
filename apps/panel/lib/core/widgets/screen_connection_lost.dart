import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/system_pages/export.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';

/// Screen shown when connection to the gateway is lost.
///
/// Provides options to reconnect or change to a different gateway.
class ConnectionLostScreen extends StatelessWidget {
  final VoidCallback? onReconnect;
  final VoidCallback? onChangeGateway;

  const ConnectionLostScreen({
    super.key,
    this.onReconnect,
    this.onChangeGateway,
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
                    // Error WiFi icon
                    SystemPagesLayout.buildIcon(
                      screenService: screenService,
                      icon: MdiIcons.wifiOff,
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
                      localizations.connection_lost_title,
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
                      localizations.connection_lost_message,
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
                      context: context,
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

  /// Builds the action buttons
  Widget _buildButtons({
    required BuildContext context,
    required ScreenService screenService,
    required AppLocalizations localizations,
    required bool isDark,
    required bool isLandscape,
  }) {
    if (isLandscape) {
      return Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Theme(
            data: Theme.of(context).copyWith(
              filledButtonTheme: isDark
                  ? AppFilledButtonsDarkThemes.primary
                  : AppFilledButtonsLightThemes.primary,
            ),
            child: FilledButton.icon(
              onPressed: onReconnect,
              icon: Icon(
                MdiIcons.cached,
                size: AppFontSize.base,
                color: isDark
                    ? AppFilledButtonsDarkThemes.primaryForegroundColor
                    : AppFilledButtonsLightThemes.primaryForegroundColor,
              ),
              label: Text(
                  localizations.connection_lost_button_reconnect),
            ),
          ),
          SizedBox(width: AppSpacings.pLg),
          Theme(
            data: Theme.of(context).copyWith(
              outlinedButtonTheme: isDark
                  ? AppOutlinedButtonsDarkThemes.primary
                  : AppOutlinedButtonsLightThemes.primary,
            ),
            child: OutlinedButton.icon(
              onPressed: onChangeGateway,
              icon: Icon(
                MdiIcons.wifi,
                size: AppFontSize.base,
                color: isDark
                    ? AppOutlinedButtonsDarkThemes.primaryForegroundColor
                    : AppOutlinedButtonsLightThemes.primaryForegroundColor,
              ),
              label: Text(localizations
                  .connection_lost_button_change_gateway),
            ),
          ),
        ],
      );
    }

    return Column(
      children: [
        SizedBox(
          width: double.infinity,
          child: Theme(
            data: Theme.of(context).copyWith(
              filledButtonTheme: isDark
                  ? AppFilledButtonsDarkThemes.primary
                  : AppFilledButtonsLightThemes.primary,
            ),
            child: FilledButton.icon(
              onPressed: onReconnect,
              icon: Icon(
                MdiIcons.cached,
                size: AppFontSize.base,
                color: isDark
                    ? AppFilledButtonsDarkThemes.primaryForegroundColor
                    : AppFilledButtonsLightThemes.primaryForegroundColor,
              ),
              label: Text(
                  localizations.connection_lost_button_reconnect),
            ),
          ),
        ),
        SizedBox(height: AppSpacings.pMd + AppSpacings.pSm),
        SizedBox(
          width: double.infinity,
          child: Theme(
            data: Theme.of(context).copyWith(
              outlinedButtonTheme: isDark
                  ? AppOutlinedButtonsDarkThemes.primary
                  : AppOutlinedButtonsLightThemes.primary,
            ),
            child: OutlinedButton.icon(
              onPressed: onChangeGateway,
              icon: Icon(
                MdiIcons.wifi,
                size: AppFontSize.base,
                color: isDark
                    ? AppOutlinedButtonsDarkThemes.primaryForegroundColor
                    : AppOutlinedButtonsLightThemes.primaryForegroundColor,
              ),
              label: Text(localizations
                  .connection_lost_button_change_gateway),
            ),
          ),
        ),
      ],
    );
  }
}
