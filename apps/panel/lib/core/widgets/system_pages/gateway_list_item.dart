import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/models/discovered_backend.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/system_pages/theme.dart';

/// List item widget for displaying a discovered backend/gateway
class GatewayListItem extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final DiscoveredBackend backend;
  final bool isSelected;
  final VoidCallback? onTap;
  final bool isDark;

  GatewayListItem({
    super.key,
    required this.backend,
    this.isSelected = false,
    this.onTap,
    this.isDark = false,
  });

  @override
  Widget build(BuildContext context) {
    final accent = SystemPagesTheme.accent(isDark);
    final accentLight = SystemPagesTheme.accentLight(isDark);

    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: EdgeInsets.symmetric(
          horizontal: AppSpacings.pMd,
          vertical: AppSpacings.pMd,
        ),
        decoration: BoxDecoration(
          color: isSelected ? accentLight : SystemPagesTheme.card(isDark),
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
              width: _screenService.scale(44),
              height: _screenService.scale(44),
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: isSelected
                    ? accent
                    : SystemPagesTheme.cardSecondary(isDark),
                borderRadius: BorderRadius.circular(AppBorderRadius.small),
              ),
              child: Icon(
                isSelected ? Icons.check : MdiIcons.server,
                color: isSelected
                    ? AppColors.white
                    : SystemPagesTheme.textSecondary(isDark),
                size: AppSpacings.pLg + AppSpacings.pMd,
              ),
            ),
            SizedBox(width: AppSpacings.pMd),
            // Info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    backend.name,
                    style: TextStyle(
                      color: SystemPagesTheme.textPrimary(isDark),
                      fontSize: AppFontSize.base,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  SizedBox(height: AppSpacings.pXs),
                  Text(
                    backend.displayAddress,
                    style: TextStyle(
                      color: SystemPagesTheme.textMuted(isDark),
                      fontSize: AppFontSize.small,
                    ),
                  ),
                ],
              ),
            ),
            // Badge
            if (backend.version != null)
              Container(
                padding: EdgeInsets.symmetric(
                  horizontal: AppSpacings.pSm,
                  vertical: AppSpacings.pXs,
                ),
                decoration: BoxDecoration(
                  color: SystemPagesTheme.cardSecondary(isDark),
                  borderRadius: BorderRadius.circular(AppBorderRadius.small),
                ),
                child: Text(
                  'v${backend.version}',
                  style: TextStyle(
                    color: SystemPagesTheme.textMuted(isDark),
                    fontSize: AppFontSize.extraSmall,
                    fontWeight: FontWeight.w500,
                    letterSpacing: _screenService.scale(0.5),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
