import 'package:fastybird_smart_panel/modules/system/models/model.dart';

class SystemActionModel extends Model {
  final String _status;
  final String? _reason;

  SystemActionModel({
    required String status,
    required String? reason,
  })  : _status = status,
        _reason = reason;

  String get status => _status;

  String? get reason => _reason;

  factory SystemActionModel.fromJson(Map<String, dynamic> json) {
    return SystemActionModel(
      status: json['status'],
      reason: json['reason'],
    );
  }
}
