// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_create_tiles_page_data_source_union.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardCreateTilesPageDataSourceUnion
    _$DashboardCreateTilesPageDataSourceUnionFromJson(
        Map<String, dynamic> json) {
  return DashboardCreateDeviceChannelDataSource.fromJson(json);
}

/// @nodoc
mixin _$DashboardCreateTilesPageDataSourceUnion {
  /// Unique identifier for the data source (optional during creation).
  String get id => throw _privateConstructorUsedError;

  /// The unique identifier of the associated device.
  String get device => throw _privateConstructorUsedError;

  /// The unique identifier of the associated channel within the device.
  String get channel => throw _privateConstructorUsedError;

  /// The unique identifier of the associated property within the channel.
  String get property => throw _privateConstructorUsedError;

  /// The icon representing the data source.
  String? get icon => throw _privateConstructorUsedError;

  /// Specifies the type of data source as linked to a device channel.
  String get type => throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(String id, String device, String channel,
            String property, String? icon, String type)
        deviceChannel,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(String id, String device, String channel, String property,
            String? icon, String type)?
        deviceChannel,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(String id, String device, String channel, String property,
            String? icon, String type)?
        deviceChannel,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(DashboardCreateDeviceChannelDataSource value)
        deviceChannel,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardCreateDeviceChannelDataSource value)?
        deviceChannel,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardCreateDeviceChannelDataSource value)?
        deviceChannel,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;

  /// Serializes this DashboardCreateTilesPageDataSourceUnion to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardCreateTilesPageDataSourceUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardCreateTilesPageDataSourceUnionCopyWith<
          DashboardCreateTilesPageDataSourceUnion>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardCreateTilesPageDataSourceUnionCopyWith<$Res> {
  factory $DashboardCreateTilesPageDataSourceUnionCopyWith(
          DashboardCreateTilesPageDataSourceUnion value,
          $Res Function(DashboardCreateTilesPageDataSourceUnion) then) =
      _$DashboardCreateTilesPageDataSourceUnionCopyWithImpl<$Res,
          DashboardCreateTilesPageDataSourceUnion>;
  @useResult
  $Res call(
      {String id,
      String device,
      String channel,
      String property,
      String? icon,
      String type});
}

/// @nodoc
class _$DashboardCreateTilesPageDataSourceUnionCopyWithImpl<$Res,
        $Val extends DashboardCreateTilesPageDataSourceUnion>
    implements $DashboardCreateTilesPageDataSourceUnionCopyWith<$Res> {
  _$DashboardCreateTilesPageDataSourceUnionCopyWithImpl(
      this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardCreateTilesPageDataSourceUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
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
abstract class _$$DashboardCreateDeviceChannelDataSourceImplCopyWith<$Res>
    implements $DashboardCreateTilesPageDataSourceUnionCopyWith<$Res> {
  factory _$$DashboardCreateDeviceChannelDataSourceImplCopyWith(
          _$DashboardCreateDeviceChannelDataSourceImpl value,
          $Res Function(_$DashboardCreateDeviceChannelDataSourceImpl) then) =
      __$$DashboardCreateDeviceChannelDataSourceImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String id,
      String device,
      String channel,
      String property,
      String? icon,
      String type});
}

