import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/vertical_scroll_with_gradient.dart';
import 'package:flutter/material.dart';

/// A reusable portrait layout widget for domain view pages.
///
/// Provides flexible layout modes:
/// - **Scrollable**: Content wrapped in a gradient-masked scroll view
/// - **Non-scrollable**: Content with optional padding
///
/// Example usage:
/// ```dart
/// PortraitViewLayout(
///   content: MyContent(),
///   contentPadding: AppSpacings.paddingLg,
/// )
/// ```
class PortraitViewLayout extends StatelessWidget {
  /// The main content
  final Widget content;

  /// Padding for the content area
  final EdgeInsetsGeometry? contentPadding;

  /// Whether the content should be scrollable
  /// Default: true
  final bool scrollable;

  /// Custom scroll controller for the content
  final ScrollController? scrollController;

  const PortraitViewLayout({
    super.key,
    required this.content,
    this.contentPadding,
    this.scrollable = true,
    this.scrollController,
  });

  @override
  Widget build(BuildContext context) {
    final defaultPadding = EdgeInsets.symmetric(
      horizontal: AppSpacings.pLg,
      vertical: AppSpacings.pMd,
    );

    if (scrollable) {
      return VerticalScrollWithGradient(
        gradientHeight: AppSpacings.pMd,
        padding: contentPadding ?? defaultPadding,
        itemCount: 1,
        separatorHeight: 0,
        itemBuilder: (context, index) => content,
        controller: scrollController,
      );
    }

    return Padding(
      padding: contentPadding ?? defaultPadding,
      child: content,
    );
  }
}
