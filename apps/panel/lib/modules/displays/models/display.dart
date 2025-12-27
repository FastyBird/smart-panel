enum HomeMode { autoSpace, explicit, firstPage }

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
  final String? spaceId;
  final HomeMode homeMode;
  final String? homePageId;
  final String? resolvedHomePageId;
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
    this.spaceId,
    this.homeMode = HomeMode.autoSpace,
    this.homePageId,
    this.resolvedHomePageId,
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
      spaceId: json['space_id'] as String?,
      homeMode: _parseHomeMode(json['home_mode'] as String?),
      homePageId: json['home_page_id'] as String?,
      resolvedHomePageId: json['resolved_home_page_id'] as String?,
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
      case 'first_page':
        return HomeMode.firstPage;
      case 'auto_space':
      default:
        return HomeMode.autoSpace;
    }
  }

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
    String? spaceId,
    HomeMode? homeMode,
    String? homePageId,
    String? resolvedHomePageId,
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
      spaceId: spaceId ?? this.spaceId,
      homeMode: homeMode ?? this.homeMode,
      homePageId: homePageId ?? this.homePageId,
      resolvedHomePageId: resolvedHomePageId ?? this.resolvedHomePageId,
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
        other.spaceId == spaceId &&
        other.homeMode == homeMode &&
        other.homePageId == homePageId &&
        other.resolvedHomePageId == resolvedHomePageId;
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
      spaceId,
      homeMode,
      homePageId,
      resolvedHomePageId,
    ]);
  }
}
