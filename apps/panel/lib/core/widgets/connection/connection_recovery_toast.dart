import 'dart:async';

import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';

/// Brief toast shown when connection is restored.
///
/// This widget provides positive feedback to the user when the WebSocket
/// connection is successfully re-established after a disconnection.
/// It automatically dismisses after a short duration.
class ConnectionRecoveryToast extends StatefulWidget {
  final VoidCallback onDismiss;
  final Duration duration;

  const ConnectionRecoveryToast({
    super.key,
    required this.onDismiss,
    this.duration = const Duration(seconds: 2),
  });

  @override
  State<ConnectionRecoveryToast> createState() => _ConnectionRecoveryToastState();
}

class _ConnectionRecoveryToastState extends State<ConnectionRecoveryToast>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _fadeAnimation;
  late final Animation<Offset> _slideAnimation;
  Timer? _dismissTimer;

  @override
  void initState() {
    super.initState();

    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );

    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOut),
    );

    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, -1),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeOut));

    // Start animation
    _controller.forward();

    // Schedule dismiss
    _dismissTimer = Timer(widget.duration, _dismiss);
  }

  void _dismiss() {
    // Cancel timer to prevent double-dismiss if user taps as auto-dismiss fires
    _dismissTimer?.cancel();
    _controller.reverse().then((_) {
      if (mounted) {
        widget.onDismiss();
      }
    });
  }

  @override
  void dispose() {
    _dismissTimer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final screenService = locator<ScreenService>();

    final backgroundColor = isDark
        ? AppColorsDark.success
        : AppColorsLight.success;

    return Positioned(
      top: AppSpacings.pLg,
      left: 0,
      right: 0,
      child: SafeArea(
        child: Center(
          child: SlideTransition(
            position: _slideAnimation,
            child: FadeTransition(
              opacity: _fadeAnimation,
              child: Material(
                type: MaterialType.transparency,
                child: GestureDetector(
                  onTap: _dismiss,
                  child: Container(
                  padding: EdgeInsets.symmetric(
                    horizontal: AppSpacings.pLg,
                    vertical: AppSpacings.pMd + AppSpacings.pSm,
                  ),
                  decoration: BoxDecoration(
                    color: backgroundColor,
                    borderRadius: BorderRadius.circular(AppBorderRadius.round),
                    boxShadow: [
                      BoxShadow(
                        color: AppShadowColor.medium,
                        blurRadius: screenService.scale(10),
                        offset: Offset(0, screenService.scale(2)),
                      ),
                    ],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        MdiIcons.checkCircle,
                        color: AppColors.white,
                        size: screenService.scale(18),
                      ),
                      SizedBox(width: AppSpacings.pMd),
                      Text(
                        localizations.connection_recovery_connected,
                        style: TextStyle(
                          color: AppColors.white,
                          fontSize: AppFontSize.base,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
