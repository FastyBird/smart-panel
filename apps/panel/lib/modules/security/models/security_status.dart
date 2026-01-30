import 'package:fastybird_smart_panel/modules/security/models/security_alert.dart';
import 'package:fastybird_smart_panel/modules/security/types/security.dart';

class SecurityLastEventModel {
	final String type;
	final DateTime timestamp;
	final String? sourceDeviceId;
	final Severity? severity;

	const SecurityLastEventModel({
		required this.type,
		required this.timestamp,
		this.sourceDeviceId,
		this.severity,
	});

	factory SecurityLastEventModel.fromJson(Map<String, dynamic> json) {
		return SecurityLastEventModel(
			type: json['type'] as String,
			timestamp: DateTime.parse(json['timestamp'] as String),
			sourceDeviceId: json['source_device_id'] as String?,
			severity: json['severity'] != null
				? Severity.fromString(json['severity'] as String)
				: null,
		);
	}
}

class SecurityStatusModel {
	final ArmedState? armedState;
	final AlarmState? alarmState;
	final Severity highestSeverity;
	final int activeAlertsCount;
	final bool hasCriticalAlert;
	final List<SecurityAlertModel> activeAlerts;
	final SecurityLastEventModel? lastEvent;

	const SecurityStatusModel({
		this.armedState,
		this.alarmState,
		required this.highestSeverity,
		required this.activeAlertsCount,
		required this.hasCriticalAlert,
		required this.activeAlerts,
		this.lastEvent,
	});

	factory SecurityStatusModel.fromJson(Map<String, dynamic> json) {
		final alertsList = (json['active_alerts'] as List<dynamic>?)
			?.map((e) => SecurityAlertModel.fromJson(e as Map<String, dynamic>))
			.toList() ?? [];

		return SecurityStatusModel(
			armedState: ArmedState.fromString(json['armed_state'] as String?),
			alarmState: AlarmState.fromString(json['alarm_state'] as String?),
			highestSeverity: Severity.fromString(json['highest_severity'] as String? ?? 'info'),
			activeAlertsCount: json['active_alerts_count'] as int? ?? 0,
			hasCriticalAlert: json['has_critical_alert'] as bool? ?? false,
			activeAlerts: alertsList,
			lastEvent: json['last_event'] != null
				? SecurityLastEventModel.fromJson(json['last_event'] as Map<String, dynamic>)
				: null,
		);
	}

	static const empty = SecurityStatusModel(
		highestSeverity: Severity.info,
		activeAlertsCount: 0,
		hasCriticalAlert: false,
		activeAlerts: [],
	);
}
