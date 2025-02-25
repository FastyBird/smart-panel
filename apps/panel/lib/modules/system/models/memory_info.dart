import 'package:fastybird_smart_panel/modules/system/models/model.dart';

class MemoryInfoModel extends Model {
  final int _total;
  final int _used;
  final int _free;

  MemoryInfoModel({
    required int total,
    required int used,
    required int free,
  })  : _total = total,
        _used = used,
        _free = free;

  int get total => _total;

  int get used => _used;

  int get free => _free;

  factory MemoryInfoModel.fromJson(Map<String, dynamic> json) {
    return MemoryInfoModel(
      total: json['total'],
      used: json['used'],
      free: json['free'],
    );
  }

  MemoryInfoModel copyWith({
    int? total,
    int? used,
    int? free,
  }) {
    return MemoryInfoModel(
      total: total ?? _total,
      used: used ?? _used,
      free: free ?? _free,
    );
  }
}
