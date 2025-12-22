import 'dart:convert';
import 'dart:io';

void main() async {
  final inputFile = File(Platform.script
      .resolve('../../../spec/devices/channels.json')
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

  final json =
      jsonDecode(await inputFile.readAsString()) as Map<String, dynamic>;

  final buffer = StringBuffer();

  buffer.writeln('// GENERATED CODE - DO NOT MODIFY BY HAND');
  buffer.writeln('// ignore_for_file: constant_identifier_names\n');
  buffer.writeln();
  buffer.writeln(
      'import \'package:fastybird_smart_panel/modules/devices/types/categories.dart\';\n');

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
  buffer.writeln('  final List<List<ChannelPropertyCategory>> groups;\n');
  buffer.writeln('  const PropertyConstraint({');
  buffer.writeln('    required this.type,');
  buffer.writeln('    required this.groups,');
  buffer.writeln('  });');
  buffer.writeln('}\n');

  // ChannelPropertiesSpecification class
  buffer.writeln('class ChannelPropertiesSpecification {');
  buffer.writeln('  final List<ChannelPropertyCategory> required;');
  buffer.writeln('  final List<ChannelPropertyCategory> optional;');
  buffer.writeln('  final List<PropertyConstraint> constraints;\n');
  buffer.writeln('  const ChannelPropertiesSpecification({');
  buffer.writeln('    required this.required,');
  buffer.writeln('    required this.optional,');
  buffer.writeln('    this.constraints = const [],');
  buffer.writeln('  });\n');
  buffer.writeln('  List<ChannelPropertyCategory> get all => [');
  buffer.writeln('        ...required,');
  buffer.writeln('        ...optional,');
  buffer.writeln('      ];');
  buffer.writeln('}\n');

  buffer.writeln(
      'const Map<ChannelCategory, ChannelPropertiesSpecification> channelPropertiesSpecificationMappers = {');

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
            .add('ChannelPropertyCategory.${_camelToEnum(propCategory)}');
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
              .map((p) => 'ChannelPropertyCategory.${_camelToEnum(p as String)}')
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
              .map((p) => 'ChannelPropertyCategory.${_camelToEnum(p as String)}')
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
                    (p) => 'ChannelPropertyCategory.${_camelToEnum(p as String)}')
                .toList();
            return '[${props.join(', ')}]';
          }).toList();
          constraints.add(
              'PropertyConstraint(type: PropertyConstraintType.mutuallyExclusive, groups: [${groups.join(', ')}])');
        }
      }
    }

    buffer.writeln(
        '  ChannelCategory.${_camelToEnum(category)}: ChannelPropertiesSpecification(');
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
  buffer.writeln('  ChannelCategory category,');
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
