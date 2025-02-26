import 'dart:convert';

import 'package:fastybird_smart_panel/modules/devices/models/properties.dart';
import 'package:fastybird_smart_panel/modules/devices/repositories/repository.dart';
import 'package:fastybird_smart_panel/modules/devices/types/data_types.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:flutter/foundation.dart';

class ChannelPropertiesRepository extends Repository<ChannelPropertyModel> {
  ChannelPropertiesRepository({
    required super.apiClient,
  });

  void insert(List<Map<String, dynamic>> json) {
    late Map<String, ChannelPropertyModel> insertData = {...data};

    for (var row in json) {
      try {
        ChannelPropertyModel property = ChannelPropertyModel.fromJson(row);

        insertData[property.id] = property;
      } catch (e) {
        if (kDebugMode) {
          debugPrint(
            '[DEVICES MODULE][CHANNELS PROPERTIES] Failed to create property model: ${e.toString()}',
          );
        }

        /// Failed to create new model
      }
    }

    if (!mapEquals(data, insertData)) {
      data = insertData;

      notifyListeners();
    }
  }

  void delete(String id) {
    if (data.containsKey(id) && data.remove(id) != null) {
      if (kDebugMode) {
        debugPrint(
          '[DEVICES MODULE][CHANNELS PROPERTIES] Removed property: $id',
        );
      }

      notifyListeners();
    }
  }

  Future<bool> toggleValue(String id) async {
    final ChannelPropertyModel? property = getItem(id);

    if (property == null) {
      return false;
    }

    if (property.dataType != DataType.boolean) {
      debugPrint(
        '[DEVICES MODULE][CHANNEL PROPERTIES] Only boolean values could be toggled',
      );
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
    String channelId,
    String id,
  ) async {
    return handleApiCall(
      () async {
        final response = await apiClient.getDevicesModuleChannelProperty(
          channelId: channelId,
          id: id,
        );

        insert([jsonDecode(jsonEncode(response.data.data))]);
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

        List<Map<String, dynamic>> properties = [];

        for (var property in response.data.data) {
          properties.add(jsonDecode(jsonEncode(property)));
        }

        insert(properties);
      },
      'fetch channel properties',
    );
  }
}
