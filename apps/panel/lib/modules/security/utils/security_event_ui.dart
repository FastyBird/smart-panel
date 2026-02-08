import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/security/models/security_event.dart';
import 'package:fastybird_smart_panel/modules/security/types/security.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

/// Returns a localized display title for a [SecurityAlertType].
String securityAlertTypeTitle(SecurityAlertType? type, AppLocalizations localizations) {
	if (type == null) return localizations.security_alert_type_unknown;
	return switch (type) {
		SecurityAlertType.intrusion => localizations.security_alert_type_intrusion,
		SecurityAlertType.entryOpen => localizations.security_alert_type_entry_open,
		SecurityAlertType.smoke => localizations.security_alert_type_smoke,
		SecurityAlertType.co => localizations.security_alert_type_co,
		SecurityAlertType.waterLeak => localizations.security_alert_type_water_leak,
		SecurityAlertType.gas => localizations.security_alert_type_gas,
		SecurityAlertType.tamper => localizations.security_alert_type_tamper,
		SecurityAlertType.fault => localizations.security_alert_type_fault,
		SecurityAlertType.deviceOffline => localizations.security_alert_type_device_offline,
	};
}

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
String securityEventTitle(SecurityEventModel event, AppLocalizations localizations) {
	final alertLabel = securityAlertTypeTitle(event.alertType, localizations);

	return switch (event.eventType) {
		SecurityEventType.alertRaised => localizations.security_event_title_alert_raised(alertLabel),
		SecurityEventType.alertResolved => localizations.security_event_title_alert_resolved(alertLabel),
		SecurityEventType.alertAcknowledged => localizations.security_event_title_alert_acknowledged(alertLabel),
		SecurityEventType.alarmStateChanged => _alarmStateChangedTitle(event.payload, localizations),
		SecurityEventType.armedStateChanged => _armedStateChangedTitle(event.payload, localizations),
	};
}

/// Returns a short event name (row 1) for the two-row event layout.
String securityEventName(SecurityEventModel event, AppLocalizations localizations) {
	return switch (event.eventType) {
		SecurityEventType.alertRaised => localizations.security_event_alert_raised,
		SecurityEventType.alertResolved => localizations.security_event_alert_resolved,
		SecurityEventType.alertAcknowledged => localizations.security_event_alert_acknowledged,
		SecurityEventType.alarmStateChanged => localizations.security_event_alarm_state_changed,
		SecurityEventType.armedStateChanged => localizations.security_event_arming_mode_changed,
	};
}

/// Returns event detail text (row 2) for the two-row event layout.
///
/// Examples: "Intrusion", "Idle → Triggered", "Disarmed → Armed Away"
String? securityEventDetail(SecurityEventModel event, AppLocalizations localizations) {
	switch (event.eventType) {
		case SecurityEventType.alertRaised:
		case SecurityEventType.alertResolved:
		case SecurityEventType.alertAcknowledged:
			return securityAlertTypeTitle(event.alertType, localizations);
		case SecurityEventType.alarmStateChanged:
		case SecurityEventType.armedStateChanged:
			final from = _formatState(event.payload?['from'] as String?);
			final to = _formatState(event.payload?['to'] as String?);
			return localizations.security_state_transition(from, to);
	}
}

String _alarmStateChangedTitle(Map<String, dynamic>? payload, AppLocalizations localizations) {
	final from = _formatState(payload?['from'] as String?);
	final to = _formatState(payload?['to'] as String?);

	return localizations.security_event_title_alarm_state_changed(from, to);
}

String _armedStateChangedTitle(Map<String, dynamic>? payload, AppLocalizations localizations) {
	final from = _formatState(payload?['from'] as String?);
	final to = _formatState(payload?['to'] as String?);

	return localizations.security_event_title_arming_mode_changed(from, to);
}

String _formatState(String? state) {
	if (state == null) return 'unknown';

	return state
		.replaceAll('_', ' ')
		.split(' ')
		.map((w) => w.isEmpty ? w : '${w[0].toUpperCase()}${w.substring(1)}')
		.join(' ');
}
