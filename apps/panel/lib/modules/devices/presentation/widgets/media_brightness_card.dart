import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/card_slider.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class MediaBrightnessCard extends StatelessWidget {
	final int brightness;
	final bool isEnabled;
	final ThemeColors themeColor;
	final ValueChanged<int> onBrightnessChanged;

	const MediaBrightnessCard({
		super.key,
		required this.brightness,
		required this.isEnabled,
		this.themeColor = ThemeColors.primary,
		required this.onBrightnessChanged,
	});

	@override
	Widget build(BuildContext context) {
		final localizations = AppLocalizations.of(context)!;

		return CardSlider(
			label: localizations.light_mode_brightness,
			icon: MdiIcons.brightnessPercent,
			value: brightness / 100,
			onChanged: (val) => onBrightnessChanged((val * 100).round()),
			discrete: false,
			showSteps: false,
			enabled: isEnabled,
			themeColor: themeColor,
			steps: const ['0%', '25%', '50%', '75%', '100%'],
		);
	}
}
