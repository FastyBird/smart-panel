import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:flutter/material.dart';

/// Action button for maintenance-style actions in settings cards.
class SettingsActionButton extends StatelessWidget {
	final Color color;
	final Color bgColor;

	const SettingsActionButton({
		super.key,
		required this.color,
		required this.bgColor,
	});

	@override
	Widget build(BuildContext context) {
		return Container(
			width: AppSpacings.scale(36),
			height: AppSpacings.scale(36),
			decoration: BoxDecoration(
				color: bgColor,
				borderRadius: BorderRadius.circular(AppSpacings.scale(10)),
			),
			child: Icon(Icons.play_arrow, size: AppFontSize.large, color: color),
		);
	}
}
