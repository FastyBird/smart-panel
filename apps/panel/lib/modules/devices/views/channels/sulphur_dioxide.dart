import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/active.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/density.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/detected.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/fault.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/level.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/tampered.dart';

class SulphurDioxideChannelView extends ChannelView
    with
        ChannelDetectedMixin,
        ChannelDensityMixin,
        ChannelActiveMixin,
        ChannelFaultMixin,
        ChannelTamperedMixin {
  SulphurDioxideChannelView({
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
  DetectedChannelPropertyView get detectedProp =>
      properties.whereType<DetectedChannelPropertyView>().first;

  @override
  DensityChannelPropertyView get densityProp =>
      properties.whereType<DensityChannelPropertyView>().first;

  LevelChannelPropertyView get levelProp =>
      properties.whereType<LevelChannelPropertyView>().first;

  @override
  ActiveChannelPropertyView? get activeProp =>
      properties.whereType<ActiveChannelPropertyView>().firstOrNull;

  @override
  FaultChannelPropertyView? get faultProp =>
      properties.whereType<FaultChannelPropertyView>().firstOrNull;

  @override
  TamperedChannelPropertyView? get tamperedProp =>
      properties.whereType<TamperedChannelPropertyView>().firstOrNull;

  SulphurDioxideLevelValue? get level {
    final ValueType? value = levelProp.value;

    if (value is StringValueType &&
        SulphurDioxideLevelValue.contains(value.value)) {
      return SulphurDioxideLevelValue.fromValue(value.value);
    }

    final ValueType? defaultValue = levelProp.defaultValue;

    if (defaultValue is StringValueType &&
        SulphurDioxideLevelValue.contains(defaultValue.value)) {
      return SulphurDioxideLevelValue.fromValue(defaultValue.value);
    }

    return null;
  }

  List<SulphurDioxideLevelValue> get availableLevels {
    final FormatType? format = levelProp.format;

    if (format is StringListFormatType) {
      return format.value
          .map((item) => SulphurDioxideLevelValue.fromValue(item))
          .whereType<SulphurDioxideLevelValue>()
          .toList();
    }

    return [];
  }
}
