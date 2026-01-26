import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/system_pages/export.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Screen shown when display configuration is invalid.
///
/// This is displayed when the display cannot be used due to
/// configuration issues (e.g., Room display without roomId).
class ConfigErrorScreen extends StatelessWidget {
  final String errorMessage;
  final VoidCallback? onHintTap;

  const ConfigErrorScreen({
    super.key,
    required this.errorMessage,
    this.onHintTap,
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
                  _getSystemPagePadding(screenService, isLandscape),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    // Warning icon
                    _buildSystemPageIcon(
                      screenService: screenService,
                      icon: MdiIcons.cogOff,
                      color: SystemPagesTheme.warning(isDark),
                      isLandscape: isLandscape,
                    ),
                    SizedBox(
                      height: _getIconBottomSpacing(screenService, isLandscape),
                    ),
                    // Title
                    Text(
                      localizations.config_error_title,
                      style: TextStyle(
                        color: SystemPagesTheme.textPrimary(isDark),
                        fontSize: screenService.scale(24),
                        fontWeight: FontWeight.w500,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    SizedBox(height: AppSpacings.pMd),
                    // Message
                    Text(
                      errorMessage,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: SystemPagesTheme.textMuted(isDark),
                        fontSize: AppFontSize.base,
                        height: 1.5,
                      ),
                    ),
                    // Hint card
                    SizedBox(height: AppSpacings.pLg + AppSpacings.pMd),
                    _buildHintCard(
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

  /// Returns the appropriate padding for system pages based on screen size and orientation
  double _getSystemPagePadding(ScreenService screenService, bool isLandscape) {
    if (isLandscape) {
      return screenService.isLargeScreen ? AppSpacings.pXl : AppSpacings.pLg;
    } else {
      return screenService.isSmallScreen ? AppSpacings.pLg : AppSpacings.pXl;
    }
  }

  /// Builds the system page icon with responsive sizing
  Widget _buildSystemPageIcon({
    required ScreenService screenService,
    required IconData icon,
    required Color color,
    required bool isLandscape,
  }) {
    final isCompact =
        screenService.isSmallScreen || screenService.isMediumScreen;
    final isCompactLandscape = isCompact && isLandscape;

    final containerSize = screenService.scale(isCompactLandscape ? 56 : 80);
    final iconSize = screenService.scale(isCompactLandscape ? 28 : 40);

    return IconContainer(
      icon: icon,
      color: color,
      size: containerSize,
      iconSize: iconSize,
    );
  }

  /// Returns the spacing below the icon based on orientation and size
  double _getIconBottomSpacing(ScreenService screenService, bool isLandscape) {
    final isCompact =
        screenService.isSmallScreen || screenService.isMediumScreen;
    final isCompactLandscape = isCompact && isLandscape;

    return screenService.scale(isCompactLandscape ? 12 : 24);
  }

  /// Builds the info hint card
  Widget _buildHintCard({
    required BuildContext context,
    required ScreenService screenService,
    required AppLocalizations localizations,
    required bool isDark,
    required bool isLandscape,
  }) {
    final hintPrefix = localizations.config_error_hint_prefix;
    final hintPath = localizations.config_error_hint_path;
    final hintText = isLandscape ? '$hintPrefix $hintPath' : '$hintPrefix\n$hintPath';

    // Smaller padding for portrait on small devices
    final isSmallPortrait = !isLandscape && screenService.isSmallScreen;
    final horizontalPadding =
        isSmallPortrait ? AppSpacings.pMd + AppSpacings.pSm : AppSpacings.pLg + AppSpacings.pMd;
    final verticalPadding =
        isSmallPortrait ? AppSpacings.pMd + AppSpacings.pSm : AppSpacings.pLg;

    return GestureDetector(
      onTap: onHintTap,
      child: Container(
        padding: EdgeInsets.symmetric(
          horizontal: horizontalPadding,
          vertical: verticalPadding,
        ),
        decoration: BoxDecoration(
          color: SystemPagesTheme.card(isDark),
          borderRadius: BorderRadius.circular(AppBorderRadius.medium),
          boxShadow: isDark
              ? null
              : [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: AppSpacings.pMd,
                    offset: Offset(0, AppSpacings.pXs),
                  ),
                ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: screenService.scale(40),
              height: screenService.scale(40),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: SystemPagesTheme.infoLight(isDark),
                borderRadius: BorderRadius.circular(screenService.scale(10)),
              ),
              child: Icon(
                MdiIcons.informationOutline,
                color: SystemPagesTheme.info(isDark),
                size: screenService.scale(22),
              ),
            ),
            SizedBox(width: AppSpacings.pMd + AppSpacings.pSm),
            Flexible(
              child: Text(
                hintText,
                style: TextStyle(
                  color: SystemPagesTheme.info(isDark),
                  fontSize: AppFontSize.base,
                  height: 1.1,
                ),
              ),
            ),
            SizedBox(width: AppSpacings.pMd + AppSpacings.pSm),
            Icon(
              Icons.chevron_right,
              color: SystemPagesTheme.textMuted(isDark),
              size: AppSpacings.pLg + AppSpacings.pSm,
            ),
          ],
        ),
      ),
    );
  }
}
