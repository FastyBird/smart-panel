import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/configuration_module/configuration_module_client.dart';
import 'package:fastybird_smart_panel/api/models/config_app.dart';
import 'package:fastybird_smart_panel/api/models/config_language_language.dart';
import 'package:fastybird_smart_panel/api/models/config_language_time_format.dart';
import 'package:fastybird_smart_panel/api/models/config_req_update_section.dart';
import 'package:fastybird_smart_panel/api/models/config_req_update_section_data_union.dart';
import 'package:fastybird_smart_panel/api/models/config_res_section_data_union.dart';
import 'package:fastybird_smart_panel/api/models/config_update_audio_type.dart';
import 'package:fastybird_smart_panel/api/models/config_update_display_type.dart';
import 'package:fastybird_smart_panel/api/models/config_update_language_language.dart';
import 'package:fastybird_smart_panel/api/models/config_update_language_time_format.dart';
import 'package:fastybird_smart_panel/api/models/config_update_language_type.dart';
import 'package:fastybird_smart_panel/api/models/config_update_weather_location_type.dart';
import 'package:fastybird_smart_panel/api/models/config_update_weather_type.dart';
import 'package:fastybird_smart_panel/api/models/config_update_weather_unit.dart';
import 'package:fastybird_smart_panel/api/models/config_weather_location_type.dart';
import 'package:fastybird_smart_panel/api/models/config_weather_unit.dart';
import 'package:fastybird_smart_panel/api/models/section.dart';
import 'package:fastybird_smart_panel/core/models/general/audio_configuration.dart';
import 'package:fastybird_smart_panel/core/models/general/display_configuration.dart';
import 'package:fastybird_smart_panel/core/models/general/language_configuration.dart';
import 'package:fastybird_smart_panel/core/models/general/weather_configuration.dart';
import 'package:fastybird_smart_panel/core/types/localization.dart';
import 'package:fastybird_smart_panel/core/types/weather.dart';
import 'package:flutter/material.dart';

class ConfigurationRepository extends ChangeNotifier {
  final ConfigurationModuleClient _apiClient;

  late DisplayConfigurationModel _displayConfiguration;
  late AudioConfigurationModel _audioConfiguration;
  late LanguageConfigurationModel _languageConfiguration;
  late WeatherConfigurationModel _weatherConfiguration;

  bool _isLoading = true;

  ConfigurationRepository({
    required ConfigurationModuleClient apiClient,
  }) : _apiClient = apiClient;

  Future<void> initialize() async {
    _isLoading = true;

    _loadConfiguration();

    _isLoading = false;

    notifyListeners();
  }

  bool get isLoading => _isLoading;

  DisplayConfigurationModel get displayConfiguration => _displayConfiguration;

  AudioConfigurationModel get audioConfiguration => _audioConfiguration;

  LanguageConfigurationModel get languageConfiguration =>
      _languageConfiguration;

  WeatherConfigurationModel get weatherConfiguration => _weatherConfiguration;

  Future<bool> refresh() async {
    try {
      await _loadConfiguration();

      return true;
    } catch (e) {
      return false;
    }
  }

  Future<bool> setDisplayDarkMode(bool state) async {
    try {
      await _storeDisplaySection(darkMode: state);
    } catch (e) {
      return false;
    }

    notifyListeners();

    return true;
  }

  Future<bool> setDisplayBrightness(int brightness) async {
    try {
      await _storeDisplaySection(brightness: brightness);
    } catch (e) {
      return false;
    }

    notifyListeners();

    return true;
  }

  Future<bool> setDisplayScreenLockDuration(int duration) async {
    try {
      await _storeDisplaySection(screenLockDuration: duration);
    } catch (e) {
      return false;
    }

    notifyListeners();

    return true;
  }

  Future<bool> setDisplayScreenSaver(bool state) async {
    try {
      await _storeDisplaySection(screenSaver: state);
    } catch (e) {
      return false;
    }

    notifyListeners();

    return true;
  }

  Future<bool> setSpeakerState(bool state) async {
    try {
      await _storeAudioSection(speaker: state);
    } catch (e) {
      return false;
    }

    notifyListeners();

    return true;
  }

  Future<bool> setSpeakerVolume(int volume) async {
    try {
      await _storeAudioSection(speakerVolume: volume);
    } catch (e) {
      return false;
    }

    notifyListeners();

    return true;
  }

  Future<bool> setMicrophoneState(bool state) async {
    try {
      await _storeAudioSection(microphone: state);
    } catch (e) {
      return false;
    }

    notifyListeners();

    return true;
  }

  Future<bool> setMicrophoneVolume(int volume) async {
    try {
      await _storeAudioSection(microphoneVolume: volume);
    } catch (e) {
      return false;
    }

    notifyListeners();

    return true;
  }

  Future<bool> setLanguage(LanguageType language) async {
    try {
      await _storeLanguageSection(language: language);
    } catch (e) {
      return false;
    }

    notifyListeners();

    return true;
  }

