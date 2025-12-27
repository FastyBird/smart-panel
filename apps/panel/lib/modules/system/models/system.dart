import 'package:fastybird_smart_panel/modules/config/models/model.dart';
import 'package:fastybird_smart_panel/modules/system/types/configuration.dart';

class SystemConfigModel extends Model {
  final Language _language;
  final String _timezone;
  final TimeFormat _timeFormat;
  final List<String>? _logLevels;
  final HouseMode _houseMode;

  SystemConfigModel({
    required Language language,
    required String timezone,
    required TimeFormat timeFormat,
    List<String>? logLevels,
    required HouseMode houseMode,
  })  : _language = language,
        _timezone = timezone,
        _timeFormat = timeFormat,
        _logLevels = logLevels,
        _houseMode = houseMode;

  Language get language => _language;

  String get timezone => _timezone;

  TimeFormat get timeFormat => _timeFormat;

  List<String>? get logLevels => _logLevels;

  HouseMode get houseMode => _houseMode;

  factory SystemConfigModel.fromJson(Map<String, dynamic> json) {
    Language? language = Language.fromValue(json['language']);

    TimeFormat? timeFormat = TimeFormat.fromValue(json['time_format']);

    HouseMode? houseMode = HouseMode.fromValue(json['house_mode']);

    List<String>? logLevels;
    if (json['log_levels'] is List) {
      logLevels = (json['log_levels'] as List).map((e) => e.toString()).toList();
    }

    return SystemConfigModel(
      language: language ?? Language.english,
      timezone: json['timezone'] ?? '',
      timeFormat: timeFormat ?? TimeFormat.twentyFourHour,
      logLevels: logLevels,
      houseMode: houseMode ?? HouseMode.home,
    );
  }

  SystemConfigModel copyWith({
    Language? language,
    String? timezone,
    TimeFormat? timeFormat,
    List<String>? logLevels,
    HouseMode? houseMode,
  }) {
    return SystemConfigModel(
      language: language ?? _language,
      timezone: timezone ?? _timezone,
      timeFormat: timeFormat ?? _timeFormat,
      logLevels: logLevels ?? _logLevels,
      houseMode: houseMode ?? _houseMode,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is SystemConfigModel &&
          other._language.value == _language.value &&
          other._timezone == _timezone &&
          other._timeFormat.value == _timeFormat.value &&
          other._logLevels == _logLevels &&
          other._houseMode.value == _houseMode.value);

  @override
  int get hashCode => Object.hashAll([
        _language.value,
        _timezone,
        _timeFormat.value,
        _logLevels,
        _houseMode.value,
      ]);
}