/// @nodoc
class __$$DashboardCreateDeviceChannelDataSourceImplCopyWithImpl<$Res>
    extends _$DashboardCreateTilesPageDataSourceUnionCopyWithImpl<$Res,
        _$DashboardCreateDeviceChannelDataSourceImpl>
    implements _$$DashboardCreateDeviceChannelDataSourceImplCopyWith<$Res> {
  __$$DashboardCreateDeviceChannelDataSourceImplCopyWithImpl(
      _$DashboardCreateDeviceChannelDataSourceImpl _value,
      $Res Function(_$DashboardCreateDeviceChannelDataSourceImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardCreateTilesPageDataSourceUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? id = null,
    Object? device = null,
    Object? channel = null,
    Object? property = null,
    Object? icon = freezed,
    Object? type = null,
  }) {
    return _then(_$DashboardCreateDeviceChannelDataSourceImpl(
      id: null == id
          ? _value.id
          : id // ignore: cast_nullable_to_non_nullable
              as String,
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
class _$DashboardCreateDeviceChannelDataSourceImpl
    implements DashboardCreateDeviceChannelDataSource {
  const _$DashboardCreateDeviceChannelDataSourceImpl(
      {required this.id,
      required this.device,
      required this.channel,
      required this.property,
      this.icon,
      this.type = 'device-channel'});

  factory _$DashboardCreateDeviceChannelDataSourceImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardCreateDeviceChannelDataSourceImplFromJson(json);

  /// Unique identifier for the data source (optional during creation).
  @override
  final String id;

  /// The unique identifier of the associated device.
  @override
  final String device;

  /// The unique identifier of the associated channel within the device.
  @override
  final String channel;

  /// The unique identifier of the associated property within the channel.
  @override
  final String property;

  /// The icon representing the data source.
  @override
  final String? icon;

  /// Specifies the type of data source as linked to a device channel.
  @override
  @JsonKey()
  final String type;

  @override
  String toString() {
    return 'DashboardCreateTilesPageDataSourceUnion.deviceChannel(id: $id, device: $device, channel: $channel, property: $property, icon: $icon, type: $type)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardCreateDeviceChannelDataSourceImpl &&
            (identical(other.id, id) || other.id == id) &&
            (identical(other.device, device) || other.device == device) &&
            (identical(other.channel, channel) || other.channel == channel) &&
            (identical(other.property, property) ||
                other.property == property) &&
            (identical(other.icon, icon) || other.icon == icon) &&
            (identical(other.type, type) || other.type == type));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, id, device, channel, property, icon, type);

  /// Create a copy of DashboardCreateTilesPageDataSourceUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardCreateDeviceChannelDataSourceImplCopyWith<
          _$DashboardCreateDeviceChannelDataSourceImpl>
      get copyWith =>
          __$$DashboardCreateDeviceChannelDataSourceImplCopyWithImpl<
              _$DashboardCreateDeviceChannelDataSourceImpl>(this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(String id, String device, String channel,
            String property, String? icon, String type)
        deviceChannel,
  }) {
    return deviceChannel(id, device, channel, property, icon, type);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(String id, String device, String channel, String property,
            String? icon, String type)?
        deviceChannel,
  }) {
    return deviceChannel?.call(id, device, channel, property, icon, type);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(String id, String device, String channel, String property,
            String? icon, String type)?
        deviceChannel,
    required TResult orElse(),
  }) {
    if (deviceChannel != null) {
      return deviceChannel(id, device, channel, property, icon, type);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(DashboardCreateDeviceChannelDataSource value)
        deviceChannel,
  }) {
    return deviceChannel(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardCreateDeviceChannelDataSource value)?
        deviceChannel,
  }) {
    return deviceChannel?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardCreateDeviceChannelDataSource value)?
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
    return _$$DashboardCreateDeviceChannelDataSourceImplToJson(
      this,
    );
  }
}

abstract class DashboardCreateDeviceChannelDataSource
    implements DashboardCreateTilesPageDataSourceUnion {
  const factory DashboardCreateDeviceChannelDataSource(
      {required final String id,
      required final String device,
      required final String channel,
      required final String property,
      final String? icon,
      final String type}) = _$DashboardCreateDeviceChannelDataSourceImpl;

  factory DashboardCreateDeviceChannelDataSource.fromJson(
          Map<String, dynamic> json) =
      _$DashboardCreateDeviceChannelDataSourceImpl.fromJson;

  /// Unique identifier for the data source (optional during creation).
  @override
  String get id;

  /// The unique identifier of the associated device.
  @override
  String get device;

  /// The unique identifier of the associated channel within the device.
  @override
  String get channel;

  /// The unique identifier of the associated property within the channel.
  @override
  String get property;

  /// The icon representing the data source.
  @override
  String? get icon;

  /// Specifies the type of data source as linked to a device channel.
  @override
  String get type;

  /// Create a copy of DashboardCreateTilesPageDataSourceUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardCreateDeviceChannelDataSourceImplCopyWith<
          _$DashboardCreateDeviceChannelDataSourceImpl>
      get copyWith => throw _privateConstructorUsedError;
}
