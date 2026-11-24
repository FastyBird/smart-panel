import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

/// The settings surfaces: `surface.card` with a `border.light` outline and no
/// shadow (docs/display-ui-design-spec.md §3), the same as the list row.
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
		final neutrals = Theme.of(context).neutrals;

		return SettingsCardSurface._(
			surfaceColor: neutrals.surfaceCard,
			borderColor: neutrals.borderLight,
			textColor: neutrals.textPrimary,
			secondaryTextColor: neutrals.textSecondary,
			shadow: const [],
		);
	}
}
