import 'dart:async';
import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';

/// Configuration for voice activation detection.
class VoiceActivationConfig {
	/// Whether voice activation detection is enabled.
	final bool enabled;

	/// The wake word phrase (e.g., "Hey panel").
	/// Used for display purposes and documentation. The actual speech
	/// recognition is handled by the backend STT pipeline.
	final String wakeWord;

	/// Amplitude threshold (dBFS) above which speech is considered detected.
	/// Values closer to 0 are louder. Typical speech: -30 to -10 dBFS.
	/// A quiet room is around -45 to -60 dBFS.
	/// Lower (more negative) values = more sensitive.
	final double sensitivityThreshold;

	/// How long after the last detected speech to wait before stopping
	/// the recording (milliseconds). Acts as a Voice Activity Detection
	/// (VAD) silence timeout.
	final int silenceTimeoutMs;

	/// Maximum recording duration after speech detection (seconds).
	final int maxRecordingDurationSec;

	const VoiceActivationConfig({
		this.enabled = false,
		this.wakeWord = 'Hey panel',
		this.sensitivityThreshold = -30.0,
		this.silenceTimeoutMs = 1500,
		this.maxRecordingDurationSec = 10,
	});

	VoiceActivationConfig copyWith({
		bool? enabled,
		String? wakeWord,
		double? sensitivityThreshold,
		int? silenceTimeoutMs,
		int? maxRecordingDurationSec,
	}) {
		return VoiceActivationConfig(
			enabled: enabled ?? this.enabled,
			wakeWord: wakeWord ?? this.wakeWord,
			sensitivityThreshold: sensitivityThreshold ?? this.sensitivityThreshold,
			silenceTimeoutMs: silenceTimeoutMs ?? this.silenceTimeoutMs,
			maxRecordingDurationSec: maxRecordingDurationSec ?? this.maxRecordingDurationSec,
		);
	}
}

/// State of the voice activation detection engine.
enum VoiceActivationState {
	/// Engine is stopped / not running.
	stopped,

	/// Listening for speech (amplitude monitoring).
	listening,

	/// Speech detected, recording audio for STT processing.
	recording,

	/// Sending recorded audio through STT -> conversation pipeline.
	processing,
}

/// Result of a voice activation capture cycle.
class VoiceActivationCaptureResult {
	final Uint8List audioBytes;
	final String mimeType;
	final Duration duration;

	const VoiceActivationCaptureResult({
		required this.audioBytes,
		required this.mimeType,
		required this.duration,
	});
}

/// Callback fired when audio has been captured after voice activation detection.
typedef VoiceActivationCaptureCallback = Future<void> Function(VoiceActivationCaptureResult result);

/// Service for continuous voice activation detection on the panel device.
///
/// Uses the `record` package's amplitude monitoring to detect speech
/// activity. When speech is detected above the configured threshold:
///
/// 1. Screen wake and visual indicator are triggered
/// 2. Audio is recorded until silence is detected (VAD) or timeout
/// 3. The captured audio is passed to [onCapture] for processing
///    through the existing STT -> buddy conversation pipeline
///
/// This approach is lightweight (energy-based detection) and works
/// without introducing external dependencies like Porcupine.
class VoiceActivationService extends ChangeNotifier {
	AudioRecorder? _monitorRecorder;
	AudioRecorder? _captureRecorder;

	VoiceActivationConfig _config = const VoiceActivationConfig();
	VoiceActivationState _state = VoiceActivationState.stopped;

	Timer? _amplitudeTimer;
	Timer? _silenceTimer;
	Timer? _maxDurationTimer;
	Timer? _cooldownTimer;
	String? _monitorPath;
	String? _capturePath;
	Duration _recordingDuration = Duration.zero;
	Timer? _durationTimer;
	bool _disposed = false;

	/// Callback fired when audio has been captured and is ready to be
	/// sent through the STT -> conversation pipeline.
	VoiceActivationCaptureCallback? onCapture;

	/// Callback fired when speech is first detected (for screen wake).
	VoidCallback? onSpeechDetected;

	VoiceActivationConfig get config => _config;
	VoiceActivationState get state => _state;
	bool get isListening => _state == VoiceActivationState.listening;
	bool get isRecording => _state == VoiceActivationState.recording;
	bool get isProcessing => _state == VoiceActivationState.processing;
	bool get isRunning => _state != VoiceActivationState.stopped;
	Duration get recordingDuration => _recordingDuration;

	/// Update the voice activation configuration.
	///
	/// Automatically starts/stops the engine based on the enabled flag.
	/// If [start] fails (e.g., microphone permission denied), [enabled]
	/// is reverted to `false` so the UI reflects the actual engine state.
	Future<void> updateConfig(VoiceActivationConfig newConfig) async {
		final wasEnabled = _config.enabled;
		_config = newConfig;

		if (wasEnabled && !newConfig.enabled) {
			await stop();
		} else if (!wasEnabled && newConfig.enabled) {
			final started = await start();

			if (!started) {
				// Revert so subsequent calls can retry the !wasEnabled branch
				_config = _config.copyWith(enabled: false);
			}
		}

		notifyListeners();
	}

