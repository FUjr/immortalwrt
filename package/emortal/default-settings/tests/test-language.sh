#!/bin/sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
source_script=${DEFAULT_SETTINGS_SCRIPT:-$script_dir/files/99-default-settings}
uci_bin=${UCI_BIN:-uci}
test_dir=$(mktemp -d)
trap 'rm -rf "$test_dir"' EXIT HUP INT TERM
mkdir -p "$test_dir/config" "$test_dir/state"

# Run the actual first-boot language block with a real UCI database. Stop
# before unrelated dnsmasq, symlink and packet-steering initialization.
sed -e '/^\. \/etc\/openwrt_release$/d' -e '/^sed -i /,$d' \
	"$source_script" > "$test_dir/language-defaults"
uci() {
	"$uci_bin" -c "$test_dir/config" -t "$test_dir/state" "$@"
}

for initial in en zh_Hans auto fr missing; do
	printf "config core 'main'\n" > "$test_dir/config/luci"
	printf "config system 'main'\n" > "$test_dir/config/system"
	if [ "$initial" = missing ]; then
		expected=auto
	else
		expected=$initial
		uci set "luci.main.lang=$initial"
		uci commit luci
	fi
	. "$test_dir/language-defaults"
	actual=$(uci get luci.main.lang)
	[ "$actual" = "$expected" ] || {
		echo "language overwritten: $initial -> $actual (expected $expected)" >&2
		exit 1
	}
	[ "$(uci get 'system.@imm_init[0].lang')" = 1 ]
	# Replaying package defaults must not undo a later user choice either.
	uci set luci.main.lang=de
	uci commit luci
	. "$test_dir/language-defaults"
	[ "$(uci get luci.main.lang)" = de ]
done
echo 'First-boot language defaults: five initial states and replay passed'
