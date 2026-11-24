import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/app_slider.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// The slider of a settings row: the one [AppSlider], in the accent, between
/// a small and a large icon. Value range is 0.0 to 1.0.
class SettingsSlider extends StatelessWidget {
	final double value;
	final IconData iconSmall;
	final IconData iconLarge;
	final ValueChanged<double>? onChanged;

	/// Called when a drag or tap ends, with the final value.
	final ValueChanged<double>? onChangeEnd;

	/// What the slider sets, for screen readers ("Brightness").
	final String? semanticLabel;

	const SettingsSlider({
		super.key,
		required this.value,
		required this.iconSmall,
		required this.iconLarge,
		this.onChanged,
		this.onChangeEnd,
		this.semanticLabel,
	});

	@override
	Widget build(BuildContext context) {
		final hintColor = Theme.of(context).neutrals.textSecondary;

		return Row(
			spacing: AppSpacings.pMd,
			children: [
				Icon(iconSmall, size: AppSpacings.scale(14), color: hintColor),
				Expanded(
					child: AppSlider(
						value: value,
						onChanged: onChanged,
						onChangeStart: (_) => HapticFeedback.lightImpact(),
						onChangeEnd: onChangeEnd,
						semanticLabel: semanticLabel,
					),
				),
				Icon(iconLarge, size: AppSpacings.scale(18), color: hintColor),
			],
		);
	}
}
