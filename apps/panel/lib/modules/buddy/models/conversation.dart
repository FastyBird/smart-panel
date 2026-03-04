class BuddyConversationModel {
	final String _id;
	final String? _title;
	final String? _spaceId;
	final DateTime _createdAt;
	final DateTime _updatedAt;

	BuddyConversationModel({
		required String id,
		String? title,
		String? spaceId,
		required DateTime createdAt,
		required DateTime updatedAt,
	})  : _id = id,
		_title = title,
		_spaceId = spaceId,
		_createdAt = createdAt,
		_updatedAt = updatedAt;

	String get id => _id;
	String? get title => _title;
	String? get spaceId => _spaceId;
	DateTime get createdAt => _createdAt;
	DateTime get updatedAt => _updatedAt;

	factory BuddyConversationModel.fromJson(Map<String, dynamic> json) {
		return BuddyConversationModel(
			id: json['id'] as String,
			title: json['title'] as String?,
			spaceId: json['space_id'] as String?,
			createdAt: json['created_at'] != null
				? DateTime.parse(json['created_at'] as String)
				: DateTime.now(),
			updatedAt: json['updated_at'] != null
				? DateTime.parse(json['updated_at'] as String)
				: DateTime.now(),
		);
	}
}
