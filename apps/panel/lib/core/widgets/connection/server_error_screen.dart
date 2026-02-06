import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/system_pages/export.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';

/// Full-screen error shown when server is unavailable.
///
/// This screen is displayed when the server is reachable but returning
/// error responses (503 Service Unavailable, maintenance mode, etc.).
class ServerErrorScreen extends StatelessWidget {
  final VoidCallback? onRetry;

  const ServerErrorScreen({
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
                    // Server off icon
                    SystemPagesLayout.buildIcon(
                      screenService: screenService,
                      icon: MdiIcons.serverOff,
                      color: SystemPagesTheme.warning(isDark),
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
                      localizations.connection_server_error_title,
                      style: TextStyle(
                        color: SystemPagesTheme.textPrimary(isDark),
                        fontSize: AppFontSize.extraLarge,
                        fontWeight: FontWeight.w500,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    AppSpacings.spacingMdVertical,
                    // Message
                    Text(
                      localizations.connection_server_error_message,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: SystemPagesTheme.textMuted(isDark),
                        fontSize: AppFontSize.base,
                        height: 1.5,
                      ),
                    ),
                    AppSpacings.spacingXlVertical,
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
                              .connection_server_error_button_retry),
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
                                .connection_server_error_button_retry),
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
