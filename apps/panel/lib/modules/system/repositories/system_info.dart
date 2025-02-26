import 'dart:convert';

import 'package:fastybird_smart_panel/modules/system/models/default_network.dart';
import 'package:fastybird_smart_panel/modules/system/models/display_info.dart';
import 'package:fastybird_smart_panel/modules/system/models/memory_info.dart';
import 'package:fastybird_smart_panel/modules/system/models/network_stats.dart';
import 'package:fastybird_smart_panel/modules/system/models/operating_system_info.dart';
import 'package:fastybird_smart_panel/modules/system/models/storage_info.dart';
import 'package:fastybird_smart_panel/modules/system/models/system_info.dart';
import 'package:fastybird_smart_panel/modules/system/models/temperature_info.dart';
import 'package:fastybird_smart_panel/modules/system/repositories/repository.dart';
import 'package:flutter/foundation.dart';

class SystemInfoRepository extends Repository<SystemInfoModel> {
  SystemInfoRepository({required super.apiClient});

  double? get cpuLoad => data?.cpuLoad;

  MemoryInfoModel? get memory => data?.memory;

  List<StorageInfoModel> get storage => data?.storage ?? [];

  TemperatureInfoModel? get temperature => data?.temperature;

  OperatingSystemInfoModel? get os => data?.os;

  List<NetworkStatsModel> get network => data?.network ?? [];

  DefaultNetworkModel? get defaultNetwork => data?.defaultNetwork;

  DisplayInfoModel? get display => data?.display;

  Future<bool> refresh() async {
    try {
      await fetchSystemInfo();

      return true;
    } catch (e) {
      return false;
    }
  }

  void insertSystemInfo(Map<String, dynamic> json) {
    try {
      SystemInfoModel newData = SystemInfoModel.fromJson(json);

      if (data != newData) {
        if (kDebugMode) {
          debugPrint(
            '[SYSTEM MODULE] System info was successfully updated',
          );
        }

        data = newData;

        notifyListeners();
      }
    } catch (e) {
      if (kDebugMode) {
        debugPrint(
          '[SYSTEM MODULE] System info model could not be created',
        );
      }

      rethrow;
    }
  }

  Future<void> fetchSystemInfo() async {
    return handleApiCall(
      () async {
        final response = await apiClient.getSystemModuleSystemInfo();

        insertSystemInfo(jsonDecode(jsonEncode(response.data.data)));
      },
      'fetch system info',
    );
  }
}
