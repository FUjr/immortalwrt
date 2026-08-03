# 7621 Switch Operations Hardware Regression

## Current lab topology (2026-08-03)

- Host HTTP server: `/var/www/html`, TCP port 80; host and gateway WAN share one
  Layer-2 segment.
- Gateway console observed at the end of the run: `/dev/ttyCH343USB1`, 115200
  8N1.
- LAN simulator A: `/dev/ttyCH343USB5`, 115200 8N1; its WAN connects to a
  gateway LAN port and can hold multiple IPv4 addresses.
- LAN simulator B: `/dev/ttyCH343USB0`, 115200 8N1; same role on another
  gateway LAN port and runs older MT7621 firmware with a `lan5` interface.
- `/dev/ttyCH343USB4` did not answer during the final enumeration.
- Credentials are supplied out of band for each run and must not be stored in
  scripts, command transcripts, artifacts, or this repository.

The initially supplied mapping was USB5 for the gateway, USB4 for simulator A,
and USB0 for simulator B. During the final 2026-08-03 regression the devices
re-enumerated to the mapping above. The gateway and the older simulator report
the same device-tree model and hostname family, so model alone is not a
sufficient identity check. Also compare firmware revision, uptime, the
presence of `vrf-*` runtime links, and the exact interface set before changing
state.

Serial numbering and device configuration may change. Before every run,
enumerate all `/dev/ttyCH343USB*`, open each console at 115200 8N1, and verify
hostname/model/interface state before issuing commands. Do not infer a device
identity solely from its path.

## Preflight

1. Save `ubus call system board`, `ip -br link`, `ip -br addr`, current UCI
   network/firewall/dropbear state, and package versions from all three devices.
2. Confirm gateway `wan`, `lan1` through `lan4`, and which two LAN ports have
   carrier. Confirm the host HTTP address is reachable only through the intended
   route.
3. Inspect firewall and dropbear configuration before changing it. The lab
   one-line workaround that deletes a fixed UCI line and globally replaces
   `REJECT` is not assumed safe or repeatable; use named UCI sections and the
   smallest temporary change, then restore the saved configuration.
4. Verify the installed firmware and application package versions match the
   artifact under test. A source build is not evidence that the board runs it.

## Regression matrix

1. Validate all five administrative states, auto-negotiation, forced
   speed/duplex where supported, RX/TX flow control and live counters.
2. Learn multiple simulated MAC addresses, test alert and shutdown limits,
   allowed-MAC violations, manual unblock, pagination and non-disruptive reads.
3. Trigger link up/down, CPU, error/drop, bandwidth, broadcast and multicast
   events; verify local search filters, Syslog and configured Trap reception.
4. Query SNMPv3 with SHA-256/AES-256 and verify system/MIB-II, IF-MIB,
   EtherLike-MIB, LLDP-MIB and the custom notification MIB.
5. Discover both LAN simulators with LLDP, compare LuCI topology, ubus JSON,
   AgentX data and Syslog changes.
6. Test ping-response enable/disable and restore it. Measure ICMP latency with
   all tc policies disabled, then enable one rate/storm policy, verify counters
   and repeat the measurement.
7. Re-run existing two-VRF duplicate-address subnet NAT tests to detect
   forwarding, port-label, firewall or package-size regressions.
