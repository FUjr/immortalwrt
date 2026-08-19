# MT7621 VRF NAT Gateway Architecture

## Network Model

The gateway reserves `wan` for upstream and management traffic. VRF objects
own their routing table, packet mark, bridge, and one or more selected LAN
interfaces. The factory configuration assigns one interface to each VRF:

| Device | Bridge | VRF | Table | Mark |
| --- | --- | --- | --- | --- |
| `lan1` | `br-vrf1` | `vrf-vrf1` | 1001 | `0x101` |
| `lan2` | `br-vrf2` | `vrf-vrf2` | 1002 | `0x102` |
| `lan3` | `br-vrf3` | `vrf-vrf3` | 1003 | `0x103` |
| `lan4` | `br-vrf4` | `vrf-vrf4` | 1004 | `0x104` |

VRF bridges preserve an FDB and allow MAC admission controls. An interface can
be reassigned but cannot belong to two VRFs; `wan` is never a VRF member. A
subnet and gateway address may be reused across VRFs. Devices sharing one VRF
must still use unique addresses.
Each managed bridge is assigned a stable locally administered MAC derived from
the WAN hardware address and the VRF's unique routing-table number. Endpoint
frames retain their source and destination MAC addresses. When two MT7530 DSA
ports belong to one VRF bridge, same-subnet unicast is eligible for switch-chip
offload; routed, NAT, and gateway-destined traffic still traverses the CPU.

API/UCI v8 optionally treats one selected VRF definition as an ordinary LAN.
When the global HNAT switch is enabled, the manager creates `lan-<name>` in the
main routing table instead of `vrf-<name>` plus `br-<name>`. That LAN must use
exclusive physical members and a prefix that overlaps neither WAN nor another
enabled VRF; VRF NAT mappings cannot target it. Turning the global switch off
preserves the selection but recreates the definition as an isolated VRF.
`hnat_ui_visible` is writable through UCI/NMS only and determines whether LuCI
shows the global and per-VRF HNAT controls.

The image uses the standalone `misectel,7621evb` device tree for a 256 MiB DDR3
and 16 MiB SPI NOR design. The RAM device is rated for a 933 MHz clock; U-Boot
uses the MT7621-supported DDR3-1200 controller profile (600 MHz clock), which is
within that component rating. The native I2C pin group is enabled for an
external `nxp,pcf85063a` at address `0x51` on MT7621 `I2C_SD`/`I2C_SCLK`
(GPIO3/GPIO4); physical read,
write and backup-power retention remain hardware validation prerequisites.

Hardware port tracing defines the user-facing order independently of the SoC
enumeration. MT7530 port 0 is the actual `wan`; ports 1, 2, and 3 are `lan1`,
`lan2`, and `lan3`; the separate `gmac1`/internal PHY 4 interface is `lan4`.
The VRF manager reserves `wan` for upstream traffic and assigns LAN interfaces
to VRFs independently of this physical enumeration.

The 7621EVB RJ45 is wired with only four pins (two pairs), so the ports are
100BASE-TX only and 1000BASE-T is physically unreachable regardless of the link
partner. The full-duplex 100M WAN link used to flap after boot because the
MT7621 switch PHYs could advertise EEE before the generic PHY layer applied the
device-tree broken-EEE flags. Target patch
`140-net-dsa-mt7530-do-not-advertise-EEE-on-MT7621-switch.patch` clears the EEE
advertisement for all integrated switch PHYs in `mt7530_setup()`, before the
PHY devices are attached for the first time. On the 7621EVB this kept WAN at
100Mbps/full duplex continuously from its first link-up; the previous DSP,
TRGMII/P5 and delayed WAN-reinitialisation workarounds are not used.

The NOR layout follows the metadata convention used by Misectel MT7981 boards:

| Offset | Size | Partition |
| --- | --- | --- |
| `0x000000` | `0x030000` | `u-boot` |
| `0x030000` | `0x010000` | `u-boot-env` |
| `0x040000` | `0x010000` | `factory` |
| `0x050000` | `0x010000` | `woem` |
| `0x060000` | `0x010000` | `ledeinfo` |
| `0x070000` | `0xF90000` | `firmware` |

