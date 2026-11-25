import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/models/deck_nav_tab_data.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/deck_nav_tab.dart';
import 'package:fastybird_smart_panel/modules/deck/services/deck_service.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

/// The deck dock in landscape, fed from the [DeckService]. See [DeckDock]
/// for the layout.
class DeckSideDock extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onNavigateToIndex;
  final VoidCallback? onMoreTapped;

  /// Opens Settings from the gear at the foot of the dock.
  final VoidCallback? onSettingsTapped;

  const DeckSideDock({
    super.key,
    required this.currentIndex,
    required this.onNavigateToIndex,
    this.onMoreTapped,
    this.onSettingsTapped,
  });

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final deckService = context.watch<DeckService>();

    final tabs = buildDeckNavTabs(
      items: deckService.items,
      currentIndex: currentIndex,
      localizations: localizations,
      // The sheet is the way to Settings and to every page.
      alwaysShowAllPages: onMoreTapped != null,
    );

    return DeckDock(
      homeTab: tabs.homeTab,
      tabs: tabs.scrollableTabs,
      currentIndex: currentIndex,
      onNavigateToIndex: onNavigateToIndex,
      onMoreTapped: onMoreTapped,
      onSettingsTapped: onSettingsTapped,
      sizeClass: locator<ScreenService>().sizeClass,
    );
  }
}

/// The deck dock (spec §4): 44 / 56 / 84 wide on the card surface with a
/// hairline and radius 12, inset from the page edges by the page padding.
///
/// Top to bottom: Home, a divider, the page tabs (they scroll and keep the
/// current one in view), "All pages" with its count, a divider and the
/// Settings gear at the foot.
///
/// The current page's tab takes the accent's tint and colour. Expanded docks
/// show a label under every icon; Compact and Regular show icons only.
class DeckDock extends StatefulWidget {
  const DeckDock({
    super.key,
    this.homeTab,
    required this.tabs,
    required this.currentIndex,
    required this.onNavigateToIndex,
    this.onMoreTapped,
    this.onSettingsTapped,
    this.sizeClass,
  });

  final DeckNavTabData? homeTab;

  /// The page tabs, and "All pages" when one has `isMore`.
  final List<DeckNavTabData> tabs;

  final int currentIndex;
  final ValueChanged<int> onNavigateToIndex;
  final VoidCallback? onMoreTapped;

  /// Shows the gear.
  final VoidCallback? onSettingsTapped;

  /// The class to size for; defaults to the screen's.
  final ScreenSizeClass? sizeClass;

  @override
  State<DeckDock> createState() => _DeckDockState();
}

class _DeckDockState extends State<DeckDock> {
  final GlobalKey _selectedKey = GlobalKey();
  final ScrollController _scrollController = ScrollController();
  bool _scrollScheduled = false;
  double? _viewport;

  @override
  void initState() {
    super.initState();
    _scheduleScrollToSelected();
  }

