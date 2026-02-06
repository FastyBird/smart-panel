import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class MediaPlaybackCard extends StatelessWidget {
	// Transport button sizes (before scale)
	static const double _mainCompact = 44;
	static const double _regularCompact = 30;
	static const double _mainCompactExpanded = 54;
	static const double _regularCompactExpanded = 42;
	static const double _mainDefault = 48;
	static const double _regularDefault = 36;
	static const double _mainExpanded = 52;
	static const double _regularExpanded = 38;

	// Transport icon sizes (before scale)
	static const double _iconMainCompact = 24;
	static const double _iconRegularCompact = 20;
	static const double _iconMainCompactExpanded = 32;
	static const double _iconRegularCompactExpanded = 24;
	static const double _iconMainDefault = 24;
	static const double _iconRegularDefault = 18;
	static const double _iconMainExpanded = 26;
	static const double _iconRegularExpanded = 19;

	// Progress bar sizes (before scale)
	static const double _progressTimeWidth = 52;
	static const double _progressBarMinHeight = 5;

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
	final ThemeColors themeColor;
	final bool isEnabled;
	final double Function(double) scale;

	const MediaPlaybackCard({
		super.key,
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
		this.themeColor = ThemeColors.primary,
		required this.isEnabled,
		required this.scale,
	});

	bool get _hasPlaybackContent =>
		playbackTrack != null ||
		playbackArtist != null ||
		playbackAlbum != null ||
		playbackAvailableCommands.isNotEmpty ||
		(playbackHasDuration && playbackDuration > 0);

	/// Returns true if the card would display content. Use to conditionally add spacing.
	static bool hasContent({
		String? playbackTrack,
		String? playbackArtist,
		String? playbackAlbum,
		List<MediaPlaybackCommandValue> playbackAvailableCommands = const [],
		bool playbackHasDuration = false,
		int playbackDuration = 0,
	}) =>
		playbackTrack != null ||
		playbackArtist != null ||
		playbackAlbum != null ||
		playbackAvailableCommands.isNotEmpty ||
		(playbackHasDuration && playbackDuration > 0);

	@override
	Widget build(BuildContext context) {
		if (!_hasPlaybackContent) return const SizedBox.shrink();

		final isDark = Theme.of(context).brightness == Brightness.dark;
		final cardColor = isDark ? AppFillColorDark.light : AppFillColorLight.blank;
		final borderColor = isDark ? AppBorderColorDark.light : AppBorderColorLight.darker;

		return AnimatedOpacity(
			opacity: isEnabled ? 1.0 : 0.5,
			duration: const Duration(milliseconds: 200),
			child: Container(
				width: double.infinity,
				padding: AppSpacings.paddingMd,
				decoration: BoxDecoration(
					color: cardColor,
					borderRadius: BorderRadius.circular(AppBorderRadius.base),
					border: Border.all(color: borderColor, width: scale(1)),
				),
				child: Column(
				spacing: AppSpacings.pMd,
				children: [
					_buildNowPlaying(context),
					if (playbackAvailableCommands.isNotEmpty) _buildPlaybackControl(context),
					if (playbackHasDuration && playbackDuration > 0) _buildProgressBar(context),
				],
			),
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
				final defaultTotal = mainCount * scale(_mainDefault) + regularCount * scale(_regularDefault) + gapCount * AppSpacings.pLg;
				final mediumCompactTotal = mainCount * scale(_mainCompactExpanded) + regularCount * scale(_regularCompactExpanded) + gapCount * AppSpacings.pSm;
				final mediumTotal = mainCount * scale(_mainExpanded) + regularCount * scale(_regularExpanded) + gapCount * AppSpacings.pLg;
				final isAtLeastMedium = locator<ScreenService>().isAtLeastMedium;
				final compact = constraints.maxWidth < defaultTotal;
				final compactExpanded = compact && isAtLeastMedium && constraints.maxWidth >= mediumCompactTotal;
				final expanded = !compact && isAtLeastMedium && constraints.maxWidth >= mediumTotal;

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
							compactExpanded: compactExpanded,
							expanded: expanded,
							onTap: !isEnabled || onPlaybackCommand == null
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
		final accentColor = ThemeColorFamily.get(
			isDark ? Brightness.dark : Brightness.light,
			themeColor,
		).base;
		final pos = playbackPosition.toDouble();
		final dur = playbackDuration > 0 ? playbackDuration.toDouble() : 1.0;
		final progress = (pos / dur).clamp(0.0, 1.0);
		final timeWidth = scale(_progressTimeWidth);

		return Row(
			spacing: AppSpacings.pMd,
			children: [
				SizedBox(
					width: timeWidth,
					child: Text(
						_formatTime(playbackPosition),
						style: TextStyle(fontSize: AppFontSize.extraSmall, color: secondaryColor),
					),
				),
				Expanded(
					child: LayoutBuilder(
						builder: (context, constraints) {
							final barWidth = constraints.maxWidth;
							final bar = ClipRRect(
								borderRadius: BorderRadius.circular(AppBorderRadius.base),
								child: LinearProgressIndicator(
									value: progress,
									minHeight: scale(_progressBarMinHeight),
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
		bool compactExpanded = false,
		bool expanded = false,
		VoidCallback? onTap,
	}) {
		final size = scale(isMain
			? (compact ? (compactExpanded ? _mainCompactExpanded : _mainCompact) : (expanded ? _mainExpanded : _mainDefault))
			: (compact ? (compactExpanded ? _regularCompactExpanded : _regularCompact) : (expanded ? _regularExpanded : _regularDefault)));
		final iconSize = scale(isMain
			? (compact ? (compactExpanded ? _iconMainCompactExpanded : _iconMainCompact) : (expanded ? _iconMainExpanded : _iconMainDefault))
			: (compact ? (compactExpanded ? _iconRegularCompactExpanded : _iconRegularCompact) : (expanded ? _iconRegularExpanded : _iconRegularDefault)));
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final brightness = isDark ? Brightness.dark : Brightness.light;
		final (accentTheme, accentFg) = _filledButtonFor(brightness, themeColor);
		final (neutralTheme, neutralFg) = _filledButtonFor(brightness, ThemeColors.neutral);
		final (filledTheme, foregroundColor) = isActive ? (accentTheme, accentFg) : (neutralTheme, neutralFg);
		final themeData = Theme.of(context).copyWith(filledButtonTheme: filledTheme);

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
						color: foregroundColor,
					),
				),
			),
		);
	}

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
