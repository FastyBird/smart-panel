import 'package:fastybird_smart_panel/modules/devices/mappers/channel.dart';
import 'package:fastybird_smart_panel/modules/devices/models/channels/channel.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/repository.dart';
import 'package:flutter/foundation.dart';

class ChannelsRepository extends Repository<ChannelModel> {
  ChannelsRepository({
    required super.apiClient,
  });

  void insert(List<Map<String, dynamic>> json) {
    late Map<String, ChannelModel> insertData = {...data};

    for (var row in json) {
      if (!row.containsKey('type')) {
        if (kDebugMode) {
          debugPrint(
            '[DEVICES MODULE][CHANNELS] Missing required attribute: "type" for channel: "${row['id']}"',
          );
        }

        continue;
      }

      try {
        ChannelModel channel = buildChannelModel(row['type'], row);

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

  void delete(String id) {
    if (data.containsKey(id) && data.remove(id) != null) {
      if (kDebugMode) {
        debugPrint(
          '[DEVICES MODULE][CHANNELS] Removed channel: $id',
        );
      }

      notifyListeners();
    }
  }

  Future<void> fetchOne(
    String id,
  ) async {
    return handleApiCall(
      () async {
        final response = await apiClient.getDevicesModuleChannel(
          id: id,
        );

        final raw = response.response.data['data'] as Map<String, dynamic>;

        insert([raw]);
      },
      'fetch channel',
    );
  }

  Future<void> fetchAll() async {
    return handleApiCall(
      () async {
        final response = await apiClient.getDevicesModuleChannels();

        final raw = response.response.data['data'] as List;

        insert(raw.cast<Map<String, dynamic>>());
      },
      'fetch channels',
    );
  }
}
