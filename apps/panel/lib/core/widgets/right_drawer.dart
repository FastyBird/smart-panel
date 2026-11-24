import 'dart:math' as math;

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/bottom_sheet_dialog.dart';
import 'package:flutter/material.dart';

/// Shows a right-side drawer with consistent styling across the app.
///
/// Use [showRightDrawer] to present a drawer that slides in from the right
/// with optional title bar, main content, and optional bottom section
/// (e.g. action buttons). Designed for landscape overlays where bottom sheets
/// feel unnatural.
///
/// Example:
/// ```dart
/// showRightDrawer(
///   context,
///   title: 'Lights',
///   titleIcon: MdiIcons.lightbulbGroup,
///   content: ListView(...),
///   footerSection: FilledButton(onPressed: () => ..., child: Text('Sync')),
/// );
/// ```
Future<T?> showRightDrawer<T>(
  BuildContext context, {
  /// Optional title. Shown in the header when [titleWidget] is null.
  String? title,

  /// A line under the title in `text.secondary`.
  String? subtitle,

  /// Optional custom widget for the title. When set, has priority over [title].
  Widget? titleWidget,

  /// Optional icon shown before the text title in the header. Only used when
  /// [titleWidget] is null (i.e. when the string [title] is displayed).
  IconData? titleIcon,

  /// Whether to show the close button in the header. Ignored when no header.
  bool showCloseButton = true,

  /// Main content of the drawer.
  required Widget content,

  /// Optional bottom section (e.g. primary action button). Shown below [content].
  Widget? footerSection,

  /// The drawer's width; defaults to the size class's (220 / 300 / 380).
  /// Held to 80% of the screen.
  double? width,

  /// Whether content is wrapped in [ListView]. Set to false when
  /// content uses [Expanded] or has its own scroll.
  bool scrollable = true,

  /// Whether tapping the barrier dismisses the drawer.
  bool barrierDismissible = true,

  /// The class to size the drawer for; defaults to the screen's.
  ScreenSizeClass? sizeClass,
}) {
  return showGeneralDialog<T>(
    context: context,
    barrierDismissible: barrierDismissible,
    barrierLabel: MaterialLocalizations.of(context).modalBarrierDismissLabel,
    barrierColor: AppScrim.color,
    transitionDuration: const Duration(milliseconds: 300),
    pageBuilder: (context, animation, secondaryAnimation) {
      return RightDrawer(
        title: title,
        subtitle: subtitle,
        titleWidget: titleWidget,
        titleIcon: titleIcon,
        showCloseButton: showCloseButton,
        content: content,
        footerSection: footerSection,
        width: width,
        scrollable: scrollable,
        sizeClass: sizeClass,
      );
    },
    transitionBuilder: (context, animation, secondaryAnimation, child) {
      final curved = CurvedAnimation(
        parent: animation,
        curve: Curves.easeOutCubic,
        reverseCurve: Curves.easeInOutCubic,
      );
      return SlideTransition(
        position: Tween<Offset>(
          begin: const Offset(1, 0),
          end: Offset.zero,
        ).animate(curved),
        child: child,
      );
    },
  );
}

/// The right drawer (docs/display-ui-design-spec.md §5), the landscape
/// counterpart of the bottom sheet: `surface.raised` with a `border.light`
/// outline, radius 12 on its left corners, one soft shadow in light and none
/// in dark. The sheet's header ([SheetHeader]), then the content and an
/// optional footer, all inside the drawer's padding.
class RightDrawer extends StatelessWidget {
  const RightDrawer({
    super.key,
    this.title,
    this.subtitle,
    this.titleWidget,
    this.titleIcon,
    this.showCloseButton = true,
    required this.content,
    this.footerSection,
    this.width,
    this.scrollable = true,
    this.sizeClass,
  });

  final String? title;
  final String? subtitle;
  final Widget? titleWidget;
  final IconData? titleIcon;
  final bool showCloseButton;
  final Widget content;
  final Widget? footerSection;

  /// Defaults to the size class's width.
  final double? width;
  final bool scrollable;

  /// The class to size the drawer for; defaults to the screen's.
  final ScreenSizeClass? sizeClass;

  bool get _hasHeader => title != null || titleWidget != null;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final neutrals = theme.neutrals;
    final screen = locator<ScreenService>();
    final resolvedClass = sizeClass ?? screen.sizeClass;
    final padding = AppSpacings.scale(SheetMetrics.paddingFor(resolvedClass));
    final gap = AppSpacings.scale(SheetMetrics.gapFor(resolvedClass));
    final radius = Radius.circular(AppBorderRadius.medium);

    final effectiveWidth = math.min(
      width ?? AppSpacings.scale(SheetMetrics.drawerWidthFor(resolvedClass)),
      screen.logicalWidth * 0.8,
    );

    final contentArea = scrollable
        ? ListView(
            shrinkWrap: true,
            primary: false,
            padding: EdgeInsets.zero,
            children: [content],
          )
        : content;

    return Align(
      alignment: Alignment.centerRight,
      child: Container(
        width: effectiveWidth,
        decoration: BoxDecoration(
          color: neutrals.surfaceRaised,
          border: Border.all(
            color: neutrals.borderLight,
            width: AppSpacings.scale(1),
          ),
          borderRadius: BorderRadius.horizontal(left: radius),
          boxShadow: AppRaisedShadow.of(
            theme.brightness,
            offset: const Offset(-4, 0),
          ),
        ),
        child: Material(
          type: MaterialType.transparency,
          child: SafeArea(
            left: false,
            child: Padding(
              padding: EdgeInsets.all(padding),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                spacing: gap,
                children: [
                  if (_hasHeader)
                    SheetHeader(
                      title: title,
                      subtitle: subtitle,
                      titleWidget: titleWidget,
                      titleIcon: titleIcon,
                      showCloseButton: showCloseButton,
                      sizeClass: resolvedClass,
                    ),
                  Expanded(child: contentArea),
                  if (footerSection != null) footerSection!,
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
