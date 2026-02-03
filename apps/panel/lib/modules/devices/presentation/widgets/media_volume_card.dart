import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/slider_with_steps.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class MediaVolumeCard extends StatelessWidget {
	final int volume;
	final bool isMuted;
	final bool hasMute;
	final bool isEnabled;
	final ThemeColors themeColor;
	final ValueChanged<int> onVolumeChanged;
	final VoidCallback? onMuteToggle;
	final double Function(double) scale;

	const MediaVolumeCard({
		super.key,
		required this.volume,
		required this.isMuted,
		required this.hasMute,
		required this.isEnabled,
		this.themeColor = ThemeColors.primary,
		required this.onVolumeChanged,
		this.onMuteToggle,
		required this.scale,
	});

	@override
	Widget build(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final localizations = AppLocalizations.of(context)!;
		final cardColor = isDark ? AppFillColorDark.light : AppFillColorLight.light;
		final borderColor = isDark ? AppBorderColorDark.light : AppBorderColorLight.light;
		final columnWidth = scale(40);

		return Container(
			padding: AppSpacings.paddingLg,
			decoration: BoxDecoration(
				color: cardColor,
				borderRadius: BorderRadius.circular(AppBorderRadius.base),
				border: Border.all(color: borderColor, width: scale(1)),
			),
			child: Column(
				crossAxisAlignment: CrossAxisAlignment.start,
				children: [
					Row(
						children: [
							Icon(MdiIcons.speaker, size: AppFontSize.small, color: isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary),
							AppSpacings.spacingSmHorizontal,
							Text(
								localizations.media_volume.toUpperCase(),
								style: TextStyle(fontSize: AppFontSize.small, fontWeight: FontWeight.bold, color: isDark ? AppTextColorDark.primary : AppTextColorLight.primary),
							),
						],
					),
					AppSpacings.spacingMdVertical,
					Row(
						children: [
							if (hasMute) ...[
								SizedBox(
									width: columnWidth,
									child: Theme(
                  data: isDark
                      ? (isMuted
                          ? ThemeData(filledButtonTheme: AppFilledButtonsDarkThemes.info)
                          : ThemeData(filledButtonTheme: AppFilledButtonsDarkThemes.neutral))
                      : ThemeData(
                          filledButtonTheme: isMuted
                              ? AppFilledButtonsLightThemes.info
                              : AppFilledButtonsLightThemes.neutral,
                        ),
                    child: FilledButton(
                      onPressed: isEnabled ? onMuteToggle : null,
                      style: FilledButton.styleFrom(
                        padding: AppSpacings.paddingMd,
                      ),
                      child: Icon(
                        isMuted ? MdiIcons.volumeOff : MdiIcons.volumeHigh,
                        size: AppFontSize.large,
                        color: isDark
                            ? (isMuted
                                ? AppFilledButtonsDarkThemes.infoForegroundColor
                                : AppFilledButtonsDarkThemes.neutralForegroundColor)
                            : (isMuted
                                ? AppFilledButtonsLightThemes.infoForegroundColor
                                : AppFilledButtonsLightThemes.neutralForegroundColor),
                      ),
                    ),
                  ),
								),
								AppSpacings.spacingMdHorizontal,
							],
							Expanded(
								child: SliderWithSteps(
									value: volume / 100,
									themeColor: themeColor,
									showSteps: false,
									enabled: isEnabled,
									onChanged: (val) => onVolumeChanged((val * 100).round()),
								),
							),
							AppSpacings.spacingMdHorizontal,
							SizedBox(
								width: columnWidth,
								child: Text(
									localizations.media_volume_percent(volume),
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
