import 'dart:math' as math;

import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Shows a right-side drawer with consistent styling across the app.
///
/// Use [showAppRightDrawer] to present a drawer that slides in from the right
/// with optional title bar, main content, and optional bottom section
/// (e.g. action buttons). Designed for landscape overlays where bottom sheets
/// feel unnatural.
///
/// Example:
/// ```dart
/// showAppRightDrawer(
///   context,
///   title: 'Lights',
///   titleIcon: MdiIcons.lightbulbGroup,
///   content: ListView(...),
///   footerSection: FilledButton(onPressed: () => ..., child: Text('Sync')),
/// );
/// ```
Future<T?> showAppRightDrawer<T>(
  BuildContext context, {
  /// Optional title. Shown in the header when [titleWidget] is null.
  String? title,

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

  /// Maximum width of the drawer. Clamped to 80% of screen width.
  double width = 600,

  /// Whether content is wrapped in [ListView]. Set to false when
  /// content uses [Expanded] or has its own scroll.
  bool scrollable = true,

  /// Whether tapping the barrier dismisses the drawer.
  bool barrierDismissible = true,
}) {
  return showGeneralDialog<T>(
    context: context,
    barrierDismissible: barrierDismissible,
    barrierLabel: MaterialLocalizations.of(context).modalBarrierDismissLabel,
    barrierColor: Colors.black54,
    transitionDuration: const Duration(milliseconds: 300),
    pageBuilder: (context, animation, secondaryAnimation) {
      return AppRightDrawer(
        title: title,
        titleWidget: titleWidget,
        titleIcon: titleIcon,
        showCloseButton: showCloseButton,
        content: content,
        footerSection: footerSection,
        width: width,
        scrollable: scrollable,
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

/// Content widget for [showAppRightDrawer]. Builds the drawer panel with
/// optional title bar (with full-width bottom border), main content, and
/// optional footer section.
class AppRightDrawer extends StatelessWidget {
  const AppRightDrawer({
    super.key,
    this.title,
    this.titleWidget,
    this.titleIcon,
    this.showCloseButton = true,
    required this.content,
    this.footerSection,
    this.width = 600,
    this.scrollable = true,
  });

  final String? title;
  final Widget? titleWidget;
  final IconData? titleIcon;
  final bool showCloseButton;
  final Widget content;
  final Widget? footerSection;
  final double width;
  final bool scrollable;

  bool get _hasHeader => title != null || titleWidget != null;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final screenWidth = MediaQuery.of(context).size.width;
    final bgColor = isDark ? AppFillColorDark.base : AppFillColorLight.blank;
    final textColor =
        isDark ? AppTextColorDark.primary : AppTextColorLight.primary;
    final borderColor =
        isDark ? AppBorderColorDark.darker : AppBorderColorLight.darker;

    final effectiveWidth = math.min(width, screenWidth * 0.8);

    final paddedContent = scrollable
        ? ListView(
            shrinkWrap: true,
            primary: false,
            children: [content],
          )
        : content;

    return Align(
      alignment: Alignment.centerRight,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: effectiveWidth),
        child: Material(
          color: bgColor,
          elevation: 16,
          child: DecoratedBox(
            decoration: BoxDecoration(
              border: Border(
                left: BorderSide(
                  color: borderColor,
                  width: AppSpacings.scale(1),
                ),
              ),
            ),
            child: SafeArea(
              child: Column(
                children: [
                  if (_hasHeader)
                    Container(
                      width: double.infinity,
                      decoration: BoxDecoration(
                        border: Border(
                          bottom: BorderSide(
                            color: borderColor,
                            width: AppSpacings.scale(1),
                          ),
                        ),
                      ),
                      child: Padding(
                        padding: EdgeInsets.symmetric(
                          horizontal: AppSpacings.pLg,
                          vertical: AppSpacings.pMd,
                        ),
                        child: _buildHeader(context, textColor, isDark),
                      ),
                    ),
                  Expanded(
                    child: paddedContent,
                  ),
                  if (footerSection != null)
                    Container(
                      width: double.infinity,
                      decoration: BoxDecoration(
                        border: Border(
                          top: BorderSide(
                            color: borderColor,
                            width: AppSpacings.scale(1),
                          ),
                        ),
                      ),
                      child: Padding(
                        padding: EdgeInsets.symmetric(
                          horizontal: AppSpacings.pLg,
                          vertical: AppSpacings.pMd,
                        ),
                        child: footerSection!,
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context, Color textColor, bool isDark) {
    final titleContent = titleWidget ??
        (title != null
            ? Row(
                spacing: AppSpacings.pSm,
                children: [
                  if (titleIcon != null)
                    Icon(
                      titleIcon,
                      color: textColor,
                      size: AppSpacings.scale(24),
                    ),
                  Text(
                    title!.toUpperCase(),
                    style: TextStyle(
                      color: textColor,
                      fontSize: AppFontSize.large,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              )
            : null);

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        if (titleContent != null) Expanded(child: titleContent),
        if (showCloseButton) _buildCloseButton(context, isDark),
      ],
    );
  }

  Widget _buildCloseButton(BuildContext context, bool isDark) {
    return Theme(
      data: isDark
          ? ThemeData(
              brightness: Brightness.dark,
              filledButtonTheme: AppFilledButtonsDarkThemes.neutral,
            )
          : ThemeData(
              filledButtonTheme: AppFilledButtonsLightThemes.neutral,
            ),
      child: FilledButton(
        onPressed: () {
          HapticFeedback.lightImpact();
          Navigator.pop(context);
        },
        style: FilledButton.styleFrom(
          padding: EdgeInsets.zero,
          minimumSize: Size(AppSpacings.scale(32), AppSpacings.scale(32)),
          maximumSize: Size(AppSpacings.scale(32), AppSpacings.scale(32)),
          shape: const CircleBorder(),
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        ),
        child: Icon(
          MdiIcons.close,
          size: AppSpacings.scale(18),
          color: isDark
              ? AppFilledButtonsDarkThemes.neutralForegroundColor
              : AppFilledButtonsLightThemes.neutralForegroundColor,
        ),
      ),
    );
  }
}
