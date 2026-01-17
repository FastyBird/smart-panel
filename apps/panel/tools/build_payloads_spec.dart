import 'dart:convert';
import 'dart:io';

void main() async {
  final inputFile = File(Platform.script
      .resolve('../../../spec/devices/channels.json')
      .toFilePath());
  final outputPath =
      Platform.script.resolve('../lib/spec/channels_properties_payloads_spec.g.dart').toFilePath();
  final outputFile = File(outputPath);

  if (!await inputFile.exists()) {
    // ignore: avoid_print
    print('🚫 Spec file not found: ${inputFile.path}');

    return;
  }

  // Ensure the directory exists
  await Directory(outputFile.parent.path).create(recursive: true);

  final json =
      jsonDecode(await inputFile.readAsString()) as Map<String, dynamic>;

  // Collect all enum definitions
  // Key: enum name, Value: list of format values
  final Map<String, List<String>> enums = {};

  for (final channelEntry in json.entries) {
    final channelCategory = channelEntry.key;
    final channelData = channelEntry.value as Map<String, dynamic>;
    final properties =
        (channelData['properties'] as Map<String, dynamic>?) ?? {};

    for (final propertyEntry in properties.entries) {
      final propertyCategory = propertyEntry.key;
      final propertyData = propertyEntry.value as Map<String, dynamic>;

      // Check direct data_type enum
      if (propertyData['data_type'] == 'enum') {
        final format = propertyData['format'];
        // Skip if format is null or not a list of strings
        if (format is List && format.isNotEmpty && format.first is String) {
          final enumName = _generateEnumName(channelCategory, propertyCategory);
          final values = format.cast<String>().toList();
          _addEnum(enums, enumName, values);
        }
      }

      // Check data_types array for enum types
      final dataTypes = propertyData['data_types'];
      if (dataTypes is List) {
        for (final dataType in dataTypes) {
          if (dataType is Map<String, dynamic> &&
              dataType['data_type'] == 'enum') {
            final format = dataType['format'];
            if (format is List && format.isNotEmpty && format.first is String) {
              final dataTypeId = dataType['id'] as String?;
              final enumName = _generateEnumName(
                channelCategory,
                propertyCategory,
                dataTypeId: dataTypeId,
              );
              final values = format.cast<String>().toList();
              _addEnum(enums, enumName, values);
            }
          }
        }
      }
    }
  }

  // Sort enums alphabetically for consistent output
  final sortedEnumNames = enums.keys.toList()..sort();

  final buffer = StringBuffer();

  buffer.writeln('// GENERATED CODE - DO NOT MODIFY BY HAND');
  buffer.writeln('// ignore_for_file: constant_identifier_names');
  buffer.writeln();
  buffer.writeln(
      "import 'package:fastybird_smart_panel/core/utils/enum.dart';");
  buffer.writeln();

  for (final enumName in sortedEnumNames) {
    final values = enums[enumName]!;
    _writeEnum(buffer, enumName, values);
  }

  await outputFile.writeAsString(buffer.toString());

  // ignore: avoid_print
  print('✅ Generated ${enums.length} payload enums to: ${outputFile.path}');
}

/// Generates an enum name from channel and property categories
String _generateEnumName(
  String channelCategory,
  String propertyCategory, {
  String? dataTypeId,
}) {
  final channelPart = _snakeToPascalCase(channelCategory);
  final propertyPart = _snakeToPascalCase(propertyCategory);

  // For data_types with id, append the id to make it unique
  if (dataTypeId != null && dataTypeId != 'percentage' && dataTypeId != 'duration') {
    final dataTypePart = _snakeToPascalCase(dataTypeId);
    return '${channelPart}${propertyPart}${dataTypePart}Value';
  }

  return '$channelPart${propertyPart}Value';
}

/// Adds an enum to the collection, handling duplicates
void _addEnum(
    Map<String, List<String>> enums, String enumName, List<String> values) {
  if (enums.containsKey(enumName)) {
    // Check if values are identical
    final existing = enums[enumName]!;
    if (!_listEquals(existing, values)) {
      // If values differ, we need a unique name - this shouldn't happen often
      // ignore: avoid_print
      print(
          '⚠️  Warning: Duplicate enum name "$enumName" with different values');
    }
    return;
  }
  enums[enumName] = values;
}

/// Checks if two lists are equal
bool _listEquals(List<String> a, List<String> b) {
  if (a.length != b.length) return false;
  for (int i = 0; i < a.length; i++) {
    if (a[i] != b[i]) return false;
  }
  return true;
}

/// Converts snake_case to PascalCase
String _snakeToPascalCase(String input) {
  return input.split('_').map((part) {
    if (part.isEmpty) return part;
    return part[0].toUpperCase() + part.substring(1);
  }).join();
}

/// Converts a string value to a valid Dart enum identifier
String _valueToIdentifier(String value) {
  // Handle special cases - values starting with numbers
  if (value.isNotEmpty && RegExp(r'^[0-9]').hasMatch(value)) {
    // Prefix with 'value' for numeric-starting values
    // e.g., "1_hour" -> "value1Hour", "30m" -> "value30m"
    final camelCased = _snakeToCamelCase(value);
    return 'value$camelCased';
  }

  // Convert snake_case to camelCase
  return _snakeToCamelCase(value);
}

/// Converts snake_case to camelCase
String _snakeToCamelCase(String input) {
  final parts = input.split('_');
  if (parts.isEmpty) return input;

  final firstPart = parts.first;
  final restParts = parts.skip(1).map((part) {
    if (part.isEmpty) return part;
    return part[0].toUpperCase() + part.substring(1);
  });

  return firstPart + restParts.join();
}

/// Writes an enum definition to the buffer
void _writeEnum(StringBuffer buffer, String enumName, List<String> values) {
  buffer.writeln('enum $enumName {');

  for (int i = 0; i < values.length; i++) {
    final value = values[i];
    final identifier = _valueToIdentifier(value);
    final suffix = i < values.length - 1 ? ',' : ';';
    buffer.writeln("  $identifier('$value')$suffix");
  }

  buffer.writeln();
  buffer.writeln('  final String value;');
  buffer.writeln();
  buffer.writeln('  const $enumName(this.value);');
  buffer.writeln();
  buffer.writeln('  static final utils = StringEnumUtils(');
  buffer.writeln('    $enumName.values,');
  buffer.writeln('    ($enumName payload) => payload.value,');
  buffer.writeln('  );');
  buffer.writeln();
  buffer.writeln(
      '  static $enumName? fromValue(String value) => utils.fromValue(value);');
  buffer.writeln();
  buffer.writeln(
      '  static bool contains(String value) => utils.contains(value);');
  buffer.writeln('}');
  buffer.writeln();
}
