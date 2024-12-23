import 'package:fastybird_smart_panel/core/models/general/audio_configuration.dart';
import 'package:fastybird_smart_panel/core/models/general/display_configuration.dart';
import 'package:fastybird_smart_panel/core/models/general/language_configuration.dart';
import 'package:fastybird_smart_panel/core/models/general/weather_configuration.dart';
import 'package:fastybird_smart_panel/core/models/layout/screen_grid.dart';
import 'package:fastybird_smart_panel/core/types/localization.dart';
import 'package:fastybird_smart_panel/core/types/weather.dart';
import 'package:flutter/material.dart';

class ConfigurationRepository extends ChangeNotifier {
  final double _screenWidth;
  final double _screenHeight;
  final double _devicePixelRatio;

  late ScreenGridModel _screenGridConfiguration;
  late DisplayConfigurationModel _displayConfiguration;
  late AudioConfigurationModel _audioConfiguration;
  late LanguageConfigurationModel _languageConfiguration;
  late WeatherConfigurationModel _weatherConfiguration;

  ConfigurationRepository({
    required double screenWidth,
    required double screenHeight,
    required double devicePixelRatio,
  })  : _screenWidth = screenWidth,
        _screenHeight = screenHeight,
        _devicePixelRatio = devicePixelRatio;

  bool _isLoading = true;

  Future<void> initialize() async {
    _isLoading = true;

    notifyListeners();

    // Simulate fetching data from an API or repository
    await Future.delayed(const Duration(seconds: 2));

    // 240; // 150.0; // 120.0;
    double optimalCellSize =
        _calculateOptimalTileWidth(_screenWidth) / _devicePixelRatio;

    int columns = _screenWidth ~/ optimalCellSize;
    int rows = _screenHeight ~/ optimalCellSize;

    _screenGridConfiguration = ScreenGridModel(
      columns: columns,
      rows: rows,
      tileSize: optimalCellSize,
    );

    _displayConfiguration = DisplayConfigurationModel(
      darkMode: false,
      brightness: 50.0,
      screenLockDuration: 30,
      screenSaver: true,
    );

    _audioConfiguration = AudioConfigurationModel(
      speaker: true,
      speakerVolume: 50.0,
      microphone: true,
      microphoneVolume: 30.0,
    );

    _languageConfiguration = LanguageConfigurationModel(
      language: LanguageType.english,
      timezone: 'Europe/Prague',
      timeFormat: TimeFormatType.twentyFourHour,
    );

    _weatherConfiguration = WeatherConfigurationModel(
      location: 'Prague, Czech Republic',
    );

    _isLoading = false;

    notifyListeners();
  }

  bool get isLoading => _isLoading;

  ScreenGridModel get screenGrid => _screenGridConfiguration;

  DisplayConfigurationModel get displayConfiguration => _displayConfiguration;

  AudioConfigurationModel get audioConfiguration => _audioConfiguration;

  LanguageConfigurationModel get languageConfiguration =>
      _languageConfiguration;

  WeatherConfigurationModel get weatherConfiguration => _weatherConfiguration;

  setDisplayDarkMode(bool state) {
    _displayConfiguration = _displayConfiguration.copyWith(
      darkMode: state,
    );

    notifyListeners();
  }

  setDisplayBrightness(double brightness) {
    _displayConfiguration = _displayConfiguration.copyWith(
      brightness: brightness,
    );

    notifyListeners();
  }

  setDisplayScreenLockDuration(int duration) {
    _displayConfiguration = _displayConfiguration.copyWith(
      screenLockDuration: duration,
    );

    notifyListeners();
  }

  setDisplayScreenSaver(bool state) {
    _displayConfiguration = _displayConfiguration.copyWith(
      screenSaver: state,
    );

    notifyListeners();
  }

  setSpeakerState(bool state) {
    _audioConfiguration = _audioConfiguration.copyWith(
      speaker: state,
    );

    notifyListeners();
  }

  setSpeakerVolume(double volume) {
    _audioConfiguration = _audioConfiguration.copyWith(
      speakerVolume: volume,
    );

    notifyListeners();
  }

  setMicrophoneState(bool state) {
    _audioConfiguration = _audioConfiguration.copyWith(
      microphone: state,
    );

    notifyListeners();
  }

  setMicrophoneVolume(double volume) {
    _audioConfiguration = _audioConfiguration.copyWith(
      microphoneVolume: volume,
    );

    notifyListeners();
  }

  setLanguage(LanguageType language) {
    _languageConfiguration = _languageConfiguration.copyWith(
      language: language,
    );

    notifyListeners();
  }

  setTimezone(String timezone) {
    _languageConfiguration = _languageConfiguration.copyWith(
      timezone: timezone,
    );

    notifyListeners();
  }

  setTimeFormat(TimeFormatType format) {
    _languageConfiguration = _languageConfiguration.copyWith(
      timeFormat: format,
    );

    notifyListeners();
  }

  setWeatherUnit(UnitType unit) {
    _weatherConfiguration = _weatherConfiguration.copyWith(
      unit: unit,
    );

    notifyListeners();
  }

  double _calculateOptimalTileWidth(double screenWidth) {
    // Derived scaling factor from the data
    const double scalingFactor = 0.1667;

    // Calculate tile width
    double tileWidth = screenWidth * scalingFactor;

    // Adjust based on empirical data, ensuring reasonable limits
    if (screenWidth <= 480) {
      tileWidth = screenWidth / 4;
    } else if (screenWidth <= 600) {
      tileWidth = screenWidth / 6;
    } else if (screenWidth <= 720) {
      tileWidth = screenWidth / 8;
    }

    return tileWidth;
  }
}
