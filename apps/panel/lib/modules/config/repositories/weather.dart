import 'package:fastybird_smart_panel/api/models/config_module_req_update_section.dart';
import 'package:fastybird_smart_panel/api/models/config_module_req_update_section_data_union.dart';
import 'package:fastybird_smart_panel/api/models/config_module_res_section_data_union.dart';
import 'package:fastybird_smart_panel/api/models/config_module_update_weather_location_type.dart';
import 'package:fastybird_smart_panel/api/models/config_module_update_weather_unit.dart';
import 'package:fastybird_smart_panel/api/models/config_module_data_weather_unit.dart';
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

  WeatherLocationType get locationType => _getConfig().locationType;

  WeatherUnit get unit => _getConfig().unit;

  String? get openWeatherApiKey => _getConfig().openWeatherApiKey;

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

  Future<void> _storeWeatherSection({required WeatherUnit unit}) async {
    final updated = await _updateConfiguration(
      section: Section.weather,
      data: ConfigModuleReqUpdateSectionDataUnionWeather(
        unit: _convertWeatherUnitToApi(unit),
        locationType: _convertWeatherLocationTypeToApi(locationType),
        openWeatherApiKey: openWeatherApiKey,
      ),
    );

    if (updated is ConfigModuleResSectionDataUnionWeather) {
      data = _getConfig().copyWith(
        unit: _convertWeatherUnitFromApi(
          updated.unit,
        ),
        openWeatherApiKey: updated.openWeatherApiKey,
      );
    } else {
      throw Exception('Received data from backend are not valid');
    }
  }

  Future<void> fetchConfiguration() async {
    return handleApiCall(() async {
      final response = await apiClient.getConfigModuleConfigSection(
        section: Section.weather,
      );

      final data = response.data.data;

      if (data is ConfigModuleResSectionDataUnionWeather) {
        final raw = response.response.data['data'] as Map<String, dynamic>;

        insertConfiguration(raw);
      }
    }, 'fetch weather configuration');
  }

  Future<ConfigModuleResSectionDataUnion> _updateConfiguration({
    required Section section,
    required ConfigModuleReqUpdateSectionDataUnion data,
  }) async {
    return await handleApiCall(() async {
      final response = await apiClient.updateConfigModuleConfigSection(
        section: section,
        body: ConfigModuleReqUpdateSection(data: data),
      );

      return response.data.data;
    }, 'update weather configuration');
  }


  ConfigModuleUpdateWeatherLocationType _convertWeatherLocationTypeToApi(
    WeatherLocationType locationType,
  ) {
    switch (locationType) {
      case WeatherLocationType.latLon:
        return ConfigModuleUpdateWeatherLocationType.latLon;
      case WeatherLocationType.cityId:
        return ConfigModuleUpdateWeatherLocationType.cityId;
      case WeatherLocationType.zipCode:
        return ConfigModuleUpdateWeatherLocationType.zipCode;
      default:
        return ConfigModuleUpdateWeatherLocationType.cityName;
    }
  }

  WeatherUnit _convertWeatherUnitFromApi(ConfigModuleDataWeatherUnit unit) {
    switch (unit) {
      case ConfigModuleDataWeatherUnit.fahrenheit:
        return WeatherUnit.fahrenheit;
      default:
        return WeatherUnit.celsius;
    }
  }

  ConfigModuleUpdateWeatherUnit _convertWeatherUnitToApi(
    WeatherUnit unit,
  ) {
    switch (unit) {
      case WeatherUnit.fahrenheit:
        return ConfigModuleUpdateWeatherUnit.fahrenheit;
      default:
        return ConfigModuleUpdateWeatherUnit.celsius;
    }
  }
}
