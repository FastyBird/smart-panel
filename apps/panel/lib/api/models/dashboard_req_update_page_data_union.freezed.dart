// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_req_update_page_data_union.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardReqUpdatePageDataUnion _$DashboardReqUpdatePageDataUnionFromJson(
    Map<String, dynamic> json) {
  switch (json['type']) {
    case 'cards':
      return DashboardReqUpdatePageDataUnionCards.fromJson(json);
    case 'tiles':
      return DashboardReqUpdatePageDataUnionTiles.fromJson(json);
    case 'device-detail':
      return DashboardReqUpdatePageDataUnionDeviceDetail.fromJson(json);

    default:
      throw CheckedFromJsonException(
          json,
          'type',
          'DashboardReqUpdatePageDataUnion',
          'Invalid union type "${json['type']}"!');
  }
}

/// @nodoc
mixin _$DashboardReqUpdatePageDataUnion {
  /// Discriminator for the page type
  String get type => throw _privateConstructorUsedError;

  /// The title of the page.
  String get title => throw _privateConstructorUsedError;

  /// The display order of the page.
  int get order => throw _privateConstructorUsedError;

  /// The icon associated with the page.
  String? get icon => throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String type, String title, int order, String? icon)
        cards,
    required TResult Function(
            String type, String title, int order, String? icon)
        tiles,
    required TResult Function(
            String type, String title, int order, String device, String? icon)
        deviceDetail,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(String type, String title, int order, String? icon)?
        cards,
    TResult? Function(String type, String title, int order, String? icon)?
        tiles,
    TResult? Function(
            String type, String title, int order, String device, String? icon)?
        deviceDetail,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(String type, String title, int order, String? icon)? cards,
    TResult Function(String type, String title, int order, String? icon)? tiles,
    TResult Function(
            String type, String title, int order, String device, String? icon)?
        deviceDetail,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(DashboardReqUpdatePageDataUnionCards value) cards,
    required TResult Function(DashboardReqUpdatePageDataUnionTiles value) tiles,
    required TResult Function(DashboardReqUpdatePageDataUnionDeviceDetail value)
        deviceDetail,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardReqUpdatePageDataUnionCards value)? cards,
    TResult? Function(DashboardReqUpdatePageDataUnionTiles value)? tiles,
    TResult? Function(DashboardReqUpdatePageDataUnionDeviceDetail value)?
        deviceDetail,
  }) =>
      throw _privateConstructorUsedError;
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardReqUpdatePageDataUnionCards value)? cards,
    TResult Function(DashboardReqUpdatePageDataUnionTiles value)? tiles,
    TResult Function(DashboardReqUpdatePageDataUnionDeviceDetail value)?
        deviceDetail,
    required TResult orElse(),
  }) =>
      throw _privateConstructorUsedError;

  /// Serializes this DashboardReqUpdatePageDataUnion to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardReqUpdatePageDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardReqUpdatePageDataUnionCopyWith<DashboardReqUpdatePageDataUnion>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardReqUpdatePageDataUnionCopyWith<$Res> {
  factory $DashboardReqUpdatePageDataUnionCopyWith(
          DashboardReqUpdatePageDataUnion value,
          $Res Function(DashboardReqUpdatePageDataUnion) then) =
      _$DashboardReqUpdatePageDataUnionCopyWithImpl<$Res,
          DashboardReqUpdatePageDataUnion>;
  @useResult
  $Res call({String type, String title, int order, String? icon});
}

/// @nodoc
class _$DashboardReqUpdatePageDataUnionCopyWithImpl<$Res,
        $Val extends DashboardReqUpdatePageDataUnion>
    implements $DashboardReqUpdatePageDataUnionCopyWith<$Res> {
  _$DashboardReqUpdatePageDataUnionCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardReqUpdatePageDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = null,
    Object? title = null,
    Object? order = null,
    Object? icon = freezed,
  }) {
    return _then(_value.copyWith(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      order: null == order
          ? _value.order
          : order // ignore: cast_nullable_to_non_nullable
              as int,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
    ) as $Val);
  }
}

