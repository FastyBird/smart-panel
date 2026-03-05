import 'package:fastybird_smart_panel/modules/config/models/model.dart';

const Object _sentinel = Object();

class BuddyConfigModel extends Model {
  final String _name;
  final bool _enabled;
  final String _ttsProvider;
  final String? _ttsApiKey;

  BuddyConfigModel({
    String name = 'Buddy',
    bool enabled = true,
    String ttsProvider = 'none',
    String? ttsApiKey,
  })  : _name = name,
        _enabled = enabled,
        _ttsProvider = ttsProvider,
        _ttsApiKey = ttsApiKey;

  String get name => _name;
  bool get enabled => _enabled;
  String get ttsProvider => _ttsProvider;
  bool get isTtsConfigured {
    if (_ttsProvider == 'none' || _ttsProvider.isEmpty) return false;
    // OpenAI TTS and ElevenLabs require an API key.
    // The backend masks the actual key (e.g. to '***') before sending it,
    // so we only check for null — any non-null value means a key is configured.
    if (_ttsProvider == 'openai_tts' || _ttsProvider == 'elevenlabs') {
      return _ttsApiKey != null;
    }
    return true;
  }

  factory BuddyConfigModel.fromJson(Map<String, dynamic> json) {
    return BuddyConfigModel(
      name: json['name'] as String? ?? 'Buddy',
      enabled: json['enabled'] as bool? ?? true,
      ttsProvider: json['tts_provider'] as String? ?? 'none',
      ttsApiKey: json['tts_api_key'] as String?,
    );
  }

  BuddyConfigModel copyWith({
    String? name,
    bool? enabled,
    String? ttsProvider,
    Object? ttsApiKey = _sentinel,
  }) {
    return BuddyConfigModel(
      name: name ?? _name,
      enabled: enabled ?? _enabled,
      ttsProvider: ttsProvider ?? _ttsProvider,
      ttsApiKey: ttsApiKey == _sentinel ? _ttsApiKey : ttsApiKey as String?,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is BuddyConfigModel &&
          other._name == _name &&
          other._enabled == _enabled &&
          other._ttsProvider == _ttsProvider &&
          other._ttsApiKey == _ttsApiKey);

  @override
  int get hashCode => Object.hash(_name, _enabled, _ttsProvider, _ttsApiKey);
}
