import 'dart:convert';

import 'package:fastybird_smart_panel/api/models/config_language_language.dart';
import 'package:fastybird_smart_panel/api/models/config_language_time_format.dart';
import 'package:fastybird_smart_panel/api/models/config_req_update_section.dart';
import 'package:fastybird_smart_panel/api/models/config_req_update_section_data_union.dart';
import 'package:fastybird_smart_panel/api/models/config_res_section_data_union.dart';
import 'package:fastybird_smart_panel/api/models/config_update_language_language.dart';
import 'package:fastybird_smart_panel/api/models/config_update_language_time_format.dart';
import 'package:fastybird_smart_panel/api/models/config_update_language_type.dart';
import 'package:fastybird_smart_panel/api/models/section.dart';
import 'package:fastybird_smart_panel/modules/config/models/language.dart';
import 'package:fastybird_smart_panel/modules/config/repositories/repository.dart';
import 'package:fastybird_smart_panel/modules/config/types/configuration.dart';
import 'package:flutter/foundation.dart';

class LanguageConfigRepository extends Repository<LanguageConfigModel> {
  LanguageConfigRepository({required super.apiClient});

  LanguageConfigModel _getConfig() {
    if (data == null) {
      throw Exception('Config module is not initialized');
    }

    return data!;
  }

  Language get language => _getConfig().language;

  String get timezone => _getConfig().timezone;

  TimeFormat get timeFormat => _getConfig().timeFormat;

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
      LanguageConfigModel newData = LanguageConfigModel.fromJson(json);

      if (data != newData) {
        if (kDebugMode) {
          debugPrint(
            '[CONFIG MODULE] Language configuration was successfully updated',
          );
        }

        data = newData;

        notifyListeners();
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[CONFIG MODULE] Language configuration model could not be created',
        );
      }

      rethrow;
    }
  }

  Future<bool> setLanguage(Language language) async {
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

  Future<bool> setTimeFormat(TimeFormat format) async {
    try {
      await _storeLanguageSection(timeFormat: format);
    } catch (e) {
      return false;
    }

    notifyListeners();

    return true;
  }

  Future<void> _storeLanguageSection({
    Language? language,
    String? timezone,
    TimeFormat? timeFormat,
  }) async {
    final updated = await _updateConfiguration(
      section: Section.language,
      data: ConfigReqUpdateSectionDataUnionLanguage(
        type: ConfigUpdateLanguageType.language,
        language: _convertLanguageToApi(language ?? _getConfig().language),
        timezone: timezone ?? _getConfig().timezone,
        timeFormat:
            _convertTimeFormatToApi(timeFormat ?? _getConfig().timeFormat),
      ),
    );

    if (updated is ConfigResSectionDataUnionLanguage) {
      data = _getConfig().copyWith(
        language: _convertLanguageFromApi(updated.language),
        timezone: updated.timezone,
        timeFormat: _convertTimeFormatFromApi(updated.timeFormat),
      );
    } else {
      throw Exception('Received data from backend are not valid');
    }
  }

  Future<void> fetchConfiguration() async {
    return handleApiCall(
      () async {
        final response = await apiClient.getConfigModuleConfigSection(
            section: Section.language);

        final data = response.data.data;

        if (data is ConfigResSectionDataUnionLanguage) {
          insertConfiguration(jsonDecode(jsonEncode(data)));
        }
      },
      'fetch language configuration',
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
      'update language configuration',
    );
  }

  Language _convertLanguageFromApi(ConfigLanguageLanguage language) {
    switch (language) {
      case ConfigLanguageLanguage.csCZ:
        return Language.czech;
      default:
        return Language.english;
    }
  }

  ConfigUpdateLanguageLanguage _convertLanguageToApi(Language language) {
    switch (language) {
      case Language.czech:
        return ConfigUpdateLanguageLanguage.csCZ;
      default:
        return ConfigUpdateLanguageLanguage.enUS;
    }
  }

  TimeFormat _convertTimeFormatFromApi(ConfigLanguageTimeFormat language) {
    switch (language) {
      case ConfigLanguageTimeFormat.value12h:
        return TimeFormat.twelveHour;
      default:
        return TimeFormat.twentyFourHour;
    }
  }

  ConfigUpdateLanguageTimeFormat _convertTimeFormatToApi(
      TimeFormat timeFormat) {
    switch (timeFormat) {
      case TimeFormat.twelveHour:
        return ConfigUpdateLanguageTimeFormat.value12h;
      default:
        return ConfigUpdateLanguageTimeFormat.value24h;
    }
  }
}
