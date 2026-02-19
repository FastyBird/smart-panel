import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

/// Grid tile widget for the general settings screen.
///
/// Styled to match [UniversalTile] inactive state.
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

		final tileBgColor = isDark ? AppFillColorDark.light : AppFillColorLight.blank;
		final borderColor = isDark ? tileBgColor : AppBorderColorLight.light;
		final textColor = isDark ? AppTextColorDark.primary : AppTextColorLight.primary;
		final secondaryTextColor = isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;

		final radius = BorderRadius.circular(AppBorderRadius.base);

		return Material(
			color: tileBgColor,
			borderRadius: radius,
			child: InkWell(
				onTap: onTap,
				borderRadius: radius,
				child: Container(
					padding: EdgeInsets.all(AppSpacings.pMd),
					decoration: BoxDecoration(
						border: Border.all(color: borderColor),
						borderRadius: radius,
					),
					child: Column(
						mainAxisAlignment: MainAxisAlignment.center,
						children: [
							Container(
								width: AppSpacings.scale(42),
								height: AppSpacings.scale(42),
								decoration: BoxDecoration(
									color: iconBgColor,
									borderRadius: BorderRadius.circular(AppBorderRadius.base),
								),
								child: Icon(icon, size: AppFontSize.extraLarge, color: iconColor),
							),
							SizedBox(height: AppSpacings.pSm),
							Flexible(
								child: Column(
									mainAxisSize: MainAxisSize.min,
									children: [
										Text(
											label,
											style: TextStyle(
												fontSize: AppFontSize.small,
												fontWeight: FontWeight.w600,
												color: textColor,
											),
											textAlign: TextAlign.center,
											overflow: TextOverflow.ellipsis,
											maxLines: 1,
										),
										SizedBox(height: AppSpacings.pXs),
										Text(
											sublabel,
											style: TextStyle(
												fontSize: AppFontSize.extraSmall,
												color: secondaryTextColor,
											),
											textAlign: TextAlign.center,
											overflow: TextOverflow.ellipsis,
											maxLines: 1,
										),
									],
								),
							),
						],
					),
				),
			),
		);
	}
}
