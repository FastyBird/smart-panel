import 'dart:io';

import 'package:yaml/yaml.dart';

void main() async {
  final inputFile = File(Platform.script
      .resolve('../../../spec/devices/channels.yaml')
      .toFilePath());
  final outputPath =
      Platform.script.resolve('../lib/spec/channel_spec.g.dart').toFilePath();
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

  final buffer = StringBuffer();

  buffer.writeln('// GENERATED CODE - DO NOT MODIFY BY HAND');
  buffer.writeln('// ignore_for_file: constant_identifier_names\n');
  buffer.writeln();
  buffer.writeln(
      'import \'package:fastybird_smart_panel/api/models/devices_module_channel_category.dart\';');
  buffer.writeln(
      'import \'package:fastybird_smart_panel/api/models/devices_module_property_category.dart\';\n');

  // PropertyConstraintType enum
  buffer.writeln('/// Type of property constraint');
  buffer.writeln('enum PropertyConstraintType {');
  buffer.writeln('  /// Exactly one property from each group can be present');
  buffer.writeln('  oneOf,');
  buffer.writeln('  /// At least one property from each group must be present');
  buffer.writeln('  oneOrMoreOf,');
  buffer.writeln(
      '  /// Property groups that cannot be mixed (e.g., RGB vs HSV)');
  buffer.writeln('  mutuallyExclusive,');
  buffer.writeln('}\n');

  // PropertyConstraint class
  buffer.writeln('/// A constraint defining relationships between properties');
  buffer.writeln('class PropertyConstraint {');
  buffer.writeln('  final PropertyConstraintType type;');
  buffer.writeln('  final List<List<DevicesModulePropertyCategory>> groups;\n');
  buffer.writeln('  const PropertyConstraint({');
  buffer.writeln('    required this.type,');
  buffer.writeln('    required this.groups,');
  buffer.writeln('  });');
  buffer.writeln('}\n');

  // ChannelPropertiesSpecification class
  buffer.writeln('class ChannelPropertiesSpecification {');
  buffer.writeln('  final List<DevicesModulePropertyCategory> required;');
  buffer.writeln('  final List<DevicesModulePropertyCategory> optional;');
  buffer.writeln('  final List<PropertyConstraint> constraints;\n');
  buffer.writeln('  const ChannelPropertiesSpecification({');
  buffer.writeln('    required this.required,');
  buffer.writeln('    required this.optional,');
  buffer.writeln('    this.constraints = const [],');
  buffer.writeln('  });\n');
  buffer.writeln('  List<DevicesModulePropertyCategory> get all => [');
  buffer.writeln('        ...required,');
  buffer.writeln('        ...optional,');
  buffer.writeln('      ];');
  buffer.writeln('}\n');

  buffer.writeln(
      'const Map<DevicesModuleChannelCategory, ChannelPropertiesSpecification> channelPropertiesSpecificationMappers = {');

  for (final entry in json.entries) {
    final category = entry.key;
    final categoryData = entry.value as Map<String, dynamic>;

    final properties =
        (categoryData['properties'] as Map<String, dynamic>? ?? {});
    final constraintsData =
        categoryData['constraints'] as Map<String, dynamic>?;

    final required = <String>[];
    final optional = <String>[];

    for (final property in properties.values) {
      final isRequired = property['required'] == true;
      final propCategory = property['category'];

      if (propCategory != null) {
        (isRequired ? required : optional)
            .add('DevicesModulePropertyCategory.${_camelToEnumWithOn(propCategory)}');
      }
    }

    // Parse constraints
    final constraints = <String>[];

    if (constraintsData != null) {
      // oneOf constraints
      if (constraintsData['oneOf'] != null) {
        final oneOfGroups = constraintsData['oneOf'] as List<dynamic>;
        for (final group in oneOfGroups) {
          final props = (group as List<dynamic>)
              .map((p) => 'DevicesModulePropertyCategory.${_camelToEnumWithOn(p as String)}')
              .toList();
          constraints.add(
              'PropertyConstraint(type: PropertyConstraintType.oneOf, groups: [[${props.join(', ')}]])');
        }
      }

      // oneOrMoreOf constraints
      if (constraintsData['oneOrMoreOf'] != null) {
        final oneOrMoreOfGroups =
            constraintsData['oneOrMoreOf'] as List<dynamic>;
        for (final group in oneOrMoreOfGroups) {
          final props = (group as List<dynamic>)
              .map((p) => 'DevicesModulePropertyCategory.${_camelToEnumWithOn(p as String)}')
              .toList();
          constraints.add(
              'PropertyConstraint(type: PropertyConstraintType.oneOrMoreOf, groups: [[${props.join(', ')}]])');
        }
      }

      // mutuallyExclusiveGroups constraints
      if (constraintsData['mutuallyExclusiveGroups'] != null) {
        final exclusiveGroups =
            constraintsData['mutuallyExclusiveGroups'] as List<dynamic>;
        for (final groupPair in exclusiveGroups) {
          final groups = (groupPair as List<dynamic>).map((group) {
            final props = (group as List<dynamic>)
                .map(
                    (p) => 'DevicesModulePropertyCategory.${_camelToEnumWithOn(p as String)}')
                .toList();
            return '[${props.join(', ')}]';
          }).toList();
          constraints.add(
              'PropertyConstraint(type: PropertyConstraintType.mutuallyExclusive, groups: [${groups.join(', ')}])');
        }
      }
    }

    buffer.writeln(
        '  DevicesModuleChannelCategory.${_camelToEnum(category)}: ChannelPropertiesSpecification(');
    buffer.writeln('    required: [${required.join(', ')}],');
    buffer.writeln('    optional: [${optional.join(', ')}],');
    if (constraints.isNotEmpty) {
      buffer.writeln('    constraints: [');
      for (final constraint in constraints) {
        buffer.writeln('      $constraint,');
      }
      buffer.writeln('    ],');
    }
    buffer.writeln('  ),');
  }

  buffer.writeln('};\n');

  buffer.writeln(
      'ChannelPropertiesSpecification buildChannelPropertiesSpecification(');
  buffer.writeln('  DevicesModuleChannelCategory category,');
  buffer.writeln(') {');
  buffer.writeln('  return channelPropertiesSpecificationMappers[category] ??');
  buffer.writeln('      const ChannelPropertiesSpecification(');
  buffer.writeln('        required: [],');
  buffer.writeln('        optional: [],');
  buffer.writeln('      );');
  buffer.writeln('}');

  await outputFile.writeAsString(buffer.toString());

  // ignore: avoid_print
  print('✅ Generated channel specification to: ${outputFile.path}');
}

String _camelToEnum(String input) => input.replaceAllMapped(
    RegExp(r'_([a-z])'), (m) => m.group(1)!.toUpperCase());

/// Converts snake_case to camelCase with special handling for 'on' keyword
/// which is renamed to 'valueOn' in the generated API code
String _camelToEnumWithOn(String input) {
  final result = _camelToEnum(input);
  // 'on' is a Dart keyword, so it's renamed to 'valueOn' in generated code
  return result == 'on' ? 'valueOn' : result;
}

/// Converts YamlMap to regular Map<String, dynamic>
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
