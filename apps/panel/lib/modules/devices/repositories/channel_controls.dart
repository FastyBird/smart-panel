import 'dart:convert';

import 'package:fastybird_smart_panel/modules/devices/models/controls.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/repository.dart';
import 'package:flutter/foundation.dart';

class ChannelControlsRepository extends Repository<ChannelControlDataModel> {
  ChannelControlsRepository({
    required super.apiClient,
  });

  void insert(List<Map<String, dynamic>> json) {
    late Map<String, ChannelControlDataModel> insertData = {...data};

    for (var row in json) {
      try {
        ChannelControlDataModel control = ChannelControlDataModel.fromJson(row);

        insertData[control.id] = control;
      } catch (e) {
        if (kDebugMode) {
          debugPrint(
            '[DEVICES MODULE][CHANNELS CONTROLS] Failed to create control model: ${e.toString()}',
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
          '[DEVICES MODULE][CHANNELS CONTROLS] Removed control: $id',
        );
      }

      notifyListeners();
    }
  }

  Future<void> fetchControl(
    String channelId,
    String id,
  ) async {
    return handleApiCall(
      () async {
        final response = await apiClient.getDevicesModuleChannelControl(
          channelId: channelId,
          id: id,
        );

        insert([jsonDecode(jsonEncode(response.data.data))]);
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

        List<Map<String, dynamic>> controls = [];

        for (var control in response.data.data) {
          controls.add(jsonDecode(jsonEncode(control)));
        }

        insert(controls);
      },
      'fetch channel controls',
    );
  }
}
