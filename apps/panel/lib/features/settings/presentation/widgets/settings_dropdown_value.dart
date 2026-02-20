import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

/// Dropdown value display with chevron icon for settings cards.
class SettingsDropdownValue extends StatelessWidget {
	final String value;

	const SettingsDropdownValue({
		super.key,
		required this.value,
	});

	@override
	Widget build(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;

		final accentColor = isDark ? AppColorsDark.primary : AppColorsLight.primary;
		final hintColor = isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder;

		return Row(
			mainAxisSize: MainAxisSize.min,
			children: [
				Flexible(
					child: Text(
						value,
						style: TextStyle(
							fontSize: AppFontSize.small,
							fontWeight: FontWeight.w600,
							color: accentColor,
						),
						overflow: TextOverflow.ellipsis,
						maxLines: 1,
					),
				),
				SizedBox(width: AppSpacings.scale(3)),
				Icon(Icons.expand_more, size: AppFontSize.base, color: hintColor),
			],
		);
	}
}
