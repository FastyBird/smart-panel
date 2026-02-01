import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class MediaPlaybackCard extends StatelessWidget {
	final String? track;
	final String? artist;
	final String? album;
	final MediaPlaybackStatusValue? status;
	final List<MediaPlaybackCommandValue> availableCommands;
	final bool hasPosition;
	final int position;
	final bool hasDuration;
	final int duration;
	final bool isPositionWritable;
	final bool isEnabled;
	final Color? accentColor;
	final double Function(double) scale;
	final ValueChanged<MediaPlaybackCommandValue>? onCommand;
	final ValueChanged<int>? onSeek;

	const MediaPlaybackCard({
		super.key,
		this.track,
		this.artist,
		this.album,
		this.status,
		this.availableCommands = const [],
		this.hasPosition = false,
		this.position = 0,
		this.hasDuration = false,
		this.duration = 0,
		this.isPositionWritable = false,
		this.isEnabled = true,
		this.accentColor,
		required this.scale,
		this.onCommand,
		this.onSeek,
	});

	@override
	Widget build(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final cardColor = isDark ? AppFillColorDark.light : AppFillColorLight.light;
		final borderColor = isDark ? AppBorderColorDark.light : AppBorderColorLight.light;
		final secondaryColor = isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
		final localizations = AppLocalizations.of(context)!;

		return Container(
			padding: AppSpacings.paddingLg,
			decoration: BoxDecoration(
				color: cardColor,
				borderRadius: BorderRadius.circular(AppBorderRadius.round),
				border: Border.all(color: borderColor, width: scale(1)),
			),
			child: Column(
				crossAxisAlignment: CrossAxisAlignment.stretch,
				children: [
					Row(
						children: [
							Icon(MdiIcons.musicNote, size: AppFontSize.small, color: secondaryColor),
							AppSpacings.spacingSmHorizontal,
							Text(
								localizations.media_detail_now_playing.toUpperCase(),
								style: TextStyle(
									fontSize: AppFontSize.small,
									fontWeight: FontWeight.bold,
									color: isDark ? AppTextColorDark.primary : AppTextColorLight.primary,
								),
							),
						],
					),
					AppSpacings.spacingMdVertical,
					_buildNowPlaying(context),
					if (availableCommands.isNotEmpty) ...[
						AppSpacings.spacingMdVertical,
						_buildPlaybackControl(context),
					],
					if (hasDuration && duration > 0) ...[
						AppSpacings.spacingMdVertical,
						_buildProgressBar(context),
					],
				],
			),
		);
	}

	Widget _buildNowPlaying(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final primaryColor = isDark ? AppTextColorDark.regular : AppTextColorLight.regular;
		final secondaryColor = isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;

		final subtitleParts = <String>[
			if (artist != null) artist!,
			if (album != null) album!,
		];
		final subtitle = subtitleParts.isNotEmpty ? subtitleParts.join(' \u00B7 ') : null;

		return Column(
			crossAxisAlignment: CrossAxisAlignment.stretch,
			children: [
				if (track != null)
					Text(
						track!,
						style: TextStyle(
							fontSize: AppFontSize.small,
							fontWeight: FontWeight.w600,
							color: primaryColor,
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
		final isPlaying = status == MediaPlaybackStatusValue.playing;
		final isPaused = status == MediaPlaybackStatusValue.paused;
		final isStopped = status == MediaPlaybackStatusValue.stopped || status == null;

		final commandSet = availableCommands.toSet();

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
				(MediaPlaybackCommandValue.stop, MdiIcons.stop, false, isStopped && status != null),
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
							onTap: !isEnabled || onCommand == null
								? null
								: () {
									if (cmd == MediaPlaybackCommandValue.play && isPlaying) {
										onCommand!(MediaPlaybackCommandValue.pause);
									} else if (cmd == MediaPlaybackCommandValue.pause && isPaused) {
										onCommand!(MediaPlaybackCommandValue.play);
									} else {
										onCommand!(cmd);
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
		final accent = accentColor ?? (isDark ? AppColorsDark.primary : AppColorsLight.primary);
		final trackColor = isDark ? AppFillColorDark.darker : AppFillColorLight.darker;
		final secondaryColor = isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;

		final pos = position.toDouble();
		final dur = duration > 0 ? duration.toDouble() : 1.0;
		final progress = (pos / dur).clamp(0.0, 1.0);
		final timeWidth = scale(52);

		return Row(
			children: [
				SizedBox(
					width: timeWidth,
					child: Text(
						_formatTime(position),
						style: TextStyle(fontSize: AppFontSize.extraSmall, color: secondaryColor),
					),
				),
				AppSpacings.spacingMdHorizontal,
				Expanded(
					child: LayoutBuilder(
						builder: (context, constraints) {
							final barWidth = constraints.maxWidth;
							final bar = ClipRRect(
								borderRadius: BorderRadius.circular(scale(2)),
								child: LinearProgressIndicator(
									value: progress,
									minHeight: scale(3),
									backgroundColor: trackColor,
									valueColor: AlwaysStoppedAnimation<Color>(accent),
								),
							);

							if (!isPositionWritable || onSeek == null) return bar;

							return GestureDetector(
								behavior: HitTestBehavior.opaque,
								onTapDown: (details) {
									final tapX = details.localPosition.dx;
									final ratio = (tapX / barWidth).clamp(0.0, 1.0);
									final newPos = (ratio * dur).round();
									onSeek!(newPos);
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
						_formatTime(duration),
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
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final accent = accentColor ?? (isDark ? AppColorsDark.primary : AppColorsLight.primary);
		final baseColor = isDark ? AppFillColorDark.base : AppFillColorLight.base;

		final size = scale(isMain ? (compact ? 36 : 48) : (compact ? 28 : 36));
		final iconSize = scale(isMain ? (compact ? 18 : 24) : (compact ? 14 : 18));

		final Color bgColor;
		final Color iconColor;
		final BorderSide borderSide;

		if (isActive) {
			bgColor = accent;
			iconColor = AppColors.white;
			borderSide = BorderSide.none;
		} else {
			bgColor = baseColor;
			iconColor = isDark ? AppTextColorDark.secondary : AppTextColorLight.secondary;
			borderSide = BorderSide(color: isDark ? AppBorderColorDark.light : AppBorderColorLight.light);
		}

		return SizedBox(
			width: size,
			height: size,
			child: Material(
				color: bgColor,
				shape: CircleBorder(side: borderSide),
				child: InkWell(
					onTap: onTap == null
						? null
						: () {
							HapticFeedback.lightImpact();
							onTap();
						},
					customBorder: const CircleBorder(),
					child: Center(
						child: Icon(icon, size: iconSize, color: iconColor),
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
