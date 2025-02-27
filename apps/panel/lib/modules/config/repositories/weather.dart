import 'dart:convert';

import 'package:fastybird_smart_panel/api/models/config_req_update_section.dart';
import 'package:fastybird_smart_panel/api/models/config_req_update_section_data_union.dart';
import 'package:fastybird_smart_panel/api/models/config_res_section_data_union.dart';
import 'package:fastybird_smart_panel/api/models/config_update_weather_location_type.dart';
import 'package:fastybird_smart_panel/api/models/config_update_weather_type.dart';
import 'package:fastybird_smart_panel/api/models/config_update_weather_unit.dart';
import 'package:fastybird_smart_panel/api/models/config_weather_location_type.dart';
import 'package:fastybird_smart_panel/api/models/config_weather_unit.dart';
import 'package:fastybird_smart_panel/api/models/section.dart';
import 'package:fastybird_smart_panel/modules/config/models/weather.dart';
import 'package:fastybird_smart_panel/modules/config/repositories/repository.dart';
import 'package:fastybird_smart_panel/modules/config/types/configuration.dart';
import 'package:flutter/foundation.dart';

class WeatherConfigRepository extends Repository<WeatherConfigModel> {
  WeatherConfigRepository({required super.apiClient});

  WeatherConfigModel _getConfig() {
    if (data == null) {
      throw Exception('Config module is not initialized');
    }

    return data!;
  }

  String? get location => _getConfig().location;

  WeatherLocationType get locationType => _getConfig().locationType;

  WeatherUnit get unit => _getConfig().unit;

  Future<bool> refresh() async {
    try {
      await fetchConfiguration();

      return true;
    } catch (e) {
      return false;
    }
  }

  void insertConfiguration(Map<String, dynamic> json) {
    try {
      WeatherConfigModel newData = WeatherConfigModel.fromJson(json);

      if (data != newData) {
        if (kDebugMode) {
          debugPrint(
            '[CONFIG MODULE] Weather configuration was successfully updated',
          );
        }

        data = newData;

        notifyListeners();
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[CONFIG MODULE] Weather configuration model could not be created',
        );
      }

      rethrow;
    }
  }

  Future<bool> setWeatherUnit(WeatherUnit unit) async {
    try {
      await _storeWeatherSection(unit: unit);
    } catch (e) {
      return false;
    }

    notifyListeners();

    return true;
  }

  Future<void> _storeWeatherSection({
    WeatherLocationType? locationType,
    WeatherUnit? unit,
  }) async {
    final updated = await _updateConfiguration(
      section: Section.weather,
      data: ConfigReqUpdateSectionDataUnionWeather(
          type: ConfigUpdateWeatherType.weather,
          locationType: _convertWeatherLocationTypeToApi(
            locationType ?? _getConfig().locationType,
          ),
          unit: _convertWeatherUnitToApi(unit ?? _getConfig().unit)),
    );

    if (updated is ConfigResSectionDataUnionWeather) {
      data = _getConfig().copyWith(
        locationType: _convertWeatherLocationTypeFromApi(updated.locationType),
        unit: _convertWeatherUnitFromApi(updated.unit),
        location: updated.location,
      );
    } else {
      throw Exception('Received data from backend are not valid');
    }
  }

  Future<void> fetchConfiguration() async {
    return handleApiCall(
      () async {
        final response = await apiClient.getConfigModuleConfigSection(
            section: Section.weather);

        final data = response.data.data;

        if (data is ConfigResSectionDataUnionWeather) {
          insertConfiguration(jsonDecode(jsonEncode(data)));
        }
      },
      'fetch weather configuration',
    );
  }

  Future<ConfigResSectionDataUnion> _updateConfiguration({
    required Section section,
    required ConfigReqUpdateSectionDataUnion data,
  }) async {
    return await handleApiCall(
      () async {
        final response = await apiClient.updateConfigModuleConfigSection(
          section: section,
          body: ConfigReqUpdateSection(data: data),
        );

        return response.data.data;
      },
      'update weather configuration',
    );
  }

  WeatherLocationType _convertWeatherLocationTypeFromApi(
    ConfigWeatherLocationType locationType,
  ) {
    switch (locationType) {
      case ConfigWeatherLocationType.latLon:
        return WeatherLocationType.latLon;
      case ConfigWeatherLocationType.cityId:
        return WeatherLocationType.cityId;
      case ConfigWeatherLocationType.zipCode:
        return WeatherLocationType.zipCode;
      default:
        return WeatherLocationType.cityName;
    }
  }

  ConfigUpdateWeatherLocationType _convertWeatherLocationTypeToApi(
    WeatherLocationType locationType,
  ) {
    switch (locationType) {
      case WeatherLocationType.latLon:
        return ConfigUpdateWeatherLocationType.latLon;
      case WeatherLocationType.cityId:
        return ConfigUpdateWeatherLocationType.cityId;
      case WeatherLocationType.zipCode:
        return ConfigUpdateWeatherLocationType.zipCode;
      default:
        return ConfigUpdateWeatherLocationType.cityName;
    }
  }

  WeatherUnit _convertWeatherUnitFromApi(ConfigWeatherUnit unit) {
    switch (unit) {
      case ConfigWeatherUnit.fahrenheit:
        return WeatherUnit.fahrenheit;
      default:
        return WeatherUnit.celsius;
    }
  }

  ConfigUpdateWeatherUnit _convertWeatherUnitToApi(WeatherUnit unit) {
    switch (unit) {
      case WeatherUnit.fahrenheit:
        return ConfigUpdateWeatherUnit.fahrenheit;
      default:
        return ConfigUpdateWeatherUnit.celsius;
    }
  }
}
