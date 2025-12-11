import 'package:dio/dio.dart';
import 'package:fastybird_smart_panel/api/api_client.dart';
import 'package:fastybird_smart_panel/api/models/config_module_res_module_config.dart';
import 'package:fastybird_smart_panel/modules/config/models/language.dart';
import 'package:fastybird_smart_panel/modules/config/types/configuration.dart';
import 'package:flutter/foundation.dart';
import 'package:retrofit/retrofit.dart';

class SystemConfigRepository extends ChangeNotifier {
  static const String _moduleType = 'system-module';

  final ApiClient _apiClient;
  LanguageConfigModel? _languageData;
  Map<String, dynamic>? _systemData;

  SystemConfigRepository({required ApiClient apiClient}) : _apiClient = apiClient {
    _languageData = null;
    _systemData = null;
  }

  LanguageConfigModel? get languageData => _languageData;
  Map<String, dynamic>? get systemData => _systemData;

  LanguageConfigModel _getLanguageConfig() {
    if (_languageData == null) {
      throw Exception('System config is not initialized');
    }

    return _languageData!;
  }

  Language get language => _getLanguageConfig().language;

  String get timezone => _getLanguageConfig().timezone;

  TimeFormat get timeFormat => _getLanguageConfig().timeFormat;

  List<String>? get logLevels {
    if (_systemData == null) return null;
    final levels = _systemData!['log_levels'];
    if (levels is List) {
      return levels.map((e) => e.toString()).toList();
    }
    return null;
  }

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
      // Extract language settings
      final languageData = <String, dynamic>{
        'language': json['language'],
        'timezone': json['timezone'],
        'time_format': json['time_format'],
      };
      
      LanguageConfigModel newLanguageData = LanguageConfigModel.fromJson(languageData);

      // Extract system settings (log_levels)
      final systemData = <String, dynamic>{
        if (json.containsKey('log_levels')) 'log_levels': json['log_levels'],
      };

      bool hasChanges = false;

      if (_languageData != newLanguageData) {
        if (kDebugMode) {
          debugPrint(
            '[SYSTEM MODULE] System language configuration was successfully updated',
          );
        }

        _languageData = newLanguageData;
        hasChanges = true;
      }

      // Compare system data
      if (_systemData?['log_levels'] != systemData['log_levels']) {
        _systemData = systemData;
        hasChanges = true;
      }

      if (hasChanges) {
        notifyListeners();
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SYSTEM MODULE] System configuration model could not be created',
        );
      }

      rethrow;
    }
  }

  Future<bool> setLanguage(Language language) async {
    try {
      await _storeSystemConfig(language: language);
    } catch (e) {
      return false;
    }

    notifyListeners();

    return true;
  }

  Future<bool> setTimezone(String timezone) async {
    try {
      await _storeSystemConfig(timezone: timezone);
    } catch (e) {
      return false;
    }

    notifyListeners();

    return true;
  }

  Future<bool> setTimeFormat(TimeFormat format) async {
    try {
      await _storeSystemConfig(timeFormat: format);
    } catch (e) {
      return false;
    }

    notifyListeners();

    return true;
  }

  Future<void> _storeSystemConfig({
    Language? language,
    String? timezone,
    TimeFormat? timeFormat,
  }) async {
    final currentLanguage = _getLanguageConfig();
    
    // Build update data with all current fields, updating only the specified field
    final updateDataMap = <String, dynamic>{
      'type': _moduleType,
      'language': _convertLanguageToApiString(language ?? currentLanguage.language),
      'timezone': timezone ?? currentLanguage.timezone,
      'time_format': _convertTimeFormatToApiString(timeFormat ?? currentLanguage.timeFormat),
      if (_systemData != null && _systemData!.containsKey('log_levels'))
        'log_levels': _systemData!['log_levels'],
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

  String _convertLanguageToApiString(Language language) {
    return language.value;
  }

  String _convertTimeFormatToApiString(TimeFormat timeFormat) {
    return timeFormat.value;
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
    }, 'fetch system configuration');
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
    }, 'update system configuration');
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
          '[SYSTEM MODULE][${operation.toUpperCase()}] API error: ${e.response?.statusCode} - ${e.message}',
        );
      }

      throw Exception('Failed to call backend service');
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SYSTEM MODULE][${operation.toUpperCase()}] Unexpected error: ${e.toString()}',
        );
      }

      throw Exception('Unexpected error when calling backend service');
    }
  }
}
