import 'package:collection/collection.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/capability.dart';
import 'package:fastybird_smart_panel/features/dashboard/capabilities/data/channels/mixins.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/channels/television.dart';
import 'package:fastybird_smart_panel/features/dashboard/models/data/devices/properties.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/categories.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/formats.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/payloads.dart';
import 'package:fastybird_smart_panel/features/dashboard/types/values.dart';

class TelevisionChannelCapability
    extends ChannelCapability<TelevisionChannelDataModel>
    with ChannelOnMixin, ChannelBrightnessMixin {
  TelevisionChannelCapability({
    required super.channel,
    required super.properties,
  });

  @override
  ChannelPropertyDataModel get onProp => properties.firstWhere(
        (property) => property.category == PropertyCategoryType.on,
      );

  @override
  ChannelPropertyDataModel get brightnessProp => properties.firstWhere(
        (property) => property.category == PropertyCategoryType.brightness,
      );

  ChannelPropertyDataModel get inputSourceProp => properties.firstWhere(
        (property) => property.category == PropertyCategoryType.inputSource,
      );

  ChannelPropertyDataModel? get remoteKeyProp => properties.firstWhereOrNull(
        (property) => property.category == PropertyCategoryType.remoteKey,
      );

  TelevisionInputSourceValue? get inputSource {
    final ValueType? value = inputSourceProp.value;

    if (value is StringValueType &&
        TelevisionInputSourceValue.contains(value.value)) {
      return TelevisionInputSourceValue.fromValue(value.value);
    }

    final ValueType? defaultValue = inputSourceProp.defaultValue;

    if (defaultValue is StringValueType &&
        TelevisionInputSourceValue.contains(defaultValue.value)) {
      return TelevisionInputSourceValue.fromValue(defaultValue.value);
    }

    return null;
  }

  List<TelevisionInputSourceValue> get availableInputSources {
    final FormatType? format = inputSourceProp.format;

    if (format is StringListFormatType) {
      return format.value
          .map((item) => TelevisionInputSourceValue.fromValue(item))
          .whereType<TelevisionInputSourceValue>()
          .toList();
    }

    return [];
  }

  bool get hasRemoteKey => remoteKeyProp != null;

  TelevisionRemoteKeyValue? get remoteKey {
    final ChannelPropertyDataModel? prop = remoteKeyProp;

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
    final ChannelPropertyDataModel? prop = remoteKeyProp;

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
