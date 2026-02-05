import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Shows a modal bottom sheet with consistent styling across the app.
///
/// Use [showAppBottomSheet] to present a bottom sheet with optional title
/// bar, handle, main content, and optional bottom section (e.g. action buttons).
/// When [title] is null and [titleWidget] is null, no default header is shown.
///
/// Example with title and bottom section:
/// ```dart
/// showAppBottomSheet(
///   context,
///   title: 'Select option',
///   content: ListView(...),
///   bottomSection: FilledButton(onPressed: () => ..., child: Text('Done')),
/// );
/// ```
void showAppBottomSheet(
  BuildContext context, {
  /// Optional title. Shown in the header when [titleWidget] is null.
  /// Header is shown when [title] is non-null or [titleWidget] is non-null.
  String? title,
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
  /// Max height as a fraction of screen height. Default 0.7.
  double maxHeightFactor = 0.7,
  /// Padding around the sheet content. When null, default padding is used.
  /// Use [EdgeInsets.zero] for full-bleed content.
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
    builder: (sheetContext) => AppBottomSheet(
      title: title,
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

/// Content widget for [showAppBottomSheet]. Builds the sheet container with
/// optional handle, optional title bar (with full-width bottom border), main content, and optional bottom section.
class AppBottomSheet extends StatelessWidget {
  const AppBottomSheet({
    super.key,
    this.title,
    this.titleWidget,
    this.titleIcon,
    this.showHandle = true,
    this.showCloseButton = true,
    required this.content,
    this.bottomSection,
    this.maxHeightFactor = 0.7,
    this.contentPadding,
    this.scrollable = true,
  });

  final String? title;
  final Widget? titleWidget;
  final IconData? titleIcon;
  final bool showHandle;
  final bool showCloseButton;
  final Widget content;
  final Widget? bottomSection;
  final double maxHeightFactor;
  final EdgeInsets? contentPadding;
  final bool scrollable;

  static final ScreenService _screenService = locator<ScreenService>();
  static final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  static double _scale(double value) =>
      _screenService.scale(value, density: _visualDensityService.density);

  bool get _hasHeader => title != null || titleWidget != null;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final maxHeight = MediaQuery.of(context).size.height * maxHeightFactor;
    final bgColor = isDark ? AppFillColorDark.base : AppFillColorLight.blank;
    final handleColor =
        isDark ? AppFillColorDark.darker : AppFillColorLight.darker;
    final textColor =
        isDark ? AppTextColorDark.primary : AppTextColorLight.primary;
    final borderColor =
        isDark ? AppBorderColorDark.darker : AppBorderColorLight.darker;        

    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: maxHeight),
      child: Container(
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius:
              BorderRadius.vertical(top: Radius.circular(_scale(24))),
        ),
        child: SafeArea(
          top: false,
          child: LayoutBuilder(
            builder: (context, constraints) {
              // Apply contentPadding if provided, otherwise no padding on content
              final paddedContent = contentPadding != null
                  ? Padding(padding: contentPadding!, child: content)
                  : content;
              final contentArea = scrollable
                  ? ListView(
                      shrinkWrap: true,
                      primary: false,
                      children: [paddedContent],
                    )
                  : paddedContent;
              return Padding(
                padding: EdgeInsets.only(
                  top: AppSpacings.pMd,
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (showHandle) ...[
                      _buildHandle(handleColor),
                      AppSpacings.spacingMdVertical,
                    ],
                    if (_hasHeader) ...[
                      Container(
                        width: double.infinity,
                        decoration: BoxDecoration(
                          border: Border(
                            bottom: BorderSide(
                              color: borderColor,
                              width: _scale(1),
                            ),
                          ),
                        ),
                        child: Padding(
                          padding: EdgeInsets.only(
                            left: AppSpacings.pLg,
                            right: AppSpacings.pLg,
                            bottom: AppSpacings.pMd,
                          ),
                          child: _buildHeader(context, textColor, isDark),
                        ),
                      ),
                    ],
                    Flexible(
                      child: contentArea,
                    ),
                    if (bottomSection != null) ...[
                      Container(
                        width: double.infinity,
                        decoration: BoxDecoration(
                          border: Border(
                            top: BorderSide(
                              color: borderColor,
                              width: _scale(1),
                            ),
                          ),
                        ),
                        child: Padding(
                          padding: EdgeInsets.symmetric(
                            horizontal: AppSpacings.pLg,
                            vertical: AppSpacings.pMd,
                          ),
                          child: bottomSection!,
                        ),
                      ),
                    ],
                  ],
                ),
              );
            },
          ),
        ),
      ),
    );
  }

  Widget _buildHandle(Color handleColor) {
    return Center(
      child: Container(
        width: _scale(36),
        height: _scale(4),
        decoration: BoxDecoration(
          color: handleColor,
          borderRadius: BorderRadius.circular(AppBorderRadius.small),
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
                      size: _scale(24),
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
          minimumSize: Size(_scale(32), _scale(32)),
          maximumSize: Size(_scale(32), _scale(32)),
          shape: const CircleBorder(),
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        ),
        child: Icon(
          MdiIcons.close,
          size: _scale(18),
          color: isDark
              ? AppFilledButtonsDarkThemes.neutralForegroundColor
              : AppFilledButtonsLightThemes.neutralForegroundColor,
        ),
      ),
    );
  }
}
