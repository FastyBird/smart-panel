import 'package:fastybird_smart_panel/api/models/devices_module_data_type.dart';
import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';

import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/utils/sensor_utils.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/sensor_colors.dart';
import 'package:fastybird_smart_panel/modules/devices/service.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_landscape_layout.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/device_portrait_layout.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/sensor_chart_painter.dart';
import 'package:fastybird_smart_panel/modules/devices/presentation/widgets/sensor_data.dart';
import 'package:fastybird_smart_panel/modules/devices/services/property_timeseries.dart';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart' show DateFormat;

/// Reusable sensor detail content widget. Manages timeseries fetching, period
/// selection, and renders the sensor value display, stats, history chart, and
/// event log in both portrait and landscape orientations.
///
/// Use this inside any page that needs to show sensor channel detail.
class SensorDetailContent extends StatefulWidget {
  final SensorData sensor;
  final String? deviceName;
  final bool? isDeviceOnline;

  const SensorDetailContent({
    super.key,
    required this.sensor,
    this.deviceName,
    this.isDeviceOnline,
  });

  @override
  State<SensorDetailContent> createState() => _SensorDetailContentState();
}

class _SensorDetailContentState extends State<SensorDetailContent> {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();
  final PropertyTimeseriesService _timeseriesService =
      locator<PropertyTimeseriesService>();
  final DevicesService _devicesService = locator<DevicesService>();

  int _selectedPeriod = 1; // 0=1H, 1=24H, 2=7D, 3=30D
  bool _isLoadingTimeseries = false;
  PropertyTimeseries? _timeseries;

  late SensorData _currentSensorData;

  // --------------------------------------------------------------------------
  // DERIVED STATE & TIMESERIES
  // --------------------------------------------------------------------------

  bool get _isBinary => _currentSensorData.isDetection != null;

  /// True for any non-numeric property (binary or enum). These sensors show
  /// an event log instead of a chart and hide min/max/avg stats.
  bool get _isDiscrete {
    if (_isBinary) return true;
    final prop = _currentSensorData.property;
    if (prop == null) return false;
    return prop.dataType == DevicesModuleDataType.valueEnum ||
        prop.dataType == DevicesModuleDataType.string ||
        prop.dataType == DevicesModuleDataType.bool;
  }

  String get _channelId => _currentSensorData.channel.id;
  String? get _propertyId => _currentSensorData.property?.id;

  String get _currentValue {
    if (_isBinary) {
      return _currentSensorData.isDetection! ? 'true' : 'false';
    }
    return _currentSensorData.property != null
        ? (_currentSensorData.valueFormatter != null
            ? (_currentSensorData.valueFormatter!(_currentSensorData.property!) ?? '--')
            : SensorUtils.valueFormatterForCategory(_currentSensorData.channel.category)(_currentSensorData.property!) ?? '--')
        : '--';
  }

  String get _unit => _currentSensorData.unit;
  bool get _isOffline => widget.isDeviceOnline == false;

  TimeRange _getTimeRange() {
    switch (_selectedPeriod) {
      case 0:
        return TimeRange.oneHour;
      case 1:
        return TimeRange.oneDay;
      case 2:
      case 3:
        return TimeRange.sevenDays;
      default:
        return TimeRange.oneDay;
    }
  }

  Future<void> _fetchTimeseries() async {
    if (_propertyId == null) return;
    if (!mounted) return;
    setState(() => _isLoadingTimeseries = true);
    try {
      final result = await _timeseriesService.getTimeseries(
        channelId: _channelId,
        propertyId: _propertyId!,
        timeRange: _getTimeRange(),
      );
      if (mounted) {
        setState(() {
          _timeseries = result;
          _isLoadingTimeseries = false;
        });
      }
    } catch (e) {
      if (kDebugMode) debugPrint('[SensorDetailContent] Timeseries error: $e');
      if (mounted) setState(() => _isLoadingTimeseries = false);
    }
  }

  @override
  void initState() {
    super.initState();
    _currentSensorData = widget.sensor;
    _devicesService.addListener(_onDataChanged);
    _fetchTimeseries();
  }

  @override
  void dispose() {
    _devicesService.removeListener(_onDataChanged);
    super.dispose();
  }

  void _onDataChanged() {
    if (!mounted) return;
    final freshChannel = _devicesService.getChannel(widget.sensor.channel.id);
    if (freshChannel == null) return;
    setState(() {
      _currentSensorData = SensorUtils.buildSensorData(
        freshChannel,
        label: widget.sensor.label,
        icon: widget.sensor.icon,
        valueFormatter: widget.sensor.valueFormatter,
        isAlert: widget.sensor.isAlert,
        alertLabel: widget.sensor.alertLabel,
      );
    });
  }

