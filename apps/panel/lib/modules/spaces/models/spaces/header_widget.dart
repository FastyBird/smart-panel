/// A widget configuration from a space's `header_widgets` JSON field.
///
/// Each header widget has a [type] (e.g. "energy", "weather"), a display
/// [order], and a free-form [settings] map whose keys depend on the type.
class HeaderWidget {
	final String type;
	final int order;
	final Map<String, dynamic> settings;

	const HeaderWidget({
		required this.type,
		required this.order,
		this.settings = const {},
	});

	factory HeaderWidget.fromJson(Map<String, dynamic> json) {
		return HeaderWidget(
			type: json['type'] as String,
			order: (json['order'] as num?)?.toInt() ?? 0,
			settings: json['settings'] is Map<String, dynamic>
					? json['settings'] as Map<String, dynamic>
					: const {},
		);
	}
}
