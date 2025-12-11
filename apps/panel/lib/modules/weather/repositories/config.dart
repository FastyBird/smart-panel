import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/api/models/config_module_res_module_config.dart';
import 'package:fastybird_smart_panel/modules/config/models/weather.dart';
import 'package:fastybird_smart_panel/modules/config/types/configuration.dart';
import 'package:flutter/foundation.dart';
import 'package:retrofit/retrofit.dart';

class WeatherConfigRepository extends ChangeNotifier {
  static const String _moduleType = 'weather-module';

  final ApiClient _apiClient;
  WeatherConfigModel? data;

  WeatherConfigRepository({required ApiClient apiClient}) : _apiClient = apiClient {
    data = null;
  }

  WeatherConfigModel _getConfig() {
    if (data == null) {
      throw Exception('Weather config is not initialized');
    }

    return data!;
  }

  WeatherConfigModel? getItem() {
    return data;
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
            '[WEATHER MODULE] Weather configuration was successfully updated',
          );
        }

        data = newData;

        notifyListeners();
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[WEATHER MODULE] Weather configuration model could not be created',
        );
      }

      rethrow;
    }
  }

  Future<bool> setWeatherUnit(WeatherUnit unit) async {
    try {
      await _storeWeatherConfig(unit: unit);
    } catch (e) {
      return false;
    }

    notifyListeners();

    return true;
  }

  Future<void> _storeWeatherConfig({required WeatherUnit unit}) async {
    final currentConfig = _getConfig();
    
    // Build update data with all current fields, updating only the unit
    // The backend accepts the full DTO structure, so we pass all fields
    final updateDataMap = <String, dynamic>{
      'type': _moduleType,
      'location_type': _convertWeatherLocationTypeToApiString(currentConfig.locationType),
      'unit': _convertWeatherUnitToApiString(unit),
      if (currentConfig.openWeatherApiKey != null)
        'open_weather_api_key': currentConfig.openWeatherApiKey,
    };

    // Create request body with data field
    final requestBody = <String, dynamic>{
      'data': updateDataMap,
    };

    final updated = await _updateConfigurationRaw(requestBody);

    // Extract the actual config data from the response
    final rawResponse = updated.response.data;
    if (rawResponse is Map<String, dynamic> &&
        rawResponse['data'] is Map<String, dynamic>) {
      final configData = rawResponse['data'] as Map<String, dynamic>;
      insertConfiguration(configData);
    } else {
      throw Exception('Received data from backend are not valid');
    }
  }

  String _convertWeatherLocationTypeToApiString(WeatherLocationType locationType) {
    return locationType.value;
  }

  String _convertWeatherUnitToApiString(WeatherUnit unit) {
    return unit.value;
  }

  Future<void> fetchConfiguration() async {
    return _handleApiCall(() async {
      final response = await _apiClient.configurationModule.getConfigModuleConfigModule(
        module: _moduleType,
      );

      // Extract the actual config data from the response
      final rawResponse = response.response.data;
      if (rawResponse is Map<String, dynamic> &&
          rawResponse['data'] is Map<String, dynamic>) {
        final configData = rawResponse['data'] as Map<String, dynamic>;
        insertConfiguration(configData);
      }
    }, 'fetch weather configuration');
  }

  Future<HttpResponse<ConfigModuleResModuleConfig>> _updateConfigurationRaw(
    Map<String, dynamic> requestBody,
  ) async {
    return await _handleApiCall(() async {
      // Get the Dio instance from ApiClient (it's private, but we need it for custom requests)
      // The generated ConfigModuleUpdateModule only has type and enabled,
      // but the backend accepts the full DTO structure, so we use Dio directly
      final dio = (_apiClient as dynamic)._dio as Dio;
      final baseUrl = (_apiClient as dynamic)._baseUrl as String?;
      
      // Build the full URL
      final url = baseUrl != null 
          ? '$baseUrl/config-module/config/module/$_moduleType'
          : '/config-module/config/module/$_moduleType';
      
      // Make the request with the full data structure
      final response = await dio.patch<Map<String, dynamic>>(
        url,
        data: requestBody,
      );
      
      // Parse the response to match the generated client's return type
      final responseData = ConfigModuleResModuleConfig.fromJson(response.data!);
      
      // Create HttpResponse to match the API client's return type
      return HttpResponse<ConfigModuleResModuleConfig>(
        responseData,
        response,
      );
    }, 'update weather configuration');
  }

  Future<T> _handleApiCall<T>(
    Future<T> Function() apiCall,
    String operation,
  ) async {
    try {
      return await apiCall();
    } on DioException catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[WEATHER MODULE][${operation.toUpperCase()}] API error: ${e.response?.statusCode} - ${e.message}',
        );
      }

      throw Exception('Failed to call backend service');
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[WEATHER MODULE][${operation.toUpperCase()}] Unexpected error: ${e.toString()}',
        );
      }

      throw Exception('Unexpected error when calling backend service');
    }
  }

}
