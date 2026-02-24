import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/screen_layout.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/icon_container.dart';
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
      backgroundColor: isDark ? AppBgColorDark.base : AppBgColorLight.base,
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final isLandscape = constraints.maxWidth > constraints.maxHeight;

            return Center(
              child: Padding(
                padding: EdgeInsets.all(
                  screenService.systemPagePadding(isLandscape),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    // Warning icon
                    IconContainer(
                      screenService: screenService,
                      icon: MdiIcons.cogOff,
                      color: isDark ? AppColorsDark.warning : AppColorsLight.warning,
                      isLandscape: isLandscape,
                    ),
                    SizedBox(
                      height: screenService.iconBottomSpacing(isLandscape),
                    ),
                    // Title
                    Text(
                      localizations.config_error_title,
                      style: TextStyle(
                        color: isDark ? AppTextColorDark.primary : AppTextColorLight.primary,
                        fontSize: AppFontSize.extraLarge,
                        fontWeight: FontWeight.w500,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    AppSpacings.spacingMdVertical,
                    // Message
                    Text(
                      errorMessage,
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
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
          color: isDark ? AppFillColorDark.base : AppFillColorLight.blank,
          borderRadius: BorderRadius.circular(AppBorderRadius.base),
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
          spacing: AppSpacings.pMd + AppSpacings.pSm,
          children: [
            Container(
              width: screenService.scale(40),
              height: screenService.scale(40),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: isDark ? AppColorsDark.infoLight9 : AppColorsLight.infoLight9,
                borderRadius: BorderRadius.circular(screenService.scale(10)),
              ),
              child: Icon(
                MdiIcons.informationOutline,
                color: isDark ? AppColorsDark.info : AppColorsLight.info,
                size: screenService.scale(22),
              ),
            ),
            Flexible(
              child: Text(
                hintText,
                style: TextStyle(
                  color: isDark ? AppColorsDark.info : AppColorsLight.info,
                  fontSize: AppFontSize.base,
                  height: 1.1,
                ),
              ),
            ),
            Icon(
              MdiIcons.chevronRight,
              color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
              size: AppSpacings.pLg + AppSpacings.pSm,
            ),
          ],
        ),
      ),
    );
  }
}
