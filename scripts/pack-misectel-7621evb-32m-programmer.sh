#!/bin/sh

set -eu

usage() {
	cat <<'EOF'
Usage: pack-misectel-7621evb-32m-programmer.sh \
  --uboot UBOOT --firmware FIRMWARE --base-mac MAC --output OUTPUT \
  [--factory FACTORY] [--woem WOEM] [--ledeinfo LEDEINFO]
EOF
}

uboot=
firmware=
base_mac=
output=
factory=
woem=
ledeinfo=

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
		--base-mac)
			[ "$#" -ge 2 ] || { usage >&2; exit 2; }
			base_mac="$2"
			shift 2
			;;
		--output)
			[ "$#" -ge 2 ] || { usage >&2; exit 2; }
			output="$2"
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

[ -n "$uboot" ] && [ -n "$firmware" ] && [ -n "$base_mac" ] && [ -n "$output" ] || {
	usage >&2
	exit 2
}
[ -f "$uboot" ] || { echo "U-Boot not found: $uboot" >&2; exit 1; }
[ -f "$firmware" ] || { echo "firmware not found: $firmware" >&2; exit 1; }

mac_hex="$(printf '%s' "$base_mac" | tr -d ':')"
case "$mac_hex" in
	????????????) ;;
	*) echo "invalid base MAC: $base_mac" >&2; exit 1 ;;
esac
case "$mac_hex" in
	*[!0-9A-Fa-f]*) echo "invalid base MAC: $base_mac" >&2; exit 1 ;;
esac
first_octet="${mac_hex%??????????}"
[ $((0x$first_octet & 1)) -eq 0 ] || {
	echo "base MAC must be unicast: $base_mac" >&2
	exit 1
}
[ "$mac_hex" != "000000000000" ] || {
	echo 'base MAC must not be all zeroes' >&2
	exit 1
}

check_max_size() {
	file="$1"
	limit="$2"
	name="$3"
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
check_max_size "$firmware" 16318464 firmware
check_partition_blob "$factory" factory
check_partition_blob "$woem" woem
check_partition_blob "$ledeinfo" ledeinfo

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT HUP INT TERM

blank="$tmpdir/blank.bin"
dd if=/dev/zero bs=65536 count=1 2>/dev/null | tr '\000' '\377' > "$blank"
cp "${factory:-$blank}" "$tmpdir/factory.bin"
printf '%s' "$mac_hex" | xxd -r -p | \
	dd of="$tmpdir/factory.bin" bs=1 seek=57344 conv=notrunc 2>/dev/null

# 32 MiB image: bootloader/metadata regions followed by two identical
# firmware slots at 0x70000 (slot A) and 0x1000000 (slot B). Both slots are
# written so a factory board can boot and auto-rollback between them.
mkdir -p "$(dirname "$output")"
dd if=/dev/zero bs=1048576 count=32 2>/dev/null | tr '\000' '\377' > "$output"
dd if="$uboot" of="$output" bs=65536 seek=0 conv=notrunc 2>/dev/null
dd if="$tmpdir/factory.bin" of="$output" bs=65536 seek=4 conv=notrunc 2>/dev/null
dd if="${woem:-$blank}" of="$output" bs=65536 seek=5 conv=notrunc 2>/dev/null
dd if="${ledeinfo:-$blank}" of="$output" bs=65536 seek=6 conv=notrunc 2>/dev/null
dd if="$firmware" of="$output" bs=65536 seek=7 conv=notrunc 2>/dev/null
dd if="$firmware" of="$output" bs=65536 seek=256 conv=notrunc 2>/dev/null

size="$(wc -c < "$output")"
[ "$size" -eq 33554432 ] || {
	echo "programmer image has invalid size: $size" >&2
	exit 1
}

output_dir="$(dirname "$output")"
output_name="$(basename "$output")"
(cd "$output_dir" && sha256sum "$output_name") > "$output.sha256"
cat "$output.sha256"
