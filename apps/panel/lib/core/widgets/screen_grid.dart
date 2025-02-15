import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/models/layout/grid_item.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:flutter/material.dart';

class ScreenGrid extends StatelessWidget {
  final List<GridItemModel> children;

  final Alignment alignment;

  const ScreenGrid({
    super.key,
    required this.children,
    this.alignment = Alignment.topLeft,
  });

  @override
  Widget build(BuildContext context) {
    final screen = locator<ScreenService>();

    return LayoutBuilder(
      builder: (context, constraints) {
        final boxWidth = constraints.maxWidth;
        final boxHeight = constraints.maxHeight;

        // Optimal tile width from configuration
        final optimalTileWidth = screen.tileSize;

        // Calculate number of columns and rows
        int columns = (boxWidth / optimalTileWidth).floor();

        columns = columns.isEven ? columns : columns + 1; // Ensure even count

        final tileWidth = boxWidth / columns;

        // Calculate the number of rows
        final rows = (boxHeight / tileWidth).ceil();
        final tileHeight = boxHeight / rows;

        final tiles = <Widget>[];

        for (final item in children) {
          if (item.row > rows || item.col > columns) {
            continue;
          }

          tiles.add(Positioned(
            top: (item.row - 1) * tileHeight,
            left: (item.col - 1) * tileWidth,
            width: item.colSpan * tileWidth,
            height: item.rowSpan * tileHeight,
            child: item.child,
          ));
        }

        return Stack(
          children: tiles,
        ).applyAlignment(
          alignment,
          boxWidth,
          boxHeight,
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
