import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

/// A horizontal scrollable list with gradient overlays on the edges.
///
/// This widget extends beyond its parent's padding to reach screen edges,
/// while the actual list content respects the padding. Gradient overlays
/// on both sides indicate that more content is available.
///
/// Example usage:
/// ```dart
/// HorizontalScrollWithGradient(
///   height: 64,
///   layoutPadding: AppSpacings.pLg,
///   itemCount: items.length,
///   separatorWidth: AppSpacings.pSm,
///   itemBuilder: (context, index) => MyTile(item: items[index]),
/// )
/// ```
class HorizontalScrollWithGradient extends StatelessWidget {
  /// Height of the scrollable area
  final double height;

  /// The layout padding to extend beyond (gradient width matches this)
  final double layoutPadding;

  /// Number of items in the list
  final int itemCount;

  /// Builder for each item
  final Widget Function(BuildContext context, int index) itemBuilder;

  /// Width of separator between items
  final double separatorWidth;

  /// Optional background color for gradients (defaults to page background)
  final Color? backgroundColor;

  const HorizontalScrollWithGradient({
    super.key,
    required this.height,
    required this.layoutPadding,
    required this.itemCount,
    required this.itemBuilder,
    this.separatorWidth = 0,
    this.backgroundColor,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bgColor =
        backgroundColor ?? (isDark ? AppBgColorDark.page : AppBgColorLight.page);

    return LayoutBuilder(
      builder: (context, constraints) {
        final totalWidth = constraints.maxWidth + 2 * layoutPadding;

        return SizedBox(
          height: height,
          child: OverflowBox(
            maxWidth: totalWidth,
            alignment: Alignment.centerLeft,
            child: Transform.translate(
              offset: Offset(-layoutPadding, 0),
              child: SizedBox(
                width: totalWidth,
                height: height,
                child: Stack(
                  children: [
                    // Scrollable list
                    ListView.separated(
                      scrollDirection: Axis.horizontal,
                      itemCount: itemCount,
                      separatorBuilder: (_, __) =>
                          SizedBox(width: separatorWidth),
                      itemBuilder: (context, index) {
                        final isFirst = index == 0;
                        final isLast = index == itemCount - 1;

                        return Padding(
                          padding: EdgeInsets.only(
                            left: isFirst ? layoutPadding : 0,
                            right: isLast ? layoutPadding : 0,
                          ),
                          child: itemBuilder(context, index),
                        );
                      },
                    ),
                    // Left gradient overlay
                    Positioned(
                      left: 0,
                      top: 0,
                      bottom: 0,
                      width: layoutPadding,
                      child: IgnorePointer(
                        child: Container(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.centerLeft,
                              end: Alignment.centerRight,
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
                    // Right gradient overlay
                    Positioned(
                      right: 0,
                      top: 0,
                      bottom: 0,
                      width: layoutPadding,
                      child: IgnorePointer(
                        child: Container(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.centerRight,
                              end: Alignment.centerLeft,
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
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
