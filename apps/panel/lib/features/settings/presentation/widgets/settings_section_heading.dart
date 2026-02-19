import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

/// Uppercase section heading label for settings screens.
class SettingsSectionHeading extends StatelessWidget {
	final String text;
	final Color? color;

	const SettingsSectionHeading({
		super.key,
		required this.text,
		this.color,
	});

	@override
	Widget build(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;

		final defaultColor = isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;

		return Padding(
			padding: EdgeInsets.only(bottom: AppSpacings.pMd, top: AppSpacings.pSm),
			child: Text(
				text.toUpperCase(),
				style: TextStyle(
					fontSize: AppFontSize.extraSmall,
					fontWeight: FontWeight.w700,
					color: color ?? defaultColor,
					letterSpacing: 1.0,
				),
			),
		);
	}
}
