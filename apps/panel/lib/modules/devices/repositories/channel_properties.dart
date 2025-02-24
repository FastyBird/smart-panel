import 'package:fastybird_smart_panel/api/models/devices_channel_property.dart';
import 'package:fastybird_smart_panel/modules/devices/models/properties.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/repository.dart';
import 'package:fastybird_smart_panel/modules/devices/types/data_types.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:flutter/foundation.dart';

class ChannelPropertiesRepository extends Repository<ChannelPropertyModel> {
  ChannelPropertiesRepository({
    required super.apiClient,
  });

  void insertProperties(
    String channelId,
    List<DevicesChannelProperty> apiProperties,
  ) {
    for (var apiProperty in apiProperties) {
      data[apiProperty.id] = ChannelPropertyModel.fromJson({
        'id': apiProperty.id,
        'channel': channelId,
        'category': apiProperty.category.json,
        'name': apiProperty.name,
        'permission': apiProperty.permission
            .map((item) => item.json)
            .whereType<String>()
            .toList(),
        'data_type': apiProperty.dataType.json,
        'unit': apiProperty.unit,
        'format': apiProperty.format,
        'invalid': apiProperty.invalid,
        'step': apiProperty.step,
        'value': apiProperty.value,
        'created_at': apiProperty.createdAt.toIso8601String(),
        'updated_at': apiProperty.updatedAt?.toIso8601String(),
      });
    }

    notifyListeners();
  }

  Future<bool> toggleValue(String id) async {
    final ChannelPropertyModel? property = getItem(id);

    if (property == null) {
      return false;
    }

    if (property.dataType != DataType.boolean) {
      debugPrint(
          '[DEVICES MODULE][CHANNEL PROPERTIES] Only boolean values could be toggled');
    }

    bool newValue = false;

    if (property.value == null) {
      newValue = true;
    } else {
      newValue = !(property.value as BooleanValueType).value;
    }

    return await setValue(
      id,
      newValue,
    );
  }

  Future<bool> setValue(String id, dynamic value) async {
    ChannelPropertyModel? property = getItem(id);

    if (property == null) {
      return false;
    }

    if (property.dataType == DataType.boolean) {
      try {
        property = property.copyWith(
          value: BooleanValueType(_valueToBoolean(value)),
        );
      } on ArgumentError {
        return false;
      }
    } else if (property.dataType == DataType.char ||
        property.dataType == DataType.uchar ||
        property.dataType == DataType.short ||
        property.dataType == DataType.ushort ||
        property.dataType == DataType.int ||
        property.dataType == DataType.uint ||
        property.dataType == DataType.float) {
      try {
        property = property.copyWith(
          value: NumberValueType(_valueToNumber(value)),
        );
      } on ArgumentError {
        return false;
      }
    } else if (property.dataType == DataType.string ||
        property.dataType == DataType.enumerate) {
      property = property.copyWith(
        value: StringValueType(value.toString()),
      );
    } else {
      return false;
    }

    replaceItem(property);

    if (kDebugMode) {
      debugPrint(
        '[DEVICES MODULE][CHANNEL PROPERTIES] Updated property: ${property.id} value: ${property.value?.value}',
      );
    }

    notifyListeners();

    return true;
  }

  bool _valueToBoolean(dynamic value) {
    if (value is bool) {
      return value;
    }

    if (value is String) {
      return value.toLowerCase() == 'true' || value == '1';
    }

    if (value is num) {
      return value != 0;
    }

    throw ArgumentError('Cannot convert value to boolean: $value');
  }

  num _valueToNumber(dynamic value) {
    if (value is num) {
      return value;
    }

    if (value is String) {
      final parsedValue = num.tryParse(value);

      if (parsedValue != null) {
        return parsedValue;
      }
    }

    throw ArgumentError('Cannot convert value to number: $value');
  }

  Future<void> fetchProperty(
    String id,
    String channelId,
  ) async {
    return handleApiCall(
      () async {
        final response = await apiClient.getDevicesModuleChannelProperty(
          channelId: channelId,
          id: id,
        );

        insertProperties(channelId, [response.data.data]);
      },
      'fetch channel property',
    );
  }

  Future<void> fetchProperties(
    String channelId,
  ) async {
    return handleApiCall(
      () async {
        final response = await apiClient.getDevicesModuleChannelProperties(
          channelId: channelId,
        );

        insertProperties(channelId, response.data.data);
      },
      'fetch channel properties',
    );
  }
}
