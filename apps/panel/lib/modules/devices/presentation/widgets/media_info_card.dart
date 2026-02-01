import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';

class MediaInfoCard extends StatelessWidget {
	final IconData icon;
	final Color iconColor;
	final Color iconBgColor;
	final String name;
	final bool isOn;
	final String? displaySource;
	final Color accentColor;
	final double Function(double) scale;

	const MediaInfoCard({
		super.key,
		required this.icon,
		required this.iconColor,
		required this.iconBgColor,
		required this.name,
		required this.isOn,
		this.displaySource,
		required this.accentColor,
		required this.scale,
	});

	@override
	Widget build(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final localizations = AppLocalizations.of(context)!;
		final cardColor = isDark ? AppFillColorDark.light : AppFillColorLight.light;
		final borderColor = isDark ? AppBorderColorDark.light : AppBorderColorLight.light;
		final secondaryColor = isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;

		return Container(
			width: double.infinity,
			padding: AppSpacings.paddingLg,
			decoration: BoxDecoration(
				color: cardColor,
				borderRadius: BorderRadius.circular(AppBorderRadius.round),
				border: Border.all(color: borderColor, width: scale(1)),
			),
			child: Column(
				children: [
					Container(
						width: scale(64),
						height: scale(64),
						decoration: BoxDecoration(
							color: iconBgColor,
							borderRadius: BorderRadius.circular(AppBorderRadius.medium),
						),
						child: Icon(
							icon,
							color: iconColor,
							size: scale(32),
						),
					),
					AppSpacings.spacingMdVertical,
					Text(
						name,
						style: TextStyle(
							fontSize: AppFontSize.base,
							fontWeight: FontWeight.w600,
							color: isDark ? AppTextColorDark.primary : AppTextColorLight.primary,
						),
					),
					AppSpacings.spacingSmVertical,
					Row(
						mainAxisAlignment: MainAxisAlignment.center,
						mainAxisSize: MainAxisSize.min,
						children: [
							Container(
								width: scale(8),
								height: scale(8),
								decoration: BoxDecoration(
									color: isOn
										? (isDark ? AppColorsDark.success : AppColorsLight.success)
										: secondaryColor,
									shape: BoxShape.circle,
								),
							),
							AppSpacings.spacingSmHorizontal,
							Text(
								isOn ? localizations.on_state_on : localizations.on_state_off,
								style: TextStyle(
									fontSize: AppFontSize.extraSmall,
									color: secondaryColor,
								),
							),
							if (displaySource != null) ...[
								Padding(
									padding: EdgeInsets.symmetric(horizontal: AppSpacings.pSm),
									child: Text(
										'·',
										style: TextStyle(
											fontSize: AppFontSize.extraSmall,
											fontWeight: FontWeight.bold,
											color: secondaryColor,
										),
									),
								),
								Text(
									displaySource!,
									style: TextStyle(
										fontSize: AppFontSize.extraSmall,
										color: secondaryColor,
									),
								),
							],
						],
					),
				],
			),
		);
	}
}
