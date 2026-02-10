import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/deck/models/deck_nav_tab_data.dart';
import 'package:fastybird_smart_panel/modules/deck/services/deck_service.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

/// Vertical floating dock for landscape mode navigation.
///
/// Layout: vertical glass container with Home, domain tabs, More, divider, Mode.
/// Mirrors [DeckBottomNavBar] API but renders vertically as a floating side dock.
class DeckSideDock extends StatefulWidget {
  final int currentIndex;
  final ValueChanged<int> onNavigateToIndex;
  final VoidCallback? onMoreTapped;

  const DeckSideDock({
    super.key,
    required this.currentIndex,
    required this.onNavigateToIndex,
    this.onMoreTapped,
  });

  @override
  State<DeckSideDock> createState() => _DeckSideDockState();
}

class _DeckSideDockState extends State<DeckSideDock> {
  final GlobalKey _selectedKey = GlobalKey();
  final ScrollController _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _scheduleScrollToSelected();
  }

  @override
  void didUpdateWidget(DeckSideDock oldWidget) {
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
    WidgetsBinding.instance.addPostFrameCallback(_scrollToSelected);
  }

  void _scrollToSelected(_) {
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
    final deckService = context.watch<DeckService>();
    final screenService = locator<ScreenService>();
    final showLabels = screenService.isLargeScreen;

    final localizations = AppLocalizations.of(context)!;

    final tabs = buildDeckNavTabs(
      items: deckService.items,
      currentIndex: widget.currentIndex,
      localizations: localizations,
    );
    final homeTab = tabs.homeTab;
    final scrollableTabs = tabs.scrollableTabs;

    final dockWidth = AppSpacings.scale(showLabels ? 80 : 56);

    // Glass background colors
    final bgColor = isDark
        ? AppBgColorDark.overlay.withValues(alpha: 0.85)
        : AppBgColorLight.overlay.withValues(alpha: 0.9);
    final borderColor =
        isDark ? AppBorderColorDark.lighter : AppBorderColorLight.light;
    final dividerColor =
        isDark ? AppBorderColorDark.light : AppBorderColorLight.darker;

    final columnBgColor =
        isDark ? AppBgColorDark.page : AppBgColorLight.page;

    return Container(
      width: dockWidth,
      color: columnBgColor,
      child: Padding(
        padding: EdgeInsets.symmetric(
          vertical: AppSpacings.pLg,
          horizontal: AppSpacings.pSm,
        ),
        child: Center(
          child: Container(
            decoration: BoxDecoration(
              color: bgColor,
              borderRadius: BorderRadius.circular(AppBorderRadius.medium),
              border: Border.all(
                color: borderColor,
                width: AppSpacings.scale(1),
              ),
              boxShadow: [
                BoxShadow(
                  color: AppShadowColor.light,
                  blurRadius: AppSpacings.scale(8),
                  offset: Offset(AppSpacings.scale(2), 0),
                ),
              ],
            ),
            child: Padding(
              padding: EdgeInsets.symmetric(vertical: AppSpacings.pSm),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Home tab
                  if (homeTab != null)
                    _DockTab(
                      icon: homeTab.icon,
                      label: homeTab.label,
                      isActive: widget.currentIndex == homeTab.pageIndex,
                      showLabel: showLabels,
                      onTap: () =>
                          widget.onNavigateToIndex(homeTab.pageIndex),
                    ),
                  if (homeTab != null && scrollableTabs.isNotEmpty)
                    _buildDivider(dividerColor),
                  // Scrollable domain tabs
                  if (scrollableTabs.isNotEmpty)
                    Flexible(
                      child: SingleChildScrollView(
                        controller: _scrollController,
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: scrollableTabs.map((tab) {
                            final bool isActive;
                            if (tab.isMore) {
                              isActive = tab.isMoreActive;
                            } else {
                              isActive = tab.pageIndex == widget.currentIndex;
                            }

                            Widget tabWidget = _DockTab(
                              icon: tab.icon,
                              label: tab.label,
                              isActive: isActive,
                              showLabel: showLabels,
                              badgeCount: tab.badgeCount,
                              onTap: tab.isMore
                                  ? widget.onMoreTapped
                                  : () => widget
                                      .onNavigateToIndex(tab.pageIndex),
                            );

                            if (isActive) {
                              tabWidget = KeyedSubtree(
                                  key: _selectedKey, child: tabWidget);
                            }

                            return tabWidget;
                          }).toList(),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildDivider(Color color) {
    return Padding(
      padding: EdgeInsets.symmetric(
        vertical: AppSpacings.pXs,
        horizontal: AppSpacings.pMd,
      ),
      child: Container(
        height: AppSpacings.scale(1),
        color: color,
      ),
    );
  }
}

/// A single dock tab: icon (+ optional label) with active pill highlight.
class _DockTab extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool isActive;
  final bool showLabel;
  final VoidCallback? onTap;
  final int badgeCount;

  static const Duration _animDuration = Duration(milliseconds: 250);
  static const Curve _animCurve = Curves.easeInOut;

  const _DockTab({
    required this.icon,
    required this.label,
    required this.isActive,
    required this.showLabel,
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

    final double iconSize = AppSpacings.scale(22);
    final double pillRadius = AppBorderRadius.base;

    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: AnimatedSize(
        duration: _animDuration,
        curve: _animCurve,
        child: Container(
          width: double.infinity,
          margin: EdgeInsets.symmetric(
            horizontal: AppSpacings.pSm,
            vertical: AppSpacings.scale(2),
          ),
          padding: EdgeInsets.symmetric(
            vertical: AppSpacings.pSm,
          ),
          decoration: BoxDecoration(
            color: isActive
                ? accentColor.withValues(alpha: 0.15)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(pillRadius),
          ),
          child: Column(
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
              if (showLabel) ...[
                SizedBox(height: AppSpacings.scale(2)),
                Text(
                  label,
                  style: TextStyle(
                    fontSize: AppFontSize.extraExtraSmall,
                    fontWeight: FontWeight.w500,
                    color: isActive ? accentColor : inactiveColor,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

