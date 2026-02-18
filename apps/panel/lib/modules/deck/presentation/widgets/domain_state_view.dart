import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/domain_pages/domain_data_loader.dart';

/// Widget that displays loading spinner, error with retry, not-configured
/// info, or child content.
///
/// Used by domain views (lights, climate, shading, media, sensors) to provide
/// consistent loading, error, and not-configured UI states.
///
/// When [state] is:
/// - [DomainLoadState.loading]: Shows centered circular progress indicator
/// - [DomainLoadState.error]: Shows error icon, message, and retry button
/// - [DomainLoadState.notConfigured]: Shows domain icon with title/description
/// - [DomainLoadState.loaded] or [DomainLoadState.empty]: Shows [child]
class DomainStateView extends StatelessWidget {
  /// Current loading state from [DomainDataLoader].
  final DomainLoadState state;

  /// Error message to display (optional).
  final String? errorMessage;

  /// Callback when retry button is pressed.
  final VoidCallback onRetry;

  /// Content to display when loaded.
  final Widget child;

  /// Domain name for error message (e.g., "Lights", "Climate").
  final String domainName;

  /// Icon to show in the not-configured state. Defaults to [MdiIcons.cogOffOutline].
  final IconData? notConfiguredIcon;

  /// Title for the not-configured state.
  final String? notConfiguredTitle;

  /// Description for the not-configured state.
  final String? notConfiguredDescription;

  const DomainStateView({
    super.key,
    required this.state,
    this.errorMessage,
    required this.onRetry,
    required this.child,
    required this.domainName,
    this.notConfiguredIcon,
    this.notConfiguredTitle,
    this.notConfiguredDescription,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    switch (state) {
      case DomainLoadState.loading:
        return _buildLoadingState(context, isDark);
      case DomainLoadState.error:
        return _buildErrorState(context, isDark);
      case DomainLoadState.notConfigured:
        return _buildNotConfiguredState(context, isDark);
      case DomainLoadState.loaded:
      case DomainLoadState.empty:
        return child;
    }
  }

  Widget _buildLoadingState(BuildContext context, bool isDark) {
    return Scaffold(
      backgroundColor: isDark ? AppBgColorDark.page : AppBgColorLight.page,
      body: const Center(child: CircularProgressIndicator()),
    );
  }

  Widget _buildErrorState(BuildContext context, bool isDark) {
    final localizations = AppLocalizations.of(context)!;
    final warningColor = isDark ? AppColorsDark.warning : AppColorsLight.warning;
    final warningBgColor =
        isDark ? AppColorsDark.warningLight8 : AppColorsLight.warningLight8;

    return Scaffold(
      backgroundColor: isDark ? AppBgColorDark.page : AppBgColorLight.page,
      body: Center(
        child: Padding(
          padding: AppSpacings.paddingXl,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            spacing: AppSpacings.pMd,
            children: [
              Container(
                width: AppSpacings.scale(80),
                height: AppSpacings.scale(80),
                decoration: BoxDecoration(
                  color: warningBgColor,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  MdiIcons.alertCircleOutline,
                  size: AppSpacings.scale(48),
                  color: warningColor,
                ),
              ),
              Text(
                localizations.domain_data_load_failed(domainName),
                style: TextStyle(
                  fontSize: AppFontSize.large,
                  fontWeight: FontWeight.w600,
                  color:
                      isDark ? AppTextColorDark.primary : AppTextColorLight.primary,
                ),
                textAlign: TextAlign.center,
              ),
              Text(
                localizations.domain_data_load_failed_description,
                style: TextStyle(
                  fontSize: AppFontSize.base,
                  color: isDark
                      ? AppTextColorDark.secondary
                      : AppTextColorLight.secondary,
                ),
                textAlign: TextAlign.center,
              ),
              Theme(
                data: ThemeData(
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
                        ? AppFilledButtonsDarkThemes.primaryForegroundColor
                        : AppFilledButtonsLightThemes.primaryForegroundColor,
                  ),
                  label: Text(localizations.action_retry),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildNotConfiguredState(BuildContext context, bool isDark) {
    final secondaryColor =
        isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;

    return Center(
      child: Padding(
        padding: AppSpacings.paddingLg,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          spacing: AppSpacings.pMd,
          children: [
            Icon(
              notConfiguredIcon ?? MdiIcons.cogOffOutline,
              color: secondaryColor,
              size: AppSpacings.scale(64),
            ),
            if (notConfiguredTitle != null)
              Text(
                notConfiguredTitle!,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: AppFontSize.extraLarge,
                  fontWeight: FontWeight.w600,
                  color: isDark
                      ? AppTextColorDark.primary
                      : AppTextColorLight.primary,
                ),
              ),
            if (notConfiguredDescription != null)
              Text(
                notConfiguredDescription!,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: AppFontSize.base,
                  color: secondaryColor,
                ),
              ),
          ],
        ),
      ),
    );
  }
}
