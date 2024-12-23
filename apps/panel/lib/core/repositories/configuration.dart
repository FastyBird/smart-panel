import 'package:fastybird_smart_panel/core/models/layout/screen_grid.dart';
import 'package:flutter/material.dart';

class ConfigurationRepository extends ChangeNotifier {
  final double _screenWidth;
  final double _screenHeight;
  final double _devicePixelRatio;

  late ScreenGridModel _screenGridConfiguration;

  ConfigurationRepository({
    required double screenWidth,
    required double screenHeight,
    required double devicePixelRatio,
  })  : _screenWidth = screenWidth,
        _screenHeight = screenHeight,
        _devicePixelRatio = devicePixelRatio;

  bool _isLoading = true;

  Future<void> initialize() async {
    _isLoading = true;

    notifyListeners();

    // Simulate fetching data from an API or repository
    await Future.delayed(const Duration(seconds: 2));

    // 240; // 150.0; // 120.0;
    double optimalCellSize =
        _calculateOptimalTileWidth(_screenWidth) / _devicePixelRatio;

    int columns = _screenWidth ~/ optimalCellSize;
    int rows = _screenHeight ~/ optimalCellSize;

    _screenGridConfiguration = ScreenGridModel(
      columns: columns,
      rows: rows,
      tileSize: optimalCellSize,
    );

    _isLoading = false;

    notifyListeners();
  }

  bool get isLoading => _isLoading;

  ScreenGridModel get screenGrid => _screenGridConfiguration;

  double _calculateOptimalTileWidth(double screenWidth) {
    // Derived scaling factor from the data
    const double scalingFactor = 0.1667;

    // Calculate tile width
    double tileWidth = screenWidth * scalingFactor;

    // Adjust based on empirical data, ensuring reasonable limits
    if (screenWidth <= 480) {
      tileWidth = screenWidth / 4;
    } else if (screenWidth <= 600) {
      tileWidth = screenWidth / 6;
    } else if (screenWidth <= 720) {
      tileWidth = screenWidth / 8;
    }

    return tileWidth;
  }
}
