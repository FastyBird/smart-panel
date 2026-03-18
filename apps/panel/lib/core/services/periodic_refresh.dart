import 'dart:async';

import 'package:fastybird_smart_panel/core/services/socket.dart';
import 'package:flutter/foundation.dart';

/// Entry holding a module's name and its refresh callback.
class _RefreshEntry {
	final String name;
	final Future<void> Function() callback;

	_RefreshEntry({required this.name, required this.callback});
}

/// Periodically re-fetches module data as a safety net for missed socket
/// events (network blips, reconnections, backend restarts).
///
/// Modules register their refresh callbacks via [register].  A single
/// [Timer.periodic] drives the cycle; individual modules are called
/// sequentially with a short stagger to avoid API spikes.
///
/// An immediate refresh is also triggered when the socket reconnects.
class PeriodicRefreshService {
	final SocketService _socketService;
	final Duration _interval;
	final Duration _stagger;

	Timer? _timer;
	final List<_RefreshEntry> _entries = [];
	bool _refreshInProgress = false;
	bool _disposed = false;

	PeriodicRefreshService({
		required SocketService socketService,
		Duration interval = const Duration(minutes: 5),
		Duration stagger = const Duration(seconds: 2),
	})  : _socketService = socketService,
			_interval = interval,
			_stagger = stagger;

	/// Register a module refresh callback.
	///
	/// [name] is used only for logging.
	void register(String name, Future<void> Function() callback) {
		_entries.add(_RefreshEntry(name: name, callback: callback));
	}

	/// Start the periodic timer and listen for reconnections.
	void start() {
		_timer?.cancel();
		_socketService.addConnectionListener(_onConnectionChanged);
		_timer = Timer.periodic(_interval, (_) => _runRefreshCycle());

		if (kDebugMode) {
			debugPrint(
				'[PERIODIC REFRESH] Started — ${_entries.length} modules, '
				'interval ${_interval.inSeconds}s',
			);
		}
	}

	/// Connection state callback — triggers an immediate refresh after the
	/// socket reconnects (with a short delay so event handlers re-register).
	void _onConnectionChanged(bool isConnected) {
		if (_disposed) return;

		if (isConnected) {
			Future.delayed(const Duration(seconds: 3), () {
				if (!_disposed && _socketService.isConnected) {
					if (kDebugMode) {
						debugPrint('[PERIODIC REFRESH] Socket reconnected — refreshing');
					}
					_runRefreshCycle();
				}
			});
		}
	}

	/// Run one refresh cycle: call each registered callback sequentially
	/// with a stagger delay, skipping when disconnected.
	///
	/// A snapshot of [_entries] is taken at the start so that a concurrent
	/// [dispose] (which clears the list) cannot cause a
	/// [ConcurrentModificationError] while we are suspended on an `await`.
	Future<void> _runRefreshCycle() async {
		if (_refreshInProgress || _disposed) return;
		if (!_socketService.isConnected) return;

		_refreshInProgress = true;

		if (kDebugMode) {
			debugPrint('[PERIODIC REFRESH] Starting refresh cycle');
		}

		// Snapshot so dispose() can safely clear _entries mid-cycle.
		final snapshot = List<_RefreshEntry>.of(_entries);

		for (final entry in snapshot) {
			if (_disposed || !_socketService.isConnected) break;

			try {
				await entry.callback();

				if (kDebugMode) {
					debugPrint('[PERIODIC REFRESH] ${entry.name} — done');
				}
			} catch (e) {
				if (kDebugMode) {
					debugPrint('[PERIODIC REFRESH] ${entry.name} — failed: $e');
				}
			}

			// Stagger between modules to spread API load
			if (!_disposed && _socketService.isConnected) {
				await Future.delayed(_stagger);
			}
		}

		_refreshInProgress = false;

		if (kDebugMode) {
			debugPrint('[PERIODIC REFRESH] Cycle complete');
		}
	}

	/// Stop the timer and clean up.
	void dispose() {
		_disposed = true;
		_timer?.cancel();
		_timer = null;
		_socketService.removeConnectionListener(_onConnectionChanged);
		_entries.clear();
	}
}
