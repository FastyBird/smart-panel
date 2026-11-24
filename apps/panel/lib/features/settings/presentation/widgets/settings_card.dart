import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/list_row.dart';
import 'package:flutter/material.dart';

/// A settings row: the one list row ([AppListRow]) with the label, the
/// description as its subtitle and one trailing control.
///
/// [bottom] adds full-width content under the row (a slider) inside the same
/// card. [isDanger] gives the title and outline the danger colour.
///
/// The icon parameters are kept so callers compile; settings rows draw no
/// icon (design canvas, "Settings").
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
		final theme = Theme.of(context);
		final neutrals = theme.neutrals;

		final row = AppListRow(
			title: label,
			subtitle: description,
			trailing: trailing,
			danger: isDanger,
			surface: bottom == null,
		);

		final card = bottom == null
				? row
				: Container(
						decoration: BoxDecoration(
							color: neutrals.surfaceCard,
							border: Border.all(
								color: isDanger
										? theme.status(AppStatus.danger).border
										: neutrals.borderLight,
								width: AppSpacings.scale(1),
							),
							borderRadius: BorderRadius.circular(AppBorderRadius.base),
						),
						child: Column(
							mainAxisSize: MainAxisSize.min,
							crossAxisAlignment: CrossAxisAlignment.stretch,
							children: [
								row,
								Padding(
									padding: EdgeInsets.only(
										left: AppSpacings.scale(AppListRowMetrics.paddingStart),
										right: AppSpacings.scale(AppListRowMetrics.paddingStart),
										bottom: AppSpacings.pMd,
									),
									child: bottom!,
								),
							],
						),
					);

		return Opacity(opacity: opacity, child: card);
	}
}
