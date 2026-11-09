# NEX905 32 MiB NOR: write and verify the inactive slot before selecting it.
# This file is sourced by sysupgrade, including in its RAMFS stage.
nex905_ab_slot() {
	local arg slot
	for arg in $(cat /proc/cmdline); do
		case "$arg" in
		ab_slot=A|ab_slot=B) [ -z "$slot" ] || return 1; slot="${arg#ab_slot=}" ;;
		ab_slot=*) return 1 ;;
		esac
	done
	[ -n "$slot" ] || return 1
	printf '%s\n' "$slot"
}

nex905_ab_prepare() {
	local source="$1" destination="$2" size offset magic
	cp "$source" "$destination" || return 1
	[ -f "$UPGRADE_BACKUP" ] || return 0
	# Build the exact bytes BEFORE flashing, including the configuration archive.
	# The EOF marker is emitted on a 64 KiB boundary by pad-rootfs. Replace it
	# with a standalone little-endian JFFS2 containing /sysupgrade.tgz, then EOF.
	size=$(wc -c < "$source")
	offset=0
	while [ "$offset" -lt "$size" ]; do
		magic=$(dd if="$source" bs=65536 skip="$offset" count=1 2>/dev/null | hexdump -n 4 -v -e '1/1 "%02x"')
		[ "$magic" = deadc0de ] && break
		offset=$((offset + 1))
		[ $((offset * 65536)) -lt "$size" ] || return 1
	done
	[ "$magic" = deadc0de ] || return 1
	mkdir -p /tmp/nex905-ab-config || return 1
	cp "$UPGRADE_BACKUP" /tmp/nex905-ab-config/sysupgrade.tgz || return 1
	mkfs.jffs2 --little-endian --eraseblock=65536 --pad --no-cleanmarkers \
		--root=/tmp/nex905-ab-config --output=/tmp/nex905-ab-overlay || return 1
	dd if="$source" of="$destination" bs=65536 count="$offset" 2>/dev/null || return 1
	cat /tmp/nex905-ab-overlay >> "$destination" || return 1
	printf '\336\255\300\336' >> "$destination"
}

nex905_ab_upgrade() {
	local slot next index device offset size expected actual
	slot=$(nex905_ab_slot) || { echo 'A/B: cannot determine running slot' >&2; return 1; }
	[ "$(fw_printenv -n active_slot 2>/dev/null)" = "$slot" ] || {
		echo 'A/B: boot environment disagrees with running slot' >&2; return 1;
	}
	case "$slot" in
	A) next=B; offset=16777216 ;;
	B) next=A; offset=458752 ;;
	esac
	index=$(find_mtd_index firmware_inactive)
	case "$index" in ''|*[!0-9]*) return 1 ;; esac
	device="/dev/mtd$index"
	[ "$(cat /sys/class/mtd/mtd$index/offset)" = "$offset" ] || return 1
	[ "$(cat /sys/class/mtd/mtd$index/size)" = 16318464 ] || return 1
	nex905_ab_prepare "$1" /tmp/nex905-ab-image || return 1
	size=$(wc -c < /tmp/nex905-ab-image)
	[ "$size" -gt 0 ] && [ "$size" -le 16318464 ] || return 1
	# Pad to the full slot, making readback cover stale overlay space as well.
	dd if=/dev/zero bs=65536 count=249 2>/dev/null | tr '\000' '\377' | \
		head -c "$((16318464 - size))" >> /tmp/nex905-ab-image
	[ "$(wc -c < /tmp/nex905-ab-image)" = 16318464 ] || return 1
	size=16318464
	expected=$(sha256sum /tmp/nex905-ab-image); expected="${expected%% *}"
	# Clear the old overlay as well as the new image area. Neither operation
	# touches the running firmware, its overlay, or either environment copy.
	mtd erase firmware_inactive || return 1
	mtd write /tmp/nex905-ab-image firmware_inactive || return 1
	sync
	actual=$(head -c "$size" "$device" | sha256sum); actual="${actual%% *}"
	[ "$actual" = "$expected" ] || { echo 'A/B: full readback mismatch, keeping current slot' >&2; return 1; }
	# SPI NOR redundant environment: fw_setenv writes the other copy, so an
	# interrupted selector update leaves a valid previous or new selector.
	fw_setenv active_slot "$next" || return 1
	[ "$(fw_printenv -n active_slot 2>/dev/null)" = "$next" ] || return 1
	echo "A/B: verified $size bytes; next boot is slot $next"
}
