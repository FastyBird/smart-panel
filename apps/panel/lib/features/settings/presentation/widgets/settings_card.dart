import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

/// Settings card with icon badge, label, description, trailing widget,
/// and optional bottom content. Supports danger styling.
class SettingsCard extends StatelessWidget {
	final IconData icon;
	final Color iconColor;
	final Color iconBgColor;
	final String label;
	final String? description;
	final Widget? trailing;
	final Widget? bottom;
	final bool isDanger;
	final double opacity;
	final VoidCallback? onTap;

	const SettingsCard({
		super.key,
		required this.icon,
		required this.iconColor,
		required this.iconBgColor,
		required this.label,
		this.description,
		this.trailing,
		this.bottom,
		this.isDanger = false,
		this.opacity = 1.0,
		this.onTap,
	});

	@override
	Widget build(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;

		final surfaceColor = isDark ? AppFillColorDark.light : AppFillColorLight.blank;
		final borderColor = isDark
				? AppBorderColorDark.light
				: AppBorderColorLight.light;
		final dangerBorderColor = isDark
				? AppColorsDark.danger
				: AppColorsLight.danger;
		final dangerBorderLight = dangerBorderColor.withValues(alpha: 0.18);
		final textColor = isDark ? AppTextColorDark.primary : AppTextColorLight.primary;
		final descColor = isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
		final dangerTextColor = isDark ? AppColorsDark.danger : AppColorsLight.danger;

		final shadow = isDark
				? [BoxShadow(color: Colors.black.withValues(alpha: 0.2), blurRadius: 3, offset: const Offset(0, 1))]
				: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 3, offset: const Offset(0, 1))];

		final radius = BorderRadius.circular(AppBorderRadius.medium);

		return GestureDetector(
			onTap: onTap,
			child: Opacity(
				opacity: opacity,
				child: Stack(
					children: [
						Container(
							padding: EdgeInsets.all(AppSpacings.pLg),
							decoration: BoxDecoration(
								color: surfaceColor,
								border: Border.all(
									color: isDanger ? dangerBorderLight : borderColor,
								),
								borderRadius: radius,
								boxShadow: shadow,
							),
							child: Column(
								mainAxisSize: MainAxisSize.min,
								children: [
									Row(
										children: [
											// Icon badge
											Container(
												width: AppSpacings.scale(36),
												height: AppSpacings.scale(36),
												decoration: BoxDecoration(
													color: iconBgColor,
													borderRadius: BorderRadius.circular(AppSpacings.scale(10)),
												),
												child: Icon(icon, size: AppFontSize.large, color: iconColor),
											),
											SizedBox(width: AppSpacings.pMd),
											// Text
											Expanded(
												child: Column(
													crossAxisAlignment: CrossAxisAlignment.start,
													children: [
														Text(
															label,
															style: TextStyle(
																fontSize: AppFontSize.small,
																fontWeight: FontWeight.w600,
																color: isDanger ? dangerTextColor : textColor,
															),
														),
														if (description != null)
															Padding(
																padding: EdgeInsets.only(top: AppSpacings.pXxs),
																child: Text(
																	description!,
																	style: TextStyle(
																		fontSize: AppFontSize.extraSmall,
																		color: descColor,
																		height: 1.3,
																	),
																),
															),
													],
												),
											),
											if (trailing != null) ...[
												SizedBox(width: AppSpacings.pMd),
												trailing!,
											],
										],
									),
									if (bottom != null) ...[
										SizedBox(height: AppSpacings.pMd),
										bottom!,
									],
								],
							),
						),
						if (isDanger)
							Positioned(
								left: 0,
								top: 0,
								bottom: 0,
								child: Container(
									width: AppSpacings.scale(3),
									decoration: BoxDecoration(
										color: dangerTextColor,
										borderRadius: BorderRadius.only(
											topLeft: Radius.circular(AppBorderRadius.medium),
											bottomLeft: Radius.circular(AppBorderRadius.medium),
										),
									),
								),
							),
					],
				),
			),
		);
	}
}