  @override
  void didUpdateWidget(DeckDock oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.currentIndex != oldWidget.currentIndex) {
      _scheduleScrollToSelected();
    }
  }

  /// "All pages" appearing (or a shorter screen) shortens the tabs' scroll
  /// area; the current tab is brought back into view then. Only on a
  /// shrink, so a manual scroll is left alone.
  bool _onMetrics(ScrollMetricsNotification notification) {
    if (notification.depth != 0) return false;

    final viewport = notification.metrics.viewportDimension;
    final shrank = _viewport != null && viewport < _viewport! - 0.5;
    _viewport = viewport;
    if (shrank) scrollDeckTabIntoView(_selectedKey, _scrollController);

    return false;
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _scheduleScrollToSelected() {
    if (_scrollScheduled) return;
    _scrollScheduled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _scrollScheduled = false;
      if (!mounted) return;
      scrollDeckTabIntoView(_selectedKey, _scrollController);
    });
  }

  @override
  Widget build(BuildContext context) {
    final neutrals = Theme.of(context).neutrals;
    final localizations = AppLocalizations.of(context)!;
    final sizeClass = widget.sizeClass ?? locator<ScreenService>().sizeClass;
    final showLabels = sizeClass == ScreenSizeClass.expanded;
    final extent = AppSpacings.scale(
      DeckNavMetrics.tabFor(sizeClass, landscape: true),
    );
    final iconSize = AppSpacings.scale(DeckNavMetrics.iconFor(sizeClass));
    final gap = AppSpacings.scale(DeckNavMetrics.gap);
    final inset = AppSpacings.scale(DeckNavMetrics.dockInsetFor(sizeClass));

    final pageTabs = widget.tabs.where((tab) => !tab.isMore).toList();
    final moreTab = widget.tabs.where((tab) => tab.isMore).firstOrNull;

    Widget tab(DeckNavTabData data, {bool scrolls = true}) {
      final active = data.pageIndex == widget.currentIndex;
      final Widget child = DeckNavTab(
        icon: data.icon,
        label: data.label,
        extent: extent,
        iconSize: iconSize,
        active: active,
        showLabel: showLabels,
        vertical: true,
        lockBadge: data.lockBadge,
        onTap: () => widget.onNavigateToIndex(data.pageIndex),
      );

      return active && scrolls
          ? KeyedSubtree(key: _selectedKey, child: child)
          : child;
    }

    return ColoredBox(
      color: neutrals.surfacePage,
      child: Padding(
        // The page's own padding keeps the gap to its content.
        padding: EdgeInsetsDirectional.only(
          start: inset,
          top: inset,
          bottom: inset,
        ),
        child: Container(
          width: AppSpacings.scale(DeckNavMetrics.dockWidthFor(sizeClass)),
          padding: EdgeInsets.all(
            AppSpacings.scale(DeckNavMetrics.dockPadding),
          ),
          decoration: BoxDecoration(
            color: neutrals.surfaceCard,
            borderRadius: BorderRadius.circular(AppBorderRadius.medium),
            border: Border.all(
              color: neutrals.borderLight,
              width: AppSpacings.scale(1),
            ),
          ),
          child: Column(
            spacing: gap,
            children: [
              if (widget.homeTab != null) tab(widget.homeTab!, scrolls: false),
              if (widget.homeTab != null && pageTabs.isNotEmpty)
                const _DockDivider(),
              Expanded(
                child: NotificationListener<ScrollMetricsNotification>(
                  onNotification: _onMetrics,
                  child: SingleChildScrollView(
                    controller: _scrollController,
                    child: Column(
                      spacing: gap,
                      children: [for (final data in pageTabs) tab(data)],
                    ),
                  ),
                ),
              ),
              if (moreTab != null)
                DeckNavTab(
                  icon: moreTab.icon,
                  label: moreTab.label,
                  extent: extent,
                  iconSize: iconSize,
                  active: moreTab.isMoreActive,
                  showLabel: showLabels,
                  vertical: true,
                  tone: DeckNavTabTone.filled,
                  badgeCount: moreTab.badgeCount,
                  lockBadge: moreTab.lockBadge,
                  onTap: widget.onMoreTapped,
                ),
              if (widget.onSettingsTapped != null) ...[
                const _DockDivider(),
                DeckNavTab(
                  icon: MdiIcons.cogOutline,
                  label: localizations.deck_settings,
                  extent: AppSpacings.scale(
                    DeckNavMetrics.settingsFor(sizeClass),
                  ),
                  iconSize: iconSize,
                  vertical: true,
                  onTap: widget.onSettingsTapped,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

/// The dock's divider: a hairline 8 in from each side.
class _DockDivider extends StatelessWidget {
  const _DockDivider();

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.symmetric(
      horizontal: AppSpacings.scale(DeckNavMetrics.dockDividerInset),
      vertical: AppSpacings.scale(DeckNavMetrics.dockDividerMargin),
    ),
    child: Container(
      height: AppSpacings.scale(1),
      color: Theme.of(context).neutrals.borderLight,
    ),
  );
}
