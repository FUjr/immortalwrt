# 7621EVB Build Validation

## Verified In Build Environment

- The target profile and sysupgrade metadata identify `misectel,7621evb`.
- The standalone `u-boot-mt7621.bin` is below the 192 KiB partition limit.
- U-Boot configuration selects 256 MiB DDR3, DDR3-1200, a 64 KiB environment
  at `0x30000`, and the SPI NOR boot address `0x1FC70000`.
- The sysupgrade image is below the 15936 KiB firmware limit and its manifest
  contains `kmod-vrf`, `misectel-vrf-manager`, `luci-app-misectel-vrf`, and the
  Misectel theme.
- The programmer image is exactly 16 MiB. Byte comparison confirms U-Boot at
  `0x000000`, the base MAC at `0x04E000`, erased WOEM at `0x050000`, erased
  LEDEINFO at `0x060000`, and an exact sysupgrade payload at `0x070000`.
- Both the OpenWrt target checksum list and the dedicated artifact checksum
  list pass `sha256sum -c`.

## Hardware Validation Pending

- DDR training and stability on the specified 2 Gbit DDR3 component.
- SPI NOR erase/write/readback and reset-vector boot using a programmer.
- UART output, Ethernet port order, WAN PHY, I2C wiring, and DS3231 detection.
- First boot, HTTPS setup, VRF isolation, overlapping-address NAT, rollback,
  restart, and power-cycle tests.

Build verification does not establish hardware compatibility. Production
images must replace the development MAC and blank metadata regions with a
unique assigned MAC and manufacturing-supplied Factory/WOEM/LEDEINFO data.
