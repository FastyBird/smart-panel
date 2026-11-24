import 'package:fastybird_smart_panel/core/widgets/app_switch.dart';
import 'package:flutter/material.dart';

/// The switch of a settings row: the one [AppSwitch], in the accent.
class SettingsToggle extends StatelessWidget {
	final bool value;
	final ValueChanged<bool>? onChanged;

	/// What the switch turns on, for screen readers.
	final String? semanticLabel;

	const SettingsToggle({
		super.key,
		required this.value,
		this.onChanged,
		this.semanticLabel,
	});

	@override
	Widget build(BuildContext context) {
		return AppSwitch(
			value: value,
			onChanged: onChanged,
			semanticLabel: semanticLabel,
		);
	}
}
