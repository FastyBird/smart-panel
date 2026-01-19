import 'package:flutter/material.dart';
import 'dart:math' as math;

// ============================================================================
// THEME DEFINITION
// ============================================================================

class ClimateSensorTheme {
  final Color background;
  final Color card;
  final Color cardHover;
  final Color text;
  final Color textSecondary;
  final Color textMuted;
  final Color border;
  final Color accent;
  final Color accentLight;
  final Color tempColor;
  final Color humidityColor;
  final Color graphLine;
  final Color graphFill;
  final Color graphGrid;
  final Color minColor;
  final Color maxColor;
  final Color avgColor;

  const ClimateSensorTheme({
    required this.background,
    required this.card,
    required this.cardHover,
    required this.text,
    required this.textSecondary,
    required this.textMuted,
    required this.border,
    required this.accent,
    required this.accentLight,
    required this.tempColor,
    required this.humidityColor,
    required this.graphLine,
    required this.graphFill,
    required this.graphGrid,
    required this.minColor,
    required this.maxColor,
    required this.avgColor,
  });

  static const light = ClimateSensorTheme(
    background: Color(0xFFF5F5F5),
    card: Color(0xFFFFFFFF),
    cardHover: Color(0xFFFAFAFA),
    text: Color(0xFF212121),
    textSecondary: Color(0xFF757575),
    textMuted: Color(0xFF9E9E9E),
    border: Color(0xFFE0E0E0),
    accent: Color(0xFFE85A4F),
    accentLight: Color(0x1AE85A4F),
    tempColor: Color(0xFF42A5F5),
    humidityColor: Color(0xFF26A69A),
    graphLine: Color(0xFFE85A4F),
    graphFill: Color(0x26E85A4F),
    graphGrid: Color(0xFFE0E0E0),
    minColor: Color(0xFF42A5F5),
    maxColor: Color(0xFFEF5350),
    avgColor: Color(0xFF66BB6A),
  );

  static const dark = ClimateSensorTheme(
    background: Color(0xFF1A1A1A),
    card: Color(0xFF2A2A2A),
    cardHover: Color(0xFF333333),
    text: Color(0xFFFFFFFF),
    textSecondary: Color(0xFF9E9E9E),
    textMuted: Color(0xFF616161),
    border: Color(0xFF333333),
    accent: Color(0xFFE85A4F),
    accentLight: Color(0x26E85A4F),
    tempColor: Color(0xFF64B5F6),
    humidityColor: Color(0xFF4DB6AC),
    graphLine: Color(0xFFE85A4F),
    graphFill: Color(0x33E85A4F),
    graphGrid: Color(0xFF333333),
    minColor: Color(0xFF64B5F6),
    maxColor: Color(0xFFEF5350),
    avgColor: Color(0xFF81C784),
  );
}

// ============================================================================
// DATA MODELS
// ============================================================================

enum SensorType { temperature, humidity }

class SensorReading {
  final DateTime timestamp;
  final double value;

  const SensorReading({
    required this.timestamp,
    required this.value,
  });
}

class SensorDevice {
  final String id;
  final String name;
  final String? location;
  final SensorType type;
  final double currentValue;
  final List<SensorReading> history;

  const SensorDevice({
    required this.id,
    required this.name,
    this.location,
    required this.type,
    required this.currentValue,
    required this.history,
  });

  double get minValue => history.isEmpty
      ? currentValue
      : history.map((r) => r.value).reduce(math.min);

  double get maxValue => history.isEmpty
      ? currentValue
      : history.map((r) => r.value).reduce(math.max);

  double get avgValue => history.isEmpty
      ? currentValue
      : history.map((r) => r.value).reduce((a, b) => a + b) / history.length;

  String get unit => type == SensorType.temperature ? '°C' : '%';

  String formatValue(double value) {
    if (type == SensorType.temperature) {
      return '${value.toStringAsFixed(1)}°';
    }
    return '${value.round()}%';
  }
}

