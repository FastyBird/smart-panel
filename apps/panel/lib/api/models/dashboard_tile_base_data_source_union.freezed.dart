// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_tile_base_data_source_union.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardTileBaseDataSourceUnion _$DashboardTileBaseDataSourceUnionFromJson(
    Map<String, dynamic> json) {
  return DashboardTileBaseDataSourceUnionDeviceChannel.fromJson(json);
}

/// @nodoc
mixin _$DashboardTileBaseDataSourceUnion {
  /// A unique identifier for the data source.
  String get id => throw _privateConstructorUsedError;

  /// The timestamp when the data source was created.
  @JsonKey(name: 'created_at')
  DateTime get createdAt => throw _privateConstructorUsedError;

  /// The timestamp when the data source was last updated.
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt => throw _privateConstructorUsedError;

  /// The unique identifier of the associated device.
  String get device => throw _privateConstructorUsedError;

  /// The unique identifier of the associated channel.
  String get channel => throw _privateConstructorUsedError;

  /// The unique identifier of the associated channel property.
  String get property => throw _privateConstructorUsedError;

  /// The icon representing the data source.
  String? get icon => throw _privateConstructorUsedError;

  /// Indicates that this data source is linked to a device channel.
  String get type => throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String id,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String device,
            String channel,
            String property,
            String? icon,
            String type)
        deviceChannel,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            String id,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String device,
            String channel,
            String property,
            String? icon,
            String type)?
        deviceChannel,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            String id,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String device,
            String channel,
            String property,
            String? icon,
            String type)?
        deviceChannel,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(
            DashboardTileBaseDataSourceUnionDeviceChannel value)
        deviceChannel,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardTileBaseDataSourceUnionDeviceChannel value)?
        deviceChannel,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardTileBaseDataSourceUnionDeviceChannel value)?
        deviceChannel,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;

  /// Serializes this DashboardTileBaseDataSourceUnion to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardTileBaseDataSourceUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardTileBaseDataSourceUnionCopyWith<DashboardTileBaseDataSourceUnion>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardTileBaseDataSourceUnionCopyWith<$Res> {
  factory $DashboardTileBaseDataSourceUnionCopyWith(
          DashboardTileBaseDataSourceUnion value,
          $Res Function(DashboardTileBaseDataSourceUnion) then) =
      _$DashboardTileBaseDataSourceUnionCopyWithImpl<$Res,
          DashboardTileBaseDataSourceUnion>;
  @useResult
  $Res call(
      {String id,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt,
      String device,
      String channel,
      String property,
      String? icon,
      String type});
}

