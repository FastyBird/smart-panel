import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/modules/devices/utils/value.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/devices/services/property_timeseries.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/battery.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/sensor.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class SensorDeviceDetail extends StatefulWidget {
  final SensorDeviceView _device;

  const SensorDeviceDetail({
    super.key,
    required SensorDeviceView device,
  }) : _device = device;

  @override
  State<SensorDeviceDetail> createState() => _SensorDeviceDetailState();
}

class _SensorDeviceDetailState extends State<SensorDeviceDetail> {
  @override
  Widget build(BuildContext context) {
    final environmentalSensors = _getEnvironmentalSensors();
    final airQualitySensors = _getAirQualitySensors();
    final detectionSensors = _getDetectionSensors();
    final deviceInfoSensors = _getDeviceInfoSensors();

    return SafeArea(
      child: LayoutBuilder(
        builder: (context, constraints) {
          return SingleChildScrollView(
            padding: AppSpacings.paddingMd,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (environmentalSensors.isNotEmpty)
                  SensorSection(
                    title: 'Environmental',
                    icon: MdiIcons.thermometer,
                    sensors: environmentalSensors,
                  ),
                if (airQualitySensors.isNotEmpty)
                  SensorSection(
                    title: 'Air Quality',
                    icon: MdiIcons.airFilter,
                    sensors: airQualitySensors,
                  ),
                if (detectionSensors.isNotEmpty)
                  SensorSection(
                    title: 'Detection',
                    icon: MdiIcons.motionSensor,
                    sensors: detectionSensors,
                  ),
                if (deviceInfoSensors.isNotEmpty)
                  SensorSection(
                    title: 'Device Info',
                    icon: MdiIcons.informationOutline,
                    sensors: deviceInfoSensors,
                  ),
              ],
            ),
          );
        },
      ),
    );
  }

  List<SensorData> _getEnvironmentalSensors() {
    final sensors = <SensorData>[];

    if (widget._device.hasTemperature) {
      final channel = widget._device.temperatureChannel!;
      sensors.add(SensorData(
        label: 'Temperature',
        icon: MdiIcons.thermometer,
        channel: channel,
        property: channel.temperatureProp,
        valueFormatter: (prop) => ValueUtils.formatValue(prop, 1),
      ));
    }

    if (widget._device.hasHumidity) {
      final channel = widget._device.humidityChannel!;
      sensors.add(SensorData(
        label: 'Humidity',
        icon: MdiIcons.waterPercent,
        channel: channel,
        property: channel.humidityProp,
        valueFormatter: (prop) => ValueUtils.formatValue(prop, 0),
      ));
    }

    if (widget._device.hasPressure) {
      final channel = widget._device.pressureChannel!;
      sensors.add(SensorData(
        label: 'Pressure',
        icon: MdiIcons.gauge,
        channel: channel,
        property: channel.measuredProp,
        valueFormatter: (prop) => ValueUtils.formatValue(prop, 0),
      ));
    }

    if (widget._device.hasIlluminance) {
      final channel = widget._device.illuminanceChannel!;
      sensors.add(SensorData(
        label: 'Illuminance',
        icon: MdiIcons.brightness6,
        channel: channel,
        property: channel.densityProp,
        valueFormatter: (prop) => ValueUtils.formatValue(prop, 0),
      ));
    }

    return sensors;
  }

  List<SensorData> _getAirQualitySensors() {
    final sensors = <SensorData>[];

    if (widget._device.hasCarbonDioxide) {
      final channel = widget._device.carbonDioxideChannel!;
      sensors.add(SensorData(
        label: 'Carbon Dioxide',
        icon: MdiIcons.moleculeCo2,
        channel: channel,
        property: channel.densityProp,
        valueFormatter: (prop) => ValueUtils.formatValue(prop, 0),
        isAlert: channel.detected,
        alertLabel: channel.detected ? 'High Level' : null,
      ));
    }

    if (widget._device.hasCarbonMonoxide) {
      final channel = widget._device.carbonMonoxideChannel!;
      sensors.add(SensorData(
        label: 'Carbon Monoxide',
        icon: MdiIcons.molecule,
        channel: channel,
        property: channel.densityProp,
        valueFormatter: (prop) => ValueUtils.formatValue(prop, 0),
        isAlert: channel.detected,
        alertLabel: channel.detected ? 'Detected' : null,
      ));
    }

    if (widget._device.hasOzone) {
      final channel = widget._device.ozoneChannel!;
      sensors.add(SensorData(
        label: 'Ozone',
        icon: MdiIcons.molecule,
        channel: channel,
        property: channel.densityProp,
        valueFormatter: (prop) => ValueUtils.formatValue(prop, 0),
        isAlert: channel.detected,
        alertLabel: channel.detected ? 'High Level' : null,
      ));
    }

    if (widget._device.hasNitrogenDioxide) {
      final channel = widget._device.nitrogenDioxideChannel!;
      sensors.add(SensorData(
        label: 'Nitrogen Dioxide',
        icon: MdiIcons.molecule,
        channel: channel,
        property: channel.densityProp,
        valueFormatter: (prop) => ValueUtils.formatValue(prop, 0),
        isAlert: channel.detected,
        alertLabel: channel.detected ? 'High Level' : null,
      ));
    }

    if (widget._device.hasSulphurDioxide) {
      final channel = widget._device.sulphurDioxideChannel!;
      sensors.add(SensorData(
        label: 'Sulphur Dioxide',
        icon: MdiIcons.molecule,
        channel: channel,
        property: channel.densityProp,
        valueFormatter: (prop) => ValueUtils.formatValue(prop, 0),
        isAlert: channel.detected,
        alertLabel: channel.detected ? 'High Level' : null,
      ));
    }

    if (widget._device.hasVolatileOrganicCompounds) {
      final channel = widget._device.volatileOrganicCompoundsChannel!;
      sensors.add(SensorData(
        label: 'VOC',
        icon: MdiIcons.molecule,
        channel: channel,
        property: channel.densityProp,
        valueFormatter: (prop) => ValueUtils.formatValue(prop, 0),
        isAlert: channel.detected,
        alertLabel: channel.detected ? 'High Level' : null,
      ));
    }

    if (widget._device.hasAirParticulate) {
      final channel = widget._device.airParticulateChannel!;
      sensors.add(SensorData(
        label: 'Particulate Matter',
        icon: MdiIcons.blur,
        channel: channel,
        property: channel.densityProp,
        valueFormatter: (prop) => ValueUtils.formatValue(prop, 0),
      ));
    }

    return sensors;
  }

  List<SensorData> _getDetectionSensors() {
    final sensors = <SensorData>[];

    if (widget._device.hasMotion) {
      final channel = widget._device.motionChannel!;
      sensors.add(SensorData(
        label: 'Motion',
        icon: MdiIcons.motionSensor,
        channel: channel,
        property: channel.detectedProp,
        isDetection: channel.detected,
        detectedLabel: 'Detected',
        notDetectedLabel: 'Not Detected',
      ));
    }

    if (widget._device.hasOccupancy) {
      final channel = widget._device.occupancyChannel!;
      sensors.add(SensorData(
        label: 'Occupancy',
        icon: MdiIcons.accountCheck,
        channel: channel,
        property: channel.detectedProp,
        isDetection: channel.detected,
        detectedLabel: 'Detected',
        notDetectedLabel: 'Not Detected',
      ));
    }

    if (widget._device.hasContact) {
      final channel = widget._device.contactChannel!;
      sensors.add(SensorData(
        label: 'Contact',
        icon: channel.detected ? MdiIcons.doorOpen : MdiIcons.doorClosed,
        channel: channel,
        property: channel.detectedProp,
        isDetection: channel.detected,
        detectedLabel: 'Open',
        notDetectedLabel: 'Closed',
      ));
    }

    if (widget._device.hasLeak) {
      final channel = widget._device.leakChannel!;
      sensors.add(SensorData(
        label: 'Leak',
        icon: MdiIcons.waterAlert,
        channel: channel,
        property: channel.detectedProp,
        isDetection: channel.detected,
        detectedLabel: 'Detected',
        notDetectedLabel: 'Not Detected',
        isAlert: channel.detected,
      ));
    }

    if (widget._device.hasSmoke) {
      final channel = widget._device.smokeChannel!;
      sensors.add(SensorData(
        label: 'Smoke',
        icon: MdiIcons.smokingOff,
        channel: channel,
        property: channel.detectedProp,
        isDetection: channel.detected,
        detectedLabel: 'Detected',
        notDetectedLabel: 'Not Detected',
        isAlert: channel.detected,
      ));
    }

    return sensors;
  }

  List<SensorData> _getDeviceInfoSensors() {
    final sensors = <SensorData>[];

    if (widget._device.hasBattery) {
      final channel = widget._device.batteryChannel!;
      sensors.add(SensorData(
        label: 'Battery',
        icon: _getBatteryIcon(channel),
        channel: channel,
        property: channel.percentageProp,
        valueFormatter: (prop) => ValueUtils.formatValue(prop, 0),
        isAlert: channel.isLow,
        alertLabel: channel.isCharging
            ? 'Charging'
            : channel.isLow
                ? 'Low Battery'
                : null,
      ));
    }

    return sensors;
  }

  IconData _getBatteryIcon(BatteryChannelView channel) {
    if (channel.isCharging) {
      return MdiIcons.batteryCharging;
    }
    final percentage = channel.percentage;
    if (percentage >= 90) return MdiIcons.battery;
    if (percentage >= 70) return MdiIcons.battery80;
    if (percentage >= 50) return MdiIcons.battery60;
    if (percentage >= 30) return MdiIcons.battery40;
    if (percentage >= 10) return MdiIcons.battery20;
    return MdiIcons.batteryAlert;
  }
}

