import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/toast.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/buddy/service.dart';
import 'package:fastybird_smart_panel/modules/buddy/services/audio_recording_service.dart';

enum _VoiceInputPhase { listening, processing }

/// Full-screen voice input overlay with animated orb and waveform.
///
/// Shows a pulsing orb during listening, switches to a spinning orb
/// during processing, and auto-dismisses when the response arrives.
class VoiceInputOverlay extends StatefulWidget {
	const VoiceInputOverlay({super.key});

	/// Shows the overlay and returns true if audio was successfully sent.
	static Future<bool> show(BuildContext context) async {
		final result = await Navigator.of(context).push<bool>(
			PageRouteBuilder<bool>(
				opaque: true,
				pageBuilder: (context, _, __) => const VoiceInputOverlay(),
				transitionsBuilder: (_, animation, __, child) =>
					FadeTransition(opacity: animation, child: child),
				transitionDuration: const Duration(milliseconds: 300),
				reverseTransitionDuration: const Duration(milliseconds: 200),
			),
		);

		return result ?? false;
	}

	@override
	State<VoiceInputOverlay> createState() => _VoiceInputOverlayState();
}

class _VoiceInputOverlayState extends State<VoiceInputOverlay> {
	late final AudioRecordingService _recordingService;
	late final BuddyService _buddyService;

	_VoiceInputPhase _phase = _VoiceInputPhase.listening;
	bool _audioSent = false;
	bool _closing = false;

	@override
	void initState() {
		super.initState();
		_buddyService = context.read<BuddyService>();
		_recordingService = AudioRecordingService();
		_recordingService.addListener(_onRecordingChanged);
		_buddyService.addListener(_onBuddyChanged);

		WidgetsBinding.instance.addPostFrameCallback((_) {
			_startRecording();
		});
	}

	Future<void> _startRecording() async {
		final started = await _recordingService.startRecording();

		if (!started && mounted) {
			final localizations = AppLocalizations.of(context)!;
			Toast.showWarning(context, message: localizations.buddy_recording_permission_error);
			_close(false);
		}
	}

	void _onRecordingChanged() {
		if (!mounted || _closing) return;

		if (_recordingService.wasAutoStopped && _phase == _VoiceInputPhase.listening) {
			_stopAndSend();
		}

		setState(() {});
	}

	void _onBuddyChanged() {
		if (!mounted || _closing) return;

		if (_phase == _VoiceInputPhase.processing && _audioSent && !_buddyService.isSendingMessage) {
			_close(true);
		}
	}

	Future<void> _stopAndSend() async {
		if (_phase != _VoiceInputPhase.listening) return;

		// Check minimum duration before stopping
		if (_recordingService.isRecording &&
				_recordingService.recordingDuration < const Duration(milliseconds: 500)) {
			await _recordingService.cancelRecording();

			if (mounted) {
				final localizations = AppLocalizations.of(context)!;
				Toast.showWarning(context, message: localizations.buddy_recording_too_short);
				_close(false);
			}

			return;
		}

		setState(() => _phase = _VoiceInputPhase.processing);

		final recorded = await _recordingService.stopRecording();

		if (recorded == null || !mounted) {
			_close(false);
			return;
		}

		if (!_buddyService.hasActiveConversation) {
			_close(false);
			return;
		}

		_audioSent = true;

		await _buddyService.sendAudioMessage(recorded.bytes, recorded.mimeType);

		// If sendAudioMessage completed quickly, isSendingMessage might already be false
		if (mounted && !_buddyService.isSendingMessage) {
			_close(true);
		}
	}

	Future<void> _cancel() async {
		await _recordingService.cancelRecording();
		_close(false);
	}

	void _close(bool result) {
		if (_closing) return;
		_closing = true;

		if (mounted) Navigator.of(context).pop(result);
	}

	@override
	void dispose() {
		_recordingService.removeListener(_onRecordingChanged);
		_buddyService.removeListener(_onBuddyChanged);
		_recordingService.dispose();
		super.dispose();
	}

