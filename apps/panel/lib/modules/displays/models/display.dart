import 'package:fastybird_smart_panel/modules/system/types/configuration.dart';

enum HomeMode { autoSpace, explicit }

enum DisplayRole { room, master, entry }

class DisplayModel {
  final String id;
  final String macAddress;
  final String version;
  final String? build;
  final String? name;
  final int screenWidth;
  final int screenHeight;
  final double pixelRatio;
  final double unitSize;
  final int rows;
  final int cols;
  final bool darkMode;
  final int brightness;
  final int screenLockDuration;
  final bool screenSaver;
  final bool audioOutputSupported;
  final bool audioInputSupported;
  final bool speaker;
  final int speakerVolume;
  final bool microphone;
  final int microphoneVolume;
  final DisplayRole role;
  final String? roomId;
  final HomeMode homeMode;
  final String? homePageId;
  final String? resolvedHomePageId;
  // Unit overrides (null = use system default)
  final TemperatureUnit? temperatureUnit;
  final WindSpeedUnit? windSpeedUnit;
  final PressureUnit? pressureUnit;
  final PrecipitationUnit? precipitationUnit;
  final DistanceUnit? distanceUnit;
  final DateTime createdAt;
  final DateTime? updatedAt;

  const DisplayModel({
    required this.id,
    required this.macAddress,
    required this.version,
    this.build,
    this.name,
    required this.screenWidth,
    required this.screenHeight,
    required this.pixelRatio,
    required this.unitSize,
    required this.rows,
    required this.cols,
    required this.darkMode,
    required this.brightness,
    required this.screenLockDuration,
    required this.screenSaver,
    required this.audioOutputSupported,
    required this.audioInputSupported,
    required this.speaker,
    required this.speakerVolume,
    required this.microphone,
    required this.microphoneVolume,
    this.role = DisplayRole.room,
    this.roomId,
    this.homeMode = HomeMode.autoSpace,
    this.homePageId,
    this.resolvedHomePageId,
    this.temperatureUnit,
    this.windSpeedUnit,
    this.pressureUnit,
    this.precipitationUnit,
    this.distanceUnit,
    required this.createdAt,
    this.updatedAt,
  });

  factory DisplayModel.fromJson(Map<String, dynamic> json) {
    return DisplayModel(
      id: json['id'] as String,
      macAddress: json['mac_address'] as String,
      version: json['version'] as String,
      build: json['build'] as String?,
      name: json['name'] as String?,
      screenWidth: json['screen_width'] as int,
      screenHeight: json['screen_height'] as int,
      pixelRatio: (json['pixel_ratio'] as num).toDouble(),
      unitSize: (json['unit_size'] as num).toDouble(),
      rows: json['rows'] as int,
      cols: json['cols'] as int,
      darkMode: json['dark_mode'] as bool,
      brightness: json['brightness'] as int,
      screenLockDuration: json['screen_lock_duration'] as int,
      screenSaver: json['screen_saver'] as bool,
      audioOutputSupported: json['audio_output_supported'] as bool,
      audioInputSupported: json['audio_input_supported'] as bool,
      speaker: json['speaker'] as bool,
      speakerVolume: json['speaker_volume'] as int,
      microphone: json['microphone'] as bool,
      microphoneVolume: json['microphone_volume'] as int,
      role: _parseDisplayRole(json['role'] as String?),
      roomId: json['room_id'] as String?,
      homeMode: _parseHomeMode(json['home_mode'] as String?),
      homePageId: json['home_page_id'] as String?,
      resolvedHomePageId: json['resolved_home_page_id'] as String?,
      temperatureUnit: json['temperature_unit'] != null
          ? TemperatureUnit.fromValue(json['temperature_unit'] as String)
          : null,
      windSpeedUnit: json['wind_speed_unit'] != null
          ? WindSpeedUnit.fromValue(json['wind_speed_unit'] as String)
          : null,
      pressureUnit: json['pressure_unit'] != null
          ? PressureUnit.fromValue(json['pressure_unit'] as String)
          : null,
      precipitationUnit: json['precipitation_unit'] != null
          ? PrecipitationUnit.fromValue(json['precipitation_unit'] as String)
          : null,
      distanceUnit: json['distance_unit'] != null
          ? DistanceUnit.fromValue(json['distance_unit'] as String)
          : null,
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: json['updated_at'] != null
          ? DateTime.parse(json['updated_at'] as String)
          : null,
    );
  }

  static DisplayRole _parseDisplayRole(String? role) {
    switch (role) {
      case 'master':
        return DisplayRole.master;
      case 'entry':
        return DisplayRole.entry;
      case 'room':
      default:
        return DisplayRole.room;
    }
  }

  static HomeMode _parseHomeMode(String? mode) {
    switch (mode) {
      case 'explicit':
        return HomeMode.explicit;
      case 'auto_space':
      default:
        return HomeMode.autoSpace;
    }
  }

  /// Sentinel value used to explicitly set nullable fields to null in [copyWith].
  static const _unset = Object();

