import 'package:fastybird_smart_panel/modules/config/models/model.dart';
import 'package:fastybird_smart_panel/modules/system/types/configuration.dart';

class SystemConfigModel extends Model {
  final Language _language;
  final String _timezone;
  final TimeFormat _timeFormat;
  final List<String>? _logLevels;

  SystemConfigModel({
    required Language language,
    required String timezone,
    required TimeFormat timeFormat,
    List<String>? logLevels,
  })  : _language = language,
        _timezone = timezone,
        _timeFormat = timeFormat,
        _logLevels = logLevels;

  Language get language => _language;

  String get timezone => _timezone;

  TimeFormat get timeFormat => _timeFormat;

  List<String>? get logLevels => _logLevels;

  factory SystemConfigModel.fromJson(Map<String, dynamic> json) {
    Language? language = Language.fromValue(json['language']);

    TimeFormat? timeFormat = TimeFormat.fromValue(json['time_format']);

    List<String>? logLevels;
    if (json['log_levels'] is List) {
      logLevels = (json['log_levels'] as List).map((e) => e.toString()).toList();
    }

    return SystemConfigModel(
      language: language ?? Language.english,
      timezone: json['timezone'] ?? '',
      timeFormat: timeFormat ?? TimeFormat.twentyFourHour,
      logLevels: logLevels,
    );
  }

  SystemConfigModel copyWith({
    Language? language,
    String? timezone,
    TimeFormat? timeFormat,
    List<String>? logLevels,
  }) {
    return SystemConfigModel(
      language: language ?? _language,
      timezone: timezone ?? _timezone,
      timeFormat: timeFormat ?? _timeFormat,
      logLevels: logLevels ?? _logLevels,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is SystemConfigModel &&
          other._language.value == _language.value &&
          other._timezone == _timezone &&
          other._timeFormat.value == _timeFormat.value &&
          other._logLevels == _logLevels);

  @override
  int get hashCode => Object.hashAll([
        _language.value,
        _timezone,
        _timeFormat.value,
        _logLevels,
      ]);
}
