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
