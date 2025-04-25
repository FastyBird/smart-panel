// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_module_device.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesModuleDevice _$DevicesModuleDeviceFromJson(Map<String, dynamic> json) {
  return _DevicesModuleDevice.fromJson(json);
}

/// @nodoc
mixin _$DevicesModuleDevice {
  /// System-generated unique identifier for the device.
  String get id => throw _privateConstructorUsedError;

  /// Specifies the type of device.
  String get type => throw _privateConstructorUsedError;

  /// Type of the device, defining its purpose or category (e.g., thermostat, lighting).
  DevicesModuleDeviceCategory get category =>
      throw _privateConstructorUsedError;

  /// Human-readable name of the device.
  String get name => throw _privateConstructorUsedError;

  /// Optional detailed description of the device.
  String? get description => throw _privateConstructorUsedError;

  /// A list of controls associated with the device. Controls represent actions or commands that can be executed on the device.
  List<DevicesModuleDeviceControl> get controls =>
      throw _privateConstructorUsedError;

  /// A list of channels associated with the device. Each channel represents a functional unit of the device, such as a sensor, actuator, or logical grouping of properties.
  List<DevicesModuleChannel> get channels => throw _privateConstructorUsedError;

  /// Timestamp indicating when the device was created.
  @JsonKey(name: 'created_at')
  DateTime get createdAt => throw _privateConstructorUsedError;

  /// Timestamp indicating when the device was last updated, if applicable.
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt => throw _privateConstructorUsedError;

  /// Serializes this DevicesModuleDevice to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesModuleDevice
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesModuleDeviceCopyWith<DevicesModuleDevice> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesModuleDeviceCopyWith<$Res> {
  factory $DevicesModuleDeviceCopyWith(
          DevicesModuleDevice value, $Res Function(DevicesModuleDevice) then) =
      _$DevicesModuleDeviceCopyWithImpl<$Res, DevicesModuleDevice>;
  @useResult
  $Res call(
      {String id,
      String type,
      DevicesModuleDeviceCategory category,
      String name,
      String? description,
      List<DevicesModuleDeviceControl> controls,
      List<DevicesModuleChannel> channels,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt});
}

/// @nodoc
class _$DevicesModuleDeviceCopyWithImpl<$Res, $Val extends DevicesModuleDevice>
    implements $DevicesModuleDeviceCopyWith<$Res> {
  _$DevicesModuleDeviceCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesModuleDevice
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? category = null,
    Object? name = null,
    Object? description = freezed,
    Object? controls = null,
    Object? channels = null,
    Object? createdAt = null,
    Object? updatedAt = freezed,
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
      description: freezed == description
          ? _value.description
          : description // ignore: cast_nullable_to_non_nullable
              as String?,
      controls: null == controls
          ? _value.controls
          : controls // ignore: cast_nullable_to_non_nullable
              as List<DevicesModuleDeviceControl>,
      channels: null == channels
          ? _value.channels
          : channels // ignore: cast_nullable_to_non_nullable
              as List<DevicesModuleChannel>,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DevicesModuleDeviceImplCopyWith<$Res>
    implements $DevicesModuleDeviceCopyWith<$Res> {
  factory _$$DevicesModuleDeviceImplCopyWith(_$DevicesModuleDeviceImpl value,
          $Res Function(_$DevicesModuleDeviceImpl) then) =
      __$$DevicesModuleDeviceImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String type,
      DevicesModuleDeviceCategory category,
      String name,
      String? description,
      List<DevicesModuleDeviceControl> controls,
      List<DevicesModuleChannel> channels,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt});
}

