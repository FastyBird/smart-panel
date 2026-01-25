import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/vertical_scroll_with_gradient.dart';
import 'package:flutter/material.dart';

/// A reusable portrait layout widget for device detail pages.
///
/// Provides a scrollable content area with gradient overlays and consistent padding.
/// Similar to [PortraitViewLayout] but without mode selector support
/// since device details don't use domain-level mode selection.
///
/// Example usage:
/// ```dart
/// DeviceDetailPortraitLayout(
///   content: Column(
///     children: [
///       _buildControlCard(context),
///       AppSpacings.spacingMdVertical,
///       _buildStatusCard(context),
///     ],
///   ),
/// )
/// ```
class DeviceDetailPortraitLayout extends StatelessWidget {
  /// The main scrollable content
  final Widget content;

  /// Padding for the content area
  /// Default: AppSpacings.paddingLg on all sides (same as domain view)
  final EdgeInsetsGeometry? contentPadding;

  /// Whether the content should be scrollable
  /// Default: true
  final bool scrollable;

  /// Height of the gradient overlay at top and bottom
  /// Default: AppSpacings.pLg
  final double? gradientHeight;

  const DeviceDetailPortraitLayout({
    super.key,
    required this.content,
    this.contentPadding,
    this.scrollable = true,
    this.gradientHeight,
  });

  @override
  Widget build(BuildContext context) {
    final defaultPadding = AppSpacings.paddingLg;

    if (scrollable) {
      return VerticalScrollWithGradient(
        gradientHeight: gradientHeight ?? AppSpacings.pLg,
        padding: contentPadding ?? defaultPadding,
        itemCount: 1,
        separatorHeight: 0,
        itemBuilder: (context, index) => content,
      );
    }

    if (contentPadding != null) {
      return Padding(
        padding: contentPadding!,
        child: content,
      );
    }

    return Padding(
      padding: defaultPadding,
      child: content,
    );
  }
}
