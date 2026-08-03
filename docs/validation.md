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
  `lan1`-`lan3`, and `gmac1`/PHY4 as `lan4`. The manager package contains VRF
  manager v10 with API/UCI schema v3, fixed tables `1001`-`1004`, marks
  `0x101`-`0x104`, and the port and subnet-NAT migration scripts.
- The built root filesystem contains equal-prefix subnet DNAT/SNAT rules and
  explicitly brings `wan` and `lan1`-`lan4` administratively up in the safe
  factory state. Static validator tests cover valid subnet mappings, unequal
  prefix lengths, overlapping external ranges, and internal ranges outside the
  selected VRF.
- The programmer image is exactly 16 MiB. Byte comparison confirms U-Boot at
  `0x000000`, the base MAC at `0x04E000`, erased WOEM at `0x050000`, erased
  LEDEINFO at `0x060000`, and an exact sysupgrade payload at `0x070000`.
- Both the OpenWrt target checksum list and the dedicated artifact checksum
  list pass `sha256sum -c`.

## Verified On Hardware

- Sysupgrade completed despite the existing JFFS2 busy-inode warning. SPL
  loaded the main U-Boot from NOR, U-Boot verified and decompressed the kernel,
  and Linux detected 256 MiB DDR3 and the 16 MiB SPI NOR partition map.
- In factory-safe state `wan` and `lan1`-`lan4` all had the administrative `UP`
  flag while forwarding remained disabled. Cabled WAN and LAN1 negotiated
  100 Mbps full duplex; uncabled ports correctly reported `NO-CARRIER`.
- Manager v7 retained `setup_complete=1` across package upgrade and reboot,
  reduced duplicate HTTP/HTTPS management rules from two each to one each,
  removed the stale former WAN address, and rebuilt the canonical connected
  WAN route, VRF route, firewall rules, and NAT table after reboot.
- A LAN1 smoke test mapped `192.168.10.100/30` to `10.96.210.244/30` using two
  internal addresses on one OpenWrt endpoint. Both mapped addresses passed
  20-packet inbound ICMP with zero loss and mean latency below 1 ms; inbound
  HTTP and outbound source-bound HTTP returned status 200. Both internal
  sources passed outbound ICMP with zero loss and about 1 ms mean latency.
- The separate prerouting mark chain counted established packets independently
  of the first-packet DNAT counter, proving that conntrack continuation packets
  retained VRF routing selection. Regular reboot WAN ping downtime was
  38.67 seconds, so the suggested 30-second startup target was not met.
- Manager v8 supplied missing IPv4 and IPv6 HTTPS listeners, generated the
  configured self-signed uHTTPd certificate, redirected HTTP with status 307,
  and served the management page over HTTPS with status 200. Explicit TLS 1.2
  and TLS 1.3 connections both succeeded.
- Manager v9 accepted a complete candidate object through authenticated HTTPS
  ubus. A valid two-VRF candidate passed validation, apply returned a pending
  token, confirm made it durable, and an empty object reached manager
  validation and returned field-specific errors instead of an rpcd argument
  error.
- LAN1 and LAN2 simultaneously used `192.168.10.101`. The gateway learned that
  address as MAC `00:0c:43:26:60:31` in VRF table 1001 and MAC
  `02:76:21:00:00:01` in table 1002. WAN-side HTTP to `10.96.210.213` and
  `.217` returned `LAN1_ENDPOINT` and `LAN2_ENDPOINT` respectively. Host HTTP
  logs showed outbound requests translated to those same distinct addresses.
  ICMP in both directions had zero observed loss. LAN1 means were about
  1.05-1.27 ms; LAN2 means were about 11.73-11.84 ms, so latency performance
  was not met on the second test endpoint.
- The two mapping mark counters advanced on continuation packets while their
  stateful DNAT/SNAT counters advanced per flow. This confirms independent
  per-packet VRF selection and first-flow translation for both prefixes.
- Manager v10 corrected a deliberately reproduced split state from
  `setup_complete=1` and wizard `completed=0` to `1/1` during package upgrade.
  The unauthenticated setup RPC then returned 403 and the HTTP/HTTPS management
  rules remained deduplicated. After reboot, release 10, the confirmed two-VRF
  configuration, and both completion flags persisted. WAN ping returned after
  53 seconds; LAN1 link negotiation completed later, so the 30-second startup
  target remains unmet.

## Hardware Validation Pending

- Extended DDR stress, programmer erase/write/readback, and cold power-cycle
  repetition.
- LAN3-LAN4 traffic, routed external prefixes through an upstream router, host
  1:1 NAT, port mapping, and NAPT.
- UDP, timeout and explicit rollback, browser-side LuCI submission, production HTTPS
  certificate provisioning and trust, throughput, PPS, CPU load, and sustained
  latency tests.
- I2C wiring and DS3231 detection; the current boot log reports RTC probe error
  `-145`.

The first programmer image reached `U-Boot SPL` and printed
`Trying to boot from NOR`, then stopped. Its generated defconfig had been
truncated before `CONFIG_MT7621_SPI`, `CONFIG_LZMA`, and `CONFIG_SPL_LZMA`, so
SPL could not load and decompress the LZMA main U-Boot payload. The source
patch and build assertions cover this failure. The replacement image has now
booted repeatedly through SPL, main U-Boot, and Linux on the target.

Build verification does not establish hardware compatibility. Production
images must replace the development MAC and blank metadata regions with a
unique assigned MAC and manufacturing-supplied Factory/WOEM/LEDEINFO data.
