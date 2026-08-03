# 7621EVB Subnet NAT Test

## Minimum Equipment

The complete duplicate-address isolation test requires four devices total:

- One Misectel 7621EVB gateway under test.
- Two internal endpoints with the same `192.168.10.100/24` address, connected
  to LAN1 and LAN2 respectively.
- One WAN endpoint capable of installing static routes and generating ICMP,
  TCP, and UDP traffic.

A smoke test of only one prefix can use one internal endpoint, one WAN endpoint,
and the gateway. That three-device topology does not prove isolation between
duplicate addresses on separate VRFs.

## Reference Topology

Configure the gateway WAN as `172.16.0.2/24` and the WAN endpoint as
`172.16.0.1/24`. On the WAN endpoint install:

```sh
ip route add 172.16.10.0/24 via 172.16.0.2
ip route add 172.16.20.0/24 via 172.16.0.2
```

Configure both internal endpoints with gateway `192.168.10.1`. Create these
gateway mappings:

| VRF | Internal prefix | External prefix |
| --- | --- | --- |
| LAN1 | `192.168.10.0/24` | `172.16.10.0/24` |
| LAN2 | `192.168.10.0/24` | `172.16.20.0/24` |

## Required Results

1. Before enabling forwarding, WAN and LAN1-LAN4 report administratively up
   when cabled, while IPv4 forwarding remains disabled.
2. `172.16.10.100` reaches only the LAN1 endpoint and `172.16.20.100` reaches
   only the LAN2 endpoint.
3. LAN1-initiated traffic appears as `172.16.10.100`; LAN2-initiated traffic
   appears as `172.16.20.100`.
4. ICMP, TCP, UDP, return traffic, counters, configuration confirmation, and
   timeout rollback all work.
5. The two identical internal addresses remain isolated from each other.

## 2026-08-03 Smoke Result

The available single internal OpenWrt device was physically linked through the
interface reported by its kernel as `lan1`, although the test setup described
the socket as WAN. Two addresses, `192.168.10.101` and `.102`, exercised the
LAN1 mapping `192.168.10.100/30` to `10.96.210.244/30`.

The WAN test host could not install a route without elevated privileges, so
`10.96.210.245/32` and `.246/32` were added temporarily to the gateway only to
provide ARP for this direct-L2 smoke test. This does not validate the production
requirement that an upstream router route the whole external prefix.

Both addresses passed continuous bidirectional ICMP and HTTP/TCP tests with
zero observed loss and approximately 1 ms mean ICMP latency. UDP was not tested
because the endpoint BusyBox `nc` lacks UDP mode. LAN2 duplicate-address
isolation, routed-prefix delivery, rollback, and performance remain pending.
