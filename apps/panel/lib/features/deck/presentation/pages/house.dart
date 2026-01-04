import 'package:event_bus/event_bus.dart';
import 'package:fastybird_smart_panel/api/spaces_module/spaces_module_client.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/alert_bar.dart';
import 'package:fastybird_smart_panel/core/widgets/top_bar.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/events/navigate_to_deck_item.dart';
import 'package:fastybird_smart_panel/modules/dashboard/service.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/house.dart';
import 'package:fastybird_smart_panel/plugins/pages-space/views/view.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/view.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

/// A summary of a space for display in the house overview
class _SpaceSummary {
  final String id;
  final String spaceId;
  final String title;
  final IconData? icon;
  final String? spacePageId;
  double? temperature;
  int? lightsOnCount;
  bool isLoading;

  _SpaceSummary({
    required this.id,
    required this.spaceId,
    required this.title,
    this.icon,
    this.spacePageId,
    this.isLoading = true,
  });

  bool get hasSpacePage => spacePageId != null;

  bool get hasTemperature => temperature != null;

  bool get hasLights => lightsOnCount != null;
}

/// HousePage displays an overview of all spaces in the house.
/// Each space is shown as a card that can be tapped to navigate to its SpacePage.
class HousePage extends StatefulWidget {
  final HousePageView page;

  const HousePage({
    super.key,
    required this.page,
  });

  @override
  State<HousePage> createState() => _HousePageState();
}

