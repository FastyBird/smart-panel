import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/vertical_scroll_with_gradient.dart';
import 'package:flutter/material.dart';

/// A reusable portrait layout widget for domain view pages.
///
/// Provides flexible layout modes with optional sticky bottom elements:
/// - **With mode selector**: Scrollable content + sticky mode selector at bottom
/// - **With sticky bottom**: Scrollable content + sticky bottom widget (fallback when no mode selector)
/// - **Without either**: Scrollable content with bottom padding for page indicator
///
/// Priority for sticky bottom area: modeSelector > stickyBottom > nothing
///
/// The sticky element has a top border and sits above the page swipe dots.
///
/// Example usage:
/// ```dart
/// PortraitViewLayout(
///   content: MyScrollableContent(),
///   modeSelector: MyModeSelector(), // Optional - highest priority for sticky bottom
///   stickyBottom: MyChannelsList(), // Optional - used if modeSelector is null
/// )
/// ```
class PortraitViewLayout extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  /// The main scrollable content
  final Widget content;

  /// Optional mode selector widget (sticky at bottom, highest priority)
  /// If null, [stickyBottom] is used instead
  final Widget? modeSelector;

  /// Optional sticky bottom widget (used when [modeSelector] is null)
  /// Useful for channels lists or other secondary content
  final Widget? stickyBottom;

  /// Padding for the content area
  final EdgeInsetsGeometry? contentPadding;

  /// Padding for the sticky bottom area
  /// Default: horizontal pLg, top pMd, bottom pLg
  /// Only used when [useStickyBottomPadding] is true
  final EdgeInsetsGeometry? stickyBottomPadding;

  /// Whether to apply padding to the sticky bottom area
  /// Default: true
  final bool useStickyBottomPadding;

  /// Whether the content should be scrollable
  /// Default: true
  final bool scrollable;

  /// Custom scroll controller for the content
  final ScrollController? scrollController;

  /// Whether to show a top border on the sticky bottom
  /// Default: true
  final bool showStickyBottomBorder;

  PortraitViewLayout({
    super.key,
    required this.content,
    this.modeSelector,
    this.stickyBottom,
    this.contentPadding,
    this.stickyBottomPadding,
    this.useStickyBottomPadding = true,
    this.scrollable = true,
    this.scrollController,
    this.showStickyBottomBorder = true,
  });

  double _scale(double value) =>
      _screenService.scale(value, density: _visualDensityService.density);

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // Determine which sticky bottom widget to use (priority: modeSelector > stickyBottom)
    final effectiveStickyBottom = modeSelector ?? stickyBottom;

    // Build the content widget
    Widget contentWidget = content;

    // Wrap in ScrollView if scrollable
    if (scrollable) {
      // Add bottom padding when no sticky bottom to keep page indicator visible
      final bottomPadding = effectiveStickyBottom == null ? _scale(24) : 0.0;
      final defaultPadding = EdgeInsets.only(
        left: AppSpacings.pLg,
        right: AppSpacings.pLg,
        top: AppSpacings.pLg,
        bottom: AppSpacings.pLg + bottomPadding,
      );

      contentWidget = VerticalScrollWithGradient(
        gradientHeight: AppSpacings.pLg,
        padding: contentPadding ?? defaultPadding,
        itemCount: 1,
        separatorHeight: 0,
        itemBuilder: (context, index) => content,
      );
    } else if (contentPadding != null) {
      contentWidget = Padding(
        padding: contentPadding!,
        child: content,
      );
    }

    // If no sticky bottom, just return the content
    if (effectiveStickyBottom == null) {
      return contentWidget;
    }

    // With sticky bottom: Column with expanded content and sticky bottom
    return Column(
      children: [
        // Scrollable content
        Expanded(child: contentWidget),

        // Sticky bottom element
        Container(
          width: double.infinity,
          decoration: BoxDecoration(
            color: isDark ? AppBgColorDark.page : AppBgColorLight.page,
            border: showStickyBottomBorder
                ? Border(
                    top: BorderSide(
                      color: isDark
                          ? AppBorderColorDark.light
                          : AppBorderColorLight.base,
                      width: 1,
                    ),
                  )
                : null,
          ),
          padding: useStickyBottomPadding
              ? (stickyBottomPadding ??
                  EdgeInsets.only(
                    left: AppSpacings.pLg,
                    right: AppSpacings.pLg,
                    top: AppSpacings.pMd,
                    bottom: AppSpacings.pLg,
                  ))
              : EdgeInsets.zero,
          child: effectiveStickyBottom,
        ),
      ],
    );
  }
}
