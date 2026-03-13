import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

import 'package:fastybird_smart_panel/core/utils/icon.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/modules/spaces/models/spaces/space.dart';

/// List item widget for displaying a room/space in the selection list
class RoomListItem extends StatelessWidget {
  final SpaceModel room;
  final bool isSelected;
  final VoidCallback? onTap;
  final bool isDark;

  const RoomListItem({
    super.key,
    required this.room,
    this.isSelected = false,
    this.onTap,
    this.isDark = false,
  });

  @override
  Widget build(BuildContext context) {
    final accent = isDark ? AppColorsDark.primary : AppColorsLight.primary;
    final accentLight =
        isDark ? AppColorsDark.primaryLight9 : AppColorsLight.primaryLight9;

    final icon = resolveSpaceIcon(room.icon, room.category);

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: EdgeInsets.symmetric(
          horizontal: AppSpacings.pMd,
          vertical: AppSpacings.pMd,
        ),
        decoration: BoxDecoration(
          color: isSelected
              ? accentLight
              : isDark
                  ? AppFillColorDark.base
                  : AppFillColorLight.blank,
          borderRadius: BorderRadius.circular(AppBorderRadius.base),
          border: Border.all(
            color: isSelected ? accent : AppColors.blank,
            width: AppSpacings.pXs,
          ),
          boxShadow: isDark
              ? null
              : [
                  BoxShadow(
                    color: AppColors.black.withValues(alpha: 0.05),
                    blurRadius: AppSpacings.pMd,
                    offset: Offset(0, AppSpacings.pXs),
                  ),
                ],
        ),
        child: Row(
          children: [
            // Icon
            Container(
              width: AppSpacings.scale(44),
              height: AppSpacings.scale(44),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: isSelected
                    ? accent
                    : isDark
                        ? AppFillColorDark.dark
                        : AppFillColorLight.dark,
                borderRadius: BorderRadius.circular(AppBorderRadius.small),
              ),
              child: Icon(
                isSelected ? MdiIcons.check : icon,
                color: isSelected
                    ? AppColors.white
                    : isDark
                        ? AppTextColorDark.secondary
                        : AppTextColorLight.secondary,
                size: AppSpacings.pLg + AppSpacings.pMd,
              ),
            ),
            AppSpacings.spacingMdHorizontal,
            // Info
            Expanded(
              child: Text(
                room.name,
                style: TextStyle(
                  color: isDark
                      ? AppTextColorDark.primary
                      : AppTextColorLight.primary,
                  fontSize: AppFontSize.base,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