class _HousePageState extends State<HousePage> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();
  final EventBus _eventBus = locator<EventBus>();
  final SpacesModuleClient _spacesApi = locator<SpacesModuleClient>();

  List<_SpaceSummary> _spaceSummaries = [];
  bool _isInitialized = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_isInitialized) {
      _isInitialized = true;
      _initializeSpaceSummaries();
    }
  }

  void _initializeSpaceSummaries() {
    final dashboardService =
        Provider.of<DashboardService>(context, listen: false);

    final spacePages =
        dashboardService.pages.values.whereType<SpacePageView>().toList();

    setState(() {
      _spaceSummaries = spacePages.map((spacePage) {
        return _SpaceSummary(
          id: spacePage.id,
          spaceId: spacePage.spaceId,
          title: spacePage.title,
          icon: spacePage.icon,
          spacePageId: spacePage.id,
          isLoading: true,
        );
      }).toList();
    });

    // Load data for each space
    for (final summary in _spaceSummaries) {
      _loadSpaceData(summary);
    }
  }

  Future<void> _loadSpaceData(_SpaceSummary summary) async {
    try {
      // Load climate data
      final climateResponse = await _spacesApi.getSpacesModuleSpaceClimate(
        id: summary.spaceId,
      );
      final climateData = climateResponse.data.data;

      if (!mounted) return;

      setState(() {
        final index = _spaceSummaries.indexWhere((s) => s.id == summary.id);
        if (index >= 0) {
          _spaceSummaries[index].temperature =
              climateData.currentTemperature?.toDouble();
          _spaceSummaries[index].isLoading = false;
        }
      });
    } catch (e) {
      if (!mounted) return;

      setState(() {
        final index = _spaceSummaries.indexWhere((s) => s.id == summary.id);
        if (index >= 0) {
          _spaceSummaries[index].isLoading = false;
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    return Consumer<DashboardService>(builder: (
      context,
      dashboardService,
      _,
    ) {
      final DashboardPageView? freshPage =
          dashboardService.getPage(widget.page.id);

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

      if (_spaceSummaries.isEmpty) {
        return Scaffold(
          appBar: freshPage.showTopBar
              ? AppTopBar(
                  icon: freshPage.icon,
                  title: freshPage.title,
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
              )
            : null,
        body: SafeArea(
          child: Padding(
            padding: AppSpacings.paddingSm,
            child: GridView.builder(
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                childAspectRatio: 1.3,
                crossAxisSpacing: _screenService.scale(
                  8,
                  density: _visualDensityService.density,
                ),
                mainAxisSpacing: _screenService.scale(
                  8,
                  density: _visualDensityService.density,
                ),
              ),
              itemCount: _spaceSummaries.length,
              itemBuilder: (context, index) {
                final space = _spaceSummaries[index];
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
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
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
              // Summary badges row
              _buildSummaryBadges(context, space),
              // Navigation hint
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

  Widget _buildSummaryBadges(BuildContext context, _SpaceSummary space) {
    if (space.isLoading) {
      return Row(
        children: [
          SizedBox(
            width: _screenService.scale(
              14,
              density: _visualDensityService.density,
            ),
            height: _screenService.scale(
              14,
              density: _visualDensityService.density,
            ),
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: Theme.of(context).hintColor,
            ),
          ),
        ],
      );
    }

    final badges = <Widget>[];

    // Temperature badge
    if (space.hasTemperature) {
      badges.add(_buildTemperatureBadge(context, space.temperature!));
    }

    // Lights badge (placeholder - will show when lighting API is available)
    if (space.hasLights) {
      if (badges.isNotEmpty) {
        badges.add(AppSpacings.spacingSmHorizontal);
      }
      badges.add(_buildLightsBadge(context, space.lightsOnCount!));
    }

    if (badges.isEmpty) {
      // Show a subtle "no data" indicator
      return Row(
        children: [
          Icon(
            MdiIcons.informationOutline,
            size: _screenService.scale(
              14,
              density: _visualDensityService.density,
            ),
            color: Theme.of(context).hintColor.withValues(alpha: 0.5),
          ),
        ],
      );
    }

    return Row(children: badges);
  }

  Widget _buildTemperatureBadge(BuildContext context, double temperature) {
    final iconSize = _screenService.scale(
      14,
      density: _visualDensityService.density,
    );

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: AppSpacings.pSm,
        vertical: AppSpacings.pXs,
      ),
      decoration: BoxDecoration(
        color: Theme.of(context).brightness == Brightness.light
            ? AppColorsLight.secondaryLight9
            : AppColorsDark.infoLight7,
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        border: Border.all(
          color: Theme.of(context).brightness == Brightness.light
              ? AppColorsLight.secondaryLight5
              : AppColorsDark.infoLight5,
          width: _screenService.scale(
            1,
            density: _visualDensityService.density,
          ),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            MdiIcons.thermometer,
            size: iconSize,
            color: Theme.of(context).brightness == Brightness.light
                ? AppColorsLight.secondary
                : AppColorsDark.info,
          ),
          SizedBox(width: AppSpacings.pXs),
          Text(
            '${temperature.toStringAsFixed(1)}°',
            style: TextStyle(
              fontSize: AppFontSize.extraSmall,
              fontWeight: FontWeight.w500,
              color: Theme.of(context).brightness == Brightness.light
                  ? AppColorsLight.secondaryDark2
                  : AppTextColorDark.primary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLightsBadge(BuildContext context, int lightsOnCount) {
    final isOn = lightsOnCount > 0;
    final iconSize = _screenService.scale(
      14,
      density: _visualDensityService.density,
    );

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: AppSpacings.pSm,
        vertical: AppSpacings.pXs,
      ),
      decoration: BoxDecoration(
        color: isOn
            ? (Theme.of(context).brightness == Brightness.light
                ? AppColorsLight.warning.withValues(alpha: 0.15)
                : AppColorsDark.warning.withValues(alpha: 0.2))
            : (Theme.of(context).brightness == Brightness.light
                ? AppFillColorLight.base
                : AppFillColorDark.base),
        borderRadius: BorderRadius.circular(AppBorderRadius.base),
        border: Border.all(
          color: isOn
              ? (Theme.of(context).brightness == Brightness.light
                  ? AppColorsLight.warning.withValues(alpha: 0.3)
                  : AppColorsDark.warning.withValues(alpha: 0.3))
              : (Theme.of(context).brightness == Brightness.light
                  ? AppBorderColorLight.light
                  : AppBorderColorDark.light),
          width: _screenService.scale(
            1,
            density: _visualDensityService.density,
          ),
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            isOn ? MdiIcons.lightbulbOn : MdiIcons.lightbulbOutline,
            size: iconSize,
            color: isOn
                ? (Theme.of(context).brightness == Brightness.light
                    ? AppColorsLight.warning
                    : AppColorsDark.warning)
                : (Theme.of(context).brightness == Brightness.light
                    ? AppTextColorLight.placeholder
                    : AppTextColorDark.placeholder),
          ),
          SizedBox(width: AppSpacings.pXs),
          Text(
            isOn ? '$lightsOnCount' : 'Off',
            style: TextStyle(
              fontSize: AppFontSize.extraSmall,
              fontWeight: FontWeight.w500,
              color: isOn
                  ? (Theme.of(context).brightness == Brightness.light
                      ? AppColorsLight.warningDark2
                      : AppColorsDark.warningDark2)
                  : (Theme.of(context).brightness == Brightness.light
                      ? AppTextColorLight.placeholder
                      : AppTextColorDark.placeholder),
            ),
          ),
        ],
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
    _eventBus.fire(NavigateToDeckItemEvent(space.spacePageId!));
  }
}
