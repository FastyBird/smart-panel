import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

class FixedScreenGridItem extends StatelessWidget {
  final Widget child;
  final int mainAxisIndex;
  final int crossAxisIndex;
  final int mainAxisCellCount;
  final int crossAxisCellCount;

  const FixedScreenGridItem({
    super.key,
    required this.child,
    required this.mainAxisIndex,
    required this.crossAxisIndex,
    this.mainAxisCellCount = 1,
    this.crossAxisCellCount = 1,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      alignment: Alignment.center,
      child: Padding(
        padding: AppSpacings.paddingXs,
        child: child,
      ),
    );
  }
}

class FixedScreenGrid extends StatelessWidget {
  final _screenService = locator<ScreenService>();

  final List<FixedScreenGridItem> children;

  final Alignment alignment;

  FixedScreenGrid({
    super.key,
    required this.children,
    this.alignment = Alignment.topLeft,
  });

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final containerWidth = constraints.maxWidth;
        final containerHeight = constraints.maxHeight;

        // Optimal tile width from configuration
        final optimalTileWidth = _screenService.tileSize;

        // Calculate number of columns and rows
        int crossAxisCount = (containerWidth / optimalTileWidth).floor();

        crossAxisCount = crossAxisCount.isEven
            ? crossAxisCount
            : crossAxisCount + 1; // Ensure even count

        final tileWidth = containerWidth / crossAxisCount;

        // Calculate the number of rows
        final mainAxisCount = (containerHeight / tileWidth).ceil();
        final tileHeight = containerHeight / mainAxisCount;

        return Stack(
          children: children
              .map((item) {
                if (item.mainAxisIndex > mainAxisCount ||
                    item.crossAxisIndex > crossAxisCount) {
                  return null;
                }

                return Positioned(
                  top: (item.mainAxisIndex - 1) * tileHeight,
                  left: (item.crossAxisIndex - 1) * tileWidth,
                  width: item.crossAxisCellCount * tileWidth,
                  height: item.mainAxisCellCount * tileHeight,
                  child: item,
                );
              })
              .whereType<Positioned>()
              .toList(),
        ).applyAlignment(
          alignment,
          containerWidth,
          containerHeight,
        );
      },
    );
  }
}

// Extension for alignment adjustment
extension AlignmentExtension on Stack {
  Widget applyAlignment(
    Alignment alignment,
    double boxWidth,
    double boxHeight,
  ) {
    final double dx;
    final double dy;

    if (alignment == Alignment.topLeft) {
      return this;
    }

    if (alignment.x == -1.0) {
      dx = 0; // Align left
    } else if (alignment.x == 1.0) {
      dx = boxWidth - boxWidth; // Align right
    } else {
      dx = 0; // Center horizontally
    }

    if (alignment.y == -1.0) {
      dy = 0; // Align top
    } else if (alignment.y == 1.0) {
      dy = boxHeight - boxHeight; // Align bottom
    } else {
      dy = 0; // Center vertically
    }

    return Transform.translate(
      offset: Offset(dx, dy),
      child: this,
    );
  }
}
