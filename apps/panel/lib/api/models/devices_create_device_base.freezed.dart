// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_create_device_base.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesCreateDeviceBase _$DevicesCreateDeviceBaseFromJson(
    Map<String, dynamic> json) {
  return _DevicesCreateDeviceBase.fromJson(json);
}

/// @nodoc
mixin _$DevicesCreateDeviceBase {
  /// Unique identifier for the device. Optional during creation and system-generated if not provided.
  String get id => throw _privateConstructorUsedError;

  /// Type of the device, defining its purpose or category (e.g., thermostat, lighting).
  DevicesDeviceCategory get category => throw _privateConstructorUsedError;

  /// Human-readable name of the device.
  String get name => throw _privateConstructorUsedError;

  /// A list of controls associated with the device. Controls represent actions or commands that can be executed on the device.
  List<DevicesCreateDeviceControl> get controls =>
      throw _privateConstructorUsedError;

  /// A list of channels associated with the device. Each channel represents a functional unit of the device, such as a sensor, actuator, or logical grouping of properties.
  List<DevicesCreateDeviceChannel> get channels =>
      throw _privateConstructorUsedError;

  /// Optional detailed description of the device.
  String? get description => throw _privateConstructorUsedError;

  /// Serializes this DevicesCreateDeviceBase to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesCreateDeviceBase
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesCreateDeviceBaseCopyWith<DevicesCreateDeviceBase> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesCreateDeviceBaseCopyWith<$Res> {
  factory $DevicesCreateDeviceBaseCopyWith(DevicesCreateDeviceBase value,
          $Res Function(DevicesCreateDeviceBase) then) =
      _$DevicesCreateDeviceBaseCopyWithImpl<$Res, DevicesCreateDeviceBase>;
  @useResult
  $Res call(
      {String id,
      DevicesDeviceCategory category,
      String name,
      List<DevicesCreateDeviceControl> controls,
      List<DevicesCreateDeviceChannel> channels,
      String? description});
}

/// @nodoc
class _$DevicesCreateDeviceBaseCopyWithImpl<$Res,
        $Val extends DevicesCreateDeviceBase>
    implements $DevicesCreateDeviceBaseCopyWith<$Res> {
  _$DevicesCreateDeviceBaseCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesCreateDeviceBase
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
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      category: null == category
          ? _value.category
          : category // ignore: cast_nullable_to_non_nullable
              as DevicesDeviceCategory,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      controls: null == controls
          ? _value.controls
          : controls // ignore: cast_nullable_to_non_nullable
              as List<DevicesCreateDeviceControl>,
      channels: null == channels
          ? _value.channels
          : channels // ignore: cast_nullable_to_non_nullable
              as List<DevicesCreateDeviceChannel>,
      description: freezed == description
          ? _value.description
          : description // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DevicesCreateDeviceBaseImplCopyWith<$Res>
    implements $DevicesCreateDeviceBaseCopyWith<$Res> {
  factory _$$DevicesCreateDeviceBaseImplCopyWith(
          _$DevicesCreateDeviceBaseImpl value,
          $Res Function(_$DevicesCreateDeviceBaseImpl) then) =
      __$$DevicesCreateDeviceBaseImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      DevicesDeviceCategory category,
      String name,
      List<DevicesCreateDeviceControl> controls,
      List<DevicesCreateDeviceChannel> channels,
      String? description});
}

