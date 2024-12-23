import 'package:fastybird_smart_panel/core/models/general/configuration.dart';

class ScreenScalerService {
  final ConfigurationModel _configuration;

  late double scaleFactor;

  ScreenScalerService(ConfigurationModel configuration)
      : _configuration = configuration {
    // Normalize the scale factor (e.g., assume DPR = 2.0)
    const targetDPR = 2.0;

    scaleFactor = targetDPR / _configuration.devicePixelRatio;
  }

  double scale(double size) {
    return size * scaleFactor;
  }

  double get pixelRatio => _configuration.devicePixelRatio;
}
