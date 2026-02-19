import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/models/bottom_nav_mode_config.dart';
import 'package:fastybird_smart_panel/modules/deck/models/deck_nav_tab_data.dart';
import 'package:fastybird_smart_panel/modules/deck/services/bottom_nav_mode_notifier.dart';
import 'package:fastybird_smart_panel/modules/deck/services/deck_service.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

/// Bottom navigation bar for portrait mode.
///
/// Layout: [ Home (icon-only, fixed) | divider | scrollable domain tabs | divider | Mode button ]
///
/// - Home is pinned on the left, always icon-only.
/// - Domain and More tabs live in a horizontally scrollable area that
///   auto-scrolls to centre the active tab.
/// - The active tab expands to show icon + label (on medium+ screens).
/// - A mode button appears on the right when a domain view registers its config.
class DeckBottomNavBar extends StatefulWidget {
  final int currentIndex;
  final ValueChanged<int> onNavigateToIndex;
  final VoidCallback? onMoreTapped;
  final VoidCallback? onModeTapped;

  const DeckBottomNavBar({
    super.key,
    required this.currentIndex,
    required this.onNavigateToIndex,
    this.onMoreTapped,
    this.onModeTapped,
  });

  @override
  State<DeckBottomNavBar> createState() => _DeckBottomNavBarState();
}

class _DeckBottomNavBarState extends State<DeckBottomNavBar> {
  final GlobalKey _selectedKey = GlobalKey();
  final ScrollController _scrollController = ScrollController();
  bool _lastHadMode = false;
  bool _scrollScheduled = false;

  @override
  void initState() {
    super.initState();
    _scheduleScrollToSelected();
  }

  @override
  void didUpdateWidget(DeckBottomNavBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.currentIndex != oldWidget.currentIndex) {
      _scheduleScrollToSelected();
    }
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
    final ctx = _selectedKey.currentContext;
    if (ctx == null || !mounted) return;

