import 'dart:convert';

import 'package:fastybird_smart_panel/modules/system/models/system_info.dart';
import 'package:fastybird_smart_panel/modules/system/repositories/repository.dart';

class SystemInfoRepository extends Repository<SystemInfoModel> {
  SystemInfoRepository({required super.apiClient});

  Future<bool> refresh() async {
    try {
      await fetchSystemInfo();

      return true;
    } catch (e) {
      return false;
    }
  }

  Future<void> insertSystemInfo(Map<String, dynamic> json) async {
    data = SystemInfoModel.fromJson(json);

    notifyListeners();
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
