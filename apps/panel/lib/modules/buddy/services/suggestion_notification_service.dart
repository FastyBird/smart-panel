import 'dart:async';
import 'dart:collection';

import 'package:flutter/foundation.dart';

import 'package:fastybird_smart_panel/modules/buddy/models/suggestion.dart';

/// Manages a queue of buddy suggestion notifications (toasts).
///
/// Only one notification is visible at a time. Additional suggestions
/// are queued and shown after the current one is dismissed or auto-expires.
///
/// Auto-dismiss timeout defaults to 15 seconds.
class SuggestionNotificationService extends ChangeNotifier {
	/// Default auto-dismiss duration.
	static const Duration defaultAutoDismiss = Duration(seconds: 15);

	final Queue<BuddySuggestionModel> _queue = Queue<BuddySuggestionModel>();
	BuddySuggestionModel? _current;
	Timer? _autoDismissTimer;

	/// Duration before auto-dismissing the current notification.
	final Duration autoDismissDuration;

	/// Callback invoked when a notification is dismissed (swiped or timed out).
	/// The caller should use this to send `dismissed` feedback to the backend.
	void Function(String suggestionId)? onDismissed;

	/// Callback invoked when a notification is tapped.
	/// The caller should use this to open the buddy drawer.
	void Function(BuddySuggestionModel suggestion)? onTapped;

	SuggestionNotificationService({
		this.autoDismissDuration = defaultAutoDismiss,
		this.onDismissed,
		this.onTapped,
	});

	/// The currently displayed suggestion notification, or null.
	BuddySuggestionModel? get current => _current;

	/// Whether a notification is currently being shown.
	bool get hasNotification => _current != null;

	/// Number of queued notifications (excluding the current one).
	int get queueLength => _queue.length;

	/// Enqueue a new suggestion notification.
	///
	/// If no notification is currently showing, it is displayed immediately.
	/// Otherwise it is added to the queue and shown after the current one
	/// is dismissed.
	void enqueue(BuddySuggestionModel suggestion) {
		if (_current == null) {
			_showNext(suggestion);
		} else {
			_queue.addLast(suggestion);
		}
	}

	/// Dismiss the current notification (user swipe or explicit dismiss).
	///
	/// Sends `dismissed` feedback via the [onDismissed] callback and
	/// shows the next queued notification if any.
	void dismissCurrent({bool sendFeedback = true}) {
		final dismissed = _current;
		if (dismissed == null) return;

		_cancelTimer();
		_current = null;

		if (sendFeedback) {
			onDismissed?.call(dismissed.id);
		}

		_advanceQueue();
		notifyListeners();
	}

	/// Handle user tapping the current notification.
	///
	/// Opens the buddy drawer (via callback) and removes the notification
	/// without sending dismissed feedback (the user wants to interact).
	void tapCurrent() {
		final tapped = _current;
		if (tapped == null) return;

		_cancelTimer();
		_current = null;

		onTapped?.call(tapped);

		_advanceQueue();
		notifyListeners();
	}

	/// Clear all queued and current notifications.
	void clear() {
		_cancelTimer();
		_current = null;
		_queue.clear();
		notifyListeners();
	}

	void _showNext(BuddySuggestionModel suggestion) {
		_current = suggestion;
		_startAutoDismissTimer();
		notifyListeners();
	}

	void _advanceQueue() {
		if (_queue.isNotEmpty) {
			_showNext(_queue.removeFirst());
		}
	}

	void _startAutoDismissTimer() {
		_cancelTimer();
		_autoDismissTimer = Timer(autoDismissDuration, () {
			dismissCurrent();
		});
	}

	void _cancelTimer() {
		_autoDismissTimer?.cancel();
		_autoDismissTimer = null;
	}

	@override
	void dispose() {
		_cancelTimer();
		super.dispose();
	}
}
