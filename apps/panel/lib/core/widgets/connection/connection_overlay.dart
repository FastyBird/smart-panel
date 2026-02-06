import 'dart:async';

import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/system_pages/export.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';

/// Semi-blocking overlay that dims content but keeps it visible.
///
/// This widget is shown during prolonged reconnection attempts (10-30 seconds).
/// It allows users to see the cached device state underneath while clearly
/// indicating that the panel is attempting to reconnect.
class ConnectionOverlay extends StatefulWidget {
  final Duration disconnectedDuration;
  final VoidCallback onRetry;

  const ConnectionOverlay({
    super.key,
    required this.disconnectedDuration,
    required this.onRetry,
  });

  @override
  State<ConnectionOverlay> createState() => _ConnectionOverlayState();
}

class _ConnectionOverlayState extends State<ConnectionOverlay> {
  bool _isRetrying = false;
  Timer? _retryTimer;

  @override
  void dispose() {
    _retryTimer?.cancel();
    super.dispose();
  }

  void _handleRetry() {
    if (_isRetrying) return;

    setState(() {
      _isRetrying = true;
    });

    widget.onRetry();

    // Reset after 2 seconds to allow another retry
    _retryTimer = Timer(const Duration(seconds: 2), () {
      if (mounted) {
        setState(() {
          _isRetrying = false;
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final screenService = locator<ScreenService>();

    return Material(
      type: MaterialType.transparency,
      child: Container(
        color: isDark
            ? AppOverlayColorDark.lighter
            : AppOverlayColorLight.lighter,
        child: Center(
          child: Container(
            margin: EdgeInsets.all(AppSpacings.pXl),
            padding: EdgeInsets.all(AppSpacings.pLg + AppSpacings.pMd),
            constraints: BoxConstraints(
              maxWidth: screenService.scale(320),
            ),
            decoration: BoxDecoration(
              color: SystemPagesTheme.card(isDark),
              borderRadius: BorderRadius.circular(AppBorderRadius.base),
              boxShadow: [
                BoxShadow(
                  color: AppShadowColor.strong,
                  blurRadius: screenService.scale(20),
                  offset: Offset(0, screenService.scale(4)),
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Animated icon
                _buildIcon(isDark, screenService),
                AppSpacings.spacingLgVertical,
                // Title
                Text(
                  _getTitle(localizations),
                  style: TextStyle(
                    color: SystemPagesTheme.textPrimary(isDark),
                    fontSize: AppFontSize.extraLarge,
                    fontWeight: FontWeight.w600,
                  ),
                  textAlign: TextAlign.center,
                ),
                AppSpacings.spacingMdVertical,
                // Subtitle
                Text(
                  _getSubtitle(localizations),
                  style: TextStyle(
                    color: SystemPagesTheme.textMuted(isDark),
                    fontSize: AppFontSize.base,
                    height: 1.4,
                  ),
                  textAlign: TextAlign.center,
                ),
                SizedBox(height: AppSpacings.pLg + AppSpacings.pMd),
                // Retry button
                SizedBox(
                  width: double.infinity,
                  child: Theme(
                    data: Theme.of(context).copyWith(
                      filledButtonTheme: isDark
                          ? AppFilledButtonsDarkThemes.primary
                          : AppFilledButtonsLightThemes.primary,
                    ),
                    child: _isRetrying
                        ? FilledButton(
                            onPressed: _handleRetry,
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                SizedBox(
                                  width: AppFontSize.base,
                                  height: AppFontSize.base,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: isDark
                                        ? AppFilledButtonsDarkThemes
                                            .primaryForegroundColor
                                        : AppFilledButtonsLightThemes
                                            .primaryForegroundColor,
                                  ),
                                ),
                                AppSpacings.spacingSmHorizontal,
                                Text(localizations
                                    .connection_overlay_retrying),
                              ],
                            ),
                          )
                        : FilledButton.icon(
                            onPressed: _handleRetry,
                            icon: Icon(
                              MdiIcons.refresh,
                              size: AppFontSize.base,
                              color: isDark
                                  ? AppFilledButtonsDarkThemes
                                      .primaryForegroundColor
                                  : AppFilledButtonsLightThemes
                                      .primaryForegroundColor,
                            ),
                            label: Text(
                                localizations.connection_overlay_retry),
                          ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildIcon(bool isDark, ScreenService screenService) {
    // Note: This overlay is only shown for 'reconnecting' state (severity: overlay).
    // The 'offline' state maps to fullScreen severity and renders ConnectionLostScreen.
    return Stack(
      alignment: Alignment.center,
      children: [
        SizedBox(
          width: screenService.scale(56),
          height: screenService.scale(56),
          child: CircularProgressIndicator(
            strokeWidth: 3,
            color: SystemPagesTheme.warning(isDark),
          ),
        ),
        Container(
          width: screenService.scale(48),
          height: screenService.scale(48),
          decoration: BoxDecoration(
            color: SystemPagesTheme.warningLight(isDark),
            shape: BoxShape.circle,
          ),
          child: Icon(
            MdiIcons.wifiStrength2,
            size: screenService.scale(24),
            color: SystemPagesTheme.warning(isDark),
          ),
        ),
      ],
    );
  }

  String _getTitle(AppLocalizations localizations) {
    return localizations.connection_overlay_title_reconnecting;
  }

  String _getSubtitle(AppLocalizations localizations) {
    final seconds = widget.disconnectedDuration.inSeconds;

    if (seconds < 30) {
      return localizations.connection_overlay_message_reconnecting;
    }

    return localizations.connection_overlay_message_still_trying;
  }
}
