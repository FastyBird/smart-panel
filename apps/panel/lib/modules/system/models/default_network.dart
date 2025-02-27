import 'package:fastybird_smart_panel/modules/system/models/model.dart';

class DefaultNetworkModel extends Model {
  final String _interface;
  final String _ip4;
  final String _ip6;
  final String _mac;

  DefaultNetworkModel({
    required String interface,
    required String ip4,
    required String ip6,
    required String mac,
  })  : _interface = interface,
        _ip4 = ip4,
        _ip6 = ip6,
        _mac = mac;

  String get interface => _interface;

  String get ip4 => _ip4;

  String get ip6 => _ip6;

  String get mac => _mac;

  factory DefaultNetworkModel.fromJson(Map<String, dynamic> json) {
    return DefaultNetworkModel(
      interface: json['interface'],
      ip4: json['ip4'],
      ip6: json['ip6'],
      mac: json['mac'],
    );
  }

  DefaultNetworkModel copyWith({
    String? interface,
    String? ip4,
    String? ip6,
    String? mac,
  }) {
    return DefaultNetworkModel(
      interface: interface ?? _interface,
      ip4: ip4 ?? _ip4,
      ip6: ip6 ?? _ip6,
      mac: mac ?? _mac,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is DefaultNetworkModel &&
          other._interface == _interface &&
          other._ip4 == _ip4 &&
          other._ip6 == _ip6 &&
          other._mac == _mac);

  @override
  int get hashCode => Object.hashAll([
        _interface,
        _ip4,
        _ip6,
        _mac,
      ]);
}
