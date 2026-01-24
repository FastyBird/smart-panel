import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

/// A vertical scrollable list with gradient overlays on the edges.
///
/// This widget displays a vertically scrolling list with gradient overlays
/// at the top and bottom to indicate that more content is available.
///
/// Example usage:
/// ```dart
/// VerticalScrollWithGradient(
///   gradientHeight: AppSpacings.pLg,
///   itemCount: items.length,
///   separatorHeight: AppSpacings.pSm,
///   padding: AppSpacings.paddingLg,
///   itemBuilder: (context, index) => MyTile(item: items[index]),
/// )
/// ```
class VerticalScrollWithGradient extends StatelessWidget {
  /// Height of the gradient overlay at top and bottom
  final double gradientHeight;

  /// Number of items in the list
  final int itemCount;

  /// Builder for each item
  final Widget Function(BuildContext context, int index) itemBuilder;

  /// Height of separator between items
  final double separatorHeight;

  /// Optional background color for gradients (defaults to page background)
  final Color? backgroundColor;

  /// Padding around the list content (applied to each item horizontally,
  /// and to first/last items vertically)
  final EdgeInsetsGeometry padding;

  const VerticalScrollWithGradient({
    super.key,
    required this.gradientHeight,
    required this.itemCount,
    required this.itemBuilder,
    this.separatorHeight = 0,
    this.backgroundColor,
    this.padding = EdgeInsets.zero,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor =
        backgroundColor ?? (isDark ? AppBgColorDark.base : AppBgColorLight.page);

    // Resolve padding to get individual values
    final resolvedPadding = padding.resolve(TextDirection.ltr);

    return Stack(
      children: [
        // Scrollable list
        ListView.separated(
          scrollDirection: Axis.vertical,
          itemCount: itemCount,
          separatorBuilder: (_, __) => SizedBox(height: separatorHeight),
          itemBuilder: (context, index) {
            final isFirst = index == 0;
            final isLast = index == itemCount - 1;

            return Padding(
              padding: EdgeInsets.only(
                left: resolvedPadding.left,
                right: resolvedPadding.right,
                top: isFirst ? resolvedPadding.top : 0,
                bottom: isLast ? resolvedPadding.bottom : 0,
              ),
              child: itemBuilder(context, index),
            );
          },
        ),
        // Top gradient overlay
        Positioned(
          left: 0,
          right: 0,
          top: 0,
          height: gradientHeight,
          child: IgnorePointer(
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    bgColor,
                    bgColor.withValues(alpha: 0.7),
                    bgColor.withValues(alpha: 0),
                  ],
                  stops: const [0.0, 0.5, 1.0],
                ),
              ),
            ),
          ),
        ),
        // Bottom gradient overlay
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          height: gradientHeight,
          child: IgnorePointer(
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.bottomCenter,
                  end: Alignment.topCenter,
                  colors: [
                    bgColor,
                    bgColor.withValues(alpha: 0.7),
                    bgColor.withValues(alpha: 0),
                  ],
                  stops: const [0.0, 0.5, 1.0],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
