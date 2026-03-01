import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';

/// Service for recording audio from the device microphone.
///
/// Handles recording lifecycle, permission checks, and provides
/// the recorded audio as bytes for upload to the backend.
class AudioRecordingService extends ChangeNotifier {
	final AudioRecorder _recorder = AudioRecorder();

	bool _isRecording = false;
	bool _hasPermission = false;
	bool _permissionChecked = false;
	String? _currentRecordingPath;
	Duration _recordingDuration = Duration.zero;
	Timer? _durationTimer;

	/// Holds the result from an auto-stop so the caller can retrieve it.
	RecordedAudio? _autoStopResult;

	/// Maximum recording duration before auto-stop.
	static const Duration maxDuration = Duration(seconds: 30);

	bool get isRecording => _isRecording;
	bool get hasPermission => _hasPermission;
	bool get permissionChecked => _permissionChecked;
	Duration get recordingDuration => _recordingDuration;

	/// Whether the recording was automatically stopped at the max duration.
	bool get wasAutoStopped => _autoStopResult != null;

	/// Check and request microphone permission.
	Future<bool> checkPermission() async {
		try {
			_hasPermission = await _recorder.hasPermission();
			_permissionChecked = true;
			notifyListeners();

			return _hasPermission;
		} catch (e) {
			if (kDebugMode) {
				debugPrint('[BUDDY MODULE] Permission check error: $e');
			}

			_hasPermission = false;
			_permissionChecked = true;
			notifyListeners();

			return false;
		}
	}

	/// Start recording audio.
	///
	/// Records in WAV format for maximum compatibility.
	/// Automatically stops after [maxDuration].
	Future<bool> startRecording() async {
		if (_isRecording) return false;

		// Set _isRecording to true synchronously before any async work
		// (including the permission check) so that a concurrent stop
		// from the gesture ending early sees recording as in-progress
		// instead of being a no-op that leaves recording orphaned.
		_isRecording = true;

		_autoStopResult = null;

		if (!_permissionChecked) {
			await checkPermission();
		}

		if (!_hasPermission) {
			_isRecording = false;
			notifyListeners();

			return false;
		}

		// A concurrent stop may have reset _isRecording during the
		// async permission check. Bail out if that happened.
		if (!_isRecording) {
			return false;
		}

		try {
			final dir = await getTemporaryDirectory();
			_currentRecordingPath =
				'${dir.path}/buddy_audio_${DateTime.now().millisecondsSinceEpoch}.wav';

			await _recorder.start(
				const RecordConfig(
					encoder: AudioEncoder.wav,
					sampleRate: 16000,
					numChannels: 1,
					bitRate: 256000,
				),
				path: _currentRecordingPath!,
			);

			_recordingDuration = Duration.zero;
			notifyListeners();

			// Start duration timer
			_durationTimer = Timer.periodic(
				const Duration(milliseconds: 100),
				(timer) {
					_recordingDuration += const Duration(milliseconds: 100);
					notifyListeners();

					// Auto-stop at max duration — cancel timer immediately to
					// prevent a second tick from re-entering _performAutoStop.
					if (_recordingDuration >= maxDuration) {
						timer.cancel();
						unawaited(_performAutoStop());
					}
				},
			);

			return true;
		} catch (e) {
			if (kDebugMode) {
				debugPrint('[BUDDY MODULE] Start recording error: $e');
			}

			_isRecording = false;
			notifyListeners();

			return false;
		}
	}

	/// Internal auto-stop that stores the result for later retrieval.
	Future<void> _performAutoStop() async {
		try {
			final result = await _stopRecordingInternal();

			if (result != null) {
				_autoStopResult = result;
				notifyListeners();
			}
		} catch (e) {
			if (kDebugMode) {
				debugPrint('[BUDDY MODULE] Auto-stop error: $e');
			}
		}
	}

	/// Stop recording and return the audio file bytes.
	///
	/// Returns null if recording failed or no audio was captured.
	/// If the recording was auto-stopped, returns the stored result.
	Future<RecordedAudio?> stopRecording() async {
		// If auto-stop already captured the result, return it
		if (_autoStopResult != null) {
			final result = _autoStopResult;

			_autoStopResult = null;

			return result;
		}

		return _stopRecordingInternal();
	}

	Future<RecordedAudio?> _stopRecordingInternal() async {
		if (!_isRecording) return null;

		// Set _isRecording to false synchronously before the async
		// _recorder.stop() call so that a concurrent caller (e.g.
		// auto-stop timer + user long-press-end) is immediately
		// blocked by the guard above.
		_isRecording = false;

		_durationTimer?.cancel();
		_durationTimer = null;

		try {
			final path = await _recorder.stop();

			notifyListeners();

			if (path == null || path.isEmpty) return null;

			final file = File(path);

			if (!file.existsSync()) return null;

			final bytes = await file.readAsBytes();

			// Clean up the temp file
			try {
				await file.delete();
			} catch (_) {
				// Ignore cleanup errors
			}

			return RecordedAudio(
				bytes: bytes,
				mimeType: 'audio/wav',
				duration: _recordingDuration,
			);
		} catch (e) {
			if (kDebugMode) {
				debugPrint('[BUDDY MODULE] Stop recording error: $e');
			}

			notifyListeners();

			return null;
		}
	}

	/// Cancel an in-progress recording without saving.
	Future<void> cancelRecording() async {
		_autoStopResult = null;

		if (!_isRecording) return;

		// Set synchronously before async work to prevent concurrent entries.
		_isRecording = false;

		_durationTimer?.cancel();
		_durationTimer = null;

		try {
			await _recorder.stop();
		} catch (_) {
			// Ignore stop errors
		}

		// Clean up temp file
		if (_currentRecordingPath != null) {
			try {
				final file = File(_currentRecordingPath!);

				if (file.existsSync()) {
					await file.delete();
				}
			} catch (_) {
				// Ignore cleanup errors
			}
		}

		_recordingDuration = Duration.zero;
		notifyListeners();
	}

	@override
	void dispose() {
		_durationTimer?.cancel();

		// Clean up temp recording file if still on disk
		if (_currentRecordingPath != null) {
			try {
				final file = File(_currentRecordingPath!);

				if (file.existsSync()) {
					file.deleteSync();
				}
			} catch (_) {
				// Ignore cleanup errors during disposal
			}
		}

		_recorder.dispose();
		super.dispose();
	}
}

/// Represents a recorded audio clip.
class RecordedAudio {
	final Uint8List bytes;
	final String mimeType;
	final Duration duration;

	const RecordedAudio({
		required this.bytes,
		required this.mimeType,
		required this.duration,
	});
}
