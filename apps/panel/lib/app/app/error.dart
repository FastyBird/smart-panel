import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

import 'package:fastybird_smart_panel/app/app.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/local_preferences.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/icon_container.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/system/types/configuration.dart';

class AppError extends StatelessWidget {
  final Function() _onRestart;
  final AppErrorInfo? _errorInfo;

  const AppError({
    required Function() onRestart,
    AppErrorInfo? errorInfo,
    super.key,
  })  : _onRestart = onRestart,
        _errorInfo = errorInfo;

  @override
  Widget build(BuildContext context) {
    final prefs = locator.isRegistered<LocalPreferencesService>()
        ? locator<LocalPreferencesService>()
        : null;
    final isDark = prefs?.darkMode ?? false;
    final language = prefs?.language ?? Language.english;

    return MaterialApp(
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: prefs != null
          ? (prefs.darkMode ? ThemeMode.dark : ThemeMode.light)
          : ThemeMode.system,
      debugShowCheckedModeBanner: false,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        ...GlobalMaterialLocalizations.delegates,
      ],
      supportedLocales: Language.values.map(
        (item) => Locale(item.value.split('_')[0], item.value.split('_')[1]),
      ),
      locale: Locale(
        language.value.split('_')[0],
        language.value.split('_')[1],
      ),
      home: Builder(
        builder: (innerContext) {
          final localizations = AppLocalizations.of(innerContext)!;
          final errorMsg = _errorInfo?.toLocalizedMessage(localizations);
          final hasPermitJoinError =
              errorMsg != null && errorMsg.toLowerCase().contains('permit join');

          return Scaffold(
            backgroundColor: isDark ? AppBgColorDark.base : AppBgColorLight.base,
            body: SafeArea(
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final isLandscape = constraints.maxWidth > constraints.maxHeight;

                  return Center(
                    child: Padding(
                      padding: EdgeInsets.symmetric(
                        horizontal: isLandscape
                            ? AppSpacings.scale(80)
                            : AppSpacings.scale(40),
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          // Error icon
                          if (locator.isRegistered<ScreenService>())
                            IconContainer(
                              screenService: locator<ScreenService>(),
                              icon: MdiIcons.alertCircle,
                              color: isDark ? AppColorsDark.error : AppColorsLight.error,
                              isLandscape: isLandscape,
                            )
                          else
                            Icon(
                              MdiIcons.alertCircle,
                              color: isDark ? AppColorsDark.error : AppColorsLight.error,
                              size: AppSpacings.scale(48),
                            ),
                          AppSpacings.spacingXlVertical,
                          // Title
                          Text(
                            isLandscape
                                ? localizations.app_error_failed_to_start
                                : localizations.app_error_failed_to_start_short,
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: isDark ? AppTextColorDark.primary : AppTextColorLight.primary,
                              fontSize: AppFontSize.extraLarge,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          AppSpacings.spacingMdVertical,
                          // Subtitle/error message
                          // For long errors, show generic message here; details go in error code box
                          Text(
                            errorMsg == null
                                ? localizations.app_error_unexpected
                                : (errorMsg.length > 100 && !hasPermitJoinError)
                                    ? localizations.app_error_see_details
                                    : errorMsg,
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
                              fontSize: AppSpacings.scale(14),
                              height: 1.5,
                            ),
                          ),
                          // Permit join info card
                          if (hasPermitJoinError) ...[
                            AppSpacings.spacingXlVertical,
                            _buildPermitJoinHint(innerContext, isDark, localizations),
                          ],
                          // Error details box for long error messages
                          if (errorMsg != null &&
                              !hasPermitJoinError &&
                              errorMsg.length > 100) ...[
                            AppSpacings.spacingLgVertical,
                            _buildErrorCodeBox(context, isDark, errorMsg),
                          ],
                          AppSpacings.spacingXlVertical,
                          // Restart button
                          Theme(
                            data: Theme.of(context).copyWith(
                              filledButtonTheme: isDark
                                  ? AppFilledButtonsDarkThemes.primary
                                  : AppFilledButtonsLightThemes.primary,
                            ),
                            child: FilledButton.icon(
                              onPressed: _onRestart,
                              icon: Icon(
                                MdiIcons.refresh,
                                size: AppFontSize.base,
                                color: isDark
                                    ? AppFilledButtonsDarkThemes
                                        .primaryForegroundColor
                                    : AppFilledButtonsLightThemes
                                        .primaryForegroundColor,
                              ),
                              label: Text(localizations.app_error_restart_button),
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
        },
      ),
    );
  }

  Widget _buildPermitJoinHint(BuildContext context, bool isDark, AppLocalizations localizations) {
    return Container(
      padding: EdgeInsets.all(AppSpacings.scale(16)),
      decoration: BoxDecoration(
        color: isDark ? AppFillColorDark.base : AppFillColorLight.blank,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        boxShadow: isDark
            ? null
            : [
                BoxShadow(
                  color: AppColors.black.withValues(alpha: 0.05),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
      ),
      child: Row(
        children: [
          Container(
            width: AppSpacings.scale(40),
            height: AppSpacings.scale(40),
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: isDark ? AppColorsDark.infoLight9 : AppColorsLight.infoLight9,
              borderRadius: BorderRadius.circular(AppBorderRadius.small),
            ),
            child: Icon(
              MdiIcons.informationOutline,
              color: isDark ? AppColorsDark.info : AppColorsLight.info,
              size: AppSpacings.scale(22),
            ),
          ),
          AppSpacings.spacingLgHorizontal,
          Expanded(
            child: Text(
              localizations.app_error_permit_join_hint,
              style: TextStyle(
                color: isDark ? AppColorsDark.info : AppColorsLight.info,
                fontSize: AppSpacings.scale(14),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorCodeBox(BuildContext context, bool isDark, String errorMsg) {
    // Truncate long error messages for display in the error code box
    final errorCode = errorMsg.length > 200
        ? '${errorMsg.substring(0, 200)}...'
        : errorMsg;

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: AppSpacings.scale(16),
        vertical: AppSpacings.scale(8),
      ),
      decoration: BoxDecoration(
        color: isDark ? AppFillColorDark.base : AppFillColorLight.blank,
        borderRadius: BorderRadius.circular(AppBorderRadius.small),
      ),
      child: Text(
        errorCode,
        textAlign: TextAlign.center,
        style: TextStyle(
          color: isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder,
          fontSize: AppSpacings.scale(12),
          fontFamily: 'monospace',
        ),
      ),
    );
  }
}
