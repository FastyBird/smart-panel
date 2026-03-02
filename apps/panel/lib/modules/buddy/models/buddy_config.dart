import 'package:fastybird_smart_panel/modules/config/models/model.dart';

class BuddyConfigModel extends Model {
  final String _name;

  BuddyConfigModel({
    String name = 'Buddy',
  }) : _name = name;

  String get name => _name;

  factory BuddyConfigModel.fromJson(Map<String, dynamic> json) {
    return BuddyConfigModel(
      name: json['name'] as String? ?? 'Buddy',
    );
  }

  BuddyConfigModel copyWith({
    String? name,
  }) {
    return BuddyConfigModel(
      name: name ?? _name,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is BuddyConfigModel && other._name == _name);

  @override
  int get hashCode => _name.hashCode;
}
