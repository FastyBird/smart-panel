import 'dart:convert';

import 'package:fastybird_smart_panel/api/models/config_req_update_section.dart';
import 'package:fastybird_smart_panel/api/models/config_req_update_section_data_union.dart';
import 'package:fastybird_smart_panel/api/models/config_res_section_data_union.dart';
import 'package:fastybird_smart_panel/api/models/config_update_display_type.dart';
import 'package:fastybird_smart_panel/api/models/section.dart';
import 'package:fastybird_smart_panel/modules/config/models/display.dart';
import 'package:fastybird_smart_panel/modules/config/repositories/repository.dart';
import 'package:flutter/foundation.dart';

class DisplayConfigRepository extends Repository<DisplayConfigModel> {
  DisplayConfigRepository({required super.apiClient});

  DisplayConfigModel _getConfig() {
    if (data == null) {
      throw Exception('Config module is not initialized');
    }

    return data!;
  }

  bool get hasDarkMode => _getConfig().hasDarkMode;

  int get brightness => _getConfig().brightness;

  int get screenLockDuration => _getConfig().screenLockDuration;

  bool get hasScreenSaver => _getConfig().hasScreenSaver;

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
      DisplayConfigModel newData = DisplayConfigModel.fromJson(json);

      if (data != newData) {
        if (kDebugMode) {
          debugPrint(
            '[CONFIG MODULE] Display configuration was successfully updated',
          );
        }

        data = newData;

        notifyListeners();
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[CONFIG MODULE] Display configuration model could not be created',
        );
      }

      rethrow;
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

  Future<void> _storeDisplaySection({
    bool? darkMode,
    int? brightness,
    int? screenLockDuration,
    bool? screenSaver,
  }) async {
    final updated = await _updateConfiguration(
      section: Section.display,
      data: ConfigReqUpdateSectionDataUnionDisplay(
        type: ConfigUpdateDisplayType.display,
        darkMode: darkMode ?? _getConfig().hasDarkMode,
        brightness: brightness ?? _getConfig().brightness,
        screenLockDuration:
            screenLockDuration ?? _getConfig().screenLockDuration,
        screenSaver: screenSaver ?? _getConfig().hasScreenSaver,
      ),
    );

    if (updated is ConfigResSectionDataUnionDisplay) {
      data = _getConfig().copyWith(
        darkMode: updated.darkMode,
        brightness: updated.brightness,
        screenLockDuration: updated.screenLockDuration,
        screenSaver: updated.screenSaver,
      );
    } else {
      throw Exception('Received data from backend are not valid');
    }
  }

  Future<void> fetchConfiguration() async {
    return handleApiCall(
      () async {
        final response = await apiClient.getConfigModuleConfigSection(
            section: Section.display);

        final data = response.data.data;

        if (data is ConfigResSectionDataUnionDisplay) {
          insertConfiguration(jsonDecode(jsonEncode(data)));
        }
      },
      'fetch display configuration',
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
      'update display configuration',
    );
  }
}