  Future<bool> setTimezone(String timezone) async {
    try {
      await _storeLanguageSection(timezone: timezone);
    } catch (e) {
      return false;
    }

    notifyListeners();

    return true;
  }

  Future<bool> setTimeFormat(TimeFormatType format) async {
    try {
      await _storeLanguageSection(timeFormat: format);
    } catch (e) {
      return false;
    }

    notifyListeners();

    return true;
  }

  Future<bool> setWeatherUnit(WeatherUnitType unit) async {
    try {
      await _storeWeatherSection(unit: unit);
    } catch (e) {
      return false;
    }

    notifyListeners();

    return true;
  }

  Future<void> _storeDisplaySection({
    bool? darkMode,
    int? brightness,
    int? screenLockDuration,
    bool? screenSaver,
  }) async {
    final updated = await _updateConfiguration(
      section: Section.display,
      data: ConfigUpdateDisplay(
        type: ConfigUpdateDisplayType.display,
        darkMode: darkMode ?? _displayConfiguration.hasDarkMode,
        brightness: brightness ?? _displayConfiguration.brightness,
        screenLockDuration:
            screenLockDuration ?? _displayConfiguration.screenLockDuration,
        screenSaver: screenSaver ?? _displayConfiguration.hasScreenSaver,
      ),
    );

    if (updated is ConfigDisplay) {
      _displayConfiguration = _displayConfiguration.copyWith(
        darkMode: updated.darkMode,
        brightness: updated.brightness,
        screenLockDuration: updated.screenLockDuration,
        screenSaver: updated.screenSaver,
      );
    } else {
      throw Exception('Invalid config section received');
    }
  }

  Future<void> _storeAudioSection({
    bool? speaker,
    int? speakerVolume,
    bool? microphone,
    int? microphoneVolume,
  }) async {
    final updated = await _updateConfiguration(
      section: Section.audio,
      data: ConfigUpdateAudio(
        type: ConfigUpdateAudioType.audio,
        speaker: speaker ?? _audioConfiguration.hasSpeakerEnabled,
        speakerVolume: speakerVolume ?? _audioConfiguration.speakerVolume,
        microphone: microphone ?? _audioConfiguration.hasMicrophoneEnabled,
        microphoneVolume:
            microphoneVolume ?? _audioConfiguration.microphoneVolume,
      ),
    );

    if (updated is ConfigAudio) {
      _audioConfiguration = _audioConfiguration.copyWith(
        speaker: updated.speaker,
        speakerVolume: updated.speakerVolume,
        microphone: updated.microphone,
        microphoneVolume: updated.microphoneVolume,
      );
    } else {
      throw Exception('Invalid config section received');
    }
  }

  Future<void> _storeLanguageSection({
    LanguageType? language,
    String? timezone,
    TimeFormatType? timeFormat,
  }) async {
    final updated = await _updateConfiguration(
      section: Section.language,
      data: ConfigUpdateLanguage(
        type: ConfigUpdateLanguageType.language,
        language: _convertLanguageToApi(
          language ?? _languageConfiguration.language,
        ),
        timezone: timezone ?? _languageConfiguration.timezone,
        timeFormat: _convertTimeFormatToApi(
          timeFormat ?? _languageConfiguration.timeFormat,
        ),
      ),
    );

    if (updated is ConfigLanguage) {
      _languageConfiguration = _languageConfiguration.copyWith(
        language: _convertLanguageFromApi(updated.language),
        timezone: updated.timezone,
        timeFormat: _convertTimeFormatFromApi(updated.timeFormat),
      );
    } else {
      throw Exception('Invalid config section received');
    }
  }

  Future<void> _storeWeatherSection({
    WeatherLocationTypeType? locationType,
    WeatherUnitType? unit,
  }) async {
    final updated = await _updateConfiguration(
      section: Section.weather,
      data: ConfigUpdateWeather(
          type: ConfigUpdateWeatherType.weather,
          locationType: _convertWeatherLocationTypeToApi(
            locationType ?? _weatherConfiguration.locationType,
          ),
          unit: _convertWeatherUnitToApi(unit ?? _weatherConfiguration.unit)),
    );

    if (updated is ConfigWeather) {
      _weatherConfiguration = _weatherConfiguration.copyWith(
        locationType: _convertWeatherLocationTypeFromApi(updated.locationType),
        unit: _convertWeatherUnitFromApi(updated.unit),
        location: updated.location,
      );
    } else {
      throw Exception('Invalid config section received');
    }
  }

