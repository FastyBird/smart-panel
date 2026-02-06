import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/card_slider.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class MediaVolumeCard extends StatelessWidget {
	final int volume;
	final bool isMuted;
	final bool hasMute;
	final bool isEnabled;
	final ThemeColors themeColor;
	final ValueChanged<int> onVolumeChanged;
	final VoidCallback? onMuteToggle;

	const MediaVolumeCard({
		super.key,
		required this.volume,
		required this.isMuted,
		required this.hasMute,
		required this.isEnabled,
		this.themeColor = ThemeColors.primary,
		required this.onVolumeChanged,
		this.onMuteToggle,
	});

	static (FilledButtonThemeData theme, Color foreground) _filledButtonFor(
		Brightness brightness,
		ThemeColors key,
	) {
		final isDark = brightness == Brightness.dark;
		if (isDark) {
			switch (key) {
				case ThemeColors.primary:
					return (AppFilledButtonsDarkThemes.primary, AppFilledButtonsDarkThemes.primaryForegroundColor);
				case ThemeColors.success:
					return (AppFilledButtonsDarkThemes.success, AppFilledButtonsDarkThemes.successForegroundColor);
				case ThemeColors.warning:
					return (AppFilledButtonsDarkThemes.warning, AppFilledButtonsDarkThemes.warningForegroundColor);
				case ThemeColors.danger:
					return (AppFilledButtonsDarkThemes.danger, AppFilledButtonsDarkThemes.dangerForegroundColor);
				case ThemeColors.error:
					return (AppFilledButtonsDarkThemes.error, AppFilledButtonsDarkThemes.errorForegroundColor);
				case ThemeColors.info:
					return (AppFilledButtonsDarkThemes.info, AppFilledButtonsDarkThemes.infoForegroundColor);
				case ThemeColors.neutral:
					return (AppFilledButtonsDarkThemes.neutral, AppFilledButtonsDarkThemes.neutralForegroundColor);
				case ThemeColors.flutter:
					return (AppFilledButtonsDarkThemes.flutter, AppFilledButtonsDarkThemes.flutterForegroundColor);
				case ThemeColors.teal:
					return (AppFilledButtonsDarkThemes.teal, AppFilledButtonsDarkThemes.tealForegroundColor);
				case ThemeColors.cyan:
					return (AppFilledButtonsDarkThemes.cyan, AppFilledButtonsDarkThemes.cyanForegroundColor);
				case ThemeColors.pink:
					return (AppFilledButtonsDarkThemes.pink, AppFilledButtonsDarkThemes.pinkForegroundColor);
				case ThemeColors.indigo:
					return (AppFilledButtonsDarkThemes.indigo, AppFilledButtonsDarkThemes.indigoForegroundColor);
			}
		} else {
			switch (key) {
				case ThemeColors.primary:
					return (AppFilledButtonsLightThemes.primary, AppFilledButtonsLightThemes.primaryForegroundColor);
				case ThemeColors.success:
					return (AppFilledButtonsLightThemes.success, AppFilledButtonsLightThemes.successForegroundColor);
				case ThemeColors.warning:
					return (AppFilledButtonsLightThemes.warning, AppFilledButtonsLightThemes.warningForegroundColor);
				case ThemeColors.danger:
					return (AppFilledButtonsLightThemes.danger, AppFilledButtonsLightThemes.dangerForegroundColor);
				case ThemeColors.error:
					return (AppFilledButtonsLightThemes.error, AppFilledButtonsLightThemes.errorForegroundColor);
				case ThemeColors.info:
					return (AppFilledButtonsLightThemes.info, AppFilledButtonsLightThemes.infoForegroundColor);
				case ThemeColors.neutral:
					return (AppFilledButtonsLightThemes.neutral, AppFilledButtonsLightThemes.neutralForegroundColor);
				case ThemeColors.flutter:
					return (AppFilledButtonsLightThemes.flutter, AppFilledButtonsLightThemes.flutterForegroundColor);
				case ThemeColors.teal:
					return (AppFilledButtonsLightThemes.teal, AppFilledButtonsLightThemes.tealForegroundColor);
				case ThemeColors.cyan:
					return (AppFilledButtonsLightThemes.cyan, AppFilledButtonsLightThemes.cyanForegroundColor);
				case ThemeColors.pink:
					return (AppFilledButtonsLightThemes.pink, AppFilledButtonsLightThemes.pinkForegroundColor);
				case ThemeColors.indigo:
					return (AppFilledButtonsLightThemes.indigo, AppFilledButtonsLightThemes.indigoForegroundColor);
			}
		}
	}

	@override
	Widget build(BuildContext context) {
		final localizations = AppLocalizations.of(context)!;
		final brightness = Theme.of(context).brightness;
		final isDark = brightness == Brightness.dark;
		final screenService = locator<ScreenService>();
		final visualDensityService = locator<VisualDensityService>();
		final scale = (double v) => screenService.scale(v, density: visualDensityService.density);
		final columnWidth = scale(40);
		final textColor = isDark ? AppTextColorDark.primary : AppTextColorLight.primary;

		final (muteTheme, muteFg) = _filledButtonFor(brightness, isMuted ? themeColor : ThemeColors.neutral);

		final leading = hasMute
			? SizedBox(
					width: columnWidth,
					child: Theme(
						data: Theme.of(context).copyWith(filledButtonTheme: muteTheme),
						child: FilledButton(
							onPressed: isEnabled ? () { HapticFeedback.lightImpact(); onMuteToggle?.call(); } : null,
							style: FilledButton.styleFrom(padding: AppSpacings.paddingMd),
							child: Icon(
								isMuted ? MdiIcons.volumeOff : MdiIcons.volumeHigh,
								size: AppFontSize.large,
								color: muteFg,
							),
						),
					),
				)
			: null;

		final trailing = SizedBox(
			width: columnWidth,
			child: Text(
				localizations.media_volume_percent(volume),
				style: TextStyle(
					fontSize: AppFontSize.small,
					fontWeight: FontWeight.w600,
					color: textColor,
				),
				textAlign: TextAlign.right,
			),
		);

		return CardSlider(
			label: localizations.media_volume,
			icon: MdiIcons.speaker,
			value: volume / 100,
			onChanged: (val) => onVolumeChanged((val * 100).round()),
			discrete: false,
			showSteps: false,
			showHeaderValue: false,
			enabled: isEnabled,
			themeColor: themeColor,
			leading: leading,
			trailing: trailing,
		);
	}
}
