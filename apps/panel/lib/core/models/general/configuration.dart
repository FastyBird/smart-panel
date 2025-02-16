import 'package:fastybird_smart_panel/core/types/configuration.dart';

class ConfigDisplayModel {
  final bool _darkMode;
  final int _brightness;
  final int _screenLockDuration;
  final bool _screenSaver;

  ConfigDisplayModel({
    required bool darkMode,
    required int brightness,
    required int screenLockDuration,
    required bool screenSaver,
  })  : _darkMode = darkMode,
        _brightness = brightness,
        _screenLockDuration = screenLockDuration,
        _screenSaver = screenSaver;

  bool get hasDarkMode => _darkMode;

  int get brightness => _brightness;

  int get screenLockDuration => _screenLockDuration;

  bool get hasScreenSaver => _screenSaver;

  ConfigDisplayModel copyWith({
    bool? darkMode,
    int? brightness,
    int? screenLockDuration,
    bool? screenSaver,
  }) {
    return ConfigDisplayModel(
      darkMode: darkMode ?? _darkMode,
      brightness: brightness ?? _brightness,
      screenLockDuration: screenLockDuration ?? _screenLockDuration,
      screenSaver: screenSaver ?? _screenSaver,
    );
  }
}

class ConfigAudioModel {
  final bool _speaker;
  final int _speakerVolume;
  final bool _microphone;
  final int _microphoneVolume;

  ConfigAudioModel({
    required bool speaker,
    required int speakerVolume,
    required bool microphone,
    required int microphoneVolume,
  })  : _speaker = speaker,
        _speakerVolume = speakerVolume,
        _microphone = microphone,
        _microphoneVolume = microphoneVolume;

  bool get hasSpeakerEnabled => _speaker;

  int get speakerVolume => _speakerVolume;

  bool get hasMicrophoneEnabled => _microphone;

  int get microphoneVolume => _microphoneVolume;

  ConfigAudioModel copyWith({
    bool? speaker,
    int? speakerVolume,
    bool? microphone,
    int? microphoneVolume,
  }) {
    return ConfigAudioModel(
      speaker: speaker ?? _speaker,
      speakerVolume: speakerVolume ?? _speakerVolume,
      microphone: microphone ?? _microphone,
      microphoneVolume: microphoneVolume ?? _microphoneVolume,
    );
  }
}

class ConfigLanguageModel {
  final Language _language;
  final String _timezone;
  final TimeFormat _timeFormat;

  ConfigLanguageModel({
    required Language language,
    required String timezone,
    required TimeFormat timeFormat,
  })  : _language = language,
        _timezone = timezone,
        _timeFormat = timeFormat;

  Language get language => _language;

  String get timezone => _timezone;

  TimeFormat get timeFormat => _timeFormat;

  ConfigLanguageModel copyWith({
    Language? language,
    String? timezone,
    TimeFormat? timeFormat,
  }) {
    return ConfigLanguageModel(
      language: language ?? _language,
      timezone: timezone ?? _timezone,
      timeFormat: timeFormat ?? _timeFormat,
    );
  }
}

class ConfigWeatherModel {
  final String? _location;
  final WeatherLocationType _locationType;
  final WeatherUnit _unit;

  ConfigWeatherModel({
    String? location,
    WeatherLocationType locationType = WeatherLocationType.cityName,
    WeatherUnit unit = WeatherUnit.celsius,
  })  : _location = location,
        _locationType = locationType,
        _unit = unit;

  String? get location => _location;

  WeatherLocationType get locationType => _locationType;

  WeatherUnit get unit => _unit;

  ConfigWeatherModel copyWith({
    String? location,
    WeatherLocationType? locationType,
    WeatherUnit? unit,
  }) {
    return ConfigWeatherModel(
      location: location ?? _location,
      locationType: locationType ?? _locationType,
      unit: unit ?? _unit,
    );
  }
}
