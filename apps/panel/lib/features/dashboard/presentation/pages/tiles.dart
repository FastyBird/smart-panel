import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/models/layout/grid_item.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/screen_app_bar.dart';
import 'package:fastybird_smart_panel/core/widgets/screen_grid.dart';
import 'package:fastybird_smart_panel/features/dashboard/mappers/ui/tile.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/pages/tiles.dart';
import 'package:fastybird_smart_panel/features/dashboard/repositories/ui/dashboard/dashboard_module.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class TilesPage extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();

  final TilesPageModel page;

  TilesPage({super.key, required this.page});

  @override
  Widget build(BuildContext context) {
    return Consumer<DashboardModuleRepository>(
        builder: (context, dashboardRepository, _) {
      final tiles = dashboardRepository.getTilesByIds(page.tiles);

      if (tiles.isEmpty) {
        final localizations = AppLocalizations.of(context)!;

        return Scaffold(
          body: Center(
            child: Padding(
              padding: AppSpacings.paddingMd,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.grid_view_sharp,
                    color: Theme.of(context).warning,
                    size: _screenService.scale(64),
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
        appBar: ScreenAppBar(
          icon: page.icon,
          title: page.title,
          actions: [
            Padding(
              padding: AppSpacings.paddingSm,
              child: Row(
                children: [
                  Icon(
                    Icons.lightbulb,
                    size: AppFontSize.small,
                  ),
                  AppSpacings.spacingSmHorizontal,
                  Text(
                    '2',
                    style: TextStyle(
                      fontSize: AppFontSize.extraSmall,
                      color: AppTextColorDark.secondary,
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: AppSpacings.paddingSm,
              child: Row(
                children: [
                  Icon(
                    Icons.thermostat,
                    size: AppFontSize.small,
                  ),
                  AppSpacings.spacingSmHorizontal,
                  Text(
                    '23.0 °C',
                    style: TextStyle(
                      fontSize: AppFontSize.extraSmall,
                      color: AppTextColorDark.secondary,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        body: SafeArea(
          child: Padding(
            padding: AppSpacings.paddingMd,
            child: ScreenGrid(
              children: tiles.map((tile) {
                return GridItemModel(
                  row: tile.row,
                  col: tile.col,
                  rowSpan: tile.rowSpan,
                  colSpan: tile.colSpan,
                  child: Container(
                    alignment: Alignment.center,
                    child: Padding(
                      padding: AppSpacings.paddingMd,
                      child: buildTileWidget(
                        tile,
                        dashboardRepository.getDataSourceByIds(tile.dataSource),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        ),
      );
    });
  }
}