class SensorData {
  final String label;
  final IconData icon;
  final ChannelView channel;
  final ChannelPropertyView? property;
  final String? Function(ChannelPropertyView)? valueFormatter;
  final bool? isDetection;
  final String? detectedLabel;
  final String? notDetectedLabel;
  final bool? isAlert;
  final String? alertLabel;

  SensorData({
    required this.label,
    required this.icon,
    required this.channel,
    this.property,
    this.valueFormatter,
    this.isDetection,
    this.detectedLabel,
    this.notDetectedLabel,
    this.isAlert,
    this.alertLabel,
  });
}

class SensorSection extends StatelessWidget {
  final String title;
  final IconData icon;
  final List<SensorData> sensors;

  const SensorSection({
    super.key,
    required this.title,
    required this.icon,
    required this.sensors,
  });

  @override
  Widget build(BuildContext context) {
    final screenService = locator<ScreenService>();
    final visualDensityService = locator<VisualDensityService>();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: EdgeInsets.only(
            bottom: AppSpacings.pSm,
            top: AppSpacings.pMd,
          ),
          child: Row(
            children: [
              Icon(
                icon,
                size: screenService.scale(
                  18,
                  density: visualDensityService.density,
                ),
                color: Theme.of(context).brightness == Brightness.light
                    ? AppTextColorLight.secondary
                    : AppTextColorDark.secondary,
              ),
              AppSpacings.spacingSmHorizontal,
              Text(
                title,
                style: TextStyle(
                  fontSize: AppFontSize.small,
                  fontWeight: FontWeight.w600,
                  color: Theme.of(context).brightness == Brightness.light
                      ? AppTextColorLight.secondary
                      : AppTextColorDark.secondary,
                ),
              ),
            ],
          ),
        ),
        Wrap(
          spacing: AppSpacings.pSm,
          runSpacing: AppSpacings.pSm,
          children:
              sensors.map((sensor) => SensorCard(sensor: sensor)).toList(),
        ),
        AppSpacings.spacingMdVertical,
      ],
    );
  }
}

