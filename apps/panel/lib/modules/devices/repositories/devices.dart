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
      // A hidden device is one this panel does not show, and the model carries no `hidden` field to
      // filter on downstream — hidden devices simply never arrive from the API, so nothing after this
      // point knows the difference. Handled here rather than at the socket handler because every route
      // in leads through this method: the create/update event, the device embedded in a connection
      // change, and the fetches below. A source device is hidden the moment a virtual device replaces
      // it, and a running panel would otherwise keep rendering the original alongside its replacement —
      // commandable, and duplicated in every space it belongs to — until the process restarted.
      if (row['hidden'] == true) {
        final hiddenId = row['id'];

        if (hiddenId is String) {
          insertData.remove(hiddenId);
        }

        continue;
      }

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
        final rows = raw.cast<Map<String, dynamic>>();

        insert(rows);

        // A device the response omits has to go, and `insert` merges rather than replaces, so nothing
        // else would ever take it out. This endpoint answers with the visible devices only: a source
        // device is hidden the moment a virtual device replaces it, and without this eviction the panel
        // would keep rendering the original alongside its replacement — commandable, and duplicated in
        // every space it belongs to — for the life of the process.
        final visibleIds = rows.map((row) => row['id']).whereType<String>().toSet();

        for (final id in data.keys.toList()) {
          if (!visibleIds.contains(id)) {
            delete(id);
          }
        }
      },
      'fetch devices',
    );
  }
}
