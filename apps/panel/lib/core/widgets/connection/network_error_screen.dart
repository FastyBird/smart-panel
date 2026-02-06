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

  const NetworkErrorScreen({
    super.key,
    this.onRetry,
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
                    // Retry button
                    if (isLandscape)
                      Theme(
                        data: Theme.of(context).copyWith(
                          filledButtonTheme: isDark
                              ? AppFilledButtonsDarkThemes.primary
                              : AppFilledButtonsLightThemes.primary,
                        ),
                        child: FilledButton.icon(
                          onPressed: onRetry,
                          icon: Icon(
                            MdiIcons.refresh,
                            size: AppFontSize.base,
                            color: isDark
                                ? AppFilledButtonsDarkThemes
                                    .primaryForegroundColor
                                : AppFilledButtonsLightThemes
                                    .primaryForegroundColor,
                          ),
                          label: Text(localizations
                              .connection_network_error_button_retry),
                        ),
                      )
                    else
                      SizedBox(
                        width: double.infinity,
                        child: Theme(
                          data: Theme.of(context).copyWith(
                            filledButtonTheme: isDark
                                ? AppFilledButtonsDarkThemes.primary
                                : AppFilledButtonsLightThemes.primary,
                          ),
                          child: FilledButton.icon(
                            onPressed: onRetry,
                            icon: Icon(
                              MdiIcons.refresh,
                              color: isDark
                                  ? AppFilledButtonsDarkThemes
                                      .primaryForegroundColor
                                  : AppFilledButtonsLightThemes
                                      .primaryForegroundColor,
                            ),
                            label: Text(localizations
                                .connection_network_error_button_retry),
                          ),
                        ),
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

}