/// @nodoc
class __$$DevicesModuleDeviceImplCopyWithImpl<$Res>
    extends _$DevicesModuleDeviceCopyWithImpl<$Res, _$DevicesModuleDeviceImpl>
    implements _$$DevicesModuleDeviceImplCopyWith<$Res> {
  __$$DevicesModuleDeviceImplCopyWithImpl(_$DevicesModuleDeviceImpl _value,
      $Res Function(_$DevicesModuleDeviceImpl) _then)
      : super(_value, _then);

  /// Create a copy of DevicesModuleDevice
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? type = null,
    Object? category = null,
    Object? name = null,
    Object? description = freezed,
    Object? controls = null,
    Object? channels = null,
    Object? createdAt = null,
    Object? updatedAt = freezed,
  }) {
    return _then(_$DevicesModuleDeviceImpl(
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
      description: freezed == description
          ? _value.description
          : description // ignore: cast_nullable_to_non_nullable
              as String?,
      controls: null == controls
          ? _value._controls
          : controls // ignore: cast_nullable_to_non_nullable
              as List<DevicesModuleDeviceControl>,
      channels: null == channels
          ? _value._channels
          : channels // ignore: cast_nullable_to_non_nullable
              as List<DevicesModuleChannel>,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DevicesModuleDeviceImpl implements _DevicesModuleDevice {
  const _$DevicesModuleDeviceImpl(
      {required this.id,
      required this.type,
      required this.category,
      required this.name,
      required this.description,
      required final List<DevicesModuleDeviceControl> controls,
      required final List<DevicesModuleChannel> channels,
      @JsonKey(name: 'created_at') required this.createdAt,
      @JsonKey(name: 'updated_at') required this.updatedAt})
      : _controls = controls,
        _channels = channels;

  factory _$DevicesModuleDeviceImpl.fromJson(Map<String, dynamic> json) =>
      _$$DevicesModuleDeviceImplFromJson(json);

  /// System-generated unique identifier for the device.
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

  /// Optional detailed description of the device.
  @override
  final String? description;

  /// A list of controls associated with the device. Controls represent actions or commands that can be executed on the device.
  final List<DevicesModuleDeviceControl> _controls;

  /// A list of controls associated with the device. Controls represent actions or commands that can be executed on the device.
  @override
  List<DevicesModuleDeviceControl> get controls {
    if (_controls is EqualUnmodifiableListView) return _controls;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_controls);
  }

  /// A list of channels associated with the device. Each channel represents a functional unit of the device, such as a sensor, actuator, or logical grouping of properties.
  final List<DevicesModuleChannel> _channels;

  /// A list of channels associated with the device. Each channel represents a functional unit of the device, such as a sensor, actuator, or logical grouping of properties.
  @override
  List<DevicesModuleChannel> get channels {
    if (_channels is EqualUnmodifiableListView) return _channels;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_channels);
  }

  /// Timestamp indicating when the device was created.
  @override
  @JsonKey(name: 'created_at')
  final DateTime createdAt;

  /// Timestamp indicating when the device was last updated, if applicable.
  @override
  @JsonKey(name: 'updated_at')
  final DateTime? updatedAt;

  @override
  String toString() {
    return 'DevicesModuleDevice(id: $id, type: $type, category: $category, name: $name, description: $description, controls: $controls, channels: $channels, createdAt: $createdAt, updatedAt: $updatedAt)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DevicesModuleDeviceImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.category, category) ||
                other.category == category) &&
            (identical(other.name, name) || other.name == name) &&
            (identical(other.description, description) ||
                other.description == description) &&
            const DeepCollectionEquality().equals(other._controls, _controls) &&
            const DeepCollectionEquality().equals(other._channels, _channels) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      type,
      category,
      name,
      description,
      const DeepCollectionEquality().hash(_controls),
      const DeepCollectionEquality().hash(_channels),
      createdAt,
      updatedAt);

  /// Create a copy of DevicesModuleDevice
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesModuleDeviceImplCopyWith<_$DevicesModuleDeviceImpl> get copyWith =>
      __$$DevicesModuleDeviceImplCopyWithImpl<_$DevicesModuleDeviceImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesModuleDeviceImplToJson(
      this,
    );
  }
}

abstract class _DevicesModuleDevice implements DevicesModuleDevice {
  const factory _DevicesModuleDevice(
          {required final String id,
          required final String type,
          required final DevicesModuleDeviceCategory category,
          required final String name,
          required final String? description,
          required final List<DevicesModuleDeviceControl> controls,
          required final List<DevicesModuleChannel> channels,
          @JsonKey(name: 'created_at') required final DateTime createdAt,
          @JsonKey(name: 'updated_at') required final DateTime? updatedAt}) =
      _$DevicesModuleDeviceImpl;

  factory _DevicesModuleDevice.fromJson(Map<String, dynamic> json) =
      _$DevicesModuleDeviceImpl.fromJson;

  /// System-generated unique identifier for the device.
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

  /// Optional detailed description of the device.
  @override
  String? get description;

  /// A list of controls associated with the device. Controls represent actions or commands that can be executed on the device.
  @override
  List<DevicesModuleDeviceControl> get controls;

  /// A list of channels associated with the device. Each channel represents a functional unit of the device, such as a sensor, actuator, or logical grouping of properties.
  @override
  List<DevicesModuleChannel> get channels;

  /// Timestamp indicating when the device was created.
  @override
  @JsonKey(name: 'created_at')
  DateTime get createdAt;

  /// Timestamp indicating when the device was last updated, if applicable.
  @override
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt;

  /// Create a copy of DevicesModuleDevice
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesModuleDeviceImplCopyWith<_$DevicesModuleDeviceImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
