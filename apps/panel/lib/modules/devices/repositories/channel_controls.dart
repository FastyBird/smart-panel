import 'package:fastybird_smart_panel/api/models/devices_channel_control.dart';
import 'package:fastybird_smart_panel/modules/devices/models/controls.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/repository.dart';

class ChannelControlsRepository extends Repository<ChannelControlDataModel> {
  ChannelControlsRepository({
    required super.apiClient,
  });

  void insertControls(
    String channelId,
    List<DevicesChannelControl> apiControls,
  ) {
    for (var apiControl in apiControls) {
      data[apiControl.id] = ChannelControlDataModel.fromJson({
        'id': apiControl.id,
        'channel': channelId,
        'name': apiControl.name,
        'created_at': apiControl.createdAt.toIso8601String(),
        'updated_at': apiControl.updatedAt?.toIso8601String(),
      });
    }

    notifyListeners();
  }

  Future<void> fetchControl(
    String id,
    String channelId,
  ) async {
    return handleApiCall(
      () async {
        final response = await apiClient.getDevicesModuleChannelControl(
          channelId: channelId,
          id: id,
        );

        insertControls(channelId, [response.data.data]);
      },
      'fetch channel control',
    );
  }

  Future<void> fetchControls(
    String channelId,
  ) async {
    return handleApiCall(
      () async {
        final response = await apiClient.getDevicesModuleChannelControls(
          channelId: channelId,
        );

        insertControls(channelId, response.data.data);
      },
      'fetch channel controls',
    );
  }
}
