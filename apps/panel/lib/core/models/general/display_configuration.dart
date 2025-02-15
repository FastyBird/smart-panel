class DisplayConfigurationModel {
  final bool _darkMode;
  final int _brightness;
  final int _screenLockDuration;
  final bool _screenSaver;

  DisplayConfigurationModel({
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

  DisplayConfigurationModel copyWith({
    bool? darkMode,
    int? brightness,
    int? screenLockDuration,
    bool? screenSaver,
  }) {
    return DisplayConfigurationModel(
      darkMode: darkMode ?? _darkMode,
      brightness: brightness ?? _brightness,
      screenLockDuration: screenLockDuration ?? _screenLockDuration,
      screenSaver: screenSaver ?? _screenSaver,
    );
  }
}
