#!/bin/sh

set -eu

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
SEED="$ROOT/configs/nex905-f-405.config"
OUTPUT="$ROOT/bin/targets/ramips/mt7621"
JOBS="${JOBS:-$(getconf _NPROCESSORS_ONLN 2>/dev/null || printf '1')}"

cd "$ROOT"

./scripts/feeds update -i misectel
./scripts/feeds install -p misectel misectel-vrf-manager luci-app-misectel-vrf \
	misectel-switch-manager luci-app-misectel-switch luci-app-misectel-dashboard \
	luci-app-misectel-network luci-app-misectel-system misectel-fan-control \
	misectel-security-manager luci-app-misectel-security misectel-system-manager \
	misectel-watchdog luci-base-misectel luci-theme-misectel
./scripts/feeds install -p luci luci-ssl-openssl
cp "$SEED" .config
make defconfig
grep -qx 'CONFIG_BUSYBOX_CONFIG_UDHCPD=y' .config || {
	echo 'BusyBox udhcpd applet is not enabled' >&2
	exit 1
}
env TMPDIR="$ROOT/tmp" make -j"$JOBS"

image="$(find "$OUTPUT" -maxdepth 1 -type f -name '*nex905_f-405-squashfs-sysupgrade.bin' -print -quit)"
[ -n "$image" ] || {
	echo 'NEX905-F-405 NAT Gateway sysupgrade image was not produced' >&2
	exit 1
}

manifest="$(find "$OUTPUT" -maxdepth 1 -type f -name '*nex905_f-405.manifest' -print -quit)"
[ -n "$manifest" ] || {
	echo 'NEX905-F-405 package manifest was not produced' >&2
	exit 1
}
for package in misectel-switch-manager misectel-security-manager \
	misectel-system-manager misectel-watchdog kmod-sched kmod-rtc-pcf85063; do
	grep -Eq "^${package} - " "$manifest" || {
		echo "required gateway package is missing from the image manifest: $package" >&2
		exit 1
	}
done

size="$(wc -c < "$image")"
[ "$size" -le 16318464 ] || {
	echo "image exceeds the 15936 KiB firmware partition: $size bytes" >&2
	exit 1
}

sha256sum "$image"

uboot="$(find "$ROOT/build_dir" -type f \
	-path '*/u-boot-mt7621_misectel_7621evb/u-boot-*/u-boot-mt7621.bin' \
	-not -path '*/.pkgdir/*' \
	-print -quit)"
[ -n "$uboot" ] || {
	echo '7621EVB U-Boot image was not produced' >&2
	exit 1
}
uboot_output="$OUTPUT/immortalwrt-ramips-mt7621-nex905_f-405-u-boot.bin"
cp "$uboot" "$uboot_output"
sha256sum "$uboot_output"

if [ -n "${BASE_MAC:-}" ]; then
	set -- --uboot "$uboot_output" --firmware "$image" \
		--base-mac "$BASE_MAC" \
		--output "$OUTPUT/immortalwrt-ramips-mt7621-nex905_f-405-programmer.bin"
	[ -z "${FACTORY_BIN:-}" ] || set -- "$@" --factory "$FACTORY_BIN"
	[ -z "${WOEM_BIN:-}" ] || set -- "$@" --woem "$WOEM_BIN"
	[ -z "${LEDEINFO_BIN:-}" ] || set -- "$@" --ledeinfo "$LEDEINFO_BIN"
	"$ROOT/scripts/pack-misectel-7621evb-programmer.sh" "$@"
fi

set -- "$(basename "$uboot_output")" "$(basename "$image")"
programmer="immortalwrt-ramips-mt7621-nex905_f-405-programmer.bin"
[ ! -f "$OUTPUT/$programmer" ] || set -- "$@" "$programmer"
(cd "$OUTPUT" && sha256sum "$@") > \
	"$OUTPUT/immortalwrt-ramips-mt7621-nex905_f-405-artifacts.sha256"

(
	cd "$OUTPUT"
	: > .sha256sums.tmp
	for output_file in *; do
		[ "$output_file" = sha256sums ] && continue
		[ -f "$output_file" ] || continue
		sha256sum "$output_file" >> .sha256sums.tmp
	done
	mv .sha256sums.tmp sha256sums
)
