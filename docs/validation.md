# 7621EVB Build Validation

## Verified In Build Environment

- The target profile and sysupgrade metadata identify `misectel,7621evb`.
- The standalone `u-boot-mt7621.bin` is below the 192 KiB partition limit.
- U-Boot configuration selects 256 MiB DDR3, DDR3-1200, a 64 KiB environment
  at `0x30000`, SPI NOR support, SPL LZMA decompression, and the SPI NOR boot
  address `0x1FC70000`. The build script rejects an artifact when any required
  option is missing.
- The sysupgrade image is below the 15936 KiB firmware limit and its manifest
  contains `kmod-vrf`, `misectel-vrf-manager`, `luci-app-misectel-vrf`, and the
  Misectel theme.
- The built kernel DTB labels MT7530 port 0 as `wan`, ports 1-3 as
  `lan1`-`lan3`, and `gmac1`/PHY4 as `lan4`. The root filesystem contains VRF
  manager v2 with fixed tables `1001`-`1004`, marks `0x101`-`0x104`, and the
  v1 port migration script.
- The programmer image is exactly 16 MiB. Byte comparison confirms U-Boot at
  `0x000000`, the base MAC at `0x04E000`, erased WOEM at `0x050000`, erased
  LEDEINFO at `0x060000`, and an exact sysupgrade payload at `0x070000`.
- Both the OpenWrt target checksum list and the dedicated artifact checksum
  list pass `sha256sum -c`.

## Hardware Validation Pending

- DDR training and stability on the specified 2 Gbit DDR3 component.
- SPI NOR erase/write/readback and reset-vector boot using a programmer.
- UART output, corrected WAN/LAN traffic direction, I2C wiring, and DS3231
  detection. Port tracing supplied from hardware maps MT7530 port 0 to WAN,
  ports 1-3 to LAN1-3, and `gmac1`/PHY4 to LAN4; packet tests remain pending.
- First boot, HTTPS setup, VRF isolation, overlapping-address NAT, rollback,
  restart, and power-cycle tests.

The first programmer image reached `U-Boot SPL` and printed
`Trying to boot from NOR`, then stopped. Its generated defconfig had been
truncated before `CONFIG_MT7621_SPI`, `CONFIG_LZMA`, and `CONFIG_SPL_LZMA`, so
SPL could not load and decompress the LZMA main U-Boot payload. The source
patch and build assertions now cover this failure; the replacement image still
requires a hardware retest.

Build verification does not establish hardware compatibility. Production
images must replace the development MAC and blank metadata regions with a
unique assigned MAC and manufacturing-supplied Factory/WOEM/LEDEINFO data.
