class MemoryInfoModel {
  final int _total;
  final int _used;
  final int _free;

  MemoryInfoModel({
    required int total,
    required int used,
    required int free,
  })  : _total = total,
        _used = used,
        _free = free;

  int get total => _total;

  int get used => _used;

  int get free => _free;

  factory MemoryInfoModel.fromJson(Map<String, dynamic> json) {
    return MemoryInfoModel(
      total: json['total'],
      used: json['used'],
      free: json['free'],
    );
  }
}

class StorageInfoModel {
  final String _fs;
  final int _used;
  final int _size;
  final int _available;

  StorageInfoModel({
    required String fs,
    required int used,
    required int size,
    required int available,
  })  : _fs = fs,
        _used = used,
        _size = size,
        _available = available;

  String get fs => _fs;

  int get used => _used;

  int get size => _size;

  int get available => _available;

  factory StorageInfoModel.fromJson(Map<String, dynamic> json) {
    return StorageInfoModel(
      fs: json['fs'],
      used: json['used'],
      size: json['size'],
      available: json['available'],
    );
  }
}

class TemperatureInfoModel {
  final int? _cpu;
  final int? _gpu;

  TemperatureInfoModel({
    required int? cpu,
    required int? gpu,
  })  : _cpu = cpu,
        _gpu = gpu;

  int? get cpu => _cpu;

  int? get gpu => _gpu;

  factory TemperatureInfoModel.fromJson(Map<String, dynamic> json) {
    return TemperatureInfoModel(
      cpu: json['cpu'],
      gpu: json['gpu'],
    );
  }
}

class OperatingSystemInfoModel {
  final String _platform;
  final String _distro;
  final String _release;
  final int _uptime;

  OperatingSystemInfoModel({
    required String platform,
    required String distro,
    required String release,
    required int uptime,
  })  : _platform = platform,
        _distro = distro,
        _release = release,
        _uptime = uptime;

  String get platform => _platform;

  String get distro => _distro;

  String get release => _release;

  int get uptime => _uptime;

  factory OperatingSystemInfoModel.fromJson(Map<String, dynamic> json) {
    return OperatingSystemInfoModel(
      platform: json['platform'],
      distro: json['distro'],
      release: json['release'],
      uptime: json['uptime'],
    );
  }
}

class DisplayInfoModel {
  final int _resolutionX;
  final int _resolutionY;
  final int _currentResX;
  final int _currentResY;

  DisplayInfoModel({
    required int resolutionX,
    required int resolutionY,
    required int currentResX,
    required int currentResY,
  })  : _resolutionX = resolutionX,
        _resolutionY = resolutionY,
        _currentResX = currentResX,
        _currentResY = currentResY;

  int get resolutionX => _resolutionX;

  int get resolutionY => _resolutionY;

  int get currentResX => _currentResX;

  int get currentResY => _currentResY;

  factory DisplayInfoModel.fromJson(Map<String, dynamic> json) {
    return DisplayInfoModel(
      resolutionX: json['resolution_x'],
      resolutionY: json['resolution_y'],
      currentResX: json['current_res_x'],
      currentResY: json['current_res_y'],
    );
  }
}

class NetworkStatsModel {
  final String _interface;
  final int _rxBytes;
  final int _txBytes;

  NetworkStatsModel({
    required String interface,
    required int rxBytes,
    required int txBytes,
  })  : _interface = interface,
        _rxBytes = rxBytes,
        _txBytes = txBytes;

  String get interface => _interface;

  int get rxBytes => _rxBytes;

  int get txBytes => _txBytes;

  factory NetworkStatsModel.fromJson(Map<String, dynamic> json) {
    return NetworkStatsModel(
      interface: json['interface'],
      rxBytes: json['rx_bytes'],
      txBytes: json['tx_bytes'],
    );
  }
}

class SystemInfoModel {
  final double _cpuLoad;
  final MemoryInfoModel _memory;
  final List<StorageInfoModel> _storage;
  final TemperatureInfoModel _temperature;
  final OperatingSystemInfoModel _os;
  final List<NetworkStatsModel> _network;
  final DisplayInfoModel _display;

  SystemInfoModel({
    required double cpuLoad,
    required MemoryInfoModel memory,
    required List<StorageInfoModel> storage,
    required TemperatureInfoModel temperature,
    required OperatingSystemInfoModel os,
    required List<NetworkStatsModel> network,
    required DisplayInfoModel display,
  })  : _cpuLoad = cpuLoad,
        _memory = memory,
        _storage = storage,
        _temperature = temperature,
        _os = os,
        _network = network,
        _display = display;

  double get cpuLoad => _cpuLoad;

  MemoryInfoModel get memory => _memory;

  List<StorageInfoModel> get storage => _storage;

  TemperatureInfoModel get temperature => _temperature;

  OperatingSystemInfoModel get os => _os;

  List<NetworkStatsModel> get network => _network;

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
      display: DisplayInfoModel.fromJson(json['display']),
    );
  }
}

class ThrottleStatusModel {
  final bool _undervoltage;
  final bool _frequencyCapping;
  final bool _throttling;
  final bool _softTempLimit;

  ThrottleStatusModel({
    required bool undervoltage,
    required bool frequencyCapping,
    required bool throttling,
    required bool softTempLimit,
  })  : _undervoltage = undervoltage,
        _frequencyCapping = frequencyCapping,
        _throttling = throttling,
        _softTempLimit = softTempLimit;

  bool get undervoltage => _undervoltage;

  bool get frequencyCapping => _frequencyCapping;

  bool get throttling => _throttling;

  bool get softTempLimit => _softTempLimit;

  factory ThrottleStatusModel.fromJson(Map<String, dynamic> json) {
    return ThrottleStatusModel(
      undervoltage: json['undervoltage'],
      frequencyCapping: json['frequency_capping'],
      throttling: json['throttling'],
      softTempLimit: json['soft_temp_limit'],
    );
  }
}
