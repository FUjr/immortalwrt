#!/bin/sh

set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
SEED="$ROOT/configs/misectel-r700-nat.config"
OUTPUT="$ROOT/bin/targets/ramips/mt7621"
JOBS="${JOBS:-$(getconf _NPROCESSORS_ONLN 2>/dev/null || printf '1')}"

cd "$ROOT"

./scripts/feeds update -i trim_recovery
./scripts/feeds install -p trim_recovery misectel-vrf-manager luci-app-misectel-vrf \
	luci-app-misectel-dashboard luci-base-misectel luci-theme-misectel
./scripts/feeds install -p luci luci-ssl-openssl
cp "$SEED" .config
make defconfig
env TMPDIR="$ROOT/tmp" make -j"$JOBS"

image="$(find "$OUTPUT" -maxdepth 1 -type f -name '*misectel_r700-nat-gateway-squashfs-sysupgrade.bin' -print -quit)"
[ -n "$image" ] || {
	echo 'R700 NAT sysupgrade image was not produced' >&2
	exit 1
}

size="$(wc -c < "$image")"
[ "$size" -le 16252928 ] || {
	echo "image exceeds the 15872 KiB firmware partition: $size bytes" >&2
	exit 1
}

sha256sum "$image"
