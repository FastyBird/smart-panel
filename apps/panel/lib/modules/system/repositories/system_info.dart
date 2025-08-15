import 'package:fastybird_smart_panel/modules/system/models/system_info/default_network.dart';
import 'package:fastybird_smart_panel/modules/system/models/system_info/display_info.dart';
import 'package:fastybird_smart_panel/modules/system/models/system_info/memory_info.dart';
import 'package:fastybird_smart_panel/modules/system/models/system_info/network_stats.dart';
import 'package:fastybird_smart_panel/modules/system/models/system_info/operating_system_info.dart';
import 'package:fastybird_smart_panel/modules/system/models/system_info/storage_info.dart';
import 'package:fastybird_smart_panel/modules/system/models/system_info/system_info.dart';
import 'package:fastybird_smart_panel/modules/system/models/system_info/temperature_info.dart';
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
      await fetchOne();

      return true;
    } catch (e) {
      return false;
    }
  }

  void insert(Map<String, dynamic> json) {
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

  Future<void> fetchOne() async {
    return handleApiCall(
      () async {
        final response = await apiClient.getSystemModuleSystemInfo();

        final raw = response.response.data['data'] as Map<String, dynamic>;

        insert(raw);
      },
      'fetch system info',
    );
  }
}
