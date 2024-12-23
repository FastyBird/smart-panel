import 'package:fastybird_smart_panel/core/types/localization.dart';

class LanguageConfigurationModel {
  final LanguageType _language;
  final String _timezone;
  final TimeFormatType _timeFormat;

  LanguageConfigurationModel({
    required LanguageType language,
    required String timezone,
    required TimeFormatType timeFormat,
  })  : _language = language,
        _timezone = timezone,
        _timeFormat = timeFormat;

  LanguageType get language => _language;

  String get timezone => _timezone;

  TimeFormatType get timeFormat => _timeFormat;

  LanguageConfigurationModel copyWith({
    LanguageType? language,
    String? timezone,
    TimeFormatType? timeFormat,
  }) {
    return LanguageConfigurationModel(
      language: language ?? _language,
      timezone: timezone ?? _timezone,
      timeFormat: timeFormat ?? _timeFormat,
    );
  }
}
