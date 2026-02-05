import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/view.dart';
import 'package:flutter/material.dart';

/// View model for one sensor channel: label, icon, channel/property refs,
/// optional value formatter, and detection/alert state for binary/alert sensors.
/// Used by [SensorDeviceDetail], [SensorDetailContent], and [SensorChannelDetailPage].
class SensorData {
  final String label;
  final IconData icon;
  final ChannelView channel;
  final ChannelPropertyView? property;
  final String unit;
  final String? Function(ChannelPropertyView)? valueFormatter;
  final bool? isDetection;
  final bool? isAlert;
  final String? alertLabel;

  SensorData({
    required this.label,
    required this.icon,
    required this.channel,
    this.property,
    this.unit = '',
    this.valueFormatter,
    this.isDetection,
    this.isAlert,
    this.alertLabel,
  });
}
