import 'package:fastybird_smart_panel/modules/devices/mappers/device.dart';
import 'package:fastybird_smart_panel/modules/devices/models/devices/device.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/channels.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/repository.dart';
import 'package:flutter/foundation.dart';

class DevicesRepository extends Repository<DeviceModel> {
  final ChannelsRepository _channelsRepository;

  DevicesRepository({
    required super.apiClient,
    required ChannelsRepository channelsRepository,
  }) : _channelsRepository = channelsRepository;

  void insert(List<Map<String, dynamic>> json) {
    late Map<String, DeviceModel> insertData = {...data};

    // Collect embedded channels to insert
    List<Map<String, dynamic>> embeddedChannels = [];

    for (var row in json) {
      if (!row.containsKey('type')) {
        if (kDebugMode) {
          debugPrint(
            '[DEVICES MODULE][DEVICES] Missing required attribute: "type" for device: "${row['id']}"',
          );
        }

        continue;
      }

      // Extract embedded channels before building the model
      if (row['channels'] is List) {
        for (var channel in row['channels']) {
          if (channel is Map<String, dynamic> && channel.containsKey('id')) {
            embeddedChannels.add(channel);
          }
        }
      }

      try {
        DeviceModel device = buildDeviceModel(row['type'], row);

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

    // Insert embedded channels into the channels repository
    // This will also trigger insertion of embedded properties
    if (embeddedChannels.isNotEmpty) {
      _channelsRepository.insert(embeddedChannels);
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

  Future<void> fetchOne(
    String id,
  ) async {
    return handleApiCall(
      () async {
        final response = await apiClient.getDevicesModuleDevice(
          id: id,
        );

        final raw = response.response.data['data'] as Map<String, dynamic>;

        insert([raw]);
      },
      'fetch device',
    );
  }

  Future<void> fetchAll() async {
    return handleApiCall(
      () async {
        final response = await apiClient.getDevicesModuleDevices();

        final raw = response.response.data['data'] as List;

        insert(raw.cast<Map<String, dynamic>>());
      },
      'fetch devices',
    );
  }
}
