import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/buddy/services/voice_activation_service.dart';

/// Visual indicator for voice activation detection state.
///
/// Shows as a small animated overlay at the top of the deck screen:
/// - Pulsing microphone icon when listening
/// - Red recording indicator when capturing speech
/// - Spinning indicator when processing through STT
///
/// Only visible when the voice activation engine is running.
class VoiceActivationIndicator extends StatefulWidget {
	final VoiceActivationService voiceActivationService;

	const VoiceActivationIndicator({
		super.key,
		required this.voiceActivationService,
	});

	@override
	State<VoiceActivationIndicator> createState() => _VoiceActivationIndicatorState();
}

class _VoiceActivationIndicatorState extends State<VoiceActivationIndicator>
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

		widget.voiceActivationService.addListener(_onStateChanged);
		_updateAnimation();
	}

	@override
	void didUpdateWidget(VoiceActivationIndicator oldWidget) {
		super.didUpdateWidget(oldWidget);

		if (oldWidget.voiceActivationService != widget.voiceActivationService) {
			oldWidget.voiceActivationService.removeListener(_onStateChanged);
			widget.voiceActivationService.addListener(_onStateChanged);
			_updateAnimation();
		}
	}

	void _onStateChanged() {
		if (!mounted) return;

		_updateAnimation();
		setState(() {});
	}

	void _updateAnimation() {
		final state = widget.voiceActivationService.state;

		if (state == VoiceActivationState.listening) {
			// Slow pulse when listening
			_pulseController.duration = const Duration(milliseconds: 1200);
			_pulseController.repeat(reverse: true);
		} else if (state == VoiceActivationState.recording) {
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
		widget.voiceActivationService.removeListener(_onStateChanged);
		_pulseController.dispose();
		super.dispose();
	}

	@override
	Widget build(BuildContext context) {
		final state = widget.voiceActivationService.state;

		if (state == VoiceActivationState.stopped) {
			return const SizedBox.shrink();
		}

		final isDark = Theme.of(context).brightness == Brightness.dark;

		return AnimatedBuilder(
			animation: _pulseAnimation,
			builder: (context, child) {
				return Opacity(
					opacity: state == VoiceActivationState.listening
						? _pulseAnimation.value
						: 1.0,
					child: _buildIndicator(context, isDark, state),
				);
			},
		);
	}

	Widget _buildIndicator(BuildContext context, bool isDark, VoiceActivationState state) {
		final localizations = AppLocalizations.of(context)!;
		final Color iconColor;
		final Color bgColor;
		final IconData icon;
		final String label;

		switch (state) {
			case VoiceActivationState.listening:
				iconColor = isDark ? AppColorsDark.info : AppColorsLight.info;
				bgColor = (isDark ? AppColorsDark.infoLight5 : AppColorsLight.infoLight9)
					.withValues(alpha: 0.9);
				icon = MdiIcons.microphoneOutline;
				label = localizations.buddy_voice_listening;
			case VoiceActivationState.recording:
				iconColor = isDark ? AppColorsDark.danger : AppColorsLight.danger;
				bgColor = (isDark ? AppColorsDark.dangerLight5 : AppColorsLight.dangerLight9)
					.withValues(alpha: 0.9);
				icon = MdiIcons.microphone;
				final seconds = widget.voiceActivationService.recordingDuration.inSeconds;
				final maxSeconds = widget.voiceActivationService.config.maxRecordingDurationSec;
				label = localizations.buddy_voice_recording_progress(seconds, maxSeconds);
			case VoiceActivationState.processing:
				iconColor = isDark ? AppColorsDark.warning : AppColorsLight.warning;
				bgColor = (isDark ? AppColorsDark.warningLight5 : AppColorsLight.warningLight9)
					.withValues(alpha: 0.9);
				icon = MdiIcons.earHearing;
				label = localizations.buddy_voice_processing;
			case VoiceActivationState.stopped:
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
					if (state == VoiceActivationState.processing)
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
