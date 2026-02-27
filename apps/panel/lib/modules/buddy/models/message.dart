enum BuddyMessageRole {
	user,
	assistant,
	system;

	static BuddyMessageRole fromString(String value) {
		switch (value) {
			case 'user':
				return BuddyMessageRole.user;
			case 'assistant':
				return BuddyMessageRole.assistant;
			case 'system':
				return BuddyMessageRole.system;
			default:
				return BuddyMessageRole.assistant;
		}
	}
}

class BuddyMessageModel {
	final String _id;
	final String _conversationId;
	final BuddyMessageRole _role;
	final String _content;
	final DateTime _createdAt;

	BuddyMessageModel({
		required String id,
		required String conversationId,
		required BuddyMessageRole role,
		required String content,
		required DateTime createdAt,
	})  : _id = id,
		_conversationId = conversationId,
		_role = role,
		_content = content,
		_createdAt = createdAt;

	String get id => _id;
	String get conversationId => _conversationId;
	BuddyMessageRole get role => _role;
	String get content => _content;
	DateTime get createdAt => _createdAt;

	factory BuddyMessageModel.fromJson(Map<String, dynamic> json) {
		return BuddyMessageModel(
			id: json['id'] as String,
			conversationId: json['conversation_id'] as String? ?? '',
			role: BuddyMessageRole.fromString(json['role'] as String? ?? 'assistant'),
			content: json['content'] as String? ?? '',
			createdAt: json['created_at'] != null
				? DateTime.parse(json['created_at'] as String)
				: DateTime.now(),
		);
	}
}
