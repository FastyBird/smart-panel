import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/models/layout/grid_item.dart';
import 'package:fastybird_smart_panel/core/services/screen_scaler.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/screen_grid.dart';
import 'package:fastybird_smart_panel/features/dashboard/mappers/tile.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/pages/home.dart';
import 'package:fastybird_smart_panel/features/dashboard/repositories/ui/tiles.dart';
import 'package:fastybird_smart_panel/generated_l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class HomePage extends StatelessWidget {
  final ScreenScalerService scaler = locator<ScreenScalerService>();

  final HomePageModel page;

  HomePage({super.key, required this.page});

  @override
  Widget build(BuildContext context) {
    return Consumer<TilesRepository>(builder: (context, tilesRepository, _) {
      final tiles = tilesRepository.getByIds(page.tiles);

      final dataRepository = locator<TilesDataRepository>();

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
                    size: scaler.scale(64),
                  ),
                  AppSpacings.spacingMdVertical,
                  Text(
                    localizations.message_error_home_not_configured_title,
                    textAlign: TextAlign.center,
                  ),
                  AppSpacings.spacingSmVertical,
                  Text(
                    localizations.message_error_home_not_configured_description,
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
        );
      }

      return Scaffold(
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
                        dataRepository.getAllForTile(tile.id),
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