The base MAC is stored at Factory offset `0xE000`; WAN derives the following
address. A production programmer image must therefore contain per-device
Factory data rather than a shared blank or example Factory partition.

### NEX905-F-405 Product Profile

The `nex905,f-405` device profile (`Device/nex905_f-405`) is the customer
delivery variant of the same 16 MiB layout. It shares the `misectel,7621evb`
U-Boot, flash map and physical port tracing, but carries neutral Web branding
(`NAT Gateway NEX905-F-405`), factory `admin`/`Admin@123` login, management
address `192.168.1.99/24` with gateway `192.168.1.1`, SN = WAN MAC, and an
additional `misectel-watchdog` service that blinks gpio12 (system light) and
pulses gpio18 (external watchdog feed). The DTS muxes the `uart2` pin group to
GPIO for the system light; the watchdog feed reuses the already-GPIO `wdt`
group pin (io18) because the RGMII2 group (io22-33) is required by the
embedded switch CPU port. See
[`docs/nex905-f-405-web-rebrand-design.md`](nex905-f-405-web-rebrand-design.md).

### 32M Dual-Slot Variant

A 32 MiB SPI NOR variant (`misectel,7621evb-32m`) adds a second firmware slot
and boot-time rollback so a failed or interrupted upgrade boots the previous
image and keeps the user configuration.

| Partition | Offset | Size | Notes |
| --- | --- | ---: | --- |
| `u-boot` | `0x000000` | `0x030000` | read-only |
| `u-boot-env` | `0x030000` | `0x010000` | U-Boot env plus A/B flags |
| `factory` | `0x040000` | `0x010000` | read-only, base MAC |
| `woem` | `0x050000` | `0x010000` | read-only |
| `ledeinfo` | `0x060000` | `0x010000` | |
| `firmware_a` | `0x070000` | `0xf90000` | slot A, `denx,uimage` |
| `firmware_b` | `0x1000000` | `0xf90000` | slot B, `denx,uimage` |

