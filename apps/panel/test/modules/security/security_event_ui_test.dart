import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations_en.dart';
import 'package:fastybird_smart_panel/modules/security/models/security_event.dart';
import 'package:fastybird_smart_panel/modules/security/types/security.dart';
import 'package:fastybird_smart_panel/modules/security/utils/security_event_ui.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

SecurityEventModel _makeEvent({
	String id = 'evt-1',
	SecurityEventType eventType = SecurityEventType.alertRaised,
	Severity? severity,
	SecurityAlertType? alertType,
	String? sourceDeviceId,
	Map<String, dynamic>? payload,
}) {
	return SecurityEventModel(
		id: id,
		timestamp: DateTime(2025, 6, 15, 10, 30),
		eventType: eventType,
		severity: severity,
		alertType: alertType,
		sourceDeviceId: sourceDeviceId,
		payload: payload,
	);
}

void main() {
	late AppLocalizations localizations;

	setUpAll(() {
		localizations = AppLocalizationsEn();
	});

	group('securityEventTitle', () {
		test('alert_raised with alertType shows type display title', () {
			final event = _makeEvent(
				eventType: SecurityEventType.alertRaised,
				alertType: SecurityAlertType.smoke,
			);
			expect(securityEventTitle(event, localizations), 'Alert raised: Smoke detected');
		});

		test('alert_resolved with alertType', () {
			final event = _makeEvent(
				eventType: SecurityEventType.alertResolved,
				alertType: SecurityAlertType.waterLeak,
			);
			expect(securityEventTitle(event, localizations), 'Alert resolved: Water leak');
		});

		test('alert_acknowledged with alertType', () {
			final event = _makeEvent(
				eventType: SecurityEventType.alertAcknowledged,
				alertType: SecurityAlertType.intrusion,
			);
			expect(securityEventTitle(event, localizations), 'Alert acknowledged: Intrusion detected');
		});

		test('alert_raised without alertType shows Unknown', () {
			final event = _makeEvent(
				eventType: SecurityEventType.alertRaised,
			);
			expect(securityEventTitle(event, localizations), 'Alert raised: Unknown');
		});

		test('alarm_state_changed with payload', () {
			final event = _makeEvent(
				eventType: SecurityEventType.alarmStateChanged,
				payload: {'from': 'idle', 'to': 'triggered'},
			);
			expect(securityEventTitle(event, localizations), 'Alarm state changed: Idle → Triggered');
		});

		test('armed_state_changed with payload', () {
			final event = _makeEvent(
				eventType: SecurityEventType.armedStateChanged,
				payload: {'from': 'disarmed', 'to': 'armed_home'},
			);
			expect(securityEventTitle(event, localizations), 'Arming mode changed: Disarmed → Armed Home');
		});

		test('alarm_state_changed without payload shows unknown', () {
			final event = _makeEvent(
				eventType: SecurityEventType.alarmStateChanged,
			);
			expect(securityEventTitle(event, localizations), 'Alarm state changed: unknown → unknown');
		});
	});

	group('securityEventIcon', () {
		test('alert_raised returns alert icon', () {
			final event = _makeEvent(eventType: SecurityEventType.alertRaised);
			expect(securityEventIcon(event), MdiIcons.alert);
		});

		test('alert_resolved returns check circle outline', () {
			final event = _makeEvent(eventType: SecurityEventType.alertResolved);
			expect(securityEventIcon(event), MdiIcons.checkCircleOutline);
		});

		test('alert_acknowledged returns check', () {
			final event = _makeEvent(eventType: SecurityEventType.alertAcknowledged);
			expect(securityEventIcon(event), MdiIcons.check);
		});

		test('alarm_state_changed returns alarm light outline', () {
			final event = _makeEvent(eventType: SecurityEventType.alarmStateChanged);
			expect(securityEventIcon(event), MdiIcons.alarmLightOutline);
		});

		test('armed_state_changed returns shield lock outline', () {
			final event = _makeEvent(eventType: SecurityEventType.armedStateChanged);
			expect(securityEventIcon(event), MdiIcons.shieldLockOutline);
		});

		test('overrides icon based on alertType smoke', () {
			final event = _makeEvent(
				eventType: SecurityEventType.alertRaised,
				alertType: SecurityAlertType.smoke,
			);
			expect(securityEventIcon(event), MdiIcons.smokingOff);
		});

		test('overrides icon based on alertType waterLeak', () {
			final event = _makeEvent(
				eventType: SecurityEventType.alertRaised,
				alertType: SecurityAlertType.waterLeak,
			);
			expect(securityEventIcon(event), MdiIcons.waterAlert);
		});

		test('does not override for non-special alertType', () {
			final event = _makeEvent(
				eventType: SecurityEventType.alertRaised,
				alertType: SecurityAlertType.fault,
			);
			// fault falls through to default _eventTypeIcon
			expect(securityEventIcon(event), MdiIcons.alert);
		});
	});

	group('securityAlertTypeTitle', () {
		test('all types have a non-empty title', () {
			for (final type in SecurityAlertType.values) {
				expect(securityAlertTypeTitle(type, localizations), isNotEmpty);
			}
		});

		test('null type returns Unknown', () {
			expect(securityAlertTypeTitle(null, localizations), 'Unknown');
		});
	});

	group('SecurityEventType.fromString', () {
		test('parses all event types', () {
			expect(SecurityEventType.fromString('alert_raised'), SecurityEventType.alertRaised);
			expect(SecurityEventType.fromString('alert_resolved'), SecurityEventType.alertResolved);
			expect(SecurityEventType.fromString('alert_acknowledged'), SecurityEventType.alertAcknowledged);
			expect(SecurityEventType.fromString('alarm_state_changed'), SecurityEventType.alarmStateChanged);
			expect(SecurityEventType.fromString('armed_state_changed'), SecurityEventType.armedStateChanged);
		});

		test('defaults to alertRaised for unknown', () {
			expect(SecurityEventType.fromString('unknown_type'), SecurityEventType.alertRaised);
		});
	});

	group('SecurityEventModel.fromJson', () {
		test('parses complete JSON', () {
			final json = {
				'id': 'evt-123',
				'timestamp': '2025-06-15T10:30:00.000Z',
				'event_type': 'alert_raised',
				'severity': 'critical',
				'alert_id': 'alert-456',
				'alert_type': 'smoke',
				'source_device_id': 'dev-789',
				'payload': {'key': 'value'},
			};

			final event = SecurityEventModel.fromJson(json);
			expect(event.id, 'evt-123');
			expect(event.eventType, SecurityEventType.alertRaised);
			expect(event.severity, Severity.critical);
			expect(event.alertId, 'alert-456');
			expect(event.alertType, SecurityAlertType.smoke);
			expect(event.sourceDeviceId, 'dev-789');
			expect(event.payload, {'key': 'value'});
		});

		test('parses minimal JSON with nullables', () {
			final json = {
				'id': 'evt-1',
				'timestamp': '2025-06-15T10:30:00.000Z',
				'event_type': 'armed_state_changed',
			};

			final event = SecurityEventModel.fromJson(json);
			expect(event.id, 'evt-1');
			expect(event.eventType, SecurityEventType.armedStateChanged);
			expect(event.severity, isNull);
			expect(event.alertId, isNull);
			expect(event.alertType, isNull);
			expect(event.sourceDeviceId, isNull);
			expect(event.payload, isNull);
		});
	});
}
