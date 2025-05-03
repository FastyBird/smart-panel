// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_home_assistant_plugin_discovered_device.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesHomeAssistantPluginDiscoveredDevice
    _$DevicesHomeAssistantPluginDiscoveredDeviceFromJson(
        Map<String, dynamic> json) {
  return _DevicesHomeAssistantPluginDiscoveredDevice.fromJson(json);
}

/// @nodoc
mixin _$DevicesHomeAssistantPluginDiscoveredDevice {
  /// Home Assistant device ID.
  String get id => throw _privateConstructorUsedError;

  /// Display name of the device.
  String get name => throw _privateConstructorUsedError;

  /// List of entity IDs belonging to the device.
  List<String> get entities => throw _privateConstructorUsedError;

  /// If adopted, the UUID of the corresponding panel device.
  @JsonKey(name: 'adopted_device_id')
  String? get adoptedDeviceId => throw _privateConstructorUsedError;

  /// Current states of all entities belonging to the device.
  List<DevicesHomeAssistantPluginState> get states =>
      throw _privateConstructorUsedError;

  /// Serializes this DevicesHomeAssistantPluginDiscoveredDevice to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesHomeAssistantPluginDiscoveredDevice
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesHomeAssistantPluginDiscoveredDeviceCopyWith<
          DevicesHomeAssistantPluginDiscoveredDevice>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesHomeAssistantPluginDiscoveredDeviceCopyWith<$Res> {
  factory $DevicesHomeAssistantPluginDiscoveredDeviceCopyWith(
          DevicesHomeAssistantPluginDiscoveredDevice value,
          $Res Function(DevicesHomeAssistantPluginDiscoveredDevice) then) =
      _$DevicesHomeAssistantPluginDiscoveredDeviceCopyWithImpl<$Res,
          DevicesHomeAssistantPluginDiscoveredDevice>;
  @useResult
  $Res call(
      {String id,
      String name,
      List<String> entities,
      @JsonKey(name: 'adopted_device_id') String? adoptedDeviceId,
      List<DevicesHomeAssistantPluginState> states});
}

/// @nodoc
class _$DevicesHomeAssistantPluginDiscoveredDeviceCopyWithImpl<$Res,
        $Val extends DevicesHomeAssistantPluginDiscoveredDevice>
    implements $DevicesHomeAssistantPluginDiscoveredDeviceCopyWith<$Res> {
  _$DevicesHomeAssistantPluginDiscoveredDeviceCopyWithImpl(
      this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesHomeAssistantPluginDiscoveredDevice
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? name = null,
    Object? entities = null,
    Object? adoptedDeviceId = freezed,
    Object? states = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      entities: null == entities
          ? _value.entities
          : entities // ignore: cast_nullable_to_non_nullable
              as List<String>,
      adoptedDeviceId: freezed == adoptedDeviceId
          ? _value.adoptedDeviceId
          : adoptedDeviceId // ignore: cast_nullable_to_non_nullable
              as String?,
      states: null == states
          ? _value.states
          : states // ignore: cast_nullable_to_non_nullable
              as List<DevicesHomeAssistantPluginState>,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DevicesHomeAssistantPluginDiscoveredDeviceImplCopyWith<$Res>
    implements $DevicesHomeAssistantPluginDiscoveredDeviceCopyWith<$Res> {
  factory _$$DevicesHomeAssistantPluginDiscoveredDeviceImplCopyWith(
          _$DevicesHomeAssistantPluginDiscoveredDeviceImpl value,
          $Res Function(_$DevicesHomeAssistantPluginDiscoveredDeviceImpl)
              then) =
      __$$DevicesHomeAssistantPluginDiscoveredDeviceImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String name,
      List<String> entities,
      @JsonKey(name: 'adopted_device_id') String? adoptedDeviceId,
      List<DevicesHomeAssistantPluginState> states});
}

/// @nodoc
class __$$DevicesHomeAssistantPluginDiscoveredDeviceImplCopyWithImpl<$Res>
    extends _$DevicesHomeAssistantPluginDiscoveredDeviceCopyWithImpl<$Res,
        _$DevicesHomeAssistantPluginDiscoveredDeviceImpl>
    implements _$$DevicesHomeAssistantPluginDiscoveredDeviceImplCopyWith<$Res> {
  __$$DevicesHomeAssistantPluginDiscoveredDeviceImplCopyWithImpl(
      _$DevicesHomeAssistantPluginDiscoveredDeviceImpl _value,
      $Res Function(_$DevicesHomeAssistantPluginDiscoveredDeviceImpl) _then)
      : super(_value, _then);

  /// Create a copy of DevicesHomeAssistantPluginDiscoveredDevice
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? name = null,
    Object? entities = null,
    Object? adoptedDeviceId = freezed,
    Object? states = null,
  }) {
    return _then(_$DevicesHomeAssistantPluginDiscoveredDeviceImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      entities: null == entities
          ? _value._entities
          : entities // ignore: cast_nullable_to_non_nullable
              as List<String>,
      adoptedDeviceId: freezed == adoptedDeviceId
          ? _value.adoptedDeviceId
          : adoptedDeviceId // ignore: cast_nullable_to_non_nullable
              as String?,
      states: null == states
          ? _value._states
          : states // ignore: cast_nullable_to_non_nullable
              as List<DevicesHomeAssistantPluginState>,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DevicesHomeAssistantPluginDiscoveredDeviceImpl
    implements _DevicesHomeAssistantPluginDiscoveredDevice {
  const _$DevicesHomeAssistantPluginDiscoveredDeviceImpl(
      {required this.id,
      required this.name,
      required final List<String> entities,
      @JsonKey(name: 'adopted_device_id') required this.adoptedDeviceId,
      required final List<DevicesHomeAssistantPluginState> states})
      : _entities = entities,
        _states = states;

  factory _$DevicesHomeAssistantPluginDiscoveredDeviceImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DevicesHomeAssistantPluginDiscoveredDeviceImplFromJson(json);

  /// Home Assistant device ID.
  @override
  final String id;

  /// Display name of the device.
  @override
  final String name;

  /// List of entity IDs belonging to the device.
  final List<String> _entities;

  /// List of entity IDs belonging to the device.
  @override
  List<String> get entities {
    if (_entities is EqualUnmodifiableListView) return _entities;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_entities);
  }

  /// If adopted, the UUID of the corresponding panel device.
  @override
  @JsonKey(name: 'adopted_device_id')
  final String? adoptedDeviceId;

  /// Current states of all entities belonging to the device.
  final List<DevicesHomeAssistantPluginState> _states;

  /// Current states of all entities belonging to the device.
  @override
  List<DevicesHomeAssistantPluginState> get states {
    if (_states is EqualUnmodifiableListView) return _states;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_states);
  }

  @override
  String toString() {
    return 'DevicesHomeAssistantPluginDiscoveredDevice(id: $id, name: $name, entities: $entities, adoptedDeviceId: $adoptedDeviceId, states: $states)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DevicesHomeAssistantPluginDiscoveredDeviceImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.name, name) || other.name == name) &&
            const DeepCollectionEquality().equals(other._entities, _entities) &&
            (identical(other.adoptedDeviceId, adoptedDeviceId) ||
                other.adoptedDeviceId == adoptedDeviceId) &&
            const DeepCollectionEquality().equals(other._states, _states));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      name,
      const DeepCollectionEquality().hash(_entities),
      adoptedDeviceId,
      const DeepCollectionEquality().hash(_states));

  /// Create a copy of DevicesHomeAssistantPluginDiscoveredDevice
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesHomeAssistantPluginDiscoveredDeviceImplCopyWith<
          _$DevicesHomeAssistantPluginDiscoveredDeviceImpl>
      get copyWith =>
          __$$DevicesHomeAssistantPluginDiscoveredDeviceImplCopyWithImpl<
                  _$DevicesHomeAssistantPluginDiscoveredDeviceImpl>(
              this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesHomeAssistantPluginDiscoveredDeviceImplToJson(
      this,
    );
  }
}

