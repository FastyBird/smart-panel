import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// The sizes the bottom sheet and the right drawer share (design canvas,
/// "Navigation and overlays").
class SheetMetrics {
  SheetMetrics._();

  /// Padding around the sheet's or drawer's parts.
  static double paddingFor(ScreenSizeClass sizeClass) => switch (sizeClass) {
    ScreenSizeClass.compact => 8,
    ScreenSizeClass.regular => 12,
    ScreenSizeClass.expanded => 16,
  };

  /// Space between the handle, header, content and bottom section.
  static double gapFor(ScreenSizeClass sizeClass) => switch (sizeClass) {
    ScreenSizeClass.compact => 6,
    ScreenSizeClass.regular => 10,
    ScreenSizeClass.expanded => 14,
  };

  /// The title: 14 / 16 / 20, 500.
  static double titleFor(ScreenSizeClass sizeClass) => switch (sizeClass) {
    ScreenSizeClass.compact => 14,
    ScreenSizeClass.regular => 16,
    ScreenSizeClass.expanded => 20,
  };

  /// The right drawer's width.
  static double drawerWidthFor(ScreenSizeClass sizeClass) => switch (sizeClass) {
    ScreenSizeClass.compact => 220,
    ScreenSizeClass.regular => 300,
    ScreenSizeClass.expanded => 380,
  };

  /// Space above the handle.
  static const double handleTop = 6;
  static const double handleWidth = 28;
  static const double handleHeight = 4;

  /// The header row and its close button.
  static const double headerHeight = 36;
  static const double closeButton = 36;
  static const double closeIcon = 16;
  static const double titleIcon = 20;
}

/// Shows a modal bottom sheet with consistent styling across the app.
///
/// Use [showBottomSheetDialog] to present a bottom sheet with optional title
/// bar, handle, main content, and optional bottom section (e.g. action buttons).
/// When [title] is null and [titleWidget] is null, no default header is shown.
///
/// Example with title and bottom section:
/// ```dart
/// showBottomSheetDialog(
///   context,
///   title: 'Select option',
///   content: ListView(...),
///   bottomSection: FilledButton(onPressed: () => ..., child: Text('Done')),
/// );
/// ```
void showBottomSheetDialog(
  BuildContext context, {
  /// Optional title. Shown in the header when [titleWidget] is null.
  /// Header is shown when [title] is non-null or [titleWidget] is non-null.
  String? title,
  /// A line under the title in `text.secondary`.
  String? subtitle,
  /// Optional custom widget for the title. When set, has priority over [title].
  Widget? titleWidget,
  /// Optional icon shown before the text title in the header. Only used when
  /// [titleWidget] is null (i.e. when the string [title] is displayed).
  IconData? titleIcon,
  /// Whether to show the drag handle at the top. Defaults to true when header is shown, false otherwise.
  bool? showHandle,
  /// Whether to show the close button in the header. Ignored when no header.
  bool showCloseButton = true,
  /// Main content of the sheet.
  required Widget content,
  /// Optional bottom section (e.g. primary action button). Shown below [content].
  Widget? bottomSection,
  /// Whether the sheet can grow to fill the screen (scrollable content). Default true.
  bool isScrollControlled = true,
  /// Max height as a fraction of screen height. Default 0.8.
  double maxHeightFactor = 0.8,
  /// Padding around the sheet content. When null, the content is laid out
  /// edge to edge and pads itself.
  EdgeInsets? contentPadding,
  /// When true, content is wrapped in [SingleChildScrollView]. Set to false when
  /// content uses [Expanded] or has its own scroll (e.g. charts).
  bool scrollable = true,
}) {
  final hasHeader = title != null || titleWidget != null;
  final effectiveShowHandle = showHandle ?? hasHeader;
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: isScrollControlled,
    backgroundColor: AppColors.blank,
    barrierColor: AppScrim.color,
    elevation: 0,
    builder: (sheetContext) => BottomSheetDialog(
      title: title,
      subtitle: subtitle,
      titleWidget: titleWidget,
      titleIcon: titleIcon,
      showHandle: effectiveShowHandle,
      showCloseButton: showCloseButton,
      content: content,
      bottomSection: bottomSection,
      maxHeightFactor: maxHeightFactor,
      contentPadding: contentPadding,
      scrollable: scrollable,
    ),
  );
}

/// The bottom sheet (docs/display-ui-design-spec.md §5): `surface.raised`
/// with a `border.light` outline, radius 12 at the top, one soft shadow in
/// light and none in dark. A grab handle, then a 36 px header with the title,
/// an optional subtitle and a close button, then the content and an optional
/// bottom section.
class BottomSheetDialog extends StatelessWidget {
  const BottomSheetDialog({
    super.key,
    this.title,
    this.subtitle,
    this.titleWidget,
    this.titleIcon,
    this.showHandle = true,
    this.showCloseButton = true,
    required this.content,
    this.bottomSection,
    this.maxHeightFactor = 0.7,
    this.contentPadding,
    this.scrollable = true,
    this.sizeClass,
  });

  final String? title;
  final String? subtitle;
  final Widget? titleWidget;
  final IconData? titleIcon;
  final bool showHandle;
  final bool showCloseButton;
  final Widget content;
  final Widget? bottomSection;
  final double maxHeightFactor;
  final EdgeInsets? contentPadding;
  final bool scrollable;

  /// The class to size the sheet for; defaults to the screen's.
  final ScreenSizeClass? sizeClass;

