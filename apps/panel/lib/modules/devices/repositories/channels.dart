import 'package:fastybird_smart_panel/modules/devices/mappers/channel.dart';
import 'package:fastybird_smart_panel/modules/devices/models/channels/channel.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/channel_properties.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/repository.dart';
import 'package:flutter/foundation.dart';

class ChannelsRepository extends Repository<ChannelModel> {
  final ChannelPropertiesRepository _channelPropertiesRepository;

  ChannelsRepository({
    required super.apiClient,
    required ChannelPropertiesRepository channelPropertiesRepository,
  }) : _channelPropertiesRepository = channelPropertiesRepository;

  void insert(List<Map<String, dynamic>> json) {
    late Map<String, ChannelModel> insertData = {...data};

    // Collect embedded properties to insert
    List<Map<String, dynamic>> embeddedProperties = [];

    for (var row in json) {
      if (!row.containsKey('type')) {
        if (kDebugMode) {
          debugPrint(
            '[DEVICES MODULE][CHANNELS] Missing required attribute: "type" for channel: "${row['id']}"',
          );
        }

        continue;
      }

      // Extract embedded properties before building the model
      if (row['properties'] is List) {
        for (var property in row['properties']) {
          if (property is Map<String, dynamic> && property.containsKey('id')) {
            embeddedProperties.add(property);
          }
        }
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

    // Insert embedded properties into the properties repository
    if (embeddedProperties.isNotEmpty) {
      _channelPropertiesRepository.insert(embeddedProperties);
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
