import 'package:fastybird_smart_panel/modules/system/models/model.dart';

class OperatingSystemInfoModel extends Model {
  final String _platform;
  final String _distro;
  final String _release;
  final int _uptime;

  OperatingSystemInfoModel({
    required String platform,
    required String distro,
    required String release,
    required int uptime,
  })  : _platform = platform,
        _distro = distro,
        _release = release,
        _uptime = uptime;

  String get platform => _platform;

  String get distro => _distro;

  String get release => _release;

  int get uptime => _uptime;

  factory OperatingSystemInfoModel.fromJson(Map<String, dynamic> json) {
    return OperatingSystemInfoModel(
      platform: json['platform'],
      distro: json['distro'],
      release: json['release'],
      uptime: json['uptime'],
    );
  }

  OperatingSystemInfoModel copyWith({
    String? platform,
    String? distro,
    String? release,
    int? uptime,
  }) {
    return OperatingSystemInfoModel(
      platform: platform ?? _platform,
      distro: distro ?? _distro,
      release: release ?? _release,
      uptime: uptime ?? _uptime,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is OperatingSystemInfoModel &&
          other._platform == _platform &&
          other._distro == _distro &&
          other._release == _release &&
          other._uptime == _uptime);

  @override
  int get hashCode => Object.hashAll([
        _platform,
        _distro,
        _release,
        _uptime,
      ]);
}
