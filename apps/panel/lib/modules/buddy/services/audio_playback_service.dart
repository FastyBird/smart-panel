import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';

/// Service for playing TTS audio responses from the buddy backend.
///
/// Manages an [AudioPlayer] instance, handles playback lifecycle,
/// and exposes state via [ChangeNotifier] for reactive UI updates.
class AudioPlaybackService extends ChangeNotifier {
	final AudioPlayer _player = AudioPlayer();

	/// The message ID currently being played (or last played).
	String? _currentMessageId;

	/// Whether audio is currently playing.
	bool _isPlaying = false;

	/// Whether audio is currently loading/buffering.
	bool _isLoading = false;

	/// Error message if playback failed.
	String? _error;

	AudioPlaybackService() {
		_player.playerStateStream.listen(_onPlayerStateChanged);
	}

	// ============================================
	// GETTERS
	// ============================================

	String? get currentMessageId => _currentMessageId;
	bool get isPlaying => _isPlaying;
	bool get isLoading => _isLoading;
	String? get error => _error;

	/// Whether a specific message is currently playing.
	bool isPlayingMessage(String messageId) =>
		_currentMessageId == messageId && _isPlaying;

	/// Whether a specific message is currently loading.
	bool isLoadingMessage(String messageId) =>
		_currentMessageId == messageId && _isLoading;

	// ============================================
	// PLAYBACK CONTROL
	// ============================================

	/// Play audio for a message from a URL.
	///
	/// If the same message is already playing, this stops it.
	/// If a different message is playing, it stops the previous one first.
	Future<void> playMessageAudio(String messageId, String audioUrl) async {
		// Toggle off if same message
		if (_currentMessageId == messageId && _isPlaying) {
			await stop();

			return;
		}

		_currentMessageId = messageId;
		_isLoading = true;
		_isPlaying = false;
		_error = null;
		notifyListeners();

		try {
			await _player.setUrl(audioUrl);
			await _player.play();
		} catch (e) {
			_error = 'Failed to play audio';
			_isLoading = false;
			_isPlaying = false;
			notifyListeners();

			if (kDebugMode) {
				debugPrint('[BUDDY MODULE] Audio playback error: $e');
			}
		}
	}

	/// Stop current playback.
	Future<void> stop() async {
		try {
			await _player.stop();
		} catch (e) {
			if (kDebugMode) {
				debugPrint('[BUDDY MODULE] Error stopping audio: $e');
			}
		}

		_isPlaying = false;
		_isLoading = false;
		notifyListeners();
	}

	// ============================================
	// INTERNAL
	// ============================================

	void _onPlayerStateChanged(PlayerState state) {
		final wasPlaying = _isPlaying;
		final wasLoading = _isLoading;

		switch (state.processingState) {
			case ProcessingState.idle:
				_isPlaying = false;
				_isLoading = false;
				break;
			case ProcessingState.loading:
			case ProcessingState.buffering:
				_isLoading = true;
				_isPlaying = false;
				break;
			case ProcessingState.ready:
				_isLoading = false;
				_isPlaying = state.playing;
				break;
			case ProcessingState.completed:
				_isPlaying = false;
				_isLoading = false;
				break;
		}

		if (wasPlaying != _isPlaying || wasLoading != _isLoading) {
			notifyListeners();
		}
	}

	@override
	void dispose() {
		_player.dispose();
		super.dispose();
	}
}
