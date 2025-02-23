import 'package:fastybird_smart_panel/modules/system/models/default_network.dart';
import 'package:fastybird_smart_panel/modules/system/models/display_info.dart';
import 'package:fastybird_smart_panel/modules/system/models/memory_info.dart';
import 'package:fastybird_smart_panel/modules/system/models/model.dart';
import 'package:fastybird_smart_panel/modules/system/models/network_stats.dart';
import 'package:fastybird_smart_panel/modules/system/models/operating_system_info.dart';
import 'package:fastybird_smart_panel/modules/system/models/storage_info.dart';
import 'package:fastybird_smart_panel/modules/system/models/temperature_info.dart';

class SystemInfoModel extends Model {
  final double _cpuLoad;
  final MemoryInfoModel _memory;
  final List<StorageInfoModel> _storage;
  final TemperatureInfoModel _temperature;
  final OperatingSystemInfoModel _os;
  final List<NetworkStatsModel> _network;
  final DefaultNetworkModel _defaultNetwork;
  final DisplayInfoModel _display;

  SystemInfoModel({
    required double cpuLoad,
    required MemoryInfoModel memory,
    required List<StorageInfoModel> storage,
    required TemperatureInfoModel temperature,
    required OperatingSystemInfoModel os,
    required List<NetworkStatsModel> network,
    required DefaultNetworkModel defaultNetwork,
    required DisplayInfoModel display,
  })  : _cpuLoad = cpuLoad,
        _memory = memory,
        _storage = storage,
        _temperature = temperature,
        _os = os,
        _network = network,
        _defaultNetwork = defaultNetwork,
        _display = display;

  double get cpuLoad => _cpuLoad;

  MemoryInfoModel get memory => _memory;

  List<StorageInfoModel> get storage => _storage;

  TemperatureInfoModel get temperature => _temperature;

  OperatingSystemInfoModel get os => _os;

  List<NetworkStatsModel> get network => _network;

  DefaultNetworkModel get defaultNetwork => _defaultNetwork;

  DisplayInfoModel get display => _display;

  factory SystemInfoModel.fromJson(Map<String, dynamic> json) {
    List<StorageInfoModel> storage = [];

    if (json['storage'] is List) {
      for (var item in json['storage']) {
        storage.add(StorageInfoModel.fromJson(item));
      }
    }

    List<NetworkStatsModel> network = [];

    if (json['network'] is List) {
      for (var item in json['network']) {
        network.add(NetworkStatsModel.fromJson(item));
      }
    }

    return SystemInfoModel(
      cpuLoad: json['cpu_load'],
      memory: MemoryInfoModel.fromJson(json['memory']),
      storage: storage,
      temperature: TemperatureInfoModel.fromJson(json['temperature']),
      os: OperatingSystemInfoModel.fromJson(json['os']),
      network: network,
      defaultNetwork: DefaultNetworkModel.fromJson(json['default_network']),
      display: DisplayInfoModel.fromJson(json['display']),
    );
  }
}