enum TimeRange { hour1, hour6, hour24, day7 }

extension TimeRangeExtension on TimeRange {
  String get label {
    switch (this) {
      case TimeRange.hour1:
        return '1H';
      case TimeRange.hour6:
        return '6H';
      case TimeRange.hour24:
        return '24H';
      case TimeRange.day7:
        return '7D';
    }
  }

  Duration get duration {
    switch (this) {
      case TimeRange.hour1:
        return const Duration(hours: 1);
      case TimeRange.hour6:
        return const Duration(hours: 6);
      case TimeRange.hour24:
        return const Duration(hours: 24);
      case TimeRange.day7:
        return const Duration(days: 7);
    }
  }
}

// ============================================================================
// MAIN PAGE
// ============================================================================

class ClimateSensorDetailPage extends StatefulWidget {
  final SensorType sensorType;
  final String roomName;
  final List<SensorDevice> sensors;
  final bool isDarkMode;

  const ClimateSensorDetailPage({
    super.key,
    required this.sensorType,
    required this.roomName,
    required this.sensors,
    this.isDarkMode = false,
  });

  @override
  State<ClimateSensorDetailPage> createState() => _ClimateSensorDetailPageState();
}

class _ClimateSensorDetailPageState extends State<ClimateSensorDetailPage> {
  late SensorDevice _selectedSensor;
  TimeRange _selectedTimeRange = TimeRange.hour24;

  ClimateSensorTheme get theme =>
      widget.isDarkMode ? ClimateSensorTheme.dark : ClimateSensorTheme.light;

  bool get hasSingleSensor => widget.sensors.length == 1;

  @override
  void initState() {
    super.initState();
    _selectedSensor = widget.sensors.first;
  }

