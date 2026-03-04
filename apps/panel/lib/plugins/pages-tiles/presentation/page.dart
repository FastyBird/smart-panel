import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/fixed_grid_size_grid.dart';
import 'package:fastybird_smart_panel/core/widgets/fixed_tile_size_grid.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/modules/dashboard/mappers/data_source.dart';
import 'package:fastybird_smart_panel/modules/dashboard/mappers/tile.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/dashboard/export.dart';
import 'package:fastybird_smart_panel/plugins/pages-tiles/views/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/tiles/view.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

class TilesPage extends StatelessWidget {
  final TilesPageView page;

  const TilesPage({super.key, required this.page});

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    return Consumer<DashboardService>(builder: (
      context,
      dashboardService,
      _,
    ) {
      final DashboardPageView? freshPage = dashboardService.getPage(
        page.id,
      );

      final isDark = Theme.of(context).brightness == Brightness.dark;

      if (freshPage == null || freshPage is! TilesPageView) {
        return Scaffold(
          backgroundColor: isDark ? AppBgColorDark.page : AppBgColorLight.page,
          body: Center(
            child: Padding(
              padding: AppSpacings.paddingMd,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                spacing: AppSpacings.pMd,
                children: [
                  Icon(
                    MdiIcons.alert,
                    color: Theme.of(context).warning,
                    size: AppSpacings.scale(64),
                  ),
                  Text(
                    localizations.message_error_page_not_found_title,
                    textAlign: TextAlign.center,
                  ),
                  Text(
                    localizations.message_error_page_not_found_description,
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
        );
      }

      if (freshPage.tiles.isEmpty) {
        return Scaffold(
          backgroundColor: isDark ? AppBgColorDark.page : AppBgColorLight.page,
          body: Center(
            child: Padding(
              padding: AppSpacings.paddingMd,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                spacing: AppSpacings.pMd,
                children: [
                  Icon(
                    MdiIcons.viewDashboardVariant,
                    color: Theme.of(context).warning,
                    size: AppSpacings.scale(64),
                  ),
                  Text(
                    localizations.message_error_tiles_not_configured_title,
                    textAlign: TextAlign.center,
                  ),
                  Text(
                    localizations
                        .message_error_tiles_not_configured_description,
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
        );
      }

      return Scaffold(
        backgroundColor: isDark ? AppBgColorDark.page : AppBgColorLight.page,
        body: SafeArea(
          child: Column(
            children: [
              if (freshPage.showTopBar)
                PageHeader(
                  title: freshPage.title,
                  leading: HeaderMainIcon(
                    icon: freshPage.icon ?? MdiIcons.viewDashboardVariant,
                  ),
                  trailing: freshPage.dataSources.isNotEmpty
                      ? Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          spacing: AppSpacings.pSm,
                          children: freshPage.dataSources
                              .map(
                                (dataSource) =>
                                    buildDataSourceWidget(dataSource),
                              )
                              .toList(),
                        )
                      : null,
                ),
              Expanded(
                child: Padding(
                  padding: AppSpacings.paddingSm,
                  child: freshPage.tileSize != null
                      ? FixedTileSizeGrid(
                          unitSize: freshPage.tileSize,
                          children: freshPage.tiles
                              .map(
                                (tile) => _buildFixedGridTile(context, tile),
                              )
                              .toList(),
                        )
                      : FixedGridSizeGrid(
                          mainAxisSize: freshPage.rows,
                          crossAxisSize: freshPage.cols,
                          children: freshPage.tiles
                              .map(
                                (tile) => _buildDynamicGridTile(context, tile),
                              )
                              .toList(),
                        ),
                ),
              ),
            ],
          ),
        ),
      );
    });
  }

  FixedTileSizeGridItem _buildFixedGridTile(
    BuildContext context,
    TileView tile,
  ) {
    return FixedTileSizeGridItem(
      mainAxisIndex: tile.row,
      crossAxisIndex: tile.col,
      mainAxisCellCount: tile.rowSpan,
      crossAxisCellCount: tile.colSpan,
      child: buildTileWidget(tile),
    );
  }

  FixedGridSizeGridItem _buildDynamicGridTile(
    BuildContext context,
    TileView tile,
  ) {
    return FixedGridSizeGridItem(
      mainAxisIndex: tile.row,
      crossAxisIndex: tile.col,
      mainAxisCellCount: tile.rowSpan,
      crossAxisCellCount: tile.colSpan,
      child: buildTileWidget(tile),
    );
  }
}