  Future<void> _loadConfiguration() async {
    var resConfig = await _fetchConfiguration();

    _displayConfiguration = DisplayConfigurationModel(
      darkMode: resConfig.display.darkMode,
      brightness: resConfig.display.brightness,
      screenLockDuration: resConfig.display.screenLockDuration,
      screenSaver: resConfig.display.screenSaver,
    );
    _audioConfiguration = AudioConfigurationModel(
      speaker: resConfig.audio.speaker,
      speakerVolume: resConfig.audio.speakerVolume,
      microphone: resConfig.audio.microphone,
      microphoneVolume: resConfig.audio.microphoneVolume,
    );
    _languageConfiguration = LanguageConfigurationModel(
      language: _convertLanguageFromApi(resConfig.language.language),
      timezone: resConfig.language.timezone,
      timeFormat: _convertTimeFormatFromApi(resConfig.language.timeFormat),
    );
    _weatherConfiguration = WeatherConfigurationModel(
      location: resConfig.weather.location,
      locationType: _convertWeatherLocationTypeFromApi(
        resConfig.weather.locationType,
      ),
      unit: _convertWeatherUnitFromApi(resConfig.weather.unit),
    );
  }

  Future<ConfigApp> _fetchConfiguration() async {
    return _handleApiCall(
      () async {
        final response = await _apiClient.getConfigModuleConfig();

        return response.data.data;
      },
      'fetch configuration',
    );
  }

  Future<ConfigResSectionDataUnion> _updateConfiguration({
    required Section section,
    required ConfigReqUpdateSectionDataUnion data,
  }) async {
    return await _handleApiCall(
      () async {
        final response = await _apiClient.updateConfigModuleConfigSection(
          section: section,
          body: ConfigReqUpdateSection(data: data),
        );

        return response.data.data;
      },
      'update configuration',
    );
  }

  Future<T> _handleApiCall<T>(
    Future<T> Function() apiCall,
    String operation,
  ) async {
    try {
      return await apiCall();
    } on DioException catch (e) {
      debugPrint(
        'API Error ($operation): ${e.response?.statusCode} - ${e.message}',
      );

      throw Exception('Failed to $operation: ${e.response?.statusCode}');
    } catch (e) {
      debugPrint('Unexpected Error ($operation): ${e.toString()}');

      throw Exception('Unexpected error occurred while trying to $operation');
    }
  }

  LanguageType _convertLanguageFromApi(ConfigLanguageLanguage language) {
    switch (language) {
      case ConfigLanguageLanguage.csCZ:
        return LanguageType.czech;
      default:
        return LanguageType.english;
    }
  }

  ConfigUpdateLanguageLanguage _convertLanguageToApi(LanguageType language) {
    switch (language) {
      case LanguageType.czech:
        return ConfigUpdateLanguageLanguage.csCZ;
      default:
        return ConfigUpdateLanguageLanguage.enUS;
    }
  }

  TimeFormatType _convertTimeFormatFromApi(ConfigLanguageTimeFormat language) {
    switch (language) {
      case ConfigLanguageTimeFormat.value12h:
        return TimeFormatType.twelveHour;
      default:
        return TimeFormatType.twentyFourHour;
    }
  }

  ConfigUpdateLanguageTimeFormat _convertTimeFormatToApi(
      TimeFormatType timeFormat) {
    switch (timeFormat) {
      case TimeFormatType.twelveHour:
        return ConfigUpdateLanguageTimeFormat.value12h;
      default:
        return ConfigUpdateLanguageTimeFormat.value24h;
    }
  }

  WeatherLocationTypeType _convertWeatherLocationTypeFromApi(
      ConfigWeatherLocationType language) {
    switch (language) {
      case ConfigWeatherLocationType.latLon:
        return WeatherLocationTypeType.latLon;
      case ConfigWeatherLocationType.cityId:
        return WeatherLocationTypeType.cityId;
      case ConfigWeatherLocationType.zipCode:
        return WeatherLocationTypeType.zipCode;
      default:
        return WeatherLocationTypeType.cityName;
    }
  }

  ConfigUpdateWeatherLocationType _convertWeatherLocationTypeToApi(
    WeatherLocationTypeType timeFormat,
  ) {
    switch (timeFormat) {
      case WeatherLocationTypeType.latLon:
        return ConfigUpdateWeatherLocationType.latLon;
      case WeatherLocationTypeType.cityId:
        return ConfigUpdateWeatherLocationType.cityId;
      case WeatherLocationTypeType.zipCode:
        return ConfigUpdateWeatherLocationType.zipCode;
      default:
        return ConfigUpdateWeatherLocationType.cityName;
    }
  }

  WeatherUnitType _convertWeatherUnitFromApi(ConfigWeatherUnit language) {
    switch (language) {
      case ConfigWeatherUnit.fahrenheit:
        return WeatherUnitType.fahrenheit;
      default:
        return WeatherUnitType.celsius;
    }
  }

  ConfigUpdateWeatherUnit _convertWeatherUnitToApi(WeatherUnitType timeFormat) {
    switch (timeFormat) {
      case WeatherUnitType.fahrenheit:
        return ConfigUpdateWeatherUnit.fahrenheit;
      default:
        return ConfigUpdateWeatherUnit.celsius;
    }
  }
}