  double get _averageValue {
    if (widget.sensors.isEmpty) return 0;
    return widget.sensors.map((s) => s.currentValue).reduce((a, b) => a + b) /
        widget.sensors.length;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: theme.background,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            Expanded(
              child: OrientationBuilder(
                builder: (context, orientation) {
                  if (orientation == Orientation.landscape) {
                    return _buildLandscapeLayout();
                  }
                  return _buildPortraitLayout();
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ============================================================================
  // HEADER
  // ============================================================================

  Widget _buildHeader() {
    final isTemp = widget.sensorType == SensorType.temperature;
    final iconColor = isTemp ? theme.tempColor : theme.humidityColor;
    final icon = isTemp ? Icons.thermostat : Icons.water_drop;
    final title = isTemp ? 'Temperature' : 'Humidity';
    final unit = isTemp ? '°C' : '%';
    final displayValue = hasSingleSensor
        ? _selectedSensor.currentValue
        : _averageValue;
    final suffix = hasSingleSensor ? '' : ' avg';

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      decoration: BoxDecoration(
        color: theme.card,
        border: Border(
          bottom: BorderSide(color: theme.border, width: 1),
        ),
      ),
      child: Row(
        children: [
          // Back Button
          GestureDetector(
            onTap: () => Navigator.of(context).pop(),
            child: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: theme.background,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: theme.border),
              ),
              child: Icon(
                Icons.arrow_back,
                size: 20,
                color: theme.text,
              ),
            ),
          ),
          const SizedBox(width: 12),

          // Icon
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: iconColor.withOpacity(0.15),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, size: 22, color: iconColor),
          ),
          const SizedBox(width: 12),

          // Title & Subtitle
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w600,
                    color: theme.text,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '${widget.roomName} • ${widget.sensors.length} sensor${widget.sensors.length > 1 ? 's' : ''}',
                  style: TextStyle(
                    fontSize: 13,
                    color: theme.textSecondary,
                  ),
                ),
              ],
            ),
          ),

          // Current Value
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    isTemp
                        ? displayValue.toStringAsFixed(1)
                        : displayValue.round().toString(),
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.w700,
                      color: theme.accent,
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text(
                      '$unit$suffix',
                      style: TextStyle(
                        fontSize: 14,
                        color: theme.textSecondary,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ============================================================================
  // LANDSCAPE LAYOUT
  // ============================================================================

  Widget _buildLandscapeLayout() {
    if (hasSingleSensor) {
      return _buildSingleSensorLandscape();
    }
    return _buildMultiSensorLandscape();
  }

  Widget _buildSingleSensorLandscape() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Stats Column
          SizedBox(
            width: 160,
            child: Column(
              children: [
                _buildStatCard('24h Min', _selectedSensor.minValue, theme.minColor),
                const SizedBox(height: 12),
                _buildStatCard('24h Max', _selectedSensor.maxValue, theme.maxColor),
                const SizedBox(height: 12),
                _buildStatCard('Average', _selectedSensor.avgValue, theme.avgColor),
              ],
            ),
          ),
          const SizedBox(width: 20),

          // Graph Section
          Expanded(
            child: Column(
              children: [
                _buildGraphHeader(),
                const SizedBox(height: 12),
                Expanded(child: _buildGraph()),
                const SizedBox(height: 12),
                _buildSensorInfo(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMultiSensorLandscape() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Sensor List
          SizedBox(
            width: 200,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildSectionTitle('Select Sensor'),
                const SizedBox(height: 10),
                Expanded(
                  child: ListView.separated(
                    itemCount: widget.sensors.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      return _buildSensorListItem(widget.sensors[index]);
                    },
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 20),

          // Graph Section
          Expanded(
            child: Column(
              children: [
                _buildGraphHeader(showSensorName: true),
                const SizedBox(height: 12),
                Expanded(child: _buildGraph()),
                const SizedBox(height: 12),
                _buildStatsRow(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ============================================================================
  // PORTRAIT LAYOUT
  // ============================================================================

  Widget _buildPortraitLayout() {
    if (hasSingleSensor) {
      return _buildSingleSensorPortrait();
    }
    return _buildMultiSensorPortrait();
  }

  Widget _buildSingleSensorPortrait() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          _buildStatsRow(),
          const SizedBox(height: 16),
          _buildGraphHeader(),
          const SizedBox(height: 12),
          Expanded(child: _buildGraph()),
          const SizedBox(height: 12),
          _buildSensorInfo(),
        ],
      ),
    );
  }

  Widget _buildMultiSensorPortrait() {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Sensor List (horizontal scroll)
          _buildSectionTitle('Select Sensor'),
          const SizedBox(height: 10),
          SizedBox(
            height: 90,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: widget.sensors.length,
              separatorBuilder: (_, __) => const SizedBox(width: 10),
              itemBuilder: (context, index) {
                return SizedBox(
                  width: 140,
                  child: _buildSensorListItemCompact(widget.sensors[index]),
                );
              },
            ),
          ),
          const SizedBox(height: 16),

          // Graph
          _buildGraphHeader(showSensorName: true),
          const SizedBox(height: 12),
          Expanded(child: _buildGraph()),
          const SizedBox(height: 12),
          _buildStatsRow(),
        ],
      ),
    );
  }

  // ============================================================================
  // COMPONENTS
  // ============================================================================

  Widget _buildSectionTitle(String title) {
    return Text(
      title.toUpperCase(),
      style: TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w600,
        color: theme.textSecondary,
        letterSpacing: 0.5,
      ),
    );
  }

  Widget _buildStatCard(String label, double value, Color valueColor) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: theme.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: theme.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: TextStyle(
              fontSize: 11,
              color: theme.textMuted,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            _selectedSensor.formatValue(value),
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w600,
              color: valueColor,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatsRow() {
    return Row(
      children: [
        Expanded(
          child: _buildStatCardCompact('Min', _selectedSensor.minValue, theme.minColor),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _buildStatCardCompact('Max', _selectedSensor.maxValue, theme.maxColor),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _buildStatCardCompact('Avg', _selectedSensor.avgValue, theme.avgColor),
        ),
      ],
    );
  }

  Widget _buildStatCardCompact(String label, double value, Color valueColor) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: theme.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: theme.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: TextStyle(
              fontSize: 11,
              color: theme.textMuted,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            _selectedSensor.formatValue(value),
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w600,
              color: valueColor,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSensorListItem(SensorDevice sensor) {
    final isSelected = sensor.id == _selectedSensor.id;
    final isTemp = sensor.type == SensorType.temperature;
    final iconColor = isTemp ? theme.tempColor : theme.humidityColor;
    final icon = isTemp ? Icons.thermostat : Icons.water_drop;

    return GestureDetector(
      onTap: () => setState(() => _selectedSensor = sensor),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isSelected ? theme.accentLight : theme.card,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? theme.accent : theme.border,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    color: iconColor.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(icon, size: 16, color: iconColor),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    sensor.name,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: theme.text,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              isTemp
                  ? '${sensor.currentValue.toStringAsFixed(1)}°C'
                  : '${sensor.currentValue.round()}%',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: isSelected ? theme.accent : theme.text,
              ),
            ),
            if (sensor.location != null) ...[
              const SizedBox(height: 2),
              Text(
                sensor.location!,
                style: TextStyle(
                  fontSize: 11,
                  color: theme.textMuted,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildSensorListItemCompact(SensorDevice sensor) {
    final isSelected = sensor.id == _selectedSensor.id;
    final isTemp = sensor.type == SensorType.temperature;
    final iconColor = isTemp ? theme.tempColor : theme.humidityColor;
    final icon = isTemp ? Icons.thermostat : Icons.water_drop;

    return GestureDetector(
      onTap: () => setState(() => _selectedSensor = sensor),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: isSelected ? theme.accentLight : theme.card,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? theme.accent : theme.border,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                Container(
                  width: 24,
                  height: 24,
                  decoration: BoxDecoration(
                    color: iconColor.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Icon(icon, size: 14, color: iconColor),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    sensor.name,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      color: theme.text,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            const Spacer(),
            Text(
              isTemp
                  ? '${sensor.currentValue.toStringAsFixed(1)}°C'
                  : '${sensor.currentValue.round()}%',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: isSelected ? theme.accent : theme.text,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildGraphHeader({bool showSensorName = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          showSensorName ? '${_selectedSensor.name} History' : 'History',
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
            color: theme.text,
          ),
        ),
        _buildTimeRangeSelector(),
      ],
    );
  }

  Widget _buildTimeRangeSelector() {
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: theme.background,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: TimeRange.values.map((range) {
          final isSelected = range == _selectedTimeRange;
          return GestureDetector(
            onTap: () => setState(() => _selectedTimeRange = range),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: isSelected ? theme.card : Colors.transparent,
                borderRadius: BorderRadius.circular(6),
                boxShadow: isSelected
                    ? [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.1),
                          blurRadius: 3,
                          offset: const Offset(0, 1),
                        ),
                      ]
                    : null,
              ),
              child: Text(
                range.label,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                  color: isSelected ? theme.accent : theme.textSecondary,
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildGraph() {
    return Container(
      decoration: BoxDecoration(
        color: theme.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: theme.border),
      ),
      padding: const EdgeInsets.all(16),
      child: CustomPaint(
        painter: _SensorGraphPainter(
          sensor: _selectedSensor,
          timeRange: _selectedTimeRange,
          theme: theme,
        ),
        size: Size.infinite,
      ),
    );
  }

  Widget _buildSensorInfo() {
    return Container(
      padding: const EdgeInsets.only(top: 12),
      decoration: BoxDecoration(
        border: Border(
          top: BorderSide(color: theme.border),
        ),
      ),
      child: Row(
        children: [
          _buildInfoItem(Icons.location_on_outlined, _selectedSensor.name),
          const SizedBox(width: 16),
          _buildInfoItem(Icons.refresh, 'Updated 2 min ago'),
        ],
      ),
    );
  }

  Widget _buildInfoItem(IconData icon, String text) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 14, color: theme.textMuted),
        const SizedBox(width: 6),
        Text(
          text,
          style: TextStyle(
            fontSize: 12,
            color: theme.textSecondary,
          ),
        ),
      ],
    );
  }
}

// ============================================================================
// GRAPH PAINTER
// ============================================================================

class _SensorGraphPainter extends CustomPainter {
  final SensorDevice sensor;
  final TimeRange timeRange;
  final ClimateSensorTheme theme;

  _SensorGraphPainter({
    required this.sensor,
    required this.timeRange,
    required this.theme,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paddingLeft = 35.0;
    final paddingRight = 16.0;
    final paddingTop = 16.0;
    final paddingBottom = 30.0;

    final graphWidth = size.width - paddingLeft - paddingRight;
    final graphHeight = size.height - paddingTop - paddingBottom;

    // Generate sample data if history is empty
    final data = sensor.history.isNotEmpty
        ? sensor.history
        : _generateSampleData();

    if (data.isEmpty) return;

    final minVal = data.map((r) => r.value).reduce(math.min);
    final maxVal = data.map((r) => r.value).reduce(math.max);
    final range = maxVal - minVal;
    final padding = range * 0.1;
    final yMin = minVal - padding;
    final yMax = maxVal + padding;

    // Draw grid lines
    final gridPaint = Paint()
      ..color = theme.graphGrid
      ..strokeWidth = 1
      ..style = PaintingStyle.stroke;

    final gridCount = 3;
    for (var i = 0; i <= gridCount; i++) {
      final y = paddingTop + (graphHeight / gridCount) * i;
      final dashPath = Path();
      var x = paddingLeft;
      while (x < size.width - paddingRight) {
        dashPath.moveTo(x, y);
        dashPath.lineTo(math.min(x + 4, size.width - paddingRight), y);
        x += 8;
      }
      canvas.drawPath(dashPath, gridPaint);

      // Y-axis labels
      final value = yMax - ((yMax - yMin) / gridCount) * i;
      final valueText = sensor.type == SensorType.temperature
          ? '${value.toStringAsFixed(0)}°'
          : '${value.round()}%';

      final textPainter = TextPainter(
        text: TextSpan(
          text: valueText,
          style: TextStyle(
            fontSize: 10,
            color: theme.textMuted,
          ),
        ),
        textDirection: TextDirection.ltr,
      );
      textPainter.layout();
      textPainter.paint(
        canvas,
        Offset(paddingLeft - textPainter.width - 8, y - textPainter.height / 2),
      );
    }

    // Draw X-axis labels
    final xLabels = _getXLabels();
    for (var i = 0; i < xLabels.length; i++) {
      final x = paddingLeft + (graphWidth / (xLabels.length - 1)) * i;
      final textPainter = TextPainter(
        text: TextSpan(
          text: xLabels[i],
          style: TextStyle(
            fontSize: 10,
            color: theme.textMuted,
          ),
        ),
        textDirection: TextDirection.ltr,
      );
      textPainter.layout();
      textPainter.paint(
        canvas,
        Offset(x - textPainter.width / 2, size.height - paddingBottom + 8),
      );
    }

    // Create data path
    final path = Path();
    final areaPath = Path();

    for (var i = 0; i < data.length; i++) {
      final x = paddingLeft + (graphWidth / (data.length - 1)) * i;
      final normalizedY = (data[i].value - yMin) / (yMax - yMin);
      final y = paddingTop + graphHeight - (normalizedY * graphHeight);

      if (i == 0) {
        path.moveTo(x, y);
        areaPath.moveTo(x, y);
      } else {
        // Smooth curve
        final prevX = paddingLeft + (graphWidth / (data.length - 1)) * (i - 1);
        final prevNormalizedY = (data[i - 1].value - yMin) / (yMax - yMin);
        final prevY = paddingTop + graphHeight - (prevNormalizedY * graphHeight);
        
        final controlX = (prevX + x) / 2;
        path.quadraticBezierTo(controlX, prevY, x, y);
        areaPath.quadraticBezierTo(controlX, prevY, x, y);
      }
    }

    // Close area path
    areaPath.lineTo(paddingLeft + graphWidth, paddingTop + graphHeight);
    areaPath.lineTo(paddingLeft, paddingTop + graphHeight);
    areaPath.close();

    // Draw area fill
    final areaPaint = Paint()
      ..color = theme.graphFill
      ..style = PaintingStyle.fill;
    canvas.drawPath(areaPath, areaPaint);

    // Draw line
    final linePaint = Paint()
      ..color = theme.graphLine
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    canvas.drawPath(path, linePaint);

    // Draw current point (last point)
    final lastX = paddingLeft + graphWidth;
    final lastNormalizedY = (data.last.value - yMin) / (yMax - yMin);
    final lastY = paddingTop + graphHeight - (lastNormalizedY * graphHeight);

    // Outer glow
    canvas.drawCircle(
      Offset(lastX, lastY),
      8,
      Paint()..color = theme.accent.withOpacity(0.3),
    );

    // White stroke
    canvas.drawCircle(
      Offset(lastX, lastY),
      6,
      Paint()
        ..color = theme.card
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2,
    );

    // Inner fill
    canvas.drawCircle(
      Offset(lastX, lastY),
      5,
      Paint()..color = theme.accent,
    );
  }

  List<String> _getXLabels() {
    switch (timeRange) {
      case TimeRange.hour1:
        return ['0m', '15m', '30m', '45m', 'Now'];
      case TimeRange.hour6:
        return ['0h', '2h', '4h', '6h', 'Now'];
      case TimeRange.hour24:
        return ['00:00', '06:00', '12:00', '18:00', 'Now'];
      case TimeRange.day7:
        return ['Mon', 'Wed', 'Fri', 'Sun', 'Now'];
    }
  }

  List<SensorReading> _generateSampleData() {
    final random = math.Random(42);
    final now = DateTime.now();
    final count = 24;
    final baseValue = sensor.type == SensorType.temperature ? 20.0 : 45.0;
    final variance = sensor.type == SensorType.temperature ? 3.0 : 15.0;

    return List.generate(count, (i) {
      return SensorReading(
        timestamp: now.subtract(Duration(hours: count - i)),
        value: baseValue + random.nextDouble() * variance - variance / 2,
      );
    });
  }

  @override
  bool shouldRepaint(covariant _SensorGraphPainter oldDelegate) {
    return oldDelegate.sensor != sensor ||
        oldDelegate.timeRange != timeRange ||
        oldDelegate.theme != theme;
  }
}

// ============================================================================
// DEMO / PREVIEW
// ============================================================================

class ClimateSensorDetailDemo extends StatelessWidget {
  const ClimateSensorDetailDemo({super.key});

  @override
  Widget build(BuildContext context) {
    // Sample data
    final tempSensors = [
      SensorDevice(
        id: '1',
        name: 'Thermostat',
        location: 'Main wall',
        type: SensorType.temperature,
        currentValue: 21.3,
        history: [],
      ),
      SensorDevice(
        id: '2',
        name: 'Window Sensor',
        location: 'Near window',
        type: SensorType.temperature,
        currentValue: 19.8,
        history: [],
      ),
      SensorDevice(
        id: '3',
        name: 'Motion Sensor',
        location: 'Ceiling',
        type: SensorType.temperature,
        currentValue: 22.1,
        history: [],
      ),
    ];

    return MaterialApp(
      debugShowCheckedModeBanner: false,
      home: ClimateSensorDetailPage(
        sensorType: SensorType.temperature,
        roomName: 'Living Room',
        sensors: tempSensors,
        isDarkMode: false,
      ),
    );
  }
}

void main() {
  runApp(const ClimateSensorDetailDemo());
}
