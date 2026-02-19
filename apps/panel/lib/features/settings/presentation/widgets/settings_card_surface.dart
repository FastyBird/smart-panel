import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

/// Shared theme-aware surface styling used by SettingsCard and SettingsTile.
class SettingsCardSurface {
	final Color surfaceColor;
	final Color borderColor;
	final Color textColor;
	final Color secondaryTextColor;
	final List<BoxShadow> shadow;

	SettingsCardSurface._({
		required this.surfaceColor,
		required this.borderColor,
		required this.textColor,
		required this.secondaryTextColor,
		required this.shadow,
	});

	factory SettingsCardSurface.of(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;

		return SettingsCardSurface._(
			surfaceColor: isDark ? AppFillColorDark.light : AppFillColorLight.blank,
			borderColor: isDark ? AppBorderColorDark.light : AppBorderColorLight.light,
			textColor: isDark ? AppTextColorDark.primary : AppTextColorLight.primary,
			secondaryTextColor: isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary,
			shadow: isDark
					? [BoxShadow(color: Colors.black.withValues(alpha: 0.2), blurRadius: 3, offset: const Offset(0, 1))]
					: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 3, offset: const Offset(0, 1))],
		);
	}
}
