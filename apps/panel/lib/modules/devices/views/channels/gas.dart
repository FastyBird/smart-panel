import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/active.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/density.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/detected.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/fault.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/status.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/tampered.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';

class GasChannelView extends ChannelView
    with
        ChannelDetectedMixin,
        ChannelDensityMixin,
        ChannelActiveMixin,
        ChannelFaultMixin,
        ChannelTamperedMixin {
  GasChannelView({
    required super.id,
    required super.type,
    super.category,
    super.name,
    super.description,
    required super.device,
    super.parent,
    required super.properties,
    super.isValid,
    super.validationIssues,
  });

  @override
  DetectedChannelPropertyView? get detectedProp =>
      properties.whereType<DetectedChannelPropertyView>().firstOrNull;

  StatusChannelPropertyView get statusProp =>
      properties.whereType<StatusChannelPropertyView>().first;

  @override
  DensityChannelPropertyView? get densityProp =>
      properties.whereType<DensityChannelPropertyView>().firstOrNull;

  @override
  ActiveChannelPropertyView? get activeProp =>
      properties.whereType<ActiveChannelPropertyView>().firstOrNull;

  @override
  FaultChannelPropertyView? get faultProp =>
      properties.whereType<FaultChannelPropertyView>().firstOrNull;

  @override
  TamperedChannelPropertyView? get tamperedProp =>
      properties.whereType<TamperedChannelPropertyView>().firstOrNull;

  GasStatusValue? get status {
    final ValueType? value = statusProp.value;

    if (value is StringValueType && GasStatusValue.contains(value.value)) {
      return GasStatusValue.fromValue(value.value);
    }

    final ValueType? defaultValue = statusProp.defaultValue;

    if (defaultValue is StringValueType &&
        GasStatusValue.contains(defaultValue.value)) {
      return GasStatusValue.fromValue(defaultValue.value);
    }

    return null;
  }

  bool get isNormal {
    return status == GasStatusValue.normal;
  }

  bool get isWarning {
    return status == GasStatusValue.warning;
  }

  bool get isAlarm {
    return status == GasStatusValue.alarm;
  }
}
