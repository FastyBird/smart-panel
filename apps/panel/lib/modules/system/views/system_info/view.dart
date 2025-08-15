import 'package:fastybird_smart_panel/modules/system/models/system_info/system_info.dart';

class SystemInfoView {
  final SystemInfoModel _systemInfoModel;

  SystemInfoView({
    required SystemInfoModel systemInfoModel,
  }) : _systemInfoModel = systemInfoModel;

  double get cpuLoad => _systemInfoModel.cpuLoad;

  int get memoryTotal => _systemInfoModel.memory.total;

  int get memoryUsed => _systemInfoModel.memory.used;

  int get memoryFree => _systemInfoModel.memory.free;

  String get ipAddress => _systemInfoModel.defaultNetwork.ip4;

  String get macAddress => _systemInfoModel.defaultNetwork.mac;

  SystemInfoModel get systemInfo => _systemInfoModel;
}
