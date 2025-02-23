import 'package:fastybird_smart_panel/api/models/devices_device_control.dart';
import 'package:fastybird_smart_panel/modules/devices/models/controls.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/repository.dart';

class DeviceControlsRepository extends Repository<DeviceControlModel> {
  DeviceControlsRepository({
    required super.apiClient,
  });

  void insertControls(
    String deviceId,
    List<DevicesDeviceControl> apiControls,
  ) {
    for (var apiControl in apiControls) {
      data[apiControl.id] = DeviceControlModel.fromJson({
        'id': apiControl.id,
        'device': deviceId,
        'name': apiControl.name,
        'created_at': apiControl.createdAt.toIso8601String(),
        'updated_at': apiControl.updatedAt?.toIso8601String(),
      });
    }

    notifyListeners();
  }

  Future<void> fetchControl(
    String id,
    String deviceId,
  ) async {
    return handleApiCall(
      () async {
        final response = await apiClient.getDevicesModuleDeviceControl(
          deviceId: deviceId,
          id: id,
        );

        insertControls(deviceId, [response.data.data]);
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

        insertControls(deviceId, response.data.data);
      },
      'fetch device controls',
    );
  }
}
