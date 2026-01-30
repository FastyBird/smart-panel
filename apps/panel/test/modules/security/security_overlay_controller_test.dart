import 'package:fastybird_smart_panel/modules/security/models/security_alert.dart';
import 'package:fastybird_smart_panel/modules/security/models/security_status.dart';
import 'package:fastybird_smart_panel/modules/security/services/security_overlay_controller.dart';
import 'package:fastybird_smart_panel/modules/security/types/security.dart';
import 'package:flutter_test/flutter_test.dart';

SecurityAlertModel _makeAlert({
	required String id,
	Severity severity = Severity.critical,
	SecurityAlertType type = SecurityAlertType.smoke,
	DateTime? timestamp,
}) {
	return SecurityAlertModel(
		id: id,
		type: type,
		severity: severity,
		timestamp: timestamp ?? DateTime(2025, 1, 1),
	);
}

SecurityStatusModel _makeStatus({
	bool hasCriticalAlert = false,
	Severity highestSeverity = Severity.info,
	AlarmState? alarmState,
	ArmedState? armedState,
	List<SecurityAlertModel> activeAlerts = const [],
}) {
	return SecurityStatusModel(
		armedState: armedState,
		alarmState: alarmState,
		highestSeverity: highestSeverity,
		activeAlertsCount: activeAlerts.length,
		hasCriticalAlert: hasCriticalAlert,
		activeAlerts: activeAlerts,
	);
}

