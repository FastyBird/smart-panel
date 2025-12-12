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
    _currentDayRepository.addListener(_updateData);
    _forecastRepository.addListener(_updateData);
    _locationsRepository.addListener(_updateData);
    _configurationRepository.addListener(_updateData);

    _updateData();
  }

  CurrentDayView? get currentDay => _currentDay;

  List<ForecastDayView> get forecast => _forecast;

  /// Get all weather locations
  List<WeatherLocationModel> get locations => _locationsRepository.locations;

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
    super.dispose();

    _currentDayRepository.removeListener(_updateData);
    _forecastRepository.removeListener(_updateData);
    _locationsRepository.removeListener(_updateData);
    _configurationRepository.removeListener(_updateData);
  }
}
