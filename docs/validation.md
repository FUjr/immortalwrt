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
- Switch operations validation additionally requires the manifest to contain
  `misectel-switch-manager`, `luci-app-misectel-switch`, `lldpd`, `snmpd-ssl`,
  `snmp-utils-ssl`, `snmp-mibs`, `ethtool-full`, and `tc-full`. Static checks
  must run both application-feed check scripts. Hardware validation must cover
  ubus/LuCI, MAC actions, event filters, SNMPv3 AES-256, standard MIB objects,
  Traps, LLDP topology/Syslog, storm counters and ping response. Latency is
  measured once without policers and once with an enabled policy.
- The built kernel DTB must label MT7530 port 0 as the actual `wan`, ports 1-3
  as `lan1`-`lan3`, and `gmac1`/PHY4 as `lan4`. The manager package must contain
  API/UCI schema v6 with independent VRF objects, interface membership and
  per-VRF DHCP; no pre-release configuration migration scripts are installed.
- The build seed enables BusyBox `udhcpd`. Static checks cover DHCP pool bounds,
  DNS count, duplicate static reservations, firewall input admission, generated
  runtime configuration, process status, and closing the rc.common lock in each
  background DHCP child. Each server must run in its `ip vrf exec` context and
  firewall input must match the `vrf-*` master rather than its bridge.
- The built root filesystem contains equal-prefix subnet DNAT/SNAT rules and
  explicitly brings `wan` and `lan1`-`lan4` administratively up in the safe
  factory state. Static validator tests cover valid subnet mappings, unequal
  prefix lengths, overlapping external ranges, and internal ranges outside the
  selected VRF.
- The programmer image is exactly 16 MiB. Byte comparison confirms U-Boot at
  `0x000000`, the base MAC at `0x04E000`, erased WOEM at `0x050000`, erased
  LEDEINFO at `0x060000`, and an exact sysupgrade payload at `0x070000`.
- After composing the standalone U-Boot and programmer image, the build script
  refreshes the OpenWrt target checksum list. Both that list and the dedicated
  artifact checksum list pass `sha256sum -c`.

## Verified On Hardware

- Switch manager release 13 was installed on the attached gateway from a
  checksum-matched APK (`4dcca769a022d9d6eef4cf9ab0feb3f33eaace667cc67209bb988ed26c88904d`).
  The dynamically discovered Ethernet IRQ was 19 and its effective mask was
  `2` (CPU1). Both `eth0` and `lan4` RX queues reported RPS mask `4` (CPU2),
  while the first four TX queues reported XPS masks `1,2,4,8`, repeated across
  the remaining queues. The switch watcher ran on CPU3 with nice level 10;
  active `lldpd` processes were also constrained to CPU3. `snmpd` was disabled
  by the retained product configuration, while the same tuning script covers
  it whenever enabled.
- After `/etc/init.d/network reload`, IRQ mask `2`, RPS mask `4`, XPS mask `1`,
  and watcher CPU3 affinity remained in place. Basic WAN port state timestamps
  advanced every 10-11 seconds. Consecutive MAC-table and LLDP timestamps
  advanced by about 34 seconds, consistent with their independent 30-second
  schedule plus collection time, rather than running on every port sample.
- VRF DHCP release 19 ran each BusyBox server in its matching `ip vrf exec`
  context and admitted requests on the `vrf-*` input interface. The USB0
  client on LAN2 received static lease `192.168.10.50/24`, gateway
  `192.168.10.1`, DNS `10.96.210.1`, and lease time 43200 seconds. Server logs
  recorded Offer and ACK. Two consecutive manager reloads completed in 14
  seconds total, both DHCP instances returned to running state, and neither
  child retained rc.common descriptor 1000.
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
- Switch manager release 11 and the final release image were validated on the
  gateway after identifying it by revision, uptime, VRF devices and interface
  set. `get_macs` returned the real LAN1 MAC and the distinct LAN2 simulator
  MAC. An incomplete `validate_config` candidate returned `valid: false` with
  field-specific errors; release 10 had instead raised an ubus unknown error.
- The final kernel loaded `cls_flower` and `act_police`. A temporary LAN3 test
  installed a 1 Mbit TBF, multicast-destination flower policer and matchall
  ingress policer. `tc -s` reported all three rules, and restoring the settings
  to zero removed them. Ping response was restored enabled, SNMP was disabled,
  and test SNMP authentication/privacy values were absent after the run.
