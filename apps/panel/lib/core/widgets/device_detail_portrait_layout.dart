import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

/// A reusable portrait layout widget for device detail pages.
///
/// Provides a scrollable content area with consistent padding.
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

  /// Custom scroll controller for the content
  final ScrollController? scrollController;

  const DeviceDetailPortraitLayout({
    super.key,
    required this.content,
    this.contentPadding,
    this.scrollable = true,
    this.scrollController,
  });

  @override
  Widget build(BuildContext context) {
    final defaultPadding = AppSpacings.paddingLg;

    if (scrollable) {
      return SingleChildScrollView(
        controller: scrollController,
        padding: contentPadding ?? defaultPadding,
        child: content,
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