/// @nodoc
class _$DashboardTileBaseDataSourceUnionCopyWithImpl<$Res,
        $Val extends DashboardTileBaseDataSourceUnion>
    implements $DashboardTileBaseDataSourceUnionCopyWith<$Res> {
  _$DashboardTileBaseDataSourceUnionCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardTileBaseDataSourceUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? createdAt = null,
    Object? updatedAt = freezed,
    Object? device = null,
    Object? channel = null,
    Object? property = null,
    Object? icon = freezed,
    Object? type = null,
  }) {
    return _then(_value.copyWith(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      device: null == device
          ? _value.device
          : device // ignore: cast_nullable_to_non_nullable
              as String,
      channel: null == channel
          ? _value.channel
          : channel // ignore: cast_nullable_to_non_nullable
              as String,
      property: null == property
          ? _value.property
          : property // ignore: cast_nullable_to_non_nullable
              as String,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DashboardTileBaseDataSourceUnionDeviceChannelImplCopyWith<
    $Res> implements $DashboardTileBaseDataSourceUnionCopyWith<$Res> {
  factory _$$DashboardTileBaseDataSourceUnionDeviceChannelImplCopyWith(
          _$DashboardTileBaseDataSourceUnionDeviceChannelImpl value,
          $Res Function(_$DashboardTileBaseDataSourceUnionDeviceChannelImpl)
              then) =
      __$$DashboardTileBaseDataSourceUnionDeviceChannelImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt,
      String device,
      String channel,
      String property,
      String? icon,
      String type});
}

/// @nodoc
class __$$DashboardTileBaseDataSourceUnionDeviceChannelImplCopyWithImpl<$Res>
    extends _$DashboardTileBaseDataSourceUnionCopyWithImpl<$Res,
        _$DashboardTileBaseDataSourceUnionDeviceChannelImpl>
    implements
        _$$DashboardTileBaseDataSourceUnionDeviceChannelImplCopyWith<$Res> {
  __$$DashboardTileBaseDataSourceUnionDeviceChannelImplCopyWithImpl(
      _$DashboardTileBaseDataSourceUnionDeviceChannelImpl _value,
      $Res Function(_$DashboardTileBaseDataSourceUnionDeviceChannelImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardTileBaseDataSourceUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? createdAt = null,
    Object? updatedAt = freezed,
    Object? device = null,
    Object? channel = null,
    Object? property = null,
    Object? icon = freezed,
    Object? type = null,
  }) {
    return _then(_$DashboardTileBaseDataSourceUnionDeviceChannelImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
      createdAt: null == createdAt
          ? _value.createdAt
          : createdAt // ignore: cast_nullable_to_non_nullable
              as DateTime,
      updatedAt: freezed == updatedAt
          ? _value.updatedAt
          : updatedAt // ignore: cast_nullable_to_non_nullable
              as DateTime?,
      device: null == device
          ? _value.device
          : device // ignore: cast_nullable_to_non_nullable
              as String,
      channel: null == channel
          ? _value.channel
          : channel // ignore: cast_nullable_to_non_nullable
              as String,
      property: null == property
          ? _value.property
          : property // ignore: cast_nullable_to_non_nullable
              as String,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
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
class _$DashboardTileBaseDataSourceUnionDeviceChannelImpl
    implements DashboardTileBaseDataSourceUnionDeviceChannel {
  const _$DashboardTileBaseDataSourceUnionDeviceChannelImpl(
      {required this.id,
      @JsonKey(name: 'created_at') required this.createdAt,
      @JsonKey(name: 'updated_at') required this.updatedAt,
      required this.device,
      required this.channel,
      required this.property,
      required this.icon,
      this.type = 'device-channel'});

  factory _$DashboardTileBaseDataSourceUnionDeviceChannelImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardTileBaseDataSourceUnionDeviceChannelImplFromJson(json);

  /// A unique identifier for the data source.
  @override
  final String id;

  /// The timestamp when the data source was created.
  @override
  @JsonKey(name: 'created_at')
  final DateTime createdAt;

  /// The timestamp when the data source was last updated.
  @override
  @JsonKey(name: 'updated_at')
  final DateTime? updatedAt;

  /// The unique identifier of the associated device.
  @override
  final String device;

  /// The unique identifier of the associated channel.
  @override
  final String channel;

  /// The unique identifier of the associated channel property.
  @override
  final String property;

  /// The icon representing the data source.
  @override
  final String? icon;

  /// Indicates that this data source is linked to a device channel.
  @override
  @JsonKey()
  final String type;

  @override
  String toString() {
    return 'DashboardTileBaseDataSourceUnion.deviceChannel(id: $id, createdAt: $createdAt, updatedAt: $updatedAt, device: $device, channel: $channel, property: $property, icon: $icon, type: $type)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardTileBaseDataSourceUnionDeviceChannelImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.createdAt, createdAt) ||
                other.createdAt == createdAt) &&
            (identical(other.updatedAt, updatedAt) ||
                other.updatedAt == updatedAt) &&
            (identical(other.device, device) || other.device == device) &&
            (identical(other.channel, channel) || other.channel == channel) &&
            (identical(other.property, property) ||
                other.property == property) &&
            (identical(other.icon, icon) || other.icon == icon) &&
            (identical(other.type, type) || other.type == type));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, createdAt, updatedAt, device,
      channel, property, icon, type);

  /// Create a copy of DashboardTileBaseDataSourceUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardTileBaseDataSourceUnionDeviceChannelImplCopyWith<
          _$DashboardTileBaseDataSourceUnionDeviceChannelImpl>
      get copyWith =>
          __$$DashboardTileBaseDataSourceUnionDeviceChannelImplCopyWithImpl<
                  _$DashboardTileBaseDataSourceUnionDeviceChannelImpl>(
              this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String id,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String device,
            String channel,
            String property,
            String? icon,
            String type)
        deviceChannel,
  }) {
    return deviceChannel(
        id, createdAt, updatedAt, device, channel, property, icon, type);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(
            String id,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String device,
            String channel,
            String property,
            String? icon,
            String type)?
        deviceChannel,
  }) {
    return deviceChannel?.call(
        id, createdAt, updatedAt, device, channel, property, icon, type);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(
            String id,
            @JsonKey(name: 'created_at') DateTime createdAt,
            @JsonKey(name: 'updated_at') DateTime? updatedAt,
            String device,
            String channel,
            String property,
            String? icon,
            String type)?
        deviceChannel,
    required TResult orElse(),
  }) {
    if (deviceChannel != null) {
      return deviceChannel(
          id, createdAt, updatedAt, device, channel, property, icon, type);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(
            DashboardTileBaseDataSourceUnionDeviceChannel value)
        deviceChannel,
  }) {
    return deviceChannel(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardTileBaseDataSourceUnionDeviceChannel value)?
        deviceChannel,
  }) {
    return deviceChannel?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardTileBaseDataSourceUnionDeviceChannel value)?
        deviceChannel,
    required TResult orElse(),
  }) {
    if (deviceChannel != null) {
      return deviceChannel(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardTileBaseDataSourceUnionDeviceChannelImplToJson(
      this,
    );
  }
}

abstract class DashboardTileBaseDataSourceUnionDeviceChannel
    implements DashboardTileBaseDataSourceUnion {
  const factory DashboardTileBaseDataSourceUnionDeviceChannel(
      {required final String id,
      @JsonKey(name: 'created_at') required final DateTime createdAt,
      @JsonKey(name: 'updated_at') required final DateTime? updatedAt,
      required final String device,
      required final String channel,
      required final String property,
      required final String? icon,
      final String type}) = _$DashboardTileBaseDataSourceUnionDeviceChannelImpl;

  factory DashboardTileBaseDataSourceUnionDeviceChannel.fromJson(
          Map<String, dynamic> json) =
      _$DashboardTileBaseDataSourceUnionDeviceChannelImpl.fromJson;

  /// A unique identifier for the data source.
  @override
  String get id;

  /// The timestamp when the data source was created.
  @override
  @JsonKey(name: 'created_at')
  DateTime get createdAt;

  /// The timestamp when the data source was last updated.
  @override
  @JsonKey(name: 'updated_at')
  DateTime? get updatedAt;

  /// The unique identifier of the associated device.
  @override
  String get device;

  /// The unique identifier of the associated channel.
  @override
  String get channel;

  /// The unique identifier of the associated channel property.
  @override
  String get property;

  /// The icon representing the data source.
  @override
  String? get icon;

  /// Indicates that this data source is linked to a device channel.
  @override
  String get type;

  /// Create a copy of DashboardTileBaseDataSourceUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardTileBaseDataSourceUnionDeviceChannelImplCopyWith<
          _$DashboardTileBaseDataSourceUnionDeviceChannelImpl>
      get copyWith => throw _privateConstructorUsedError;
}