	/// Start the voice activation detection engine.
	Future<bool> start() async {
		if (_disposed || !_config.enabled) return false;
		if (_state != VoiceActivationState.stopped) return false;

		_monitorRecorder = AudioRecorder();

		try {
			final hasPermission = await _monitorRecorder!.hasPermission();

			if (!hasPermission) {
				if (kDebugMode) {
					debugPrint('[VOICE ACTIVATION] Microphone permission denied');
				}

				_monitorRecorder?.dispose();
				_monitorRecorder = null;

				return false;
			}
		} catch (e) {
			if (kDebugMode) {
				debugPrint('[VOICE ACTIVATION] Permission check failed: $e');
			}

			_monitorRecorder?.dispose();
			_monitorRecorder = null;

			return false;
		}

		return _startListening();
	}

	/// Stop the voice activation detection engine entirely.
	Future<void> stop() async {
		_cancelAllTimers();
		await _stopMonitoring();
		await _cancelCapture();

		_monitorRecorder?.dispose();
		_monitorRecorder = null;

		_recordingDuration = Duration.zero;
		_setState(VoiceActivationState.stopped);
	}

	/// Start the amplitude monitoring phase.
	///
	/// The record package requires an active recording session to read
	/// amplitude. We start a minimal recording that we discard, using
	/// it only for amplitude polling.
	Future<bool> _startListening() async {
		if (_disposed || _monitorRecorder == null) return false;

		try {
			final dir = await getTemporaryDirectory();
			_monitorPath = '${dir.path}/ww_monitor_${DateTime.now().millisecondsSinceEpoch}.wav';

			await _monitorRecorder!.start(
				const RecordConfig(
					encoder: AudioEncoder.wav,
					sampleRate: 16000,
					numChannels: 1,
					bitRate: 128000,
				),
				path: _monitorPath!,
			);

			_setState(VoiceActivationState.listening);

			// Poll amplitude every 200ms -- balances responsiveness vs CPU
			_amplitudeTimer = Timer.periodic(
				const Duration(milliseconds: 200),
				(_) => _checkAmplitude(),
			);

			return true;
		} catch (e) {
			if (kDebugMode) {
				debugPrint('[VOICE ACTIVATION] Failed to start monitoring: $e');
			}

			return false;
		}
	}

	/// Stop the amplitude monitoring recorder and clean up its temp file.
	Future<void> _stopMonitoring() async {
		_amplitudeTimer?.cancel();
		_amplitudeTimer = null;

		try {
			await _monitorRecorder?.stop();
		} catch (_) {}

		_cleanupFile(_monitorPath);
		_monitorPath = null;
	}

	/// Check current audio amplitude. If above threshold, transition to recording.
	Future<void> _checkAmplitude() async {
		if (_disposed || _state != VoiceActivationState.listening) return;

		try {
			final amplitude = await _monitorRecorder?.getAmplitude();

			if (amplitude == null) return;

			// amplitude.current is in dBFS (negative, 0 = max loudness)
			if (amplitude.current > _config.sensitivityThreshold) {
				if (kDebugMode) {
					debugPrint(
						'[VOICE ACTIVATION] Speech detected: ${amplitude.current.toStringAsFixed(1)} dBFS',
					);
				}

				await _transitionToRecording();
			}
		} catch (e) {
			if (kDebugMode) {
				debugPrint('[VOICE ACTIVATION] Amplitude check error: $e');
			}
		}
	}

	/// Transition from listening to recording.
	///
	/// Stops amplitude monitoring, notifies listeners that speech was
	/// detected (for screen wake / visual indicator), and starts
	/// capturing audio.
	Future<void> _transitionToRecording() async {
		if (_disposed || _state != VoiceActivationState.listening) return;

		await _stopMonitoring();

		_setState(VoiceActivationState.recording);
		_recordingDuration = Duration.zero;

		// Notify screen wake / visual indicator
		onSpeechDetected?.call();

		try {
			_captureRecorder = AudioRecorder();
			final dir = await getTemporaryDirectory();
			_capturePath = '${dir.path}/ww_capture_${DateTime.now().millisecondsSinceEpoch}.wav';

			await _captureRecorder!.start(
				const RecordConfig(
					encoder: AudioEncoder.wav,
					sampleRate: 16000,
					numChannels: 1,
					bitRate: 256000,
				),
				path: _capturePath!,
			);

			// Track recording duration
			_durationTimer = Timer.periodic(
				const Duration(milliseconds: 100),
				(_) {
					_recordingDuration += const Duration(milliseconds: 100);
					notifyListeners();
				},
			);

			// Start silence detection (VAD)
			_resetSilenceTimer();

			_amplitudeTimer = Timer.periodic(
				const Duration(milliseconds: 150),
				(_) => _checkRecordingAmplitude(),
			);

			// Maximum recording duration safety
			_maxDurationTimer = Timer(
				Duration(seconds: _config.maxRecordingDurationSec),
				() => _onRecordingComplete(),
			);
		} catch (e) {
			if (kDebugMode) {
				debugPrint('[VOICE ACTIVATION] Failed to start capture: $e');
			}

			await _resumeListening();
		}
	}

