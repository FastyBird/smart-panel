// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_home_assistant_plugin_create_home_assistant_device.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesHomeAssistantPluginCreateHomeAssistantDevice
    _$DevicesHomeAssistantPluginCreateHomeAssistantDeviceFromJson(
        Map<String, dynamic> json) {
  return _DevicesHomeAssistantPluginCreateHomeAssistantDevice.fromJson(json);
}

/// @nodoc
mixin _$DevicesHomeAssistantPluginCreateHomeAssistantDevice {
  /// Unique identifier for the device. Optional during creation and system-generated if not provided.
  String get id => throw _privateConstructorUsedError;

  /// Specifies the type of device.
  String get type => throw _privateConstructorUsedError;

  /// Type of the device, defining its purpose or category (e.g., thermostat, lighting).
  DevicesModuleDeviceCategory get category =>
      throw _privateConstructorUsedError;

  /// Human-readable name of the device.
  String get name => throw _privateConstructorUsedError;

  /// A list of controls associated with the device. Controls represent actions or commands that can be executed on the device.
  List<DevicesModuleCreateDeviceControl> get controls =>
      throw _privateConstructorUsedError;

  /// A list of channels associated with the device. Each channel represents a functional unit of the device, such as a sensor, actuator, or logical grouping of properties.
  List<DevicesModuleCreateDeviceChannel> get channels =>
      throw _privateConstructorUsedError;

  /// A HA device instance identifier.
  @JsonKey(name: 'ha_device_id')
  String get haDeviceId => throw _privateConstructorUsedError;

  /// Optional detailed description of the device.
  String? get description => throw _privateConstructorUsedError;

  /// Serializes this DevicesHomeAssistantPluginCreateHomeAssistantDevice to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesHomeAssistantPluginCreateHomeAssistantDevice
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesHomeAssistantPluginCreateHomeAssistantDeviceCopyWith<
          DevicesHomeAssistantPluginCreateHomeAssistantDevice>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesHomeAssistantPluginCreateHomeAssistantDeviceCopyWith<
    $Res> {
  factory $DevicesHomeAssistantPluginCreateHomeAssistantDeviceCopyWith(
          DevicesHomeAssistantPluginCreateHomeAssistantDevice value,
          $Res Function(DevicesHomeAssistantPluginCreateHomeAssistantDevice)
              then) =
      _$DevicesHomeAssistantPluginCreateHomeAssistantDeviceCopyWithImpl<$Res,
          DevicesHomeAssistantPluginCreateHomeAssistantDevice>;
  @useResult
  $Res call(
      {String id,
      String type,
      DevicesModuleDeviceCategory category,
      String name,
      List<DevicesModuleCreateDeviceControl> controls,
      List<DevicesModuleCreateDeviceChannel> channels,
      @JsonKey(name: 'ha_device_id') String haDeviceId,
      String? description});
}

/// @nodoc
class _$DevicesHomeAssistantPluginCreateHomeAssistantDeviceCopyWithImpl<$Res,
        $Val extends DevicesHomeAssistantPluginCreateHomeAssistantDevice>
    implements
        $DevicesHomeAssistantPluginCreateHomeAssistantDeviceCopyWith<$Res> {
  _$DevicesHomeAssistantPluginCreateHomeAssistantDeviceCopyWithImpl(
      this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesHomeAssistantPluginCreateHomeAssistantDevice
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? category = null,
    Object? name = null,
    Object? controls = null,
    Object? channels = null,
    Object? haDeviceId = null,
    Object? description = freezed,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      category: null == category
          ? _value.category
          : category // ignore: cast_nullable_to_non_nullable
              as DevicesModuleDeviceCategory,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      controls: null == controls
          ? _value.controls
          : controls // ignore: cast_nullable_to_non_nullable
              as List<DevicesModuleCreateDeviceControl>,
      channels: null == channels
          ? _value.channels
          : channels // ignore: cast_nullable_to_non_nullable
              as List<DevicesModuleCreateDeviceChannel>,
      haDeviceId: null == haDeviceId
          ? _value.haDeviceId
          : haDeviceId // ignore: cast_nullable_to_non_nullable
              as String,
      description: freezed == description
          ? _value.description
          : description // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DevicesHomeAssistantPluginCreateHomeAssistantDeviceImplCopyWith<
        $Res>
    implements
        $DevicesHomeAssistantPluginCreateHomeAssistantDeviceCopyWith<$Res> {
  factory _$$DevicesHomeAssistantPluginCreateHomeAssistantDeviceImplCopyWith(
          _$DevicesHomeAssistantPluginCreateHomeAssistantDeviceImpl value,
          $Res Function(
                  _$DevicesHomeAssistantPluginCreateHomeAssistantDeviceImpl)
              then) =
      __$$DevicesHomeAssistantPluginCreateHomeAssistantDeviceImplCopyWithImpl<
          $Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String type,
      DevicesModuleDeviceCategory category,
      String name,
      List<DevicesModuleCreateDeviceControl> controls,
      List<DevicesModuleCreateDeviceChannel> channels,
      @JsonKey(name: 'ha_device_id') String haDeviceId,
      String? description});
}

/// @nodoc
class __$$DevicesHomeAssistantPluginCreateHomeAssistantDeviceImplCopyWithImpl<
        $Res>
    extends _$DevicesHomeAssistantPluginCreateHomeAssistantDeviceCopyWithImpl<
        $Res, _$DevicesHomeAssistantPluginCreateHomeAssistantDeviceImpl>
    implements
        _$$DevicesHomeAssistantPluginCreateHomeAssistantDeviceImplCopyWith<
            $Res> {
  __$$DevicesHomeAssistantPluginCreateHomeAssistantDeviceImplCopyWithImpl(
      _$DevicesHomeAssistantPluginCreateHomeAssistantDeviceImpl _value,
      $Res Function(_$DevicesHomeAssistantPluginCreateHomeAssistantDeviceImpl)
          _then)
      : super(_value, _then);

  /// Create a copy of DevicesHomeAssistantPluginCreateHomeAssistantDevice
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? category = null,
    Object? name = null,
    Object? controls = null,
    Object? channels = null,
    Object? haDeviceId = null,
    Object? description = freezed,
  }) {
    return _then(_$DevicesHomeAssistantPluginCreateHomeAssistantDeviceImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      category: null == category
          ? _value.category
          : category // ignore: cast_nullable_to_non_nullable
              as DevicesModuleDeviceCategory,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      controls: null == controls
          ? _value._controls
          : controls // ignore: cast_nullable_to_non_nullable
              as List<DevicesModuleCreateDeviceControl>,
      channels: null == channels
          ? _value._channels
          : channels // ignore: cast_nullable_to_non_nullable
              as List<DevicesModuleCreateDeviceChannel>,
      haDeviceId: null == haDeviceId
          ? _value.haDeviceId
          : haDeviceId // ignore: cast_nullable_to_non_nullable
              as String,
      description: freezed == description
          ? _value.description
          : description // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DevicesHomeAssistantPluginCreateHomeAssistantDeviceImpl
    implements _DevicesHomeAssistantPluginCreateHomeAssistantDevice {
  const _$DevicesHomeAssistantPluginCreateHomeAssistantDeviceImpl(
      {required this.id,
      required this.type,
      required this.category,
      required this.name,
      required final List<DevicesModuleCreateDeviceControl> controls,
      required final List<DevicesModuleCreateDeviceChannel> channels,
      @JsonKey(name: 'ha_device_id') required this.haDeviceId,
      this.description})
      : _controls = controls,
        _channels = channels;

  factory _$DevicesHomeAssistantPluginCreateHomeAssistantDeviceImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DevicesHomeAssistantPluginCreateHomeAssistantDeviceImplFromJson(json);

  /// Unique identifier for the device. Optional during creation and system-generated if not provided.
  @override
  final String id;

  /// Specifies the type of device.
  @override
  final String type;

  /// Type of the device, defining its purpose or category (e.g., thermostat, lighting).
  @override
  final DevicesModuleDeviceCategory category;

  /// Human-readable name of the device.
  @override
  final String name;

  /// A list of controls associated with the device. Controls represent actions or commands that can be executed on the device.
  final List<DevicesModuleCreateDeviceControl> _controls;

  /// A list of controls associated with the device. Controls represent actions or commands that can be executed on the device.
  @override
  List<DevicesModuleCreateDeviceControl> get controls {
    if (_controls is EqualUnmodifiableListView) return _controls;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_controls);
  }

  /// A list of channels associated with the device. Each channel represents a functional unit of the device, such as a sensor, actuator, or logical grouping of properties.
  final List<DevicesModuleCreateDeviceChannel> _channels;

  /// A list of channels associated with the device. Each channel represents a functional unit of the device, such as a sensor, actuator, or logical grouping of properties.
  @override
  List<DevicesModuleCreateDeviceChannel> get channels {
    if (_channels is EqualUnmodifiableListView) return _channels;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_channels);
  }

  /// A HA device instance identifier.
  @override
  @JsonKey(name: 'ha_device_id')
  final String haDeviceId;

  /// Optional detailed description of the device.
  @override
  final String? description;

  @override
  String toString() {
    return 'DevicesHomeAssistantPluginCreateHomeAssistantDevice(id: $id, type: $type, category: $category, name: $name, controls: $controls, channels: $channels, haDeviceId: $haDeviceId, description: $description)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other
                is _$DevicesHomeAssistantPluginCreateHomeAssistantDeviceImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.category, category) ||
                other.category == category) &&
            (identical(other.name, name) || other.name == name) &&
            const DeepCollectionEquality().equals(other._controls, _controls) &&
            const DeepCollectionEquality().equals(other._channels, _channels) &&
            (identical(other.haDeviceId, haDeviceId) ||
                other.haDeviceId == haDeviceId) &&
            (identical(other.description, description) ||
                other.description == description));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      type,
      category,
      name,
      const DeepCollectionEquality().hash(_controls),
      const DeepCollectionEquality().hash(_channels),
      haDeviceId,
      description);

  /// Create a copy of DevicesHomeAssistantPluginCreateHomeAssistantDevice
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesHomeAssistantPluginCreateHomeAssistantDeviceImplCopyWith<
          _$DevicesHomeAssistantPluginCreateHomeAssistantDeviceImpl>
      get copyWith =>
          __$$DevicesHomeAssistantPluginCreateHomeAssistantDeviceImplCopyWithImpl<
                  _$DevicesHomeAssistantPluginCreateHomeAssistantDeviceImpl>(
              this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesHomeAssistantPluginCreateHomeAssistantDeviceImplToJson(
      this,
    );
  }
}

