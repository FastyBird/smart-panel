import 'package:fastybird_smart_panel/modules/security/models/security_alert.dart';
import 'package:fastybird_smart_panel/modules/security/models/security_status.dart';
import 'package:fastybird_smart_panel/modules/security/types/security.dart';
import 'package:flutter/foundation.dart';

/// Pure function: sort alerts by severity desc, timestamp desc, id asc.
List<SecurityAlertModel> sortAlerts(List<SecurityAlertModel> alerts) {
	final sorted = List<SecurityAlertModel>.from(alerts);
	sorted.sort((a, b) {
		final severityCompare = b.severity.rank.compareTo(a.severity.rank);
		if (severityCompare != 0) return severityCompare;

		final timestampCompare = b.timestamp.compareTo(a.timestamp);
		if (timestampCompare != 0) return timestampCompare;

		return a.id.compareTo(b.id);
	});
	return sorted;
}

/// Sort alerts within a single severity group: timestamp desc, then id asc.
List<SecurityAlertModel> sortAlertsWithinGroup(List<SecurityAlertModel> alerts) {
	final sorted = List<SecurityAlertModel>.from(alerts);
	sorted.sort((a, b) {
		final timestampCompare = b.timestamp.compareTo(a.timestamp);
		if (timestampCompare != 0) return timestampCompare;

		return a.id.compareTo(b.id);
	});
	return sorted;
}

/// Group alerts by severity into ordered sections: Critical, Warning, Info.
/// Each group is sorted by timestamp desc, then id asc.
/// Empty groups are excluded.
Map<Severity, List<SecurityAlertModel>> groupAlertsBySeverity(
	List<SecurityAlertModel> alerts,
) {
	final groups = <Severity, List<SecurityAlertModel>>{};

	for (final alert in alerts) {
		(groups[alert.severity] ??= []).add(alert);
	}

	final result = <Severity, List<SecurityAlertModel>>{};

	// Ordered: critical, warning, info
	for (final severity in [Severity.critical, Severity.warning, Severity.info]) {
		final group = groups[severity];
		if (group != null && group.isNotEmpty) {
			result[severity] = sortAlertsWithinGroup(group);
		}
	}

	return result;
}

/// Pure function: determine if overlay should be visible.
///
/// Returns true when critical alerts are active and not fully acknowledged,
/// connection is online (not fullscreen error), and user is not on security screen.
bool shouldShowSecurityOverlay({
	required SecurityStatusModel status,
	required Set<String> acknowledgedAlertIds,
	required bool isConnectionOffline,
	required bool isOnSecurityScreen,
}) {
	if (isConnectionOffline) return false;
	if (isOnSecurityScreen) return false;

	if (!_hasCriticalCondition(status)) return false;

	// Check if there are unacknowledged critical alerts
	final criticalAlertIds = getCriticalAlertIds(status);
	final unacknowledged = criticalAlertIds.difference(acknowledgedAlertIds);

	return unacknowledged.isNotEmpty;
}

/// Pure function: get the set of alert IDs that contribute to critical condition.
Set<String> getCriticalAlertIds(SecurityStatusModel status) {
	final ids = <String>{};

	for (final alert in status.activeAlerts) {
		if (alert.severity == Severity.critical) {
			ids.add(alert.id);
		}
	}

	// If alarm triggered, add a synthetic id
	if (status.alarmState == AlarmState.triggered) {
		ids.add('__alarm_triggered__');
	}

	// If backend reports critical condition but no matching alerts/alarm,
	// add a synthetic id so the overlay can still show and be acknowledged
	if (ids.isEmpty && (status.hasCriticalAlert || status.highestSeverity == Severity.critical)) {
		ids.add('__critical_status__');
	}

	return ids;
}

/// Pure function: check if the status has any critical condition.
bool _hasCriticalCondition(SecurityStatusModel status) {
	if (status.hasCriticalAlert) return true;
	if (status.highestSeverity == Severity.critical) return true;
	if (status.alarmState == AlarmState.triggered) return true;

	for (final alert in status.activeAlerts) {
		if (alert.severity == Severity.critical) return true;
	}

	return false;
}

/// Controller managing security overlay visibility state.
///
/// Combines security status, connection state, acknowledgement state,
/// and navigation state to determine overlay visibility.
/// Also manages per-alert acknowledgement with timestamp-based reset.
class SecurityOverlayController extends ChangeNotifier {
	SecurityStatusModel _status = SecurityStatusModel.empty;
	final Set<String> _acknowledgedAlertIds = {};
	final Map<String, DateTime> _lastSeenTimestamps = {};
	bool _isConnectionOffline = false;
	bool _isOnSecurityScreen = false;

	List<SecurityAlertModel>? _cachedSortedAlerts;
	Map<Severity, List<SecurityAlertModel>>? _cachedGroupedAlerts;

	SecurityStatusModel get status => _status;

