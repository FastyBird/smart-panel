import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

/// Grid tile widget for the general settings screen.
class SettingsTile extends StatelessWidget {
	final String label;
	final String sublabel;
	final IconData icon;
	final Color iconColor;
	final Color iconBgColor;
	final VoidCallback? onTap;

	const SettingsTile({
		super.key,
		required this.label,
		required this.sublabel,
		required this.icon,
		required this.iconColor,
		required this.iconBgColor,
		this.onTap,
	});

	@override
	Widget build(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;

		final surfaceColor = isDark ? AppFillColorDark.light : AppFillColorLight.blank;
		final borderColor = isDark
				? AppBorderColorDark.light
				: AppBorderColorLight.light;
		final textColor = isDark ? AppTextColorDark.primary : AppTextColorLight.primary;
		final subColor = isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;

		final shadow = isDark
				? [BoxShadow(color: Colors.black.withValues(alpha: 0.2), blurRadius: 3, offset: const Offset(0, 1))]
				: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 3, offset: const Offset(0, 1))];

		return GestureDetector(
			onTap: onTap,
			child: Container(
				padding: EdgeInsets.symmetric(
					vertical: AppSpacings.pLg,
					horizontal: AppSpacings.pLg,
				),
				decoration: BoxDecoration(
					color: surfaceColor,
					border: Border.all(color: borderColor),
					borderRadius: BorderRadius.circular(AppBorderRadius.medium),
					boxShadow: shadow,
				),
				child: Column(
					mainAxisAlignment: MainAxisAlignment.center,
					children: [
						Container(
							width: AppSpacings.scale(42),
							height: AppSpacings.scale(42),
							decoration: BoxDecoration(
								color: iconBgColor,
								borderRadius: BorderRadius.circular(AppBorderRadius.medium),
							),
							child: Icon(icon, size: AppFontSize.extraLarge, color: iconColor),
						),
						SizedBox(height: AppSpacings.pMd),
						Text(
							label,
							style: TextStyle(
								fontSize: AppFontSize.small,
								fontWeight: FontWeight.w600,
								color: textColor,
							),
						),
						SizedBox(height: AppSpacings.pXs),
						Text(
							sublabel,
							style: TextStyle(
								fontSize: AppFontSize.extraSmall,
								color: subColor,
							),
							textAlign: TextAlign.center,
						),
					],
				),
			),
		);
	}
}