/// @nodoc
class __$$DevicesCreateDeviceBaseImplCopyWithImpl<$Res>
    extends _$DevicesCreateDeviceBaseCopyWithImpl<$Res,
        _$DevicesCreateDeviceBaseImpl>
    implements _$$DevicesCreateDeviceBaseImplCopyWith<$Res> {
  __$$DevicesCreateDeviceBaseImplCopyWithImpl(
      _$DevicesCreateDeviceBaseImpl _value,
      $Res Function(_$DevicesCreateDeviceBaseImpl) _then)
      : super(_value, _then);

  /// Create a copy of DevicesCreateDeviceBase
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
  }) {
    return _then(_$DevicesCreateDeviceBaseImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      category: null == category
          ? _value.category
          : category // ignore: cast_nullable_to_non_nullable
              as DevicesDeviceCategory,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      controls: null == controls
          ? _value._controls
          : controls // ignore: cast_nullable_to_non_nullable
              as List<DevicesCreateDeviceControl>,
      channels: null == channels
          ? _value._channels
          : channels // ignore: cast_nullable_to_non_nullable
              as List<DevicesCreateDeviceChannel>,
      description: freezed == description
          ? _value.description
          : description // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DevicesCreateDeviceBaseImpl implements _DevicesCreateDeviceBase {
  const _$DevicesCreateDeviceBaseImpl(
      {required this.id,
      required this.category,
      required this.name,
      required final List<DevicesCreateDeviceControl> controls,
      required final List<DevicesCreateDeviceChannel> channels,
      this.description})
      : _controls = controls,
        _channels = channels;

  factory _$DevicesCreateDeviceBaseImpl.fromJson(Map<String, dynamic> json) =>
      _$$DevicesCreateDeviceBaseImplFromJson(json);

  /// Unique identifier for the device. Optional during creation and system-generated if not provided.
  @override
  final String id;

  /// Type of the device, defining its purpose or category (e.g., thermostat, lighting).
  @override
  final DevicesDeviceCategory category;

  /// Human-readable name of the device.
  @override
  final String name;

  /// A list of controls associated with the device. Controls represent actions or commands that can be executed on the device.
  final List<DevicesCreateDeviceControl> _controls;

  /// A list of controls associated with the device. Controls represent actions or commands that can be executed on the device.
  @override
  List<DevicesCreateDeviceControl> get controls {
    if (_controls is EqualUnmodifiableListView) return _controls;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_controls);
  }

  /// A list of channels associated with the device. Each channel represents a functional unit of the device, such as a sensor, actuator, or logical grouping of properties.
  final List<DevicesCreateDeviceChannel> _channels;

  /// A list of channels associated with the device. Each channel represents a functional unit of the device, such as a sensor, actuator, or logical grouping of properties.
  @override
  List<DevicesCreateDeviceChannel> get channels {
    if (_channels is EqualUnmodifiableListView) return _channels;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_channels);
  }

  /// Optional detailed description of the device.
  @override
  final String? description;

  @override
  String toString() {
    return 'DevicesCreateDeviceBase(id: $id, category: $category, name: $name, controls: $controls, channels: $channels, description: $description)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DevicesCreateDeviceBaseImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.category, category) ||
                other.category == category) &&
            (identical(other.name, name) || other.name == name) &&
            const DeepCollectionEquality().equals(other._controls, _controls) &&
            const DeepCollectionEquality().equals(other._channels, _channels) &&
            (identical(other.description, description) ||
                other.description == description));
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
      description);

  /// Create a copy of DevicesCreateDeviceBase
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesCreateDeviceBaseImplCopyWith<_$DevicesCreateDeviceBaseImpl>
      get copyWith => __$$DevicesCreateDeviceBaseImplCopyWithImpl<
          _$DevicesCreateDeviceBaseImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesCreateDeviceBaseImplToJson(
      this,
    );
  }
}

abstract class _DevicesCreateDeviceBase implements DevicesCreateDeviceBase {
  const factory _DevicesCreateDeviceBase(
      {required final String id,
      required final DevicesDeviceCategory category,
      required final String name,
      required final List<DevicesCreateDeviceControl> controls,
      required final List<DevicesCreateDeviceChannel> channels,
      final String? description}) = _$DevicesCreateDeviceBaseImpl;

  factory _DevicesCreateDeviceBase.fromJson(Map<String, dynamic> json) =
      _$DevicesCreateDeviceBaseImpl.fromJson;

  /// Unique identifier for the device. Optional during creation and system-generated if not provided.
  @override
  String get id;

  /// Type of the device, defining its purpose or category (e.g., thermostat, lighting).
  @override
  DevicesDeviceCategory get category;

  /// Human-readable name of the device.
  @override
  String get name;

  /// A list of controls associated with the device. Controls represent actions or commands that can be executed on the device.
  @override
  List<DevicesCreateDeviceControl> get controls;

  /// A list of channels associated with the device. Each channel represents a functional unit of the device, such as a sensor, actuator, or logical grouping of properties.
  @override
  List<DevicesCreateDeviceChannel> get channels;

  /// Optional detailed description of the device.
  @override
  String? get description;

  /// Create a copy of DevicesCreateDeviceBase
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesCreateDeviceBaseImplCopyWith<_$DevicesCreateDeviceBaseImpl>
      get copyWith => throw _privateConstructorUsedError;
}
