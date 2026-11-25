import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/models/bottom_nav_mode_config.dart';
import 'package:fastybird_smart_panel/modules/deck/models/deck_nav_tab_data.dart';
import 'package:fastybird_smart_panel/modules/deck/presentation/widgets/deck_nav_tab.dart';
import 'package:fastybird_smart_panel/modules/deck/services/bottom_nav_mode_notifier.dart';
import 'package:fastybird_smart_panel/modules/deck/services/deck_service.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

/// The deck bar in portrait, fed from the [DeckService] and the
/// [BottomNavModeNotifier]. See [DeckBar] for the layout.
class DeckBottomNavBar extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onNavigateToIndex;
  final VoidCallback? onMoreTapped;
  final VoidCallback? onModeTapped;

  /// Opens Settings from the gear at the end of the bar.
  final VoidCallback? onSettingsTapped;

  const DeckBottomNavBar({
    super.key,
    required this.currentIndex,
    required this.onNavigateToIndex,
    this.onMoreTapped,
    this.onModeTapped,
    this.onSettingsTapped,
  });

  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final deckService = context.watch<DeckService>();
    final modeNotifier = context.watch<BottomNavModeNotifier>();
    final screen = locator<ScreenService>();

    final tabs = buildDeckNavTabs(
      items: deckService.items,
      currentIndex: currentIndex,
      localizations: localizations,
      // The sheet is the way to Settings and to every page.
      alwaysShowAllPages: onMoreTapped != null,
    );

    return DeckBar(
      homeTab: tabs.homeTab,
      tabs: tabs.scrollableTabs,
      currentIndex: currentIndex,
      onNavigateToIndex: onNavigateToIndex,
      onMoreTapped: onMoreTapped,
      mode: modeNotifier.config,
      onModeTapped: onModeTapped,
      onSettingsTapped: onSettingsTapped,
      sizeClass: screen.sizeClass,
      square: screen.isSquare,
    );
  }
}

/// The deck bar (spec §4): 44 / 52 / 56 high (40 on the square) on the card
/// surface with a hairline on top.
///
/// `[ Home | divider | page tabs (scroll) | All pages | mode | Settings ]`
///
/// - The current page's tab takes the accent's tint and colour, and shows its
///   label on Regular and Expanded.
/// - The page tabs scroll sideways and keep the current one in view.
/// - "All pages" (the tab with `isMore`) stays at the end with its count.
/// - The mode button shows while a domain view registers one.
/// - The gear at the end opens Settings.
class DeckBar extends StatefulWidget {
  const DeckBar({
    super.key,
    this.homeTab,
    required this.tabs,
    required this.currentIndex,
    required this.onNavigateToIndex,
    this.onMoreTapped,
    this.mode,
    this.onModeTapped,
    this.onSettingsTapped,
    this.sizeClass,
    this.square = false,
  });

  final DeckNavTabData? homeTab;

  /// The page tabs, and "All pages" when one has `isMore`.
  final List<DeckNavTabData> tabs;

  final int currentIndex;
  final ValueChanged<int> onNavigateToIndex;
  final VoidCallback? onMoreTapped;

  /// The current domain's mode button.
  final BottomNavModeConfig? mode;
  final VoidCallback? onModeTapped;

  /// Shows the gear.
  final VoidCallback? onSettingsTapped;

  /// The class to size for; defaults to the screen's.
  final ScreenSizeClass? sizeClass;

  /// Whether the canvas is the square (a 40 high bar, 36 tabs).
  final bool square;

  @override
  State<DeckBar> createState() => _DeckBarState();
}

