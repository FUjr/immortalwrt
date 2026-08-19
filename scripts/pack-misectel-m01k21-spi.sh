#!/bin/sh

set -eu

usage() {
	cat <<'EOF'
Usage: pack-misectel-m01k21-spi.sh \
  --uboot UBOOT --firmware FIRMWARE --output OUTPUT \
  [--kpanic KPANIC] [--factory FACTORY] \
  [--woem WOEM] [--ledeinfo LEDEINFO] [--reserve RESERVE]
EOF
}

uboot=
firmware=
output=
kpanic=
factory=
woem=
ledeinfo=
reserve=

while [ "$#" -gt 0 ]; do
	case "$1" in
		--uboot)
			[ "$#" -ge 2 ] || { usage >&2; exit 2; }
			uboot="$2"
			shift 2
			;;
		--firmware)
			[ "$#" -ge 2 ] || { usage >&2; exit 2; }
			firmware="$2"
			shift 2
			;;
		--output)
			[ "$#" -ge 2 ] || { usage >&2; exit 2; }
			output="$2"
			shift 2
			;;
		--kpanic)
			[ "$#" -ge 2 ] || { usage >&2; exit 2; }
			kpanic="$2"
			shift 2
			;;
		--factory)
			[ "$#" -ge 2 ] || { usage >&2; exit 2; }
			factory="$2"
			shift 2
			;;
		--woem)
			[ "$#" -ge 2 ] || { usage >&2; exit 2; }
			woem="$2"
			shift 2
			;;
		--ledeinfo)
			[ "$#" -ge 2 ] || { usage >&2; exit 2; }
			ledeinfo="$2"
			shift 2
			;;
		--reserve)
			[ "$#" -ge 2 ] || { usage >&2; exit 2; }
			reserve="$2"
			shift 2
			;;
		-h|--help)
			usage
			exit 0
			;;
		*)
			usage >&2
			exit 2
			;;
	esac
done

[ -n "$uboot" ] && [ -n "$firmware" ] && [ -n "$output" ] || {
	usage >&2
	exit 2
}

check_max_size() {
	file="$1"
	limit="$2"
	name="$3"
	[ -f "$file" ] || { echo "$name not found: $file" >&2; exit 1; }
	size="$(wc -c < "$file")"
	[ "$size" -le "$limit" ] || {
		echo "$name exceeds partition: $size > $limit bytes" >&2
		exit 1
	}
}

check_partition_blob() {
	file="$1"
	name="$2"
	[ -z "$file" ] && return
	[ -f "$file" ] || { echo "$name not found: $file" >&2; exit 1; }
	size="$(wc -c < "$file")"
	[ "$size" -eq 65536 ] || {
		echo "$name must be exactly 65536 bytes: $size" >&2
		exit 1
	}
}

check_max_size "$uboot" 196608 U-Boot
# Keep at least 0xf0000 bytes at the end of firmware for rootfs_data.
check_max_size "$firmware" 15269888 firmware
check_partition_blob "$kpanic" kpanic
check_partition_blob "$factory" factory
check_partition_blob "$woem" woem
check_partition_blob "$ledeinfo" ledeinfo
check_partition_blob "$reserve" reserve

mkdir -p "$(dirname "$output")"
dd if=/dev/zero bs=1048576 count=16 2>/dev/null | \
	tr '\000' '\377' > "$output"

write_partition() {
	file="$1"
	block="$2"
	[ -z "$file" ] && return
	dd if="$file" of="$output" bs=65536 seek="$block" conv=notrunc 2>/dev/null
}

write_partition "$uboot" 0
write_partition "$kpanic" 3
write_partition "$factory" 4
write_partition "$firmware" 5
write_partition "$woem" 253
write_partition "$ledeinfo" 254
write_partition "$reserve" 255

size="$(wc -c < "$output")"
[ "$size" -eq 16777216 ] || {
	echo "SPI image has invalid size: $size" >&2
	exit 1
}

[ -n "$factory" ] || echo \
	"WARNING: factory is blank (0xff); inject the device-specific blob before production flashing" >&2
[ -n "$woem" ] || echo \
	"WARNING: woem is blank (0xff); the first oem-env set will initialize it" >&2
[ -n "$ledeinfo" ] || echo \
	"WARNING: ledeinfo is blank (0xff); inject the device-specific blob before production flashing" >&2
[ -n "$reserve" ] || echo \
	"WARNING: reserve is blank (0xff); inject the device-specific blob before production flashing" >&2
