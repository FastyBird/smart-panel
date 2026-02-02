import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/mode_selector.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class MediaInfoCard extends StatelessWidget {
	final IconData icon;
	final Color iconColor;
	final Color iconBgColor;
	final String name;
	final bool isOn;
	final String? displaySource;
	final Color accentColor;
	final double Function(double) scale;
	/// Optional playback section (track, controls, progress) shown between status and input.
	final String? playbackTrack;
	final String? playbackArtist;
	final String? playbackAlbum;
	final MediaPlaybackStatusValue? playbackStatus;
	final List<MediaPlaybackCommandValue> playbackAvailableCommands;
	final bool playbackHasPosition;
	final int playbackPosition;
	final bool playbackHasDuration;
	final int playbackDuration;
	final bool playbackIsPositionWritable;
	final ValueChanged<MediaPlaybackCommandValue>? onPlaybackCommand;
	final ValueChanged<int>? onPlaybackSeek;
	/// When non-null and non-empty, shows the input source selector inside this card.
	final List<String>? availableSources;
	final String? currentSource;
	final String Function(String)? sourceLabel;
	final ValueChanged<String>? onSourceChanged;

	const MediaInfoCard({
		super.key,
		required this.icon,
		required this.iconColor,
		required this.iconBgColor,
		required this.name,
		required this.isOn,
		this.displaySource,
		required this.accentColor,
		required this.scale,
		this.playbackTrack,
		this.playbackArtist,
		this.playbackAlbum,
		this.playbackStatus,
		this.playbackAvailableCommands = const [],
		this.playbackHasPosition = false,
		this.playbackPosition = 0,
		this.playbackHasDuration = false,
		this.playbackDuration = 0,
		this.playbackIsPositionWritable = false,
		this.onPlaybackCommand,
		this.onPlaybackSeek,
		this.availableSources,
		this.currentSource,
		this.sourceLabel,
		this.onSourceChanged,
	});

	bool get _hasPlaybackContent =>
		playbackTrack != null ||
		playbackArtist != null ||
		playbackAlbum != null ||
		playbackAvailableCommands.isNotEmpty ||
		(playbackHasDuration && playbackDuration > 0);

	@override
	Widget build(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final localizations = AppLocalizations.of(context)!;
		final cardColor = isDark ? AppFillColorDark.light : AppFillColorLight.light;
		final borderColor = isDark ? AppBorderColorDark.light : AppBorderColorLight.light;
		final secondaryColor = isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;

		return Container(
			width: double.infinity,
			padding: AppSpacings.paddingLg,
			decoration: BoxDecoration(
				color: cardColor,
				borderRadius: BorderRadius.circular(AppBorderRadius.base),
				border: Border.all(color: borderColor, width: scale(1)),
			),
			child: Column(
				children: [
					Container(
						width: scale(64),
						height: scale(64),
						decoration: BoxDecoration(
							color: iconBgColor,
							borderRadius: BorderRadius.circular(AppBorderRadius.base),
						),
						child: Icon(
							icon,
							color: iconColor,
							size: scale(32),
						),
					),
					AppSpacings.spacingMdVertical,
					Text(
						name,
						style: TextStyle(
							fontSize: AppFontSize.base,
							fontWeight: FontWeight.w600,
							color: isDark ? AppTextColorDark.primary : AppTextColorLight.primary,
						),
					),
					AppSpacings.spacingSmVertical,
					Row(
						mainAxisAlignment: MainAxisAlignment.center,
						mainAxisSize: MainAxisSize.min,
						children: [
							Container(
								width: scale(8),
								height: scale(8),
								decoration: BoxDecoration(
									color: isOn
										? (isDark ? AppColorsDark.success : AppColorsLight.success)
										: secondaryColor,
									shape: BoxShape.circle,
								),
							),
							AppSpacings.spacingSmHorizontal,
							Text(
								isOn ? localizations.on_state_on : localizations.on_state_off,
								style: TextStyle(
									fontSize: AppFontSize.extraSmall,
									color: secondaryColor,
								),
							),
							if (displaySource != null) ...[
								Padding(
									padding: EdgeInsets.symmetric(horizontal: AppSpacings.pSm),
									child: Text(
										'·',
										style: TextStyle(
											fontSize: AppFontSize.extraSmall,
											fontWeight: FontWeight.bold,
											color: secondaryColor,
										),
									),
								),
								Text(
									displaySource!,
									style: TextStyle(
										fontSize: AppFontSize.extraSmall,
										color: secondaryColor,
									),
								),
							],
						],
					),
					if (_hasPlaybackContent) ...[
            AppSpacings.spacingLgVertical,
            Container(
              width: double.infinity,
              padding: AppSpacings.paddingMd,
              decoration: BoxDecoration(
                color: isDark ? AppFillColorDark.darker : AppFillColorLight.darker,
                borderRadius: BorderRadius.circular(AppBorderRadius.base),
              ),
              child: Column(
                children: [
                  _buildNowPlaying(context),
                  if (playbackAvailableCommands.isNotEmpty) ...[
                    AppSpacings.spacingMdVertical,
                    _buildPlaybackControl(context),
                  ],
                  if (playbackHasDuration && playbackDuration > 0) ...[
                    AppSpacings.spacingMdVertical,
                    _buildProgressBar(context),
                  ],
                ],
              ),
            ),
					],
					if (availableSources != null &&
							availableSources!.isNotEmpty &&
							sourceLabel != null &&
							onSourceChanged != null) ...[
						AppSpacings.spacingLgVertical,
						ModeSelector<String>(
							modes: availableSources!
								.map((s) => ModeOption<String>(
									value: s,
									icon: MdiIcons.videoInputHdmi,
									label: sourceLabel!(s),
								))
								.toList(),
							selectedValue: currentSource,
							onChanged: isOn ? onSourceChanged! : (_) {},
							orientation: ModeSelectorOrientation.horizontal,
							color: ModeSelectorColor.info,
							showIcon: false,
							scrollable: true,
						),
					],
				],
			),
		);
	}

	Widget _buildNowPlaying(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final activeColor = isDark ? AppTextColorDark.regular : AppTextColorLight.regular;
		final secondaryColor = isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
		final subtitleParts = <String>[
			if (playbackArtist != null) playbackArtist!,
			if (playbackAlbum != null) playbackAlbum!,
		];
		final subtitle = subtitleParts.isNotEmpty ? subtitleParts.join(' \u00B7 ') : null;

		return Column(
			crossAxisAlignment: CrossAxisAlignment.stretch,
			children: [
				if (playbackTrack != null)
					Text(
						playbackTrack!,
						style: TextStyle(
							fontSize: AppFontSize.small,
							fontWeight: FontWeight.w600,
							color: activeColor,
						),
						maxLines: 1,
						overflow: TextOverflow.ellipsis,
						textAlign: TextAlign.center,
					),
				if (subtitle != null)
					Text(
						subtitle,
						style: TextStyle(
							fontSize: AppFontSize.extraSmall,
							color: secondaryColor,
						),
						maxLines: 1,
						overflow: TextOverflow.ellipsis,
						textAlign: TextAlign.center,
					),
			],
		);
	}

	Widget _buildPlaybackControl(BuildContext context) {
		final isPlaying = playbackStatus == MediaPlaybackStatusValue.playing;
		final isPaused = playbackStatus == MediaPlaybackStatusValue.paused;
		final isStopped = playbackStatus == MediaPlaybackStatusValue.stopped || playbackStatus == null;
		final commandSet = playbackAvailableCommands.toSet();
		final specs = <(MediaPlaybackCommandValue, IconData, bool, bool)>[
			if (commandSet.contains(MediaPlaybackCommandValue.previous))
				(MediaPlaybackCommandValue.previous, MdiIcons.skipPrevious, false, false),
			if (commandSet.contains(MediaPlaybackCommandValue.rewind))
				(MediaPlaybackCommandValue.rewind, MdiIcons.rewind, false, false),
			if (commandSet.contains(MediaPlaybackCommandValue.play))
				(MediaPlaybackCommandValue.play, MdiIcons.play, true, isPlaying),
			if (commandSet.contains(MediaPlaybackCommandValue.pause))
				(MediaPlaybackCommandValue.pause, MdiIcons.pause, false, isPaused),
			if (commandSet.contains(MediaPlaybackCommandValue.stop))
				(MediaPlaybackCommandValue.stop, MdiIcons.stop, false, isStopped && playbackStatus != null),
			if (commandSet.contains(MediaPlaybackCommandValue.fastForward))
				(MediaPlaybackCommandValue.fastForward, MdiIcons.fastForward, false, false),
			if (commandSet.contains(MediaPlaybackCommandValue.next))
				(MediaPlaybackCommandValue.next, MdiIcons.skipNext, false, false),
		];
		if (specs.isEmpty) return const SizedBox.shrink();

		return LayoutBuilder(
			builder: (context, constraints) {
				final mainCount = specs.where((s) => s.$3).length;
				final regularCount = specs.length - mainCount;
				final gapCount = specs.length - 1;
				final defaultTotal = mainCount * scale(48) + regularCount * scale(36) + gapCount * AppSpacings.pLg;
				final compact = constraints.maxWidth < defaultTotal;

				return Row(
					mainAxisAlignment: MainAxisAlignment.center,
					spacing: compact ? AppSpacings.pSm : AppSpacings.pLg,
					children: specs.map((spec) {
						final (cmd, icon, isMain, isActive) = spec;
						return _buildTransportButton(
							context,
							icon: icon,
							isMain: isMain,
							isActive: isActive,
							compact: compact,
							onTap: !isOn || onPlaybackCommand == null
								? null
								: () {
									if (cmd == MediaPlaybackCommandValue.play && isPlaying) {
										onPlaybackCommand!(MediaPlaybackCommandValue.pause);
									} else if (cmd == MediaPlaybackCommandValue.pause && isPaused) {
										onPlaybackCommand!(MediaPlaybackCommandValue.play);
									} else {
										onPlaybackCommand!(cmd);
									}
								},
						);
					}).toList(),
				);
			},
		);
	}

	Widget _buildProgressBar(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final trackColor = isDark ? AppFillColorDark.darker : AppFillColorLight.darker;
		final secondaryColor = isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
		final pos = playbackPosition.toDouble();
		final dur = playbackDuration > 0 ? playbackDuration.toDouble() : 1.0;
		final progress = (pos / dur).clamp(0.0, 1.0);
		final timeWidth = scale(52);

		return Row(
			children: [
				SizedBox(
					width: timeWidth,
					child: Text(
						_formatTime(playbackPosition),
						style: TextStyle(fontSize: AppFontSize.extraSmall, color: secondaryColor),
					),
				),
				AppSpacings.spacingMdHorizontal,
				Expanded(
					child: LayoutBuilder(
						builder: (context, constraints) {
							final barWidth = constraints.maxWidth;
							final bar = ClipRRect(
								borderRadius: BorderRadius.circular(AppBorderRadius.base),
								child: LinearProgressIndicator(
									value: progress,
									minHeight: scale(3),
									backgroundColor: trackColor,
									valueColor: AlwaysStoppedAnimation<Color>(accentColor),
								),
							);
							if (!playbackIsPositionWritable || onPlaybackSeek == null) return bar;
							return GestureDetector(
								behavior: HitTestBehavior.opaque,
								onTapDown: (details) {
									final tapX = details.localPosition.dx;
									final ratio = (tapX / barWidth).clamp(0.0, 1.0);
									final newPos = (ratio * dur).round();
									onPlaybackSeek!(newPos);
								},
								child: Padding(
									padding: EdgeInsets.symmetric(vertical: AppSpacings.pLg),
									child: bar,
								),
							);
						},
					),
				),
				AppSpacings.spacingMdHorizontal,
				SizedBox(
					width: timeWidth,
					child: Text(
						_formatTime(playbackDuration),
						style: TextStyle(fontSize: AppFontSize.extraSmall, color: secondaryColor),
						textAlign: TextAlign.right,
					),
				),
			],
		);
	}

	Widget _buildTransportButton(
		BuildContext context, {
		required IconData icon,
		bool isMain = false,
		bool isActive = false,
		bool compact = false,
		VoidCallback? onTap,
	}) {
		final size = scale(isMain ? (compact ? 34 : 48) : (compact ? 24 : 36));
		final iconSize = scale(isMain ? (compact ? 18 : 24) : (compact ? 14 : 18));
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final themeData = isActive
			? (isDark
				? ThemeData(brightness: Brightness.dark, filledButtonTheme: AppFilledButtonsDarkThemes.info)
				: ThemeData(filledButtonTheme: AppFilledButtonsLightThemes.info))
			: (isDark
				? ThemeData(brightness: Brightness.dark, filledButtonTheme: AppFilledButtonsDarkThemes.neutral)
				: ThemeData(filledButtonTheme: AppFilledButtonsLightThemes.base));

		return SizedBox(
			width: size,
			height: size,
			child: Theme(
				data: themeData,
				child: FilledButton(
					onPressed: onTap == null
						? null
						: () {
							HapticFeedback.lightImpact();
							onTap();
						},
					style: FilledButton.styleFrom(
						padding: EdgeInsets.zero,
						minimumSize: Size(size, size),
						maximumSize: Size(size, size),
						shape: const CircleBorder(),
						tapTargetSize: MaterialTapTargetSize.shrinkWrap,
					),
					child: Icon(
						icon,
						size: iconSize,
						color: isDark
							? (isActive
								? AppFilledButtonsDarkThemes.infoForegroundColor
								: AppFilledButtonsDarkThemes.neutralForegroundColor)
							: (isActive
								? AppFilledButtonsLightThemes.infoForegroundColor
								: AppFilledButtonsLightThemes.baseForegroundColor),
					),
				),
			),
		);
	}

	static String _formatTime(int totalSeconds) {
		final hours = totalSeconds ~/ 3600;
		final minutes = (totalSeconds % 3600) ~/ 60;
		final seconds = totalSeconds % 60;
		if (hours > 0) {
			return '$hours:${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
		}
		return '${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}';
	}
}
