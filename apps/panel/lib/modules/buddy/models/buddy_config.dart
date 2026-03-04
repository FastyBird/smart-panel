import 'package:fastybird_smart_panel/modules/config/models/model.dart';

class BuddyConfigModel extends Model {
  final String _name;
  final bool _enabled;
  final String _ttsProvider;

  BuddyConfigModel({
    String name = 'Buddy',
    bool enabled = true,
    String ttsProvider = 'none',
  })  : _name = name,
        _enabled = enabled,
        _ttsProvider = ttsProvider;

  String get name => _name;
  bool get enabled => _enabled;
  String get ttsProvider => _ttsProvider;
  bool get isTtsConfigured => _ttsProvider != 'none' && _ttsProvider.isNotEmpty;

  factory BuddyConfigModel.fromJson(Map<String, dynamic> json) {
    return BuddyConfigModel(
      name: json['name'] as String? ?? 'Buddy',
      enabled: json['enabled'] as bool? ?? true,
      ttsProvider: json['tts_provider'] as String? ?? 'none',
    );
  }

  BuddyConfigModel copyWith({
    String? name,
    bool? enabled,
    String? ttsProvider,
  }) {
    return BuddyConfigModel(
      name: name ?? _name,
      enabled: enabled ?? _enabled,
      ttsProvider: ttsProvider ?? _ttsProvider,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is BuddyConfigModel &&
          other._name == _name &&
          other._enabled == _enabled &&
          other._ttsProvider == _ttsProvider);

  @override
  int get hashCode => Object.hash(_name, _enabled, _ttsProvider);
}