abstract class _DevicesHomeAssistantPluginDiscoveredDevice
    implements DevicesHomeAssistantPluginDiscoveredDevice {
  const factory _DevicesHomeAssistantPluginDiscoveredDevice(
          {required final String id,
          required final String name,
          required final List<String> entities,
          @JsonKey(name: 'adopted_device_id')
          required final String? adoptedDeviceId,
          required final List<DevicesHomeAssistantPluginState> states}) =
      _$DevicesHomeAssistantPluginDiscoveredDeviceImpl;

  factory _DevicesHomeAssistantPluginDiscoveredDevice.fromJson(
          Map<String, dynamic> json) =
      _$DevicesHomeAssistantPluginDiscoveredDeviceImpl.fromJson;

  /// Home Assistant device ID.
  @override
  String get id;

  /// Display name of the device.
  @override
  String get name;

  /// List of entity IDs belonging to the device.
  @override
  List<String> get entities;

  /// If adopted, the UUID of the corresponding panel device.
  @override
  @JsonKey(name: 'adopted_device_id')
  String? get adoptedDeviceId;

  /// Current states of all entities belonging to the device.
  @override
  List<DevicesHomeAssistantPluginState> get states;

  /// Create a copy of DevicesHomeAssistantPluginDiscoveredDevice
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesHomeAssistantPluginDiscoveredDeviceImplCopyWith<
          _$DevicesHomeAssistantPluginDiscoveredDeviceImpl>
      get copyWith => throw _privateConstructorUsedError;
}
