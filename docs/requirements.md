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
| DEC-001 | Hardware | `misectel,7621evb`, MT7621, 2 Gbit (256 MiB) DDR3 SDRAM rated at 933 MHz, 16 MiB SPI NOR, 4 LAN device ports and 1 WAN |
| DEC-002 | RTC | PCF85063AT on native `I2C_SD`/`I2C_SCLK` (GPIO3/GPIO4), address `0x51`; DTS/module enabled, but both boards return no ACK and require hardware inspection |
| DEC-003 | Device identity | IP addresses must be unique within one port/VRF; addresses may repeat across VRFs |
| DEC-004 | WAN mapping delivery | Static addresses from the WAN subnet, advertised with ARP |
| DEC-005 | Management | WAN-side management IP, forced to static `192.168.1.1/24` until first-run setup completes; later upgrades preserve the configured WAN |
| DEC-006 | NAT 1:N meaning | One external IP split by protocol/port ranges to multiple internal devices |
| DEC-007 | IPv6 boundary | Management and ACL may be dual stack; VRF NAT is IPv4 only |
| DEC-008 | Acceleration | Isolated VRF paths and firewall4 global flow offload remain software-only; one explicitly selected ordinary LAN may use a WAN/LAN-restricted MT7621 hardware flowtable |
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
| DEC-019 | Ethernet port order | MT7530 port 0 is WAN; MT7530 ports 1-3 are LAN1-3; the separate `gmac1`/PHY4 interface is LAN4 |
| DEC-020 | Subnet NAT delivery | Equal-length IPv4 prefixes preserve host bits; the upstream router routes each external prefix through the gateway WAN address |

## Milestone 1: VRF NAT Vertical Slice

| ID | Requirement | Acceptance | Status |
| --- | --- | --- | --- |
| NAT-001 | Four isolated device domains | Factory defaults assign `lan1` through `lan4` to independent VRFs; membership is editable and one interface cannot belong to two VRFs | API/UCI v5 and four default VRFs verified on hardware |
| NAT-002 | Overlapping IPv4 networks | The same internal address works concurrently on different VRFs | LAN1/LAN2 duplicate-address isolation verified on hardware |
| NAT-003 | Bidirectional 1:1 NAT | New inbound and outbound connections use the configured external address | VRF2 host mapping verified with ICMP and HTTP |
| NAT-004 | Static port-level 1:N | Non-overlapping TCP/UDP ranges on one external IP select different devices | implemented, traffic test pending |
| NAT-005 | NAPT internet access | Unmapped device sources use the WAN management address | implemented and nftables rules verified; final throughput test pending |
| NAT-006 | Mapping capacity | 64 enabled or disabled mapping entries can be stored and applied | implemented, hardware traffic test pending |
| NAT-007 | Safe configuration | Validate, apply, confirm, timeout rollback, and reboot rollback | HTTPS validate/apply/confirm and reboot persistence verified; timeout and explicit rollback pending |
| NAT-008 | Web and NMS management | Misectel LuCI and versioned HTTPS JSON-RPC expose the same model | HTTPS API and Playwright desktop/mobile page flow verified |
| NAT-009 | Bidirectional subnet 1:1 NAT | Equal internal/external prefix lengths preserve host bits and select the configured VRF in both directions | two-VRF duplicate-address ICMP/TCP and source translation verified; routed-prefix delivery pending |
| NAT-010 | Optional ordinary HNAT LAN | A global enable converts exactly one selected VRF definition to a main-table LAN; ports and prefixes cannot overlap WAN/other VRFs, mappings cannot target it, and only UCI/NMS controls whether LuCI exposes HNAT controls | API/UCI v8 and static validation implemented; target PPE/throughput verification pending |
| DHCP-002 | Per-VRF lightweight DHCP | Each VRF can independently distribute IPv4 address, mask, gateway and up to two DNS servers, with static MAC/address reservations | verified on VRF2/LAN2 with USB0 client static lease, gateway, DNS and reload recovery |
| SEC-001 | Safe factory state | WAN and LAN links are administratively up, but no default route or forwarding exists until one-time password setup completes | verified on device |
| SEC-002 | Web management | HTTP/80 and HTTPS/443 are both accepted from WAN by default without forced redirect; TLS 1.2 minimum and TLS 1.3 remain available | implementation and static checks complete; direct HTTP target regression pending |
| SYS-001 | Flashable image | Image exists, is at most `15936k`, and passes manifest/checksum checks | verified |
| SYS-003 | Bootloader artifact | Standalone MT7621 SPI NOR U-Boot uses 256 MiB DDR3 timing and boots firmware from `0x70000` | build and device boot verified |
| SYS-004 | Programmer artifact | Reproducibly compose and checksum an exact 16 MiB full-flash image without overwriting partition boundaries | verified |
| SYS-005 | Web firmware upgrade | Authenticated `System > Upgrade` accepts a RAM upload, validates device compatibility, displays SHA-256, supports preserving settings, and requires confirmation before sysupgrade | verified with Playwright upload/validation and a preserving hardware upgrade |
| SYS-002 | Startup | Power-on to ping is measured on hardware; 30 seconds is a target, not yet verified | regular reboot recovery measured at 38.67 and 53 seconds; target not met |
| PERF-001 | Traffic benchmark | PPS, throughput, loss, CPU, and latency are recorded without pass/fail thresholds | planned |
| PERF-002 | Network and management CPU separation | Dynamically place the Ethernet IRQ on CPU1, RPS on CPU2, spread XPS queue selection across CPUs, and constrain low-priority switch/LLDP/SNMP monitoring to CPU3; restore settings after network reload | verified on hardware with switch manager release 13 |

