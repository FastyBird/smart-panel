import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_card_surface.dart';
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
		final surface = SettingsCardSurface.of(context);

		final radius = BorderRadius.circular(AppBorderRadius.medium);

		return Material(
			color: surface.surfaceColor,
			borderRadius: radius,
			child: InkWell(
				onTap: onTap,
				borderRadius: radius,
				child: Container(
					padding: EdgeInsets.symmetric(
						vertical: AppSpacings.pLg,
						horizontal: AppSpacings.pLg,
					),
					decoration: BoxDecoration(
						border: Border.all(color: surface.borderColor),
						borderRadius: radius,
						boxShadow: surface.shadow,
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
									color: surface.textColor,
								),
							),
							SizedBox(height: AppSpacings.pXs),
							Text(
								sublabel,
								style: TextStyle(
									fontSize: AppFontSize.extraSmall,
									color: surface.secondaryTextColor,
								),
								textAlign: TextAlign.center,
							),
						],
					),
				),
			),
		);
	}
}