	/// Check amplitude during recording to reset the silence timer when
	/// speech continues.
	Future<void> _checkRecordingAmplitude() async {
		if (_disposed || _state != VoiceActivationState.recording) return;

		try {
			final amplitude = await _captureRecorder?.getAmplitude();

			if (amplitude == null) return;

			if (amplitude.current > _config.sensitivityThreshold) {
				_resetSilenceTimer();
			}
		} catch (_) {}
	}

	/// Reset the silence timer. Called when speech is detected during recording.
	void _resetSilenceTimer() {
		_silenceTimer?.cancel();
		_silenceTimer = Timer(
			Duration(milliseconds: _config.silenceTimeoutMs),
			() => _onRecordingComplete(),
		);
	}

	/// Called when recording is complete (silence detected or max duration).
	Future<void> _onRecordingComplete() async {
		if (_disposed || _state != VoiceActivationState.recording) return;

		_cancelRecordingTimers();
		_setState(VoiceActivationState.processing);

		try {
			final path = await _captureRecorder?.stop();

			_captureRecorder?.dispose();
			_captureRecorder = null;

			if (path == null || path.isEmpty) {
				await _resumeListening();

				return;
			}

			final file = File(path);

			if (!file.existsSync()) {
				await _resumeListening();

				return;
			}

			final bytes = await file.readAsBytes();
			final duration = _recordingDuration;

			// Clean up temp file
			try {
				await file.delete();
			} catch (_) {}

			_capturePath = null;

			// Too short (< 300ms) -- likely noise, not speech
			if (duration < const Duration(milliseconds: 300) || bytes.length < 1000) {
				if (kDebugMode) {
					debugPrint('[VOICE ACTIVATION] Recording too short, discarding');
				}

				await _resumeListening();

				return;
			}

			// Pass the captured audio to the callback for processing
			if (onCapture != null) {
				await onCapture!(VoiceActivationCaptureResult(
					audioBytes: Uint8List.fromList(bytes),
					mimeType: 'audio/wav',
					duration: duration,
				));
			}

			// Cooldown before resuming to avoid re-detecting the same utterance
			_cooldownTimer = Timer(const Duration(seconds: 2), () {
				_resumeListening().catchError((e) {
					if (kDebugMode) {
						debugPrint('[VOICE ACTIVATION] Resume after cooldown failed: $e');
					}
				});
			});
		} catch (e) {
			if (kDebugMode) {
				debugPrint('[VOICE ACTIVATION] Recording complete error: $e');
			}

			await _resumeListening();
		}
	}

	/// Resume listening after processing is complete.
	Future<void> _resumeListening() async {
		if (_disposed || !_config.enabled) {
			_setState(VoiceActivationState.stopped);

			return;
		}

		await _cancelCapture();
		_recordingDuration = Duration.zero;

		// Re-create monitor recorder for the new listening session
		_monitorRecorder?.dispose();
		_monitorRecorder = AudioRecorder();

		final started = await _startListening();

		if (!started) {
			// _startListening failed -- fall back to stopped so the UI
			// doesn't show a stale processing/recording state forever.
			_setState(VoiceActivationState.stopped);
		}
	}

	/// Cancel an ongoing capture without processing.
	Future<void> _cancelCapture() async {
		_cancelRecordingTimers();

		try {
			await _captureRecorder?.stop();
		} catch (_) {}

		_captureRecorder?.dispose();
		_captureRecorder = null;

		_cleanupFile(_capturePath);
		_capturePath = null;
	}

	void _cancelRecordingTimers() {
		_amplitudeTimer?.cancel();
		_amplitudeTimer = null;
		_silenceTimer?.cancel();
		_silenceTimer = null;
		_maxDurationTimer?.cancel();
		_maxDurationTimer = null;
		_durationTimer?.cancel();
		_durationTimer = null;
	}

	void _cancelAllTimers() {
		_cancelRecordingTimers();
		_cooldownTimer?.cancel();
		_cooldownTimer = null;
	}

	void _setState(VoiceActivationState newState) {
		if (_state == newState) return;

		_state = newState;

		if (!_disposed) {
			notifyListeners();
		}
	}

	void _cleanupFile(String? path) {
		if (path == null) return;

		try {
			final file = File(path);

			if (file.existsSync()) {
				file.deleteSync();
			}
		} catch (_) {}
	}

	@override
	void notifyListeners() {
		if (!_disposed) {
			super.notifyListeners();
		}
	}

	@override
	void dispose() {
		_disposed = true;
		_cancelAllTimers();

		_monitorRecorder?.stop().catchError((_) => null);
		_monitorRecorder?.dispose();
		_captureRecorder?.stop().catchError((_) => null);
		_captureRecorder?.dispose();

		_cleanupFile(_monitorPath);
		_cleanupFile(_capturePath);

		super.dispose();
	}
}
