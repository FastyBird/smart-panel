import 'package:flutter/material.dart';

import 'package:fastybird_smart_panel/core/types/connection_state.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';

/// Non-blocking banner shown during brief reconnection attempts.
///
/// This widget displays a slim banner at the top of the screen to inform
/// the user that the connection is being re-established, without blocking
/// interaction with the rest of the UI.
class ConnectionBanner extends StatelessWidget {
  final SocketConnectionState state;
  final VoidCallback? onRetry;

  const ConnectionBanner({
    super.key,
    required this.state,
    this.onRetry,
  });

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final backgroundColor = isDark
        ? AppColorsDark.warningLight7
        : AppColorsLight.warningLight9;
    final textColor = isDark
        ? AppColorsDark.warning
        : AppColorsLight.warningDark2;
    final spinnerColor = isDark
        ? AppColorsDark.warning
        : AppColorsLight.warning;

    return Material(
      elevation: 2,
      child: Container(
        width: double.infinity,
        padding: EdgeInsets.symmetric(
          horizontal: AppSpacings.pLg,
          vertical: AppSpacings.pMd,
        ),
        color: backgroundColor,
        child: SafeArea(
          bottom: false,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              SizedBox(
                width: AppSpacings.pLg,
                height: AppSpacings.pLg,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: spinnerColor,
                ),
              ),
              SizedBox(width: AppSpacings.pMd),
              Text(
                _getMessage(localizations),
                style: TextStyle(
                  color: textColor,
                  fontSize: AppFontSize.base,
                  fontWeight: FontWeight.w500,
                ),
              ),
              if (onRetry != null) ...[
                SizedBox(width: AppSpacings.pMd),
                GestureDetector(
                  onTap: onRetry,
                  child: Text(
                    localizations.connection_banner_retry,
                    style: TextStyle(
                      color: spinnerColor,
                      fontSize: AppFontSize.base,
                      fontWeight: FontWeight.w600,
                      decoration: TextDecoration.underline,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  String _getMessage(AppLocalizations localizations) {
    return switch (state) {
      SocketConnectionState.reconnecting => localizations.connection_banner_reconnecting,
      SocketConnectionState.connecting => localizations.connection_banner_connecting,
      SocketConnectionState.authenticating => localizations.connection_banner_authenticating,
      _ => localizations.connection_banner_connecting,
    };
  }
}
