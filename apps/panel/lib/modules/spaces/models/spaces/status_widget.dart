/// A widget configuration from a space's `status_widgets` JSON field.
///
/// Each status widget has a [type] (e.g. "energy", "weather"), a display
/// [order], and a free-form [settings] map whose keys depend on the type.
class StatusWidget {
	final String type;
	final int order;
	final Map<String, dynamic> settings;

	const StatusWidget({
		required this.type,
		required this.order,
		this.settings = const {},
	});

	factory StatusWidget.fromJson(Map<String, dynamic> json) {
		return StatusWidget(
			type: json['type'] as String,
			order: (json['order'] as num?)?.toInt() ?? 0,
			settings: json['settings'] is Map<String, dynamic>
					? json['settings'] as Map<String, dynamic>
					: const {},
		);
	}
}
