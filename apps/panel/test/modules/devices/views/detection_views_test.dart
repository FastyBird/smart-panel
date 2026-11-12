import 'package:fastybird_smart_panel/api/models/devices_module_channel_category.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_device_category.dart';
import 'package:fastybird_smart_panel/api/models/devices_module_property_category.dart';
import 'package:fastybird_smart_panel/modules/devices/types/value_state.dart';
import 'package:fastybird_smart_panel/modules/devices/types/values.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/camera.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/object_detection.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/sound_detection.dart';
import 'package:fastybird_smart_panel/modules/devices/views/channels/view.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/camera.dart';
import 'package:fastybird_smart_panel/modules/devices/views/devices/doorbell.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/detected.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/object_type.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/sound_type.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/source.dart';
import 'package:fastybird_smart_panel/modules/devices/views/properties/status.dart';
import 'package:flutter_test/flutter_test.dart';

DetectedChannelPropertyView _detected(String channel, bool? value) =>
    DetectedChannelPropertyView(
      id: '$channel-detected',
      type: 'detected',
      category: DevicesModulePropertyCategory.detected,
      channel: channel,
      valueState: value == null ? null : PropertyValueState(value: BooleanValueType(value)),
    );

ObjectDetectionChannelView buildObjectDetectionView({
  required bool? detected,
  required String objectType,
  String id = 'od-1',
}) {
  return ObjectDetectionChannelView(
    id: id,
    type: 'object_detection',
    category: DevicesModuleChannelCategory.objectDetection,
    device: 'd1',
    properties: [
      _detected(id, detected),
      ObjectTypeChannelPropertyView(
        id: '$id-type',
        type: 'object_type',
        category: DevicesModulePropertyCategory.objectType,
        channel: id,
        valueState: PropertyValueState(value: StringValueType(objectType)),
      ),
    ],
  );
}

SoundDetectionChannelView buildSoundDetectionView({
  required bool? detected,
  required String soundType,
}) {
  return SoundDetectionChannelView(
    id: 'sd-1',
    type: 'sound_detection',
    category: DevicesModuleChannelCategory.soundDetection,
    device: 'd1',
    properties: [
      _detected('sd-1', detected),
      SoundTypeChannelPropertyView(
        id: 'sd-1-type',
        type: 'sound_type',
        category: DevicesModulePropertyCategory.soundType,
        channel: 'sd-1',
        valueState: PropertyValueState(value: StringValueType(soundType)),
      ),
    ],
  );
}

CameraChannelView _camera(String identifier) {
  final id = 'cam-$identifier';
  return CameraChannelView(
    id: id,
    type: 'camera',
    category: DevicesModuleChannelCategory.camera,
    device: 'd1',
    properties: [
      StatusChannelPropertyView(
        id: '$id-status',
        type: 'status',
        category: DevicesModulePropertyCategory.status,
        channel: id,
        valueState: PropertyValueState(value: StringValueType('available')),
      ),
      SourceChannelPropertyView(
        id: '$id-source',
        type: 'source',
        category: DevicesModulePropertyCategory.source,
        channel: id,
        valueState: PropertyValueState(value: StringValueType('rtsp://example')),
      ),
    ],
  )..identifier = identifier;
}

CameraDeviceView buildCameraView({
  List<String> cameraChannelIdentifiers = const ['main'],
  List<String> objectTypes = const [],
}) {
  return CameraDeviceView(
    id: 'dev-1',
    type: 'test',
    category: DevicesModuleDeviceCategory.camera,
    name: 'Camera',
    channels: <ChannelView>[
      ...cameraChannelIdentifiers.map(_camera),
      ...objectTypes.indexed.map(
        (e) => buildObjectDetectionView(detected: false, objectType: e.$2, id: 'od-${e.$1}'),
      ),
    ],
  );
}

DoorbellDeviceView buildDoorbellView({required List<String> cameraChannelIdentifiers}) {
  return DoorbellDeviceView(
    id: 'dev-2',
    type: 'test',
    category: DevicesModuleDeviceCategory.doorbell,
    name: 'Doorbell',
    channels: <ChannelView>[...cameraChannelIdentifiers.map(_camera)],
  );
}

void main() {
  group('Detection channel views', () {
    test('object detection view exposes detected and type', () {
      final view = buildObjectDetectionView(detected: true, objectType: 'person');
      expect(view.detected, isTrue);
      expect(view.objectType, 'person');
    });

    test('a missing detected value reads as not detected', () {
      expect(buildObjectDetectionView(detected: null, objectType: 'animal').detected, isFalse);
    });

    test('sound detection view exposes detected and type', () {
      final view = buildSoundDetectionView(detected: true, soundType: 'glass_break');
      expect(view.detected, isTrue);
      expect(view.soundType, 'glass_break');
    });
  });

  group('Camera device views with several channels', () {
    test('cameraChannel prefers the main channel over the package channel', () {
      final device = buildDoorbellView(cameraChannelIdentifiers: ['camera.package', 'camera.main']);
      expect(device.cameraChannel!.identifier, 'camera.main');
      expect(device.cameraChannels, hasLength(2));
    });

    test('cameraChannel falls back to the first channel when none is named main', () {
      final device = buildCameraView(cameraChannelIdentifiers: ['front']);
      expect(device.cameraChannel.identifier, 'front');
    });

    test('a camera lists every object detection channel', () {
      final device = buildCameraView(objectTypes: ['person', 'vehicle', 'animal']);
      expect(device.objectDetectionChannels.map((c) => c.objectType), ['person', 'vehicle', 'animal']);
    });
  });
}
