import 'package:fastybird_smart_panel/modules/config/models/model.dart';

class DisplayConfigModel extends Model {
  final bool _darkMode;
  final int _brightness;
  final int _screenLockDuration;
  final bool _screenSaver;

  DisplayConfigModel({
    required bool darkMode,
    required int brightness,
    required int screenLockDuration,
    required bool screenSaver,
  })  : _darkMode = darkMode,
        _brightness = brightness,
        _screenLockDuration = screenLockDuration,
        _screenSaver = screenSaver;

  bool get hasDarkMode => _darkMode;

  int get brightness => _brightness;

  int get screenLockDuration => _screenLockDuration;

  bool get hasScreenSaver => _screenSaver;

  factory DisplayConfigModel.fromJson(Map<String, dynamic> json) {
    return DisplayConfigModel(
      darkMode: json['dark_mode'],
      brightness: json['brightness'],
      screenLockDuration: json['screen_lock_duration'],
      screenSaver: json['screen_saver'],
    );
  }

  DisplayConfigModel copyWith({
    bool? darkMode,
    int? brightness,
    int? screenLockDuration,
    bool? screenSaver,
  }) {
    return DisplayConfigModel(
      darkMode: darkMode ?? _darkMode,
      brightness: brightness ?? _brightness,
      screenLockDuration: screenLockDuration ?? _screenLockDuration,
      screenSaver: screenSaver ?? _screenSaver,
    );
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is DisplayConfigModel &&
          other._darkMode == _darkMode &&
          other._brightness == _brightness &&
          other._screenLockDuration == _screenLockDuration &&
          other._screenSaver == _screenSaver);

  @override
  int get hashCode => Object.hashAll([
        _darkMode,
        _brightness,
        _screenLockDuration,
        _screenSaver,
      ]);
}
