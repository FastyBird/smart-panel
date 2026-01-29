import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'package:fastybird_smart_panel/modules/deck/types/sensor_category.dart';

// ============================================================================
// THEME
// ============================================================================

class SensorTheme {
  static const Color bg = Color(0xFFF5F5F5);
  static const Color card = Color(0xFFFFFFFF);
  static const Color cardLight = Color(0xFFE8E8E8);
  static const Color text = Color(0xFF212121);
  static const Color textSecondary = Color(0xFF757575);
  static const Color textMuted = Color(0xFF9E9E9E);
  static const Color border = Color(0xFFE0E0E0);

  static const Color accent = Color(0xFFE85A4F);
  static const Color accentLight = Color(0x1AE85A4F);

  // Sensor category colors
  static const Color temperature = Color(0xFF42A5F5);
  static const Color temperatureLight = Color(0x1F42A5F5);

  static const Color humidity = Color(0xFF26A69A);
  static const Color humidityLight = Color(0x1F26A69A);

  static const Color airQuality = Color(0xFF66BB6A);
  static const Color airQualityLight = Color(0x1F66BB6A);

  static const Color motion = Color(0xFFFFA726);
  static const Color motionLight = Color(0x1FFFA726);

  static const Color safety = Color(0xFFEF5350);
  static const Color safetyLight = Color(0x1FEF5350);

  static const Color lightSensor = Color(0xFFFFCA28);
  static const Color lightSensorLight = Color(0x1FFFCA28);

  static const Color energy = Color(0xFFAB47BC);
  static const Color energyLight = Color(0x1FAB47BC);

  static const double radiusSm = 12.0;
  static const double radiusMd = 16.0;
  static const double radiusLg = 20.0;

  static Color getColorForCategory(SensorCategory category) {
    switch (category) {
      case SensorCategory.temperature:
        return temperature;
      case SensorCategory.humidity:
        return humidity;
      case SensorCategory.airQuality:
        return airQuality;
      case SensorCategory.motion:
        return motion;
      case SensorCategory.safety:
        return safety;
      case SensorCategory.light:
        return lightSensor;
      case SensorCategory.energy:
        return energy;
    }
  }

  static Color getLightColorForCategory(SensorCategory category) {
    switch (category) {
      case SensorCategory.temperature:
        return temperatureLight;
      case SensorCategory.humidity:
        return humidityLight;
      case SensorCategory.airQuality:
        return airQualityLight;
      case SensorCategory.motion:
        return motionLight;
      case SensorCategory.safety:
        return safetyLight;
      case SensorCategory.light:
        return lightSensorLight;
      case SensorCategory.energy:
        return energyLight;
    }
  }
}

// ============================================================================
// DATA MODELS
// ============================================================================

enum SensorStatus {
  normal,
  warning,
  alert,
  offline,
}

enum TrendDirection {
  up,
  down,
  stable,
}

class SensorData {
  final String id;
  final String name;
  final String location;
  final SensorCategory category;
  final String value;
  final String unit;
  final SensorStatus status;
  final TrendDirection trend;
  final String? trendText;
  final DateTime lastUpdated;
  final List<double>? history;
  final double? minValue;
  final double? maxValue;
  final double? avgValue;
  final double? highThreshold;
  final double? lowThreshold;

  const SensorData({
    required this.id,
    required this.name,
    required this.location,
    required this.category,
    required this.value,
    required this.unit,
    this.status = SensorStatus.normal,
    this.trend = TrendDirection.stable,
    this.trendText,
    required this.lastUpdated,
    this.history,
    this.minValue,
    this.maxValue,
    this.avgValue,
    this.highThreshold,
    this.lowThreshold,
  });

  IconData get icon {
    switch (category) {
      case SensorCategory.temperature:
        return Icons.thermostat;
      case SensorCategory.humidity:
        return Icons.water_drop;
      case SensorCategory.airQuality:
        return Icons.air;
      case SensorCategory.motion:
        return Icons.visibility;
      case SensorCategory.safety:
        return Icons.shield;
      case SensorCategory.light:
        return Icons.light_mode;
      case SensorCategory.energy:
        return Icons.bolt;
    }
  }

  Color get color => SensorTheme.getColorForCategory(category);
  Color get lightColor => SensorTheme.getLightColorForCategory(category);
}

class SensorActivityItem {
  final String title;
  final String subtitle;
  final SensorCategory category;
  final DateTime timestamp;

  const SensorActivityItem({
    required this.title,
    required this.subtitle,
    required this.category,
    required this.timestamp,
  });

  String get timeAgo {
    final diff = DateTime.now().difference(timestamp);
    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes} min ago';
    if (diff.inHours < 24) return '${diff.inHours} hr ago';
    return '${diff.inDays} days ago';
  }
}

