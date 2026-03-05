import 'package:flutter/material.dart';

import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/modules/buddy/services/wake_word_service.dart';

/// Visual indicator for wake word detection state.
///
/// Shows as a small animated overlay at the top of the deck screen:
/// - Pulsing microphone icon when listening
/// - Red recording indicator when capturing speech
/// - Spinning indicator when processing through STT
///
/// Only visible when the wake word engine is running.
class WakeWordIndicator extends StatefulWidget {
	final WakeWordService wakeWordService;

	const WakeWordIndicator({
		super.key,
		required this.wakeWordService,
	});

	@override
	State<WakeWordIndicator> createState() => _WakeWordIndicatorState();
}

class _WakeWordIndicatorState extends State<WakeWordIndicator>
		with SingleTickerProviderStateMixin {
	late final AnimationController _pulseController;
	late final Animation<double> _pulseAnimation;

	@override
	void initState() {
		super.initState();

		_pulseController = AnimationController(
			vsync: this,
			duration: const Duration(milliseconds: 1200),
		);

		_pulseAnimation = Tween<double>(begin: 0.4, end: 1.0).animate(
			CurvedAnimation(
				parent: _pulseController,
				curve: Curves.easeInOut,
			),
		);

		widget.wakeWordService.addListener(_onStateChanged);
		_updateAnimation();
	}

	@override
	void didUpdateWidget(WakeWordIndicator oldWidget) {
		super.didUpdateWidget(oldWidget);

		if (oldWidget.wakeWordService != widget.wakeWordService) {
			oldWidget.wakeWordService.removeListener(_onStateChanged);
			widget.wakeWordService.addListener(_onStateChanged);
			_updateAnimation();
		}
	}

	void _onStateChanged() {
		if (!mounted) return;

		_updateAnimation();
		setState(() {});
	}

	void _updateAnimation() {
		final state = widget.wakeWordService.state;

		if (state == WakeWordState.listening) {
			// Slow pulse when listening
			_pulseController.repeat(reverse: true);
		} else if (state == WakeWordState.recording) {
			// Fast pulse when recording
			_pulseController.duration = const Duration(milliseconds: 600);
			_pulseController.repeat(reverse: true);
		} else {
			_pulseController.duration = const Duration(milliseconds: 1200);
			_pulseController.stop();
			_pulseController.value = 1.0;
		}
	}

	@override
	void dispose() {
		widget.wakeWordService.removeListener(_onStateChanged);
		_pulseController.dispose();
		super.dispose();
	}

	@override
	Widget build(BuildContext context) {
		final state = widget.wakeWordService.state;

		if (state == WakeWordState.stopped) {
			return const SizedBox.shrink();
		}

		final isDark = Theme.of(context).brightness == Brightness.dark;

		return AnimatedBuilder(
			animation: _pulseAnimation,
			builder: (context, child) {
				return Opacity(
					opacity: state == WakeWordState.listening
						? _pulseAnimation.value
						: 1.0,
					child: _buildIndicator(context, isDark, state),
				);
			},
		);
	}

	Widget _buildIndicator(BuildContext context, bool isDark, WakeWordState state) {
		final Color iconColor;
		final Color bgColor;
		final IconData icon;
		final String label;

		switch (state) {
			case WakeWordState.listening:
				iconColor = isDark ? AppColorsDark.info : AppColorsLight.info;
				bgColor = (isDark ? AppColorsDark.infoLight5 : AppColorsLight.infoLight9)
					.withValues(alpha: 0.9);
				icon = Icons.mic_none;
				label = 'Listening...';
			case WakeWordState.recording:
				iconColor = isDark ? AppColorsDark.danger : AppColorsLight.danger;
				bgColor = (isDark ? AppColorsDark.dangerLight5 : AppColorsLight.dangerLight9)
					.withValues(alpha: 0.9);
				icon = Icons.mic;
				final seconds = widget.wakeWordService.recordingDuration.inSeconds;
				final maxSeconds = widget.wakeWordService.config.maxRecordingDurationSec;
				label = 'Recording ${seconds}s / ${maxSeconds}s';
			case WakeWordState.processing:
				iconColor = isDark ? AppColorsDark.warning : AppColorsLight.warning;
				bgColor = (isDark ? AppColorsDark.warningLight5 : AppColorsLight.warningLight9)
					.withValues(alpha: 0.9);
				icon = Icons.hearing;
				label = 'Processing...';
			case WakeWordState.stopped:
				return const SizedBox.shrink();
		}

		return Container(
			padding: EdgeInsets.symmetric(
				horizontal: AppSpacings.pMd,
				vertical: AppSpacings.pXs,
			),
			decoration: BoxDecoration(
				color: bgColor,
				borderRadius: BorderRadius.circular(AppBorderRadius.round),
			),
			child: Row(
				mainAxisSize: MainAxisSize.min,
				children: [
					if (state == WakeWordState.processing)
						SizedBox(
							width: AppSpacings.scale(14),
							height: AppSpacings.scale(14),
							child: CircularProgressIndicator(
								strokeWidth: 2,
								color: iconColor,
							),
						)
					else
						Icon(
							icon,
							size: AppSpacings.scale(14),
							color: iconColor,
						),
					SizedBox(width: AppSpacings.pXs),
					Text(
						label,
						style: TextStyle(
							fontSize: AppFontSize.extraSmall,
							color: iconColor,
							fontWeight: FontWeight.w500,
						),
					),
				],
			),
		);
	}
}
