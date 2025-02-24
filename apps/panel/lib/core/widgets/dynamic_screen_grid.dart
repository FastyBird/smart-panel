import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/cupertino.dart';

class DynamicScreenGridItem extends StatelessWidget {
  final Widget child;
  final int mainAxisCellCount;
  final int crossAxisCellCount;

  const DynamicScreenGridItem({
    super.key,
    required this.child,
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

class DynamicScreenGrid extends StatelessWidget {
  final _screenService = locator<ScreenService>();

  final List<DynamicScreenGridItem> children;
  final int columns = 8;

  DynamicScreenGrid({
    super.key,
    required this.children,
  });

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final boxWidth = constraints.maxWidth;

        // Optimal tile width from configuration
        final optimalTileWidth = _screenService.tileSize;

        // Calculate number of columns and rows
        int optimalColumns = (boxWidth / optimalTileWidth).floor();

        optimalColumns = optimalColumns.isEven
            ? optimalColumns
            : optimalColumns + 1; // Ensure even count

        final tileSize = constraints.maxWidth / columns;

        List<List<bool>> grid = [];

        List<Widget> positionedTiles = [];

        int findPosition(int width, int height) {
          for (int row = 0;; row++) {
            if (row >= grid.length) {
              grid.add(List.filled(columns, false));
            }

            for (int col = 0; col <= columns - width; col++) {
              bool fits = true;

              for (int i = 0; i < height; i++) {
                if (row + i >= grid.length) {
                  grid.add(List.filled(columns, false));
                }

                for (int j = 0; j < width; j++) {
                  if (grid[row + i][col + j]) {
                    fits = false;

                    break;
                  }
                }

                if (!fits) break;
              }

              if (fits) return row * columns + col;
            }
          }
        }

        for (var tile in children) {
          int position =
              findPosition(tile.crossAxisCellCount, tile.mainAxisCellCount);
          int row = position ~/ columns;
          int col = position % columns;

          for (int i = 0; i < tile.mainAxisCellCount; i++) {
            for (int j = 0; j < tile.crossAxisCellCount; j++) {
              grid[row + i][col + j] = true;
            }
          }

          positionedTiles.add(
            Positioned(
              left: col * tileSize,
              top: row * tileSize,
              width: tile.crossAxisCellCount * tileSize,
              height: tile.mainAxisCellCount * tileSize,
              child: tile,
            ),
          );
        }

        return SizedBox(
          width: constraints.maxWidth,
          child: Stack(
            children: positionedTiles,
          ),
        );
      },
    );
  }
}
