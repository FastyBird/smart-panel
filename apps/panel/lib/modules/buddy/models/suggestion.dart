enum BuddySuggestionType {
	patternSceneCreate,
	lightingOptimise,
	generalTip,
	anomalySensorDrift,
	anomalyStuckSensor,
	anomalyUnusualActivity,
	energyExcessSolar,
	energyHighConsumption,
	energyBatteryLow,
	conflictHeatingWindow,
	conflictAcWindow,
	conflictLightsUnoccupied;

	static BuddySuggestionType fromString(String value) {
		switch (value) {
			case 'pattern_scene_create':
				return BuddySuggestionType.patternSceneCreate;
			case 'lighting_optimise':
				return BuddySuggestionType.lightingOptimise;
			case 'general_tip':
				return BuddySuggestionType.generalTip;
			case 'anomaly_sensor_drift':
				return BuddySuggestionType.anomalySensorDrift;
			case 'anomaly_stuck_sensor':
				return BuddySuggestionType.anomalyStuckSensor;
			case 'anomaly_unusual_activity':
				return BuddySuggestionType.anomalyUnusualActivity;
			case 'energy_excess_solar':
				return BuddySuggestionType.energyExcessSolar;
			case 'energy_high_consumption':
				return BuddySuggestionType.energyHighConsumption;
			case 'energy_battery_low':
				return BuddySuggestionType.energyBatteryLow;
			case 'conflict_heating_window':
				return BuddySuggestionType.conflictHeatingWindow;
			case 'conflict_ac_window':
				return BuddySuggestionType.conflictAcWindow;
			case 'conflict_lights_unoccupied':
				return BuddySuggestionType.conflictLightsUnoccupied;
			default:
				return BuddySuggestionType.generalTip;
		}
	}

	/// Whether this suggestion type represents a conflict or anomaly
	/// that should be displayed with warning styling.
	bool get isWarning {
		switch (this) {
			case BuddySuggestionType.anomalySensorDrift:
			case BuddySuggestionType.anomalyStuckSensor:
			case BuddySuggestionType.anomalyUnusualActivity:
			case BuddySuggestionType.conflictHeatingWindow:
			case BuddySuggestionType.conflictAcWindow:
			case BuddySuggestionType.conflictLightsUnoccupied:
				return true;
			default:
				return false;
		}
	}
}

class BuddySuggestionModel {
	final String _id;
	final BuddySuggestionType _type;
	final String _title;
	final String _reason;
	final String? _spaceId;
	final Map<String, dynamic> _metadata;
	final DateTime _createdAt;
	final DateTime _expiresAt;

	BuddySuggestionModel({
		required String id,
		required BuddySuggestionType type,
		required String title,
		required String reason,
		String? spaceId,
		Map<String, dynamic>? metadata,
		required DateTime createdAt,
		required DateTime expiresAt,
	})  : _id = id,
		_type = type,
		_title = title,
		_reason = reason,
		_spaceId = spaceId,
		_metadata = metadata ?? {},
		_createdAt = createdAt,
		_expiresAt = expiresAt;

	String get id => _id;
	BuddySuggestionType get type => _type;
	String get title => _title;
	String get reason => _reason;
	String? get spaceId => _spaceId;
	Map<String, dynamic> get metadata => _metadata;
	DateTime get createdAt => _createdAt;
	DateTime get expiresAt => _expiresAt;

	bool get isExpired => DateTime.now().isAfter(_expiresAt);

	factory BuddySuggestionModel.fromJson(Map<String, dynamic> json) {
		return BuddySuggestionModel(
			id: json['id'] as String,
			type: BuddySuggestionType.fromString(json['type'] as String? ?? ''),
			title: json['title'] as String? ?? '',
			reason: json['reason'] as String? ?? '',
			spaceId: json['space_id'] as String?,
			metadata: json['metadata'] is Map<String, dynamic>
				? json['metadata'] as Map<String, dynamic>
				: {},
			createdAt: json['created_at'] != null
				? DateTime.parse(json['created_at'] as String)
				: DateTime.now(),
			expiresAt: json['expires_at'] != null
				? DateTime.parse(json['expires_at'] as String)
				: DateTime.now().add(const Duration(hours: 24)),
		);
	}
}
