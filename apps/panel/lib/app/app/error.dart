import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/system_pages/export.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/system/types/configuration.dart';

class AppError extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final Function() _onRestart;
  final String? _errorMessage;

  AppError({
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
                        ? _screenService.scale(80)
                        : _screenService.scale(40),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      // Error icon
                      IconContainer(
                        icon: MdiIcons.alertCircle,
                        color: SystemPagesTheme.error(isDark),
                        size: _screenService.scale(80),
                        iconSize: _screenService.scale(40),
                      ),
                      SizedBox(height: _screenService.scale(24)),
                      // Title
                      Text(
                        isLandscape
                            ? 'Failed to Start Application'
                            : 'Failed to Start',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: SystemPagesTheme.textPrimary(isDark),
                          fontSize: _screenService.scale(24),
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      SizedBox(height: _screenService.scale(8)),
                      // Subtitle/error message
                      Text(
                        _errorMessage ??
                            'An unexpected error occurred while starting the application.',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: SystemPagesTheme.textMuted(isDark),
                          fontSize: _screenService.scale(14),
                          height: 1.5,
                        ),
                      ),
                      // Permit join info card
                      if (hasPermitJoinError) ...[
                        SizedBox(height: _screenService.scale(24)),
                        _buildPermitJoinHint(context, isDark),
                      ],
                      // Error code if present
                      if (_errorMessage != null &&
                          !hasPermitJoinError &&
                          _errorMessage!.length > 100) ...[
                        SizedBox(height: _screenService.scale(16)),
                        _buildErrorCodeBox(context, isDark),
                      ],
                      SizedBox(height: _screenService.scale(32)),
                      // Restart button
                      SystemPagePrimaryButton(
                        label: 'Restart Application',
                        icon: Icons.refresh,
                        onPressed: _onRestart,
                        isDark: isDark,
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
      padding: EdgeInsets.all(_screenService.scale(16)),
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
            width: _screenService.scale(40),
            height: _screenService.scale(40),
            decoration: BoxDecoration(
              color: SystemPagesTheme.infoLight(isDark),
              borderRadius: BorderRadius.circular(AppBorderRadius.small),
            ),
            child: Icon(
              Icons.info_outline,
              color: SystemPagesTheme.info(isDark),
              size: _screenService.scale(22),
            ),
          ),
          SizedBox(width: _screenService.scale(12)),
          Expanded(
            child: Text(
              'Please ask the administrator to activate "Permit Join" in the admin panel, then restart the application.',
              style: TextStyle(
                color: SystemPagesTheme.info(isDark),
                fontSize: _screenService.scale(14),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorCodeBox(BuildContext context, bool isDark) {
    // Truncate long error messages for display in the error code box
    final errorCode = _errorMessage != null && _errorMessage!.length > 200
        ? '${_errorMessage!.substring(0, 200)}...'
        : _errorMessage ?? '';

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: _screenService.scale(16),
        vertical: _screenService.scale(8),
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
          fontSize: _screenService.scale(12),
          fontFamily: 'monospace',
        ),
      ),
    );
  }
}