abstract class _DevicesHomeAssistantPluginCreateHomeAssistantDevice
    implements DevicesHomeAssistantPluginCreateHomeAssistantDevice {
  const factory _DevicesHomeAssistantPluginCreateHomeAssistantDevice(
          {required final String id,
          required final String type,
          required final DevicesModuleDeviceCategory category,
          required final String name,
          required final List<DevicesModuleCreateDeviceControl> controls,
          required final List<DevicesModuleCreateDeviceChannel> channels,
          @JsonKey(name: 'ha_device_id') required final String haDeviceId,
          final String? description}) =
      _$DevicesHomeAssistantPluginCreateHomeAssistantDeviceImpl;

  factory _DevicesHomeAssistantPluginCreateHomeAssistantDevice.fromJson(
          Map<String, dynamic> json) =
      _$DevicesHomeAssistantPluginCreateHomeAssistantDeviceImpl.fromJson;

  /// Unique identifier for the device. Optional during creation and system-generated if not provided.
  @override
  String get id;

  /// Specifies the type of device.
  @override
  String get type;

  /// Type of the device, defining its purpose or category (e.g., thermostat, lighting).
  @override
  DevicesModuleDeviceCategory get category;

  /// Human-readable name of the device.
  @override
  String get name;

  /// A list of controls associated with the device. Controls represent actions or commands that can be executed on the device.
  @override
  List<DevicesModuleCreateDeviceControl> get controls;

  /// A list of channels associated with the device. Each channel represents a functional unit of the device, such as a sensor, actuator, or logical grouping of properties.
  @override
  List<DevicesModuleCreateDeviceChannel> get channels;

  /// A HA device instance identifier.
  @override
  @JsonKey(name: 'ha_device_id')
  String get haDeviceId;

  /// Optional detailed description of the device.
  @override
  String? get description;

  /// Create a copy of DevicesHomeAssistantPluginCreateHomeAssistantDevice
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesHomeAssistantPluginCreateHomeAssistantDeviceImplCopyWith<
          _$DevicesHomeAssistantPluginCreateHomeAssistantDeviceImpl>
      get copyWith => throw _privateConstructorUsedError;
}
