import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/features/gallery/gallery_scope.dart';
import 'package:fastybird_smart_panel/features/gallery/gallery_sections.dart';
import 'package:fastybird_smart_panel/modules/deck/models/bottom_nav_mode_config.dart';
import 'package:fastybird_smart_panel/modules/deck/models/deck_nav_tab_data.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/deck_bottom_nav_bar.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/deck_more_sheet.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/deck_nav_tab.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/deck_side_dock.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// DR-10: the deck bar and dock, their tabs, "All pages" and the Settings
/// entries. Every tap here is a no-op.
const List<GalleryEntry> navigationEntries = [
  GalleryEntry(
    title: 'Deck bar: Home current; a page current with a mode button',
    builder: _bars,
  ),
  GalleryEntry(
    title: 'Deck dock: Home current; a page current',
    builder: _docks,
  ),
  GalleryEntry(
    title: 'Tabs: current, plain, All pages with its count, lock badge slot',
    builder: _tabs,
  ),
  GalleryEntry(
    title: 'All pages, with Settings at the end',
    builder: _allPages,
  ),
  GalleryEntry(
    title: 'Settings entries: the gear and the pull handle',
    builder: _settings,
  ),
];

final _home = DeckNavTabData(icon: MdiIcons.home, label: 'Home', pageIndex: 0);

List<DeckNavTabData> _pages() => [
  DeckNavTabData(
    icon: MdiIcons.lightbulbOutline,
    label: 'Lights',
    pageIndex: 1,
  ),
  DeckNavTabData(icon: MdiIcons.thermometer, label: 'Climate', pageIndex: 2),
  DeckNavTabData(
    icon: MdiIcons.blindsHorizontal,
    label: 'Shading',
    pageIndex: 3,
  ),
  DeckNavTabData(icon: MdiIcons.play, label: 'Media', pageIndex: 4),
  DeckNavTabData(icon: MdiIcons.flashOutline, label: 'Energy', pageIndex: 5),
  DeckNavTabData(
    icon: MdiIcons.dotsHorizontal,
    label: 'All pages',
    pageIndex: -1,
    isMore: true,
    badgeCount: 3,
  ),
];

BottomNavModeConfig _mode() => BottomNavModeConfig(
  icon: MdiIcons.sofaOutline,
  label: 'Relax',
  title: 'Lights mode',
  color: ThemeColors.lights,
  popupBuilder: (context, dismiss) => const SizedBox.shrink(),
);

/// A small lock, to show the lock badge slot.
Widget _lock(BuildContext context) => Icon(
  MdiIcons.lock,
  size: AppSpacings.scale(10),
  color: Theme.of(context).neutrals.textSecondary,
);

Widget _caption(BuildContext context, String text) => Padding(
  padding: EdgeInsets.only(bottom: AppSpacings.pSm),
  child: Text(
    text,
    style: TextStyle(
      color: Theme.of(context).neutrals.textSecondary,
      fontSize: AppFontSize.extraSmall,
    ),
  ),
);

Widget _bars(BuildContext context) {
  final scope = GalleryScope.of(context);
  final width = AppSpacings.scale(scope.canvasSize.width);

  Widget bar({required int current, BottomNavModeConfig? mode}) =>
      ConstrainedBox(
        constraints: BoxConstraints(maxWidth: width),
        child: DeckBar(
          homeTab: _home,
          tabs: _pages(),
          currentIndex: current,
          onNavigateToIndex: (_) {},
          onMoreTapped: () {},
          mode: mode,
          onModeTapped: () {},
          onSettingsTapped: () {},
          sizeClass: scope.sizeClass,
          square: scope.isSquare,
        ),
      );

  return Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    spacing: AppSpacings.pMd,
    children: [
      bar(current: 0),
      bar(current: 1, mode: _mode()),
    ],
  );
}

Widget _docks(BuildContext context) {
  final scope = GalleryScope.of(context);

  Widget dock(int current) => DeckDock(
    homeTab: _home,
    tabs: _pages(),
    currentIndex: current,
    onNavigateToIndex: (_) {},
    onMoreTapped: () {},
    onSettingsTapped: () {},
    sizeClass: scope.sizeClass,
  );

  return SizedBox(
    height: AppSpacings.scale(
      scope.sizeClass == ScreenSizeClass.expanded ? 420 : 300,
    ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [dock(0), dock(2)],
    ),
  );
}

