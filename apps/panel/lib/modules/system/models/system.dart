import 'package:fastybird_smart_panel/modules/config/models/model.dart';
import 'package:fastybird_smart_panel/modules/system/types/configuration.dart';

class SystemConfigModel extends Model {
  final Language _language;
  final String _timezone;
  final TimeFormat _timeFormat;
  final TemperatureUnit _temperatureUnit;
  final WindSpeedUnit _windSpeedUnit;
  final PressureUnit _pressureUnit;
  final PrecipitationUnit _precipitationUnit;
  final DistanceUnit _distanceUnit;
  final List<String>? _logLevels;
  final HouseMode _houseMode;

  SystemConfigModel({
    required Language language,
    required String timezone,
    required TimeFormat timeFormat,
    required TemperatureUnit temperatureUnit,
    required WindSpeedUnit windSpeedUnit,
    required PressureUnit pressureUnit,
    required PrecipitationUnit precipitationUnit,
    required DistanceUnit distanceUnit,
    List<String>? logLevels,
    required HouseMode houseMode,
  })  : _language = language,
        _timezone = timezone,
        _timeFormat = timeFormat,
        _temperatureUnit = temperatureUnit,
        _windSpeedUnit = windSpeedUnit,
        _pressureUnit = pressureUnit,
        _precipitationUnit = precipitationUnit,
        _distanceUnit = distanceUnit,
        _logLevels = logLevels,
        _houseMode = houseMode;

  Language get language => _language;

  String get timezone => _timezone;

  TimeFormat get timeFormat => _timeFormat;

  TemperatureUnit get temperatureUnit => _temperatureUnit;

  WindSpeedUnit get windSpeedUnit => _windSpeedUnit;

  PressureUnit get pressureUnit => _pressureUnit;

  PrecipitationUnit get precipitationUnit => _precipitationUnit;

  DistanceUnit get distanceUnit => _distanceUnit;

  List<String>? get logLevels => _logLevels;

  HouseMode get houseMode => _houseMode;

  factory SystemConfigModel.fromJson(Map<String, dynamic> json) {
    Language? language = Language.fromValue(json['language']);

    TimeFormat? timeFormat = TimeFormat.fromValue(json['time_format']);

    TemperatureUnit? temperatureUnit =
        json['temperature_unit'] != null ? TemperatureUnit.fromValue(json['temperature_unit']) : null;

    WindSpeedUnit? windSpeedUnit =
        json['wind_speed_unit'] != null ? WindSpeedUnit.fromValue(json['wind_speed_unit']) : null;

    PressureUnit? pressureUnit =
        json['pressure_unit'] != null ? PressureUnit.fromValue(json['pressure_unit']) : null;

    PrecipitationUnit? precipitationUnit =
        json['precipitation_unit'] != null ? PrecipitationUnit.fromValue(json['precipitation_unit']) : null;

    DistanceUnit? distanceUnit =
        json['distance_unit'] != null ? DistanceUnit.fromValue(json['distance_unit']) : null;

    HouseMode? houseMode = HouseMode.fromValue(json['house_mode']);

    List<String>? logLevels;
    if (json['log_levels'] is List) {
      logLevels = (json['log_levels'] as List).map((e) => e.toString()).toList();
    }

    return SystemConfigModel(
      language: language ?? Language.english,
      timezone: json['timezone'] ?? '',
      timeFormat: timeFormat ?? TimeFormat.twentyFourHour,
      temperatureUnit: temperatureUnit ?? TemperatureUnit.celsius,
      windSpeedUnit: windSpeedUnit ?? WindSpeedUnit.metersPerSecond,
      pressureUnit: pressureUnit ?? PressureUnit.hectopascal,
      precipitationUnit: precipitationUnit ?? PrecipitationUnit.millimeters,
      distanceUnit: distanceUnit ?? DistanceUnit.kilometers,
      logLevels: logLevels,
      houseMode: houseMode ?? HouseMode.home,
    );
  }

  SystemConfigModel copyWith({
    Language? language,
    String? timezone,
    TimeFormat? timeFormat,
    TemperatureUnit? temperatureUnit,
    WindSpeedUnit? windSpeedUnit,
    PressureUnit? pressureUnit,
    PrecipitationUnit? precipitationUnit,
    DistanceUnit? distanceUnit,
    List<String>? logLevels,
    HouseMode? houseMode,
  }) {
    return SystemConfigModel(
      language: language ?? _language,
      timezone: timezone ?? _timezone,
      timeFormat: timeFormat ?? _timeFormat,
      temperatureUnit: temperatureUnit ?? _temperatureUnit,
      windSpeedUnit: windSpeedUnit ?? _windSpeedUnit,
      pressureUnit: pressureUnit ?? _pressureUnit,
      precipitationUnit: precipitationUnit ?? _precipitationUnit,
      distanceUnit: distanceUnit ?? _distanceUnit,
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
          other._temperatureUnit.value == _temperatureUnit.value &&
          other._windSpeedUnit.value == _windSpeedUnit.value &&
          other._pressureUnit.value == _pressureUnit.value &&
          other._precipitationUnit.value == _precipitationUnit.value &&
          other._distanceUnit.value == _distanceUnit.value &&
          other._logLevels == _logLevels &&
          other._houseMode.value == _houseMode.value);

  @override
  int get hashCode => Object.hashAll([
        _language.value,
        _timezone,
        _timeFormat.value,
        _temperatureUnit.value,
        _windSpeedUnit.value,
        _pressureUnit.value,
        _precipitationUnit.value,
        _distanceUnit.value,
        _logLevels,
        _houseMode.value,
      ]);
}
