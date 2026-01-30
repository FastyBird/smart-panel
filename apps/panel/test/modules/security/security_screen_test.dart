import 'package:fastybird_smart_panel/modules/security/models/security_alert.dart';
import 'package:fastybird_smart_panel/modules/security/models/security_status.dart';
import 'package:fastybird_smart_panel/modules/security/services/security_overlay_controller.dart';
import 'package:fastybird_smart_panel/modules/security/types/security.dart';
import 'package:fastybird_smart_panel/modules/security/utils/security_ui.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

SecurityAlertModel _makeAlert({
	required String id,
	Severity severity = Severity.critical,
	SecurityAlertType type = SecurityAlertType.smoke,
	DateTime? timestamp,
	String? message,
}) {
	return SecurityAlertModel(
		id: id,
		type: type,
		severity: severity,
		timestamp: timestamp ?? DateTime(2025, 1, 1),
		message: message,
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
	group('SecurityScreen sorting via controller', () {
		test('alerts are sorted by severity desc, timestamp desc, id asc', () {
			final alerts = [
				_makeAlert(id: 'info-1', severity: Severity.info, timestamp: DateTime(2025, 1, 3)),
				_makeAlert(id: 'crit-2', severity: Severity.critical, timestamp: DateTime(2025, 1, 1)),
				_makeAlert(id: 'crit-1', severity: Severity.critical, timestamp: DateTime(2025, 1, 2)),
				_makeAlert(id: 'warn-1', severity: Severity.warning, timestamp: DateTime(2025, 1, 2)),
			];

			final sorted = sortAlerts(alerts);

			expect(sorted.map((a) => a.id).toList(), [
				'crit-1', // critical, newest timestamp
				'crit-2', // critical, older timestamp
				'warn-1', // warning
				'info-1', // info
			]);
		});

		test('single alert returns unchanged', () {
			final alerts = [_makeAlert(id: 'only')];
			final sorted = sortAlerts(alerts);
			expect(sorted.length, 1);
			expect(sorted[0].id, 'only');
		});

		test('empty list returns empty', () {
			expect(sortAlerts([]), isEmpty);
		});
	});

	group('SecurityScreen empty vs list state via controller', () {
		late SecurityOverlayController controller;

		setUp(() {
			controller = SecurityOverlayController();
		});

		tearDown(() {
			controller.dispose();
		});

		test('no alerts → sortedAlerts is empty', () {
			controller.updateStatus(_makeStatus());
			expect(controller.sortedAlerts, isEmpty);
		});

		test('with alerts → sortedAlerts is non-empty and sorted', () {
			controller.updateStatus(_makeStatus(
				hasCriticalAlert: true,
				activeAlerts: [
					_makeAlert(id: 'b', severity: Severity.warning),
					_makeAlert(id: 'a', severity: Severity.critical),
				],
			));
			expect(controller.sortedAlerts.length, 2);
			expect(controller.sortedAlerts[0].id, 'a');
			expect(controller.sortedAlerts[1].id, 'b');
		});

		test('status update refreshes sorted alerts', () {
			controller.updateStatus(_makeStatus(
				activeAlerts: [_makeAlert(id: 'x', severity: Severity.info)],
			));
			expect(controller.sortedAlerts.length, 1);

			controller.updateStatus(_makeStatus());
			expect(controller.sortedAlerts, isEmpty);
		});
	});

	group('alertTypeIcon mapping', () {
		test('smoke returns correct icon', () {
			expect(alertTypeIcon(SecurityAlertType.smoke), MdiIcons.smokingOff);
		});

		test('co returns correct icon', () {
			expect(alertTypeIcon(SecurityAlertType.co), MdiIcons.moleculeCo);
		});

		test('waterLeak returns correct icon', () {
			expect(alertTypeIcon(SecurityAlertType.waterLeak), MdiIcons.waterAlert);
		});

		test('intrusion returns correct icon', () {
			expect(alertTypeIcon(SecurityAlertType.intrusion), MdiIcons.doorOpen);
		});

		test('deviceOffline returns correct icon', () {
			expect(alertTypeIcon(SecurityAlertType.deviceOffline), MdiIcons.lanDisconnect);
		});

		test('all alert types have an icon mapping', () {
			for (final type in SecurityAlertType.values) {
				expect(alertTypeIcon(type), isA<IconData>());
			}
		});
	});

	group('severityColor mapping', () {
		test('critical returns error color', () {
			final color = severityColor(Severity.critical, false);
			expect(color, isA<Color>());
		});

		test('warning returns warning color', () {
			final color = severityColor(Severity.warning, false);
			expect(color, isA<Color>());
		});

		test('info returns info color', () {
			final color = severityColor(Severity.info, false);
			expect(color, isA<Color>());
		});

		test('all severities return different colors in light mode', () {
			final colors = Severity.values.map((s) => severityColor(s, false)).toSet();
			expect(colors.length, Severity.values.length);
		});
	});

	group('Severity enum', () {
		test('rank ordering is info < warning < critical', () {
			expect(Severity.info.rank, lessThan(Severity.warning.rank));
			expect(Severity.warning.rank, lessThan(Severity.critical.rank));
		});

		test('fromString handles known values', () {
			expect(Severity.fromString('critical'), Severity.critical);
			expect(Severity.fromString('warning'), Severity.warning);
			expect(Severity.fromString('info'), Severity.info);
		});

		test('fromString defaults to info for unknown', () {
			expect(Severity.fromString('unknown'), Severity.info);
		});
	});

	group('SecurityAlertType enum', () {
		test('fromString handles known values', () {
			expect(SecurityAlertType.fromString('smoke'), SecurityAlertType.smoke);
			expect(SecurityAlertType.fromString('co'), SecurityAlertType.co);
			expect(SecurityAlertType.fromString('water_leak'), SecurityAlertType.waterLeak);
			expect(SecurityAlertType.fromString('intrusion'), SecurityAlertType.intrusion);
			expect(SecurityAlertType.fromString('entry_open'), SecurityAlertType.entryOpen);
			expect(SecurityAlertType.fromString('device_offline'), SecurityAlertType.deviceOffline);
		});

		test('fromString defaults to fault for unknown', () {
			expect(SecurityAlertType.fromString('unknown'), SecurityAlertType.fault);
		});

		test('all types have a displayTitle', () {
			for (final type in SecurityAlertType.values) {
				expect(type.displayTitle, isNotEmpty);
			}
		});
	});
}