Widget _tabs(BuildContext context) {
  final sizeClass = GalleryScope.of(context).sizeClass;
  final barExtent = AppSpacings.scale(
    DeckNavMetrics.tabFor(sizeClass, landscape: false),
  );
  final dockExtent = AppSpacings.scale(
    DeckNavMetrics.tabFor(sizeClass, landscape: true),
  );
  final iconSize = AppSpacings.scale(DeckNavMetrics.iconFor(sizeClass));
  final showBarLabel = sizeClass != ScreenSizeClass.compact;
  final showDockLabel = sizeClass == ScreenSizeClass.expanded;
  final dockWidth = AppSpacings.scale(DeckNavMetrics.dockWidthFor(sizeClass));

  Widget dockTab(Widget tab) => SizedBox(width: dockWidth, child: tab);

  return Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      _caption(context, 'Bar'),
      Wrap(
        spacing: AppSpacings.pMd,
        runSpacing: AppSpacings.pSm,
        children: [
          DeckNavTab(
            icon: MdiIcons.lightbulbOutline,
            label: 'Lights',
            extent: barExtent,
            iconSize: iconSize,
            active: true,
            showLabel: showBarLabel,
            onTap: () {},
          ),
          DeckNavTab(
            icon: MdiIcons.thermometer,
            label: 'Climate',
            extent: barExtent,
            iconSize: iconSize,
            onTap: () {},
          ),
          DeckNavTab(
            icon: MdiIcons.dotsHorizontal,
            label: 'All pages',
            extent: barExtent,
            iconSize: iconSize,
            tone: DeckNavTabTone.filled,
            badgeCount: 12,
            onTap: () {},
          ),
          DeckNavTab(
            icon: MdiIcons.shieldOutline,
            label: 'Security',
            extent: barExtent,
            iconSize: iconSize,
            lockBadge: _lock(context),
            onTap: () {},
          ),
        ],
      ),
      SizedBox(height: AppSpacings.pMd),
      _caption(context, 'Dock'),
      Wrap(
        spacing: AppSpacings.pMd,
        runSpacing: AppSpacings.pSm,
        children: [
          dockTab(
            DeckNavTab(
              icon: MdiIcons.lightbulbOutline,
              label: 'Lights',
              extent: dockExtent,
              iconSize: iconSize,
              active: true,
              showLabel: showDockLabel,
              vertical: true,
              onTap: () {},
            ),
          ),
          dockTab(
            DeckNavTab(
              icon: MdiIcons.thermometer,
              label: 'Climate',
              extent: dockExtent,
              iconSize: iconSize,
              showLabel: showDockLabel,
              vertical: true,
              onTap: () {},
            ),
          ),
          dockTab(
            DeckNavTab(
              icon: MdiIcons.dotsHorizontal,
              label: 'All pages',
              extent: dockExtent,
              iconSize: iconSize,
              showLabel: showDockLabel,
              vertical: true,
              tone: DeckNavTabTone.filled,
              badgeCount: 3,
              onTap: () {},
            ),
          ),
        ],
      ),
    ],
  );
}

Widget _allPages(BuildContext context) {
  final scope = GalleryScope.of(context);
  final neutrals = Theme.of(context).neutrals;

  return Container(
    constraints: BoxConstraints(
      maxWidth: AppSpacings.scale(scope.canvasSize.width),
    ),
    padding: EdgeInsets.all(AppSpacings.pMd),
    decoration: BoxDecoration(
      color: neutrals.surfaceRaised,
      borderRadius: BorderRadius.circular(AppBorderRadius.medium),
      border: Border.all(
        color: neutrals.borderLight,
        width: AppSpacings.scale(1),
      ),
    ),
    child: DeckAllPagesGrid(
      entries: [
        DeckNavTabData(
          icon: MdiIcons.sofaOutline,
          label: 'Living room',
          pageIndex: 0,
        ),
        ..._pages().where((page) => !page.isMore),
        DeckNavTabData(
          icon: MdiIcons.shieldOutline,
          label: 'Security',
          pageIndex: 6,
          lockBadge: _lock(context),
        ),
        DeckNavTabData(
          icon: MdiIcons.viewDashboardVariant,
          label: 'Dashboard',
          pageIndex: 7,
        ),
      ],
      currentIndex: 1,
      onSelect: (_) {},
      onOpenSettings: () {},
      sizeClass: scope.sizeClass,
      square: scope.isSquare,
    ),
  );
}

Widget _settings(BuildContext context) {
  final sizeClass = GalleryScope.of(context).sizeClass;
  final neutrals = Theme.of(context).neutrals;

  return Wrap(
    spacing: AppSpacings.pLg,
    runSpacing: AppSpacings.pMd,
    crossAxisAlignment: WrapCrossAlignment.center,
    children: [
      DeckNavTab(
        icon: MdiIcons.cogOutline,
        label: 'Settings',
        extent: AppSpacings.scale(DeckNavMetrics.settingsFor(sizeClass)),
        iconSize: AppSpacings.scale(DeckNavMetrics.iconFor(sizeClass)),
        onTap: () {},
      ),
      Container(
        width: AppSpacings.scale(160),
        alignment: Alignment.topCenter,
        decoration: BoxDecoration(
          color: neutrals.surfacePage,
          border: Border.all(
            color: neutrals.borderLight,
            width: AppSpacings.scale(1),
          ),
        ),
        child: DeckPullHandle(label: 'Open settings', onOpen: () {}),
      ),
    ],
  );
}
