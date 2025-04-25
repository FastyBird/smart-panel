// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_module_create_device.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesModuleCreateDevice _$DevicesModuleCreateDeviceFromJson(
    Map<String, dynamic> json) {
  return _DevicesModuleCreateDevice.fromJson(json);
}

/// @nodoc
mixin _$DevicesModuleCreateDevice {
  /// Unique identifier for the device. Optional during creation and system-generated if not provided.
  String get id => throw _privateConstructorUsedError;

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

  /// Optional detailed description of the device.
  String? get description => throw _privateConstructorUsedError;

  /// Specifies the type of device.
  String get type => throw _privateConstructorUsedError;

  /// Serializes this DevicesModuleCreateDevice to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesModuleCreateDevice
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesModuleCreateDeviceCopyWith<DevicesModuleCreateDevice> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesModuleCreateDeviceCopyWith<$Res> {
  factory $DevicesModuleCreateDeviceCopyWith(DevicesModuleCreateDevice value,
          $Res Function(DevicesModuleCreateDevice) then) =
      _$DevicesModuleCreateDeviceCopyWithImpl<$Res, DevicesModuleCreateDevice>;
  @useResult
  $Res call(
      {String id,
      DevicesModuleDeviceCategory category,
      String name,
      List<DevicesModuleCreateDeviceControl> controls,
      List<DevicesModuleCreateDeviceChannel> channels,
      String? description,
      String type});
}

/// @nodoc
class _$DevicesModuleCreateDeviceCopyWithImpl<$Res,
        $Val extends DevicesModuleCreateDevice>
    implements $DevicesModuleCreateDeviceCopyWith<$Res> {
  _$DevicesModuleCreateDeviceCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesModuleCreateDevice
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? category = null,
    Object? name = null,
    Object? controls = null,
    Object? channels = null,
    Object? description = freezed,
    Object? type = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
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
      description: freezed == description
          ? _value.description
          : description // ignore: cast_nullable_to_non_nullable
              as String?,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DevicesModuleCreateDeviceImplCopyWith<$Res>
    implements $DevicesModuleCreateDeviceCopyWith<$Res> {
  factory _$$DevicesModuleCreateDeviceImplCopyWith(
          _$DevicesModuleCreateDeviceImpl value,
          $Res Function(_$DevicesModuleCreateDeviceImpl) then) =
      __$$DevicesModuleCreateDeviceImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      DevicesModuleDeviceCategory category,
      String name,
      List<DevicesModuleCreateDeviceControl> controls,
      List<DevicesModuleCreateDeviceChannel> channels,
      String? description,
      String type});
}

/// @nodoc
class __$$DevicesModuleCreateDeviceImplCopyWithImpl<$Res>
    extends _$DevicesModuleCreateDeviceCopyWithImpl<$Res,
        _$DevicesModuleCreateDeviceImpl>
    implements _$$DevicesModuleCreateDeviceImplCopyWith<$Res> {
  __$$DevicesModuleCreateDeviceImplCopyWithImpl(
      _$DevicesModuleCreateDeviceImpl _value,
      $Res Function(_$DevicesModuleCreateDeviceImpl) _then)
      : super(_value, _then);

  /// Create a copy of DevicesModuleCreateDevice
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? category = null,
    Object? name = null,
    Object? controls = null,
    Object? channels = null,
    Object? description = freezed,
    Object? type = null,
  }) {
    return _then(_$DevicesModuleCreateDeviceImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
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
      description: freezed == description
          ? _value.description
          : description // ignore: cast_nullable_to_non_nullable
              as String?,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DevicesModuleCreateDeviceImpl implements _DevicesModuleCreateDevice {
  const _$DevicesModuleCreateDeviceImpl(
      {required this.id,
      required this.category,
      required this.name,
      required final List<DevicesModuleCreateDeviceControl> controls,
      required final List<DevicesModuleCreateDeviceChannel> channels,
      this.description,
      this.type = 'third-party'})
      : _controls = controls,
        _channels = channels;

  factory _$DevicesModuleCreateDeviceImpl.fromJson(Map<String, dynamic> json) =>
      _$$DevicesModuleCreateDeviceImplFromJson(json);

  /// Unique identifier for the device. Optional during creation and system-generated if not provided.
  @override
  final String id;

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

  /// Optional detailed description of the device.
  @override
  final String? description;

  /// Specifies the type of device.
  @override
  @JsonKey()
  final String type;

  @override
  String toString() {
    return 'DevicesModuleCreateDevice(id: $id, category: $category, name: $name, controls: $controls, channels: $channels, description: $description, type: $type)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DevicesModuleCreateDeviceImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.category, category) ||
                other.category == category) &&
            (identical(other.name, name) || other.name == name) &&
            const DeepCollectionEquality().equals(other._controls, _controls) &&
            const DeepCollectionEquality().equals(other._channels, _channels) &&
            (identical(other.description, description) ||
                other.description == description) &&
            (identical(other.type, type) || other.type == type));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      category,
      name,
      const DeepCollectionEquality().hash(_controls),
      const DeepCollectionEquality().hash(_channels),
      description,
      type);

  /// Create a copy of DevicesModuleCreateDevice
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesModuleCreateDeviceImplCopyWith<_$DevicesModuleCreateDeviceImpl>
      get copyWith => __$$DevicesModuleCreateDeviceImplCopyWithImpl<
          _$DevicesModuleCreateDeviceImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesModuleCreateDeviceImplToJson(
      this,
    );
  }
}

abstract class _DevicesModuleCreateDevice implements DevicesModuleCreateDevice {
  const factory _DevicesModuleCreateDevice(
      {required final String id,
      required final DevicesModuleDeviceCategory category,
      required final String name,
      required final List<DevicesModuleCreateDeviceControl> controls,
      required final List<DevicesModuleCreateDeviceChannel> channels,
      final String? description,
      final String type}) = _$DevicesModuleCreateDeviceImpl;

  factory _DevicesModuleCreateDevice.fromJson(Map<String, dynamic> json) =
      _$DevicesModuleCreateDeviceImpl.fromJson;

  /// Unique identifier for the device. Optional during creation and system-generated if not provided.
  @override
  String get id;

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

  /// Optional detailed description of the device.
  @override
  String? get description;

  /// Specifies the type of device.
  @override
  String get type;

  /// Create a copy of DevicesModuleCreateDevice
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesModuleCreateDeviceImplCopyWith<_$DevicesModuleCreateDeviceImpl>
      get copyWith => throw _privateConstructorUsedError;
}
