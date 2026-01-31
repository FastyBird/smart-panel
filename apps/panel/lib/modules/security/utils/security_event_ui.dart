import 'package:fastybird_smart_panel/modules/security/models/security_event.dart';
import 'package:fastybird_smart_panel/modules/security/types/security.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Returns an icon for a security event based on its type and optional alert type.
IconData securityEventIcon(SecurityEventModel event) {
	// Override based on alertType if present
	if (event.alertType != null) {
		return switch (event.alertType!) {
			SecurityAlertType.smoke => MdiIcons.smokingOff,
			SecurityAlertType.co => MdiIcons.moleculeCo,
			SecurityAlertType.waterLeak => MdiIcons.waterAlert,
			SecurityAlertType.gas => MdiIcons.gasCylinder,
			SecurityAlertType.intrusion => MdiIcons.doorOpen,
			_ => _eventTypeIcon(event.eventType),
		};
	}

	return _eventTypeIcon(event.eventType);
}

IconData _eventTypeIcon(SecurityEventType type) {
	return switch (type) {
		SecurityEventType.alertRaised => MdiIcons.alert,
		SecurityEventType.alertResolved => MdiIcons.checkCircleOutline,
		SecurityEventType.alertAcknowledged => MdiIcons.check,
		SecurityEventType.alarmStateChanged => MdiIcons.alarmLightOutline,
		SecurityEventType.armedStateChanged => MdiIcons.shieldLockOutline,
	};
}

/// Returns a human-readable title for a security event.
String securityEventTitle(SecurityEventModel event) {
	return switch (event.eventType) {
		SecurityEventType.alertRaised => 'Alert raised: ${_alertTypeLabel(event.alertType)}',
		SecurityEventType.alertResolved => 'Alert resolved: ${_alertTypeLabel(event.alertType)}',
		SecurityEventType.alertAcknowledged => 'Alert acknowledged: ${_alertTypeLabel(event.alertType)}',
		SecurityEventType.alarmStateChanged => _alarmStateChangedTitle(event.payload),
		SecurityEventType.armedStateChanged => _armedStateChangedTitle(event.payload),
	};
}

String _alertTypeLabel(SecurityAlertType? type) {
	if (type == null) return 'Unknown';
	return type.displayTitle;
}

String _alarmStateChangedTitle(Map<String, dynamic>? payload) {
	final from = _formatState(payload?['from'] as String?);
	final to = _formatState(payload?['to'] as String?);

	return 'Alarm state changed: $from → $to';
}

String _armedStateChangedTitle(Map<String, dynamic>? payload) {
	final from = _formatState(payload?['from'] as String?);
	final to = _formatState(payload?['to'] as String?);

	return 'Arming mode changed: $from → $to';
}

String _formatState(String? state) {
	if (state == null) return 'unknown';

	return state
		.replaceAll('_', ' ')
		.split(' ')
		.map((w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1)}')
		.join(' ');
}