Each slot is the same 15936 KiB uImage-plus-squashfs image as the 16 MiB
variant, so `IMAGE_SIZE` and the sysupgrade format are unchanged. mtdsplit
splits both slots into `kernel`/`rootfs`/`rootfs_data`; the first `rootfs_data`
(slot A's) is therefore always the overlay, which makes configuration follow
the active slot and survive a rollback. The kernel mounts the active slot's
`rootfs` (`/dev/mtdblock6` for slot A, `/dev/mtdblock9` for slot B when both
slots are valid) because the DTS `chosen` carries no `bootargs` and U-Boot
supplies the per-slot command line.

The 32M device uses a dedicated U-Boot that owns the A/B selection in the
default environment. Three variables implement the protocol:

- `active_slot` (`A`/`B`): the last confirmed-good slot, booted on every normal
  boot.
- `try_slot`: set by sysupgrade to the just-written slot; U-Boot boots it while
  `boot_attempts` remains positive.
- `boot_attempts` (default `2`): on each boot of a pending slot U-Boot
  decrements it and `saveenv`s; when it reaches zero, or when `bootm` rejects
  the image, U-Boot clears `try_slot` and reverts to `active_slot`.

sysupgrade for this board writes the image to the inactive slot and only then
sets `try_slot` plus `boot_attempts=2`. A power loss during the write leaves
`try_slot` unset, so the old slot boots. A power loss during the first boot of
the new slot, a kernel panic (`panic=1`), or an invalid image makes U-Boot
exhaust the attempts and revert to `active_slot`. The init script
`bootcount` commits a pending slot by copying `try_slot` into `active_slot`
once the system reaches START=99.

The U-Boot binary, env defaults and DTS for the 32M board are added by
`patches/423-add-misectel-7621evb-32m.patch`. The `u-boot-envtools` package
provides `fw_printenv`/`fw_setenv` on the device for sysupgrade and commit.
The 32 MiB programmer image writes the same firmware into both slots so a
factory board can boot either slot and roll back between them.

The image integrates `misectel-vrf-manager`, `luci-app-misectel-vrf`, and
`luci-app-misectel-network` from the independent local feed.
`luci-ssl-openssl` supplies the HTTPS management endpoint. netifd owns
`network.wan`; the VRF manager reads its live subnet, gateway and primary IPv4,
then restores per-mapping `/32` aliases, routing tables and NAT after WAN
hotplug events. The tracked build seed selects only this device profile;
profile dependencies own the minimal runtime package set.

An optional BusyBox `udhcpd` process binds each enabled VRF bridge. It only
advertises IPv4 address, mask, gateway, up to two DNS servers, and lease time,
and accepts static MAC/address reservations. All generated configuration,
process, and lease state is under `/tmp/misectel-vrf-dhcp`; no DHCP database is
persisted. Different VRFs may reuse the same pool because each server binds its
isolated bridge and runs through `ip vrf exec` for that routing domain. At the
local input hook Linux exposes the VRF master, so firewall4 admits only DHCP
client UDP 68 to server UDP 67 on manager-created `vrf-*` interfaces. The HNAT
LAN DHCP process remains in the main routing domain and binds its `lan-<name>`
bridge; the same scoped firewall include admits that bridge pattern.

The same feed provides `misectel-switch-manager` and
`luci-app-misectel-switch`. The manager owns fixed-port administrative and PHY
settings, optional tc rate/storm policies, passive sysfs/FDB sampling, bounded
RAM events, SNMP configuration and LLDP AgentX integration. LuCI and NMS use
the versioned `misectel.switch` ubus object; secrets are redacted on reads,
and `validate_config` returns `valid: false` plus field-specific errors for
malformed or incomplete candidates instead of raising an rpcd/ubus exception.
Writes are rejected until the complete configuration passes validation. Runtime data stays
under `/tmp/misectel-switch`.

Passive monitoring never adds nftables or tc hooks. A qdisc is installed only
on a port whose ingress, egress, or storm limit is nonzero. This preserves the
default forwarding path, while enabled policing still requires target latency
measurement.

## Packet Processing

Inbound WAN rules mark packets before routing and then apply DNAT. An `ip rule`
for each mark selects the matching VRF table and device bridge. Host 1:1 rules
translate individual addresses; subnet 1:1 rules map equal-length prefixes and
preserve host bits. Outbound traffic uses the matching host or prefix SNAT rule
before falling back to NAPT on the WAN management address. Conntrack performs
reverse translation.

Subnet external prefixes are routed by the upstream router through the gateway
WAN address. They are not installed as hundreds of local `/32` aliases, so the
gateway does not need to synthesize ARP replies for every translated host.

The manager owns a dedicated nftables table. A small firewall4 include admits
outbound traffic from dynamically named VRF masters and inbound connections
that the manager DNATed; firewall4 continues to protect the management plane.
WAN masquerading and firewall4 global flow offload are disabled to prevent a
second translation or bypass of VRF policy routing. An active HNAT LAN instead
uses manager-owned SNAT and an nftables flowtable whose ingress devices are
limited to WAN and that LAN's physical members. Only established TCP/UDP flows
between the selected bridge and WAN are submitted with the hardware-offload
flag. Other VRFs retain their software path, marks and independent tables.

## Control Plane

`misectel-vrf-manager` combines a procd-managed apply service with an rpcd
ucode API. It validates UCI, builds network state atomically, exposes ubus
methods and reconciles after WAN/firewall changes. `get_status` reads the raw
VRF-member carrier, operstate and speed because LAN1-LAN4 are outside netifd
ownership. Configuration is persistent UCI; runtime state is held in RAM. No
database is used.

A configuration transaction stores one last-known-good backup, applies the new
state, and waits 90 seconds for confirmation. A timeout or reboot with an
unconfirmed transaction restores the backup before forwarding is enabled.

## Security Boundary

Factory state brings WAN and LAN1-LAN4 administratively up and uses
`192.168.1.1/24` on WAN, with no gateway and no forwarding. The one-time
HTTPS setup endpoint can only set the initial administrator password. Once setup
is complete its unauthenticated RPC permission is permanently rejected. Normal
configuration requires an authenticated ubus session and an explicit RPC ACL.
The gateway default script replaces the board-generated DHCP WAN while setup is
incomplete, so a reset device does not depend on an upstream DHCP server for
management access. After setup completes, upgrades retain the selected WAN
protocol and address.