	/// Set of currently acknowledged alert IDs (read-only view).
	Set<String> get acknowledgedAlertIds => Set.unmodifiable(_acknowledgedAlertIds);

	/// Whether all active alerts are acknowledged.
	bool get allAlertsAcknowledged {
		if (_status.activeAlerts.isEmpty) return false;

		return _status.activeAlerts.every(
			(alert) => _acknowledgedAlertIds.contains(alert.id),
		);
	}

	bool get shouldShowOverlay => shouldShowSecurityOverlay(
		status: _status,
		acknowledgedAlertIds: _acknowledgedAlertIds,
		isConnectionOffline: _isConnectionOffline,
		isOnSecurityScreen: _isOnSecurityScreen,
	);

	/// Sorted alerts (critical first, then by timestamp desc, then id asc).
	/// Cached and invalidated when status changes.
	List<SecurityAlertModel> get sortedAlerts {
		return _cachedSortedAlerts ??= sortAlerts(_status.activeAlerts);
	}

	/// Alerts grouped by severity. Cached and invalidated when status changes.
	Map<Severity, List<SecurityAlertModel>> get groupedAlerts {
		return _cachedGroupedAlerts ??= groupAlertsBySeverity(_status.activeAlerts);
	}

	/// Top alert after sorting (first item), or null if no alerts.
	SecurityAlertModel? get topAlert {
		final sorted = sortedAlerts;
		return sorted.isEmpty ? null : sorted.first;
	}

	/// Up to 3 alerts for overlay display.
	List<SecurityAlertModel> get overlayAlerts {
		final sorted = sortedAlerts;
		return sorted.length <= 3 ? sorted : sorted.sublist(0, 3);
	}

	/// Title for overlay based on top alert or alarm state.
	String get overlayTitle {
		if (_status.alarmState == AlarmState.triggered && topAlert == null) {
			return 'Alarm triggered';
		}
		return topAlert?.type.displayTitle ?? 'Security alert';
	}

	/// Check if a specific alert is acknowledged.
	bool isAlertAcknowledged(String alertId) {
		return _acknowledgedAlertIds.contains(alertId);
	}

	void updateStatus(SecurityStatusModel newStatus) {
		final oldCriticalIds = getCriticalAlertIds(_status);
		final newCriticalIds = getCriticalAlertIds(newStatus);

		// Build set of current alert IDs for cleanup
		final currentAlertIds = newStatus.activeAlerts.map((a) => a.id).toSet();

		// Remove acknowledged IDs for alerts that no longer exist
		_acknowledgedAlertIds.retainWhere(
			(id) => currentAlertIds.contains(id) || id.startsWith('__'),
		);

		// Reset acknowledgement for alerts that reappeared with newer timestamp
		for (final alert in newStatus.activeAlerts) {
			final lastSeen = _lastSeenTimestamps[alert.id];
			if (lastSeen != null && alert.timestamp.isAfter(lastSeen)) {
				_acknowledgedAlertIds.remove(alert.id);
			}
		}

		// Update last-seen timestamps
		_lastSeenTimestamps.clear();
		for (final alert in newStatus.activeAlerts) {
			_lastSeenTimestamps[alert.id] = alert.timestamp;
		}

		// If new critical alerts appeared, clear acknowledgements for them
		// so the overlay re-shows
		final newUnseenCritical = newCriticalIds.difference(oldCriticalIds);
		if (newUnseenCritical.isNotEmpty) {
			_acknowledgedAlertIds.removeAll(newUnseenCritical);
		}

		_status = newStatus;
		_cachedSortedAlerts = null;
		_cachedGroupedAlerts = null;
		notifyListeners();
	}

	void setConnectionOffline(bool offline) {
		if (_isConnectionOffline == offline) return;
		_isConnectionOffline = offline;
		notifyListeners();
	}

	void setOnSecurityScreen(bool onScreen) {
		if (_isOnSecurityScreen == onScreen) return;
		_isOnSecurityScreen = onScreen;
		notifyListeners();
	}

	/// Acknowledge a single alert by ID.
	void acknowledgeAlert(String alertId) {
		if (_acknowledgedAlertIds.add(alertId)) {
			notifyListeners();
		}
	}

	/// Acknowledge all currently active alerts.
	void acknowledgeAllAlerts() {
		bool changed = false;
		for (final alert in _status.activeAlerts) {
			if (_acknowledgedAlertIds.add(alert.id)) {
				changed = true;
			}
		}
		// Also acknowledge synthetic critical IDs for overlay suppression
		final criticalIds = getCriticalAlertIds(_status);
		for (final id in criticalIds) {
			if (_acknowledgedAlertIds.add(id)) {
				changed = true;
			}
		}
		if (changed) {
			notifyListeners();
		}
	}

	/// Acknowledge current critical alerts (dismiss overlay for current session).
	void acknowledgeCurrentAlerts() {
		final criticalIds = getCriticalAlertIds(_status);
		_acknowledgedAlertIds.addAll(criticalIds);
		notifyListeners();
	}
}
