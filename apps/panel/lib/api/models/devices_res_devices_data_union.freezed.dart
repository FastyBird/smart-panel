// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'devices_res_devices_data_union.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DevicesResDevicesDataUnion _$DevicesResDevicesDataUnionFromJson(
    Map<String, dynamic> json) {
  return DevicesResDevicesDataUnionThirdParty.fromJson(json);
}

/// @nodoc
mixin _$DevicesResDevicesDataUnion {
  /// System-generated unique identifier for the device.
  String get id => throw _privateConstructorUsedError;

  /// Type of the device, defining its purpose or category (e.g., thermostat, lighting).
  DevicesDeviceCategory get category => throw _privateConstructorUsedError;

  /// Human-readable name of the device.
  String get name => throw _privateConstructorUsedError;

  /// Optional detailed description of the device.
  String? get description => throw _privateConstructorUsedError;

  /// A list of controls associated with the device. Controls represent actions or commands that can be executed on the device.
  List<DevicesDeviceControl> get controls => throw _privateConstructorUsedError;

  /// A list of channels associated with the device. Each channel represents a functional unit of the device, such as a sensor, actuator, or logical grouping of properties.
  List<DevicesChannel> get channels => throw _privateConstructorUsedError;

  /// Timestamp indicating when the device was created.
  @JsonKey(name: 'created_at')
  DateTime get createdAt => throw _privateConstructorUsedError;

  /// Timestamp indicating when the device was last updated, if applicable.
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt => throw _privateConstructorUsedError;

  /// The address of the third-party service used by the third-party device. It can be a URL or IP address with an optional port.
  @JsonKey(name: 'service_address')
  String get serviceAddress => throw _privateConstructorUsedError;

  /// Specifies the type of device. This value is fixed as 'third-party' for third-party device integrations.
  String get type => throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String id,
            DevicesDeviceCategory category,
            String name,
            String? description,
            List<DevicesDeviceControl> controls,
            List<DevicesChannel> channels,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            @JsonKey(name: 'service_address') String serviceAddress,
            String type)
        thirdParty,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            String id,
            DevicesDeviceCategory category,
            String name,
            String? description,
            List<DevicesDeviceControl> controls,
            List<DevicesChannel> channels,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            @JsonKey(name: 'service_address') String serviceAddress,
            String type)?
        thirdParty,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            String id,
            DevicesDeviceCategory category,
            String name,
            String? description,
            List<DevicesDeviceControl> controls,
            List<DevicesChannel> channels,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            @JsonKey(name: 'service_address') String serviceAddress,
            String type)?
        thirdParty,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(DevicesResDevicesDataUnionThirdParty value)
        thirdParty,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DevicesResDevicesDataUnionThirdParty value)? thirdParty,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DevicesResDevicesDataUnionThirdParty value)? thirdParty,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;

  /// Serializes this DevicesResDevicesDataUnion to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DevicesResDevicesDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DevicesResDevicesDataUnionCopyWith<DevicesResDevicesDataUnion>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DevicesResDevicesDataUnionCopyWith<$Res> {
  factory $DevicesResDevicesDataUnionCopyWith(DevicesResDevicesDataUnion value,
          $Res Function(DevicesResDevicesDataUnion) then) =
      _$DevicesResDevicesDataUnionCopyWithImpl<$Res,
          DevicesResDevicesDataUnion>;
  @useResult
  $Res call(
      {String id,
      DevicesDeviceCategory category,
      String name,
      String? description,
      List<DevicesDeviceControl> controls,
      List<DevicesChannel> channels,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt,
      @JsonKey(name: 'service_address') String serviceAddress,
      String type});
}

/// @nodoc
class _$DevicesResDevicesDataUnionCopyWithImpl<$Res,
        $Val extends DevicesResDevicesDataUnion>
    implements $DevicesResDevicesDataUnionCopyWith<$Res> {
  _$DevicesResDevicesDataUnionCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DevicesResDevicesDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? category = null,
    Object? name = null,
    Object? description = freezed,
    Object? controls = null,
    Object? channels = null,
    Object? createdAt = null,
    Object? updatedAt = freezed,
    Object? serviceAddress = null,
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
              as DevicesDeviceCategory,
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
              as List<DevicesDeviceControl>,
      channels: null == channels
          ? _value.channels
          : channels // ignore: cast_nullable_to_non_nullable
              as List<DevicesChannel>,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      serviceAddress: null == serviceAddress
          ? _value.serviceAddress
          : serviceAddress // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DevicesResDevicesDataUnionThirdPartyImplCopyWith<$Res>
    implements $DevicesResDevicesDataUnionCopyWith<$Res> {
  factory _$$DevicesResDevicesDataUnionThirdPartyImplCopyWith(
          _$DevicesResDevicesDataUnionThirdPartyImpl value,
          $Res Function(_$DevicesResDevicesDataUnionThirdPartyImpl) then) =
      __$$DevicesResDevicesDataUnionThirdPartyImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      DevicesDeviceCategory category,
      String name,
      String? description,
      List<DevicesDeviceControl> controls,
      List<DevicesChannel> channels,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt,
      @JsonKey(name: 'service_address') String serviceAddress,
      String type});
}

