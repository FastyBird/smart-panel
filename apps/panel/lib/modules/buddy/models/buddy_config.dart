import 'package:fastybird_smart_panel/modules/config/models/model.dart';

class BuddyConfigModel extends Model {
  final String _name;
  final bool _enabled;
  final String _ttsPlugin;
  final bool _voiceEnabled;

  BuddyConfigModel({
    String name = 'Buddy',
    bool enabled = true,
    String ttsPlugin = 'none',
    bool voiceEnabled = false,
  })  : _name = name,
        _enabled = enabled,
        _ttsPlugin = ttsPlugin,
        _voiceEnabled = voiceEnabled;

  String get name => _name;
  bool get enabled => _enabled;
  String get ttsPlugin => _ttsPlugin;
  bool get voiceEnabled => _voiceEnabled;
  bool get isTtsConfigured => _voiceEnabled && _ttsPlugin != 'none' && _ttsPlugin.isNotEmpty;

  factory BuddyConfigModel.fromJson(Map<String, dynamic> json) {
    return BuddyConfigModel(
      name: json['name'] as String? ?? 'Buddy',
      enabled: json['enabled'] as bool? ?? true,
      ttsPlugin: json['tts_plugin'] as String? ?? 'none',
      voiceEnabled: json['voice_enabled'] as bool? ?? false,
    );
  }

  BuddyConfigModel copyWith({
    String? name,
    bool? enabled,
    String? ttsPlugin,
    bool? voiceEnabled,
  }) {
    return BuddyConfigModel(
      name: name ?? _name,
      enabled: enabled ?? _enabled,
      ttsPlugin: ttsPlugin ?? _ttsPlugin,
      voiceEnabled: voiceEnabled ?? _voiceEnabled,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is BuddyConfigModel &&
          other._name == _name &&
          other._enabled == _enabled &&
          other._ttsPlugin == _ttsPlugin &&
          other._voiceEnabled == _voiceEnabled);

  @override
  int get hashCode => Object.hash(_name, _enabled, _ttsPlugin, _voiceEnabled);
}
