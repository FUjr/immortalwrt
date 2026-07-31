# MT7621 VRF NAT Gateway Architecture

## Network Model

The prototype reserves `wan` for upstream and management traffic. Each LAN
device port is placed in a one-port bridge, and each bridge is enslaved to a
different Linux VRF:

| Device | Bridge | VRF | Table | Mark |
| --- | --- | --- | --- | --- |
| `lan1` | `br-vrf-lan1` | `vrf-lan1` | 1001 | `0x101` |
| `lan2` | `br-vrf-lan2` | `vrf-lan2` | 1002 | `0x102` |
| `lan3` | `br-vrf-lan3` | `vrf-lan3` | 1003 | `0x103` |
| `lan4` | `br-vrf-lan4` | `vrf-lan4` | 1004 | `0x104` |

One-port bridges preserve an FDB and allow later MAC admission controls while
keeping the four Layer-2 domains isolated. A subnet and gateway address may be
reused across VRFs. Devices sharing one VRF must still use unique addresses.

The image uses the standalone `misectel,7621evb` device tree for a 256 MiB DDR3
and 16 MiB SPI NOR design. The RAM device is rated for a 933 MHz clock; U-Boot
uses the MT7621-supported DDR3-1200 controller profile (600 MHz clock), which is
within that component rating. The native I2C pin group is enabled for an
external `maxim,ds3231` at address `0x68`; physical wiring remains a hardware
validation prerequisite.

Hardware port tracing defines the user-facing order independently of the SoC
enumeration. MT7530 port 0 is the actual `wan`; ports 1, 2, and 3 are `lan1`,
`lan2`, and `lan3`; the separate `gmac1`/internal PHY 4 interface is `lan4`.
This replaces the initial provisional labels `lan5`, `lan4`, `lan3`, `lan2`,
and `wan`, respectively.

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

The image integrates `misectel-vrf-manager` and `luci-app-misectel-vrf` from
the independent local feed. `luci-ssl-openssl` supplies the HTTPS management
endpoint. The tracked build seed selects only this device profile; profile
dependencies own the minimal runtime package set.

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
only traffic carrying a valid manager mark; firewall4 continues to protect the
management plane. WAN masquerading and flow offload are disabled to prevent a
second translation or bypass of VRF policy routing.

## Control Plane

`misectel-vrf-manager` is a procd-managed C service. It validates UCI, builds
network state atomically, exposes ubus methods, records counters and errors, and
reconciles after link/firewall changes. Configuration is persistent UCI; runtime
state is held in RAM. No database is used.

A configuration transaction stores one last-known-good backup, applies the new
state, and waits 90 seconds for confirmation. A timeout or reboot with an
unconfirmed transaction restores the backup before forwarding is enabled.

## Security Boundary

Factory state brings WAN and LAN1-LAN4 administratively up and uses
`192.168.1.1/24` on WAN, with no gateway and no forwarding. The one-time
HTTPS setup endpoint can only set the initial administrator password. Once setup
is complete its unauthenticated RPC permission is permanently rejected. Normal
configuration requires an authenticated ubus session and an explicit RPC ACL.
