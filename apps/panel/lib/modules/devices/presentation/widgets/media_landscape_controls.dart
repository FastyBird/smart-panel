import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/universal_tile.dart';
import 'package:fastybird_smart_panel/core/widgets/value_selector.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Shared landscape secondary controls for media device details.
///
/// Renders a vertical column with optional playback button, brightness slider,
/// volume slider, and mute toggle — parameterized by device capabilities.
class MediaLandscapeControls extends StatelessWidget {
	/// Whether the device is currently on/enabled.
	final bool isEnabled;

	/// Theme color for active states and accents.
	final ThemeColors themeColor;

	/// Whether to show the playback button.
	final bool hasPlayback;

	/// Called when the playback button is tapped.
	final VoidCallback? onPlaybackTap;

	/// Whether to show the brightness slider.
	final bool hasBrightness;

	/// Current brightness value (0–100).
	final int? brightness;

	/// Called when brightness is changed.
	final ValueChanged<int>? onBrightnessChanged;

	/// Whether to show volume controls.
	final bool hasSpeaker;

	/// Current volume value (0–100).
	final int? volume;

	/// Called when volume is changed.
	final ValueChanged<int>? onVolumeChanged;

	/// Whether to show the mute toggle.
	final bool hasMute;

	/// Whether the device is currently muted.
	final bool isMuted;

	/// Called when the mute button is tapped.
	final VoidCallback? onMuteTap;

	const MediaLandscapeControls({
		super.key,
		required this.isEnabled,
		required this.themeColor,
		this.hasPlayback = false,
		this.onPlaybackTap,
		this.hasBrightness = false,
		this.brightness,
		this.onBrightnessChanged,
		this.hasSpeaker = false,
		this.volume,
		this.onVolumeChanged,
		this.hasMute = false,
		this.isMuted = false,
		this.onMuteTap,
	});

	@override
	Widget build(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final localizations = AppLocalizations.of(context)!;
		final colorFamily = ThemeColorFamily.get(
			isDark ? Brightness.dark : Brightness.light,
			themeColor,
		);
		final tileHeight = AppSpacings.scale(AppTileHeight.horizontal);

		return Column(
			crossAxisAlignment: CrossAxisAlignment.start,
			spacing: AppSpacings.pMd,
			children: [
				if (hasPlayback)
					SizedBox(
						height: tileHeight,
						width: double.infinity,
						child: UniversalTile(
							layout: TileLayout.horizontal,
							icon: MdiIcons.playCircle,
							name: localizations.media_playback,
							isActive: false,
							activeColor: themeColor,
							onTileTap: isEnabled ? () {
								HapticFeedback.lightImpact();
								onPlaybackTap?.call();
							} : null,
							showGlow: false,
							showDoubleBorder: false,
							showInactiveBorder: true,
						),
					),
				if (hasBrightness)
					SizedBox(
						height: tileHeight,
						width: double.infinity,
						child: ValueSelectorRow<int>(
							currentValue: brightness,
							label: localizations.light_mode_brightness,
							icon: MdiIcons.brightnessPercent,
							sheetTitle: localizations.light_mode_brightness,
							activeColor: colorFamily.base,
							options: [0, 25, 50, 75, 100]
									.map((v) => ValueOption<int>(
										value: v,
										label: '$v%',
									))
									.toList(),
							displayFormatter: (v) => '${v ?? 0}%',
							columns: 5,
							layout: ValueSelectorRowLayout.compact,
							sliderMin: 0.0,
							sliderMax: 100.0,
							sliderUnit: '%',
							onChanged: isEnabled ? (v) {
								if (v != null) onBrightnessChanged?.call(v);
							} : null,
						),
					),
				if (hasSpeaker) ...[
					SizedBox(
						height: tileHeight,
						width: double.infinity,
						child: ValueSelectorRow<int>(
							currentValue: volume,
							label: localizations.media_volume,
							icon: MdiIcons.volumeHigh,
							sheetTitle: localizations.media_volume,
							activeColor: colorFamily.base,
							options: [0, 25, 50, 75, 100]
									.map((v) => ValueOption<int>(
										value: v,
										label: '$v%',
									))
									.toList(),
							displayFormatter: (v) => '${v ?? 0}%',
							columns: 5,
							layout: ValueSelectorRowLayout.compact,
							sliderMin: 0.0,
							sliderMax: 100.0,
							sliderUnit: '%',
							onChanged: isEnabled ? (v) {
								if (v != null) onVolumeChanged?.call(v);
							} : null,
						),
					),
					if (hasMute)
						SizedBox(
							height: tileHeight,
							width: double.infinity,
							child: UniversalTile(
								layout: TileLayout.horizontal,
								icon: isMuted ? MdiIcons.volumeOff : MdiIcons.volumeHigh,
								name: localizations.media_action_mute,
								status: isMuted
										? localizations.on_state_on
										: localizations.on_state_off,
								isActive: isMuted,
								activeColor: themeColor,
								onTileTap: isEnabled ? () {
									HapticFeedback.lightImpact();
									onMuteTap?.call();
								} : null,
								showGlow: false,
								showDoubleBorder: false,
								showInactiveBorder: true,
							),
						),
				],
			],
		);
	}
}
