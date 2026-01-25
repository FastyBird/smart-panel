import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

import 'package:fastybird_smart_panel/core/models/discovered_backend.dart';
import 'package:fastybird_smart_panel/core/widgets/system_pages/theme.dart';

/// List item widget for displaying a discovered backend/gateway
class GatewayListItem extends StatelessWidget {
  final DiscoveredBackend backend;
  final bool isSelected;
  final VoidCallback? onTap;
  final bool isDark;

  const GatewayListItem({
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
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        decoration: BoxDecoration(
          color: isSelected ? accentLight : SystemPagesTheme.card(isDark),
          borderRadius: BorderRadius.circular(SystemPagesTheme.radiusMd),
          border: Border.all(
            color: isSelected ? accent : Colors.transparent,
            width: 2,
          ),
          boxShadow: isDark
              ? null
              : [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
        ),
        child: Row(
          children: [
            // Icon
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: isSelected
                    ? accent
                    : SystemPagesTheme.cardSecondary(isDark),
                borderRadius: BorderRadius.circular(SystemPagesTheme.radiusSm),
              ),
              child: Icon(
                isSelected ? Icons.check : MdiIcons.server,
                color: isSelected
                    ? Colors.white
                    : SystemPagesTheme.textSecondary(isDark),
                size: 24,
              ),
            ),
            const SizedBox(width: 16),
            // Info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    backend.name,
                    style: TextStyle(
                      color: SystemPagesTheme.textPrimary(isDark),
                      fontSize: 15,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    backend.displayAddress,
                    style: TextStyle(
                      color: SystemPagesTheme.textMuted(isDark),
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),
            // Badge
            if (backend.version != null)
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: SystemPagesTheme.cardSecondary(isDark),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  'v${backend.version}',
                  style: TextStyle(
                    color: SystemPagesTheme.textMuted(isDark),
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