- A temporary allowed-MAC mismatch and a two-address MAC limit generated
  searchable critical security events while the alert action left LAN1 up.
  New-MAC logging recorded the real LAN1 endpoint. Port administrative state,
  ping-response toggling, event type filtering, API password redaction and
  HTTPS status 200 were also exercised and restored.
- VRF manager release 11/API v4 and firmware revision
  `r0+37858-3b3ef3b713` were installed with `sysupgrade -n` on both the gateway
  at `/dev/ttyCH343USB5` and the MT7621 endpoint at `/dev/ttyCH343USB0`. The
  endpoint downloaded the image through its WAN connection to a gateway VRF;
  its SHA-256 matched before `sysupgrade -T` accepted the image. Both boards
  completed NOR boot and reported `misectel,7621evb` after upgrade.
- On both upgraded boards the active interface set is `wan`, `lan1`, `lan2`,
  `lan3`, and independent `lan4`; the obsolete `lan5` name is absent. The
  USB0 endpoint's cabled DSA port appeared as `wan` with carrier, confirming
  the corrected physical WAN mapping. `capabilities` reported API v4, 16 VRFs,
  and member interfaces `lan1`-`lan4`. Factory configuration assigns each LAN
  interface to a separate `vrf1`-`vrf4` object while global forwarding remains
  disabled until setup is completed.
- The gateway was temporarily enabled to transfer the image into the VRF. The
  temporary WAN address, port-8080 HTTP process, firmware copies, nftables
  allow rules, and `tcp_l3mdev_accept=1` setting were removed afterward. Final
  gateway state is `setup_complete=0`, `enabled=0`, WAN
  `192.168.1.1/24`, `ip_forward=0`, no runtime VRF/bridge devices, and no port
  8080 listener. Both `sysupgrade -n` operations intentionally leave the root
  password unset for first-run provisioning.
- Manager release 20 corrects the factory-WAN regression caused by the board
  defaults creating `network.wan` as DHCP before the gateway defaults run. The
  gateway defaults now rebuild WAN as static `192.168.1.1/24` whenever
  `setup_complete=0`, but preserve the configured WAN after setup completion.
- A later live configuration set gateway WAN to `10.96.210.253/24`, upstream
  gateway to `10.96.210.1`, and enabled all four default VRFs. USB0 was placed
  behind `vrf2` on LAN2 with WAN `192.168.10.101/24`, default route
  `192.168.10.1`, and a unique test MAC. Host mapping `10.96.210.252` to
  `vrf2/192.168.10.101` passed four-packet ICMP in both directions with zero
  loss; HTTP returned the expected 307 HTTPS redirect and HTTPS returned 200.
- Live nftables counters exposed the member bridge during prerouting and the
  `vrf-vrf2` master during forward/postrouting. Manager release 13 retains
  VRF-master matching at those later hooks and fixes fallback NAPT generation
  so rules are emitted before the SNAT chain is assembled. The temporary debug
  counters were removed by the final firewall reload.
- Manager release 16 and the matching dashboard were installed on the gateway.
  `get_status.interfaces` reported LAN1/LAN2 carrier up at 100 Mbps and
  LAN3/LAN4 carrier down. The homepage rendered the same values and counted two
  linked members without assigning the isolated LAN ports to netifd.
- netifd owns the live static WAN `10.96.210.253/24`. After a full network
  reload, all four VRFs remained up, the manager restored mapping alias
  `10.96.210.252/32`, and VRF2 retained canonical connected route
  `10.96.210.0/24` plus its onlink default route. The mapped address then passed
  three ICMP packets with zero loss and 1.312 ms mean; HTTP returned 307.
- Playwright exercised the gateway dashboard, WAN page, VRF overview, member
  editor, NAT mapping editor and 390x844 mobile dashboard. It found four VRFs,
  no cellular labels, and zero page errors. The screenshots are tracked under
  `docs/assets/delivery`.
- Final revision `r0+37862-f8ff143f00` was installed as a full, configuration-
  preserving sysupgrade on both the actual VRF gateway and the USB0-connected
  MT7621 endpoint. Both copies matched SHA-256 and passed `sysupgrade -T`
  before writing. Both boards completed NOR boot, restored their overlays and
  reported the final revision. The known JFFS2 busy-inode warning occurred on
  both upgrades but did not prevent firmware writing, reboot or config restore.
