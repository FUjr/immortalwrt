#!/bin/sh

firmware_version_valid() {
	printf '%s\n' "$1" | grep -Eq '^[0-9]{6}\.[0-9]{8}\.(R[0-9]+|A[0-9]{8})$'
}

firmware_version_relation() {
	local current="$1" target="$2" current_upper target_upper
	local current_build target_build first current_number target_number

	firmware_version_valid "$current" && firmware_version_valid "$target" || {
		printf '%s\n' unknown
		return 0
	}

	[ "$current" != "$target" ] || {
		printf '%s\n' same
		return 0
	}

	current_upper="${current%.*}"
	target_upper="${target%.*}"
	if [ "$current_upper" != "$target_upper" ]; then
		first="$(printf '%s\n%s\n' "$current_upper" "$target_upper" | LC_ALL=C sort | sed -n '1p')"
		[ "$first" = "$current_upper" ] && printf '%s\n' upgrade || printf '%s\n' downgrade
		return 0
	fi

	current_build="${current##*.}"
	target_build="${target##*.}"
	case "$current_build:$target_build" in
		A*:R*) printf '%s\n' upgrade; return 0 ;;
		R*:A*) printf '%s\n' downgrade; return 0 ;;
		A*:A*)
			first="$(printf '%s\n%s\n' "$current_build" "$target_build" | LC_ALL=C sort | sed -n '1p')"
			[ "$first" = "$current_build" ] && printf '%s\n' upgrade || printf '%s\n' downgrade
			return 0
			;;
	esac

	current_number="${current_build#R}"
	target_number="${target_build#R}"
	current_number="$(printf '%s\n' "$current_number" | sed 's/^0*//')"
	target_number="$(printf '%s\n' "$target_number" | sed 's/^0*//')"
	[ -n "$current_number" ] || current_number=0
	[ -n "$target_number" ] || target_number=0

	if [ "${#current_number}" -lt "${#target_number}" ]; then
		printf '%s\n' upgrade
	elif [ "${#current_number}" -gt "${#target_number}" ]; then
		printf '%s\n' downgrade
	elif [ "$current_number" = "$target_number" ]; then
		printf '%s\n' same
	else
		first="$(printf '%s\n%s\n' "$current_number" "$target_number" | LC_ALL=C sort | sed -n '1p')"
		[ "$first" = "$current_number" ] && printf '%s\n' upgrade || printf '%s\n' downgrade
	fi
}
