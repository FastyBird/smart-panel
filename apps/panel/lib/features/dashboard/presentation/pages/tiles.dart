import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/fixed_screen_grid.dart';
import 'package:fastybird_smart_panel/core/widgets/screen_app_bar.dart';
import 'package:fastybird_smart_panel/features/dashboard/mappers/tile.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/tile.dart';
import 'package:fastybird_smart_panel/modules/dashboard/models/tiles_page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/repositories/export.dart';
import 'package:flutter/material.dart';
import 'package:material_symbols_icons/symbols.dart';
import 'package:provider/provider.dart';

class TilesPage extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();

  final TilesPageModel page;

  TilesPage({super.key, required this.page});

  @override
  Widget build(BuildContext context) {
    return Consumer<TilesRepository>(builder: (
      context,
      tilesRepository,
      _,
    ) {
      final tiles = tilesRepository.getItems(page.tiles);

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
                    Symbols.dashboard,
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
                    Symbols.lightbulb,
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
                    Symbols.thermostat,
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
            padding: AppSpacings.paddingSm,
            child: FixedScreenGrid(
              children: tiles.map((tile) => _buildTile(context, tile)).toList(),
            ),
          ),
        ),
      );
    });
  }

  FixedScreenGridItem _buildTile(
    BuildContext context,
    TileModel tile,
  ) {
    return FixedScreenGridItem(
      mainAxisIndex: tile.row,
      crossAxisIndex: tile.col,
      mainAxisCellCount: tile.rowSpan,
      crossAxisCellCount: tile.colSpan,
      child: Consumer<DataSourcesRepository>(builder: (
        context,
        dataSourcesRepository,
        _,
      ) {
        return buildTileWidget(
          tile,
          dataSourcesRepository.getItems(
            tile.dataSource,
          ),
        );
      }),
    );
  }
}
