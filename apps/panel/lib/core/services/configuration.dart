import 'package:fastybird_smart_panel/core/models/general/configuration.dart';

class ConfigurationService {
  final ConfigurationModel _deviceInfo;

  late double scaleFactor;

  ConfigurationService(ConfigurationModel deviceInfo)
      : _deviceInfo = deviceInfo;

  double get screenHeight => _deviceInfo.screenHeight;

  double get screenWidth => _deviceInfo.screenWidth;

  bool get isPortrait => _deviceInfo.screenHeight > _deviceInfo.screenWidth;

  bool get isLandscape => _deviceInfo.screenHeight <= _deviceInfo.screenWidth;
}
