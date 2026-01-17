import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/modules/devices/types/formats.dart';
import 'package:fastybird_smart_panel/spec/channels_properties_payloads_spec.g.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/mixins.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/brightness.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/input_source.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/on.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/remote_key.dart';

class TelevisionChannelView extends ChannelView
    with ChannelOnMixin, ChannelBrightnessMixin {
  TelevisionChannelView({
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
  OnChannelPropertyView get onProp =>
      properties.whereType<OnChannelPropertyView>().first;

  @override
  BrightnessChannelPropertyView get brightnessProp =>
      properties.whereType<BrightnessChannelPropertyView>().first;

  InputSourceChannelPropertyView get inputSourceProp =>
      properties.whereType<InputSourceChannelPropertyView>().first;

  RemoteKeyChannelPropertyView? get remoteKeyProp =>
      properties.whereType<RemoteKeyChannelPropertyView>().firstOrNull;

  String? get inputSource {
    final ValueType? value = inputSourceProp.value;

    if (value is StringValueType) {
      return value.value;
    }

    final ValueType? defaultValue = inputSourceProp.defaultValue;

    if (defaultValue is StringValueType) {
      return defaultValue.value;
    }

    return null;
  }

  List<String> get availableInputSources {
    final FormatType? format = inputSourceProp.format;

    if (format is StringListFormatType) {
      return format.value;
    }

    return [];
  }

  bool get hasRemoteKey => remoteKeyProp != null;

  TelevisionRemoteKeyValue? get remoteKey {
    final RemoteKeyChannelPropertyView? prop = remoteKeyProp;

    final ValueType? value = prop?.value;

    if (value is StringValueType &&
        TelevisionRemoteKeyValue.contains(value.value)) {
      return TelevisionRemoteKeyValue.fromValue(value.value);
    }

    final ValueType? defaultValue = prop?.defaultValue;

    if (defaultValue is StringValueType &&
        TelevisionRemoteKeyValue.contains(defaultValue.value)) {
      return TelevisionRemoteKeyValue.fromValue(defaultValue.value);
    }

    return null;
  }

  List<TelevisionRemoteKeyValue> get availableRemoteKeys {
    final RemoteKeyChannelPropertyView? prop = remoteKeyProp;

    final FormatType? format = prop?.format;

    if (format is StringListFormatType) {
      return format.value
          .map((item) => TelevisionRemoteKeyValue.fromValue(item))
          .whereType<TelevisionRemoteKeyValue>()
          .toList();
    }

    return [];
  }
}