/// @nodoc
abstract class _$$DashboardReqUpdatePageDataUnionCardsImplCopyWith<$Res>
    implements $DashboardReqUpdatePageDataUnionCopyWith<$Res> {
  factory _$$DashboardReqUpdatePageDataUnionCardsImplCopyWith(
          _$DashboardReqUpdatePageDataUnionCardsImpl value,
          $Res Function(_$DashboardReqUpdatePageDataUnionCardsImpl) then) =
      __$$DashboardReqUpdatePageDataUnionCardsImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String type, String title, int order, String? icon});
}

/// @nodoc
class __$$DashboardReqUpdatePageDataUnionCardsImplCopyWithImpl<$Res>
    extends _$DashboardReqUpdatePageDataUnionCopyWithImpl<$Res,
        _$DashboardReqUpdatePageDataUnionCardsImpl>
    implements _$$DashboardReqUpdatePageDataUnionCardsImplCopyWith<$Res> {
  __$$DashboardReqUpdatePageDataUnionCardsImplCopyWithImpl(
      _$DashboardReqUpdatePageDataUnionCardsImpl _value,
      $Res Function(_$DashboardReqUpdatePageDataUnionCardsImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardReqUpdatePageDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = null,
    Object? title = null,
    Object? order = null,
    Object? icon = freezed,
  }) {
    return _then(_$DashboardReqUpdatePageDataUnionCardsImpl(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      order: null == order
          ? _value.order
          : order // ignore: cast_nullable_to_non_nullable
              as int,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardReqUpdatePageDataUnionCardsImpl
    implements DashboardReqUpdatePageDataUnionCards {
  const _$DashboardReqUpdatePageDataUnionCardsImpl(
      {required this.type,
      required this.title,
      required this.order,
      this.icon});

  factory _$DashboardReqUpdatePageDataUnionCardsImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardReqUpdatePageDataUnionCardsImplFromJson(json);

  /// Discriminator for the page type
  @override
  final String type;

  /// The title of the page.
  @override
  final String title;

  /// The display order of the page.
  @override
  final int order;

  /// The icon associated with the page.
  @override
  final String? icon;

  @override
  String toString() {
    return 'DashboardReqUpdatePageDataUnion.cards(type: $type, title: $title, order: $order, icon: $icon)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardReqUpdatePageDataUnionCardsImpl &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.order, order) || other.order == order) &&
            (identical(other.icon, icon) || other.icon == icon));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, type, title, order, icon);

  /// Create a copy of DashboardReqUpdatePageDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardReqUpdatePageDataUnionCardsImplCopyWith<
          _$DashboardReqUpdatePageDataUnionCardsImpl>
      get copyWith => __$$DashboardReqUpdatePageDataUnionCardsImplCopyWithImpl<
          _$DashboardReqUpdatePageDataUnionCardsImpl>(this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String type, String title, int order, String? icon)
        cards,
    required TResult Function(
            String type, String title, int order, String? icon)
        tiles,
    required TResult Function(
            String type, String title, int order, String device, String? icon)
        deviceDetail,
  }) {
    return cards(type, title, order, icon);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(String type, String title, int order, String? icon)?
        cards,
    TResult? Function(String type, String title, int order, String? icon)?
        tiles,
    TResult? Function(
            String type, String title, int order, String device, String? icon)?
        deviceDetail,
  }) {
    return cards?.call(type, title, order, icon);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(String type, String title, int order, String? icon)? cards,
    TResult Function(String type, String title, int order, String? icon)? tiles,
    TResult Function(
            String type, String title, int order, String device, String? icon)?
        deviceDetail,
    required TResult orElse(),
  }) {
    if (cards != null) {
      return cards(type, title, order, icon);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(DashboardReqUpdatePageDataUnionCards value) cards,
    required TResult Function(DashboardReqUpdatePageDataUnionTiles value) tiles,
    required TResult Function(DashboardReqUpdatePageDataUnionDeviceDetail value)
        deviceDetail,
  }) {
    return cards(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardReqUpdatePageDataUnionCards value)? cards,
    TResult? Function(DashboardReqUpdatePageDataUnionTiles value)? tiles,
    TResult? Function(DashboardReqUpdatePageDataUnionDeviceDetail value)?
        deviceDetail,
  }) {
    return cards?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardReqUpdatePageDataUnionCards value)? cards,
    TResult Function(DashboardReqUpdatePageDataUnionTiles value)? tiles,
    TResult Function(DashboardReqUpdatePageDataUnionDeviceDetail value)?
        deviceDetail,
    required TResult orElse(),
  }) {
    if (cards != null) {
      return cards(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardReqUpdatePageDataUnionCardsImplToJson(
      this,
    );
  }
}

abstract class DashboardReqUpdatePageDataUnionCards
    implements DashboardReqUpdatePageDataUnion {
  const factory DashboardReqUpdatePageDataUnionCards(
      {required final String type,
      required final String title,
      required final int order,
      final String? icon}) = _$DashboardReqUpdatePageDataUnionCardsImpl;

  factory DashboardReqUpdatePageDataUnionCards.fromJson(
          Map<String, dynamic> json) =
      _$DashboardReqUpdatePageDataUnionCardsImpl.fromJson;

  /// Discriminator for the page type
  @override
  String get type;

  /// The title of the page.
  @override
  String get title;

  /// The display order of the page.
  @override
  int get order;

  /// The icon associated with the page.
  @override
  String? get icon;

  /// Create a copy of DashboardReqUpdatePageDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardReqUpdatePageDataUnionCardsImplCopyWith<
          _$DashboardReqUpdatePageDataUnionCardsImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$DashboardReqUpdatePageDataUnionTilesImplCopyWith<$Res>
    implements $DashboardReqUpdatePageDataUnionCopyWith<$Res> {
  factory _$$DashboardReqUpdatePageDataUnionTilesImplCopyWith(
          _$DashboardReqUpdatePageDataUnionTilesImpl value,
          $Res Function(_$DashboardReqUpdatePageDataUnionTilesImpl) then) =
      __$$DashboardReqUpdatePageDataUnionTilesImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String type, String title, int order, String? icon});
}

