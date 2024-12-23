import 'package:fastybird_smart_panel/core/models/general/configuration.dart';

class ScreenScalerService {
  final ConfigurationModel _deviceInfo;

  late double scaleFactor;

  ScreenScalerService(ConfigurationModel deviceInfo)
      : _deviceInfo = deviceInfo {
    // Normalize the scale factor (e.g., assume DPR = 2.0)
    const targetDPR = 2.0;

    scaleFactor = targetDPR / _deviceInfo.devicePixelRatio;
  }

  double scale(double size) {
    return size * scaleFactor;
  }

  double get pixelRatio => _deviceInfo.devicePixelRatio;
}
