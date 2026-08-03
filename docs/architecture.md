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

The image uses the standalone `misectel,7621evb` device tree for a 256 MiB DDR3
and 16 MiB SPI NOR design. The RAM device is rated for a 933 MHz clock; U-Boot
uses the MT7621-supported DDR3-1200 controller profile (600 MHz clock), which is
within that component rating. The native I2C pin group is enabled for an
external `maxim,ds3231` at address `0x68`; physical wiring remains a hardware
validation prerequisite.

Hardware port tracing defines the user-facing order independently of the SoC
enumeration. MT7530 port 0 is the actual `wan`; ports 1, 2, and 3 are `lan1`,
`lan2`, and `lan3`; the separate `gmac1`/internal PHY 4 interface is `lan4`.
The VRF manager reserves `wan` for upstream traffic and assigns LAN interfaces
to VRFs independently of this physical enumeration.

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

The image integrates `misectel-vrf-manager`, `luci-app-misectel-vrf`, and
`luci-app-misectel-network` from the independent local feed.
`luci-ssl-openssl` supplies the HTTPS management endpoint. netifd owns
`network.wan`; the VRF manager reads its live subnet, gateway and primary IPv4,
then restores per-mapping `/32` aliases, routing tables and NAT after WAN
hotplug events. The tracked build seed selects only this device profile;
profile dependencies own the minimal runtime package set.

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
WAN masquerading and flow offload are disabled to prevent a second translation
or bypass of VRF policy routing.

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