- The USB0 endpoint retained WAN `192.168.10.101/24` and its default route and
  reached host `10.96.210.226` through the gateway. The gateway retained netifd
  WAN `10.96.210.253/24`, mapping alias `10.96.210.252/32`, four active VRFs,
  and table 1002 connected/default routes. Five post-upgrade pings to `.253`
  and `.252` had zero loss and means of 0.613 ms and 0.991 ms respectively;
  mapped HTTP returned 307.
- SNMPv3 authPriv queries using SHA-256 and AES-256 returned system and IF-MIB
  data. EtherLike `dot3StatsTable` returned the switch interface indices, and
  the LLDP-MIB local system description returned `ImmortalWrt`. SNMP test
  credentials and generated runtime configuration were removed afterward.
- Manager release 20 image `r0+37867-29ea152184` was uploaded through the
  authenticated LuCI firmware path to both boards. Device matching and
  `sysupgrade --test` passed, and the uploaded 11,797,050-byte copies matched
  SHA-256 `9c658ebcb9d2192d3ba580cf2a6835cd425c852c68ee67db1368027591b4e7cb`.
  The configured gateway completed a preserving upgrade and retained
  `setup_complete=1` and WAN `10.96.210.253/24`.
- Before its preserving upgrade, the USB0 endpoint reported
  `setup_complete=0` with a DHCP WAN. After reboot, a direct ping from VRF2
  reached `192.168.1.1` three times with zero loss, proving that release 20
  replaced the DHCP section with the factory static management address. The
  temporary VRF2 prefix and `10.96.210.252` mapping used for this check were
  removed; VRF2 was restored to `192.168.10.1/24` with DHCP enabled and no
  pending transaction. Serial devices were not enumerated during this run, so
  the USB0 post-upgrade revision was not read from its console.
  The 16 MiB programmer image SHA-256 is
  `4156c7a04e76159bde5e6145c9811989bfe3bca88d7aa4201130679cc3c709ba`;
  the 194,690-byte standalone U-Boot SHA-256 is
  `5199a4aab34c3a383666992c749d706ecbf98e3d5a03e90252dc12a6061a8654`.
- Revision `r0+37869-06929658b5` adds the branded Web firmware upgrade package
  to the device profile. Its 11,797,050-byte sysupgrade SHA-256 is
  `dc6f0e4dd147373b90729e87e645da7f6cba1ec2f39962ab3782970b876f8f0b`;
  the exact 16 MiB programmer image SHA-256 is
  `d666f7fa70df0456e730730b13ace2e481667197c51a26600134d6c0198f39c6`.
  The firmware payload embedded at programmer offset `0x070000` matches the
  sysupgrade image byte for byte.
- Playwright logged into the gateway over HTTPS, selected that exact image and
  exercised the RAM upload and compatibility check without starting a second
  write. The page displayed the expected SHA-256, device match, fwtool status,
  preserve-settings control and confirmation action; it reported no page
  errors or horizontal overflow. The uploaded temporary image was removed.
- The same image had first been uploaded through the Web backend on the actual
  gateway, matched SHA-256, passed the device check and `sysupgrade --test`,
  then completed a preserving upgrade. After reboot the board reported
  `r0+37869-06929658b5` and `misectel,7621evb`.
- Revision `r0+37872-7a55c977bf` integrates the static ARP/IP-MAC, Proxy ARP,
  DoS/ARP-DHCP guard, physical Redirect, role-management, TLS Syslog and HTTPS
  certificate managers. The 11,797,050-byte sysupgrade SHA-256 is
  `c58d33a9ddf3c72d5b5449cb167521b2d67b25366fb5118fd2c4bdfd97ac36ad`;
  the exact 16 MiB programmer SHA-256 is
  `be5349b2b4adfae4f6d414668b4dab67ac1db933cd275c77d626e18abaea6ddf`.
  The manifest contains all three new security packages, checksum manifests
  pass, and the programmer payload at `0x070000` matches sysupgrade byte for
  byte. This is build evidence; the hardware upgrade and feature tests are
  recorded separately below when executed.
