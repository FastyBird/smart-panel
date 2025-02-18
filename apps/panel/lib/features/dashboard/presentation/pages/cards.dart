import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/models/layout/grid_item.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/screen_grid.dart';
import 'package:fastybird_smart_panel/features/dashboard/mappers/ui/tile.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/ui/pages/cards.dart';
import 'package:fastybird_smart_panel/features/dashboard/repositories/ui/dashboard/dashboard_module.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

class CardsPage extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();

  final CardsPageModel page;

  CardsPage({super.key, required this.page});

  @override
  Widget build(BuildContext context) {
    return Consumer<DashboardModuleRepository>(
        builder: (context, dashboardRepository, _) {
      final cards = dashboardRepository.getCardsByIds(page.cards);

      if (cards.isEmpty) {
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
            child: Column(
              children: cards.map((card) {
                final tiles = dashboardRepository.getTilesByIds(card.tiles);

                return ScreenGrid(
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
                          dashboardRepository
                              .getDataSourceByIds(tile.dataSource),
                        ),
                      ),
                    ),
                  );
                }).toList());
              }).toList(),
            ),
          ),
        ),
      );
    });
  }
}
