import 'dart:async';

import 'package:fastybird_smart_panel/modules/config/repositories/module_config_repository.dart';
import 'package:fastybird_smart_panel/modules/weather/models/location.dart';
import 'package:fastybird_smart_panel/modules/weather/models/weather.dart';
import 'package:fastybird_smart_panel/modules/weather/repositories/current.dart';
import 'package:fastybird_smart_panel/modules/weather/repositories/forecast.dart';
import 'package:fastybird_smart_panel/modules/weather/repositories/locations.dart';
import 'package:fastybird_smart_panel/modules/weather/views/current_day.dart';
import 'package:fastybird_smart_panel/modules/weather/views/forecast_day.dart';
import 'package:flutter/foundation.dart';

class WeatherService extends ChangeNotifier {
  final CurrentWeatherRepository _currentDayRepository;
  final ForecastWeatherRepository _forecastRepository;
  final LocationsRepository _locationsRepository;
  final ModuleConfigRepository<WeatherConfigModel> _configurationRepository;

  CurrentDayView? _currentDay;

  List<ForecastDayView> _forecast = [];

  Timer? _updateDebounce;

  WeatherService({
    required CurrentWeatherRepository currentDayRepository,
    required ForecastWeatherRepository forecastRepository,
    required LocationsRepository locationsRepository,
    required ModuleConfigRepository<WeatherConfigModel> configurationRepository,
  })  : _currentDayRepository = currentDayRepository,
        _forecastRepository = forecastRepository,
        _locationsRepository = locationsRepository,
        _configurationRepository = configurationRepository;

  Future<void> initialize() async {
    _currentDayRepository.addListener(_scheduleUpdate);
    _forecastRepository.addListener(_scheduleUpdate);
    _locationsRepository.addListener(_scheduleUpdate);
    _configurationRepository.addListener(_scheduleUpdate);

    _updateData();
  }

  /// Get current weather for the primary/selected location (backward compatible)
  CurrentDayView? get currentDay => _currentDay;

  /// Get forecast for the primary/selected location (backward compatible)
  List<ForecastDayView> get forecast => _forecast;

  /// Get current weather for a specific location
  /// Falls back to primary location weather if locationId is null or not found
  CurrentDayView? getCurrentDayByLocation(String? locationId) {
    final configuration = _configurationRepository.data;
    if (configuration == null) return null;

    // If no locationId specified, return primary/global weather
    if (locationId == null) {
      return _currentDay;
    }

    // Try to get location-specific weather
    final locationWeather = _currentDayRepository.getByLocation(locationId);
    if (locationWeather != null) {
      return CurrentDayView(
        weatherModel: locationWeather,
        configModel: configuration,
      );
    }

    // Fall back to primary weather if location-specific not available
    return _currentDay;
  }

  /// Get forecast for a specific location
  /// Falls back to primary location forecast if locationId is null or not found
  List<ForecastDayView> getForecastByLocation(String? locationId) {
    final configuration = _configurationRepository.data;
    if (configuration == null) return [];

    // If no locationId specified, return primary/global forecast
    if (locationId == null) {
      return _forecast;
    }

    // Try to get location-specific forecast
    final locationForecast = _forecastRepository.getByLocation(locationId);
    if (locationForecast != null) {
      return locationForecast.map((day) => ForecastDayView(
        weatherModel: day,
        configModel: configuration,
      )).toList();
    }

    // Fall back to primary forecast if location-specific not available
    return _forecast;
  }

  /// Get all weather locations
  List<WeatherLocationModel> get locations => _locationsRepository.locations;

  /// Get location by ID
  WeatherLocationModel? getLocation(String locationId) {
    return _locationsRepository.locations.where((l) => l.id == locationId).firstOrNull;
  }

  /// Get the currently selected location
  WeatherLocationModel? get selectedLocation => _locationsRepository.selectedLocation;

  /// Get the selected location ID
  String? get selectedLocationId => _locationsRepository.selectedLocationId;

  /// Select a location by ID
  void selectLocation(String? locationId) {
    _locationsRepository.selectLocation(locationId);
  }

  /// Check if there are multiple locations
  bool get hasMultipleLocations => _locationsRepository.locations.length > 1;

  void _scheduleUpdate() {
    _updateDebounce?.cancel();
    _updateDebounce = Timer(const Duration(milliseconds: 50), _updateData);
  }

  void _updateData() {
    final currentDay = _currentDayRepository.data;
    final forecast = _forecastRepository.getItem();
    final configuration = _configurationRepository.data;

    late bool triggerNotifyListeners = false;

    CurrentDayView? newCurrentDay;

    if (currentDay != null && configuration != null) {
      newCurrentDay =
          CurrentDayView(weatherModel: currentDay, configModel: configuration);
    }

    if (_currentDay != newCurrentDay) {
      _currentDay = newCurrentDay;

      triggerNotifyListeners = true;
    }

    List<ForecastDayView> newForecast = [];

    if (configuration != null && forecast != null) {
      for (var day in forecast) {
        newForecast.add(
          ForecastDayView(
            weatherModel: day,
            configModel: configuration,
          ),
        );
      }
    }

    if (!listEquals(_forecast, newForecast)) {
      _forecast = newForecast;

      triggerNotifyListeners = true;
    }

    if (triggerNotifyListeners) {
      notifyListeners();
    }
  }

  @override
  void dispose() {
    _updateDebounce?.cancel();

    _currentDayRepository.removeListener(_scheduleUpdate);
    _forecastRepository.removeListener(_scheduleUpdate);
    _locationsRepository.removeListener(_scheduleUpdate);
    _configurationRepository.removeListener(_scheduleUpdate);

    super.dispose();
  }
}