- The same revision was booted on both currently connected boards (`ACM0` VRF
  gateway and `ACM5` downstream board). Both report
  `r0+37872-7a55c977bf`; `misectel.security` and `misectel.system` expose the
  expected management methods on both images. The downstream image matched the
  build SHA-256 and passed `sysupgrade -T` before writing.
- The downstream upgrade logged the known JFFS2 `Busy inodes after unmount`
  warning, continued through firmware write and booted the new revision. Its
  temporary WAN address was not retained and was restored manually, so
  configuration-preserving upgrade remains unaccepted.
- With the duplicated development MAC isolated by a distinct runtime MAC on the
  gateway LAN2/VRF2 bridge, the gateway reached `192.168.10.101` from
  `vrf-vrf2` with 3/3 replies and 1.093 ms average RTT. The reverse path to the
  host Web server did not complete; this run therefore does not close the NAPT
  bidirectional hardware test.
- Revision `r0+37875-97f2ec324a` adds `kmod-sched` as an explicit multicast
  NAT dependency. Its 11,862,586-byte sysupgrade SHA-256 is
  `b40d623a3c73765425da0d9c7c14218f94bf2850e939afb214adde644901de92`;
  the exact 16 MiB programmer image SHA-256 is
  `e5be7bf496e9fe4aaeaa4ee71a9ca22eb76dd591ab05c4eda96ff3a9e31b55e7`.
  The manifest contains manager release 22 and `kmod-sched`; the programmer
  payload at `0x070000` matches sysupgrade byte for byte.
- The formal image booted on both `ACM0` gateway and `ACM5` downstream board.
  Both report the new revision and installed scheduler packages. The gateway
  retained WAN `10.96.210.253/24`; the downstream board returned to factory WAN
  and was restored to `192.168.10.101/24` with a unique persistent test MAC.
  Both upgrades logged the known JFFS2 busy-inode warning but completed.
- On the formal image, a temporary bidirectional multicast mapping installed
  complete flower, pedit, checksum and mirred actions without manual module
  loading. Earlier live packets proved WAN group `239.20.20.20` rewrites to
  VRF1 group `239.10.10.10`, while the reverse direction rewrites the group and
  SNAT source to `10.96.210.253`. Temporary mappings and filters were removed.
- HTTPS feature validation passed static ARP/IP-MAC apply and paging, Proxy ARP,
  DoS and ARP/DHCP monitor policies, redirect loop rejection, three roles,
  password policy, TLS Syslog whitelist rejection and certificate state. The
  script restored the complete security configuration afterward.
- RTL8152 NAT testing measured 14,998.02 pps at 64-byte UDP with zero loss,
  92.85 Mbps forward and 93.20 Mbps reverse UDP, and 2.673 ms average ICMP RTT.
  Gateway CPU busy averaged 15.82% and peaked at 45%. The strict 15K pps,
  100 Mbps and sub-1 ms requirements all failed; raw JSON and ping output are
  retained in the delivery archive.
- The 2026-08-07 RTL8152 regression isolated the LAN adapter in a separate
  network namespace and corrected the small-packet stimulus to exceed the
  acceptance threshold. The default policy measured 15,134.87 pps with zero
  loss, 94.78/94.76 Mbps forward/reverse, and 1.222 ms average RTT. Enabling a
  one-MAC allow list and limit plus bridge IP-MAC enforcement measured
  15,134.68 pps, 94.76/94.77 Mbps and 1.178 ms; no sustained MAC-policy
  regression was observed. RPS disablement and UDP GRO forwarding both
  regressed results and were restored rather than committed as data-plane
  tuning. See `docs/nat-performance-optimization-20260807.md`.
- After a clean ramips kernel rebuild, the 7621EVB DTB reports the native I2C
  controller enabled and `nxp,pcf85063a` at address `0x51`. Kernel configuration
  has `CONFIG_RTC_DRV_PCF85063=m`, `CONFIG_RTC_DRV_DS1307` disabled, and produced
  both `rtc-pcf85063.ko` and the `kmod-rtc-pcf85063` APK with an autoload entry.