class _DeckBarState extends State<DeckBar> {
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
  void didUpdateWidget(DeckBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.currentIndex != oldWidget.currentIndex) {
      _scheduleScrollToSelected();
    }
  }

  /// A control appearing (the mode button, "All pages") narrows the tabs'
  /// scroll area; the current tab is brought back into view then. Only on a
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
    WidgetsBinding.instance.addPostFrameCallback(_scrollToSelected);
  }

  void _scrollToSelected(_) {
    _scrollScheduled = false;
    if (!mounted) return;
    scrollDeckTabIntoView(_selectedKey, _scrollController);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final neutrals = theme.neutrals;
    final localizations = AppLocalizations.of(context)!;
    final sizeClass = widget.sizeClass ?? locator<ScreenService>().sizeClass;
    final showLabels = sizeClass != ScreenSizeClass.compact;
    final extent = AppSpacings.scale(
      DeckNavMetrics.tabFor(sizeClass, landscape: false, square: widget.square),
    );
    final iconSize = AppSpacings.scale(DeckNavMetrics.iconFor(sizeClass));
    final gap = AppSpacings.scale(DeckNavMetrics.gap);

    final pageTabs = widget.tabs.where((tab) => !tab.isMore).toList();
    final moreTab = widget.tabs.where((tab) => tab.isMore).firstOrNull;
    final mode = widget.mode;

    Widget tab(DeckNavTabData data, {bool scrolls = true}) {
      final active = data.pageIndex == widget.currentIndex;
      final Widget child = DeckNavTab(
        icon: data.icon,
        label: data.label,
        extent: extent,
        iconSize: iconSize,
        active: active,
        showLabel: active && showLabels,
        lockBadge: data.lockBadge,
        onTap: () => widget.onNavigateToIndex(data.pageIndex),
      );

      return active && scrolls
          ? KeyedSubtree(key: _selectedKey, child: child)
          : child;
    }

    return Container(
      height: AppSpacings.scale(
        DeckNavMetrics.barHeightFor(sizeClass, square: widget.square),
      ),
      padding: EdgeInsets.symmetric(
        horizontal: AppSpacings.scale(DeckNavMetrics.barPaddingFor(sizeClass)),
      ),
      decoration: BoxDecoration(
        color: neutrals.surfaceCard,
        border: Border(
          top: BorderSide(
            color: neutrals.borderLight,
            width: AppSpacings.scale(1),
          ),
        ),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) => Row(
          spacing: gap,
          children: [
            if (widget.homeTab != null) tab(widget.homeTab!, scrolls: false),
            if (widget.homeTab != null && pageTabs.isNotEmpty)
              const _BarDivider(),
            Expanded(
              child: NotificationListener<ScrollMetricsNotification>(
                onNotification: _onMetrics,
                child: SingleChildScrollView(
                  controller: _scrollController,
                  scrollDirection: Axis.horizontal,
                  child: Row(
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
                tone: DeckNavTabTone.filled,
                badgeCount: moreTab.badgeCount,
                lockBadge: moreTab.lockBadge,
                onTap: widget.onMoreTapped,
              ),
            if (mode != null)
              DeckNavTab(
                icon: mode.icon,
                label: mode.title == null
                    ? mode.label
                    : '${mode.title}: ${mode.label}',
                extent: extent,
                iconSize: iconSize,
                iconColor: ThemeColorFamily.get(
                  theme.brightness,
                  mode.color,
                ).base,
                onTap: widget.onModeTapped,
              ),
            if (widget.onSettingsTapped != null &&
                _gearFits(
                  constraints.maxWidth,
                  extent: extent,
                  gap: gap,
                  hasHome: widget.homeTab != null,
                  hasPageTabs: pageTabs.isNotEmpty,
                  trailing: (moreTab != null ? 1 : 0) + (mode != null ? 1 : 0),
                ))
              DeckNavTab(
                icon: MdiIcons.cogOutline,
                label: localizations.deck_settings,
                extent: extent,
                iconSize: iconSize,
                onTap: widget.onSettingsTapped,
              ),
          ],
        ),
      ),
    );
  }

  /// Whether the gear leaves the page tabs room for at least one tab. On the
  /// narrowest bars (208 wide with a mode button) it gives way, so the
  /// current page stays in view; Settings stays in "All pages" and on the
  /// pull handle.
  bool _gearFits(
    double width, {
    required double extent,
    required double gap,
    required bool hasHome,
    required bool hasPageTabs,
    required int trailing,
  }) {
    if (!hasPageTabs || !width.isFinite) return true;

    final divider =
        AppSpacings.scale(1 + 2 * DeckNavMetrics.barDividerMargin) + gap;
    final fixed =
        (hasHome ? extent + gap + divider : 0) +
        (trailing + 1) * (extent + gap);

    return width - fixed >= extent;
  }
}

/// The bar's divider after Home: 1 × 20 in `border.light`.
class _BarDivider extends StatelessWidget {
  const _BarDivider();

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.symmetric(
      horizontal: AppSpacings.scale(DeckNavMetrics.barDividerMargin),
    ),
    child: Container(
      width: AppSpacings.scale(1),
      height: AppSpacings.scale(DeckNavMetrics.barDividerLength),
      color: Theme.of(context).neutrals.borderLight,
    ),
  );
}
