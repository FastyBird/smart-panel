import 'dart:convert';

import 'package:fastybird_smart_panel/modules/devices/models/controls.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/repository.dart';
import 'package:flutter/foundation.dart';

class DeviceControlsRepository extends Repository<DeviceControlModel> {
  DeviceControlsRepository({
    required super.apiClient,
  });

  void insert(List<Map<String, dynamic>> json) {
    late Map<String, DeviceControlModel> insertData = {...data};

    for (var row in json) {
      try {
        DeviceControlModel control = DeviceControlModel.fromJson(row);

        insertData[control.id] = control;
      } catch (e) {
        if (kDebugMode) {
          debugPrint(
            '[DEVICES MODULE][DEVICES CONTROLS] Failed to create control model: ${e.toString()}',
          );
        }

        /// Failed to create new model
      }
    }

    if (!mapEquals(data, insertData)) {
      data = insertData;

      notifyListeners();
    }
  }

  void delete(String id) {
    if (data.containsKey(id) && data.remove(id) != null) {
      if (kDebugMode) {
        debugPrint(
          '[DEVICES MODULE][DEVICES CONTROLS] Removed control: $id',
        );
      }

      notifyListeners();
    }
  }

  Future<void> fetchControl(
    String deviceId,
    String id,
  ) async {
    return handleApiCall(
      () async {
        final response = await apiClient.getDevicesModuleDeviceControl(
          deviceId: deviceId,
          id: id,
        );

        insert([jsonDecode(jsonEncode(response.data.data))]);
      },
      'fetch device control',
    );
  }

  Future<void> fetchControls(
    String deviceId,
  ) async {
    return handleApiCall(
      () async {
        final response = await apiClient.getDevicesModuleDeviceControls(
          deviceId: deviceId,
        );

        List<Map<String, dynamic>> controls = [];

        for (var control in response.data.data) {
          controls.add(jsonDecode(jsonEncode(control)));
        }

        insert(controls);
      },
      'fetch device controls',
    );
  }
}
