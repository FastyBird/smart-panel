enum ArmedState {
	disarmed,
	armedHome,
	armedAway,
	armedNight;

	static ArmedState? fromString(String? value) {
		if (value == null) return null;
		return switch (value) {
			'disarmed' => ArmedState.disarmed,
			'armed_home' => ArmedState.armedHome,
			'armed_away' => ArmedState.armedAway,
			'armed_night' => ArmedState.armedNight,
			_ => null,
		};
	}
}

enum AlarmState {
	idle,
	pending,
	triggered,
	silenced;

	static AlarmState? fromString(String? value) {
		if (value == null) return null;
		return switch (value) {
			'idle' => AlarmState.idle,
			'pending' => AlarmState.pending,
			'triggered' => AlarmState.triggered,
			'silenced' => AlarmState.silenced,
			_ => null,
		};
	}
}

enum Severity {
	info,
	warning,
	critical;

	int get rank => switch (this) {
		Severity.info => 0,
		Severity.warning => 1,
		Severity.critical => 2,
	};

	static Severity fromString(String value) {
		return switch (value) {
			'warning' => Severity.warning,
			'critical' => Severity.critical,
			_ => Severity.info,
		};
	}
}

enum SecurityEventType {
	alertRaised,
	alertResolved,
	alertAcknowledged,
	alarmStateChanged,
	armedStateChanged;

	static SecurityEventType fromString(String value) {
		return switch (value) {
			'alert_raised' => SecurityEventType.alertRaised,
			'alert_resolved' => SecurityEventType.alertResolved,
			'alert_acknowledged' => SecurityEventType.alertAcknowledged,
			'alarm_state_changed' => SecurityEventType.alarmStateChanged,
			'armed_state_changed' => SecurityEventType.armedStateChanged,
			_ => SecurityEventType.alertRaised,
		};
	}
}

enum SecurityAlertType {
	intrusion,
	entryOpen,
	smoke,
	co,
	waterLeak,
	gas,
	tamper,
	fault,
	deviceOffline;

	static SecurityAlertType fromString(String value) {
		return switch (value) {
			'intrusion' => SecurityAlertType.intrusion,
			'entry_open' => SecurityAlertType.entryOpen,
			'smoke' => SecurityAlertType.smoke,
			'co' => SecurityAlertType.co,
			'water_leak' => SecurityAlertType.waterLeak,
			'gas' => SecurityAlertType.gas,
			'tamper' => SecurityAlertType.tamper,
			'fault' => SecurityAlertType.fault,
			'device_offline' => SecurityAlertType.deviceOffline,
			_ => SecurityAlertType.fault,
		};
	}

}
