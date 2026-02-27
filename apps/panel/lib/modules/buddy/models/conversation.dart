class BuddyConversationModel {
  final String _id;
  final String? _title;
  final String? _spaceId;
  final DateTime _createdAt;
  final DateTime _updatedAt;
  final List<BuddyMessageModel> _messages;

  BuddyConversationModel({
    required String id,
    String? title,
    String? spaceId,
    required DateTime createdAt,
    required DateTime updatedAt,
    List<BuddyMessageModel> messages = const [],
  })  : _id = id,
        _title = title,
        _spaceId = spaceId,
        _createdAt = createdAt,
        _updatedAt = updatedAt,
        _messages = messages;

  String get id => _id;

  String? get title => _title;

  String? get spaceId => _spaceId;

  DateTime get createdAt => _createdAt;

  DateTime get updatedAt => _updatedAt;

  List<BuddyMessageModel> get messages => _messages;

  factory BuddyConversationModel.fromJson(Map<String, dynamic> json) {
    List<BuddyMessageModel> messages = [];

    if (json['messages'] is List) {
      for (var msg in json['messages'] as List) {
        if (msg is Map<String, dynamic>) {
          try {
            messages.add(BuddyMessageModel.fromJson(msg));
          } catch (_) {
            // Skip malformed messages
          }
        }
      }
    }

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
      messages: messages,
    );
  }
}

class BuddyMessageModel {
  final String _id;
  final String _conversationId;
  final String _role;
  final String _content;
  final DateTime _createdAt;

  BuddyMessageModel({
    required String id,
    required String conversationId,
    required String role,
    required String content,
    required DateTime createdAt,
  })  : _id = id,
        _conversationId = conversationId,
        _role = role,
        _content = content,
        _createdAt = createdAt;

  String get id => _id;

  String get conversationId => _conversationId;

  String get role => _role;

  String get content => _content;

  DateTime get createdAt => _createdAt;

  bool get isUser => _role == 'user';

  bool get isAssistant => _role == 'assistant';

  factory BuddyMessageModel.fromJson(Map<String, dynamic> json) {
    return BuddyMessageModel(
      id: json['id'] as String,
      conversationId: json['conversation_id'] as String? ?? '',
      role: json['role'] as String,
      content: json['content'] as String,
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : DateTime.now(),
    );
  }
}
