import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/features/settings/presentation/widgets/settings_card_surface.dart';
import 'package:flutter/material.dart';

/// Settings card with icon badge, label, description, trailing widget,
/// and optional bottom content. Supports danger styling.
///
/// Layout:
/// ```
/// [Icon] [Title         ] [Trailing]
///        [Description   ]
/// [Bottom - full width              ]
/// ```
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
	});

	@override
	Widget build(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final surface = SettingsCardSurface.of(context);

		final dangerBorderColor = isDark
				? AppColorsDark.danger
				: AppColorsLight.danger;
		final dangerBorderLight = dangerBorderColor.withValues(alpha: 0.18);
		final dangerTextColor = isDark ? AppColorsDark.danger : AppColorsLight.danger;

		final radius = BorderRadius.circular(AppBorderRadius.base);

		return Opacity(
			opacity: opacity,
			child: Stack(
				children: [
					Container(
						padding: EdgeInsets.all(AppSpacings.pLg),
						decoration: BoxDecoration(
							color: surface.surfaceColor,
							border: Border.all(
								color: isDanger ? dangerBorderLight : surface.borderColor,
							),
							borderRadius: radius,
							boxShadow: surface.shadow,
						),
						child: Column(
							mainAxisSize: MainAxisSize.min,
							crossAxisAlignment: CrossAxisAlignment.start,
							children: [
								Row(
									children: [
										// Icon badge
										Container(
											width: AppSpacings.scale(36),
											height: AppSpacings.scale(36),
											decoration: BoxDecoration(
												color: iconBgColor,
												borderRadius: BorderRadius.circular(AppBorderRadius.base),
											),
											child: Icon(icon, size: AppFontSize.large, color: iconColor),
										),
										SizedBox(width: AppSpacings.pMd),
										// Title + description
										Expanded(
											child: Column(
												crossAxisAlignment: CrossAxisAlignment.start,
												children: [
													Text(
														label,
														style: TextStyle(
															fontSize: AppFontSize.small,
															fontWeight: FontWeight.w600,
															color: isDanger ? dangerTextColor : surface.textColor,
														),
													),
													if (description != null)
														Padding(
															padding: EdgeInsets.only(top: AppSpacings.pXxs),
															child: Text(
																description!,
																style: TextStyle(
																	fontSize: AppFontSize.extraSmall,
																	color: surface.secondaryTextColor,
																	height: 1.3,
																),
															),
														),
												],
											),
										),
										if (trailing != null) ...[
											SizedBox(width: AppSpacings.pMd),
											ConstrainedBox(
												constraints: BoxConstraints(
													maxWidth: AppSpacings.scale(120),
												),
												child: trailing!,
											),
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
										topLeft: Radius.circular(AppBorderRadius.base),
										bottomLeft: Radius.circular(AppBorderRadius.base),
									),
								),
							),
						),
				],
			),
		);
	}
}
