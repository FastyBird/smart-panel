import 'package:fastybird_smart_panel/app/locator.dart';
import 'package:fastybird_smart_panel/core/services/screen.dart';
import 'package:fastybird_smart_panel/core/services/visual_density.dart';
import 'package:fastybird_smart_panel/core/utils/theme.dart';
import 'package:fastybird_smart_panel/core/widgets/top_bar.dart';
import 'package:fastybird_smart_panel/features/dashboard/utils/value.dart';
import 'package:fastybird_smart_panel/l10n/app_localizations.dart';
import 'package:fastybird_smart_panel/modules/dashboard/views/pages/device_detail.dart';
import 'package:fastybird_smart_panel/modules/devices/mappers/device.dart';
import 'package:fastybird_smart_panel/modules/devices/services/property_timeseries.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/battery.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/sensor.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:material_design_icons_flutter/material_design_icons_flutter.dart';

class SensorDeviceDetailPage extends StatefulWidget {
  final SensorDeviceView _device;
  final DeviceDetailPageView? _page;

  const SensorDeviceDetailPage({
    super.key,
    required SensorDeviceView device,
    required DeviceDetailPageView? page,
  })  : _device = device,
        _page = page;

  @override
  State<SensorDeviceDetailPage> createState() => _SensorDeviceDetailPageState();
}

