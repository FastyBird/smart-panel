import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/fixed_grid_size_grid.dart';
import 'package:fastybird_smart_panel/core/widgets/page_header.dart';
import 'package:fastybird_smart_panel/modules/dashboard/mappers/data_source.dart';
import 'package:fastybird_smart_panel/modules/dashboard/mappers/tile.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/dashboard/service.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/cards/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/tiles/view.dart';
import 'package:fastybird_smart_panel/plugins/pages-cards/views/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/view.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

class CardsPage extends StatelessWidget {
  final CardsPageView page;

  const CardsPage({super.key, required this.page});

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

      if (freshPage == null || freshPage is! CardsPageView) {
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

      if (freshPage.cards.isEmpty) {
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
                    MdiIcons.cardText,
                    color: Theme.of(context).warning,
                    size: AppSpacings.scale(64),
                  ),
                  Text(
                    localizations.message_error_cards_not_configured_title,
                    textAlign: TextAlign.center,
                  ),
                  Text(
                    localizations
                        .message_error_cards_not_configured_description,
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
                    icon: freshPage.icon ?? MdiIcons.cardText,
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
                child: ListView.builder(
                  padding: AppSpacings.paddingSm,
                  itemCount: freshPage.cards.length,
                  itemBuilder: (context, index) {
                    return _buildCard(context, freshPage.cards[index]);
                  },
                ),
              ),
            ],
          ),
        ),
      );
    });
  }

  Widget _buildCard(
    BuildContext context,
    CardView card,
  ) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Padding(
      padding: EdgeInsets.only(bottom: AppSpacings.pSm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          if (card.title.isNotEmpty)
            Padding(
              padding: EdgeInsets.only(
                left: AppSpacings.pSm,
                bottom: AppSpacings.pXs,
              ),
              child: Row(
                spacing: AppSpacings.pSm,
                children: [
                  if (card.icon != null)
                    Icon(
                      card.icon,
                      size: AppSpacings.scale(20),
                      color: isDark
                          ? AppTextColorDark.secondary
                          : AppTextColorLight.secondary,
                    ),
                  Text(
                    card.title,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          color: isDark
                              ? AppTextColorDark.secondary
                              : AppTextColorLight.secondary,
                        ),
                  ),
                ],
              ),
            ),
          if (card.tiles.isNotEmpty)
            AspectRatio(
              aspectRatio: (card.cols ?? 4) / (card.rows ?? 2),
              child: FixedGridSizeGrid(
                mainAxisSize: card.rows ?? 2,
                crossAxisSize: card.cols ?? 4,
                children: card.tiles
                    .map(
                      (tile) => _buildGridTile(context, tile),
                    )
                    .toList(),
              ),
            ),
        ],
      ),
    );
  }

  FixedGridSizeGridItem _buildGridTile(
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
