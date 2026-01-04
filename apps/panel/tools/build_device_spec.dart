import 'dart:convert';
import 'dart:io';

void main() async {
  final inputFile = File(Platform.script
      .resolve('../../../spec/devices/devices.json')
      .toFilePath());
  final outputPath =
      Platform.script.resolve('../lib/spec/device_spec.g.dart').toFilePath();
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
      'import \'package:fastybird_smart_panel/api/models/devices_module_channel_category.dart\';');
  buffer.writeln(
      'import \'package:fastybird_smart_panel/api/models/devices_module_device_category.dart\';\n');

  // ChannelConstraintType enum
  buffer.writeln('/// Type of channel constraint');
  buffer.writeln('enum ChannelConstraintType {');
  buffer.writeln('  /// Exactly one channel from each group can be present');
  buffer.writeln('  oneOf,');
  buffer.writeln('  /// At least one channel from each group must be present');
  buffer.writeln('  oneOrMoreOf,');
  buffer.writeln(
      '  /// Channel groups that cannot be mixed (e.g., outlet vs switcher)');
  buffer.writeln('  mutuallyExclusive,');
  buffer.writeln('}\n');

  // ChannelConstraint class
  buffer.writeln('/// A constraint defining relationships between channels');
  buffer.writeln('class ChannelConstraint {');
  buffer.writeln('  final ChannelConstraintType type;');
  buffer.writeln('  final List<List<DevicesModuleChannelCategory>> groups;\n');
  buffer.writeln('  const ChannelConstraint({');
  buffer.writeln('    required this.type,');
  buffer.writeln('    required this.groups,');
  buffer.writeln('  });');
  buffer.writeln('}\n');

  // DeviceChannelsSpecification class
  buffer.writeln('class DeviceChannelsSpecification {');
  buffer.writeln('  final List<DevicesModuleChannelCategory> required;');
  buffer.writeln('  final List<DevicesModuleChannelCategory> optional;');
  buffer.writeln('  final List<ChannelConstraint> constraints;\n');
  buffer.writeln('  const DeviceChannelsSpecification({');
  buffer.writeln('    required this.required,');
  buffer.writeln('    required this.optional,');
  buffer.writeln('    this.constraints = const [],');
  buffer.writeln('  });\n');
  buffer.writeln('  List<DevicesModuleChannelCategory> get all => [');
  buffer.writeln('        ...required,');
  buffer.writeln('        ...optional,');
  buffer.writeln('      ];');
  buffer.writeln('}\n');

  buffer.writeln(
      'const Map<DevicesModuleDeviceCategory, DeviceChannelsSpecification> deviceChannelsSpecificationMappers = {');

  for (final entry in json.entries) {
    final category = entry.key;
    final categoryData = entry.value as Map<String, dynamic>;

    final channels =
        (categoryData['channels'] as Map<String, dynamic>? ?? {});
    final constraintsData =
        categoryData['constraints'] as Map<String, dynamic>?;

    final required = <String>[];
    final optional = <String>[];

    for (final channel in channels.values) {
      final isRequired = channel['required'] == true;
      final channelCategory = channel['category'];
      if (channelCategory != null) {
        (isRequired ? required : optional)
            .add('DevicesModuleChannelCategory.${_camelToEnum(channelCategory)}');
      }
    }

    // Parse constraints
    final constraints = <String>[];

    if (constraintsData != null) {
      // oneOf constraints
      if (constraintsData['oneOf'] != null) {
        final oneOfGroups = constraintsData['oneOf'] as List<dynamic>;
        for (final group in oneOfGroups) {
          final channels = (group as List<dynamic>)
              .map((c) => 'DevicesModuleChannelCategory.${_camelToEnum(c as String)}')
              .toList();
          constraints.add(
              'ChannelConstraint(type: ChannelConstraintType.oneOf, groups: [[${channels.join(', ')}]])');
        }
      }

      // oneOrMoreOf constraints
      if (constraintsData['oneOrMoreOf'] != null) {
        final oneOrMoreOfGroups =
            constraintsData['oneOrMoreOf'] as List<dynamic>;
        for (final group in oneOrMoreOfGroups) {
          final channels = (group as List<dynamic>)
              .map((c) => 'DevicesModuleChannelCategory.${_camelToEnum(c as String)}')
              .toList();
          constraints.add(
              'ChannelConstraint(type: ChannelConstraintType.oneOrMoreOf, groups: [[${channels.join(', ')}]])');
        }
      }

      // mutuallyExclusiveGroups constraints
      if (constraintsData['mutuallyExclusiveGroups'] != null) {
        final exclusiveGroups =
            constraintsData['mutuallyExclusiveGroups'] as List<dynamic>;
        for (final groupPair in exclusiveGroups) {
          final groups = (groupPair as List<dynamic>).map((group) {
            final channels = (group as List<dynamic>)
                .map((c) => 'DevicesModuleChannelCategory.${_camelToEnum(c as String)}')
                .toList();
            return '[${channels.join(', ')}]';
          }).toList();
          constraints.add(
              'ChannelConstraint(type: ChannelConstraintType.mutuallyExclusive, groups: [${groups.join(', ')}])');
        }
      }
    }

    buffer.writeln(
        '  DevicesModuleDeviceCategory.${_camelToEnum(category)}: DeviceChannelsSpecification(');
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

  buffer
      .writeln('DeviceChannelsSpecification buildDeviceChannelsSpecification(');
  buffer.writeln('  DevicesModuleDeviceCategory category,');
  buffer.writeln(') {');
  buffer.writeln('  return deviceChannelsSpecificationMappers[category] ??');
  buffer.writeln('      const DeviceChannelsSpecification(');
  buffer.writeln('        required: [],');
  buffer.writeln('        optional: [],');
  buffer.writeln('      );');
  buffer.writeln('}');

  await outputFile.writeAsString(buffer.toString());

  // ignore: avoid_print
  print('✅ Generated device specification to: ${outputFile.path}');
}

String _camelToEnum(String input) => input.replaceAllMapped(
      RegExp(r'_([a-z])'),
      (m) => m.group(1)!.toUpperCase(),
    );
