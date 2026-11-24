import 'dart:async';
import 'dart:math' as math;

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Toast type determines the icon and its status colour.
enum ToastType { success, info, warning, error }

/// The toast's sizes (design canvas, "Navigation and overlays").
class ToastMetrics {
  ToastMetrics._();

  static const double height = 36;
  static const double paddingStart = 10;
  static const double paddingEnd = 12;
  static const double gap = 6;
  static const double icon = 16;

  /// Up to two lines, so a message is never cut short.
  static const int maxLines = 2;

  /// The share of the pill an action may take; a longer label ellipsizes, so
  /// the message keeps the rest.
  static const double actionShare = 0.4;

  /// The portrait bar the toast sits above (spec §4): 44 / 52 / 56, 40 on a
  /// square panel.
  static double barHeightFor(ScreenSizeClass sizeClass, {bool square = false}) {
    if (square) return 40;

    return switch (sizeClass) {
      ScreenSizeClass.compact => 44,
      ScreenSizeClass.regular => 52,
      ScreenSizeClass.expanded => 56,
    };
  }

  /// The page padding (spec §4): 6 / 8 / 12.
  static double pagePaddingFor(ScreenSizeClass sizeClass) => switch (sizeClass) {
    ScreenSizeClass.compact => 6,
    ScreenSizeClass.regular => 8,
    ScreenSizeClass.expanded => 12,
  };

  /// The toast's distance from the bottom: two page paddings, above the bar
  /// in portrait.
  static double bottomFor(
    ScreenSizeClass sizeClass, {
    required bool portrait,
    bool square = false,
  }) =>
      (portrait ? barHeightFor(sizeClass, square: square) : 0) +
      2 * pagePaddingFor(sizeClass);
}

/// The status a [ToastType] shows.
AppStatus toastStatus(ToastType type) => switch (type) {
  ToastType.success => AppStatus.ok,
  ToastType.info => AppStatus.info,
  ToastType.warning => AppStatus.warning,
  ToastType.error => AppStatus.danger,
};

/// The toast (docs/display-ui-design-spec.md §5, §7): an inverted pill at the
/// foot of the screen, above the portrait bar. `text.primary` of the theme
/// is its background, so it stands out in both themes; the icon takes the
/// status colour that reads on it (the other theme's status text), with the
/// message beside it and an optional action.
///
/// - Slides up and fades in; dismisses on tap or after its duration.
/// - Screen readers hear the message as it appears.
class Toast {
  static OverlayEntry? _currentToast;
  static Timer? _dismissTimer;

  /// Shows a toast message at the foot of the screen.
  ///
  /// The toast will auto-dismiss after [duration] or when tapped. With
  /// [actionLabel] and [onAction], an action ("Retry") ends the pill.
  static void show(
    BuildContext context, {
    required String message,
    required ToastType type,
    IconData? icon,
    Duration duration = const Duration(seconds: 3),
    OverlayState? overlay,
    String? actionLabel,
    VoidCallback? onAction,
  }) {
    // Dismiss any existing toast
    dismiss();

    final overlayState = overlay ?? Overlay.of(context);
    final brightness = Theme.of(context).brightness;

    late OverlayEntry entry;
    entry = OverlayEntry(
      builder: (context) => ToastView(
        message: message,
        type: type,
        icon: icon,
        duration: duration,
        brightness: brightness,
        actionLabel: actionLabel,
        onAction: onAction,
        onDismiss: () {
          // A replaced toast must not remove its successor.
          if (identical(_currentToast, entry)) dismiss();
        },
      ),
    );

    _currentToast = entry;
    overlayState.insert(entry);

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
    OverlayState? overlay,
  }) =>
      show(
        context,
        message: message,
        type: ToastType.success,
        duration: duration,
        overlay: overlay,
      );

  /// Shows an info toast.
  static void showInfo(
    BuildContext context, {
    required String message,
    Duration duration = const Duration(seconds: 3),
    OverlayState? overlay,
  }) =>
      show(
        context,
        message: message,
        type: ToastType.info,
        duration: duration,
        overlay: overlay,
      );

  /// Shows a warning toast.
  static void showWarning(
    BuildContext context, {
    required String message,
    Duration duration = const Duration(seconds: 3),
    OverlayState? overlay,
  }) =>
      show(
        context,
        message: message,
        type: ToastType.warning,
        duration: duration,
        overlay: overlay,
      );

  /// Shows an error toast.
  static void showError(
    BuildContext context, {
    required String message,
    Duration duration = const Duration(seconds: 4),
    OverlayState? overlay,
  }) =>
      show(
        context,
        message: message,
        type: ToastType.error,
        duration: duration,
        overlay: overlay,
      );
}

/// A toast in its place at the foot of the screen; [Toast.show] inserts it.
/// Public so the gallery and tests can show one.
class ToastView extends StatefulWidget {
  const ToastView({
    super.key,
    required this.message,
    required this.type,
    required this.brightness,
    required this.onDismiss,
    this.icon,
    this.duration = const Duration(seconds: 3),
    this.actionLabel,
    this.onAction,
    this.sizeClass,
    this.portrait,
    this.animate = true,
  });

  final String message;
  final ToastType type;
  final IconData? icon;
  final Duration duration;
  final Brightness brightness;
  final String? actionLabel;
  final VoidCallback? onAction;
  final VoidCallback onDismiss;

