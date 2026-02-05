import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/domain_pages/domain_data_loader.dart';

/// Widget that displays loading spinner, error with retry, or child content.
///
/// Used by domain views (lights, climate, shading, media, sensors) to provide
/// consistent loading and error UI states.
///
/// When [state] is:
/// - [DomainLoadState.loading]: Shows centered circular progress indicator
/// - [DomainLoadState.error]: Shows error icon, message, and retry button
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

  const DomainStateView({
    super.key,
    required this.state,
    this.errorMessage,
    required this.onRetry,
    required this.child,
    required this.domainName,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    switch (state) {
      case DomainLoadState.loading:
        return _buildLoadingState(context, isDark);
      case DomainLoadState.error:
        return _buildErrorState(context, isDark);
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
        isDark ? AppColorsDark.warningLight9 : AppColorsLight.warningLight9;

    return Scaffold(
      backgroundColor: isDark ? AppBgColorDark.page : AppBgColorLight.page,
      body: Center(
        child: Padding(
          padding: AppSpacings.paddingXl,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  color: warningBgColor,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  MdiIcons.alertCircleOutline,
                  size: 48,
                  color: warningColor,
                ),
              ),
              AppSpacings.spacingLgVertical,
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
              AppSpacings.spacingSmVertical,
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
              AppSpacings.spacingLgVertical,
              Theme(
                data: ThemeData(
                  filledButtonTheme: isDark
                      ? AppFilledButtonsDarkThemes.primary
                      : AppFilledButtonsLightThemes.primary,
                ),
                child: FilledButton.icon(
                  onPressed: onRetry,
                  icon: Icon(MdiIcons.refresh),
                  label: Text(localizations.action_retry),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
