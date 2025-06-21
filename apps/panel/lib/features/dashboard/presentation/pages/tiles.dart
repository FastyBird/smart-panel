import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/fixed_screen_grid.dart';
import 'package:fastybird_smart_panel/core/widgets/top_bar.dart';
import 'package:fastybird_smart_panel/features/dashboard/mappers/data_source.dart';
import 'package:fastybird_smart_panel/features/dashboard/mappers/tile.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/dashboard/export.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/tiles.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/tiles/view.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

class TilesPage extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  final TilesPageView page;

  TilesPage({super.key, required this.page});

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

      if (freshPage == null || freshPage is! TilesPageView) {
        return Scaffold(
          body: Center(
            child: Padding(
              padding: AppSpacings.paddingMd,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    MdiIcons.alert,
                    color: Theme.of(context).warning,
                    size: _screenService.scale(
                      64,
                      density: _visualDensityService.density,
                    ),
                  ),
                  AppSpacings.spacingMdVertical,
                  Text(
                    localizations.message_error_page_not_found_title,
                    textAlign: TextAlign.center,
                  ),
                  AppSpacings.spacingSmVertical,
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
          body: Center(
            child: Padding(
              padding: AppSpacings.paddingMd,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    MdiIcons.viewDashboardVariant,
                    color: Theme.of(context).warning,
                    size: _screenService.scale(
                      64,
                      density: _visualDensityService.density,
                    ),
                  ),
                  AppSpacings.spacingMdVertical,
                  Text(
                    localizations.message_error_tiles_not_configured_title,
                    textAlign: TextAlign.center,
                  ),
                  AppSpacings.spacingSmVertical,
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
        appBar: AppTopBar(
          icon: freshPage.icon,
          title: freshPage.title,
          actions: [
            LayoutBuilder(builder: (context, constraints) {
              List<Widget> values = freshPage.dataSources
                  .map(
                    (dataSource) => buildDataSourceWidget(dataSource),
                  )
                  .toList();

              return Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                mainAxisAlignment: MainAxisAlignment.center,
                children: values
                    .expand((widget) => [
                          widget,
                          if (widget != values.last)
                            AppSpacings.spacingSmHorizontal,
                        ])
                    .toList(),
              );
            }),
          ],
        ),
        body: SafeArea(
          child: Padding(
            padding: AppSpacings.paddingSm,
            child: FixedScreenGrid(
              children: freshPage.tiles
                  .map(
                    (tile) => _buildTile(context, tile),
                  )
                  .toList(),
            ),
          ),
        ),
      );
    });
  }

  FixedScreenGridItem _buildTile(
    BuildContext context,
    TileView tile,
  ) {
    return FixedScreenGridItem(
      mainAxisIndex: tile.row,
      crossAxisIndex: tile.col,
      mainAxisCellCount: tile.rowSpan,
      crossAxisCellCount: tile.colSpan,
      child: buildTileWidget(tile),
    );
  }
}
