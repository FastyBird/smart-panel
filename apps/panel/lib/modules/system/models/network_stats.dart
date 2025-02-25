import 'package:fastybird_smart_panel/modules/system/models/model.dart';

class NetworkStatsModel extends Model {
  final String _interface;
  final int _rxBytes;
  final int _txBytes;

  NetworkStatsModel({
    required String interface,
    required int rxBytes,
    required int txBytes,
  })  : _interface = interface,
        _rxBytes = rxBytes,
        _txBytes = txBytes;

  String get interface => _interface;

  int get rxBytes => _rxBytes;

  int get txBytes => _txBytes;

  factory NetworkStatsModel.fromJson(Map<String, dynamic> json) {
    return NetworkStatsModel(
      interface: json['interface'],
      rxBytes: json['rx_bytes'],
      txBytes: json['tx_bytes'],
    );
  }

  NetworkStatsModel copyWith({
    String? interface,
    int? rxBytes,
    int? txBytes,
  }) {
    return NetworkStatsModel(
      interface: interface ?? _interface,
      rxBytes: rxBytes ?? _rxBytes,
      txBytes: txBytes ?? _txBytes,
    );
  }
}
