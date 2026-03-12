import 'dart:async';
import 'dart:collection';

import 'package:flutter/foundation.dart';

import 'package:fastybird_smart_panel/features/suggestions/services/suggestion_provider.dart';
import 'package:fastybird_smart_panel/features/suggestions/types/suggestion.dart';

/// Manages a queue of suggestion notifications (toasts).
///
/// Only one notification is visible at a time. Additional suggestions
/// are queued and shown after the current one is dismissed or auto-expires.
///
/// Modules register [SuggestionProvider] implementations so that tap/dismiss
/// callbacks are routed to the correct module without coupling.
class SuggestionNotificationService extends ChangeNotifier {
	/// Default auto-dismiss duration.
	static const Duration defaultAutoDismiss = Duration(seconds: 15);

	final Queue<AppSuggestion> _queue = Queue<AppSuggestion>();
	AppSuggestion? _current;
	Timer? _autoDismissTimer;

	/// Registered providers keyed by [SuggestionProvider.providerId].
	final Map<String, SuggestionProvider> _providers = {};

	/// Maps suggestion ID to the provider ID that enqueued it.
	final Map<String, String> _suggestionProviderMap = {};

	/// Duration before auto-dismissing the current notification.
	final Duration autoDismissDuration;

	SuggestionNotificationService({
		this.autoDismissDuration = defaultAutoDismiss,
	});

	/// The currently displayed suggestion notification, or null.
	AppSuggestion? get current => _current;

	/// Whether a notification is currently being shown.
	bool get hasNotification => _current != null;

	/// Number of queued notifications (excluding the current one).
	int get queueLength => _queue.length;

	/// Register a suggestion provider.
	void registerProvider(SuggestionProvider provider) {
		_providers[provider.providerId] = provider;
	}

	/// Unregister a suggestion provider and remove its queued suggestions.
	void unregisterProvider(String providerId) {
		_providers.remove(providerId);

		// Remove queued suggestions from this provider
		_queue.removeWhere((s) => _suggestionProviderMap[s.id] == providerId);

		// If the current suggestion belongs to this provider, dismiss it
		if (_current != null && _suggestionProviderMap[_current!.id] == providerId) {
			_cancelTimer();
			final currentId = _current!.id;
			_current = null;
			_suggestionProviderMap.remove(currentId);
			_advanceQueue();
			notifyListeners();
		}
	}

	/// Enqueue a new suggestion notification from the given provider.
	///
	/// Expired suggestions are silently dropped. If no notification is currently
	/// showing, it is displayed immediately. Otherwise it is added to the queue.
	void enqueue(AppSuggestion suggestion, {required String providerId}) {
		if (suggestion.isExpired) return;
		if (!_providers.containsKey(providerId)) return;

		_suggestionProviderMap[suggestion.id] = providerId;

		if (_current == null) {
			_showNext(suggestion);
		} else {
			_queue.addLast(suggestion);
		}
	}

	/// Dismiss the current notification (user swipe or explicit dismiss).
	///
	/// Sends dismissed feedback via the provider and shows the next
	/// queued notification if any.
	void dismissCurrent({bool sendFeedback = true}) {
		final dismissed = _current;
		if (dismissed == null) return;

		_cancelTimer();
		_current = null;

		if (sendFeedback) {
			final providerId = _suggestionProviderMap[dismissed.id];
			if (providerId != null) {
				_providers[providerId]?.onSuggestionDismissed(dismissed);
			}
		}

		_suggestionProviderMap.remove(dismissed.id);
		_advanceQueue();
		notifyListeners();
	}

	/// Handle user tapping the current notification.
	///
	/// Routes the tap to the originating provider and removes the notification
	/// without sending dismissed feedback.
	void tapCurrent() {
		final tapped = _current;
		if (tapped == null) return;

		_cancelTimer();
		_current = null;

		final providerId = _suggestionProviderMap[tapped.id];
		if (providerId != null) {
			_providers[providerId]?.onSuggestionTapped(tapped);
		}

		_suggestionProviderMap.remove(tapped.id);
		_advanceQueue();
		notifyListeners();
	}

	/// Clear all queued and current notifications.
	void clear() {
		_cancelTimer();
		_current = null;
		_queue.clear();
		_suggestionProviderMap.clear();
		notifyListeners();
	}

	void _showNext(AppSuggestion suggestion) {
		_current = suggestion;
		_startAutoDismissTimer();
		notifyListeners();
	}

	void _advanceQueue() {
		// Skip any queued suggestions that have expired while waiting
		while (_queue.isNotEmpty && _queue.first.isExpired) {
			_suggestionProviderMap.remove(_queue.first.id);
			_queue.removeFirst();
		}

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
