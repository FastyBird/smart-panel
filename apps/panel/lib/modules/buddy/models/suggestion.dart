class BuddySuggestionModel {
  final String _id;
  final String _type;
  final String _title;
  final String _reason;
  final String? _spaceId;
  final Map<String, dynamic> _metadata;
  final DateTime _createdAt;
  final DateTime _expiresAt;

  BuddySuggestionModel({
    required String id,
    required String type,
    required String title,
    required String reason,
    String? spaceId,
    Map<String, dynamic> metadata = const {},
    required DateTime createdAt,
    required DateTime expiresAt,
  })  : _id = id,
        _type = type,
        _title = title,
        _reason = reason,
        _spaceId = spaceId,
        _metadata = metadata,
        _createdAt = createdAt,
        _expiresAt = expiresAt;

  String get id => _id;

  String get type => _type;

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
      type: json['type'] as String,
      title: json['title'] as String,
      reason: json['reason'] as String,
      spaceId: json['space_id'] as String?,
      metadata: json['metadata'] is Map<String, dynamic>
          ? json['metadata'] as Map<String, dynamic>
          : {},
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'] as String)
          : DateTime.now(),
      expiresAt: json['expires_at'] != null
          ? DateTime.parse(json['expires_at'] as String)
          : DateTime.now().add(const Duration(hours: 2)),
    );
  }
}
