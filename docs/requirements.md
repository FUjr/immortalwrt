# MT7621 VRF NAT Gateway Requirements

## Document Rules

- This file is the authoritative product requirement register for the
  `misectel-switch` branch.
- Status values are `planned`, `implemented`, `verified`, `deferred`, and
  `unsupported`.
- An interface, configuration schema, or persistent data change must update the
  matching document in the same commit.
- The OpenWrt source and `misectel_switch_luci` feed are independent Git
  repositories. Each feature or fix is committed separately with a detailed
  Chinese commit message.
- Build output, test state, logs, and runtime data are not tracked.

## Locked Product Decisions

| ID | Decision | Value |
| --- | --- | --- |
| DEC-001 | Hardware | `misectel,7621evb`, MT7621, 2 Gbit (256 MiB) DDR3 SDRAM rated at 933 MHz, 16 MiB SPI NOR, 4 DSA device ports and 1 WAN |
| DEC-002 | RTC | External DS3231 on the native I2C bus, address `0x68`; DTS implemented, wiring unverified |
| DEC-003 | Device identity | IP addresses must be unique within one port/VRF; addresses may repeat across VRFs |
| DEC-004 | WAN mapping delivery | Static addresses from the WAN subnet, advertised with ARP |
| DEC-005 | Management | WAN-side management IP, factory default `192.168.1.1/24` |
| DEC-006 | NAT 1:N meaning | One external IP split by protocol/port ranges to multiple internal devices |
| DEC-007 | IPv6 boundary | Management and ACL may be dual stack; VRF NAT is IPv4 only |
| DEC-008 | Acceleration | Software and hardware flow offload disabled |
| DEC-009 | Performance | Measured and reported, never a release blocker |
| DEC-010 | Storage policy | Core image first; lower-priority features may be declared unsupported when the 16 MiB limit is exceeded |
| DEC-011 | Initial authentication | One-time HTTPS setup requires setting the administrator password before forwarding is enabled |
| DEC-012 | NMS | HTTPS ubus JSON-RPC; SNMP is primarily monitoring and traps |
| DEC-013 | Legacy security | HTTP, SNMPv1/v2c, and weak authentication are disabled by default |
| DEC-014 | Compliance | IEC 62443-4-2 gap assessment only; no certification claim |
| DEC-015 | First image | HTTPS LuCI with Misectel theme, dashboard, VRF NAT manager and VRF NAT page |
| DEC-016 | NOR metadata | Preserve 64 KiB `woem` and 64 KiB `ledeinfo` partitions following the Misectel MT7981 convention |
| DEC-017 | DDR controller | Use U-Boot's supported DDR3-1200 profile (600 MHz clock), within the 933 MHz component rating; hardware training remains unverified |
| DEC-018 | Programmer image | Exactly 16 MiB; production composition requires a unique unicast base MAC and supports per-device Factory/WOEM/LEDEINFO blobs |

## Milestone 1: VRF NAT Vertical Slice

| ID | Requirement | Acceptance | Status |
| --- | --- | --- | --- |
| NAT-001 | Four isolated device domains | `lan2` through `lan5` use independent VRF routing tables | implemented, build pending |
| NAT-002 | Overlapping IPv4 networks | The same internal address works concurrently on different VRFs | implemented, hardware pending |
| NAT-003 | Bidirectional 1:1 NAT | New inbound and outbound connections use the configured external address | implemented, traffic test pending |
| NAT-004 | Static port-level 1:N | Non-overlapping TCP/UDP ranges on one external IP select different devices | implemented, traffic test pending |
| NAT-005 | NAPT internet access | Unmapped device sources use the WAN management address | implemented, traffic test pending |
| NAT-006 | Mapping capacity | 64 enabled or disabled mapping entries can be stored and applied | implemented, build pending |
| NAT-007 | Safe configuration | Validate, apply, confirm, timeout rollback, and reboot rollback | implemented, device test pending |
| NAT-008 | Web and NMS management | Misectel LuCI and versioned HTTPS JSON-RPC expose the same model | implemented, device test pending |
| SEC-001 | Safe factory state | No default route or forwarding until the one-time password setup completes | implemented, device test pending |
| SEC-002 | TLS management | HTTP redirects to HTTPS; TLS 1.2 minimum and TLS 1.3 are tested | planned |
| SYS-001 | Flashable image | Image exists, is at most `15936k`, and passes manifest/checksum checks | planned |
| SYS-003 | Bootloader artifact | Standalone MT7621 SPI NOR U-Boot uses 256 MiB DDR3 timing and boots firmware from `0x70000` | implemented, build pending |
| SYS-004 | Programmer artifact | Reproducibly compose and checksum an exact 16 MiB full-flash image without overwriting partition boundaries | implemented, build pending |
| SYS-002 | Startup | Power-on to ping is measured on hardware; 30 seconds is a target, not yet verified | deferred |
| PERF-001 | Traffic benchmark | PPS, throughput, loss, CPU, and latency are recorded without pass/fail thresholds | planned |

