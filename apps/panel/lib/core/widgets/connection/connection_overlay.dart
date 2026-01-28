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
class ConnectionOverlay extends StatelessWidget {
  final Duration disconnectedDuration;
  final VoidCallback onRetry;

  const ConnectionOverlay({
    super.key,
    required this.disconnectedDuration,
    required this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final screenService = locator<ScreenService>();

    return Container(
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
            borderRadius: BorderRadius.circular(AppBorderRadius.medium),
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
              SizedBox(height: AppSpacings.pLg),
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
              SizedBox(height: AppSpacings.pMd),
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
                child: SystemPagePrimaryButton(
                  label: localizations.connection_overlay_retry,
                  icon: MdiIcons.refresh,
                  onPressed: onRetry,
                  isDark: isDark,
                ),
              ),
            ],
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
    final seconds = disconnectedDuration.inSeconds;

    if (seconds < 30) {
      return localizations.connection_overlay_message_reconnecting;
    }

    return localizations.connection_overlay_message_still_trying;
  }
}
