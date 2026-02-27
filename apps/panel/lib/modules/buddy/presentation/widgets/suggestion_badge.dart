import 'package:flutter/material.dart';

import 'package:fastybird_smart_panel/core/utils/theme.dart';

class BuddySuggestionBadge extends StatelessWidget {
  final int count;

  const BuddySuggestionBadge({
    super.key,
    required this.count,
  });

  @override
  Widget build(BuildContext context) {
    if (count <= 0) return const SizedBox.shrink();

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final accentColor = ThemeColorFamily.get(
      isDark ? Brightness.dark : Brightness.light,
      ThemeColors.primary,
    ).base;

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: AppSpacings.scale(6),
        vertical: AppSpacings.scale(2),
      ),
      decoration: BoxDecoration(
        color: accentColor,
        borderRadius: BorderRadius.circular(AppSpacings.scale(10)),
      ),
      constraints: BoxConstraints(
        minWidth: AppSpacings.scale(18),
        minHeight: AppSpacings.scale(18),
      ),
      child: Text(
        '$count',
        style: TextStyle(
          color: Colors.white,
          fontSize: AppSpacings.scale(10),
          fontWeight: FontWeight.w600,
        ),
        textAlign: TextAlign.center,
      ),
    );
  }
}
