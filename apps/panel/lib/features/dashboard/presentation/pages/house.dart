import 'package:event_bus/event_bus.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_bar.dart';
import 'package:fastybird_smart_panel/core/widgets/top_bar.dart';
import 'package:fastybird_smart_panel/features/dashboard/mappers/data_source.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/dashboard/events/navigate_to_page.dart';
import 'package:fastybird_smart_panel/modules/dashboard/service.dart';
import 'package:fastybird_smart_panel/modules/dashboard/types/ui.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/house.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/space.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/view.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

/// A summary of a space for display in the house overview
class _SpaceSummary {
  final String id;
  final String title;
  final IconData? icon;
  final String? spacePageId;

  _SpaceSummary({
    required this.id,
    required this.title,
    this.icon,
    this.spacePageId,
  });

  bool get hasSpacePage => spacePageId != null;
}

/// HousePage displays an overview of all spaces in the house.
/// Each space is shown as a card that can be tapped to navigate to its SpacePage.
class HousePage extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();
  final EventBus _eventBus = locator<EventBus>();

  final HousePageView page;

  HousePage({
    super.key,
    required this.page,
  });

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    return Consumer<DashboardService>(builder: (
      context,
      dashboardService,
      _,
    ) {
      final DashboardPageView? freshPage = dashboardService.getPage(page.id);

      if (freshPage == null || freshPage is! HousePageView) {
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

      // Get all space pages from the dashboard
      final spacePages = dashboardService.pages.values
          .whereType<SpacePageView>()
          .toList();

      // Build space summaries
      final spaceSummaries = spacePages.map((spacePage) {
        return _SpaceSummary(
          id: spacePage.spaceId,
          title: spacePage.title,
          icon: spacePage.icon,
          spacePageId: spacePage.id,
        );
      }).toList();

      if (spaceSummaries.isEmpty) {
        return Scaffold(
          appBar: freshPage.showTopBar
              ? AppTopBar(
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
                )
              : null,
          body: Center(
            child: Padding(
              padding: AppSpacings.paddingMd,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    MdiIcons.homeFloor0,
                    color: Theme.of(context).warning,
                    size: _screenService.scale(
                      64,
                      density: _visualDensityService.density,
                    ),
                  ),
                  AppSpacings.spacingMdVertical,
                  Text(
                    localizations.house_overview_no_spaces_title,
                    textAlign: TextAlign.center,
                  ),
                  AppSpacings.spacingSmVertical,
                  Text(
                    localizations.house_overview_no_spaces_description,
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
        );
      }

      return Scaffold(
        appBar: freshPage.showTopBar
            ? AppTopBar(
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
              )
            : null,
        body: SafeArea(
          child: Padding(
            padding: AppSpacings.paddingSm,
            child: GridView.builder(
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                childAspectRatio: 1.5,
                crossAxisSpacing: _screenService.scale(
                  8,
                  density: _visualDensityService.density,
                ),
                mainAxisSpacing: _screenService.scale(
                  8,
                  density: _visualDensityService.density,
                ),
              ),
              itemCount: spaceSummaries.length,
              itemBuilder: (context, index) {
                final space = spaceSummaries[index];
                return _buildSpaceCard(context, space, localizations);
              },
            ),
          ),
        ),
      );
    });
  }

  Widget _buildSpaceCard(
    BuildContext context,
    _SpaceSummary space,
    AppLocalizations localizations,
  ) {
    return Card(
      elevation: 2,
      child: InkWell(
        onTap: () => _navigateToSpace(context, space, localizations),
        borderRadius: BorderRadius.circular(
          _screenService.scale(
            8,
            density: _visualDensityService.density,
          ),
        ),
        child: Padding(
          padding: AppSpacings.paddingSm,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Row(
                children: [
                  Icon(
                    space.icon ?? MdiIcons.roomService,
                    size: _screenService.scale(
                      24,
                      density: _visualDensityService.density,
                    ),
                  ),
                  AppSpacings.spacingSmHorizontal,
                  Expanded(
                    child: Text(
                      space.title,
                      style: Theme.of(context).textTheme.titleMedium,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
              AppSpacings.spacingSmVertical,
              // Placeholder for future device summaries (lights, temperature)
              Row(
                children: [
                  Icon(
                    MdiIcons.chevronRight,
                    size: _screenService.scale(
                      16,
                      density: _visualDensityService.density,
                    ),
                    color: Theme.of(context).hintColor,
                  ),
                  AppSpacings.spacingXsHorizontal,
                  Text(
                    localizations.house_overview_tap_to_view,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: Theme.of(context).hintColor,
                        ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _navigateToSpace(
    BuildContext context,
    _SpaceSummary space,
    AppLocalizations localizations,
  ) {
    if (!space.hasSpacePage) {
      AlertBar.showInfo(
        context,
        message: localizations.house_overview_no_space_page,
      );
      return;
    }

    // Fire navigation event to navigate to the space page
    _eventBus.fire(NavigateToPageEvent(space.spacePageId!));
  }
}
