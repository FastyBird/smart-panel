// coverage:ignore-file
// GENERATED CODE - DO NOT MODIFY BY HAND
// ignore_for_file: type=lint
// ignore_for_file: unused_element, deprecated_member_use, deprecated_member_use_from_same_package, use_function_type_syntax_for_parameters, unnecessary_const, avoid_init_to_null, invalid_override_different_default_values_named, prefer_expression_function_bodies, annotate_overrides, invalid_annotation_target, unnecessary_question_mark

part of 'dashboard_update_card.dart';

// **************************************************************************
// FreezedGenerator
// **************************************************************************

T _$identity<T>(T value) => value;

final _privateConstructorUsedError = UnsupportedError(
    'It seems like you constructed your class using `MyClass._()`. This constructor is only meant to be used by freezed and you are not supposed to need it nor use it.\nPlease check the documentation here for more information: https://github.com/rrousselGit/freezed#adding-getters-and-methods-to-our-models');

DashboardUpdateCard _$DashboardUpdateCardFromJson(Map<String, dynamic> json) {
  return _DashboardUpdateCard.fromJson(json);
}

/// @nodoc
mixin _$DashboardUpdateCard {
  /// The title displayed on the dashboard card.
  String get title => throw _privateConstructorUsedError;

  /// Defines the position of the card relative to others on the dashboard page.
  int get order => throw _privateConstructorUsedError;

  /// The icon representing the dashboard card.
  String? get icon => throw _privateConstructorUsedError;

  /// Serializes this DashboardUpdateCard to a JSON map.
  Map<String, dynamic> toJson() => throw _privateConstructorUsedError;

  /// Create a copy of DashboardUpdateCard
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  $DashboardUpdateCardCopyWith<DashboardUpdateCard> get copyWith =>
      throw _privateConstructorUsedError;
}

/// @nodoc
abstract class $DashboardUpdateCardCopyWith<$Res> {
  factory $DashboardUpdateCardCopyWith(
          DashboardUpdateCard value, $Res Function(DashboardUpdateCard) then) =
      _$DashboardUpdateCardCopyWithImpl<$Res, DashboardUpdateCard>;
  @useResult
  $Res call({String title, int order, String? icon});
}

/// @nodoc
class _$DashboardUpdateCardCopyWithImpl<$Res, $Val extends DashboardUpdateCard>
    implements $DashboardUpdateCardCopyWith<$Res> {
  _$DashboardUpdateCardCopyWithImpl(this._value, this._then);

  // ignore: unused_field
  final $Val _value;
  // ignore: unused_field
  final $Res Function($Val) _then;

  /// Create a copy of DashboardUpdateCard
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? title = null,
    Object? order = null,
    Object? icon = freezed,
  }) {
    return _then(_value.copyWith(
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
abstract class _$$DashboardUpdateCardImplCopyWith<$Res>
    implements $DashboardUpdateCardCopyWith<$Res> {
  factory _$$DashboardUpdateCardImplCopyWith(_$DashboardUpdateCardImpl value,
          $Res Function(_$DashboardUpdateCardImpl) then) =
      __$$DashboardUpdateCardImplCopyWithImpl<$Res>;
  @override
  @useResult
  $Res call({String title, int order, String? icon});
}

/// @nodoc
class __$$DashboardUpdateCardImplCopyWithImpl<$Res>
    extends _$DashboardUpdateCardCopyWithImpl<$Res, _$DashboardUpdateCardImpl>
    implements _$$DashboardUpdateCardImplCopyWith<$Res> {
  __$$DashboardUpdateCardImplCopyWithImpl(_$DashboardUpdateCardImpl _value,
      $Res Function(_$DashboardUpdateCardImpl) _then)
      : super(_value, _then);

  /// Create a copy of DashboardUpdateCard
  /// with the given fields replaced by the non-null parameter values.
  @pragma('vm:prefer-inline')
  @override
  $Res call({
    Object? title = null,
    Object? order = null,
    Object? icon = freezed,
  }) {
    return _then(_$DashboardUpdateCardImpl(
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
class _$DashboardUpdateCardImpl implements _DashboardUpdateCard {
  const _$DashboardUpdateCardImpl(
      {required this.title, required this.order, this.icon});

  factory _$DashboardUpdateCardImpl.fromJson(Map<String, dynamic> json) =>
      _$$DashboardUpdateCardImplFromJson(json);

  /// The title displayed on the dashboard card.
  @override
  final String title;

  /// Defines the position of the card relative to others on the dashboard page.
  @override
  final int order;

  /// The icon representing the dashboard card.
  @override
  final String? icon;

  @override
  String toString() {
    return 'DashboardUpdateCard(title: $title, order: $order, icon: $icon)';
  }

  @override
  bool operator ==(Object other) {
    return identical(this, other) ||
        (other.runtimeType == runtimeType &&
            other is _$DashboardUpdateCardImpl &&
            (identical(other.title, title) || other.title == title) &&
            (identical(other.order, order) || other.order == order) &&
            (identical(other.icon, icon) || other.icon == icon));
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  int get hashCode => Object.hash(runtimeType, title, order, icon);

  /// Create a copy of DashboardUpdateCard
  /// with the given fields replaced by the non-null parameter values.
  @JsonKey(includeFromJson: false, includeToJson: false)
  @override
  @pragma('vm:prefer-inline')
  _$$DashboardUpdateCardImplCopyWith<_$DashboardUpdateCardImpl> get copyWith =>
      __$$DashboardUpdateCardImplCopyWithImpl<_$DashboardUpdateCardImpl>(
          this, _$identity);

  @override
  Map<String, dynamic> toJson() {
    return _$$DashboardUpdateCardImplToJson(
      this,
    );
  }
}

abstract class _DashboardUpdateCard implements DashboardUpdateCard {
  const factory _DashboardUpdateCard(
      {required final String title,
      required final int order,
      final String? icon}) = _$DashboardUpdateCardImpl;

  factory _DashboardUpdateCard.fromJson(Map<String, dynamic> json) =
      _$DashboardUpdateCardImpl.fromJson;

  /// The title displayed on the dashboard card.
  @override
  String get title;

  /// Defines the position of the card relative to others on the dashboard page.
  @override
  int get order;

  /// The icon representing the dashboard card.
  @override
  String? get icon;

  /// Create a copy of DashboardUpdateCard
  /// with the given fields replaced by the non-null parameter values.
  @override
  @JsonKey(includeFromJson: false, includeToJson: false)
  _$$DashboardUpdateCardImplCopyWith<_$DashboardUpdateCardImpl> get copyWith =>
      throw _privateConstructorUsedError;
}
