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

		final surfaceColor = isDark ? AppFillColorDark.light : AppFillColorLight.blank;

		return SettingsCardSurface._(
			surfaceColor: surfaceColor,
			borderColor: isDark ? surfaceColor : AppBorderColorLight.light,
			textColor: isDark ? AppTextColorDark.primary : AppTextColorLight.primary,
			secondaryTextColor: isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary,
			shadow: [],
		);
	}
}