class SensorCard extends StatelessWidget {
  final SensorData sensor;

  const SensorCard({
    super.key,
    required this.sensor,
  });

  @override
  Widget build(BuildContext context) {
    final screenService = locator<ScreenService>();
    final visualDensityService = locator<VisualDensityService>();
    final localizations = AppLocalizations.of(context)!;

    final isLight = Theme.of(context).brightness == Brightness.light;
    final isAlert = sensor.isAlert ?? false;

    return GestureDetector(
      onTap: sensor.property != null && sensor.isDetection == null
          ? () => _showSensorDetail(context, sensor)
          : null,
      child: Container(
        constraints: BoxConstraints(
          minWidth: screenService.scale(
            140,
            density: visualDensityService.density,
          ),
        ),
        padding: AppSpacings.paddingMd,
        decoration: BoxDecoration(
          color: isLight
              ? (isAlert
                  ? AppColorsLight.warning.withValues(alpha: 0.1)
                  : AppFillColorLight.base)
              : (isAlert
                  ? AppColorsDark.warning.withValues(alpha: 0.1)
                  : AppFillColorDark.base),
          borderRadius: BorderRadius.circular(AppBorderRadius.base),
          border: Border.all(
            color: isLight
                ? (isAlert ? AppColorsLight.warning : AppBorderColorLight.base)
                : (isAlert ? AppColorsDark.warning : AppBorderColorDark.base),
            width: screenService.scale(
              1,
              density: visualDensityService.density,
            ),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  sensor.icon,
                  size: screenService.scale(
                    20,
                    density: visualDensityService.density,
                  ),
                  color: isAlert
                      ? (isLight
                          ? AppColorsLight.warning
                          : AppColorsDark.warning)
                      : (isLight
                          ? AppColorsLight.primary
                          : AppColorsDark.primary),
                ),
                AppSpacings.spacingSmHorizontal,
                Flexible(
                  child: Text(
                    sensor.label,
                    style: TextStyle(
                      fontSize: AppFontSize.extraSmall,
                      fontWeight: FontWeight.w500,
                      color: isLight
                          ? AppTextColorLight.secondary
                          : AppTextColorDark.secondary,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            AppSpacings.spacingSmVertical,
            _buildValue(context, localizations),
            if (sensor.alertLabel != null) ...[
              AppSpacings.spacingXsVertical,
              Text(
                sensor.alertLabel!,
                style: TextStyle(
                  fontSize: AppFontSize.extraSmall,
                  color:
                      isLight ? AppColorsLight.warning : AppColorsDark.warning,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildValue(BuildContext context, AppLocalizations localizations) {
    final screenService = locator<ScreenService>();
    final visualDensityService = locator<VisualDensityService>();
    final isLight = Theme.of(context).brightness == Brightness.light;

    if (sensor.isDetection != null) {
      final isDetected = sensor.isDetection ?? false;
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: isDetected
                  ? (isLight ? AppColorsLight.success : AppColorsDark.success)
                  : (isLight
                      ? AppTextColorLight.placeholder
                      : AppTextColorDark.placeholder),
            ),
          ),
          AppSpacings.spacingXsHorizontal,
          Text(
            isDetected
                ? (sensor.detectedLabel ?? 'Detected')
                : (sensor.notDetectedLabel ?? 'Not Detected'),
            style: TextStyle(
              fontSize: AppFontSize.base,
              fontWeight: FontWeight.w600,
              color: isLight
                  ? AppTextColorLight.primary
                  : AppTextColorDark.primary,
            ),
          ),
        ],
      );
    }

    if (sensor.property == null) {
      return Text(
        localizations.value_not_available,
        style: TextStyle(
          fontSize: AppFontSize.base,
          fontWeight: FontWeight.w600,
          color:
              isLight ? AppTextColorLight.primary : AppTextColorDark.primary,
        ),
      );
    }

    final value = sensor.valueFormatter != null
        ? sensor.valueFormatter!(sensor.property!)
        : ValueUtils.formatValue(sensor.property!);

    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.baseline,
      textBaseline: TextBaseline.alphabetic,
      children: [
        Text(
          value ?? localizations.value_not_available,
          style: TextStyle(
            fontSize: screenService.scale(
              24,
              density: visualDensityService.density,
            ),
            fontFamily: 'DIN1451',
            fontWeight: FontWeight.w500,
            color:
                isLight ? AppTextColorLight.primary : AppTextColorDark.primary,
          ),
        ),
        if (sensor.property?.unit != null) ...[
          AppSpacings.spacingXsHorizontal,
          Text(
            sensor.property!.unit!,
            style: TextStyle(
              fontSize: AppFontSize.small,
              color: isLight
                  ? AppTextColorLight.secondary
                  : AppTextColorDark.secondary,
            ),
          ),
        ],
      ],
    );
  }

  void _showSensorDetail(BuildContext context, SensorData sensor) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => SensorDetailBottomSheet(sensor: sensor),
    );
  }
}

class SensorDetailBottomSheet extends StatefulWidget {
  final SensorData sensor;

  const SensorDetailBottomSheet({
    super.key,
    required this.sensor,
  });

  @override
  State<SensorDetailBottomSheet> createState() =>
      _SensorDetailBottomSheetState();
}

class _SensorDetailBottomSheetState extends State<SensorDetailBottomSheet> {
  final PropertyTimeseriesService _timeseriesService =
      locator<PropertyTimeseriesService>();
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  TimeRange _selectedRange = TimeRange.oneDay;
  PropertyTimeseries? _timeseries;
  bool _isLoading = true;
  bool _hasError = false;
  int _requestCounter = 0;

  @override
  void initState() {
    super.initState();
    _loadTimeseries();
  }

  Future<void> _loadTimeseries() async {
    if (widget.sensor.property == null) return;

    // Increment counter to track this request
    final currentRequest = ++_requestCounter;
    final requestedRange = _selectedRange;

    setState(() {
      _isLoading = true;
      _hasError = false;
    });

    final result = await _timeseriesService.getTimeseries(
      channelId: widget.sensor.channel.id,
      propertyId: widget.sensor.property!.id,
      timeRange: requestedRange,
    );

    // Only update state if this is still the most recent request
    // and the selected range hasn't changed
    if (mounted &&
        currentRequest == _requestCounter &&
        requestedRange == _selectedRange) {
      setState(() {
        _timeseries = result;
        _isLoading = false;
        _hasError = result == null;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isLight = Theme.of(context).brightness == Brightness.light;

    return Container(
      height: MediaQuery.of(context).size.height * 0.7,
      decoration: BoxDecoration(
        color: isLight ? AppBgColorLight.base : AppBgColorDark.base,
        borderRadius: BorderRadius.vertical(
          top: Radius.circular(AppBorderRadius.medium),
        ),
      ),
      child: Column(
        children: [
          _buildHeader(context),
          _buildCurrentValue(context),
          _buildTimeRangeSelector(context),
          Expanded(
            child: _buildChart(context),
          ),
          if (_timeseries != null && _timeseries!.isNotEmpty)
            _buildStats(context),
          AppSpacings.spacingLgVertical,
        ],
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    final isLight = Theme.of(context).brightness == Brightness.light;

    return Container(
      padding: AppSpacings.paddingMd,
      child: Row(
        children: [
          Icon(
            widget.sensor.icon,
            size: _screenService.scale(
              24,
              density: _visualDensityService.density,
            ),
            color: isLight ? AppColorsLight.primary : AppColorsDark.primary,
          ),
          AppSpacings.spacingMdHorizontal,
          Expanded(
            child: Text(
              widget.sensor.label,
              style: TextStyle(
                fontSize: AppFontSize.large,
                fontWeight: FontWeight.w600,
                color: isLight
                    ? AppTextColorLight.primary
                    : AppTextColorDark.primary,
              ),
            ),
          ),
          IconButton(
            icon: Icon(
              MdiIcons.close,
              color: isLight
                  ? AppTextColorLight.secondary
                  : AppTextColorDark.secondary,
            ),
            onPressed: () => Navigator.of(context).pop(),
          ),
        ],
      ),
    );
  }

  Widget _buildCurrentValue(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;
    final isLight = Theme.of(context).brightness == Brightness.light;

    if (widget.sensor.property == null) {
      return const SizedBox.shrink();
    }

    final value = widget.sensor.valueFormatter != null
        ? widget.sensor.valueFormatter!(widget.sensor.property!)
        : ValueUtils.formatValue(widget.sensor.property!);

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: AppSpacings.pMd,
        vertical: AppSpacings.pSm,
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.baseline,
        textBaseline: TextBaseline.alphabetic,
        children: [
          Text(
            'Current',
            style: TextStyle(
              fontSize: AppFontSize.base,
              color: isLight
                  ? AppTextColorLight.secondary
                  : AppTextColorDark.secondary,
            ),
          ),
          AppSpacings.spacingMdHorizontal,
          Text(
            value ?? localizations.value_not_available,
            style: TextStyle(
              fontSize: _screenService.scale(
                40,
                density: _visualDensityService.density,
              ),
              fontFamily: 'DIN1451',
              fontWeight: FontWeight.w500,
              color: isLight
                  ? AppTextColorLight.primary
                  : AppTextColorDark.primary,
            ),
          ),
          if (widget.sensor.property?.unit != null) ...[
            AppSpacings.spacingSmHorizontal,
            Text(
              widget.sensor.property!.unit!,
              style: TextStyle(
                fontSize: AppFontSize.large,
                color: isLight
                    ? AppTextColorLight.secondary
                    : AppTextColorDark.secondary,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildTimeRangeSelector(BuildContext context) {
    final isLight = Theme.of(context).brightness == Brightness.light;

    final labels = {
      TimeRange.oneHour: '1h',
      TimeRange.sixHours: '6h',
      TimeRange.twelveHours: '12h',
      TimeRange.oneDay: '24h',
      TimeRange.sevenDays: '7d',
    };

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: AppSpacings.pMd,
        vertical: AppSpacings.pSm,
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: TimeRange.values.map((range) {
          final isSelected = range == _selectedRange;
          return Padding(
            padding: EdgeInsets.symmetric(horizontal: AppSpacings.pXs),
            child: GestureDetector(
              onTap: () {
                setState(() {
                  _selectedRange = range;
                });
                _loadTimeseries();
              },
              child: Container(
                padding: EdgeInsets.symmetric(
                  horizontal: AppSpacings.pMd,
                  vertical: AppSpacings.pSm,
                ),
                decoration: BoxDecoration(
                  color: isSelected
                      ? (isLight
                          ? AppColorsLight.primary
                          : AppColorsDark.primary)
                      : Colors.transparent,
                  borderRadius: BorderRadius.circular(AppBorderRadius.small),
                  border: Border.all(
                    color: isLight
                        ? AppBorderColorLight.base
                        : AppBorderColorDark.base,
                  ),
                ),
                child: Text(
                  labels[range] ?? range.label,
                  style: TextStyle(
                    fontSize: AppFontSize.small,
                    fontWeight:
                        isSelected ? FontWeight.w600 : FontWeight.normal,
                    color: isSelected
                        ? Colors.white
                        : (isLight
                            ? AppTextColorLight.primary
                            : AppTextColorDark.primary),
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildChart(BuildContext context) {
    final isLight = Theme.of(context).brightness == Brightness.light;

    if (_isLoading) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CircularProgressIndicator(),
            AppSpacings.spacingMdVertical,
            Text(
              'Loading data...',
              style: TextStyle(
                color: isLight
                    ? AppTextColorLight.secondary
                    : AppTextColorDark.secondary,
              ),
            ),
          ],
        ),
      );
    }

    if (_hasError) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              MdiIcons.alertCircle,
              size: 48,
              color: isLight ? AppColorsLight.error : AppColorsDark.error,
            ),
            AppSpacings.spacingMdVertical,
            Text(
              'Failed to load data',
              style: TextStyle(
                color: isLight
                    ? AppTextColorLight.secondary
                    : AppTextColorDark.secondary,
              ),
            ),
            AppSpacings.spacingMdVertical,
            TextButton(
              onPressed: _loadTimeseries,
              child: const Text('Retry'),
            ),
          ],
        ),
      );
    }

    if (_timeseries == null || _timeseries!.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              MdiIcons.chartLine,
              size: 48,
              color: isLight
                  ? AppTextColorLight.placeholder
                  : AppTextColorDark.placeholder,
            ),
            AppSpacings.spacingMdVertical,
            Text(
              'No data available',
              style: TextStyle(
                color: isLight
                    ? AppTextColorLight.secondary
                    : AppTextColorDark.secondary,
              ),
            ),
          ],
        ),
      );
    }

    return Padding(
      padding: AppSpacings.paddingMd,
      child: SensorTimeseriesChart(
        timeseries: _timeseries!,
        unit: widget.sensor.property?.unit,
        timeRange: _selectedRange,
      ),
    );
  }

  Widget _buildStats(BuildContext context) {
    if (_timeseries == null || _timeseries!.isEmpty) {
      return const SizedBox.shrink();
    }

    return Container(
      padding: AppSpacings.paddingMd,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          _buildStatItem(
            context,
            'Min',
            _timeseries!.minValue.toStringAsFixed(1),
            widget.sensor.property?.unit,
          ),
          _buildStatItem(
            context,
            'Avg',
            _timeseries!.avgValue.toStringAsFixed(1),
            widget.sensor.property?.unit,
          ),
          _buildStatItem(
            context,
            'Max',
            _timeseries!.maxValue.toStringAsFixed(1),
            widget.sensor.property?.unit,
          ),
        ],
      ),
    );
  }

  Widget _buildStatItem(
    BuildContext context,
    String label,
    String value,
    String? unit,
  ) {
    final isLight = Theme.of(context).brightness == Brightness.light;

    return Column(
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: AppFontSize.extraSmall,
            color: isLight
                ? AppTextColorLight.secondary
                : AppTextColorDark.secondary,
          ),
        ),
        AppSpacings.spacingXsVertical,
        Row(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Text(
              value,
              style: TextStyle(
                fontSize: AppFontSize.large,
                fontFamily: 'DIN1451',
                fontWeight: FontWeight.w500,
                color: isLight
                    ? AppTextColorLight.primary
                    : AppTextColorDark.primary,
              ),
            ),
            if (unit != null) ...[
              SizedBox(
                width: _screenService.scale(
                  2,
                  density: _visualDensityService.density,
                ),
              ),
              Text(
                unit,
                style: TextStyle(
                  fontSize: AppFontSize.extraSmall,
                  color: isLight
                      ? AppTextColorLight.secondary
                      : AppTextColorDark.secondary,
                ),
              ),
            ],
          ],
        ),
      ],
    );
  }
}

class SensorTimeseriesChart extends StatelessWidget {
  final ScreenService _screenService = locator<ScreenService>();
  final VisualDensityService _visualDensityService =
      locator<VisualDensityService>();

  final PropertyTimeseries timeseries;
  final String? unit;
  final TimeRange timeRange;

  SensorTimeseriesChart({
    super.key,
    required this.timeseries,
    required this.timeRange,
    this.unit,
  });

  @override
  Widget build(BuildContext context) {
    final isLight = Theme.of(context).brightness == Brightness.light;

    if (timeseries.points.isEmpty) {
      return const SizedBox.shrink();
    }

    final spots = timeseries.points.asMap().entries.map((entry) {
      return FlSpot(
        entry.key.toDouble(),
        entry.value.numericValue,
      );
    }).toList();

    final minY = timeseries.minValue;
    final maxY = timeseries.maxValue;
    final range = maxY - minY;
    // Ensure minimum padding when all values are equal
    final padding = range == 0 ? (minY.abs() * 0.1).clamp(1.0, 10.0) : range * 0.1;

    return LineChart(
      LineChartData(
        gridData: FlGridData(
          show: true,
          drawVerticalLine: false,
          horizontalInterval:
              _calculateInterval(minY - padding, maxY + padding),
          getDrawingHorizontalLine: (value) {
            return FlLine(
              color: isLight
                  ? AppBorderColorLight.base.withValues(alpha: 0.5)
                  : AppBorderColorDark.base.withValues(alpha: 0.5),
              strokeWidth: _screenService.scale(
                1,
                density: _visualDensityService.density,
              ),
            );
          },
        ),
        titlesData: FlTitlesData(
          show: true,
          rightTitles: const AxisTitles(
            sideTitles: SideTitles(showTitles: false),
          ),
          topTitles: const AxisTitles(
            sideTitles: SideTitles(showTitles: false),
          ),
          bottomTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 30,
              interval: _calculateTimeInterval(spots.length),
              getTitlesWidget: (value, meta) {
                final index = value.toInt();
                if (index < 0 || index >= timeseries.points.length) {
                  return const SizedBox.shrink();
                }
                final point = timeseries.points[index];
                return Padding(
                  padding: EdgeInsets.only(
                    top: _screenService.scale(
                      8,
                      density: _visualDensityService.density,
                    ),
                  ),
                  child: Text(
                    _formatTimeLabel(point.time),
                    style: TextStyle(
                      color: isLight
                          ? AppTextColorLight.placeholder
                          : AppTextColorDark.placeholder,
                      fontSize: AppFontSize.extraSmall,
                    ),
                  ),
                );
              },
            ),
          ),
          leftTitles: AxisTitles(
            sideTitles: SideTitles(
              showTitles: true,
              reservedSize: 45,
              interval: _calculateInterval(minY - padding, maxY + padding),
              getTitlesWidget: (value, meta) {
                return Text(
                  value.toStringAsFixed(1),
                  style: TextStyle(
                    color: isLight
                        ? AppTextColorLight.placeholder
                        : AppTextColorDark.placeholder,
                    fontSize: AppFontSize.extraSmall,
                  ),
                );
              },
            ),
          ),
        ),
        borderData: FlBorderData(show: false),
        minX: 0,
        maxX: spots.length == 1 ? 1.0 : (spots.length - 1).toDouble(),
        minY: minY - padding,
        maxY: maxY + padding,
        lineBarsData: [
          LineChartBarData(
            spots: spots.length == 1
                ? [spots.first, FlSpot(1, spots.first.y)]
                : spots,
            isCurved: spots.length > 2,
            curveSmoothness: 0.3,
            color: isLight ? AppColorsLight.primary : AppColorsDark.primary,
            barWidth: 2,
            isStrokeCapRound: true,
            dotData: FlDotData(show: spots.length <= 2),
            belowBarData: BarAreaData(
              show: true,
              color:
                  (isLight ? AppColorsLight.primary : AppColorsDark.primary)
                      .withValues(alpha: 0.1),
            ),
          ),
        ],
        lineTouchData: LineTouchData(
          enabled: true,
          touchTooltipData: LineTouchTooltipData(
            getTooltipColor: (touchedSpot) =>
                isLight ? AppFillColorLight.base : AppFillColorDark.base,
            getTooltipItems: (touchedSpots) {
              return touchedSpots.map((spot) {
                final index = spot.x.toInt();
                if (index < 0 || index >= timeseries.points.length) {
                  return null;
                }
                final point = timeseries.points[index];
                return LineTooltipItem(
                  '${point.numericValue.toStringAsFixed(1)}${unit != null ? ' $unit' : ''}\n${_formatDateTime(point.time)}',
                  TextStyle(
                    color: isLight
                        ? AppTextColorLight.primary
                        : AppTextColorDark.primary,
                    fontSize: AppFontSize.small,
                  ),
                );
              }).toList();
            },
          ),
        ),
      ),
    );
  }

  double _calculateInterval(double min, double max) {
    final range = max - min;
    if (range <= 1) return 0.2;
    if (range <= 5) return 1;
    if (range <= 10) return 2;
    if (range <= 50) return 10;
    if (range <= 100) return 20;
    return 50;
  }

  double _calculateTimeInterval(int pointCount) {
    if (pointCount <= 6) return 1;
    if (pointCount <= 12) return 2;
    if (pointCount <= 24) return 4;
    if (pointCount <= 48) return 8;
    return (pointCount / 6).roundToDouble();
  }

  /// Format time label based on selected time range
  String _formatTimeLabel(DateTime time) {
    if (timeRange == TimeRange.sevenDays) {
      // For 7-day range, show day/month and hour
      return '${time.day}/${time.month}\n${time.hour.toString().padLeft(2, '0')}:00';
    } else if (timeRange == TimeRange.oneDay || timeRange == TimeRange.twelveHours) {
      // For 12h-24h range, show just time
      return '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
    } else {
      // For shorter ranges, show hours and minutes
      return '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
    }
  }

  String _formatDateTime(DateTime time) {
    return '${time.day}/${time.month} ${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
  }
}
