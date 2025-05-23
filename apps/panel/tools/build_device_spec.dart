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
  buffer.writeln('class DeviceChannelsSpecification {');
  buffer.writeln('  final List<ChannelCategory> required;');
  buffer.writeln('  final List<ChannelCategory> optional;\n');
  buffer.writeln('  const DeviceChannelsSpecification({');
  buffer.writeln('    required this.required,');
  buffer.writeln('    required this.optional,');
  buffer.writeln('  });\n');
  buffer.writeln('  List<ChannelCategory> get all => [');
  buffer.writeln('        ...required,');
  buffer.writeln('        ...optional,');
  buffer.writeln('      ];');
  buffer.writeln('}\n');
  buffer.writeln(
      'const Map<DeviceCategory, DeviceChannelsSpecification> deviceChannelsSpecificationMappers = {');

  for (final entry in json.entries) {
    final category = entry.key;
    final categoryData = entry.value as Map<String, dynamic>;

    final channels = (categoryData['channels'] as Map<String, dynamic>? ?? {});

    final required = <String>[];
    final optional = <String>[];

    for (final channel in channels.values) {
      final isRequired = channel['required'] == true;
      final category = channel['category'];
      if (category != null) {
        (isRequired ? required : optional)
            .add('ChannelCategory.${_camelToEnum(category)}');
      }
    }

    buffer.writeln(
        '  DeviceCategory.${_camelToEnum(category)}: DeviceChannelsSpecification(');
    buffer.writeln('    required: [${required.join(', ')}],');
    buffer.writeln('    optional: [${optional.join(', ')}],');
    buffer.writeln('  ),');
  }

  buffer.writeln('};\n');

  buffer
      .writeln('DeviceChannelsSpecification buildDeviceChannelsSpecification(');
  buffer.writeln('  DeviceCategory category,');
  buffer.writeln(') {');
  buffer.writeln('  return deviceChannelsSpecificationMappers[category] ??');
  buffer.writeln('      DeviceChannelsSpecification(');
  buffer.writeln('        required: [],');
  buffer.writeln('        optional: [],');
  buffer.writeln('      );');
  buffer.writeln('}');

  await outputFile.writeAsString(buffer.toString());

  print('✅ Generated device specification to: ${outputFile.path}');
}

String _camelToEnum(String input) => input.replaceAllMapped(
    RegExp(r'_([a-z])'), (m) => m.group(1)!.toUpperCase());