/// @nodoc
class __$$DashboardReqUpdatePageDataUnionTilesImplCopyWithImpl<$Res>
    extends _$DashboardReqUpdatePageDataUnionCopyWithImpl<$Res,
        _$DashboardReqUpdatePageDataUnionTilesImpl>
    implements _$$DashboardReqUpdatePageDataUnionTilesImplCopyWith<$Res> {
  __$$DashboardReqUpdatePageDataUnionTilesImplCopyWithImpl(
      _$DashboardReqUpdatePageDataUnionTilesImpl _value,
      $Res Function(_$DashboardReqUpdatePageDataUnionTilesImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardReqUpdatePageDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = null,
    Object? title = null,
    Object? order = null,
    Object? icon = freezed,
  }) {
    return _then(_$DashboardReqUpdatePageDataUnionTilesImpl(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      order: null == order
          ? _value.order
          : order // ignore: cast_nullable_to_non_nullable
              as int,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardReqUpdatePageDataUnionTilesImpl
    implements DashboardReqUpdatePageDataUnionTiles {
  const _$DashboardReqUpdatePageDataUnionTilesImpl(
      {required this.type,
      required this.title,
      required this.order,
      this.icon});

  factory _$DashboardReqUpdatePageDataUnionTilesImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardReqUpdatePageDataUnionTilesImplFromJson(json);

  /// Discriminator for the page type
  @override
  final String type;

  /// The title of the page.
  @override
  final String title;

  /// The display order of the page.
  @override
  final int order;

  /// The icon associated with the page.
  @override
  final String? icon;

  @override
  String toString() {
    return 'DashboardReqUpdatePageDataUnion.tiles(type: $type, title: $title, order: $order, icon: $icon)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardReqUpdatePageDataUnionTilesImpl &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.order, order) || other.order == order) &&
            (identical(other.icon, icon) || other.icon == icon));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, type, title, order, icon);

  /// Create a copy of DashboardReqUpdatePageDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardReqUpdatePageDataUnionTilesImplCopyWith<
          _$DashboardReqUpdatePageDataUnionTilesImpl>
      get copyWith => __$$DashboardReqUpdatePageDataUnionTilesImplCopyWithImpl<
          _$DashboardReqUpdatePageDataUnionTilesImpl>(this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String type, String title, int order, String? icon)
        cards,
    required TResult Function(
            String type, String title, int order, String? icon)
        tiles,
    required TResult Function(
            String type, String title, int order, String device, String? icon)
        deviceDetail,
  }) {
    return tiles(type, title, order, icon);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(String type, String title, int order, String? icon)?
        cards,
    TResult? Function(String type, String title, int order, String? icon)?
        tiles,
    TResult? Function(
            String type, String title, int order, String device, String? icon)?
        deviceDetail,
  }) {
    return tiles?.call(type, title, order, icon);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(String type, String title, int order, String? icon)? cards,
    TResult Function(String type, String title, int order, String? icon)? tiles,
    TResult Function(
            String type, String title, int order, String device, String? icon)?
        deviceDetail,
    required TResult orElse(),
  }) {
    if (tiles != null) {
      return tiles(type, title, order, icon);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(DashboardReqUpdatePageDataUnionCards value) cards,
    required TResult Function(DashboardReqUpdatePageDataUnionTiles value) tiles,
    required TResult Function(DashboardReqUpdatePageDataUnionDeviceDetail value)
        deviceDetail,
  }) {
    return tiles(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardReqUpdatePageDataUnionCards value)? cards,
    TResult? Function(DashboardReqUpdatePageDataUnionTiles value)? tiles,
    TResult? Function(DashboardReqUpdatePageDataUnionDeviceDetail value)?
        deviceDetail,
  }) {
    return tiles?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardReqUpdatePageDataUnionCards value)? cards,
    TResult Function(DashboardReqUpdatePageDataUnionTiles value)? tiles,
    TResult Function(DashboardReqUpdatePageDataUnionDeviceDetail value)?
        deviceDetail,
    required TResult orElse(),
  }) {
    if (tiles != null) {
      return tiles(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardReqUpdatePageDataUnionTilesImplToJson(
      this,
    );
  }
}

abstract class DashboardReqUpdatePageDataUnionTiles
    implements DashboardReqUpdatePageDataUnion {
  const factory DashboardReqUpdatePageDataUnionTiles(
      {required final String type,
      required final String title,
      required final int order,
      final String? icon}) = _$DashboardReqUpdatePageDataUnionTilesImpl;

  factory DashboardReqUpdatePageDataUnionTiles.fromJson(
          Map<String, dynamic> json) =
      _$DashboardReqUpdatePageDataUnionTilesImpl.fromJson;

  /// Discriminator for the page type
  @override
  String get type;

  /// The title of the page.
  @override
  String get title;

  /// The display order of the page.
  @override
  int get order;

  /// The icon associated with the page.
  @override
  String? get icon;

  /// Create a copy of DashboardReqUpdatePageDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardReqUpdatePageDataUnionTilesImplCopyWith<
          _$DashboardReqUpdatePageDataUnionTilesImpl>
      get copyWith => throw _privateConstructorUsedError;
}

/// @nodoc
abstract class _$$DashboardReqUpdatePageDataUnionDeviceDetailImplCopyWith<$Res>
    implements $DashboardReqUpdatePageDataUnionCopyWith<$Res> {
  factory _$$DashboardReqUpdatePageDataUnionDeviceDetailImplCopyWith(
          _$DashboardReqUpdatePageDataUnionDeviceDetailImpl value,
          $Res Function(_$DashboardReqUpdatePageDataUnionDeviceDetailImpl)
              then) =
      __$$DashboardReqUpdatePageDataUnionDeviceDetailImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call(
      {String type, String title, int order, String device, String? icon});
}

/// @nodoc
class __$$DashboardReqUpdatePageDataUnionDeviceDetailImplCopyWithImpl<$Res>
    extends _$DashboardReqUpdatePageDataUnionCopyWithImpl<$Res,
        _$DashboardReqUpdatePageDataUnionDeviceDetailImpl>
    implements
        _$$DashboardReqUpdatePageDataUnionDeviceDetailImplCopyWith<$Res> {
  __$$DashboardReqUpdatePageDataUnionDeviceDetailImplCopyWithImpl(
      _$DashboardReqUpdatePageDataUnionDeviceDetailImpl _value,
      $Res Function(_$DashboardReqUpdatePageDataUnionDeviceDetailImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardReqUpdatePageDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? type = null,
    Object? title = null,
    Object? order = null,
    Object? device = null,
    Object? icon = freezed,
  }) {
    return _then(_$DashboardReqUpdatePageDataUnionDeviceDetailImpl(
      type: null == type
          ? _value.type
          : type // ignore: cast_nullable_to_non_nullable
              as String,
      title: null == title
          ? _value.title
          : title // ignore: cast_nullable_to_non_nullable
              as String,
      order: null == order
          ? _value.order
          : order // ignore: cast_nullable_to_non_nullable
              as int,
      device: null == device
          ? _value.device
          : device // ignore: cast_nullable_to_non_nullable
              as String,
      icon: freezed == icon
          ? _value.icon
          : icon // ignore: cast_nullable_to_non_nullable
              as String?,
    ));
  }
}

/// @nodoc
@JsonSerializable()
class _$DashboardReqUpdatePageDataUnionDeviceDetailImpl
    implements DashboardReqUpdatePageDataUnionDeviceDetail {
  const _$DashboardReqUpdatePageDataUnionDeviceDetailImpl(
      {required this.type,
      required this.title,
      required this.order,
      required this.device,
      this.icon});

  factory _$DashboardReqUpdatePageDataUnionDeviceDetailImpl.fromJson(
          Map<String, dynamic> json) =>
      _$$DashboardReqUpdatePageDataUnionDeviceDetailImplFromJson(json);

  /// Discriminator for the page type
  @override
  final String type;

  /// The title of the page.
  @override
  final String title;

  /// The display order of the page.
  @override
  final int order;

  /// The unique identifier of the associated device.
  @override
  final String device;

  /// The icon associated with the page.
  @override
  final String? icon;

  @override
  String toString() {
    return 'DashboardReqUpdatePageDataUnion.deviceDetail(type: $type, title: $title, order: $order, device: $device, icon: $icon)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardReqUpdatePageDataUnionDeviceDetailImpl &&
            (identical(other.type, type) || other.type == type) &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.order, order) || other.order == order) &&
            (identical(other.device, device) || other.device == device) &&
            (identical(other.icon, icon) || other.icon == icon));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode =>
      Object.hash(runtimeType, type, title, order, device, icon);

  /// Create a copy of DashboardReqUpdatePageDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardReqUpdatePageDataUnionDeviceDetailImplCopyWith<
          _$DashboardReqUpdatePageDataUnionDeviceDetailImpl>
      get copyWith =>
          __$$DashboardReqUpdatePageDataUnionDeviceDetailImplCopyWithImpl<
                  _$DashboardReqUpdatePageDataUnionDeviceDetailImpl>(
              this, _$identity);

  @override
  @optionalTypeArgs
  TResult when<TResult extends Object?>({
    required TResult Function(
            String type, String title, int order, String? icon)
        cards,
    required TResult Function(
            String type, String title, int order, String? icon)
        tiles,
    required TResult Function(
            String type, String title, int order, String device, String? icon)
        deviceDetail,
  }) {
    return deviceDetail(type, title, order, device, icon);
  }

  @override
  @optionalTypeArgs
  TResult? whenOrNull<TResult extends Object?>({
    TResult? Function(String type, String title, int order, String? icon)?
        cards,
    TResult? Function(String type, String title, int order, String? icon)?
        tiles,
    TResult? Function(
            String type, String title, int order, String device, String? icon)?
        deviceDetail,
  }) {
    return deviceDetail?.call(type, title, order, device, icon);
  }

  @override
  @optionalTypeArgs
  TResult maybeWhen<TResult extends Object?>({
    TResult Function(String type, String title, int order, String? icon)? cards,
    TResult Function(String type, String title, int order, String? icon)? tiles,
    TResult Function(
            String type, String title, int order, String device, String? icon)?
        deviceDetail,
    required TResult orElse(),
  }) {
    if (deviceDetail != null) {
      return deviceDetail(type, title, order, device, icon);
    }
    return orElse();
  }

  @override
  @optionalTypeArgs
  TResult map<TResult extends Object?>({
    required TResult Function(DashboardReqUpdatePageDataUnionCards value) cards,
    required TResult Function(DashboardReqUpdatePageDataUnionTiles value) tiles,
    required TResult Function(DashboardReqUpdatePageDataUnionDeviceDetail value)
        deviceDetail,
  }) {
    return deviceDetail(this);
  }

  @override
  @optionalTypeArgs
  TResult? mapOrNull<TResult extends Object?>({
    TResult? Function(DashboardReqUpdatePageDataUnionCards value)? cards,
    TResult? Function(DashboardReqUpdatePageDataUnionTiles value)? tiles,
    TResult? Function(DashboardReqUpdatePageDataUnionDeviceDetail value)?
        deviceDetail,
  }) {
    return deviceDetail?.call(this);
  }

  @override
  @optionalTypeArgs
  TResult maybeMap<TResult extends Object?>({
    TResult Function(DashboardReqUpdatePageDataUnionCards value)? cards,
    TResult Function(DashboardReqUpdatePageDataUnionTiles value)? tiles,
    TResult Function(DashboardReqUpdatePageDataUnionDeviceDetail value)?
        deviceDetail,
    required TResult orElse(),
  }) {
    if (deviceDetail != null) {
      return deviceDetail(this);
    }
    return orElse();
  }

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardReqUpdatePageDataUnionDeviceDetailImplToJson(
      this,
    );
  }
}

abstract class DashboardReqUpdatePageDataUnionDeviceDetail
    implements DashboardReqUpdatePageDataUnion {
  const factory DashboardReqUpdatePageDataUnionDeviceDetail(
      {required final String type,
      required final String title,
      required final int order,
      required final String device,
      final String? icon}) = _$DashboardReqUpdatePageDataUnionDeviceDetailImpl;

  factory DashboardReqUpdatePageDataUnionDeviceDetail.fromJson(
          Map<String, dynamic> json) =
      _$DashboardReqUpdatePageDataUnionDeviceDetailImpl.fromJson;

  /// Discriminator for the page type
  @override
  String get type;

  /// The title of the page.
  @override
  String get title;

  /// The display order of the page.
  @override
  int get order;

  /// The unique identifier of the associated device.
  String get device;

  /// The icon associated with the page.
  @override
  String? get icon;

  /// Create a copy of DashboardReqUpdatePageDataUnion
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardReqUpdatePageDataUnionDeviceDetailImplCopyWith<
          _$DashboardReqUpdatePageDataUnionDeviceDetailImpl>
      get copyWith => throw _privateConstructorUsedError;
}
