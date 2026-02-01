import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/slider_with_steps.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class MediaBrightnessCard extends StatelessWidget {
	final int brightness;
	final bool isEnabled;
	final Color accentColor;
	final ValueChanged<int> onBrightnessChanged;
	final double Function(double) scale;

	const MediaBrightnessCard({
		super.key,
		required this.brightness,
		required this.isEnabled,
		required this.accentColor,
		required this.onBrightnessChanged,
		required this.scale,
	});

	@override
	Widget build(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final localizations = AppLocalizations.of(context)!;
		final cardColor = isDark ? AppFillColorDark.light : AppFillColorLight.light;
		final borderColor = isDark ? AppBorderColorDark.light : AppBorderColorLight.light;

		return Container(
			padding: AppSpacings.paddingLg,
			decoration: BoxDecoration(
				color: cardColor,
				borderRadius: BorderRadius.circular(AppBorderRadius.round),
				border: Border.all(color: borderColor, width: scale(1)),
			),
			child: Column(
				crossAxisAlignment: CrossAxisAlignment.start,
				children: [
					Row(
						children: [
							Icon(MdiIcons.brightnessPercent, size: AppFontSize.small, color: isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary),
							AppSpacings.spacingSmHorizontal,
							Text(
								localizations.light_mode_brightness.toUpperCase(),
								style: TextStyle(fontSize: AppFontSize.small, fontWeight: FontWeight.bold, color: isDark ? AppTextColorDark.primary : AppTextColorLight.primary),
							),
						],
					),
					AppSpacings.spacingMdVertical,
					Row(
						children: [
							Expanded(
								child: SliderWithSteps(
									value: brightness / 100,
									activeColor: accentColor,
									showSteps: false,
									enabled: isEnabled,
									onChanged: (val) => onBrightnessChanged((val * 100).round()),
								),
							),
							AppSpacings.spacingMdHorizontal,
							SizedBox(
								width: scale(40),
								child: Text(
									'$brightness%',
									style: TextStyle(
										fontSize: AppFontSize.small,
										fontWeight: FontWeight.w600,
										color: isDark ? AppTextColorDark.primary : AppTextColorLight.primary,
									),
									textAlign: TextAlign.right,
								),
							),
						],
					),
				],
			),
		);
	}
}
