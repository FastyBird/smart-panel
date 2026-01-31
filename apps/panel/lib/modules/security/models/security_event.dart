import 'package:fastybird_smart_panel/modules/security/types/security.dart';

class SecurityEventModel {
	final String id;
	final DateTime timestamp;
	final SecurityEventType eventType;
	final Severity? severity;
	final String? alertId;
	final SecurityAlertType? alertType;
	final String? sourceDeviceId;
	final Map<String, dynamic>? payload;

	const SecurityEventModel({
		required this.id,
		required this.timestamp,
		required this.eventType,
		this.severity,
		this.alertId,
		this.alertType,
		this.sourceDeviceId,
		this.payload,
	});

	factory SecurityEventModel.fromJson(Map<String, dynamic> json) {
		return SecurityEventModel(
			id: json['id'] as String,
			timestamp: DateTime.parse(json['timestamp'] as String),
			eventType: SecurityEventType.fromString(json['event_type'] as String),
			severity: json['severity'] != null
				? Severity.fromString(json['severity'] as String)
				: null,
			alertId: json['alert_id'] as String?,
			alertType: json['alert_type'] != null
				? SecurityAlertType.fromString(json['alert_type'] as String)
				: null,
			sourceDeviceId: json['source_device_id'] as String?,
			payload: json['payload'] != null
				? Map<String, dynamic>.from(json['payload'] as Map)
				: null,
		);
	}
}
