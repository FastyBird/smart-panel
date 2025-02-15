class ScreenService {
  final double screenWidth;
  final double screenHeight;
  final double pixelRatio;

  // GRID config
  late int columns;
  late int rows;
  late double tileSize;

  late double scaleFactor;

  ScreenService({
    required this.screenWidth,
    required this.screenHeight,
    required this.pixelRatio,
  }) {
    // 240; // 150.0; // 120.0;
    tileSize = _calculateOptimalTileWidth(screenWidth) / pixelRatio;

    columns = screenWidth ~/ tileSize;
    rows = screenHeight ~/ tileSize;

    // Normalize the scale factor (e.g., assume DPR = 2.0)
    const targetDPR = 2.0;

    scaleFactor = targetDPR / pixelRatio;
  }

  bool get isPortrait => screenHeight > screenWidth;

  bool get isLandscape => screenHeight <= screenWidth;

  double scale(double size) {
    return size * scaleFactor;
  }

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
