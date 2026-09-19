#!/bin/sh

set -eu

script_dir="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
migration="$script_dir/../base-files/etc/uci-defaults/10_m01k43-usb-p-lan4-wan"
network_defaults="$script_dir/../base-files/etc/board.d/02_network"
tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT

fail() {
	echo "FAIL: $*" >&2
	exit 1
}

assert_eq() {
	[ "$1" = "$2" ] || fail "$3 (got '$1', expected '$2')"
}

make_uci() {
	cat >"$tmpdir/bin/uci" <<'EOF'
#!/bin/sh
set -eu

state="$UCI_STATE"
log="$UCI_LOG"
[ "${1:-}" = "-q" ] && shift
command="${1:-}"
shift || true

lookup() {
	awk -F '\t' -v key="$1" '$1 == key { print substr($0, length($1) + 2); found = 1; exit } END { exit(found ? 0 : 1) }' "$state"
}

show_value() {
	case "$2" in
	*' '*)
		printf "%s" "$1="
		for value in $2; do printf "'%s' " "$value"; done
		printf '\n'
		;;
	*) printf "%s='%s'\n" "$1" "$2" ;;
	esac
}

case "$command" in
show)
	[ "${1:-}" = "network" ] || exit 1
		while IFS="$(printf '\t')" read -r key value; do
		case "$key" in
		network.*.*) show_value "$key" "$value" ;;
		network.*) printf '%s=%s\n' "$key" "$value" ;;
		esac
	done <"$state"
	;;
get)
	lookup "$1"
	;;
set)
	key="${1%%=*}"
	value="${1#*=}"
	awk -F '\t' -v key="$key" '$1 != key { print }' "$state" >"$state.next"
	printf '%s\t%s\n' "$key" "$value" >>"$state.next"
	mv "$state.next" "$state"
	printf 'set %s\n' "$1" >>"$log"
	;;
del_list)
	key="${1%%=*}"
	value="${1#*=}"
	old="$(lookup "$key")" || exit 1
	new=""
	for item in $old; do
		[ "$item" = "$value" ] && continue
		new="${new:+$new }$item"
	done
	awk -F '\t' -v key="$key" '$1 != key { print }' "$state" >"$state.next"
	printf '%s\t%s\n' "$key" "$new" >>"$state.next"
	mv "$state.next" "$state"
	printf 'del_list %s\n' "$1" >>"$log"
	;;
commit|revert)
	printf '%s %s\n' "$command" "${1:-}" >>"$log"
	;;
*) exit 1 ;;
esac
EOF
	chmod +x "$tmpdir/bin/uci"
}

make_cat() {
	cat >"$tmpdir/bin/cat" <<'EOF'
#!/bin/sh
if [ "${1:-}" = "/tmp/sysinfo/board_name" ]; then
	printf '%s\n' "$TEST_BOARD"
	else
	exec /bin/cat "$@"
fi
EOF
	chmod +x "$tmpdir/bin/cat"
}

write_state() {
	: >"$tmpdir/state"
	for entry in "$@"; do
		key="${entry%%=*}"
		value="${entry#*=}"
		printf '%s\t%s\n' "$key" "$value" >>"$tmpdir/state"
	done
	: >"$tmpdir/log"
}

get_state() {
	awk -F '\t' -v key="$1" '$1 == key { print substr($0, length($1) + 2); exit }' "$tmpdir/state"
}

run_migration() {
	PATH="$tmpdir/bin:$PATH" UCI_STATE="$tmpdir/state" UCI_LOG="$tmpdir/log" TEST_BOARD="$1" sh "$migration"
}

show_ports() {
	PATH="$tmpdir/bin:$PATH" UCI_STATE="$tmpdir/state" UCI_LOG="$tmpdir/log" \
		uci -q show network | sed -n "s/^network\\.@device\\[0\\]\\.ports=//p" | sed 's/[[:space:]]*$//'
}

legacy_state() {
	write_state \
		'network.@device[0]=device' \
		'network.@device[0].name=br-lan' \
		'network.@device[0].type=bridge' \
		'network.@device[0].ports=lan4 lan2 lan1 lan3' \
		'network.lan=interface' \
		'network.lan.device=br-lan' \
		'network.lan.proto=static' \
		'network.wan=interface' \
		'network.wan.proto=dhcp' \
		'network.wan.device=wan' \
		'network.wan6=interface' \
		'network.wan6.proto=dhcpv6' \
		'network.wan6.device=@wan'
}

mkdir -p "$tmpdir/bin"
make_uci
make_cat

grep -Fq 'ucidef_set_interfaces_lan_wan "lan1 lan2 lan3" "lan4"' "$network_defaults" || fail 'new install mapping is missing'
grep -Fq 'uci -q del_list "network.$bridge_section.ports=lan4"' "$migration" || fail 'migration must preserve UCI list semantics'

legacy_state
run_migration 'misectel,m01k43-usb-p'
assert_eq "$(get_state 'network.@device[0].ports')" 'lan2 lan1 lan3' 'legacy bridge migration'
assert_eq "$(get_state 'network.wan.device')" 'lan4' 'legacy WAN migration'
assert_eq "$(get_state 'network.wan6.device')" '@wan' 'logical WAN6 binding preserved'
assert_eq "$(show_ports)" "'lan2' 'lan1' 'lan3'" 'bridge ports must remain a UCI list'
grep -Fxq 'del_list network.@device[0].ports=lan4' "$tmpdir/log" || fail 'legacy migration did not remove LAN4 from the list'
grep -Fxq 'commit network' "$tmpdir/log" || fail 'legacy migration did not commit'

: >"$tmpdir/log"
run_migration 'misectel,m01k43-usb-p'
[ ! -s "$tmpdir/log" ] || fail 'migration is not idempotent'

legacy_state
awk -F '\t' '$1 != "network.wan.proto" { print }' "$tmpdir/state" >"$tmpdir/state.next"
printf 'network.wan.proto\tpppoe\n' >>"$tmpdir/state.next"
mv "$tmpdir/state.next" "$tmpdir/state"
run_migration 'misectel,m01k43-usb-p'
assert_eq "$(get_state 'network.wan.device')" 'wan' 'custom WAN must remain untouched'
[ ! -s "$tmpdir/log" ] || fail 'custom WAN caused writes'

legacy_state
awk -F '\t' '$1 != "network.@device[0].ports" { print }' "$tmpdir/state" >"$tmpdir/state.next"
printf 'network.@device[0].ports\tlan1 lan2 lan3 lan4 guest\n' >>"$tmpdir/state.next"
mv "$tmpdir/state.next" "$tmpdir/state"
run_migration 'misectel,m01k43-usb-p'
assert_eq "$(get_state 'network.@device[0].ports')" 'lan1 lan2 lan3 lan4 guest' 'custom bridge must remain untouched'
[ ! -s "$tmpdir/log" ] || fail 'custom bridge caused writes'

legacy_state
run_migration 'misectel,m02k45'
assert_eq "$(get_state 'network.wan.device')" 'wan' 'other board must remain untouched'
[ ! -s "$tmpdir/log" ] || fail 'other board caused writes'

echo 'm01k43-usb-p network migration tests passed'