class _SensorDeviceDetailPageState extends State<SensorDeviceDetailPage> {
  @override
  Widget build(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

    final environmentalSensors = _getEnvironmentalSensors();
    final airQualitySensors = _getAirQualitySensors();
    final detectionSensors = _getDetectionSensors();
    final electricalSensors = _getElectricalSensors();
    final deviceInfoSensors = _getDeviceInfoSensors();

    return Scaffold(
      appBar: widget._page == null || widget._page?.showTopBar == true
          ? AppTopBar(
              title: widget._device.name,
              icon: widget._page != null
                  ? widget._page?.icon ??
                      buildDeviceIcon(
                        widget._device.category,
                        widget._device.icon,
                      )
                  : null,
            )
          : null,
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            return SingleChildScrollView(
              padding: AppSpacings.paddingMd,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (environmentalSensors.isNotEmpty)
                    SensorSection(
                      title: localizations.sensor_section_environmental,
                      icon: MdiIcons.thermometer,
                      sensors: environmentalSensors,
                    ),
                  if (airQualitySensors.isNotEmpty)
                    SensorSection(
                      title: localizations.sensor_section_air_quality,
                      icon: MdiIcons.airFilter,
                      sensors: airQualitySensors,
                    ),
                  if (detectionSensors.isNotEmpty)
                    SensorSection(
                      title: localizations.sensor_section_detection,
                      icon: MdiIcons.motionSensor,
                      sensors: detectionSensors,
                    ),
                  if (electricalSensors.isNotEmpty)
                    SensorSection(
                      title: localizations.sensor_section_electrical,
                      icon: MdiIcons.flash,
                      sensors: electricalSensors,
                    ),
                  if (deviceInfoSensors.isNotEmpty)
                    SensorSection(
                      title: localizations.sensor_section_device_info,
                      icon: MdiIcons.informationOutline,
                      sensors: deviceInfoSensors,
                    ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  List<SensorData> _getEnvironmentalSensors() {
    final localizations = AppLocalizations.of(context)!;
    final sensors = <SensorData>[];

    if (widget._device.hasTemperature) {
      final channel = widget._device.temperatureChannel!;
      sensors.add(SensorData(
        label: localizations.sensor_temperature,
        icon: MdiIcons.thermometer,
        channel: channel,
        property: channel.temperatureProp,
        valueFormatter: (prop) => ValueUtils.formatValue(prop, 1),
      ));
    }

    if (widget._device.hasHumidity) {
      final channel = widget._device.humidityChannel!;
      sensors.add(SensorData(
        label: localizations.sensor_humidity,
        icon: MdiIcons.waterPercent,
        channel: channel,
        property: channel.humidityProp,
        valueFormatter: (prop) => ValueUtils.formatValue(prop, 0),
      ));
    }

    if (widget._device.hasPressure) {
      final channel = widget._device.pressureChannel!;
      sensors.add(SensorData(
        label: localizations.sensor_pressure,
        icon: MdiIcons.gauge,
        channel: channel,
        property: channel.pressureProp,
        valueFormatter: (prop) => ValueUtils.formatValue(prop, 0),
      ));
    }

    if (widget._device.hasIlluminance) {
      final channel = widget._device.illuminanceChannel!;
      sensors.add(SensorData(
        label: localizations.sensor_illuminance,
        icon: MdiIcons.brightness6,
        channel: channel,
        property: channel.illuminanceProp,
        valueFormatter: (prop) => ValueUtils.formatValue(prop, 0),
      ));
    }

    return sensors;
  }

  List<SensorData> _getAirQualitySensors() {
    final localizations = AppLocalizations.of(context)!;
    final sensors = <SensorData>[];

    if (widget._device.hasCarbonDioxide) {
      final channel = widget._device.carbonDioxideChannel!;
      sensors.add(SensorData(
        label: localizations.sensor_carbon_dioxide,
        icon: MdiIcons.moleculeCo2,
        channel: channel,
        property: channel.densityProp,
        valueFormatter: (prop) => ValueUtils.formatValue(prop, 0),
        isDetection: channel.isDetected,
      ));
    }

    if (widget._device.hasCarbonMonoxide) {
      final channel = widget._device.carbonMonoxideChannel!;
      sensors.add(SensorData(
        label: localizations.sensor_carbon_monoxide,
        icon: MdiIcons.molecule,
        channel: channel,
        property: channel.densityProp,
        valueFormatter: (prop) => ValueUtils.formatValue(prop, 0),
        isDetection: channel.isDetected,
      ));
    }

    if (widget._device.hasOzone) {
      final channel = widget._device.ozoneChannel!;
      sensors.add(SensorData(
        label: localizations.sensor_ozone,
        icon: MdiIcons.molecule,
        channel: channel,
        property: channel.densityProp,
        valueFormatter: (prop) => ValueUtils.formatValue(prop, 0),
        isDetection: channel.isDetected,
      ));
    }

    if (widget._device.hasNitrogenDioxide) {
      final channel = widget._device.nitrogenDioxideChannel!;
      sensors.add(SensorData(
        label: localizations.sensor_nitrogen_dioxide,
        icon: MdiIcons.molecule,
        channel: channel,
        property: channel.densityProp,
        valueFormatter: (prop) => ValueUtils.formatValue(prop, 0),
        isDetection: channel.isDetected,
      ));
    }

    if (widget._device.hasSulphurDioxide) {
      final channel = widget._device.sulphurDioxideChannel!;
      sensors.add(SensorData(
        label: localizations.sensor_sulphur_dioxide,
        icon: MdiIcons.molecule,
        channel: channel,
        property: channel.densityProp,
        valueFormatter: (prop) => ValueUtils.formatValue(prop, 0),
        isDetection: channel.isDetected,
      ));
    }

    if (widget._device.hasVoc) {
      final channel = widget._device.vocChannel!;
      sensors.add(SensorData(
        label: localizations.sensor_volatile_organic_compounds,
        icon: MdiIcons.molecule,
        channel: channel,
        property: channel.densityProp,
        valueFormatter: (prop) => ValueUtils.formatValue(prop, 0),
        isDetection: channel.isDetected,
      ));
    }

    if (widget._device.hasAirParticulate) {
      final channel = widget._device.airParticulateChannel!;
      sensors.add(SensorData(
        label: localizations.sensor_air_particulate,
        icon: MdiIcons.blur,
        channel: channel,
        property: channel.pm25Prop ?? channel.pm10Prop,
        valueFormatter: (prop) => ValueUtils.formatValue(prop, 0),
      ));
    }

    return sensors;
  }

  List<SensorData> _getDetectionSensors() {
    final localizations = AppLocalizations.of(context)!;
    final sensors = <SensorData>[];

    if (widget._device.hasMotion) {
      final channel = widget._device.motionChannel!;
      sensors.add(SensorData(
        label: localizations.sensor_motion,
        icon: MdiIcons.motionSensor,
        channel: channel,
        property: channel.detectedProp,
        isDetection: channel.isDetected,
        detectedLabel: localizations.sensor_status_detected,
        notDetectedLabel: localizations.sensor_status_not_detected,
      ));
    }

    if (widget._device.hasOccupancy) {
      final channel = widget._device.occupancyChannel!;
      sensors.add(SensorData(
        label: localizations.sensor_occupancy,
        icon: MdiIcons.accountCheck,
        channel: channel,
        property: channel.detectedProp,
        isDetection: channel.isDetected,
        detectedLabel: localizations.sensor_status_detected,
        notDetectedLabel: localizations.sensor_status_not_detected,
      ));
    }

    if (widget._device.hasContact) {
      final channel = widget._device.contactChannel!;
      sensors.add(SensorData(
        label: localizations.sensor_contact,
        icon: channel.isDetected ? MdiIcons.doorOpen : MdiIcons.doorClosed,
        channel: channel,
        property: channel.detectedProp,
        isDetection: channel.isDetected,
        detectedLabel: localizations.sensor_status_open,
        notDetectedLabel: localizations.sensor_status_closed,
      ));
    }

    if (widget._device.hasLeak) {
      final channel = widget._device.leakChannel!;
      sensors.add(SensorData(
        label: localizations.sensor_leak,
        icon: MdiIcons.waterAlert,
        channel: channel,
        property: channel.detectedProp,
        isDetection: channel.isDetected,
        detectedLabel: localizations.sensor_status_detected,
        notDetectedLabel: localizations.sensor_status_not_detected,
        isAlert: channel.isDetected,
      ));
    }

    if (widget._device.hasSmoke) {
      final channel = widget._device.smokeChannel!;
      sensors.add(SensorData(
        label: localizations.sensor_smoke,
        icon: MdiIcons.smokingOff,
        channel: channel,
        property: channel.detectedProp,
        isDetection: channel.isDetected,
        detectedLabel: localizations.sensor_status_detected,
        notDetectedLabel: localizations.sensor_status_not_detected,
        isAlert: channel.isDetected,
      ));
    }

    return sensors;
  }

  List<SensorData> _getElectricalSensors() {
    final localizations = AppLocalizations.of(context)!;
    final sensors = <SensorData>[];

    if (widget._device.hasElectricalPower) {
      final channel = widget._device.electricalPowerChannel!;
      if (channel.hasPower) {
        sensors.add(SensorData(
          label: localizations.sensor_power,
          icon: MdiIcons.flash,
          channel: channel,
          property: channel.powerProp,
          valueFormatter: (prop) => ValueUtils.formatValue(prop, 1),
        ));
      }
    }

    if (widget._device.hasElectricalEnergy) {
      final channel = widget._device.electricalEnergyChannel!;
      sensors.add(SensorData(
        label: localizations.sensor_energy,
        icon: MdiIcons.chartLine,
        channel: channel,
        property: channel.consumptionProp,
        valueFormatter: (prop) => ValueUtils.formatValue(prop, 2),
      ));
    }

    return sensors;
  }

  List<SensorData> _getDeviceInfoSensors() {
    final localizations = AppLocalizations.of(context)!;
    final sensors = <SensorData>[];

    if (widget._device.hasBattery) {
      final channel = widget._device.batteryChannel!;
      sensors.add(SensorData(
        label: localizations.sensor_battery,
        icon: _getBatteryIcon(channel),
        channel: channel,
        property: channel.percentageProp,
        valueFormatter: (prop) => ValueUtils.formatValue(prop, 0),
        isAlert: channel.isLow,
        alertLabel: channel.isCharging
            ? localizations.sensor_battery_charging
            : channel.isLow
                ? localizations.sensor_battery_low
                : null,
      ));
    }

    if (widget._device.hasDeviceInformation) {
      final channel = widget._device.deviceInformationChannel!;
      sensors.add(SensorData(
        label: localizations.sensor_device_information,
        icon: MdiIcons.informationOutline,
        channel: channel,
        property: null,
      ));
    }

    return sensors;
  }

  IconData _getBatteryIcon(BatteryChannelView channel) {
    if (channel.isCharging) {
      return MdiIcons.batteryCharging;
    }
    final percentage = channel.percentage ?? 100;
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
  final String Function(ChannelPropertyView)? valueFormatter;
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
      onTap: sensor.property != null
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
                  : AppColorsLight.surfaceLight)
              : (isAlert
                  ? AppColorsDark.warning.withValues(alpha: 0.1)
                  : AppColorsDark.surface),
          borderRadius: BorderRadius.circular(AppBorderRadius.base),
          border: Border.all(
            color: isLight
                ? (isAlert ? AppColorsLight.warning : AppBorderColorLight.base)
                : (isAlert ? AppColorsDark.warning : AppBorderColorDark.base),
            width: 1,
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
            _buildValue(context),
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

  Widget _buildValue(BuildContext context) {
    final screenService = locator<ScreenService>();
    final visualDensityService = locator<VisualDensityService>();
    final localizations = AppLocalizations.of(context)!;
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
                ? (sensor.detectedLabel ?? localizations.sensor_status_detected)
                : (sensor.notDetectedLabel ??
                    localizations.sensor_status_not_detected),
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

  @override
  void initState() {
    super.initState();
    _loadTimeseries();
  }

  Future<void> _loadTimeseries() async {
    if (widget.sensor.property == null) return;

    setState(() {
      _isLoading = true;
      _hasError = false;
    });

    final result = await _timeseriesService.getTimeseries(
      channelId: widget.sensor.channel.id,
      propertyId: widget.sensor.property!.id,
      timeRange: _selectedRange,
    );

    if (mounted) {
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
        color: isLight ? AppColorsLight.surface : AppColorsDark.surface,
        borderRadius: const BorderRadius.vertical(
          top: Radius.circular(AppBorderRadius.large),
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
            localizations.sensor_current_value,
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
    final localizations = AppLocalizations.of(context)!;
    final isLight = Theme.of(context).brightness == Brightness.light;

    final labels = {
      TimeRange.oneHour: localizations.sensor_time_range_1h,
      TimeRange.sixHours: localizations.sensor_time_range_6h,
      TimeRange.twelveHours: localizations.sensor_time_range_12h,
      TimeRange.oneDay: localizations.sensor_time_range_24h,
      TimeRange.sevenDays: localizations.sensor_time_range_7d,
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
    final localizations = AppLocalizations.of(context)!;
    final isLight = Theme.of(context).brightness == Brightness.light;

    if (_isLoading) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const CircularProgressIndicator(),
            AppSpacings.spacingMdVertical,
            Text(
              localizations.sensor_chart_loading,
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
              localizations.sensor_chart_error,
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
              localizations.sensor_chart_no_data,
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
      ),
    );
  }

  Widget _buildStats(BuildContext context) {
    final localizations = AppLocalizations.of(context)!;

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
            localizations.sensor_stats_min,
            _timeseries!.minValue.toStringAsFixed(1),
            widget.sensor.property?.unit,
          ),
          _buildStatItem(
            context,
            localizations.sensor_stats_avg,
            _timeseries!.avgValue.toStringAsFixed(1),
            widget.sensor.property?.unit,
          ),
          _buildStatItem(
            context,
            localizations.sensor_stats_max,
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
              const SizedBox(width: 2),
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
  final PropertyTimeseries timeseries;
  final String? unit;

  const SensorTimeseriesChart({
    super.key,
    required this.timeseries,
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
    final padding = (maxY - minY) * 0.1;

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
              strokeWidth: 1,
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
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    _formatTime(point.time),
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
        maxX: (spots.length - 1).toDouble(),
        minY: minY - padding,
        maxY: maxY + padding,
        lineBarsData: [
          LineChartBarData(
            spots: spots,
            isCurved: true,
            curveSmoothness: 0.3,
            color: isLight ? AppColorsLight.primary : AppColorsDark.primary,
            barWidth: 2,
            isStrokeCapRound: true,
            dotData: const FlDotData(show: false),
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
                isLight ? AppColorsLight.surface : AppColorsDark.surface,
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

  String _formatTime(DateTime time) {
    return '${time.hour.toString().padLeft(2, '0')}:${time.minute.toString().padLeft(2, '0')}';
  }

  String _formatDateTime(DateTime time) {
    return '${time.day}/${time.month} ${_formatTime(time)}';
  }
}
