import 'package:fastybird_smart_panel/api/models/devices_res_devices_data_union.dart';
import 'package:fastybird_smart_panel/modules/devices/models/device.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/repository.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:flutter/foundation.dart';

class DevicesRepository extends Repository<DeviceModel> {
  DevicesRepository({
    required super.apiClient,
  });

  void insertDevices(
    List<DevicesResDevicesDataUnion> apiDevices,
  ) {
    for (var apiDevice in apiDevices) {
      final DeviceCategory? category = DeviceCategory.fromValue(
        apiDevice.category.json ?? DeviceCategory.generic.value,
      );

      if (category == null || apiDevice.category.json == null) {
        if (kDebugMode) {
          debugPrint(
            '[DEVICES MODULE][DEVICES] Unknown device category: "${apiDevice.category.json}" for device: "${apiDevice.id}"',
          );
        }

        continue;
      }

      try {
        data[apiDevice.id] = DeviceModel.fromJson({
          'id': apiDevice.id,
          'category': apiDevice.category.json,
          'name': apiDevice.name,
          'description': apiDevice.description,
          'created_at': apiDevice.createdAt.toIso8601String(),
          'updated_at': apiDevice.updatedAt?.toIso8601String(),
          'controls': apiDevice.controls
              .map(
                (control) => control.id,
              )
              .toList(),
          'channels': apiDevice.channels
              .map(
                (channel) => channel.id,
              )
              .toList(),
        });
      } catch (e) {
        continue;
      }
    }

    notifyListeners();
  }

  Future<void> fetchDevices() async {
    return handleApiCall(
      () async {
        final response = await apiClient.getDevicesModuleDevices();

        insertDevices(response.data.data);
      },
      'fetch devices',
    );
  }
}
