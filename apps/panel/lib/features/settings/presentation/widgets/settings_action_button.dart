import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

/// Action button for maintenance-style actions in settings cards.
class SettingsActionButton extends StatelessWidget {
	final Color color;
	final Color bgColor;
	final VoidCallback? onTap;

	const SettingsActionButton({
		super.key,
		required this.color,
		required this.bgColor,
		this.onTap,
	});

	@override
	Widget build(BuildContext context) {
		final radius = BorderRadius.circular(AppSpacings.scale(10));

		return Material(
			color: bgColor,
			borderRadius: radius,
			child: InkWell(
				onTap: onTap,
				borderRadius: radius,
				child: SizedBox(
					width: AppSpacings.scale(36),
					height: AppSpacings.scale(36),
					child: Icon(Icons.play_arrow, size: AppFontSize.large, color: color),
				),
			),
		);
	}
}
