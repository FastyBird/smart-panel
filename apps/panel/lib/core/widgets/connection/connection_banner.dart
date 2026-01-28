import 'package:flutter/material.dart';

import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';

/// Non-blocking banner shown during brief reconnection attempts.
///
/// This widget displays a slim banner at the top of the screen to inform
/// the user that the connection is being re-established, without blocking
/// interaction with the rest of the UI.
///
/// Note: This banner is only shown when [ConnectionUISeverity.banner] is active,
/// which only occurs during the `reconnecting` state (2-10 seconds after disconnect).
class ConnectionBanner extends StatefulWidget {
  final VoidCallback? onRetry;

  const ConnectionBanner({
    super.key,
    this.onRetry,
  });

  @override
  State<ConnectionBanner> createState() => _ConnectionBannerState();
}

class _ConnectionBannerState extends State<ConnectionBanner>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<Offset> _slideAnimation;

  @override
  void initState() {
    super.initState();

    _controller = AnimationController(
      duration: const Duration(milliseconds: 300),
      vsync: this,
    );

    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, -1),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeOut));

    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

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

    return SlideTransition(
      position: _slideAnimation,
      child: Material(
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
                  localizations.connection_banner_reconnecting,
                  style: TextStyle(
                    color: textColor,
                    fontSize: AppFontSize.base,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                if (widget.onRetry != null) ...[
                  SizedBox(width: AppSpacings.pMd),
                  GestureDetector(
                    onTap: widget.onRetry,
                    child: Text(
                      localizations.connection_banner_retry,
                      style: TextStyle(
                        color: spinnerColor,
                        fontSize: AppFontSize.base,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
