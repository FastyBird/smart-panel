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
	final criticalAlertIds = _getCriticalAlertIds(status);
	final unacknowledged = criticalAlertIds.difference(acknowledgedAlertIds);

	return unacknowledged.isNotEmpty;
}

/// Pure function: get the set of alert IDs that contribute to critical condition.
Set<String> _getCriticalAlertIds(SecurityStatusModel status) {
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
class SecurityOverlayController extends ChangeNotifier {
	SecurityStatusModel _status = SecurityStatusModel.empty;
	final Set<String> _acknowledgedAlertIds = {};
	bool _isConnectionOffline = false;
	bool _isOnSecurityScreen = false;

	SecurityStatusModel get status => _status;

	bool get shouldShowOverlay => shouldShowSecurityOverlay(
		status: _status,
		acknowledgedAlertIds: _acknowledgedAlertIds,
		isConnectionOffline: _isConnectionOffline,
		isOnSecurityScreen: _isOnSecurityScreen,
	);

	/// Sorted alerts (critical first, then by timestamp desc, then id asc).
	List<SecurityAlertModel> get sortedAlerts => sortAlerts(_status.activeAlerts);

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

	void updateStatus(SecurityStatusModel newStatus) {
		final oldCriticalIds = _getCriticalAlertIds(_status);
		final newCriticalIds = _getCriticalAlertIds(newStatus);

		// If new critical alerts appeared, clear acknowledgements for them
		// so the overlay re-shows
		final newUnseenCritical = newCriticalIds.difference(oldCriticalIds);
		if (newUnseenCritical.isNotEmpty) {
			_acknowledgedAlertIds.removeAll(newUnseenCritical);
		}

		_status = newStatus;
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

	/// Acknowledge current critical alerts (dismiss overlay for current session).
	void acknowledgeCurrentAlerts() {
		final criticalIds = _getCriticalAlertIds(_status);
		_acknowledgedAlertIds.addAll(criticalIds);
		notifyListeners();
	}
}