- Full image revision `r0+37877-52c94e7647` contains that DTB and RTC package.
  Its 11,862,586-byte sysupgrade SHA-256 is
  `e0c44cc7ae345db310a1b3d6c5c6c3c3f6463ee05304208b77a4647b83cc1603`;
  the exact 16 MiB programmer image SHA-256 is
  `69a152b92c63a8706e7e8a660a288126e6c2974555a6cf0fed7092dc3ef95dbe`.
  Both the gateway and downstream board downloaded the image, reproduced its
  SHA-256, accepted it with `sysupgrade -T`, completed NOR write and booted the
  new revision. The known JFFS2 busy-inode warning occurred but did not stop
  either upgrade.
- On both boards `kmod-rtc-pcf85063` and `rtc_pcf85063` are present, the native
  controller runs at 100 kHz, and pinctrl assigns GPIO3/GPIO4 to the I2C group.
  Nevertheless, both probes report `RTC chip is not present` and error `-145`;
  an address-specific `i2cdetect` scan reports no ACK at `0x51`, so `/dev/rtc0`
  is not created. Power, pull-ups, soldering and the MT7621
  `I2C_SD`/`I2C_SCLK`-to-RTC SDA/SCL schematic path require hardware inspection
  before further driver changes.
- Gateway WAN `10.96.210.253/24` survived the upgrade. The downstream board
  returned to factory WAN because setup is incomplete, then was restored to
  `192.168.10.101/24` with test MAC `02:76:21:00:00:02`; it reached VRF2 gateway
  `192.168.10.1` with 2/2 replies. Temporary port-8080 service, nft rules and
  transfer/diagnostic files were removed afterward.

## SNMP MIB Validation (2026-08-05)

- Revision `r0+37877-52c94e7647` passed external SNMPv3 authPriv Get, GetNext,
  and BulkGet with SHA-256/AES-256. MIB-II system objects, IF-MIB status and
  64-bit counters, EtherLike indices/counters, and LLDP-MIB local/neighbor data
  returned successfully.
- The receiver decrypted the private event Trap and observed LLDP-change and
  port-error events. A synthetic linkDown test selected the standard linkDown
  notification OID and carried the private port/message fields; physical cable
  removal remains pending.
- A Set request for `sysLocation.0` returned `noAccess`, so the delivered VACM
  profile is read-only and does not satisfy the customer's Set requirement.
- The private symbols resolve to `.1.3.6.1.4.1.8072.9999`, but Net-SNMP warns
  that `CONTACT-INFO` is missing. PEN 8072 belongs to Net-SNMP; a production PEN
  and complete SMIv2 metadata remain required.
- The test restored `misectel_switch`, `snmpd`, and firewall configuration,
  removed temporary credentials and receiver state, and left SNMP disabled as
  before the test. A live HTTPS RPC re-check confirmed revision, disabled agent,
  threshold 90%, poll interval 5 seconds, and disabled Trap state.
- Full commands, returned objects, component versions, and operational guidance
  are in `docs/snmp-mib-delivery-report.md`.

## Hardware Validation Pending

- Extended DDR stress, programmer erase/write/readback, and cold power-cycle
  repetition.
- LAN3-LAN4 traffic, routed external prefixes through an upstream router, host
  1:1 NAT, port mapping, and NAPT.
- UDP timeout and explicit rollback, production HTTPS certificate provisioning
  and trust, sustained/long-duration performance, and latency with protection
  policies enabled.
- LLDP topology rendering and LLDP-change Syslog with broader third-party
  neighbors; the SNMP/MIB run validated one ImmortalWrt neighbor and LLDP Trap.
- PCF85063AT detection at I2C address `0x51`, time read/write, reboot restore and
  backup-power retention. The former DS3231 `0x68` probe and its `-145` error
  were caused by an incorrect pre-hardware DTS assumption and have been removed.

The first programmer image reached `U-Boot SPL` and printed
`Trying to boot from NOR`, then stopped. Its generated defconfig had been
truncated before `CONFIG_MT7621_SPI`, `CONFIG_LZMA`, and `CONFIG_SPL_LZMA`, so
SPL could not load and decompress the LZMA main U-Boot payload. The source
patch and build assertions cover this failure. The replacement image has now
booted repeatedly through SPL, main U-Boot, and Linux on the target.

Build verification does not establish hardware compatibility. Production
images must replace the development MAC and blank metadata regions with a
unique assigned MAC and manufacturing-supplied Factory/WOEM/LEDEINFO data.