// ============================================================================
// SENSOR CARD WIDGET
// ============================================================================

class SensorCard extends StatelessWidget {
  final SensorData sensor;
  final VoidCallback? onTap;

  const SensorCard({
    super.key,
    required this.sensor,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isAlert = sensor.status == SensorStatus.alert;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isAlert ? SensorTheme.safetyLight : SensorTheme.card,
          borderRadius: BorderRadius.circular(SensorTheme.radiusMd),
          border: Border.all(
            color: isAlert ? SensorTheme.safety : SensorTheme.border,
            width: 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header: Icon + Status
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: isAlert ? SensorTheme.safetyLight : sensor.lightColor,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    sensor.icon,
                    size: 20,
                    color: isAlert ? SensorTheme.safety : sensor.color,
                  ),
                ),
                _StatusDot(status: sensor.status),
              ],
            ),
            const SizedBox(height: 12),

            // Name
            Text(
              sensor.name,
              style: const TextStyle(
                color: SensorTheme.textSecondary,
                fontSize: 13,
              ),
            ),
            const SizedBox(height: 4),

            // Value
            RichText(
              text: TextSpan(
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w300,
                  color: isAlert ? SensorTheme.safety : sensor.color,
                ),
                children: [
                  TextSpan(text: sensor.value),
                  TextSpan(
                    text: sensor.unit,
                    style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w400),
                  ),
                ],
              ),
            ),

            // Trend
            if (sensor.trendText != null) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  _TrendIcon(direction: sensor.trend),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      sensor.trendText!,
                      style: TextStyle(
                        color: isAlert ? SensorTheme.safety : SensorTheme.textMuted,
                        fontSize: 11,
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _StatusDot extends StatelessWidget {
  final SensorStatus status;

  const _StatusDot({required this.status});

  Color get _color {
    switch (status) {
      case SensorStatus.normal:
        return SensorTheme.airQuality;
      case SensorStatus.warning:
        return SensorTheme.motion;
      case SensorStatus.alert:
        return SensorTheme.safety;
      case SensorStatus.offline:
        return SensorTheme.textMuted;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 8,
      height: 8,
      decoration: BoxDecoration(
        color: _color,
        shape: BoxShape.circle,
      ),
    );
  }
}

class _TrendIcon extends StatelessWidget {
  final TrendDirection direction;

  const _TrendIcon({required this.direction});

  @override
  Widget build(BuildContext context) {
    IconData icon;
    Color color;

    switch (direction) {
      case TrendDirection.up:
        icon = Icons.arrow_upward;
        color = SensorTheme.safety;
        break;
      case TrendDirection.down:
        icon = Icons.arrow_downward;
        color = SensorTheme.temperature;
        break;
      case TrendDirection.stable:
        icon = Icons.remove;
        color = SensorTheme.textMuted;
        break;
    }

    return Icon(icon, size: 12, color: color);
  }
}

// ============================================================================
// CATEGORY TAB WIDGET
// ============================================================================

class CategoryTab extends StatelessWidget {
  final String label;
  final IconData? icon;
  final int count;
  final bool isSelected;
  final bool hasAlert;
  final VoidCallback? onTap;

  const CategoryTab({
    super.key,
    required this.label,
    this.icon,
    required this.count,
    this.isSelected = false,
    this.hasAlert = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? SensorTheme.text : SensorTheme.bg,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(
                icon,
                size: 16,
                color: isSelected ? SensorTheme.card : SensorTheme.textMuted,
              ),
              const SizedBox(width: 6),
            ],
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                color: isSelected ? SensorTheme.card : SensorTheme.textSecondary,
              ),
            ),
            if (count > 0) ...[
              const SizedBox(width: 6),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: hasAlert
                      ? SensorTheme.safety
                      : (isSelected ? Colors.white.withOpacity(0.2) : SensorTheme.card),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  count.toString(),
                  style: TextStyle(
                    fontSize: 11,
                    color: hasAlert
                        ? Colors.white
                        : (isSelected ? SensorTheme.card : SensorTheme.textMuted),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

// ============================================================================
// SUMMARY CARD WIDGET
// ============================================================================

class SummaryCard extends StatelessWidget {
  final String title;
  final String value;
  final String subtitle;
  final IconData icon;
  final Color color;

  const SummaryCard({
    super.key,
    required this.title,
    required this.value,
    required this.subtitle,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: SensorTheme.card,
        borderRadius: BorderRadius.circular(SensorTheme.radiusMd),
        border: Border.all(color: SensorTheme.border, width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 18, color: color),
              const SizedBox(width: 8),
              Text(
                title,
                style: const TextStyle(
                  color: SensorTheme.textSecondary,
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(
              color: color,
              fontSize: 32,
              fontWeight: FontWeight.w300,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            subtitle,
            style: const TextStyle(
              color: SensorTheme.textMuted,
              fontSize: 11,
            ),
          ),
        ],
      ),
    );
  }
}

// ============================================================================
// ACTIVITY LIST ITEM WIDGET
// ============================================================================

class ActivityListItem extends StatelessWidget {
  final SensorActivityItem item;
  final VoidCallback? onTap;

  const ActivityListItem({
    super.key,
    required this.item,
    this.onTap,
  });

  IconData get _icon {
    switch (item.category) {
      case SensorCategory.temperature:
        return Icons.thermostat;
      case SensorCategory.humidity:
        return Icons.water_drop;
      case SensorCategory.airQuality:
        return Icons.air;
      case SensorCategory.motion:
        return Icons.visibility;
      case SensorCategory.safety:
        return Icons.shield;
      case SensorCategory.light:
        return Icons.light_mode;
      case SensorCategory.energy:
        return Icons.bolt;
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = SensorTheme.getColorForCategory(item.category);
    final lightColor = SensorTheme.getLightColorForCategory(item.category);

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(12),
        margin: const EdgeInsets.only(bottom: 8),
        decoration: BoxDecoration(
          color: SensorTheme.bg,
          borderRadius: BorderRadius.circular(SensorTheme.radiusSm),
        ),
        child: Row(
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: lightColor,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(_icon, size: 18, color: color),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.title,
                    style: const TextStyle(
                      color: SensorTheme.text,
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    item.subtitle,
                    style: const TextStyle(
                      color: SensorTheme.textMuted,
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
            ),
            Text(
              item.timeAgo,
              style: const TextStyle(
                color: SensorTheme.textMuted,
                fontSize: 10,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ============================================================================
// ALERT BANNER WIDGET
// ============================================================================

class AlertBanner extends StatelessWidget {
  final String title;
  final String message;
  final VoidCallback? onView;

  const AlertBanner({
    super.key,
    required this.title,
    required this.message,
    this.onView,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: SensorTheme.safetyLight,
        borderRadius: BorderRadius.circular(SensorTheme.radiusMd),
        border: Border.all(color: SensorTheme.safety.withOpacity(0.3), width: 1),
      ),
      child: Row(
        children: [
          const Icon(Icons.warning_amber, color: SensorTheme.safety, size: 24),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: SensorTheme.safety,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  message,
                  style: const TextStyle(
                    color: SensorTheme.textSecondary,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          GestureDetector(
            onTap: onView,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: SensorTheme.safety,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Text(
                'View',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ============================================================================
// SENSOR DETAIL PAGE
// ============================================================================

class SensorDetailPage extends StatefulWidget {
  final SensorData sensor;
  final VoidCallback? onBack;

  const SensorDetailPage({
    super.key,
    required this.sensor,
    this.onBack,
  });

  @override
  State<SensorDetailPage> createState() => _SensorDetailPageState();
}

class _SensorDetailPageState extends State<SensorDetailPage> {
  int _selectedPeriod = 1; // 0=1H, 1=24H, 2=7D, 3=30D
  bool _notificationsEnabled = true;
  late double _highThreshold;
  late double _lowThreshold;

  @override
  void initState() {
    super.initState();
    _highThreshold = widget.sensor.highThreshold ?? 28.0;
    _lowThreshold = widget.sensor.lowThreshold ?? 16.0;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: SensorTheme.bg,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            Expanded(
              child: OrientationBuilder(
                builder: (context, orientation) {
                  return orientation == Orientation.landscape
                      ? _buildLandscapeLayout()
                      : _buildPortraitLayout();
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLandscapeLayout() {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Left panel: Large value + Stats
        Container(
          width: 320,
          padding: const EdgeInsets.all(24),
          decoration: const BoxDecoration(
            border: Border(right: BorderSide(color: SensorTheme.border, width: 1)),
          ),
          child: Column(
            children: [
              _buildLargeValue(),
              const Spacer(),
              _buildStatsRowCompact(),
            ],
          ),
        ),
        // Right panel: Chart + Thresholds
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildChart(withMargin: false),
                const SizedBox(height: 20),
                _buildThresholdsLandscape(),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPortraitLayout() {
    return SingleChildScrollView(
      child: Column(
        children: [
          _buildLargeValue(),
          _buildStatsRow(),
          _buildChart(),
          _buildThresholds(),
        ],
      ),
    );
  }

  Widget _buildStatsRowCompact() {
    return Row(
      children: [
        _buildStatCard('Min', '${widget.sensor.minValue ?? 19.2}°', SensorTheme.temperature),
        const SizedBox(width: 8),
        _buildStatCard('Max', '${widget.sensor.maxValue ?? 24.8}°', SensorTheme.safety),
        const SizedBox(width: 8),
        _buildStatCard('Avg', '${widget.sensor.avgValue ?? 22.1}°', null),
      ],
    );
  }

  Widget _buildThresholdsLandscape() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: const [
            Icon(Icons.warning_amber, size: 18, color: SensorTheme.textMuted),
            SizedBox(width: 8),
            Text(
              'ALERT THRESHOLDS',
              style: TextStyle(
                color: SensorTheme.textSecondary,
                fontSize: 12,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.5,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _buildThresholdRow(
                icon: Icons.arrow_upward,
                label: 'High Alert',
                value: _highThreshold,
                onChanged: (v) => setState(() => _highThreshold = v),
                withMargin: false,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildThresholdRow(
                icon: Icons.arrow_downward,
                label: 'Low Alert',
                value: _lowThreshold,
                onChanged: (v) => setState(() => _lowThreshold = v),
                withMargin: false,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(child: _buildNotificationRow()),
          ],
        ),
      ],
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      decoration: const BoxDecoration(
        color: SensorTheme.card,
        border: Border(bottom: BorderSide(color: SensorTheme.border, width: 1)),
      ),
      child: Row(
        children: [
          GestureDetector(
            onTap: widget.onBack,
            child: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: SensorTheme.cardLight,
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Icon(Icons.arrow_back_ios_new, color: SensorTheme.textSecondary, size: 18),
            ),
          ),
          const SizedBox(width: 12),
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: widget.sensor.lightColor,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(widget.sensor.icon, color: widget.sensor.color, size: 24),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.sensor.name,
                  style: const TextStyle(color: SensorTheme.text, fontSize: 18, fontWeight: FontWeight.w600),
                ),
                Text(
                  '${widget.sensor.location} • Online',
                  style: const TextStyle(color: SensorTheme.textSecondary, fontSize: 13),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLargeValue() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 32),
      child: Column(
        children: [
          RichText(
            text: TextSpan(
              style: TextStyle(
                fontSize: 72,
                fontWeight: FontWeight.w200,
                color: widget.sensor.color,
              ),
              children: [
                TextSpan(text: widget.sensor.value),
                TextSpan(
                  text: widget.sensor.unit,
                  style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w300),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Current ${widget.sensor.name}',
            style: const TextStyle(color: SensorTheme.textMuted, fontSize: 14),
          ),
          const SizedBox(height: 4),
          Text(
            'Updated ${_formatTimestamp(widget.sensor.lastUpdated)}',
            style: const TextStyle(color: SensorTheme.textMuted, fontSize: 12),
          ),
        ],
      ),
    );
  }

  String _formatTimestamp(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inSeconds < 60) return '${diff.inSeconds} seconds ago';
    if (diff.inMinutes < 60) return '${diff.inMinutes} minutes ago';
    return '${diff.inHours} hours ago';
  }

  Widget _buildStatsRow() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        children: [
          _buildStatCard('24h Min', '${widget.sensor.minValue ?? 19.2}°', SensorTheme.temperature),
          const SizedBox(width: 12),
          _buildStatCard('24h Max', '${widget.sensor.maxValue ?? 24.8}°', SensorTheme.safety),
          const SizedBox(width: 12),
          _buildStatCard('24h Avg', '${widget.sensor.avgValue ?? 22.1}°', null),
        ],
      ),
    );
  }

  Widget _buildStatCard(String label, String value, Color? valueColor) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: SensorTheme.card,
          borderRadius: BorderRadius.circular(SensorTheme.radiusMd),
          border: Border.all(color: SensorTheme.border, width: 1),
        ),
        child: Column(
          children: [
            Text(label, style: const TextStyle(color: SensorTheme.textMuted, fontSize: 11)),
            const SizedBox(height: 4),
            Text(
              value,
              style: TextStyle(
                color: valueColor ?? SensorTheme.text,
                fontSize: 20,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildChart({bool withMargin = true}) {
    return Container(
      margin: withMargin ? const EdgeInsets.all(20) : EdgeInsets.zero,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: SensorTheme.card,
        borderRadius: BorderRadius.circular(SensorTheme.radiusLg),
        border: Border.all(color: SensorTheme.border, width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'History',
                style: TextStyle(color: SensorTheme.text, fontSize: 14, fontWeight: FontWeight.w600),
              ),
              Container(
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: SensorTheme.bg,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    _buildPeriodButton('1H', 0),
                    _buildPeriodButton('24H', 1),
                    _buildPeriodButton('7D', 2),
                    _buildPeriodButton('30D', 3),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          SizedBox(
            height: 160,
            child: CustomPaint(
              size: const Size(double.infinity, 160),
              painter: _ChartPainter(color: widget.sensor.color),
            ),
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: const [
              Text('00:00', style: TextStyle(color: SensorTheme.textMuted, fontSize: 10)),
              Text('06:00', style: TextStyle(color: SensorTheme.textMuted, fontSize: 10)),
              Text('12:00', style: TextStyle(color: SensorTheme.textMuted, fontSize: 10)),
              Text('18:00', style: TextStyle(color: SensorTheme.textMuted, fontSize: 10)),
              Text('Now', style: TextStyle(color: SensorTheme.textMuted, fontSize: 10)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPeriodButton(String label, int index) {
    final isSelected = _selectedPeriod == index;
    return GestureDetector(
      onTap: () => setState(() => _selectedPeriod = index),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? SensorTheme.card : Colors.transparent,
          borderRadius: BorderRadius.circular(6),
          boxShadow: isSelected
              ? [BoxShadow(color: Colors.black.withOpacity(0.1), blurRadius: 3, offset: const Offset(0, 1))]
              : null,
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? SensorTheme.text : SensorTheme.textSecondary,
            fontSize: 11,
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
          ),
        ),
      ),
    );
  }

  Widget _buildThresholds() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: const [
              Icon(Icons.warning_amber, size: 18, color: SensorTheme.textMuted),
              SizedBox(width: 8),
              Text(
                'ALERT THRESHOLDS',
                style: TextStyle(
                  color: SensorTheme.textSecondary,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.5,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          _buildThresholdRow(
            icon: Icons.arrow_upward,
            label: 'High Alert',
            value: _highThreshold,
            onChanged: (v) => setState(() => _highThreshold = v),
          ),
          _buildThresholdRow(
            icon: Icons.arrow_downward,
            label: 'Low Alert',
            value: _lowThreshold,
            onChanged: (v) => setState(() => _lowThreshold = v),
          ),
          _buildNotificationRow(),
        ],
      ),
    );
  }

  Widget _buildThresholdRow({
    required IconData icon,
    required String label,
    required double value,
    required ValueChanged<double> onChanged,
    bool withMargin = true,
  }) {
    return Container(
      margin: withMargin ? const EdgeInsets.only(bottom: 8) : EdgeInsets.zero,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: SensorTheme.card,
        borderRadius: BorderRadius.circular(SensorTheme.radiusMd),
        border: Border.all(color: SensorTheme.border, width: 1),
      ),
      child: Row(
        children: [
          Icon(icon, size: 20, color: SensorTheme.textMuted),
          const SizedBox(width: 10),
          Expanded(
            child: Text(label, style: const TextStyle(color: SensorTheme.text, fontSize: 14)),
          ),
          SizedBox(
            width: 60,
            child: TextField(
              textAlign: TextAlign.center,
              style: const TextStyle(color: SensorTheme.text, fontSize: 14),
              decoration: InputDecoration(
                contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                filled: true,
                fillColor: SensorTheme.bg,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: BorderSide.none,
                ),
              ),
              controller: TextEditingController(text: value.toStringAsFixed(0)),
              keyboardType: TextInputType.number,
              onChanged: (text) {
                final parsed = double.tryParse(text);
                if (parsed != null) onChanged(parsed);
              },
            ),
          ),
          const SizedBox(width: 8),
          Text(widget.sensor.unit, style: const TextStyle(color: SensorTheme.textMuted, fontSize: 12)),
        ],
      ),
    );
  }

  Widget _buildNotificationRow() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: SensorTheme.card,
        borderRadius: BorderRadius.circular(SensorTheme.radiusMd),
        border: Border.all(color: SensorTheme.border, width: 1),
      ),
      child: Row(
        children: [
          const Icon(Icons.notifications_outlined, size: 20, color: SensorTheme.textMuted),
          const SizedBox(width: 10),
          const Expanded(
            child: Text('Notifications', style: TextStyle(color: SensorTheme.text, fontSize: 14)),
          ),
          GestureDetector(
            onTap: () => setState(() => _notificationsEnabled = !_notificationsEnabled),
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: 48,
              height: 28,
              decoration: BoxDecoration(
                color: _notificationsEnabled ? SensorTheme.accent : SensorTheme.cardLight,
                borderRadius: BorderRadius.circular(14),
              ),
              child: AnimatedAlign(
                duration: const Duration(milliseconds: 200),
                alignment: _notificationsEnabled ? Alignment.centerRight : Alignment.centerLeft,
                child: Container(
                  width: 22,
                  height: 22,
                  margin: const EdgeInsets.all(3),
                  decoration: BoxDecoration(
                    color: SensorTheme.card,
                    shape: BoxShape.circle,
                    boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.2), blurRadius: 4, offset: const Offset(0, 2))],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ChartPainter extends CustomPainter {
  final Color color;

  _ChartPainter({required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    // Grid lines
    final gridPaint = Paint()
      ..color = SensorTheme.border
      ..strokeWidth = 0.5;

    for (int i = 1; i < 4; i++) {
      final y = size.height * i / 4;
      canvas.drawLine(Offset(0, y), Offset(size.width, y), gridPaint);
    }

    // Generate sample data
    final points = <Offset>[];
    final random = math.Random(42);
    for (int i = 0; i <= 20; i++) {
      final x = size.width * i / 20;
      final y = size.height * 0.3 + (random.nextDouble() * 0.4 * size.height);
      points.add(Offset(x, y));
    }

    // Area fill
    final areaPath = Path()..moveTo(0, size.height);
    for (final point in points) {
      areaPath.lineTo(point.dx, point.dy);
    }
    areaPath.lineTo(size.width, size.height);
    areaPath.close();

    final areaPaint = Paint()
      ..color = color.withOpacity(0.1)
      ..style = PaintingStyle.fill;
    canvas.drawPath(areaPath, areaPaint);

    // Line
    final linePath = Path()..moveTo(points.first.dx, points.first.dy);
    for (int i = 1; i < points.length; i++) {
      linePath.lineTo(points[i].dx, points[i].dy);
    }

    final linePaint = Paint()
      ..color = color
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke;
    canvas.drawPath(linePath, linePaint);

    // Current point
    final lastPoint = points.last;
    canvas.drawCircle(lastPoint, 4, Paint()..color = color);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

// ============================================================================
// SENSORS DOMAIN OVERVIEW PAGE
// ============================================================================

class SensorsDomainPage extends StatefulWidget {
  final String roomName;
  final List<SensorData> sensors;
  final List<SensorActivityItem> activity;
  final VoidCallback? onBack;

  const SensorsDomainPage({
    super.key,
    required this.roomName,
    required this.sensors,
    this.activity = const [],
    this.onBack,
  });

  @override
  State<SensorsDomainPage> createState() => _SensorsDomainPageState();
}

class _SensorsDomainPageState extends State<SensorsDomainPage> {
  SensorCategory? _selectedCategory;

  List<SensorData> get _filteredSensors {
    if (_selectedCategory == null) return widget.sensors;
    return widget.sensors.where((s) => s.category == _selectedCategory).toList();
  }

  int _countForCategory(SensorCategory? category) {
    if (category == null) return widget.sensors.length;
    return widget.sensors.where((s) => s.category == category).length;
  }

  bool get _hasAlerts => widget.sensors.any((s) => s.status == SensorStatus.alert);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: SensorTheme.bg,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            _buildCategoryTabs(),
            Expanded(
              child: OrientationBuilder(
                builder: (context, orientation) {
                  return orientation == Orientation.landscape
                      ? _buildLandscape()
                      : _buildPortrait();
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    final alertCount = widget.sensors.where((s) => s.status == SensorStatus.alert).length;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      decoration: const BoxDecoration(
        color: SensorTheme.card,
        border: Border(bottom: BorderSide(color: SensorTheme.border, width: 1)),
      ),
      child: Row(
        children: [
          GestureDetector(
            onTap: widget.onBack,
            child: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: SensorTheme.cardLight,
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Icon(Icons.arrow_back_ios_new, color: SensorTheme.textSecondary, size: 18),
            ),
          ),
          const SizedBox(width: 12),
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: SensorTheme.accentLight,
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.sensors, color: SensorTheme.accent, size: 24),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.roomName,
                  style: const TextStyle(color: SensorTheme.text, fontSize: 18, fontWeight: FontWeight.w600),
                ),
                Text(
                  alertCount > 0
                      ? '$alertCount Alert${alertCount > 1 ? 's' : ''} Active'
                      : '${widget.sensors.length} sensors • All normal',
                  style: TextStyle(
                    color: alertCount > 0 ? SensorTheme.safety : SensorTheme.textSecondary,
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCategoryTabs() {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
      decoration: const BoxDecoration(
        color: SensorTheme.card,
        border: Border(bottom: BorderSide(color: SensorTheme.border, width: 1)),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: [
            CategoryTab(
              label: 'All',
              icon: Icons.grid_view,
              count: _countForCategory(null),
              isSelected: _selectedCategory == null,
              onTap: () => setState(() => _selectedCategory = null),
            ),
            const SizedBox(width: 8),
            ...SensorCategory.values.map((cat) {
              final hasAlert = widget.sensors.any((s) => s.category == cat && s.status == SensorStatus.alert);
              return Padding(
                padding: const EdgeInsets.only(right: 8),
                child: CategoryTab(
                  label: _categoryLabel(cat),
                  count: _countForCategory(cat),
                  isSelected: _selectedCategory == cat,
                  hasAlert: hasAlert,
                  onTap: () => setState(() => _selectedCategory = cat),
                ),
              );
            }).toList(),
          ],
        ),
      ),
    );
  }

  String _categoryLabel(SensorCategory category) {
    switch (category) {
      case SensorCategory.temperature:
        return 'Temperature';
      case SensorCategory.humidity:
        return 'Humidity';
      case SensorCategory.airQuality:
        return 'Air Quality';
      case SensorCategory.motion:
        return 'Motion';
      case SensorCategory.safety:
        return 'Safety';
      case SensorCategory.light:
        return 'Light';
      case SensorCategory.energy:
        return 'Energy';
    }
  }

  Widget _buildLandscape() {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          flex: 2,
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (_selectedCategory == null) _buildSummaryCards(),
                _buildSensorGrid(),
              ],
            ),
          ),
        ),
        Container(width: 1, color: SensorTheme.border),
        SizedBox(
          width: 320,
          child: Container(
            color: SensorTheme.card,
            padding: const EdgeInsets.all(20),
            child: _buildActivityPanel(),
          ),
        ),
      ],
    );
  }

  Widget _buildPortrait() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (_hasAlerts) _buildAlertBanner(),
          if (_selectedCategory == null) _buildSummaryCards(),
          _buildSensorGrid(),
        ],
      ),
    );
  }

  Widget _buildAlertBanner() {
    final alertSensor = widget.sensors.firstWhere((s) => s.status == SensorStatus.alert);
    return AlertBanner(
      title: 'High ${alertSensor.name} Alert',
      message: '${alertSensor.name} exceeded threshold',
      onView: () {
        // Navigate to sensor detail
      },
    );
  }

  Widget _buildSummaryCards() {
    // Calculate averages from sensors
    final tempSensors = widget.sensors.where((s) => s.category == SensorCategory.temperature);
    final humiditySensors = widget.sensors.where((s) => s.category == SensorCategory.humidity);

    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Row(
        children: [
          Expanded(
            child: SummaryCard(
              title: 'Avg Temperature',
              value: '22.4°',
              subtitle: 'Comfortable range',
              icon: Icons.thermostat,
              color: SensorTheme.temperature,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: SummaryCard(
              title: 'Avg Humidity',
              value: '48%',
              subtitle: 'Optimal level',
              icon: Icons.water_drop,
              color: SensorTheme.humidity,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: SummaryCard(
              title: 'Air Quality',
              value: 'Good',
              subtitle: 'AQI 42',
              icon: Icons.air,
              color: SensorTheme.airQuality,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSensorGrid() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const Icon(Icons.grid_view, size: 18, color: SensorTheme.textMuted),
            const SizedBox(width: 8),
            Text(
              _selectedCategory == null ? 'ALL SENSORS' : _categoryLabel(_selectedCategory!).toUpperCase(),
              style: const TextStyle(
                color: SensorTheme.textSecondary,
                fontSize: 12,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.5,
              ),
            ),
            const Spacer(),
            Text(
              '${_filteredSensors.length} sensors',
              style: const TextStyle(color: SensorTheme.textMuted, fontSize: 11),
            ),
          ],
        ),
        const SizedBox(height: 12),
        GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
            maxCrossAxisExtent: 200,
            childAspectRatio: 1.1,
            crossAxisSpacing: 12,
            mainAxisSpacing: 12,
          ),
          itemCount: _filteredSensors.length,
          itemBuilder: (context, index) {
            final sensor = _filteredSensors[index];
            return SensorCard(
              sensor: sensor,
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => SensorDetailPage(
                      sensor: sensor,
                      onBack: () => Navigator.pop(context),
                    ),
                  ),
                );
              },
            );
          },
        ),
      ],
    );
  }

  Widget _buildActivityPanel() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: const [
            Icon(Icons.history, size: 18, color: SensorTheme.textMuted),
            SizedBox(width: 8),
            Text(
              'RECENT ACTIVITY',
              style: TextStyle(
                color: SensorTheme.textSecondary,
                fontSize: 12,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.5,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        ...widget.activity.map((item) => ActivityListItem(item: item)).toList(),
        const Divider(height: 32),
        Row(
          children: const [
            Icon(Icons.warning_amber, size: 18, color: SensorTheme.textMuted),
            SizedBox(width: 8),
            Text(
              'ALERTS',
              style: TextStyle(
                color: SensorTheme.textSecondary,
                fontSize: 12,
                fontWeight: FontWeight.w600,
                letterSpacing: 0.5,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        if (!_hasAlerts)
          const Center(
            child: Padding(
              padding: EdgeInsets.all(20),
              child: Text(
                'No active alerts',
                style: TextStyle(color: SensorTheme.textMuted, fontSize: 13),
              ),
            ),
          ),
      ],
    );
  }
}

// ============================================================================
// DEMO APP
// ============================================================================

void main() {
  runApp(const SensorsDomainDemo());
}

class SensorsDomainDemo extends StatelessWidget {
  const SensorsDomainDemo({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: ThemeData.light(),
      home: SensorsDomainPage(
        roomName: 'Living Room',
        sensors: [
          SensorData(
            id: '1',
            name: 'Room Temp',
            location: 'Living Room',
            category: SensorCategory.temperature,
            value: '22.4',
            unit: '°C',
            trend: TrendDirection.stable,
            trendText: 'Stable',
            lastUpdated: DateTime.now().subtract(const Duration(seconds: 30)),
            minValue: 19.2,
            maxValue: 24.8,
            avgValue: 22.1,
          ),
          SensorData(
            id: '2',
            name: 'Floor Temp',
            location: 'Living Room',
            category: SensorCategory.temperature,
            value: '24.1',
            unit: '°C',
            trend: TrendDirection.up,
            trendText: '+0.3° last hour',
            lastUpdated: DateTime.now().subtract(const Duration(minutes: 1)),
          ),
          SensorData(
            id: '3',
            name: 'Humidity',
            location: 'Living Room',
            category: SensorCategory.humidity,
            value: '48',
            unit: '%',
            trend: TrendDirection.down,
            trendText: '-2% last hour',
            lastUpdated: DateTime.now().subtract(const Duration(minutes: 2)),
          ),
          SensorData(
            id: '4',
            name: 'CO₂ Level',
            location: 'Living Room',
            category: SensorCategory.airQuality,
            value: '612',
            unit: 'ppm',
            trend: TrendDirection.stable,
            trendText: 'Normal',
            lastUpdated: DateTime.now().subtract(const Duration(minutes: 1)),
          ),
          SensorData(
            id: '5',
            name: 'PM2.5',
            location: 'Living Room',
            category: SensorCategory.airQuality,
            value: '8',
            unit: 'µg/m³',
            trend: TrendDirection.stable,
            trendText: 'Excellent',
            lastUpdated: DateTime.now().subtract(const Duration(minutes: 3)),
          ),
          SensorData(
            id: '6',
            name: 'Motion',
            location: 'Living Room',
            category: SensorCategory.motion,
            value: 'Active',
            unit: '',
            status: SensorStatus.warning,
            trendText: '2 min ago',
            lastUpdated: DateTime.now().subtract(const Duration(minutes: 2)),
          ),
          SensorData(
            id: '7',
            name: 'Light Level',
            location: 'Living Room',
            category: SensorCategory.light,
            value: '420',
            unit: 'lux',
            trend: TrendDirection.down,
            trendText: 'Dimming',
            lastUpdated: DateTime.now().subtract(const Duration(minutes: 5)),
          ),
          SensorData(
            id: '8',
            name: 'Power Usage',
            location: 'Living Room',
            category: SensorCategory.energy,
            value: '245',
            unit: 'W',
            trend: TrendDirection.up,
            trendText: 'Above avg',
            lastUpdated: DateTime.now().subtract(const Duration(minutes: 1)),
          ),
        ],
        activity: [
          SensorActivityItem(
            title: 'Motion detected',
            subtitle: 'Living Room',
            category: SensorCategory.motion,
            timestamp: DateTime.now().subtract(const Duration(minutes: 2)),
          ),
          SensorActivityItem(
            title: 'Floor heating active',
            subtitle: 'Floor Temp → 24.1°C',
            category: SensorCategory.temperature,
            timestamp: DateTime.now().subtract(const Duration(minutes: 15)),
          ),
          SensorActivityItem(
            title: 'Light level dropped',
            subtitle: 'Below 500 lux',
            category: SensorCategory.light,
            timestamp: DateTime.now().subtract(const Duration(minutes: 23)),
          ),
          SensorActivityItem(
            title: 'CO₂ normalized',
            subtitle: 'Back to 612 ppm',
            category: SensorCategory.airQuality,
            timestamp: DateTime.now().subtract(const Duration(hours: 1)),
          ),
        ],
      ),
    );
  }
}
