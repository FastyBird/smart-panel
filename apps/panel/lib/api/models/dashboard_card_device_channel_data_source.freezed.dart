// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_card_device_channel_data_source.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardCardDeviceChannelDataSource
    _$DashboardCardDeviceChannelDataSourceFromJson(Map<String, dynamic> json) {
  return _DashboardCardDeviceChannelDataSource.fromJson(json);
}

/// @nodoc
mixin _$DashboardCardDeviceChannelDataSource {
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

  /// The unique identifier of the associated card.
  String get card => throw _privateConstructorUsedError;

  /// Indicates that this data source is linked to a device channel.
  String get type => throw _privateConstructorUsedError;

  /// Serializes this DashboardCardDeviceChannelDataSource to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardCardDeviceChannelDataSource
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardCardDeviceChannelDataSourceCopyWith<
          DashboardCardDeviceChannelDataSource>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardCardDeviceChannelDataSourceCopyWith<$Res> {
  factory $DashboardCardDeviceChannelDataSourceCopyWith(
          DashboardCardDeviceChannelDataSource value,
          $Res Function(DashboardCardDeviceChannelDataSource) then) =
      _$DashboardCardDeviceChannelDataSourceCopyWithImpl<$Res,
          DashboardCardDeviceChannelDataSource>;
  @useResult
  $Res call(
      {String id,
      @JsonKey(name: 'created_at') DateTime createdAt,
      @JsonKey(name: 'updated_at') DateTime? updatedAt,
      String device,
      String channel,
      String property,
      String? icon,
      String card,
      String type});
}

/// @nodoc
class _$DashboardCardDeviceChannelDataSourceCopyWithImpl<$Res,
        $Val extends DashboardCardDeviceChannelDataSource>
    implements $DashboardCardDeviceChannelDataSourceCopyWith<$Res> {
  _$DashboardCardDeviceChannelDataSourceCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardCardDeviceChannelDataSource
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
    Object? card = null,
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
      card: null == card
          ? _value.card
          : card // ignore: cast_nullable_to_non_nullable
              as String,
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DashboardCardDeviceChannelDataSourceImplCopyWith<$Res>
    implements $DashboardCardDeviceChannelDataSourceCopyWith<$Res> {
  factory _$$DashboardCardDeviceChannelDataSourceImplCopyWith(
          _$DashboardCardDeviceChannelDataSourceImpl value,
          $Res Function(_$DashboardCardDeviceChannelDataSourceImpl) then) =
      __$$DashboardCardDeviceChannelDataSourceImplCopyWithImpl<$Res>;
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
      String card,
      String type});
}

/// @nodoc
class __$$DashboardCardDeviceChannelDataSourceImplCopyWithImpl<$Res>
    extends _$DashboardCardDeviceChannelDataSourceCopyWithImpl<$Res,
        _$DashboardCardDeviceChannelDataSourceImpl>
    implements _$$DashboardCardDeviceChannelDataSourceImplCopyWith<$Res> {
  __$$DashboardCardDeviceChannelDataSourceImplCopyWithImpl(
      _$DashboardCardDeviceChannelDataSourceImpl _value,
      $Res Function(_$DashboardCardDeviceChannelDataSourceImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardCardDeviceChannelDataSource
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
    Object? card = null,
    Object? type = null,
  }) {
    return _then(_$DashboardCardDeviceChannelDataSourceImpl(
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
      card: null == card
          ? _value.card
          : card // ignore: cast_nullable_to_non_nullable
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
class _$DashboardCardDeviceChannelDataSourceImpl
    implements _DashboardCardDeviceChannelDataSource {
  const _$DashboardCardDeviceChannelDataSourceImpl(
      {required this.id,
      @JsonKey(name: 'created_at') required this.createdAt,
      @JsonKey(name: 'updated_at') required this.updatedAt,
      required this.device,
      required this.channel,
      required this.property,
      required this.icon,
      required this.card,
      this.type = 'device-channel'});

  factory _$DashboardCardDeviceChannelDataSourceImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardCardDeviceChannelDataSourceImplFromJson(json);

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

  /// The unique identifier of the associated card.
  @override
  final String card;

  /// Indicates that this data source is linked to a device channel.
  @override
  @JsonKey()
  final String type;

  @override
  String toString() {
    return 'DashboardCardDeviceChannelDataSource(id: $id, createdAt: $createdAt, updatedAt: $updatedAt, device: $device, channel: $channel, property: $property, icon: $icon, card: $card, type: $type)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardCardDeviceChannelDataSourceImpl &&
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
            (identical(other.card, card) || other.card == card) &&
            (identical(other.type, type) || other.type == type));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, id, createdAt, updatedAt, device,
      channel, property, icon, card, type);

  /// Create a copy of DashboardCardDeviceChannelDataSource
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardCardDeviceChannelDataSourceImplCopyWith<
          _$DashboardCardDeviceChannelDataSourceImpl>
      get copyWith => __$$DashboardCardDeviceChannelDataSourceImplCopyWithImpl<
          _$DashboardCardDeviceChannelDataSourceImpl>(this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardCardDeviceChannelDataSourceImplToJson(
      this,
    );
  }
}

abstract class _DashboardCardDeviceChannelDataSource
    implements DashboardCardDeviceChannelDataSource {
  const factory _DashboardCardDeviceChannelDataSource(
      {required final String id,
      @JsonKey(name: 'created_at') required final DateTime createdAt,
      @JsonKey(name: 'updated_at') required final DateTime? updatedAt,
      required final String device,
      required final String channel,
      required final String property,
      required final String? icon,
      required final String card,
      final String type}) = _$DashboardCardDeviceChannelDataSourceImpl;

  factory _DashboardCardDeviceChannelDataSource.fromJson(
          Map<String, dynamic> json) =
      _$DashboardCardDeviceChannelDataSourceImpl.fromJson;

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

  /// The unique identifier of the associated card.
  @override
  String get card;

  /// Indicates that this data source is linked to a device channel.
  @override
  String get type;

  /// Create a copy of DashboardCardDeviceChannelDataSource
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardCardDeviceChannelDataSourceImplCopyWith<
          _$DashboardCardDeviceChannelDataSourceImpl>
      get copyWith => throw _privateConstructorUsedError;
}
