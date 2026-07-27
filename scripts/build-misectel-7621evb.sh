#!/bin/sh

set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
SEED="$ROOT/configs/misectel-7621evb.config"
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

image="$(find "$OUTPUT" -maxdepth 1 -type f -name '*misectel_7621evb-squashfs-sysupgrade.bin' -print -quit)"
[ -n "$image" ] || {
	echo '7621EVB NAT sysupgrade image was not produced' >&2
	exit 1
}

size="$(wc -c < "$image")"
[ "$size" -le 16318464 ] || {
	echo "image exceeds the 15936 KiB firmware partition: $size bytes" >&2
	exit 1
}

sha256sum "$image"