void main() {
	group('sortAlerts', () {
		test('sorts by severity desc, timestamp desc, id asc', () {
			final alerts = [
				_makeAlert(id: 'b', severity: Severity.info, timestamp: DateTime(2025, 1, 2)),
				_makeAlert(id: 'a', severity: Severity.critical, timestamp: DateTime(2025, 1, 1)),
				_makeAlert(id: 'c', severity: Severity.critical, timestamp: DateTime(2025, 1, 2)),
				_makeAlert(id: 'd', severity: Severity.warning, timestamp: DateTime(2025, 1, 1)),
			];

			final sorted = sortAlerts(alerts);

			expect(sorted[0].id, 'c'); // critical, newest
			expect(sorted[1].id, 'a'); // critical, older
			expect(sorted[2].id, 'd'); // warning
			expect(sorted[3].id, 'b'); // info
		});

		test('stable sort with same severity and timestamp uses id asc', () {
			final ts = DateTime(2025, 1, 1);
			final alerts = [
				_makeAlert(id: 'z', severity: Severity.critical, timestamp: ts),
				_makeAlert(id: 'a', severity: Severity.critical, timestamp: ts),
				_makeAlert(id: 'm', severity: Severity.critical, timestamp: ts),
			];

			final sorted = sortAlerts(alerts);

			expect(sorted[0].id, 'a');
			expect(sorted[1].id, 'm');
			expect(sorted[2].id, 'z');
		});

		test('empty list returns empty', () {
			expect(sortAlerts([]), isEmpty);
		});
	});

	group('shouldShowSecurityOverlay', () {
		test('returns false when no critical condition', () {
			final result = shouldShowSecurityOverlay(
				status: _makeStatus(),
				acknowledgedAlertIds: {},
				isConnectionOffline: false,
				isOnSecurityScreen: false,
			);
			expect(result, false);
		});

		test('returns true when hasCriticalAlert is true with critical alerts', () {
			final result = shouldShowSecurityOverlay(
				status: _makeStatus(
					hasCriticalAlert: true,
					activeAlerts: [_makeAlert(id: 'a')],
				),
				acknowledgedAlertIds: {},
				isConnectionOffline: false,
				isOnSecurityScreen: false,
			);
			expect(result, true);
		});

		test('returns true when highestSeverity is critical with critical alerts', () {
			final result = shouldShowSecurityOverlay(
				status: _makeStatus(
					highestSeverity: Severity.critical,
					activeAlerts: [_makeAlert(id: 'a')],
				),
				acknowledgedAlertIds: {},
				isConnectionOffline: false,
				isOnSecurityScreen: false,
			);
			expect(result, true);
		});

		test('returns true when alarm is triggered even without alerts', () {
			final result = shouldShowSecurityOverlay(
				status: _makeStatus(
					alarmState: AlarmState.triggered,
				),
				acknowledgedAlertIds: {},
				isConnectionOffline: false,
				isOnSecurityScreen: false,
			);
			expect(result, true);
		});

		test('returns true when hasCriticalAlert is true but no alert entries', () {
			final result = shouldShowSecurityOverlay(
				status: _makeStatus(
					hasCriticalAlert: true,
				),
				acknowledgedAlertIds: {},
				isConnectionOffline: false,
				isOnSecurityScreen: false,
			);
			expect(result, true);
		});

		test('returns true when highestSeverity is critical but no alert entries', () {
			final result = shouldShowSecurityOverlay(
				status: _makeStatus(
					highestSeverity: Severity.critical,
				),
				acknowledgedAlertIds: {},
				isConnectionOffline: false,
				isOnSecurityScreen: false,
			);
			expect(result, true);
		});

		test('returns false when connection is offline', () {
			final result = shouldShowSecurityOverlay(
				status: _makeStatus(
					hasCriticalAlert: true,
					activeAlerts: [_makeAlert(id: 'a')],
				),
				acknowledgedAlertIds: {},
				isConnectionOffline: true,
				isOnSecurityScreen: false,
			);
			expect(result, false);
		});

		test('returns false when on security screen', () {
			final result = shouldShowSecurityOverlay(
				status: _makeStatus(
					hasCriticalAlert: true,
					activeAlerts: [_makeAlert(id: 'a')],
				),
				acknowledgedAlertIds: {},
				isConnectionOffline: false,
				isOnSecurityScreen: true,
			);
			expect(result, false);
		});

		test('returns false when all critical alerts are acknowledged', () {
			final result = shouldShowSecurityOverlay(
				status: _makeStatus(
					hasCriticalAlert: true,
					activeAlerts: [_makeAlert(id: 'a')],
				),
				acknowledgedAlertIds: {'a'},
				isConnectionOffline: false,
				isOnSecurityScreen: false,
			);
			expect(result, false);
		});

		test('returns true when some critical alerts are unacknowledged', () {
			final result = shouldShowSecurityOverlay(
				status: _makeStatus(
					hasCriticalAlert: true,
					activeAlerts: [
						_makeAlert(id: 'a'),
						_makeAlert(id: 'b'),
					],
				),
				acknowledgedAlertIds: {'a'},
				isConnectionOffline: false,
				isOnSecurityScreen: false,
			);
			expect(result, true);
		});
	});

	group('SecurityOverlayController', () {
		late SecurityOverlayController controller;

		setUp(() {
			controller = SecurityOverlayController();
		});

		tearDown(() {
			controller.dispose();
		});

		test('initially does not show overlay', () {
			expect(controller.shouldShowOverlay, false);
		});

		test('shows overlay when critical status arrives', () {
			controller.updateStatus(_makeStatus(
				hasCriticalAlert: true,
				activeAlerts: [_makeAlert(id: 'a')],
			));
			expect(controller.shouldShowOverlay, true);
		});

		test('acknowledge hides overlay', () {
			controller.updateStatus(_makeStatus(
				hasCriticalAlert: true,
				activeAlerts: [_makeAlert(id: 'a')],
			));
			expect(controller.shouldShowOverlay, true);

			controller.acknowledgeCurrentAlerts();
			expect(controller.shouldShowOverlay, false);
		});

		test('new critical alert re-shows overlay after acknowledgement', () {
			controller.updateStatus(_makeStatus(
				hasCriticalAlert: true,
				activeAlerts: [_makeAlert(id: 'a')],
			));
			controller.acknowledgeCurrentAlerts();
			expect(controller.shouldShowOverlay, false);

			// New alert appears
			controller.updateStatus(_makeStatus(
				hasCriticalAlert: true,
				activeAlerts: [
					_makeAlert(id: 'a'),
					_makeAlert(id: 'b'),
				],
			));
			expect(controller.shouldShowOverlay, true);
		});

		test('alarm triggered shows overlay even without alerts', () {
			controller.updateStatus(_makeStatus(
				alarmState: AlarmState.triggered,
			));
			expect(controller.shouldShowOverlay, true);
		});

		test('alarm triggered can be acknowledged', () {
			controller.updateStatus(_makeStatus(
				alarmState: AlarmState.triggered,
			));
			controller.acknowledgeCurrentAlerts();
			expect(controller.shouldShowOverlay, false);
		});

		test('setConnectionOffline suppresses overlay', () {
			controller.updateStatus(_makeStatus(
				hasCriticalAlert: true,
				activeAlerts: [_makeAlert(id: 'a')],
			));
			expect(controller.shouldShowOverlay, true);

			controller.setConnectionOffline(true);
			expect(controller.shouldShowOverlay, false);

			controller.setConnectionOffline(false);
			expect(controller.shouldShowOverlay, true);
		});

		test('setOnSecurityScreen suppresses overlay', () {
			controller.updateStatus(_makeStatus(
				hasCriticalAlert: true,
				activeAlerts: [_makeAlert(id: 'a')],
			));
			expect(controller.shouldShowOverlay, true);

			controller.setOnSecurityScreen(true);
			expect(controller.shouldShowOverlay, false);

			controller.setOnSecurityScreen(false);
			expect(controller.shouldShowOverlay, true);
		});

		test('topAlert returns highest priority alert', () {
			controller.updateStatus(_makeStatus(
				hasCriticalAlert: true,
				activeAlerts: [
					_makeAlert(
						id: 'b',
						severity: Severity.warning,
						type: SecurityAlertType.waterLeak,
					),
					_makeAlert(
						id: 'a',
						severity: Severity.critical,
						type: SecurityAlertType.smoke,
					),
				],
			));

			expect(controller.topAlert?.id, 'a');
			expect(controller.topAlert?.type, SecurityAlertType.smoke);
		});

		test('overlayTitle reflects top alert type', () {
			controller.updateStatus(_makeStatus(
				hasCriticalAlert: true,
				activeAlerts: [
					_makeAlert(id: 'a', type: SecurityAlertType.co),
				],
			));
			expect(controller.overlayTitle, 'CO detected');
		});

		test('overlayTitle shows alarm triggered when no alerts', () {
			controller.updateStatus(_makeStatus(
				alarmState: AlarmState.triggered,
			));
			expect(controller.overlayTitle, 'Alarm triggered');
		});

		test('overlayAlerts returns max 3', () {
			controller.updateStatus(_makeStatus(
				hasCriticalAlert: true,
				activeAlerts: [
					_makeAlert(id: 'a'),
					_makeAlert(id: 'b'),
					_makeAlert(id: 'c'),
					_makeAlert(id: 'd'),
					_makeAlert(id: 'e'),
				],
			));
			expect(controller.overlayAlerts.length, 3);
		});

		test('notifies listeners on status change', () {
			int notifyCount = 0;
			controller.addListener(() => notifyCount++);

			controller.updateStatus(_makeStatus(
				hasCriticalAlert: true,
				activeAlerts: [_makeAlert(id: 'a')],
			));

			expect(notifyCount, 1);
		});
	});
}