	@override
	Widget build(BuildContext context) {
		final isDark = Theme.of(context).brightness == Brightness.dark;
		final colors = ThemeColorFamily.get(
			isDark ? Brightness.dark : Brightness.light,
			ThemeColors.primary,
		);
		final localizations = AppLocalizations.of(context)!;

		final seconds = _recordingService.recordingDuration.inSeconds;
		final maxSeconds = AudioRecordingService.maxDuration.inSeconds;

		final isListening = _phase == _VoiceInputPhase.listening;

		final bgColor = isDark ? AppBgColorDark.page : AppBgColorLight.page;
		final textColor = isDark ? AppTextColorDark.primary : AppTextColorLight.primary;
		final mutedColor = isDark ? AppTextColorDark.placeholder : AppTextColorLight.placeholder;

		return Scaffold(
			backgroundColor: bgColor,
			body: SafeArea(
				child: Column(
					children: [
						const Spacer(flex: 2),
						// Animated orb — tap to stop recording
						GestureDetector(
							onTap: isListening ? _stopAndSend : null,
							child: _AnimatedOrb(
								isProcessing: !isListening,
								primaryColor: colors.base,
								secondaryColor: colors.light3,
								bgColor: bgColor,
								size: AppSpacings.scale(140),
							),
						),
						SizedBox(height: AppSpacings.pXl),
						// Status text
						Text(
							isListening
								? localizations.buddy_voice_listening
								: localizations.buddy_thinking,
							style: TextStyle(
								color: textColor,
								fontSize: AppFontSize.extraLarge,
								fontWeight: FontWeight.w300,
							),
						),
						// Timer + waveform — always in layout to keep position stable
						Opacity(
							opacity: isListening ? 1.0 : 0.0,
							child: Column(
								mainAxisSize: MainAxisSize.min,
								children: [
									SizedBox(height: AppSpacings.pMd),
									Text(
										'${seconds}s / ${maxSeconds}s',
										style: TextStyle(
											color: mutedColor,
											fontSize: AppFontSize.small,
										),
									),
									SizedBox(height: AppSpacings.pLg),
									_VoiceWaveform(color: colors.base),
								],
							),
						),
						const Spacer(flex: 2),
						// Cancel button — always in layout to keep position stable
						IgnorePointer(
							ignoring: !isListening,
							child: Opacity(
								opacity: isListening ? 1.0 : 0.0,
								child: Padding(
									padding: EdgeInsets.only(bottom: AppSpacings.pXl),
									child: OutlinedButtonTheme(
										data: isDark
											? AppOutlinedButtonsDarkThemes.neutral
											: AppOutlinedButtonsLightThemes.neutral,
										child: OutlinedButton(
											onPressed: _cancel,
											child: Text(localizations.button_cancel),
										),
									),
								),
							),
						),
					],
				),
			),
		);
	}
}

// ============================================================================
// ANIMATED ORB
// ============================================================================

class _AnimatedOrb extends StatefulWidget {
	final bool isProcessing;
	final Color primaryColor;
	final Color secondaryColor;
	final Color bgColor;
	final double size;

	const _AnimatedOrb({
		required this.isProcessing,
		required this.primaryColor,
		required this.secondaryColor,
		required this.bgColor,
		this.size = 160,
	});

	@override
	State<_AnimatedOrb> createState() => _AnimatedOrbState();
}

class _AnimatedOrbState extends State<_AnimatedOrb> with TickerProviderStateMixin {
	// Listening: staggered expanding pulse rings
	static const int _ringCount = 3;
	late List<AnimationController> _ringControllers;
	late List<Animation<double>> _ringScaleAnimations;
	late List<Animation<double>> _ringOpacityAnimations;

	// Processing: spinning gradient ring
	late AnimationController _spinController;

	@override
	void initState() {
		super.initState();

		_ringControllers = List.generate(
			_ringCount,
			(i) => AnimationController(
				duration: const Duration(milliseconds: 1500),
				vsync: this,
			),
		);

		_ringScaleAnimations = _ringControllers
			.map((c) => Tween<double>(begin: 1.0, end: 1.4).animate(
				CurvedAnimation(parent: c, curve: Curves.easeOut),
			))
			.toList();

		_ringOpacityAnimations = _ringControllers
			.map((c) => Tween<double>(begin: 0.6, end: 0.0).animate(
				CurvedAnimation(parent: c, curve: Curves.easeOut),
			))
			.toList();

		for (int i = 0; i < _ringCount; i++) {
			Future.delayed(Duration(milliseconds: i * 500), () {
				if (mounted) {
					_ringControllers[i].repeat();
				}
			});
		}

		_spinController = AnimationController(
			duration: const Duration(milliseconds: 1200),
			vsync: this,
		)..repeat();
	}

	@override
	void dispose() {
		for (final c in _ringControllers) {
			c.dispose();
		}
		_spinController.dispose();
		super.dispose();
	}