  DisplayModel copyWith({
    String? id,
    String? macAddress,
    String? version,
    String? build,
    String? name,
    int? screenWidth,
    int? screenHeight,
    double? pixelRatio,
    double? unitSize,
    int? rows,
    int? cols,
    bool? darkMode,
    int? brightness,
    int? screenLockDuration,
    bool? screenSaver,
    bool? audioOutputSupported,
    bool? audioInputSupported,
    bool? speaker,
    int? speakerVolume,
    bool? microphone,
    int? microphoneVolume,
    DisplayRole? role,
    String? roomId,
    HomeMode? homeMode,
    String? homePageId,
    String? resolvedHomePageId,
    Object? temperatureUnit = _unset,
    Object? windSpeedUnit = _unset,
    Object? pressureUnit = _unset,
    Object? precipitationUnit = _unset,
    Object? distanceUnit = _unset,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return DisplayModel(
      id: id ?? this.id,
      macAddress: macAddress ?? this.macAddress,
      version: version ?? this.version,
      build: build ?? this.build,
      name: name ?? this.name,
      screenWidth: screenWidth ?? this.screenWidth,
      screenHeight: screenHeight ?? this.screenHeight,
      pixelRatio: pixelRatio ?? this.pixelRatio,
      unitSize: unitSize ?? this.unitSize,
      rows: rows ?? this.rows,
      cols: cols ?? this.cols,
      darkMode: darkMode ?? this.darkMode,
      brightness: brightness ?? this.brightness,
      screenLockDuration: screenLockDuration ?? this.screenLockDuration,
      screenSaver: screenSaver ?? this.screenSaver,
      audioOutputSupported: audioOutputSupported ?? this.audioOutputSupported,
      audioInputSupported: audioInputSupported ?? this.audioInputSupported,
      speaker: speaker ?? this.speaker,
      speakerVolume: speakerVolume ?? this.speakerVolume,
      microphone: microphone ?? this.microphone,
      microphoneVolume: microphoneVolume ?? this.microphoneVolume,
      role: role ?? this.role,
      roomId: roomId ?? this.roomId,
      homeMode: homeMode ?? this.homeMode,
      homePageId: homePageId ?? this.homePageId,
      resolvedHomePageId: resolvedHomePageId ?? this.resolvedHomePageId,
      temperatureUnit: identical(temperatureUnit, _unset)
          ? this.temperatureUnit
          : temperatureUnit as TemperatureUnit?,
      windSpeedUnit: identical(windSpeedUnit, _unset)
          ? this.windSpeedUnit
          : windSpeedUnit as WindSpeedUnit?,
      pressureUnit: identical(pressureUnit, _unset)
          ? this.pressureUnit
          : pressureUnit as PressureUnit?,
      precipitationUnit: identical(precipitationUnit, _unset)
          ? this.precipitationUnit
          : precipitationUnit as PrecipitationUnit?,
      distanceUnit: identical(distanceUnit, _unset)
          ? this.distanceUnit
          : distanceUnit as DistanceUnit?,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is DisplayModel &&
        other.id == id &&
        other.macAddress == macAddress &&
        other.version == version &&
        other.build == build &&
        other.name == name &&
        other.screenWidth == screenWidth &&
        other.screenHeight == screenHeight &&
        other.pixelRatio == pixelRatio &&
        other.unitSize == unitSize &&
        other.rows == rows &&
        other.cols == cols &&
        other.darkMode == darkMode &&
        other.brightness == brightness &&
        other.screenLockDuration == screenLockDuration &&
        other.screenSaver == screenSaver &&
        other.audioOutputSupported == audioOutputSupported &&
        other.audioInputSupported == audioInputSupported &&
        other.speaker == speaker &&
        other.speakerVolume == speakerVolume &&
        other.microphone == microphone &&
        other.microphoneVolume == microphoneVolume &&
        other.role == role &&
        other.roomId == roomId &&
        other.homeMode == homeMode &&
        other.homePageId == homePageId &&
        other.resolvedHomePageId == resolvedHomePageId &&
        other.temperatureUnit == temperatureUnit &&
        other.windSpeedUnit == windSpeedUnit &&
        other.pressureUnit == pressureUnit &&
        other.precipitationUnit == precipitationUnit &&
        other.distanceUnit == distanceUnit;
  }

  @override
  int get hashCode {
    return Object.hashAll([
      id,
      macAddress,
      version,
      build,
      name,
      screenWidth,
      screenHeight,
      pixelRatio,
      unitSize,
      rows,
      cols,
      darkMode,
      brightness,
      screenLockDuration,
      screenSaver,
      audioOutputSupported,
      audioInputSupported,
      speaker,
      speakerVolume,
      microphone,
      microphoneVolume,
      role,
      roomId,
      homeMode,
      homePageId,
      resolvedHomePageId,
      temperatureUnit,
      windSpeedUnit,
      pressureUnit,
      precipitationUnit,
      distanceUnit,
    ]);
  }
}
