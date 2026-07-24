# MT7621 VRF NAT Gateway Architecture

## Network Model

The prototype reserves `wan` for upstream and management traffic. Each DSA
device port is placed in a one-port bridge, and each bridge is enslaved to a
different Linux VRF:

| Device | Bridge | VRF | Table | Mark |
| --- | --- | --- | --- | --- |
| `lan2` | `br-vrf-lan2` | `vrf-lan2` | 1002 | `0x102` |
| `lan3` | `br-vrf-lan3` | `vrf-lan3` | 1003 | `0x103` |
| `lan4` | `br-vrf-lan4` | `vrf-lan4` | 1004 | `0x104` |
| `lan5` | `br-vrf-lan5` | `vrf-lan5` | 1005 | `0x105` |

One-port bridges preserve an FDB and allow later MAC admission controls while
keeping the four Layer-2 domains isolated. A subnet and gateway address may be
reused across VRFs. Devices sharing one VRF must still use unique addresses.

The prototype image uses a derived `misectel,r700-nat-gateway` device tree. It
inherits the Cudy R700 flash, Ethernet, MAC-address, button, and LED definitions
without changing the partition map. The native I2C pin group is enabled for an
external `maxim,ds3231` at address `0x68`; physical wiring remains a hardware
validation prerequisite.

## Packet Processing

Inbound WAN rules mark packets before routing and then apply DNAT. An `ip rule`
for each mark selects the matching VRF table and device bridge. Outbound traffic
from a VRF uses static SNAT when a 1:1 rule matches and otherwise uses NAPT to
the configured WAN management address. Conntrack performs reverse translation.

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

Factory state uses `192.168.1.1/24`, no gateway, and no forwarding. The one-time
HTTPS setup endpoint can only set the initial administrator password. Once setup
is complete its unauthenticated RPC permission is permanently rejected. Normal
configuration requires an authenticated ubus session and an explicit RPC ACL.
