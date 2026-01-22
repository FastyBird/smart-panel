import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/active.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/concentration.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/detected.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/fault.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/mode.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/tampered.dart';

class NitrogenDioxideChannelView extends ChannelView
    with
        ChannelDetectedMixin,
        ChannelConcentrationMixin,
        ChannelActiveMixin,
        ChannelFaultMixin,
        ChannelTamperedMixin {
  NitrogenDioxideChannelView({
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

  @override
  ConcentrationChannelPropertyView? get concentrationProp =>
      properties.whereType<ConcentrationChannelPropertyView>().firstOrNull;

  ModeChannelPropertyView? get modeProp =>
      properties.whereType<ModeChannelPropertyView>().firstOrNull;

  @override
  ActiveChannelPropertyView? get activeProp =>
      properties.whereType<ActiveChannelPropertyView>().firstOrNull;

  @override
  FaultChannelPropertyView? get faultProp =>
      properties.whereType<FaultChannelPropertyView>().firstOrNull;

  @override
  TamperedChannelPropertyView? get tamperedProp =>
      properties.whereType<TamperedChannelPropertyView>().firstOrNull;

  bool get hasMode => modeProp != null;

  NitrogenDioxideModeValue get mode {
    final ModeChannelPropertyView? prop = modeProp;

    final ValueType? value = prop?.value;

    if (value is StringValueType &&
        NitrogenDioxideModeValue.contains(value.value)) {
      NitrogenDioxideModeValue? converted =
          NitrogenDioxideModeValue.fromValue(value.value);

      if (converted != null) {
        return converted;
      }
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is StringValueType &&
        NitrogenDioxideModeValue.contains(defaultValue.value)) {
      NitrogenDioxideModeValue? converted =
          NitrogenDioxideModeValue.fromValue(defaultValue.value);

      if (converted != null) {
        return converted;
      }
    }

    throw Exception(
      'Channel is missing required value for property: ${modeProp?.category.json}',
    );
  }

  List<NitrogenDioxideModeValue> get availableModes {
    final ModeChannelPropertyView? prop = modeProp;

    final FormatType? format = prop?.format;

    if (format is StringListFormatType) {
      return format.value
          .map((item) => NitrogenDioxideModeValue.fromValue(item))
          .whereType<NitrogenDioxideModeValue>()
          .toList();
    }

    return [];
  }
}
