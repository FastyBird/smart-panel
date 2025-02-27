import 'package:fastybird_smart_panel/modules/system/models/model.dart';

class StorageInfoModel extends Model {
  final String _fs;
  final int _used;
  final int _size;
  final int _available;

  StorageInfoModel({
    required String fs,
    required int used,
    required int size,
    required int available,
  })  : _fs = fs,
        _used = used,
        _size = size,
        _available = available;

  String get fs => _fs;

  int get used => _used;

  int get size => _size;

  int get available => _available;

  factory StorageInfoModel.fromJson(Map<String, dynamic> json) {
    return StorageInfoModel(
      fs: json['fs'],
      used: json['used'],
      size: json['size'],
      available: json['available'],
    );
  }

  StorageInfoModel copyWith({
    String? fs,
    int? used,
    int? size,
    int? available,
  }) {
    return StorageInfoModel(
      fs: fs ?? _fs,
      used: used ?? _used,
      size: size ?? _size,
      available: available ?? _available,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is StorageInfoModel &&
          other._fs == _fs &&
          other._used == _used &&
          other._size == _size &&
          other._available == _available);

  @override
  int get hashCode => Object.hashAll([
        _fs,
        _used,
        _size,
        _available,
      ]);
}
