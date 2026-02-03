import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/vertical_scroll_with_gradient.dart';
import 'package:flutter/material.dart';

/// A reusable portrait layout widget for device detail pages.
///
/// Provides a scrollable content area with gradient overlays and consistent padding.
/// Similar to [PortraitViewLayout] but without mode selector support
/// since device details don't use domain-level mode selection.
///
/// Optionally supports a sticky bottom widget that stays fixed at the bottom
/// of the screen while the main content scrolls.
///
/// Example usage:
/// ```dart
/// DevicePortraitLayout(
///   content: Column(
///     children: [
///       _buildControlCard(context),
///       AppSpacings.spacingMdVertical,
///       _buildStatusCard(context),
///     ],
///   ),
///   stickyBottom: _buildChannelsPanel(context), // Optional sticky bottom
/// )
/// ```
class DevicePortraitLayout extends StatelessWidget {
  /// The main scrollable content
  final Widget content;

  /// Optional sticky bottom widget
  /// If provided, stays fixed at the bottom while content scrolls
  final Widget? stickyBottom;

  /// Padding for the content area
  /// Default: AppSpacings.paddingLg on all sides (same as domain view)
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

  /// Height of the gradient overlay at top and bottom
  /// Default: AppSpacings.pLg
  final double? gradientHeight;

  /// Whether to show a top border on the sticky bottom
  /// Default: true
  final bool showStickyBottomBorder;

  const DevicePortraitLayout({
    super.key,
    required this.content,
    this.stickyBottom,
    this.contentPadding,
    this.stickyBottomPadding,
    this.useStickyBottomPadding = true,
    this.scrollable = true,
    this.gradientHeight,
    this.showStickyBottomBorder = true,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final defaultPadding = AppSpacings.paddingLg;

    // Build the scrollable content widget
    Widget contentWidget;
    if (scrollable) {
      contentWidget = VerticalScrollWithGradient(
        gradientHeight: gradientHeight ?? AppSpacings.pLg,
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
    } else {
      contentWidget = Padding(
        padding: defaultPadding,
        child: content,
      );
    }

    // If no sticky bottom, just return the content
    if (stickyBottom == null) {
      return contentWidget;
    }

    // With sticky bottom: Column with expanded content and sticky bottom
    return Column(
      children: [
        // Scrollable content
        Expanded(child: contentWidget),

        // Sticky bottom
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
          child: stickyBottom,
        ),
      ],
    );
  }
}
