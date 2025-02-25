import 'dart:convert';

import 'package:fastybird_smart_panel/modules/devices/models/channel.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/repository.dart';
import 'package:flutter/foundation.dart';

class ChannelsRepository extends Repository<ChannelModel> {
  ChannelsRepository({
    required super.apiClient,
  });

  void insertChannels(List<Map<String, dynamic>> json) {
    late Map<String, ChannelModel> insertData = {...data};

    for (var row in json) {
      try {
        ChannelModel channel = ChannelModel.fromJson(row);

        insertData[channel.id] = channel;
      } catch (e) {
        if (kDebugMode) {
          debugPrint(
            '[DEVICES MODULE][CHANNELS] Failed to create channel model: ${e.toString()}',
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

  Future<void> fetchChannel(
    String id,
  ) async {
    return handleApiCall(
      () async {
        final response = await apiClient.getDevicesModuleChannel(
          id: id,
        );

        insertChannels([jsonDecode(jsonEncode(response.data.data))]);
      },
      'fetch channel',
    );
  }

  Future<void> fetchChannels() async {
    return handleApiCall(
      () async {
        final response = await apiClient.getDevicesModuleChannels();

        List<Map<String, dynamic>> channels = [];

        for (var channel in response.data.data) {
          channels.add(jsonDecode(jsonEncode(channel)));
        }

        insertChannels(channels);
      },
      'fetch channels',
    );
  }
}
