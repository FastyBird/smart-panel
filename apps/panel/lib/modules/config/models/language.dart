import 'package:fastybird_smart_panel/modules/config/models/model.dart';
import 'package:fastybird_smart_panel/modules/config/types/configuration.dart';

class LanguageConfigModel extends Model {
  final Language _language;
  final String _timezone;
  final TimeFormat _timeFormat;

  LanguageConfigModel({
    required Language language,
    required String timezone,
    required TimeFormat timeFormat,
  })  : _language = language,
        _timezone = timezone,
        _timeFormat = timeFormat;

  Language get language => _language;

  String get timezone => _timezone;

  TimeFormat get timeFormat => _timeFormat;

  factory LanguageConfigModel.fromJson(Map<String, dynamic> json) {
    Language? language = Language.fromValue(json['language']);

    TimeFormat? timeFormat = TimeFormat.fromValue(json['time_format']);

    return LanguageConfigModel(
      language: language ?? Language.english,
      timezone: json['timezone'],
      timeFormat: timeFormat ?? TimeFormat.twentyFourHour,
    );
  }

  LanguageConfigModel copyWith({
    Language? language,
    String? timezone,
    TimeFormat? timeFormat,
  }) {
    return LanguageConfigModel(
      language: language ?? _language,
      timezone: timezone ?? _timezone,
      timeFormat: timeFormat ?? _timeFormat,
    );
  }
}