  /// The class and orientation to place the toast for; default to the
  /// screen's.
  final ScreenSizeClass? sizeClass;
  final bool? portrait;

  /// False shows the toast at once and never dismisses it on a timer (the
  /// gallery).
  final bool animate;

  @override
  State<ToastView> createState() => _ToastViewState();
}

class _ToastViewState extends State<ToastView>
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
      duration: const Duration(milliseconds: 200),
      value: widget.animate ? 0 : 1,
    );

    _fadeAnimation = CurvedAnimation(parent: _controller, curve: Curves.easeOut);

    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, 1),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeOut));

    if (widget.animate) {
      _controller.forward();
      _autoDismissTimer = Timer(widget.duration, _dismiss);
    }
  }

  @override
  void didUpdateWidget(covariant ToastView oldWidget) {
    super.didUpdateWidget(oldWidget);

    if (oldWidget.animate == widget.animate || _isDismissing) return;

    _autoDismissTimer?.cancel();
    _autoDismissTimer = null;

    if (widget.animate) {
      _autoDismissTimer = Timer(widget.duration, _dismiss);
    } else {
      _controller.value = 1;
    }
  }

  /// Runs the action once; a tap while the toast fades out does nothing.
  void _runAction() {
    if (_isDismissing) return;

    widget.onAction!();
    _dismiss();
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

  IconData get _defaultIcon => switch (widget.type) {
    ToastType.success => MdiIcons.checkCircle,
    ToastType.info => MdiIcons.informationOutline,
    ToastType.warning => MdiIcons.alertOutline,
    ToastType.error => MdiIcons.alertCircle,
  };

  @override
  Widget build(BuildContext context) {
    final screen = locator<ScreenService>();
    final sizeClass = widget.sizeClass ?? screen.sizeClass;
    final portrait = widget.portrait ?? screen.isPortrait;
    final dark = widget.brightness == Brightness.dark;
    final other = dark ? Brightness.light : Brightness.dark;

    // Inverted: the theme's primary text is the pill, and the icon takes the
    // status colour made for the other theme's surfaces.
    final background = AppNeutralPalette.of(widget.brightness).textPrimary;
    final foreground = dark
        ? AppNeutralPalette.light.textPrimary
        : AppColors.white;
    final iconColor = AppStatusPalette.of(
      other,
      toastStatus(widget.type),
    ).text;
    // The action is the accent made for the pill: the dark accent's text on
    // the dark pill, its fill on the light one.
    final darkAccent = AppAccents.palette(Brightness.dark);
    final actionColor = dark ? darkAccent.fill : darkAccent.text;

    final pagePadding = AppSpacings.scale(
      ToastMetrics.pagePaddingFor(sizeClass),
    );
    final height = AppSpacings.scale(ToastMetrics.height);
    final hasAction = widget.actionLabel != null && widget.onAction != null;

    Widget pill(double maxWidth) => Container(
      constraints: BoxConstraints(minHeight: height),
      padding: EdgeInsetsDirectional.only(
        start: AppSpacings.scale(ToastMetrics.paddingStart),
        end: hasAction ? 0 : AppSpacings.scale(ToastMetrics.paddingEnd),
      ),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(height / 2),
        boxShadow: AppRaisedShadow.of(
          widget.brightness,
          offset: const Offset(0, 4),
          blur: 14,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        spacing: AppSpacings.scale(ToastMetrics.gap),
        children: [
          Icon(
            widget.icon ?? _defaultIcon,
            color: iconColor,
            size: AppSpacings.scale(ToastMetrics.icon),
          ),
          Flexible(
            child: Padding(
              padding: EdgeInsets.symmetric(vertical: AppSpacings.pSm),
              child: Text(
                widget.message,
                maxLines: ToastMetrics.maxLines,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: foreground,
                  fontSize: AppFontSize.small,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ),
          if (hasAction)
            Semantics(
              button: true,
              child: InkWell(
                onTap: _runAction,
                borderRadius: BorderRadius.circular(height / 2),
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    minHeight: height,
                    minWidth: height,
                    maxWidth: math.max(
                      height,
                      maxWidth * ToastMetrics.actionShare,
                    ),
                  ),
                  child: Padding(
                    padding: EdgeInsetsDirectional.only(
                      start: AppSpacings.pMd,
                      end: AppSpacings.scale(ToastMetrics.paddingEnd),
                    ),
                    child: Center(
                      widthFactor: 1,
                      child: Text(
                        widget.actionLabel!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: actionColor,
                          fontSize: AppFontSize.small,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );

    return Positioned(
      left: pagePadding,
      right: pagePadding,
      bottom: AppSpacings.scale(
        ToastMetrics.bottomFor(
          sizeClass,
          portrait: portrait,
          square: screen.isSquare,
        ),
      ),
      child: SafeArea(
        top: false,
        child: Center(
          child: SlideTransition(
            position: _slideAnimation,
            child: FadeTransition(
              opacity: _fadeAnimation,
              child: Semantics(
                liveRegion: true,
                container: true,
                child: Material(
                  type: MaterialType.transparency,
                  child: GestureDetector(
                    onTap: _dismiss,
                    child: LayoutBuilder(
                      builder: (context, constraints) =>
                          pill(constraints.maxWidth),
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
