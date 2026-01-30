import 'package:fastybird_smart_panel/modules/security/types/security.dart';

class SecurityAlertModel {
	final String id;
	final SecurityAlertType type;
	final Severity severity;
	final DateTime timestamp;
	final bool acknowledged;
	final String? sourceDeviceId;
	final String? sourceChannelId;
	final String? sourcePropertyId;
	final String? message;

	const SecurityAlertModel({
		required this.id,
		required this.type,
		required this.severity,
		required this.timestamp,
		this.acknowledged = false,
		this.sourceDeviceId,
		this.sourceChannelId,
		this.sourcePropertyId,
		this.message,
	});

	factory SecurityAlertModel.fromJson(Map<String, dynamic> json) {
		return SecurityAlertModel(
			id: json['id'] as String,
			type: SecurityAlertType.fromString(json['type'] as String),
			severity: Severity.fromString(json['severity'] as String),
			timestamp: DateTime.parse(json['timestamp'] as String),
			acknowledged: json['acknowledged'] as bool? ?? false,
			sourceDeviceId: json['source_device_id'] as String?,
			sourceChannelId: json['source_channel_id'] as String?,
			sourcePropertyId: json['source_property_id'] as String?,
			message: json['message'] as String?,
		);
	}
}
