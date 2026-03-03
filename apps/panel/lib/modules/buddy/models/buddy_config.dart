import 'package:fastybird_smart_panel/modules/config/models/model.dart';

class BuddyConfigModel extends Model {
  final String _name;
  final bool _enabled;

  BuddyConfigModel({
    String name = 'Buddy',
    bool enabled = true,
  })  : _name = name,
        _enabled = enabled;

  String get name => _name;
  bool get enabled => _enabled;

  factory BuddyConfigModel.fromJson(Map<String, dynamic> json) {
    return BuddyConfigModel(
      name: json['name'] as String? ?? 'Buddy',
      enabled: json['enabled'] as bool? ?? true,
    );
  }

  BuddyConfigModel copyWith({
    String? name,
    bool? enabled,
  }) {
    return BuddyConfigModel(
      name: name ?? _name,
      enabled: enabled ?? _enabled,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is BuddyConfigModel &&
          other._name == _name &&
          other._enabled == _enabled);

  @override
  int get hashCode => Object.hash(_name, _enabled);
}