/// @nodoc
class __$$DevicesResDevicesDataUnionThirdPartyImplCopyWithImpl<$Res>
    extends _$DevicesResDevicesDataUnionCopyWithImpl<$Res,
        _$DevicesResDevicesDataUnionThirdPartyImpl>
    implements _$$DevicesResDevicesDataUnionThirdPartyImplCopyWith<$Res> {
  __$$DevicesResDevicesDataUnionThirdPartyImplCopyWithImpl(
      _$DevicesResDevicesDataUnionThirdPartyImpl _value,
      $Res Function(_$DevicesResDevicesDataUnionThirdPartyImpl) _then)
      : super(_value, _then);

  /// Create a copy of DevicesResDevicesDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? category = null,
    Object? name = null,
    Object? description = freezed,
    Object? controls = null,
    Object? channels = null,
    Object? createdAt = null,
    Object? updatedAt = freezed,
    Object? serviceAddress = null,
    Object? type = null,
  }) {
    return _then(_$DevicesResDevicesDataUnionThirdPartyImpl(
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
      description: freezed == description
          ? _value.description
          : description // ignore: cast_nullable_to_non_nullable
              as String?,
      controls: null == controls
          ? _value._controls
          : controls // ignore: cast_nullable_to_non_nullable
              as List<DevicesDeviceControl>,
      channels: null == channels
          ? _value._channels
          : channels // ignore: cast_nullable_to_non_nullable
              as List<DevicesChannel>,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      serviceAddress: null == serviceAddress
          ? _value.serviceAddress
          : serviceAddress // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DevicesResDevicesDataUnionThirdPartyImpl
    implements DevicesResDevicesDataUnionThirdParty {
  const _$DevicesResDevicesDataUnionThirdPartyImpl(
      {required this.id,
      required this.category,
      required this.name,
      required this.description,
      required final List<DevicesDeviceControl> controls,
      required final List<DevicesChannel> channels,
      @JsonKey(name: 'created_at') required this.createdAt,
      @JsonKey(name: 'updated_at') required this.updatedAt,
      @JsonKey(name: 'service_address') required this.serviceAddress,
      this.type = 'third-party'})
      : _controls = controls,
        _channels = channels;

  factory _$DevicesResDevicesDataUnionThirdPartyImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DevicesResDevicesDataUnionThirdPartyImplFromJson(json);

  /// System-generated unique identifier for the device.
  @override
  final String id;

  /// Type of the device, defining its purpose or category (e.g., thermostat, lighting).
  @override
  final DevicesDeviceCategory category;

  /// Human-readable name of the device.
  @override
  final String name;

  /// Optional detailed description of the device.
  @override
  final String? description;

  /// A list of controls associated with the device. Controls represent actions or commands that can be executed on the device.
  final List<DevicesDeviceControl> _controls;

  /// A list of controls associated with the device. Controls represent actions or commands that can be executed on the device.
  @override
  List<DevicesDeviceControl> get controls {
    if (_controls is EqualUnmodifiableListView) return _controls;
    // ignore: implicit_dynamic_type
    return EqualUnmodifiableListView(_controls);
  }

  /// A list of channels associated with the device. Each channel represents a functional unit of the device, such as a sensor, actuator, or logical grouping of properties.
  final List<DevicesChannel> _channels;

  /// A list of channels associated with the device. Each channel represents a functional unit of the device, such as a sensor, actuator, or logical grouping of properties.
  @override
  List<DevicesChannel> get channels {
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

  /// The address of the third-party service used by the third-party device. It can be a URL or IP address with an optional port.
  @override
  @JsonKey(name: 'service_address')
  final String serviceAddress;

  /// Specifies the type of device. This value is fixed as 'third-party' for third-party device integrations.
  @override
  @JsonKey()
  final String type;

  @override
  String toString() {
    return 'DevicesResDevicesDataUnion.thirdParty(id: $id, category: $category, name: $name, description: $description, controls: $controls, channels: $channels, createdAt: $createdAt, updatedAt: $updatedAt, serviceAddress: $serviceAddress, type: $type)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DevicesResDevicesDataUnionThirdPartyImpl &&
            (identical(other.id, id) || other.id == id) &&
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
            (identical(other.serviceAddress, serviceAddress) ||
                other.serviceAddress == serviceAddress) &&
            (identical(other.type, type) || other.type == type));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(
      runtimeType,
      id,
      category,
      name,
      description,
      const DeepCollectionEquality().hash(_controls),
      const DeepCollectionEquality().hash(_channels),
      createdAt,
      updatedAt,
      serviceAddress,
      type);

  /// Create a copy of DevicesResDevicesDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DevicesResDevicesDataUnionThirdPartyImplCopyWith<
          _$DevicesResDevicesDataUnionThirdPartyImpl>
      get copyWith => __$$DevicesResDevicesDataUnionThirdPartyImplCopyWithImpl<
          _$DevicesResDevicesDataUnionThirdPartyImpl>(this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String id,
            DevicesDeviceCategory category,
            String name,
            String? description,
            List<DevicesDeviceControl> controls,
            List<DevicesChannel> channels,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            @JsonKey(name: 'service_address') String serviceAddress,
            String type)
        thirdParty,
  }) {
    return thirdParty(id, category, name, description, controls, channels,
        createdAt, updatedAt, serviceAddress, type);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            String id,
            DevicesDeviceCategory category,
            String name,
            String? description,
            List<DevicesDeviceControl> controls,
            List<DevicesChannel> channels,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            @JsonKey(name: 'service_address') String serviceAddress,
            String type)?
        thirdParty,
  }) {
    return thirdParty?.call(id, category, name, description, controls, channels,
        createdAt, updatedAt, serviceAddress, type);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            String id,
            DevicesDeviceCategory category,
            String name,
            String? description,
            List<DevicesDeviceControl> controls,
            List<DevicesChannel> channels,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            @JsonKey(name: 'service_address') String serviceAddress,
            String type)?
        thirdParty,
    required TResult orElse(),
  }) {
    if (thirdParty != null) {
      return thirdParty(id, category, name, description, controls, channels,
          createdAt, updatedAt, serviceAddress, type);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(DevicesResDevicesDataUnionThirdParty value)
        thirdParty,
  }) {
    return thirdParty(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DevicesResDevicesDataUnionThirdParty value)? thirdParty,
  }) {
    return thirdParty?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DevicesResDevicesDataUnionThirdParty value)? thirdParty,
    required TResult orElse(),
  }) {
    if (thirdParty != null) {
      return thirdParty(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$DevicesResDevicesDataUnionThirdPartyImplToJson(
      this,
    );
  }
}

abstract class DevicesResDevicesDataUnionThirdParty
    implements DevicesResDevicesDataUnion {
  const factory DevicesResDevicesDataUnionThirdParty(
      {required final String id,
      required final DevicesDeviceCategory category,
      required final String name,
      required final String? description,
      required final List<DevicesDeviceControl> controls,
      required final List<DevicesChannel> channels,
      @JsonKey(name: 'created_at') required final DateTime createdAt,
      @JsonKey(name: 'updated_at') required final DateTime? updatedAt,
      @JsonKey(name: 'service_address') required final String serviceAddress,
      final String type}) = _$DevicesResDevicesDataUnionThirdPartyImpl;

  factory DevicesResDevicesDataUnionThirdParty.fromJson(
          Map<String, dynamic> json) =
      _$DevicesResDevicesDataUnionThirdPartyImpl.fromJson;

  /// System-generated unique identifier for the device.
  @override
  String get id;

  /// Type of the device, defining its purpose or category (e.g., thermostat, lighting).
  @override
  DevicesDeviceCategory get category;

  /// Human-readable name of the device.
  @override
  String get name;

  /// Optional detailed description of the device.
  @override
  String? get description;

  /// A list of controls associated with the device. Controls represent actions or commands that can be executed on the device.
  @override
  List<DevicesDeviceControl> get controls;

  /// A list of channels associated with the device. Each channel represents a functional unit of the device, such as a sensor, actuator, or logical grouping of properties.
  @override
  List<DevicesChannel> get channels;

  /// Timestamp indicating when the device was created.
  @override
  @JsonKey(name: 'created_at')
  DateTime get createdAt;

  /// Timestamp indicating when the device was last updated, if applicable.
  @override
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt;

  /// The address of the third-party service used by the third-party device. It can be a URL or IP address with an optional port.
  @override
  @JsonKey(name: 'service_address')
  String get serviceAddress;

  /// Specifies the type of device. This value is fixed as 'third-party' for third-party device integrations.
  @override
  String get type;

  /// Create a copy of DevicesResDevicesDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DevicesResDevicesDataUnionThirdPartyImplCopyWith<
          _$DevicesResDevicesDataUnionThirdPartyImpl>
      get copyWith => throw _privateConstructorUsedError;
}
