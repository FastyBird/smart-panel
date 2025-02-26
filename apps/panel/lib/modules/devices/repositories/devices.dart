import 'dart:convert';

import 'package:fastybird_smart_panel/modules/devices/models/device.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/repository.dart';
import 'package:flutter/foundation.dart';

class DevicesRepository extends Repository<DeviceModel> {
  DevicesRepository({
    required super.apiClient,
  });

  void insert(List<Map<String, dynamic>> json) {
    late Map<String, DeviceModel> insertData = {...data};

    for (var row in json) {
      try {
        DeviceModel device = DeviceModel.fromJson(row);

        insertData[device.id] = device;
      } catch (e) {
        if (kDebugMode) {
          debugPrint(
            '[DEVICES MODULE][DEVICES] Failed to create device model: ${e.toString()}',
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
        debugPrint('[DEVICES MODULE][DEVICES] Removed device: $id');
      }

      notifyListeners();
    }
  }

  Future<void> fetchDevice(
    String id,
  ) async {
    return handleApiCall(
      () async {
        final response = await apiClient.getDevicesModuleDevice(
          id: id,
        );

        insert([jsonDecode(jsonEncode(response.data.data))]);
      },
      'fetch device',
    );
  }

  Future<void> fetchDevices() async {
    return handleApiCall(
      () async {
        final response = await apiClient.getDevicesModuleDevices();

        List<Map<String, dynamic>> devices = [];

        for (var device in response.data.data) {
          devices.add(jsonDecode(jsonEncode(device)));
        }

        insert(devices);
      },
      'fetch devices',
    );
  }
}
