import 'dart:async';

import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';

/// Toast type determines the color and default icon
enum ToastType { success, info, warning, error }

/// A pill-style toast that appears at the top of the screen.
///
/// Features:
/// - Slides in from top with fade animation
/// - Dismisses on tap (no close icon)
/// - Auto-dismisses after duration
/// - Pill/rounded style matching the app design
class AppToast {
  static OverlayEntry? _currentToast;
  static Timer? _dismissTimer;

  /// Shows a toast message at the top of the screen.
  ///
  /// The toast will auto-dismiss after [duration] or when tapped.
  static void show(
    BuildContext context, {
    required String message,
    required ToastType type,
    IconData? icon,
    Duration duration = const Duration(seconds: 3),
  }) {
    // Dismiss any existing toast
    dismiss();

    final overlay = Overlay.of(context);
    final screenService = locator<ScreenService>();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    late OverlayEntry entry;
    entry = OverlayEntry(
      builder: (context) => _ToastWidget(
        message: message,
        type: type,
        icon: icon,
        duration: duration,
        isDark: isDark,
        screenService: screenService,
        onDismiss: () {
          dismiss();
        },
      ),
    );

    _currentToast = entry;
    overlay.insert(entry);

    // Schedule auto-dismiss
    _dismissTimer = Timer(duration + const Duration(milliseconds: 300), () {
      dismiss();
    });
  }

  /// Dismisses the current toast if any.
  static void dismiss() {
    _dismissTimer?.cancel();
    _dismissTimer = null;
    _currentToast?.remove();
    _currentToast = null;
  }

  /// Shows a success toast.
  static void showSuccess(
    BuildContext context, {
    required String message,
    Duration duration = const Duration(seconds: 3),
  }) =>
      show(
        context,
        message: message,
        type: ToastType.success,
        duration: duration,
      );

  /// Shows an info toast.
  static void showInfo(
    BuildContext context, {
    required String message,
    Duration duration = const Duration(seconds: 3),
  }) =>
      show(
        context,
        message: message,
        type: ToastType.info,
        duration: duration,
      );

  /// Shows a warning toast.
  static void showWarning(
    BuildContext context, {
    required String message,
    Duration duration = const Duration(seconds: 3),
  }) =>
      show(
        context,
        message: message,
        type: ToastType.warning,
        duration: duration,
      );

  /// Shows an error toast.
  static void showError(
    BuildContext context, {
    required String message,
    Duration duration = const Duration(seconds: 4),
  }) =>
      show(
        context,
        message: message,
        type: ToastType.error,
        duration: duration,
      );
}

class _ToastWidget extends StatefulWidget {
  final String message;
  final ToastType type;
  final IconData? icon;
  final Duration duration;
  final bool isDark;
  final ScreenService screenService;
  final VoidCallback onDismiss;

  const _ToastWidget({
    required this.message,
    required this.type,
    required this.duration,
    required this.isDark,
    required this.screenService,
    required this.onDismiss,
    this.icon,
  });

  @override
  State<_ToastWidget> createState() => _ToastWidgetState();
}

class _ToastWidgetState extends State<_ToastWidget>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _fadeAnimation;
  late final Animation<Offset> _slideAnimation;
  Timer? _autoDismissTimer;
  bool _isDismissing = false;

  @override
  void initState() {
    super.initState();

    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 250),
    );

    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOut),
    );

    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, -1),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeOut));

    // Start entry animation
    _controller.forward();

    // Schedule auto-dismiss
    _autoDismissTimer = Timer(widget.duration, _dismiss);
  }

  void _dismiss() {
    if (_isDismissing) return;
    _isDismissing = true;

    _autoDismissTimer?.cancel();
    _controller.reverse().then((_) {
      if (mounted) {
        widget.onDismiss();
      }
    });
  }

  @override
  void dispose() {
    _autoDismissTimer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  Color _getBackgroundColor() {
    switch (widget.type) {
      case ToastType.success:
        return widget.isDark ? AppColorsDark.successLight9 : AppColorsLight.successLight9;
      case ToastType.info:
        return widget.isDark ? AppColorsDark.infoLight9 : AppColorsLight.infoLight9;
      case ToastType.warning:
        return widget.isDark ? AppColorsDark.warningLight9 : AppColorsLight.warningLight9;
      case ToastType.error:
        return widget.isDark ? AppColorsDark.errorLight9 : AppColorsLight.errorLight9;
    }
  }

  Color _getTextColor() {
    switch (widget.type) {
      case ToastType.success:
        return widget.isDark ? AppColorsDark.success : AppColorsLight.success;
      case ToastType.info:
        return widget.isDark ? AppColorsDark.info : AppColorsLight.info;
      case ToastType.warning:
        return widget.isDark ? AppColorsDark.warning : AppColorsLight.warning;
      case ToastType.error:
        return widget.isDark ? AppColorsDark.error : AppColorsLight.error;
    }
  }

  IconData _getDefaultIcon() {
    switch (widget.type) {
      case ToastType.success:
        return MdiIcons.checkCircle;
      case ToastType.info:
        return MdiIcons.informationOutline;
      case ToastType.warning:
        return MdiIcons.alertOutline;
      case ToastType.error:
        return MdiIcons.alertCircle;
    }
  }

  @override
  Widget build(BuildContext context) {
    final backgroundColor = _getBackgroundColor();
    final iconToUse = widget.icon ?? _getDefaultIcon();

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
                    constraints: BoxConstraints(
                      maxWidth: widget.screenService.screenWidth * 0.85,
                    ),
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
                          blurRadius: widget.screenService.scale(10),
                          offset: Offset(0, widget.screenService.scale(2)),
                        ),
                      ],
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          iconToUse,
                          color: _getTextColor(),
                          size: widget.screenService.scale(18),
                        ),
                        AppSpacings.spacingMdHorizontal,
                        Flexible(
                          child: Text(
                            widget.message,
                            style: TextStyle(
                              color: _getTextColor(),
                              fontSize: AppFontSize.base,
                              fontWeight: FontWeight.w500,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
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
