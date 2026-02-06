import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/system_pages/export.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/system/types/configuration.dart';

class AppError extends StatelessWidget {
  final Function() _onRestart;
  final String? _errorMessage;

  const AppError({
    required Function() onRestart,
    String? errorMessage,
    super.key,
  })  : _onRestart = onRestart,
        _errorMessage = errorMessage;

  @override
  Widget build(BuildContext context) {
    final errorMsg = _errorMessage ?? '';
    final hasPermitJoinError = errorMsg.toLowerCase().contains('permit join');
    final isDark =
        MediaQuery.platformBrightnessOf(context) == Brightness.dark;

    return MaterialApp(
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: ThemeMode.system,
      debugShowCheckedModeBanner: false,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        ...GlobalMaterialLocalizations.delegates,
      ],
      supportedLocales: Language.values.map(
        (item) => Locale(item.value.split('_')[0], item.value.split('_')[1]),
      ),
      locale: const Locale('en', 'US'),
      home: Scaffold(
        backgroundColor: SystemPagesTheme.background(isDark),
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
                      IconContainer(
                        icon: MdiIcons.alertCircle,
                        color: SystemPagesTheme.error(isDark),
                        size: AppSpacings.scale(80),
                        iconSize: AppSpacings.scale(40),
                      ),
                      SizedBox(height: AppSpacings.scale(24)),
                      // Title
                      Text(
                        isLandscape
                            ? 'Failed to Start Application'
                            : 'Failed to Start',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: SystemPagesTheme.textPrimary(isDark),
                          fontSize: AppFontSize.extraLarge,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      SizedBox(height: AppSpacings.scale(8)),
                      // Subtitle/error message
                      // For long errors, show generic message here; details go in error code box
                      Text(
                        _errorMessage == null
                            ? 'An unexpected error occurred while starting the application.'
                            : (_errorMessage.length > 100 && !hasPermitJoinError)
                                ? 'An error occurred. See details below.'
                                : _errorMessage,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: SystemPagesTheme.textMuted(isDark),
                          fontSize: AppSpacings.scale(14),
                          height: 1.5,
                        ),
                      ),
                      // Permit join info card
                      if (hasPermitJoinError) ...[
                        SizedBox(height: AppSpacings.scale(24)),
                        _buildPermitJoinHint(context, isDark),
                      ],
                      // Error details box for long error messages
                      if (_errorMessage != null &&
                          !hasPermitJoinError &&
                          _errorMessage.length > 100) ...[
                        SizedBox(height: AppSpacings.scale(16)),
                        _buildErrorCodeBox(context, isDark),
                      ],
                      SizedBox(height: AppSpacings.scale(32)),
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
                          label: Text('Restart Application'),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }

  Widget _buildPermitJoinHint(BuildContext context, bool isDark) {
    return Container(
      padding: EdgeInsets.all(AppSpacings.scale(16)),
      decoration: BoxDecoration(
        color: SystemPagesTheme.card(isDark),
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
              color: SystemPagesTheme.infoLight(isDark),
              borderRadius: BorderRadius.circular(AppBorderRadius.small),
            ),
            child: Icon(
              MdiIcons.informationOutline,
              color: SystemPagesTheme.info(isDark),
              size: AppSpacings.scale(22),
            ),
          ),
          SizedBox(width: AppSpacings.scale(12)),
          Expanded(
            child: Text(
              'Please ask the administrator to activate "Permit Join" in the admin panel, then restart the application.',
              style: TextStyle(
                color: SystemPagesTheme.info(isDark),
                fontSize: AppSpacings.scale(14),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorCodeBox(BuildContext context, bool isDark) {
    // Truncate long error messages for display in the error code box
    final errorCode = _errorMessage != null && _errorMessage.length > 200
        ? '${_errorMessage.substring(0, 200)}...'
        : _errorMessage ?? '';

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: AppSpacings.scale(16),
        vertical: AppSpacings.scale(8),
      ),
      decoration: BoxDecoration(
        color: SystemPagesTheme.card(isDark),
        borderRadius: BorderRadius.circular(AppBorderRadius.small),
      ),
      child: Text(
        errorCode,
        textAlign: TextAlign.center,
        style: TextStyle(
          color: SystemPagesTheme.textMuted(isDark),
          fontSize: AppSpacings.scale(12),
          fontFamily: 'monospace',
        ),
      ),
    );
  }
}