## Basic Product Requirements After Milestone 1

- `L2-001..007`: at least 1K observable MAC entries, static and dynamic MAC
  query with pagination, static port binding, blacklist filtering, and dynamic
  learning without disrupting forwarding.
- `IP-001..003`: Web/NMS management IPv4 address, gateway, mask, IPv4/IPv6
  management ACL, and static IP/MAC binding.
- `DNS-001..006`: DNS for NTP and remote logging, 1-2 static IPv4/IPv6 servers,
  management hostname with certificate, configurable cache, and DDNS.
- `MGMT-001..012`: HTTPS/SSHv2, login and role management, configuration/log
  export, reboot, factory reset, Web/NMS upgrade, manufacturer CLI, backup,
  restore, batch scripts, and live status.
- `TLS-001..004`: HTTP redirect, HTTPS, TLS 1.2/1.3, and secure upgrade,
  backup, and monitoring.
- `LOG-001..003`: critical event logging, filtered export, RAM ring buffer, and
  optional remote Syslog; TLS Syslog is a later capacity-gated item.
- `SNMP-001..004`: v1/v2c/v3 protocol support with Get/GetNext/Set/BulkGet;
  v1/v2c disabled by default; traps, MIB-II/IF-MIB/EtherLike-MIB/LLDP-MIB and
  advanced SNMPv3 algorithms are capability and capacity gated.
- `TIME-001..006`: multiple NTP/SNTP IPv4 sources with failover, RTC fallback,
  optional authentication, and Web status containing lock state, offset, and
  active server.
- `OPS-001..005`: process/system watchdog, port/traffic/CPU/memory status,
  firmware upgrade, configuration import/export, ping, and traceroute.
- `PORT-001..004`: speed, duplex, flow control, rate limit, administrative
  state, EEE capability reporting, and MTU configuration.
- `LLDP-001..004`: IEEE 802.1ab neighbor discovery, topology view, third-party
  interoperability, and SNMP/Syslog reporting.
- `ARP-001..005`: ARP query, up to 1024 permanent entries, ageing control, and
  proxy ARP.
- `ROUTE-001`: at least 64 configurable static routes.
- `DHCP-001..002`: WAN DHCP client mode and per-VRF DHCP server whose pool
  follows the internal subnet. Static WAN mapping is unavailable in DHCP mode.
- `MCAST-001`: IPv4 multicast group address translation with IGMP forwarding.
- `ALG-001`: explicitly enabled FTP and PPTP conntrack helpers; SIP ALG is not
  included.

## Expected and Security Requirements

- `ACL-001..007`: MAC, IPv4/IPv6, subnet, TCP/UDP port, ICMP and IGMP matching;
  schedules; permit, deny, and physical-port redirect actions; industrial
  templates; dynamic ARP protection; and per-port MAC limits.
- `PSEC-001..003`: dynamic learning limits, static allowlists, adjustable MAC
  ageing, blocked-or-alert overflow policy, and new-MAC log/Trap notification.
- `NETSEC-001..006`: broadcast/multicast storm limits, DoS/DDoS rate controls,
  ARP/DHCP guard, configurable ping response, security event logs, and an IEC
  62443-4-2 gap matrix. No zero-latency or certification claim is made.
- `ALARM-001..006`: link, bandwidth, broadcast/multicast, CRC, giant frame,
  loss, and security alarms; local/remote logs and SNMP counters/traps.
- `DIAG-001..003`: live link/speed/duplex/error query, filtered log search, and
  security event tracing.

## Capacity and Release Gates

- The 16 MiB NOR contains `u-boot`, `u-boot-env`, `factory`, `woem`,
  `ledeinfo`, and a 15936 KiB `firmware` partition in that order.
- A successful `make` is insufficient: the final image must exist, fit the
  profile limit, and pass SHA-256 manifest verification.
- A feature that does not fit must be marked `unsupported` here and removed
  completely from code, packages, menus, and documentation for that image.
- Hardware claims remain `deferred` until tested on the 7621EVB and wired DS3231.