## Milestone 2: Switch Operations and Security

The following 17 expected requirements are implemented in source and included
in the device profile. Their status remains `implemented` until the new image
is exercised on the target; build or API checks alone are not hardware proof.

| ID | Requirement | Implementation | Status |
| --- | --- | --- | --- |
| PSEC-004 | Per-port learned MAC limit | 1-64 entries with alert or administrative shutdown | implemented |
| PSEC-005 | New MAC notification | Bounded local event/syslog and optional SNMP Trap | implemented |
| SNMP-005 | Operational Traps | Link, CPU, port error, traffic and security events | implemented |
| SNMP-006 | Standard MIB set | RFC1213/MIB-II, IF-MIB, EtherLike-MIB and LLDP-MIB through AgentX | implemented |
| SNMP-007 | Strong SNMPv3 | SHA-256/384/512 authentication and AES-128/256 privacy | implemented |
| PORT-005 | PHY configuration | Speed, duplex and RX/TX flow control | implemented |
| PORT-006 | Port operations | Rate limit, administrative state and runtime status | implemented |
| LLDP-005 | Topology view | Local node plus discovered LLDP neighbor graph | implemented |
| LLDP-006 | LLDP reporting | AgentX LLDP-MIB plus topology-change Syslog snapshot | implemented |
| NETSEC-007 | Storm suppression | Explicit per-port broadcast/multicast ingress policer | implemented |
| NETSEC-008 | Default-path latency | Passive polling has no forwarding hook; enabled policers require measurement | implemented |
| NETSEC-009 | Ping response | Configurable IPv4 ICMP echo response | implemented |
| ALARM-007 | Link notification | Link Up/Down local event, Syslog and optional standard Trap | implemented |
| ALARM-008 | Traffic threshold alerts | Utilization, broadcast and multicast thresholds | implemented |
| ALARM-009 | Ethernet error detection | CRC, length/giant and drop deltas with counters/events | implemented |
| DIAG-004 | Fast log search | Time, type, keyword and pagination filters | implemented |
| DIAG-005 | Port security trace | Illegal MAC, overflow, shutdown and unblock event trail | implemented |

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
  remote Syslog over TLS 1.2/1.3 with certificate validation and an exact
  destination IPv4 whitelist.
- `SNMP-001..004`: v1/v2c/v3 protocol support with Get/GetNext/Set/BulkGet;
  v1/v2c disabled by default; traps, MIB-II/IF-MIB/EtherLike-MIB/LLDP-MIB and
  advanced SNMPv3 algorithms are capability and capacity gated. Current
  hardware validation passes Get/GetNext/BulkGet, while the read-only VACM
  profile rejects Set with `noAccess`; writable objects and their authorization
  model remain to be specified and implemented.
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
- `DHCP-001`: WAN DHCP client mode through standard `network.wan`. Static WAN
  mapping is unavailable in DHCP mode.
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
- Hardware claims remain `deferred` until tested on the 7621EVB, including PCF85063AT read/write and backup-power retention.
- NAT performance remains a measured, non-gating delivery result. The feed
  provides raw-data/report tooling for 15Kpps, 100 Mbps forward/reverse and
  sub-1 ms latency, requiring the gateway plus independent WAN and LAN test
  endpoints. The 2026-08-07 RTL8152 regression used stimulus margin and measured
  15134.87 pps, 94.78/94.76 Mbps forward/reverse and 1.222 ms average RTT.
  15Kpps now passes; payload throughput and sub-1 ms latency remain unmet. A
  complete MAC policy measured 15134.68 pps, 94.76/94.77 Mbps and 1.178 ms,
  with no observed regression beyond measurement noise.

## Test Traceability

`scripts/generate-requirements-testcases.mjs` converts every customer row in
the delivery requirement matrix into one traceable case. It generates the
following artifacts from the same source and rejects mismatched case IDs:

- `docs/testcases/7621-nat-gateway-requirements-testcases.xmind`
- `docs/testcases/7621-nat-gateway-requirements-testcases.md`
- `docs/testcases/7621-nat-gateway-coverage.md`

The 2026-08-06 external-partner baseline contains 100 requirements and 100
cases, for 100% requirement design coverage. Test-case artifacts intentionally
exclude product implementation state, historical execution results, pass rate,
and unresolved delivery notes. Test evidence and verdicts belong in a separate
execution report maintained by the testing party.