  void _onPeriodChanged(int period) {
    if (_selectedPeriod != period) {
      setState(() => _selectedPeriod = period);
      _fetchTimeseries();
    }
  }

  // --------------------------------------------------------------------------
  // LAYOUT & BUILD
  // --------------------------------------------------------------------------

  double _scale(double size) =>
      _screenService.scale(size, density: _visualDensityService.density);

  ThemeColors get _themeColor =>
      SensorColors.themeColorForCategory(_currentSensorData.channel.category);

  Color _getCategoryColor(BuildContext context) {
    final family = ThemeColorFamily.get(
      Theme.of(context).brightness,
      _themeColor,
    );
    return family.base;
  }

  @override
  Widget build(BuildContext context) {
    return OrientationBuilder(
      builder: (context, orientation) {
        return orientation == Orientation.landscape
            ? _buildLandscapeLayout(context)
            : _buildPortraitLayout(context);
      },
    );
  }

  Widget _buildPortraitLayout(BuildContext context) {
    return DevicePortraitLayout(
      scrollable: false,
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        spacing: AppSpacings.pMd,
        children: [
          Expanded(
            flex: 1,
            child: Center(child: _buildLargeValue(context)),
          ),
          Expanded(
            flex: 2,
            child: _isDiscrete
                ? _buildEventLog(context, flexible: true)
                : Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _buildStatsRow(context),
                      SizedBox(height: AppSpacings.pMd),
                      Expanded(child: _buildChart(context, flexible: true)),
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildLandscapeLayout(BuildContext context) {
    final landscapeSecondary = _isDiscrete
        ? _buildEventLog(context, withMargin: false, withDecoration: false)
        : _buildChart(context, withMargin: false, withDecoration: false);
    return DeviceLandscapeLayout(
      mainContent: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.center,
          spacing: AppSpacings.pMd,
          children: [
            _buildLargeValue(context),
            if (!_isDiscrete) _buildStatsRowCompact(context),
          ],
        ),
      ),
      secondaryContent: landscapeSecondary,
      largeSecondaryColumn: true,
    );
  }

  Widget _buildLargeValue(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isCompact = _screenService.isSmallScreen;
    final localizations = AppLocalizations.of(context)!;
    final displayValue = SensorUtils.translateSensorValue(
      localizations,
      _currentValue,
      _currentSensorData.channel.category,
      short: false,
    );
    return Column(
      mainAxisSize: MainAxisSize.min,
      spacing: AppSpacings.pSm,
      children: [
        FittedBox(
          fit: BoxFit.scaleDown,
          child: RichText(
            text: TextSpan(
              style: TextStyle(
                fontSize: _scale(isCompact ? 56 : 72),
                fontWeight: FontWeight.w200,
                color: _isOffline
                    ? (isDark
                        ? AppTextColorDark.placeholder
                        : AppTextColorLight.placeholder)
                    : _getCategoryColor(context),
              ),
              children: [
                TextSpan(text: displayValue),
                TextSpan(
                  text: _unit.isNotEmpty ? ' $_unit' : '',
                  style: TextStyle(
                    fontSize: _scale(isCompact ? 18 : 24),
                    fontWeight: FontWeight.w300,
                  ),
                ),
              ],
            ),
          ),
        ),
        Text(
          localizations.sensor_ui_current_value(
            SensorUtils.translateSensorLabel(
                localizations, _currentSensorData.channel.category),
          ),
          style: TextStyle(
            color: isDark
                ? AppTextColorDark.placeholder
                : AppTextColorLight.placeholder,
            fontSize: AppFontSize.base,
          ),
        ),
      ],
    );
  }

  // --------------------------------------------------------------------------
  // STATS ROW & PERIOD
  // --------------------------------------------------------------------------

  String _getStatsValue(String type) {
    if (_timeseries == null || _timeseries!.isEmpty) return '--';
    double value;
    switch (type) {
      case 'min':
        value = _timeseries!.minValue;
        break;
      case 'max':
        value = _timeseries!.maxValue;
        break;
      case 'avg':
        value = _timeseries!.avgValue;
        break;
      default:
        return '--';
    }
    return SensorUtils.formatNumericValueWithUnit(value, _currentSensorData.channel.category);
  }

  String _getPeriodLabel() {
    switch (_selectedPeriod) {
      case 0:
        return '1h';
      case 1:
        return '24h';
      case 2:
        return '7d';
      case 3:
        return '30d';
      default:
        return '24h';
    }
  }

  Widget _buildStatsRow(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final periodLabel = _getPeriodLabel();
    return Row(
      spacing: AppSpacings.pMd,
      children: [
        _buildStatCard(context,
            localizations.sensor_ui_period_min(periodLabel), _getStatsValue('min'), true),
        _buildStatCard(context,
            localizations.sensor_ui_period_max(periodLabel), _getStatsValue('max'), false),
        _buildStatCard(context,
            localizations.sensor_ui_period_avg(periodLabel), _getStatsValue('avg'), null),
      ],
    );
  }

  Widget _buildStatsRowCompact(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    return Row(
      spacing: AppSpacings.pSm,
      children: [
        _buildStatCard(
            context, localizations.sensor_ui_min, _getStatsValue('min'), true),
        _buildStatCard(
            context, localizations.sensor_ui_max, _getStatsValue('max'), false),
        _buildStatCard(
            context, localizations.sensor_ui_avg, _getStatsValue('avg'), null),
      ],
    );
  }

  Widget _buildStatCard(
      BuildContext context, String label, String value, bool? isMin) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    Color? valueColor;
    if (isMin == true) {
      valueColor = isDark ? AppColorsDark.info : AppColorsLight.info;
    } else if (isMin == false) {
      valueColor = isDark ? AppColorsDark.danger : AppColorsLight.danger;
    }
    return Expanded(
      child: Container(
        padding: AppSpacings.paddingMd,
        decoration: BoxDecoration(
          color: isDark ? AppFillColorDark.light : AppFillColorLight.blank,
          borderRadius: BorderRadius.circular(AppBorderRadius.base),
          border: Border.all(
            color:
                isDark ? AppFillColorDark.light : AppBorderColorLight.light,
            width: _scale(1),
          ),
        ),
        child: Column(
          spacing: AppSpacings.pXs,
          children: [
            Text(
              label,
              style: TextStyle(
                color: isDark
                    ? AppTextColorDark.placeholder
                    : AppTextColorLight.placeholder,
                fontSize: AppFontSize.extraSmall,
              ),
            ),
            FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                value,
                style: TextStyle(
                  color: valueColor ??
                      (isDark
                          ? AppTextColorDark.primary
                          : AppTextColorLight.primary),
                  fontSize: AppFontSize.large,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // --------------------------------------------------------------------------
  // EVENT LOG (binary sensors)
  // --------------------------------------------------------------------------

  Widget _buildEventLog(
    BuildContext context, {
    bool withMargin = true,
    bool withDecoration = true,
    bool flexible = false,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final localizations = AppLocalizations.of(context)!;
    Widget contentArea;
    if (_isLoadingTimeseries) {
      contentArea = Center(
        child: SizedBox(
          width: _scale(24),
          height: _scale(24),
          child: CircularProgressIndicator(
              strokeWidth: 2, color: _getCategoryColor(context)),
        ),
      );
    } else if (_timeseries != null && _timeseries!.isNotEmpty) {
      contentArea = _buildEventLogEntries(context, inFlex: flexible);
    } else {
      contentArea = Center(
        child: Text(
          localizations.sensor_empty_no_events,
          style: TextStyle(
            color: isDark
                ? AppTextColorDark.placeholder
                : AppTextColorLight.placeholder,
            fontSize: AppFontSize.small,
          ),
        ),
      );
    }
    if (flexible) {
      contentArea = Expanded(child: contentArea);
    }
    return Container(
      padding: withDecoration
          ? AppSpacings.paddingLg
          : EdgeInsets.symmetric(horizontal: AppSpacings.pLg),
      decoration: withDecoration
          ? BoxDecoration(
              color:
                  isDark ? AppFillColorDark.light : AppFillColorLight.blank,
              borderRadius: BorderRadius.circular(AppBorderRadius.base),
              border: Border.all(
                color: isDark
                    ? AppFillColorDark.light
                    : AppBorderColorLight.light,
                width: _scale(1),
              ),
            )
          : null,
      child: Column(
        mainAxisSize: flexible ? MainAxisSize.max : MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: AppSpacings.pMd,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                localizations.sensor_ui_event_log,
                style: TextStyle(
                  color: isDark
                      ? AppTextColorDark.primary
                      : AppTextColorLight.primary,
                  fontSize: AppFontSize.base,
                  fontWeight: FontWeight.w600,
                ),
              ),
              Container(
                padding: EdgeInsets.all(AppSpacings.pXs),
                decoration: BoxDecoration(
                  color:
                      isDark ? AppFillColorDark.base : AppFillColorLight.base,
                  borderRadius: BorderRadius.circular(AppBorderRadius.base),
                ),
                child: Row(
                  children: [
                    _buildPeriodButton(
                        context, localizations.sensor_ui_period_1h, 0),
                    _buildPeriodButton(
                        context, localizations.sensor_ui_period_24h, 1),
                    _buildPeriodButton(
                        context, localizations.sensor_ui_period_7d, 2),
                    _buildPeriodButton(
                        context, localizations.sensor_ui_period_30d, 3),
                  ],
                ),
              ),
            ],
          ),
          contentArea,
        ],
      ),
    );
  }

  Widget _buildEventLogEntries(BuildContext context, {bool inFlex = false}) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final localizations = AppLocalizations.of(context)!;
    final points = _timeseries!.points;
    final events = <TimeseriesPoint>[];
    for (int i = 0; i < points.length; i++) {
      final isActive = points[i].numericValue >= 0.5;
      if (i == 0 || (points[i - 1].numericValue >= 0.5) != isActive) {
        events.add(points[i]);
      }
    }
    final reversedEvents = events.reversed.toList();
    if (reversedEvents.isEmpty) {
      return inFlex
          ? Center(
              child: Text(
                localizations.sensor_empty_no_state_changes,
                style: TextStyle(
                  color: isDark
                      ? AppTextColorDark.placeholder
                      : AppTextColorLight.placeholder,
                  fontSize: AppFontSize.small,
                ),
              ),
            )
          : SizedBox(
              height: _scale(160),
              child: Center(
                child: Text(
                  localizations.sensor_empty_no_state_changes,
                  style: TextStyle(
                    color: isDark
                        ? AppTextColorDark.placeholder
                        : AppTextColorLight.placeholder,
                    fontSize: AppFontSize.small,
                  ),
                ),
              ),
            );
    }
    final category = _currentSensorData.channel.category;
    final useShortDate = _selectedPeriod <= 1;
    final dateFormat =
        useShortDate ? DateFormat.Hm() : DateFormat('MMM d, HH:mm');
    final listView = ListView.separated(
      shrinkWrap: !inFlex,
      padding: EdgeInsets.zero,
      itemCount: reversedEvents.length,
      separatorBuilder: (_, __) => Divider(
        height: _scale(1),
        color: isDark ? AppBorderColorDark.light : AppBorderColorLight.light,
      ),
      itemBuilder: (context, index) {
        final point = reversedEvents[index];
        final isActive = point.numericValue >= 0.5;
        final stateLabel = SensorUtils.translateBinaryState(
            localizations, category, isActive, short: false);
        final dangerColor =
            isDark ? AppColorsDark.danger : AppColorsLight.danger;
        final successColor =
            isDark ? AppColorsDark.success : AppColorsLight.success;
        final dotColor = isActive ? dangerColor : successColor;
        final textColor = isActive
            ? dangerColor
            : (isDark
                ? AppTextColorDark.secondary
                : AppTextColorLight.secondary);
        return Padding(
          padding: EdgeInsets.symmetric(vertical: AppSpacings.pSm),
          child: Row(
            children: [
              Container(
                width: _scale(8),
                height: _scale(8),
                decoration:
                    BoxDecoration(color: dotColor, shape: BoxShape.circle),
              ),
              SizedBox(width: AppSpacings.pMd),
              Expanded(
                child: Text(
                  stateLabel,
                  style: TextStyle(
                      color: textColor,
                      fontSize: AppFontSize.small,
                      fontWeight: FontWeight.w500),
                ),
              ),
              Text(
                dateFormat.format(point.time.toLocal()),
                style: TextStyle(
                  color: isDark
                      ? AppTextColorDark.placeholder
                      : AppTextColorLight.placeholder,
                  fontSize: AppFontSize.extraSmall,
                ),
              ),
            ],
          ),
        );
      },
    );
    if (inFlex) {
      return listView;
    }
    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: _scale(200)),
      child: listView,
    );
  }

  // --------------------------------------------------------------------------
  // HISTORY CHART & PERIOD BUTTONS
  // --------------------------------------------------------------------------

  Widget _buildChart(
    BuildContext context, {
    bool withMargin = true,
    bool withDecoration = true,
    bool flexible = false,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final localizations = AppLocalizations.of(context)!;

    Widget buildChartContent(double height) {
      if (_isLoadingTimeseries) {
        return Center(
          child: SizedBox(
            width: _scale(24),
            height: _scale(24),
            child: CircularProgressIndicator(
                strokeWidth: 2, color: _getCategoryColor(context)),
          ),
        );
      }
      if (_timeseries != null && _timeseries!.isNotEmpty) {
        return CustomPaint(
          size: Size(double.infinity, height),
          painter: SensorChartPainter(
            color: _getCategoryColor(context),
            labelColor: isDark
                ? AppTextColorDark.secondary
                : AppTextColorLight.secondary,
            fontSize: AppFontSize.extraSmall,
            timeseries: _timeseries,
          ),
        );
      }
      return Center(
        child: Text(
          localizations.sensor_empty_no_history,
          style: TextStyle(
            color: isDark
                ? AppTextColorDark.placeholder
                : AppTextColorLight.placeholder,
            fontSize: AppFontSize.small,
          ),
        ),
      );
    }

    final chartArea = flexible
        ? Expanded(
            child: LayoutBuilder(
              builder: (context, constraints) =>
                  buildChartContent(constraints.maxHeight),
            ),
          )
        : SizedBox(
            height: _scale(160),
            child: buildChartContent(_scale(160)),
          );

    return Container(
      padding: withDecoration
          ? AppSpacings.paddingLg
          : EdgeInsets.symmetric(horizontal: AppSpacings.pLg),
      decoration: withDecoration
          ? BoxDecoration(
              color:
                  isDark ? AppFillColorDark.light : AppFillColorLight.blank,
              borderRadius: BorderRadius.circular(AppBorderRadius.base),
              border: Border.all(
                color: isDark
                    ? AppFillColorDark.light
                    : AppBorderColorLight.light,
                width: _scale(1),
              ),
            )
          : null,
      child: Column(
        mainAxisSize: flexible ? MainAxisSize.max : MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                localizations.sensor_ui_history,
                style: TextStyle(
                  color: isDark
                      ? AppTextColorDark.primary
                      : AppTextColorLight.primary,
                  fontSize: AppFontSize.base,
                  fontWeight: FontWeight.w600,
                ),
              ),
              Container(
                padding: EdgeInsets.all(AppSpacings.pXs),
                decoration: BoxDecoration(
                  color:
                      isDark ? AppFillColorDark.base : AppFillColorLight.base,
                  borderRadius: BorderRadius.circular(AppBorderRadius.base),
                ),
                child: Row(
                  children: [
                    _buildPeriodButton(
                        context, localizations.sensor_ui_period_1h, 0),
                    _buildPeriodButton(
                        context, localizations.sensor_ui_period_24h, 1),
                    _buildPeriodButton(
                        context, localizations.sensor_ui_period_7d, 2),
                    _buildPeriodButton(
                        context, localizations.sensor_ui_period_30d, 3),
                  ],
                ),
              ),
            ],
          ),
          _screenService.isLandscape && _screenService.isAtLeastLarge
              ? AppSpacings.spacingLgVertical
              : AppSpacings.spacingMdVertical,
          chartArea,
          AppSpacings.spacingSmVertical,
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: _getTimeLabels()
                .map((label) => _buildTimeLabel(context, label))
                .toList(),
          ),
        ],
      ),
    );
  }

  List<String> _getTimeLabels() {
    switch (_selectedPeriod) {
      case 0:
        return ['-60m', '-45m', '-30m', '-15m', 'Now'];
      case 1:
        return ['00:00', '06:00', '12:00', '18:00', 'Now'];
      case 2:
        return ['-7d', '-5d', '-3d', '-1d', 'Now'];
      case 3:
        return ['-30d', '-22d', '-15d', '-7d', 'Now'];
      default:
        return ['00:00', '06:00', '12:00', '18:00', 'Now'];
    }
  }

  Widget _buildTimeLabel(BuildContext context, String text) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Text(
      text,
      style: TextStyle(
        color: isDark
            ? AppTextColorDark.placeholder
            : AppTextColorLight.placeholder,
        fontSize: AppFontSize.extraSmall,
      ),
    );
  }

  Widget _buildPeriodButton(BuildContext context, String label, int index) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isSelected = _selectedPeriod == index;
    return GestureDetector(
      onTap: () => _onPeriodChanged(index),
      child: Container(
        padding: EdgeInsets.symmetric(
            horizontal: AppSpacings.pMd, vertical: AppSpacings.pXs),
        decoration: BoxDecoration(
          color: isSelected
              ? (isDark ? AppFillColorDark.light : AppFillColorLight.light)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(AppBorderRadius.small),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                      color: Colors.black.withValues(alpha: 0.1),
                      blurRadius: 3,
                      offset: const Offset(0, 1))
                ]
              : null,
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected
                ? (isDark
                    ? AppTextColorDark.primary
                    : AppTextColorLight.primary)
                : (isDark
                    ? AppTextColorDark.secondary
                    : AppTextColorLight.secondary),
            fontSize: AppFontSize.extraSmall,
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
          ),
        ),
      ),
    );
  }
}
