import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations_en.dart';
import 'package:fastybird_smart_panel/modules/security/models/security_alert.dart';
import 'package:fastybird_smart_panel/modules/security/models/security_status.dart';
import 'package:fastybird_smart_panel/modules/security/services/security_overlay_controller.dart';
import 'package:fastybird_smart_panel/modules/security/types/security.dart';
import 'package:flutter_test/flutter_test.dart';

final AppLocalizations _localizations = AppLocalizationsEn();

SecurityAlertModel _makeAlert({
	required String id,
	Severity severity = Severity.critical,
	SecurityAlertType type = SecurityAlertType.smoke,
	DateTime? timestamp,
	bool acknowledged = false,
}) {
	return SecurityAlertModel(
		id: id,
		type: type,
		severity: severity,
		timestamp: timestamp ?? DateTime(2025, 1, 1),
		acknowledged: acknowledged,
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

	group('groupAlertsBySeverity', () {
		test('groups alerts into severity sections in correct order', () {
			final alerts = [
				_makeAlert(id: 'i1', severity: Severity.info, timestamp: DateTime(2025, 1, 1)),
				_makeAlert(id: 'c1', severity: Severity.critical, timestamp: DateTime(2025, 1, 1)),
				_makeAlert(id: 'w1', severity: Severity.warning, timestamp: DateTime(2025, 1, 1)),
				_makeAlert(id: 'c2', severity: Severity.critical, timestamp: DateTime(2025, 1, 2)),
			];

			final grouped = groupAlertsBySeverity(alerts);

			expect(grouped.keys.toList(), [Severity.critical, Severity.warning, Severity.info]);
			expect(grouped[Severity.critical]!.length, 2);
			expect(grouped[Severity.warning]!.length, 1);
			expect(grouped[Severity.info]!.length, 1);
		});

		test('excludes empty severity groups', () {
			final alerts = [
				_makeAlert(id: 'c1', severity: Severity.critical),
				_makeAlert(id: 'i1', severity: Severity.info),
			];

			final grouped = groupAlertsBySeverity(alerts);

			expect(grouped.containsKey(Severity.warning), false);
			expect(grouped.keys.toList(), [Severity.critical, Severity.info]);
		});

		test('sorts within each group by timestamp desc then id asc', () {
			final alerts = [
				_makeAlert(id: 'c2', severity: Severity.critical, timestamp: DateTime(2025, 1, 1)),
				_makeAlert(id: 'c1', severity: Severity.critical, timestamp: DateTime(2025, 1, 2)),
				_makeAlert(id: 'c3', severity: Severity.critical, timestamp: DateTime(2025, 1, 2)),
			];

			final grouped = groupAlertsBySeverity(alerts);
			final critical = grouped[Severity.critical]!;

			// c1 and c3 have same timestamp (newest), c1 < c3 by id
			expect(critical[0].id, 'c1');
			expect(critical[1].id, 'c3');
			expect(critical[2].id, 'c2');
		});

		test('empty list returns empty map', () {
			expect(groupAlertsBySeverity([]), isEmpty);
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

	group('buildEffectiveAcknowledgedIds', () {
		test('includes server acknowledged alerts', () {
			final status = _makeStatus(
				activeAlerts: [
					_makeAlert(id: 'a', acknowledged: true),
					_makeAlert(id: 'b', acknowledged: false),
				],
			);

			final ids = buildEffectiveAcknowledgedIds(status, {});
			expect(ids, {'a'});
		});

		test('includes optimistic ack IDs', () {
			final status = _makeStatus(
				activeAlerts: [
					_makeAlert(id: 'a', acknowledged: false),
					_makeAlert(id: 'b', acknowledged: false),
				],
			);

			final ids = buildEffectiveAcknowledgedIds(status, {'b'});
			expect(ids, {'b'});
		});

		test('merges server and optimistic', () {
			final status = _makeStatus(
				activeAlerts: [
					_makeAlert(id: 'a', acknowledged: true),
					_makeAlert(id: 'b', acknowledged: false),
				],
			);

			final ids = buildEffectiveAcknowledgedIds(status, {'b'});
			expect(ids, {'a', 'b'});
		});

		test('includes synthetic IDs from optimistic cache', () {
			final status = _makeStatus(
				activeAlerts: [_makeAlert(id: 'a', acknowledged: true)],
			);

			final ids = buildEffectiveAcknowledgedIds(status, {'__alarm_triggered__'});
			expect(ids, {'a', '__alarm_triggered__'});
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

		test('acknowledge hides overlay', () async {
			controller.updateStatus(_makeStatus(
				hasCriticalAlert: true,
				activeAlerts: [_makeAlert(id: 'a')],
			));
			expect(controller.shouldShowOverlay, true);

			await controller.acknowledgeCurrentAlerts();
			expect(controller.shouldShowOverlay, false);
		});

		test('new critical alert re-shows overlay after acknowledgement', () async {
			controller.updateStatus(_makeStatus(
				hasCriticalAlert: true,
				activeAlerts: [_makeAlert(id: 'a')],
			));
			await controller.acknowledgeCurrentAlerts();
			expect(controller.shouldShowOverlay, false);

			// New alert appears — server state replaces optimistic
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

		test('alarm triggered can be acknowledged', () async {
			controller.updateStatus(_makeStatus(
				alarmState: AlarmState.triggered,
			));
			await controller.acknowledgeCurrentAlerts();
			expect(controller.shouldShowOverlay, false);
		});

		test('alarm triggered ack with synthetic ID persists after API success', () async {
			// When alarm is triggered with no real alerts, only a synthetic ID exists.
			// After API call succeeds, the synthetic ID must remain in optimistic cache
			// so the overlay stays suppressed until the next updateStatus().
			controller.updateStatus(_makeStatus(
				alarmState: AlarmState.triggered,
			));
			expect(controller.shouldShowOverlay, true);

			await controller.acknowledgeCurrentAlerts();
			// Overlay must stay hidden — synthetic ID kept in optimistic cache
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
			expect(controller.overlayTitle(_localizations), 'CO detected');
		});

		test('overlayTitle shows alarm triggered when no alerts', () {
			controller.updateStatus(_makeStatus(
				alarmState: AlarmState.triggered,
			));
			expect(controller.overlayTitle(_localizations), 'Alarm triggered');
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

	group('SecurityOverlayController - groupedAlerts', () {
		late SecurityOverlayController controller;

		setUp(() {
			controller = SecurityOverlayController();
		});

		tearDown(() {
			controller.dispose();
		});

		test('returns grouped alerts by severity', () {
			controller.updateStatus(_makeStatus(
				hasCriticalAlert: true,
				activeAlerts: [
					_makeAlert(id: 'c1', severity: Severity.critical),
					_makeAlert(id: 'w1', severity: Severity.warning),
					_makeAlert(id: 'i1', severity: Severity.info),
				],
			));

			final grouped = controller.groupedAlerts;
			expect(grouped.keys.toList(), [Severity.critical, Severity.warning, Severity.info]);
			expect(grouped[Severity.critical]!.length, 1);
		});

		test('grouped alerts cache is invalidated on status update', () {
			controller.updateStatus(_makeStatus(
				activeAlerts: [_makeAlert(id: 'a', severity: Severity.info)],
			));
			final first = controller.groupedAlerts;
			expect(first.length, 1);

			controller.updateStatus(_makeStatus(
				hasCriticalAlert: true,
				activeAlerts: [
					_makeAlert(id: 'a', severity: Severity.info),
					_makeAlert(id: 'b', severity: Severity.critical),
				],
			));
			final second = controller.groupedAlerts;
			expect(second.length, 2);
		});
	});

	group('SecurityOverlayController - per-alert acknowledgement', () {
		late SecurityOverlayController controller;

		setUp(() {
			controller = SecurityOverlayController();
		});

		tearDown(() {
			controller.dispose();
		});

		test('acknowledgeAlert marks single alert (optimistic)', () async {
			controller.updateStatus(_makeStatus(
				hasCriticalAlert: true,
				activeAlerts: [
					_makeAlert(id: 'a'),
					_makeAlert(id: 'b'),
				],
			));

			await controller.acknowledgeAlert('a');
			expect(controller.isAlertAcknowledged('a'), true);
			expect(controller.isAlertAcknowledged('b'), false);
		});

		test('acknowledgeAllAlerts marks all alerts (optimistic)', () async {
			controller.updateStatus(_makeStatus(
				hasCriticalAlert: true,
				activeAlerts: [
					_makeAlert(id: 'a'),
					_makeAlert(id: 'b'),
					_makeAlert(id: 'c', severity: Severity.warning),
				],
			));

			await controller.acknowledgeAllAlerts();
			expect(controller.isAlertAcknowledged('a'), true);
			expect(controller.isAlertAcknowledged('b'), true);
			expect(controller.isAlertAcknowledged('c'), true);
		});

		test('allAlertsAcknowledged returns true when all active alerts are acked', () async {
			controller.updateStatus(_makeStatus(
				hasCriticalAlert: true,
				activeAlerts: [
					_makeAlert(id: 'a'),
					_makeAlert(id: 'b'),
				],
			));

			expect(controller.allAlertsAcknowledged, false);

			await controller.acknowledgeAlert('a');
			expect(controller.allAlertsAcknowledged, false);

			await controller.acknowledgeAlert('b');
			expect(controller.allAlertsAcknowledged, true);
		});

		test('allAlertsAcknowledged returns false when no alerts', () {
			controller.updateStatus(_makeStatus());
			expect(controller.allAlertsAcknowledged, false);
		});

		test('acknowledgeAlert notifies listeners', () async {
			controller.updateStatus(_makeStatus(
				activeAlerts: [_makeAlert(id: 'a', severity: Severity.info)],
			));

			int notifyCount = 0;
			controller.addListener(() => notifyCount++);

			await controller.acknowledgeAlert('a');
			expect(notifyCount, 1);
		});
	});

	group('SecurityOverlayController - server acknowledged flags', () {
		late SecurityOverlayController controller;

		setUp(() {
			controller = SecurityOverlayController();
		});

		tearDown(() {
			controller.dispose();
		});

		test('isAlertAcknowledged uses server acknowledged flag', () {
			controller.updateStatus(_makeStatus(
				hasCriticalAlert: true,
				activeAlerts: [
					_makeAlert(id: 'a', acknowledged: true),
					_makeAlert(id: 'b', acknowledged: false),
				],
			));

			expect(controller.isAlertAcknowledged('a'), true);
			expect(controller.isAlertAcknowledged('b'), false);
		});

		test('overlay hidden when all critical alerts acknowledged on server', () {
			controller.updateStatus(_makeStatus(
				hasCriticalAlert: true,
				activeAlerts: [
					_makeAlert(id: 'a', severity: Severity.critical, acknowledged: true),
					_makeAlert(id: 'b', severity: Severity.critical, acknowledged: true),
				],
			));

			expect(controller.shouldShowOverlay, false);
		});

		test('overlay shows when some critical alerts unacknowledged on server', () {
			controller.updateStatus(_makeStatus(
				hasCriticalAlert: true,
				activeAlerts: [
					_makeAlert(id: 'a', severity: Severity.critical, acknowledged: true),
					_makeAlert(id: 'b', severity: Severity.critical, acknowledged: false),
				],
			));

			expect(controller.shouldShowOverlay, true);
		});

		test('allAlertsAcknowledged uses server flags', () {
			controller.updateStatus(_makeStatus(
				hasCriticalAlert: true,
				activeAlerts: [
					_makeAlert(id: 'a', acknowledged: true),
					_makeAlert(id: 'b', acknowledged: true),
				],
			));

			expect(controller.allAlertsAcknowledged, true);
		});

		test('server update clears optimistic cache', () async {
			controller.updateStatus(_makeStatus(
				hasCriticalAlert: true,
				activeAlerts: [_makeAlert(id: 'a')],
			));

			// Optimistic ack
			await controller.acknowledgeAlert('a');
			expect(controller.isAlertAcknowledged('a'), true);

			// Server update arrives with acknowledged=false (e.g. ack didn't persist)
			controller.updateStatus(_makeStatus(
				hasCriticalAlert: true,
				activeAlerts: [_makeAlert(id: 'a', acknowledged: false)],
			));

			// Optimistic cleared, server says not acknowledged
			expect(controller.isAlertAcknowledged('a'), false);
		});

		test('server update with acknowledged=true reflects correctly', () async {
			controller.updateStatus(_makeStatus(
				hasCriticalAlert: true,
				activeAlerts: [_makeAlert(id: 'a')],
			));

			// Server update arrives confirming ack
			controller.updateStatus(_makeStatus(
				hasCriticalAlert: true,
				activeAlerts: [_makeAlert(id: 'a', acknowledged: true)],
			));

			expect(controller.isAlertAcknowledged('a'), true);
		});

		test('overlay reappears when new unacknowledged critical alert arrives', () {
			// All critical acknowledged on server
			controller.updateStatus(_makeStatus(
				hasCriticalAlert: true,
				activeAlerts: [
					_makeAlert(id: 'a', severity: Severity.critical, acknowledged: true),
				],
			));
			expect(controller.shouldShowOverlay, false);

			// New unacknowledged critical alert
			controller.updateStatus(_makeStatus(
				hasCriticalAlert: true,
				activeAlerts: [
					_makeAlert(id: 'a', severity: Severity.critical, acknowledged: true),
					_makeAlert(id: 'b', severity: Severity.critical, acknowledged: false),
				],
			));
			expect(controller.shouldShowOverlay, true);
		});
	});

	group('SecurityOverlayController - synthetic ID auto-ack', () {
		late SecurityOverlayController controller;

		setUp(() {
			controller = SecurityOverlayController();
		});

		tearDown(() {
			controller.dispose();
		});

		test('overlay stays hidden after ack when server confirms real alerts acknowledged', () async {
			// Simulate: alarm triggered + real critical alert
			controller.updateStatus(_makeStatus(
				hasCriticalAlert: true,
				alarmState: AlarmState.triggered,
				activeAlerts: [_makeAlert(id: 'a', severity: Severity.critical)],
			));
			expect(controller.shouldShowOverlay, true);

			// User taps ack (optimistic)
			await controller.acknowledgeCurrentAlerts();
			expect(controller.shouldShowOverlay, false);

			// Server status arrives (e.g. from fetchStatus or socket) with real alert acked
			// but synthetic __alarm_triggered__ was cleared from optimistic cache by updateStatus
			controller.updateStatus(_makeStatus(
				hasCriticalAlert: true,
				alarmState: AlarmState.triggered,
				activeAlerts: [_makeAlert(id: 'a', severity: Severity.critical, acknowledged: true)],
			));

			// Must stay hidden: all real critical alerts are acked, so synthetic IDs auto-ack
			expect(controller.shouldShowOverlay, false);
		});

		test('second display hides overlay when server reports all critical alerts acknowledged', () {
			// Second display never had optimistic cache - receives socket update directly
			controller.updateStatus(_makeStatus(
				hasCriticalAlert: true,
				alarmState: AlarmState.triggered,
				activeAlerts: [_makeAlert(id: 'a', severity: Severity.critical, acknowledged: true)],
			));

			// All real critical alerts are server-acked, synthetic IDs should auto-ack
			expect(controller.shouldShowOverlay, false);
		});

		test('overlay still shows if some real critical alerts unacknowledged', () {
			controller.updateStatus(_makeStatus(
				hasCriticalAlert: true,
				alarmState: AlarmState.triggered,
				activeAlerts: [
					_makeAlert(id: 'a', severity: Severity.critical, acknowledged: true),
					_makeAlert(id: 'b', severity: Severity.critical, acknowledged: false),
				],
			));

			expect(controller.shouldShowOverlay, true);
		});

		test('buildEffectiveAcknowledgedIds includes synthetic IDs when all real critical acked', () {
			final status = _makeStatus(
				hasCriticalAlert: true,
				alarmState: AlarmState.triggered,
				activeAlerts: [
					_makeAlert(id: 'a', severity: Severity.critical, acknowledged: true),
				],
			);

			final ids = buildEffectiveAcknowledgedIds(status, {});
			expect(ids, contains('a'));
			expect(ids, contains('__alarm_triggered__'));
		});
	});

	group('SecurityOverlayController - pure-synthetic ack after updateStatus', () {
		late SecurityOverlayController controller;

		setUp(() {
			controller = SecurityOverlayController();
		});

		tearDown(() {
			controller.dispose();
		});

		test('alarm-only ack stays hidden after updateStatus clears optimistic cache', () async {
			// Alarm triggered with no real alerts — only synthetic __alarm_triggered__
			controller.updateStatus(_makeStatus(
				alarmState: AlarmState.triggered,
			));
			expect(controller.shouldShowOverlay, true);

			await controller.acknowledgeCurrentAlerts();
			expect(controller.shouldShowOverlay, false);

			// Simulate server status arriving (fetchStatus or socket) which clears optimistic cache
			controller.updateStatus(_makeStatus(
				alarmState: AlarmState.triggered,
			));

			// Must stay hidden: no real critical alerts means synthetic IDs should auto-ack
			expect(controller.shouldShowOverlay, false);
		});

		test('hasCriticalAlert flag without alerts stays hidden after updateStatus', () async {
			controller.updateStatus(_makeStatus(
				hasCriticalAlert: true,
			));
			expect(controller.shouldShowOverlay, true);

			await controller.acknowledgeCurrentAlerts();
			expect(controller.shouldShowOverlay, false);

			// Server status arrives, clearing optimistic cache
			controller.updateStatus(_makeStatus(
				hasCriticalAlert: true,
			));

			expect(controller.shouldShowOverlay, false);
		});
	});

	group('SecurityOverlayController - offline behavior', () {
		late SecurityOverlayController controller;

		setUp(() {
			controller = SecurityOverlayController();
		});

		tearDown(() {
			controller.dispose();
		});

		test('acknowledgeAlert returns false when offline', () async {
			controller.updateStatus(_makeStatus(
				hasCriticalAlert: true,
				activeAlerts: [_makeAlert(id: 'a')],
			));
			controller.setConnectionOffline(true);

			final result = await controller.acknowledgeAlert('a');
			expect(result, false);
			expect(controller.isAlertAcknowledged('a'), false);
		});

		test('acknowledgeAllAlerts returns false when offline', () async {
			controller.updateStatus(_makeStatus(
				hasCriticalAlert: true,
				activeAlerts: [_makeAlert(id: 'a')],
			));
			controller.setConnectionOffline(true);

			final result = await controller.acknowledgeAllAlerts();
			expect(result, false);
			expect(controller.isAlertAcknowledged('a'), false);
		});

		test('acknowledgeCurrentAlerts returns false when offline', () async {
			controller.updateStatus(_makeStatus(
				hasCriticalAlert: true,
				activeAlerts: [_makeAlert(id: 'a')],
			));
			controller.setConnectionOffline(true);

			final result = await controller.acknowledgeCurrentAlerts();
			expect(result, false);
		});
	});

	group('SecurityOverlayController - offline/online lifecycle', () {
		late SecurityOverlayController controller;

		setUp(() {
			controller = SecurityOverlayController();
		});

		tearDown(() {
			controller.dispose();
		});

		test('offline hides overlay; coming back online restores it when alerts unacked', () async {
			// Critical alert → overlay showing
			controller.updateStatus(_makeStatus(
				hasCriticalAlert: true,
				activeAlerts: [_makeAlert(id: 'a')],
			));
			expect(controller.shouldShowOverlay, true);

			// Go offline → overlay hidden
			controller.setConnectionOffline(true);
			expect(controller.shouldShowOverlay, false);

			// Come back online → overlay restored (alerts still unacked)
			controller.setConnectionOffline(false);
			expect(controller.shouldShowOverlay, true);

			// Acknowledge alerts → overlay hidden
			await controller.acknowledgeCurrentAlerts();
			expect(controller.shouldShowOverlay, false);
		});

		test('acknowledge is blocked while offline but succeeds after reconnection', () async {
			// Critical alert → overlay showing
			controller.updateStatus(_makeStatus(
				hasCriticalAlert: true,
				activeAlerts: [_makeAlert(id: 'a')],
			));
			expect(controller.shouldShowOverlay, true);

			// Go offline → acknowledge returns false, alert stays unacked
			controller.setConnectionOffline(true);
			final result = await controller.acknowledgeCurrentAlerts();
			expect(result, false);
			expect(controller.isAlertAcknowledged('a'), false);

			// Come back online → acknowledge succeeds
			controller.setConnectionOffline(false);
			final result2 = await controller.acknowledgeCurrentAlerts();
			expect(result2, true);
			expect(controller.shouldShowOverlay, false);
		});

		test('offline hides overlay; online resumes if new unacked alert arrived', () async {
			// Critical alert A, acknowledge it → overlay hidden
			controller.updateStatus(_makeStatus(
				hasCriticalAlert: true,
				activeAlerts: [_makeAlert(id: 'a')],
			));
			await controller.acknowledgeCurrentAlerts();
			expect(controller.shouldShowOverlay, false);

			// Go offline
			controller.setConnectionOffline(true);

			// Update status with new unacked alert B (simulating cached/queued data)
			controller.updateStatus(_makeStatus(
				hasCriticalAlert: true,
				activeAlerts: [
					_makeAlert(id: 'a', acknowledged: true),
					_makeAlert(id: 'b', acknowledged: false),
				],
			));

			// Still offline → overlay hidden regardless of alerts
			expect(controller.shouldShowOverlay, false);

			// Come back online → overlay should show (alert B is unacked)
			controller.setConnectionOffline(false);
			expect(controller.shouldShowOverlay, true);
		});
	});

	group('SecurityOverlayController - overlay suppression with ack', () {
		late SecurityOverlayController controller;

		setUp(() {
			controller = SecurityOverlayController();
		});

		tearDown(() {
			controller.dispose();
		});

		test('overlay hidden when all critical alerts acknowledged via acknowledgeAllAlerts', () async {
			controller.updateStatus(_makeStatus(
				hasCriticalAlert: true,
				activeAlerts: [
					_makeAlert(id: 'a', severity: Severity.critical),
					_makeAlert(id: 'b', severity: Severity.critical),
					_makeAlert(id: 'c', severity: Severity.warning),
				],
			));

			expect(controller.shouldShowOverlay, true);

			await controller.acknowledgeAllAlerts();
			expect(controller.shouldShowOverlay, false);
		});

		test('overlay hidden when all critical alerts acknowledged individually', () async {
			controller.updateStatus(_makeStatus(
				hasCriticalAlert: true,
				activeAlerts: [
					_makeAlert(id: 'a', severity: Severity.critical),
					_makeAlert(id: 'b', severity: Severity.critical),
				],
			));

			await controller.acknowledgeAlert('a');
			expect(controller.shouldShowOverlay, true);

			await controller.acknowledgeAlert('b');
			expect(controller.shouldShowOverlay, false);
		});

		test('overlay returns when new critical alert appears after ack all', () async {
			controller.updateStatus(_makeStatus(
				hasCriticalAlert: true,
				activeAlerts: [_makeAlert(id: 'a', severity: Severity.critical)],
			));

			await controller.acknowledgeAllAlerts();
			expect(controller.shouldShowOverlay, false);

			// New critical alert from server
			controller.updateStatus(_makeStatus(
				hasCriticalAlert: true,
				activeAlerts: [
					_makeAlert(id: 'a', severity: Severity.critical, acknowledged: true),
					_makeAlert(id: 'b', severity: Severity.critical, acknowledged: false),
				],
			));

			expect(controller.shouldShowOverlay, true);
		});
	});
}
