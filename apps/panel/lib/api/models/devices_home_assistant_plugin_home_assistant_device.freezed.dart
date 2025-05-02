// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_home_assistant_plugin_home_assistant_device.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesHomeAssistantPluginHomeAssistantDevice
    _$DevicesHomeAssistantPluginHomeAssistantDeviceFromJson(
        Map<String, dynamic> json) {
  return _DevicesHomeAssistantPluginHomeAssistantDevice.fromJson(json);
}

/// @nodoc
mixin _$DevicesHomeAssistantPluginHomeAssistantDevice {
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

  /// A HA device instance identifier.
  @JsonKey(name: 'ha_device_id')
  String get haDeviceId => throw _privateConstructorUsedError;

  /// Serializes this DevicesHomeAssistantPluginHomeAssistantDevice to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesHomeAssistantPluginHomeAssistantDevice
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesHomeAssistantPluginHomeAssistantDeviceCopyWith<
          DevicesHomeAssistantPluginHomeAssistantDevice>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesHomeAssistantPluginHomeAssistantDeviceCopyWith<$Res> {
  factory $DevicesHomeAssistantPluginHomeAssistantDeviceCopyWith(
          DevicesHomeAssistantPluginHomeAssistantDevice value,
          $Res Function(DevicesHomeAssistantPluginHomeAssistantDevice) then) =
      _$DevicesHomeAssistantPluginHomeAssistantDeviceCopyWithImpl<$Res,
          DevicesHomeAssistantPluginHomeAssistantDevice>;
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
      @JsonKey(name: 'updated_at') DateTime? updatedAt,
      @JsonKey(name: 'ha_device_id') String haDeviceId});
}

/// @nodoc
class _$DevicesHomeAssistantPluginHomeAssistantDeviceCopyWithImpl<$Res,
        $Val extends DevicesHomeAssistantPluginHomeAssistantDevice>
    implements $DevicesHomeAssistantPluginHomeAssistantDeviceCopyWith<$Res> {
  _$DevicesHomeAssistantPluginHomeAssistantDeviceCopyWithImpl(
      this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesHomeAssistantPluginHomeAssistantDevice
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
    Object? haDeviceId = null,
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
      haDeviceId: null == haDeviceId
          ? _value.haDeviceId
          : haDeviceId // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DevicesHomeAssistantPluginHomeAssistantDeviceImplCopyWith<
        $Res>
    implements $DevicesHomeAssistantPluginHomeAssistantDeviceCopyWith<$Res> {
  factory _$$DevicesHomeAssistantPluginHomeAssistantDeviceImplCopyWith(
          _$DevicesHomeAssistantPluginHomeAssistantDeviceImpl value,
          $Res Function(_$DevicesHomeAssistantPluginHomeAssistantDeviceImpl)
              then) =
      __$$DevicesHomeAssistantPluginHomeAssistantDeviceImplCopyWithImpl<$Res>;
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
      @JsonKey(name: 'updated_at') DateTime? updatedAt,
      @JsonKey(name: 'ha_device_id') String haDeviceId});
}

/// @nodoc
class __$$DevicesHomeAssistantPluginHomeAssistantDeviceImplCopyWithImpl<$Res>
    extends _$DevicesHomeAssistantPluginHomeAssistantDeviceCopyWithImpl<$Res,
        _$DevicesHomeAssistantPluginHomeAssistantDeviceImpl>
    implements
        _$$DevicesHomeAssistantPluginHomeAssistantDeviceImplCopyWith<$Res> {
  __$$DevicesHomeAssistantPluginHomeAssistantDeviceImplCopyWithImpl(
      _$DevicesHomeAssistantPluginHomeAssistantDeviceImpl _value,
      $Res Function(_$DevicesHomeAssistantPluginHomeAssistantDeviceImpl) _then)
      : super(_value, _then);

  /// Create a copy of DevicesHomeAssistantPluginHomeAssistantDevice
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
    Object? haDeviceId = null,
  }) {
    return _then(_$DevicesHomeAssistantPluginHomeAssistantDeviceImpl(
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
      haDeviceId: null == haDeviceId
          ? _value.haDeviceId
          : haDeviceId // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DevicesHomeAssistantPluginHomeAssistantDeviceImpl
    implements _DevicesHomeAssistantPluginHomeAssistantDevice {
  const _$DevicesHomeAssistantPluginHomeAssistantDeviceImpl(
      {required this.id,
      required this.type,
      required this.category,
      required this.name,
      required this.description,
      required final List<DevicesModuleDeviceControl> controls,
      required final List<DevicesModuleChannel> channels,
      @JsonKey(name: 'created_at') required this.createdAt,
      @JsonKey(name: 'updated_at') required this.updatedAt,
      @JsonKey(name: 'ha_device_id') required this.haDeviceId})
      : _controls = controls,
        _channels = channels;

  factory _$DevicesHomeAssistantPluginHomeAssistantDeviceImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DevicesHomeAssistantPluginHomeAssistantDeviceImplFromJson(json);

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

  /// A HA device instance identifier.
  @override
  @JsonKey(name: 'ha_device_id')
  final String haDeviceId;

  @override
  String toString() {
    return 'DevicesHomeAssistantPluginHomeAssistantDevice(id: $id, type: $type, category: $category, name: $name, description: $description, controls: $controls, channels: $channels, createdAt: $createdAt, updatedAt: $updatedAt, haDeviceId: $haDeviceId)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DevicesHomeAssistantPluginHomeAssistantDeviceImpl &&
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
                other.updatedAt == updatedAt) &&
            (identical(other.haDeviceId, haDeviceId) ||
                other.haDeviceId == haDeviceId));
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
      updatedAt,
      haDeviceId);

  /// Create a copy of DevicesHomeAssistantPluginHomeAssistantDevice
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesHomeAssistantPluginHomeAssistantDeviceImplCopyWith<
          _$DevicesHomeAssistantPluginHomeAssistantDeviceImpl>
      get copyWith =>
          __$$DevicesHomeAssistantPluginHomeAssistantDeviceImplCopyWithImpl<
                  _$DevicesHomeAssistantPluginHomeAssistantDeviceImpl>(
              this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesHomeAssistantPluginHomeAssistantDeviceImplToJson(
      this,
    );
  }
}

abstract class _DevicesHomeAssistantPluginHomeAssistantDevice
    implements DevicesHomeAssistantPluginHomeAssistantDevice {
  const factory _DevicesHomeAssistantPluginHomeAssistantDevice(
          {required final String id,
          required final String type,
          required final DevicesModuleDeviceCategory category,
          required final String name,
          required final String? description,
          required final List<DevicesModuleDeviceControl> controls,
          required final List<DevicesModuleChannel> channels,
          @JsonKey(name: 'created_at') required final DateTime createdAt,
          @JsonKey(name: 'updated_at') required final DateTime? updatedAt,
          @JsonKey(name: 'ha_device_id') required final String haDeviceId}) =
      _$DevicesHomeAssistantPluginHomeAssistantDeviceImpl;

  factory _DevicesHomeAssistantPluginHomeAssistantDevice.fromJson(
          Map<String, dynamic> json) =
      _$DevicesHomeAssistantPluginHomeAssistantDeviceImpl.fromJson;

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

  /// A HA device instance identifier.
  @override
  @JsonKey(name: 'ha_device_id')
  String get haDeviceId;

  /// Create a copy of DevicesHomeAssistantPluginHomeAssistantDevice
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesHomeAssistantPluginHomeAssistantDeviceImplCopyWith<
          _$DevicesHomeAssistantPluginHomeAssistantDeviceImpl>
      get copyWith => throw _privateConstructorUsedError;
}