	@override
	Widget build(BuildContext context) {
		// Fixed size container so the layout doesn't jump when switching states.
		final totalSize = widget.size * 1.5;

		return SizedBox(
			width: totalSize,
			height: totalSize,
			child: Center(
				child: widget.isProcessing ? _buildProcessingOrb() : _buildListeningOrb(),
			),
		);
	}

	Widget _buildListeningOrb() {
		return Stack(
			alignment: Alignment.center,
			children: [
				// Expanding pulse rings
				...List.generate(_ringCount, (i) {
					return AnimatedBuilder(
						animation: _ringControllers[i],
						builder: (context, child) {
							return Transform.scale(
								scale: _ringScaleAnimations[i].value,
								child: Opacity(
									opacity: _ringOpacityAnimations[i].value,
									child: Container(
										width: widget.size,
										height: widget.size,
										decoration: BoxDecoration(
											shape: BoxShape.circle,
											border: Border.all(
												color: widget.primaryColor,
												width: 2,
											),
										),
									),
								),
							);
						},
					);
				}),
				// Main orb
				Container(
					width: widget.size,
					height: widget.size,
					decoration: BoxDecoration(
						shape: BoxShape.circle,
						gradient: LinearGradient(
							colors: [widget.primaryColor, widget.secondaryColor],
							begin: Alignment.topLeft,
							end: Alignment.bottomRight,
						),
						boxShadow: [
							BoxShadow(
								color: widget.primaryColor.withValues(alpha: 0.4),
								blurRadius: 30,
								spreadRadius: 5,
							),
						],
					),
					child: Icon(
						Icons.mic,
						color: Colors.white,
						size: widget.size * 0.3,
					),
				),
			],
		);
	}

	Widget _buildProcessingOrb() {
		final orbSize = widget.size * 0.75;

		return AnimatedBuilder(
			animation: _spinController,
			builder: (context, child) {
				return Transform.rotate(
					angle: _spinController.value * 2 * math.pi,
					child: Container(
						width: orbSize,
						height: orbSize,
						decoration: BoxDecoration(
							shape: BoxShape.circle,
							gradient: SweepGradient(
								colors: [
									widget.primaryColor,
									widget.secondaryColor,
									widget.primaryColor.withValues(alpha: 0.3),
									widget.primaryColor,
								],
							),
						),
						child: Center(
							child: Container(
								width: orbSize - 16,
								height: orbSize - 16,
								decoration: BoxDecoration(
									shape: BoxShape.circle,
									color: widget.bgColor,
								),
								child: Center(
									child: Container(
										width: orbSize - 32,
										height: orbSize - 32,
										decoration: BoxDecoration(
											shape: BoxShape.circle,
											gradient: LinearGradient(
												colors: [widget.primaryColor, widget.secondaryColor],
												begin: Alignment.topLeft,
												end: Alignment.bottomRight,
											),
										),
									),
								),
							),
						),
					),
				);
			},
		);
	}
}

// ============================================================================
// VOICE WAVEFORM
// ============================================================================

class _VoiceWaveform extends StatefulWidget {
	final Color color;

	const _VoiceWaveform({required this.color});

	@override
	State<_VoiceWaveform> createState() => _VoiceWaveformState();
}

class _VoiceWaveformState extends State<_VoiceWaveform> with TickerProviderStateMixin {
	late List<AnimationController> _controllers;
	static const int _barCount = 7;

	@override
	void initState() {
		super.initState();
		_controllers = List.generate(_barCount, (index) {
			return AnimationController(
				duration: Duration(milliseconds: 250 + (index * 40)),
				vsync: this,
			)..repeat(reverse: true);
		});
	}

	@override
	void dispose() {
		for (final controller in _controllers) {
			controller.dispose();
		}
		super.dispose();
	}

	@override
	Widget build(BuildContext context) {
		return SizedBox(
			height: 40,
			child: Row(
				mainAxisAlignment: MainAxisAlignment.center,
				children: List.generate(_barCount, (index) {
					return AnimatedBuilder(
						animation: _controllers[index],
						builder: (context, child) {
							const heights = [20.0, 35.0, 25.0, 40.0, 30.0, 35.0, 20.0];

							return Container(
								width: 4,
								height: heights[index] * (0.5 + _controllers[index].value * 0.5),
								margin: const EdgeInsets.symmetric(horizontal: 2),
								decoration: BoxDecoration(
									color: widget.color,
									borderRadius: BorderRadius.circular(2),
								),
							);
						},
					);
				}),
			),
		);
	}
}