  bool get _hasHeader => title != null || titleWidget != null;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final neutrals = theme.neutrals;
    final screen = locator<ScreenService>();
    final resolvedClass = sizeClass ?? screen.sizeClass;
    final maxHeight = screen.logicalHeight * maxHeightFactor;
    final padding = AppSpacings.scale(SheetMetrics.paddingFor(resolvedClass));
    final gap = AppSpacings.scale(SheetMetrics.gapFor(resolvedClass));
    final radius = Radius.circular(AppBorderRadius.medium);

    final paddedContent = contentPadding != null
        ? Padding(padding: contentPadding!, child: content)
        : content;
    final contentArea = scrollable
        ? ListView(
            shrinkWrap: true,
            primary: false,
            padding: EdgeInsets.zero,
            children: [paddedContent],
          )
        : paddedContent;

    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: maxHeight),
      child: Container(
        decoration: BoxDecoration(
          color: neutrals.surfaceRaised,
          border: Border.all(
            color: neutrals.borderLight,
            width: AppSpacings.scale(1),
          ),
          borderRadius: BorderRadius.vertical(top: radius),
          boxShadow: AppRaisedShadow.of(
            theme.brightness,
            offset: const Offset(0, -4),
          ),
        ),
        child: Material(
          type: MaterialType.transparency,
          child: SafeArea(
            top: false,
            child: Padding(
              padding: EdgeInsets.only(
                top: showHandle
                    ? AppSpacings.scale(SheetMetrics.handleTop)
                    : padding,
                bottom: padding,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                spacing: gap,
                children: [
                  if (showHandle)
                    Center(
                      child: Container(
                        width: AppSpacings.scale(SheetMetrics.handleWidth),
                        height: AppSpacings.scale(SheetMetrics.handleHeight),
                        decoration: BoxDecoration(
                          color: AppControlColors.handle(theme.brightness),
                          borderRadius: BorderRadius.circular(
                            AppBorderRadius.round,
                          ),
                        ),
                      ),
                    ),
                  if (_hasHeader)
                    Padding(
                      padding: EdgeInsets.symmetric(horizontal: padding),
                      child: SheetHeader(
                        title: title,
                        subtitle: subtitle,
                        titleWidget: titleWidget,
                        titleIcon: titleIcon,
                        showCloseButton: showCloseButton,
                        sizeClass: resolvedClass,
                      ),
                    ),
                  Flexible(child: contentArea),
                  if (bottomSection != null)
                    Padding(
                      padding: EdgeInsets.symmetric(horizontal: padding),
                      child: bottomSection!,
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// The header of a sheet or drawer: an optional icon, the title (14 / 16 / 20,
/// 500) with an optional subtitle (10, `text.secondary`), and a 36 px close
/// button on `fill.base`.
class SheetHeader extends StatelessWidget {
  const SheetHeader({
    super.key,
    this.title,
    this.subtitle,
    this.titleWidget,
    this.titleIcon,
    this.showCloseButton = true,
    this.sizeClass,
  });

  final String? title;
  final String? subtitle;
  final Widget? titleWidget;
  final IconData? titleIcon;
  final bool showCloseButton;
  final ScreenSizeClass? sizeClass;

  @override
  Widget build(BuildContext context) {
    final neutrals = Theme.of(context).neutrals;
    final resolvedClass = sizeClass ?? locator<ScreenService>().sizeClass;
    final hasSubtitle = subtitle != null && subtitle!.isNotEmpty;

    final heading =
        titleWidget ??
        Row(
          spacing: AppSpacings.pMd,
          children: [
            if (titleIcon != null)
              Icon(
                titleIcon,
                color: neutrals.textSecondary,
                size: AppSpacings.scale(SheetMetrics.titleIcon),
              ),
            Expanded(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                spacing: AppSpacings.scale(1),
                children: [
                  Semantics(
                    header: true,
                    child: Text(
                      title ?? '',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: neutrals.textPrimary,
                        fontSize: AppSpacings.scale(
                          SheetMetrics.titleFor(resolvedClass),
                        ),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                  if (hasSubtitle)
                    Text(
                      subtitle!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: neutrals.textSecondary,
                        fontSize: AppFontSize.extraSmall,
                      ),
                    ),
                ],
              ),
            ),
          ],
        );

    return ConstrainedBox(
      constraints: BoxConstraints(
        minHeight: AppSpacings.scale(SheetMetrics.headerHeight),
      ),
      child: Row(
        spacing: AppSpacings.pMd,
        children: [
          Expanded(child: heading),
          if (showCloseButton) const SheetCloseButton(),
        ],
      ),
    );
  }
}

/// The 36 px close button of a sheet, drawer or selection dialog: `fill.base`,
/// radius 8, a 16 px close icon. Pops the route.
class SheetCloseButton extends StatelessWidget {
  const SheetCloseButton({super.key, this.onTap});

  /// Defaults to popping the route.
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final neutrals = Theme.of(context).neutrals;
    final radius = BorderRadius.circular(AppBorderRadius.base);
    final size = AppSpacings.scale(SheetMetrics.closeButton);

    return Semantics(
      button: true,
      label: AppLocalizations.of(context)!.button_close,
      excludeSemantics: true,
      child: Material(
        color: neutrals.fillBase,
        borderRadius: radius,
        child: InkWell(
          borderRadius: radius,
          onTap:
              onTap ??
              () {
                HapticFeedback.lightImpact();
                Navigator.of(context).pop();
              },
          child: SizedBox.square(
            dimension: size,
            child: Icon(
              MdiIcons.close,
              size: AppSpacings.scale(SheetMetrics.closeIcon),
              color: neutrals.textPrimary,
            ),
          ),
        ),
      ),
    );
  }
}
