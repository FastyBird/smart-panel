// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_create_device_channel.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesCreateDeviceChannel _$DevicesCreateDeviceChannelFromJson(
    Map<String, dynamic> json) {
  return _DevicesCreateDeviceChannel.fromJson(json);
}

/// @nodoc
mixin _$DevicesCreateDeviceChannel {
  /// Unique identifier for the channel. Optional during creation and system-generated if not provided.
  String get id => throw _privateConstructorUsedError;

  /// Type of the channel, indicating its functional category (e.g., temperature, light).
  DevicesChannelCategory get category => throw _privateConstructorUsedError;

  /// Human-readable name of the channel.
  String get name => throw _privateConstructorUsedError;

  /// A list of controls associated with the device channel. Controls represent actions or commands that can be executed on the channel.
  List<DevicesCreateChannelControl> get controls =>
      throw _privateConstructorUsedError;

  /// A list of properties associated with the device channel. Properties represent the state or attributes of the channel.
  List<DevicesCreateChannelProperty> get properties =>
      throw _privateConstructorUsedError;

  /// Optional description of the channel’s purpose or functionality.
  String? get description => throw _privateConstructorUsedError;

  /// Serializes this DevicesCreateDeviceChannel to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesCreateDeviceChannel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesCreateDeviceChannelCopyWith<DevicesCreateDeviceChannel>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesCreateDeviceChannelCopyWith<$Res> {
  factory $DevicesCreateDeviceChannelCopyWith(DevicesCreateDeviceChannel value,
          $Res Function(DevicesCreateDeviceChannel) then) =
      _$DevicesCreateDeviceChannelCopyWithImpl<$Res,
          DevicesCreateDeviceChannel>;
  @useResult
  $Res call(
      {String id,
      DevicesChannelCategory category,
      String name,
      List<DevicesCreateChannelControl> controls,
      List<DevicesCreateChannelProperty> properties,
      String? description});
}

/// @nodoc
class _$DevicesCreateDeviceChannelCopyWithImpl<$Res,
        $Val extends DevicesCreateDeviceChannel>
    implements $DevicesCreateDeviceChannelCopyWith<$Res> {
  _$DevicesCreateDeviceChannelCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesCreateDeviceChannel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? category = null,
    Object? name = null,
    Object? controls = null,
    Object? properties = null,
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
              as DevicesChannelCategory,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      controls: null == controls
          ? _value.controls
          : controls // ignore: cast_nullable_to_non_nullable
              as List<DevicesCreateChannelControl>,
      properties: null == properties
          ? _value.properties
          : properties // ignore: cast_nullable_to_non_nullable
              as List<DevicesCreateChannelProperty>,
      description: freezed == description
          ? _value.description
          : description // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DevicesCreateDeviceChannelImplCopyWith<$Res>
    implements $DevicesCreateDeviceChannelCopyWith<$Res> {
  factory _$$DevicesCreateDeviceChannelImplCopyWith(
          _$DevicesCreateDeviceChannelImpl value,
          $Res Function(_$DevicesCreateDeviceChannelImpl) then) =
      __$$DevicesCreateDeviceChannelImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      DevicesChannelCategory category,
      String name,
      List<DevicesCreateChannelControl> controls,
      List<DevicesCreateChannelProperty> properties,
      String? description});
}

