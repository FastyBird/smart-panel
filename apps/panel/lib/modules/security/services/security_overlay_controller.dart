import 'package:fastybird_smart_panel/modules/security/models/security_alert.dart';
import 'package:fastybird_smart_panel/modules/security/models/security_status.dart';
import 'package:fastybird_smart_panel/modules/security/repositories/security_status.dart';
import 'package:fastybird_smart_panel/modules/security/types/security.dart';
import 'package:flutter/foundation.dart';

/// Compare two alerts by timestamp desc, then id asc.
int _compareByTimestampThenId(SecurityAlertModel a, SecurityAlertModel b) {
	final timestampCompare = b.timestamp.compareTo(a.timestamp);
	if (timestampCompare != 0) return timestampCompare;

	return a.id.compareTo(b.id);
}

/// Pure function: sort alerts by severity desc, timestamp desc, id asc.
List<SecurityAlertModel> sortAlerts(List<SecurityAlertModel> alerts) {
	final sorted = List<SecurityAlertModel>.from(alerts);
	sorted.sort((a, b) {
		final severityCompare = b.severity.rank.compareTo(a.severity.rank);
		if (severityCompare != 0) return severityCompare;

		return _compareByTimestampThenId(a, b);
	});
	return sorted;
}

/// Sort alerts within a single severity group: timestamp desc, then id asc.
List<SecurityAlertModel> sortAlertsWithinGroup(List<SecurityAlertModel> alerts) {
	final sorted = List<SecurityAlertModel>.from(alerts);
	sorted.sort(_compareByTimestampThenId);
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

/// Build the effective acknowledged set by combining server flags with optimistic cache.
Set<String> buildEffectiveAcknowledgedIds(
	SecurityStatusModel status,
	Set<String> optimisticAckIds,
) {
	final ids = <String>{};

	bool allRealCriticalAcked = true;
	bool hasRealCriticalAlert = false;

	for (final alert in status.activeAlerts) {
		if (alert.acknowledged || optimisticAckIds.contains(alert.id)) {
			ids.add(alert.id);
		} else if (alert.severity == Severity.critical) {
			allRealCriticalAcked = false;
		}
		if (alert.severity == Severity.critical) {
			hasRealCriticalAlert = true;
		}
	}

	// Carry over synthetic IDs from optimistic cache
	for (final id in optimisticAckIds) {
		if (id.startsWith('__')) {
			ids.add(id);
		}
	}

	// When all real critical alerts are acknowledged (server-side or optimistic),
	// also mark synthetic critical IDs as acknowledged. This handles:
	// - The acknowledging display after optimistic cache is cleared by updateStatus()
	// - Other displays that receive the socket broadcast but never had optimistic cache
	if (hasRealCriticalAlert && allRealCriticalAcked) {
		final syntheticCriticalIds = getCriticalAlertIds(status).where((id) => id.startsWith('__'));
		ids.addAll(syntheticCriticalIds);
	}

	return ids;
}

/// Controller managing security overlay visibility state.
///
/// Combines security status, connection state, acknowledgement state,
/// and navigation state to determine overlay visibility.
/// Uses server `acknowledged` flags as source of truth, with an optimistic
/// cache for in-flight requests.
class SecurityOverlayController extends ChangeNotifier {
	final SecurityStatusRepository? _repository;

	SecurityStatusModel _status = SecurityStatusModel.empty;

	/// Optimistic cache: IDs acknowledged locally but not yet confirmed by server.
	/// Cleared when server status arrives.
	final Set<String> _optimisticAckIds = {};

	/// IDs currently being acknowledged (in-flight requests).
	final Set<String> _pendingAckIds = {};

	bool _isConnectionOffline = false;
	bool _isOnSecurityScreen = false;

	List<SecurityAlertModel>? _cachedSortedAlerts;
	Map<Severity, List<SecurityAlertModel>>? _cachedGroupedAlerts;

	SecurityOverlayController({SecurityStatusRepository? repository})
		: _repository = repository;

	SecurityStatusModel get status => _status;

	bool get isConnectionOffline => _isConnectionOffline;

	/// The effective set of acknowledged alert IDs (server + optimistic).
	Set<String> get _acknowledgedAlertIds => buildEffectiveAcknowledgedIds(_status, _optimisticAckIds);

	/// Whether all active alerts are acknowledged.
	bool get allAlertsAcknowledged {
		if (_status.activeAlerts.isEmpty) return false;

		return _status.activeAlerts.every(
			(alert) => alert.acknowledged || _optimisticAckIds.contains(alert.id),
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

	/// Check if a specific alert is acknowledged (server or optimistic).
	bool isAlertAcknowledged(String alertId) {
		// Check server flag first
		for (final alert in _status.activeAlerts) {
			if (alert.id == alertId) {
				return alert.acknowledged || _optimisticAckIds.contains(alertId);
			}
		}
		return _optimisticAckIds.contains(alertId);
	}

	void updateStatus(SecurityStatusModel newStatus) {
		// Clear optimistic cache: server state is now the truth.
		// Keep only IDs that are still pending (in-flight request).
		_optimisticAckIds.retainWhere((id) => _pendingAckIds.contains(id));

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

	/// Acknowledge a single alert by ID with optimistic update + API call.
	/// Falls back to local-only if no repository is available.
	Future<bool> acknowledgeAlert(String alertId) async {
		if (_isConnectionOffline) return false;

		// Optimistic update
		_optimisticAckIds.add(alertId);
		notifyListeners();

		if (_repository == null) return true;

		_pendingAckIds.add(alertId);

		try {
			await _repository.acknowledgeAlert(alertId);
			_pendingAckIds.remove(alertId);
			_optimisticAckIds.remove(alertId);
			// fetchStatus in repository already updates, but we need to sync
			return true;
		} catch (e) {
			_pendingAckIds.remove(alertId);
			_optimisticAckIds.remove(alertId);
			notifyListeners();

			if (kDebugMode) {
				debugPrint('[SECURITY MODULE] Error acknowledging alert $alertId: $e');
			}
			return false;
		}
	}

	/// Acknowledge all currently active alerts with optimistic update + API call.
	/// Falls back to local-only if no repository is available.
	Future<bool> acknowledgeAllAlerts() async {
		if (_isConnectionOffline) return false;

		// Optimistic update
		final idsToAck = <String>{};
		for (final alert in _status.activeAlerts) {
			idsToAck.add(alert.id);
		}
		// Also acknowledge synthetic critical IDs for overlay suppression
		final criticalIds = getCriticalAlertIds(_status);
		idsToAck.addAll(criticalIds);

		_optimisticAckIds.addAll(idsToAck);
		notifyListeners();

		if (_repository == null) return true;

		// Only real IDs are pending on the server
		final realIds = idsToAck.where((id) => !id.startsWith('__')).toSet();
		_pendingAckIds.addAll(realIds);

		try {
			await _repository.acknowledgeAllAlerts();
			_pendingAckIds.removeAll(realIds);
			// Remove only real IDs; synthetic IDs stay in optimistic cache
			// until the next updateStatus() clears them.
			_optimisticAckIds.removeAll(realIds);
			return true;
		} catch (e) {
			_pendingAckIds.removeAll(realIds);
			_optimisticAckIds.removeAll(idsToAck);
			notifyListeners();

			if (kDebugMode) {
				debugPrint('[SECURITY MODULE] Error acknowledging all alerts: $e');
			}
			return false;
		}
	}

	/// Acknowledge current critical alerts for overlay dismissal.
	/// Uses API if available, otherwise local optimistic only.
	Future<bool> acknowledgeCurrentAlerts() async {
		if (_isConnectionOffline) return false;

		final criticalIds = getCriticalAlertIds(_status);
		_optimisticAckIds.addAll(criticalIds);
		notifyListeners();

		if (_repository == null) return true;

		// Only real IDs are pending on the server
		final realIds = criticalIds.where((id) => !id.startsWith('__')).toSet();
		_pendingAckIds.addAll(realIds);

		try {
			await _repository.acknowledgeAllAlerts();
			_pendingAckIds.removeAll(realIds);
			// Remove only real IDs; synthetic IDs stay in optimistic cache
			// until the next updateStatus() clears them.
			_optimisticAckIds.removeAll(realIds);
			return true;
		} catch (e) {
			_pendingAckIds.removeAll(realIds);
			_optimisticAckIds.removeAll(criticalIds);
			notifyListeners();

			if (kDebugMode) {
				debugPrint('[SECURITY MODULE] Error acknowledging current alerts: $e');
			}
			return false;
		}
	}
}