    Scrollable.ensureVisible(
      ctx,
      alignment: 0.5,
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final localizations = AppLocalizations.of(context)!;
    final deckService = context.watch<DeckService>();
    final modeNotifier = context.watch<BottomNavModeNotifier>();

    // Re-center active tab when mode button appears/disappears,
    // since it changes the available width of the scrollable area.
    final hasMode = modeNotifier.hasConfig;
    if (hasMode != _lastHadMode) {
      _lastHadMode = hasMode;
      _scheduleScrollToSelected();
    }

    final showLabels = !locator<ScreenService>().isSmallScreen;

    final tabs = buildDeckNavTabs(
      items: deckService.items,
      currentIndex: widget.currentIndex,
      localizations: localizations,
    );
    final homeTab = tabs.homeTab;
    final scrollableTabs = tabs.scrollableTabs;

    final dividerColor =
        isDark ? AppBorderColorDark.light : AppBorderColorLight.darker;

    return Container(
      height: AppSpacings.scale(52),
      decoration: BoxDecoration(
        color: isDark ? AppBgColorDark.base : AppBgColorLight.base,
        border: Border(
          top: BorderSide(
            color: dividerColor,
            width: AppSpacings.scale(1),
          ),
        ),
      ),
      child: Row(
        children: [
          // Fixed Home tab (icon-only).
          if (homeTab != null) ...[
            SizedBox(
              width: AppSpacings.scale(56),
              child: _NavTab(
                icon: homeTab.icon,
                label: homeTab.label,
                isActive: widget.currentIndex == homeTab.pageIndex,
                isExpanded: false,
                onTap: () => widget.onNavigateToIndex(homeTab.pageIndex),
              ),
            ),
            _buildDivider(dividerColor),
          ],
          // Scrollable domain + more tabs.
          Expanded(
            child: SingleChildScrollView(
              controller: _scrollController,
              scrollDirection: Axis.horizontal,
              child: Row(
                children: scrollableTabs.map((tab) {
                  final bool isActive;
                  if (tab.isMore) {
                    isActive = tab.isMoreActive;
                  } else {
                    isActive = tab.pageIndex == widget.currentIndex;
                  }

                  Widget tabWidget = _NavTab(
                    icon: tab.icon,
                    label: tab.label,
                    isActive: isActive,
                    isExpanded: isActive && showLabels,
                    badgeCount: tab.badgeCount,
                    onTap: tab.isMore
                        ? widget.onMoreTapped
                        : () => widget.onNavigateToIndex(tab.pageIndex),
                  );

                  if (isActive) {
                    tabWidget =
                        KeyedSubtree(key: _selectedKey, child: tabWidget);
                  }

                  return tabWidget;
                }).toList(),
              ),
            ),
          ),
          // Mode button.
          if (modeNotifier.hasConfig) ...[
            _buildDivider(dividerColor),
            _ModeButton(
              config: modeNotifier.config!,
              onTap: widget.onModeTapped,
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildDivider(Color color) {
    return Container(
      width: AppSpacings.scale(1),
      height: AppSpacings.scale(36),
      color: color,
    );
  }
}

/// A single tab that shows icon-only when collapsed, icon + label when expanded.
///
/// Uses [AnimatedSize] so the pill smoothly grows/shrinks when [isExpanded]
/// changes — no manual text measurement needed.
class _NavTab extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool isActive;
  final bool isExpanded;
  final VoidCallback? onTap;
  final int badgeCount;

  static const Duration _animDuration = Duration(milliseconds: 250);
  static const Curve _animCurve = Curves.easeInOut;

  const _NavTab({
    required this.icon,
    required this.label,
    required this.isActive,
    required this.isExpanded,
    this.onTap,
    this.badgeCount = 0,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final accentColor = ThemeColorFamily.get(
      isDark ? Brightness.dark : Brightness.light,
      ThemeColors.primary,
    ).base;
    final Color inactiveColor = isDark
        ? AppTextColorDark.placeholder
        : AppTextColorLight.placeholder;
    final Color iconColor = isActive ? accentColor : inactiveColor;

    final double iconSize = AppSpacings.scale(24);
    final double pillHeight = AppSpacings.scale(36);
    final double pillRadius = AppBorderRadius.base;

    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Center(
        child: AnimatedSize(
          duration: _animDuration,
          curve: _animCurve,
          child: Container(
            constraints: BoxConstraints(minWidth: AppSpacings.scale(40)),
            height: pillHeight,
            margin: EdgeInsets.symmetric(horizontal: AppSpacings.scale(4)),
            padding: EdgeInsets.symmetric(horizontal: AppSpacings.scale(8)),
            decoration: BoxDecoration(
              color: isActive
                  ? accentColor.withValues(alpha: 0.15)
                  : Colors.transparent,
              borderRadius: BorderRadius.circular(pillRadius),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Icon(icon, color: iconColor, size: iconSize),
                    if (badgeCount > 0)
                      Positioned(
                        right: -AppSpacings.scale(8),
                        top: -AppSpacings.scale(4),
                        child: Container(
                          padding: EdgeInsets.symmetric(
                            horizontal: AppSpacings.scale(4),
                            vertical: AppSpacings.scale(1),
                          ),
                          decoration: BoxDecoration(
                            color: accentColor,
                            borderRadius:
                                BorderRadius.circular(AppSpacings.scale(8)),
                          ),
                          constraints: BoxConstraints(
                            minWidth: AppSpacings.scale(14),
                            minHeight: AppSpacings.scale(14),
                          ),
                          child: Text(
                            '$badgeCount',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: AppSpacings.scale(9),
                              fontWeight: FontWeight.w600,
                            ),
                            textAlign: TextAlign.center,
                          ),
                        ),
                      ),
                  ],
                ),
                if (isExpanded)
                  Padding(
                    padding: EdgeInsets.only(left: AppSpacings.scale(6)),
                    child: Text(
                      label,
                      style: TextStyle(
                        fontSize: AppFontSize.small,
                        fontWeight: FontWeight.w500,
                        color: accentColor,
                      ),
                      maxLines: 1,
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Mode button shown on the right side of the bottom nav bar.
class _ModeButton extends StatelessWidget {
  final BottomNavModeConfig config;
  final VoidCallback? onTap;

  const _ModeButton({required this.config, this.onTap});

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colorFamily = ThemeColorFamily.get(
      isDark ? Brightness.dark : Brightness.light,
      config.color,
    );

    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: AppSpacings.pLg),
        child: Icon(
          config.icon,
          color: colorFamily.base,
          size: AppSpacings.scale(22),
        ),
      ),
    );
  }
}