/// @nodoc
class __$$DevicesCreateDeviceChannelImplCopyWithImpl<$Res>
    extends _$DevicesCreateDeviceChannelCopyWithImpl<$Res,
        _$DevicesCreateDeviceChannelImpl>
    implements _$$DevicesCreateDeviceChannelImplCopyWith<$Res> {
  __$$DevicesCreateDeviceChannelImplCopyWithImpl(
      _$DevicesCreateDeviceChannelImpl _value,
      $Res Function(_$DevicesCreateDeviceChannelImpl) _then)
      : super(_value, _then);

  /// Create a copy of DevicesCreateDeviceChannel
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? category = null,
    Object? name = null,
    Object? controls = null,
    Object? properties = null,
    Object? description = freezed,
  }) {
    return _then(_$DevicesCreateDeviceChannelImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      category: null == category
          ? _value.category
          : category // ignore: cast_nullable_to_non_nullable
              as DevicesChannelCategory,
      name: null == name
          ? _value.name
          : name // ignore: cast_nullable_to_non_nullable
              as String,
      controls: null == controls
          ? _value._controls
          : controls // ignore: cast_nullable_to_non_nullable
              as List<DevicesCreateChannelControl>,
      properties: null == properties
          ? _value._properties
          : properties // ignore: cast_nullable_to_non_nullable
              as List<DevicesCreateChannelProperty>,
      description: freezed == description
          ? _value.description
          : description // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DevicesCreateDeviceChannelImpl implements _DevicesCreateDeviceChannel {
  const _$DevicesCreateDeviceChannelImpl(
      {required this.id,
      required this.category,
      required this.name,
      required final List<DevicesCreateChannelControl> controls,
      required final List<DevicesCreateChannelProperty> properties,
      this.description})
      : _controls = controls,
        _properties = properties;

  factory _$DevicesCreateDeviceChannelImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DevicesCreateDeviceChannelImplFromJson(json);

  /// Unique identifier for the channel. Optional during creation and system-generated if not provided.
  @override
  final String id;

  /// Type of the channel, indicating its functional category (e.g., temperature, light).
  @override
  final DevicesChannelCategory category;

  /// Human-readable name of the channel.
  @override
  final String name;

  /// A list of controls associated with the device channel. Controls represent actions or commands that can be executed on the channel.
  final List<DevicesCreateChannelControl> _controls;

  /// A list of controls associated with the device channel. Controls represent actions or commands that can be executed on the channel.
  @override
  List<DevicesCreateChannelControl> get controls {
    if (_controls is EqualUnmodifiableListView) return _controls;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_controls);
  }

  /// A list of properties associated with the device channel. Properties represent the state or attributes of the channel.
  final List<DevicesCreateChannelProperty> _properties;

  /// A list of properties associated with the device channel. Properties represent the state or attributes of the channel.
  @override
  List<DevicesCreateChannelProperty> get properties {
    if (_properties is EqualUnmodifiableListView) return _properties;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_properties);
  }

  /// Optional description of the channel’s purpose or functionality.
  @override
  final String? description;

  @override
  String toString() {
    return 'DevicesCreateDeviceChannel(id: $id, category: $category, name: $name, controls: $controls, properties: $properties, description: $description)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DevicesCreateDeviceChannelImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.category, category) ||
                other.category == category) &&
            (identical(other.name, name) || other.name == name) &&
            const DeepCollectionEquality().equals(other._controls, _controls) &&
            const DeepCollectionEquality()
                .equals(other._properties, _properties) &&
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
      const DeepCollectionEquality().hash(_properties),
      description);

  /// Create a copy of DevicesCreateDeviceChannel
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesCreateDeviceChannelImplCopyWith<_$DevicesCreateDeviceChannelImpl>
      get copyWith => __$$DevicesCreateDeviceChannelImplCopyWithImpl<
          _$DevicesCreateDeviceChannelImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesCreateDeviceChannelImplToJson(
      this,
    );
  }
}

abstract class _DevicesCreateDeviceChannel
    implements DevicesCreateDeviceChannel {
  const factory _DevicesCreateDeviceChannel(
      {required final String id,
      required final DevicesChannelCategory category,
      required final String name,
      required final List<DevicesCreateChannelControl> controls,
      required final List<DevicesCreateChannelProperty> properties,
      final String? description}) = _$DevicesCreateDeviceChannelImpl;

  factory _DevicesCreateDeviceChannel.fromJson(Map<String, dynamic> json) =
      _$DevicesCreateDeviceChannelImpl.fromJson;

  /// Unique identifier for the channel. Optional during creation and system-generated if not provided.
  @override
  String get id;

  /// Type of the channel, indicating its functional category (e.g., temperature, light).
  @override
  DevicesChannelCategory get category;

  /// Human-readable name of the channel.
  @override
  String get name;

  /// A list of controls associated with the device channel. Controls represent actions or commands that can be executed on the channel.
  @override
  List<DevicesCreateChannelControl> get controls;

  /// A list of properties associated with the device channel. Properties represent the state or attributes of the channel.
  @override
  List<DevicesCreateChannelProperty> get properties;

  /// Optional description of the channel’s purpose or functionality.
  @override
  String? get description;

  /// Create a copy of DevicesCreateDeviceChannel
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesCreateDeviceChannelImplCopyWith<_$DevicesCreateDeviceChannelImpl>
      get copyWith => throw _privateConstructorUsedError;
}
