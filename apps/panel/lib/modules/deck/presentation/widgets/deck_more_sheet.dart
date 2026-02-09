import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/modules/deck/models/deck_item.dart';
import 'package:fastybird_smart_panel/modules/deck/services/deck_service.dart';
import 'package:fastybird_smart_panel/modules/deck/types/domain_type.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';
import 'package:provider/provider.dart';

/// Shows a bottom sheet listing all navigable pages (domains + dashboard pages).
///
/// Tapping an item navigates to that page index and closes the sheet.
void showMoreSheet(
  BuildContext context, {
  required int currentIndex,
  required ValueChanged<int> onNavigateToIndex,
}) {
  showModalBottomSheet(
    context: context,
    backgroundColor: Colors.transparent,
    builder: (sheetContext) {
      return _DeckMoreSheet(
        currentIndex: currentIndex,
        onNavigateToIndex: (index) {
          Navigator.of(sheetContext).pop();
          onNavigateToIndex(index);
        },
      );
    },
  );
}

class _DeckMoreSheet extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onNavigateToIndex;

  const _DeckMoreSheet({
    required this.currentIndex,
    required this.onNavigateToIndex,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final deckService = context.read<DeckService>();
    final items = deckService.items;

    return Container(
      decoration: BoxDecoration(
        color: isDark ? AppBgColorDark.overlay : AppBgColorLight.overlay,
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(AppBorderRadius.medium),
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Handle bar
          Padding(
            padding: EdgeInsets.only(top: AppSpacings.pMd),
            child: Container(
              width: AppSpacings.scale(40),
              height: AppSpacings.scale(4),
              decoration: BoxDecoration(
                color: isDark ? AppBorderColorDark.base : AppBorderColorLight.base,
                borderRadius: BorderRadius.circular(AppSpacings.scale(2)),
              ),
            ),
          ),
          // Title
          Padding(
            padding: EdgeInsets.all(AppSpacings.pLg),
            child: Text(
              'All Pages',
              style: TextStyle(
                fontSize: AppFontSize.large,
                fontWeight: FontWeight.w600,
                color: isDark ? AppTextColorDark.primary : AppTextColorLight.primary,
              ),
            ),
          ),
          // Grid of items
          Padding(
            padding: EdgeInsets.only(
              left: AppSpacings.pLg,
              right: AppSpacings.pLg,
              bottom: AppSpacings.pXl,
            ),
            child: Wrap(
              spacing: AppSpacings.pMd,
              runSpacing: AppSpacings.pMd,
              children: [
                for (int i = 0; i < items.length; i++)
                  _buildItem(context, items[i], i),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildItem(BuildContext context, DeckItem item, int index) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isActive = currentIndex == index;
    final activeColor = Theme.of(context).colorScheme.primary;

    final String label;
    final IconData icon;

    if (item is SystemViewItem) {
      label = 'Home';
      icon = MdiIcons.home;
    } else if (item is DomainViewItem) {
      label = item.domainType.label;
      icon = item.domainType.icon;
    } else if (item is SecurityViewItem) {
      label = item.title;
      icon = MdiIcons.shieldHome;
    } else if (item is DashboardPageItem) {
      label = item.title;
      icon = MdiIcons.viewDashboard;
    } else {
      return const SizedBox.shrink();
    }

    return GestureDetector(
      onTap: () => onNavigateToIndex(index),
      child: Container(
        width: AppSpacings.scale(90),
        padding: EdgeInsets.symmetric(
          vertical: AppSpacings.pMd,
          horizontal: AppSpacings.pSm,
        ),
        decoration: BoxDecoration(
          color: isActive
              ? activeColor.withValues(alpha: 0.12)
              : (isDark ? AppFillColorDark.lighter : AppFillColorLight.light),
          borderRadius: BorderRadius.circular(AppBorderRadius.base),
          border: isActive
              ? Border.all(color: activeColor.withValues(alpha: 0.3), width: AppSpacings.scale(1))
              : null,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          spacing: AppSpacings.pSm,
          children: [
            Icon(
              icon,
              color: isActive ? activeColor : (isDark ? AppTextColorDark.regular : AppTextColorLight.regular),
              size: AppSpacings.scale(24),
            ),
            Text(
              label,
              style: TextStyle(
                fontSize: AppFontSize.extraSmall,
                fontWeight: isActive ? FontWeight.w600 : FontWeight.w400,
                color: isActive ? activeColor : (isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary),
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
