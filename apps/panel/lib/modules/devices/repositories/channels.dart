import 'package:fastybird_smart_panel/api/models/devices_channel.dart';
import 'package:fastybird_smart_panel/modules/devices/models/channel.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/repository.dart';
import 'package:fastybird_smart_panel/modules/devices/types/categories.dart';
import 'package:flutter/foundation.dart';

class ChannelsRepository extends Repository<ChannelModel> {
  ChannelsRepository({
    required super.apiClient,
  });

  void insertChannels(
    String deviceId,
    List<DevicesChannel> apiChannels,
  ) {
    for (var apiChannel in apiChannels) {
      final ChannelCategory? category = ChannelCategory.fromValue(
        apiChannel.category.json ?? ChannelCategory.generic.value,
      );

      if (category == null || apiChannel.category.json == null) {
        if (kDebugMode) {
          debugPrint(
            '[DEVICES MODULE][CHANNELS] Unknown channel category: "${apiChannel.category.json}" for channel: "${apiChannel.id}"',
          );
        }

        continue;
      }

      try {
        data[apiChannel.id] = ChannelModel.fromJson({
          'id': apiChannel.id,
          'device': deviceId,
          'category': apiChannel.category.json,
          'name': apiChannel.name,
          'description': apiChannel.description,
          'created_at': apiChannel.createdAt.toIso8601String(),
          'updated_at': apiChannel.updatedAt?.toIso8601String(),
          'controls': apiChannel.controls
              .map(
                (control) => control.id,
              )
              .toList(),
          'properties': apiChannel.properties
              .map(
                (property) => property.id,
              )
              .toList(),
        });
      } catch (e) {
        continue;
      }
    }

    notifyListeners();
  }

  Future<void> fetchChannel(
    String id,
  ) async {
    return handleApiCall(
      () async {
        final response = await apiClient.getDevicesModuleChannel(
          id: id,
        );

        insertChannels(response.data.data.device, [response.data.data]);
      },
      'fetch channel channel',
    );
  }

  Future<void> fetchChannels() async {
    return handleApiCall(
      () async {
        final response = await apiClient.getDevicesModuleChannels();

        if (response.data.data.isNotEmpty) {
          insertChannels(response.data.data[0].device, response.data.data);
        }
      },
      'fetch channel channels',
    );
  }
}
