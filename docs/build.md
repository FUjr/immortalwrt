# 7621EVB VRF NAT Image Build

The buildroot must keep the local feed entry pointing at the independent
`misectel_switch_luci` repository. Build the first-milestone image with:

```sh
./scripts/build-misectel-7621evb.sh
```

Set `JOBS` to limit parallelism. The script installs only the required local
feed packages, replaces `.config` with the tracked target seed, runs
`make defconfig`, builds with a repository-local `TMPDIR`, verifies that the
sysupgrade image exists and fits the 15936 KiB firmware partition,
then prints its SHA-256 checksum.

The same build also emits
`immortalwrt-ramips-mt7621-misectel_7621evb-u-boot.bin`. Set a unique base MAC
to produce the 16 MiB programmer image in the same output directory:

```sh
BASE_MAC=00:11:22:33:44:55 ./scripts/build-misectel-7621evb.sh
```

Optional `FACTORY_BIN`, `WOEM_BIN`, and `LEDEINFO_BIN` variables accept exact
64 KiB per-device partition dumps. Without them, those regions are erased
(`0xff`) except for the required base MAC written at Factory offset `0xE000`.
Production must use an assigned unique unicast MAC and any board-specific
Factory/WOEM calibration data supplied by manufacturing.
The generated `misectel_7621evb-artifacts.sha256` file covers the standalone
U-Boot, sysupgrade image, and programmer image using relative filenames.

The switch operations image requires `CONFIG_LLDPD_WITH_JSON=y` and
`CONFIG_LLDPD_WITH_SNMP=y`. The linked packages feed must contain commit
`e3c12d9` (Net-SNMP AES-256 and EtherLike `dot3StatsTable`) or an equivalent
newer change. The build script installs `misectel-switch-manager` and
`luci-app-misectel-switch` from the linked `misectel` application feed before
`defconfig`; this project does not use the `trim_recovery` feed.

To re-compose an already-built image without rebuilding:

```sh
./scripts/pack-misectel-7621evb-programmer.sh \
  --uboot bin/targets/ramips/mt7621/immortalwrt-ramips-mt7621-misectel_7621evb-u-boot.bin \
  --firmware bin/targets/ramips/mt7621/immortalwrt-ramips-mt7621-misectel_7621evb-squashfs-sysupgrade.bin \
  --base-mac 00:11:22:33:44:55 \
  --output bin/targets/ramips/mt7621/immortalwrt-ramips-mt7621-misectel_7621evb-programmer.bin
```

The profile contains HTTPS LuCI, the Misectel theme/dashboard, the VRF NAT
manager and UI, VRF/bridge support, and DS3231 RTC support. It deliberately
does not include hardware or software flow offload. Performance results are
reported separately and are not build acceptance gates.
