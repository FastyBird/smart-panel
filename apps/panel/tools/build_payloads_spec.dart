import 'dart:io';

import 'package:yaml/yaml.dart';

void main() async {
  final inputFile = File(Platform.script
      .resolve('../../../spec/devices/channels.yaml')
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

  final yamlContent = await inputFile.readAsString();
  final yamlData = loadYaml(yamlContent) as YamlMap;
  final json = _yamlToMap(yamlData);

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
        // Skip if format is null or not a list of all strings
        if (format is List &&
            format.isNotEmpty &&
            format.every((item) => item is String)) {
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
            if (format is List &&
                format.isNotEmpty &&
                format.every((item) => item is String)) {
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
    return '$channelPart$propertyPart${dataTypePart}Value';
  }

  return '$channelPart${propertyPart}Value';
}

/// Adds an enum to the collection, handling duplicates by generating unique names
void _addEnum(
    Map<String, List<String>> enums, String enumName, List<String> values) {
  if (enums.containsKey(enumName)) {
    // Check if values are identical
    final existing = enums[enumName]!;
    if (_listEquals(existing, values)) {
      // Same values, skip duplicate
      return;
    }
    // Values differ - generate a unique name with numeric suffix
    var uniqueName = enumName;
    var counter = 2;
    while (enums.containsKey(uniqueName)) {
      uniqueName = '$enumName$counter';
      counter++;
    }
    // ignore: avoid_print
    print(
        '⚠️  Warning: Duplicate enum name "$enumName" with different values, using "$uniqueName"');
    enums[uniqueName] = values;
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

/// Dart reserved keywords that cannot be used as identifiers
const _dartReservedKeywords = {
  'abstract', 'as', 'assert', 'async', 'await', 'break', 'case', 'catch',
  'class', 'const', 'continue', 'covariant', 'default', 'deferred', 'do',
  'dynamic', 'else', 'enum', 'export', 'extends', 'extension', 'external',
  'factory', 'false', 'final', 'finally', 'for', 'Function', 'get', 'hide',
  'if', 'implements', 'import', 'in', 'interface', 'is', 'late', 'library',
  'mixin', 'new', 'null', 'on', 'operator', 'part', 'required', 'rethrow',
  'return', 'set', 'show', 'static', 'super', 'switch', 'sync', 'this',
  'throw', 'true', 'try', 'typedef', 'var', 'void', 'while', 'with', 'yield',
};

/// Converts a string value to a valid Dart enum identifier
String _valueToIdentifier(String value) {
  // First, sanitize the value by replacing invalid characters
  // Replace hyphens, dots, spaces, and other non-alphanumeric chars with underscores
  var sanitized = value.replaceAll(RegExp(r'[^a-zA-Z0-9_]'), '_');

  // Remove consecutive underscores and trim leading/trailing underscores
  sanitized = sanitized
      .replaceAll(RegExp(r'_+'), '_')
      .replaceAll(RegExp(r'^_+|_+$'), '');

  // If empty after sanitization, use a default
  if (sanitized.isEmpty) {
    sanitized = 'value';
  }

  // Convert to camelCase
  var identifier = _snakeToCamelCase(sanitized);

  // Handle values starting with numbers - prefix with 'value'
  if (identifier.isNotEmpty && RegExp(r'^[0-9]').hasMatch(identifier)) {
    identifier = 'value${identifier[0].toUpperCase()}${identifier.substring(1)}';
  }

  // Handle Dart reserved keywords by adding a suffix
  if (_dartReservedKeywords.contains(identifier)) {
    identifier = '${identifier}Value';
  }

  return identifier;
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

/// Escapes special characters in a string for use in a Dart single-quoted string literal
String _escapeStringLiteral(String value) {
  return value
      .replaceAll(r'\', r'\\')  // Escape backslashes first
      .replaceAll("'", r"\'")    // Escape single quotes
      .replaceAll(r'$', r'\$');  // Escape dollar signs
}

/// Writes an enum definition to the buffer
void _writeEnum(StringBuffer buffer, String enumName, List<String> values) {
  buffer.writeln('enum $enumName {');

  // Track used identifiers to detect collisions
  final usedIdentifiers = <String, String>{}; // identifier -> original value

  for (int i = 0; i < values.length; i++) {
    final value = values[i];
    var identifier = _valueToIdentifier(value);

    // Check for identifier collision within this enum
    if (usedIdentifiers.containsKey(identifier)) {
      final originalValue = usedIdentifiers[identifier]!;
      // ignore: avoid_print
      print(
          '⚠️  Warning: In enum "$enumName", values "$originalValue" and "$value" '
          'both normalize to identifier "$identifier"');
      // Generate a unique identifier by appending a counter
      var counter = 2;
      var uniqueIdentifier = '$identifier$counter';
      while (usedIdentifiers.containsKey(uniqueIdentifier)) {
        counter++;
        uniqueIdentifier = '$identifier$counter';
      }
      identifier = uniqueIdentifier;
    }
    usedIdentifiers[identifier] = value;

    final escapedValue = _escapeStringLiteral(value);
    final suffix = i < values.length - 1 ? ',' : ';';
    buffer.writeln("  $identifier('$escapedValue')$suffix");
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

/// Converts YamlMap to regular `Map<String, dynamic>`
Map<String, dynamic> _yamlToMap(YamlMap yamlMap) {
  final result = <String, dynamic>{};
  for (final entry in yamlMap.entries) {
    final key = entry.key.toString();
    final value = entry.value;
    result[key] = _convertYamlValue(value);
  }
  return result;
}

/// Converts YAML values to Dart types
dynamic _convertYamlValue(dynamic value) {
  if (value is YamlMap) {
    return _yamlToMap(value);
  } else if (value is YamlList) {
    return value.map(_convertYamlValue).toList();
  } else {
    return value;
  }
}
