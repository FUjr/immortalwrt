# 非 Web 测试配置说明

本机名称：`7621 vrf evb`（board_name `misectel,7621evb`，产品型号 NEX905-F-40）。
本文档说明除 Web 界面外各测试项的配置方法、操作步骤与判定依据，供测试执行方复现。
Web 管理界面验证见 [`02-delivery-instruction.md`](02-delivery-instruction.md)。

## 1. 测试拓扑与设备

- 设备：`7621 vrf evb`（16MB），串口 `/dev/ttyCH343USB0`（115200 8N1）。
- 测试主机：Linux，`enp6s18`（10.96.210.226/24，管理网），两个 USB 网卡（RTL8152）接入 LAN1/LAN2。
- 固件：ImmortalWrt `r37896-45f33e0f05`（内核 6.12.85）。
- 工具容器：`alpine:3.22`（lldpd / net-snmp-tools，均以 `--network host` 运行）。

## 2. 系统启动与端口（发板测试）

**配置**：设备上电，串口连接，WAN 接管理网；LAN1/LAN2 接两个 USB 网卡。

**步骤**：
1. 串口观察 U-Boot → 内核 → 服务启动日志，记录 `DISTRIB_REVISION`。
2. 读取端口状态：`cat /sys/class/net/{wan,lan1..lan4}/carrier speed duplex`。
3. 桥接 LAN1/LAN2 验证 MAC 学习与二层转发：
   ```sh
   ip link add br-test type bridge
   ip link set lan1 master br-test; ip link set lan2 master br-test
   ip link set br-test up; ip addr add 192.168.10.1/24 dev br-test
   ```
   主机侧给 USB 网卡配 `192.168.10.101/24`、`192.168.10.102/24`（后者放入独立 netns），双向 ping。
4. 查询 FDB 与交换运维 API：
   ```sh
   bridge fdb show br br-test
   ubus call misectel.switch get_macs '{"page":1,"limit":20}'
   ```

**判定**：LAN1/LAN2 协商 100Mbps 全双工；两个 USB 网卡 MAC 分别学到 lan1/lan2；双向 ping 0% 丢包。

## 3. SNMP 测试

**配置**：先经 Web（Switch Operations → SNMP / LLDP）启用 SNMP 并设置 v3 口令；或在设备本地：
```sh
uci set misectel_switch.snmp.enabled='1'
uci set misectel_switch.snmp.auth_password='test-auth-pass-123'
uci set misectel_switch.snmp.privacy_password='test-priv-pass-123'
uci commit misectel_switch
/etc/init.d/misectel-switch reload
```

**NMS 工具（docker net-snmp）**：
```sh
docker run -d --name snmp-tools --network host --entrypoint sh alpine:3.22 \
  -c "apk add --no-cache net-snmp-tools >/dev/null 2>&1; sleep infinity"
docker exec snmp-tools sh -c 'snmpget -v2c -c public 192.168.1.1 sysObjectID.0 sysName.0'
```

**步骤**（以 `192.168.1.1` 为目标）：
1. 企业 OID 与基础信息：
   ```sh
   docker exec snmp-tools snmpget -v2c -c public 192.168.1.1 sysObjectID.0   # enterprises.62446.6.1.905.1
   docker exec snmp-tools snmpget -v2c -c public 192.168.1.1 sysName.0      # 7621 vrf evb
   ```
2. BRIDGE-MIB / ENTITY-MIB / LLDP-MIB：
   ```sh
   docker exec snmp-tools snmpget -v2c -c public 192.168.1.1 1.3.6.1.2.1.17.1.1.0
   docker exec snmp-tools snmpwalk -v2c -c public 192.168.1.1 1.3.6.1.2.1.47.1.1.1.1
   docker exec snmp-tools snmpwalk -v2c -c public 192.168.1.1 1.0.8802.1.1.2.1.4   # lldpRemTable
   ```
3. SNMP Set（可写管理标签）：
   ```sh
   docker exec snmp-tools snmpset -v2c -c public 192.168.1.1 sysLocation.0 s "BoardTest-RoomA"
   docker exec snmp-tools snmpset -v2c -c public 192.168.1.1 sysName.0 s "7621 vrf evb"
   docker exec snmp-tools snmpset -v2c -c public 192.168.1.1 sysContact.0 s "Inovance NEX905"
   ```
   成功写入并回读一致；`sysDescr`/`sysObjectID` Set 返回 `noAccess`（只读保护）。
4. SNMPv3 authPriv：
   ```sh
   docker exec snmp-tools snmpget -v3 -l authPriv -u misectel -a SHA-256 -A test-auth-pass-123 \
     -x AES-256 -X test-priv-pass-123 192.168.1.1 sysName.0
   ```

**判定**：`sysObjectID.0 = 1.3.6.1.4.1.62446.6.1.905.1`；`sysName.0 = 7621 vrf evb`；
BRIDGE-MIB/ENTITY-MIB/LLDP-MIB 可查；Set 限三个管理标签成功，只读对象被拒。

## 3A. LLDP 邻居模拟（本机 docker）

**配置**：在连接设备 WAN 口的主机网卡（本例 `enx00e03b83213f`）上运行 docker `lldpd`：
```sh
docker run -d --name lldp-sim --network host --hostname LLDP-TEST-HOST \
  --cap-add NET_RAW --cap-add NET_ADMIN \
  alpine:3.22 sh -c "apk add --no-cache lldpd >/dev/null 2>&1; exec lldpd -d -I enx00e03b83213f -c"
```

**步骤**：
1. 等待 ≥30s（设备 lldpd 发送周期 30s）。
2. 设备侧核对 Rx 计数与邻居：
   ```sh
   docker exec snmp-tools snmpget -v2c -c public 192.168.1.1 1.0.8802.1.1.2.1.2.7.1.4.4   # lldpStatsRxPortFramesTotal(wan)
   docker exec snmp-tools snmpwalk -v2c -c public 192.168.1.1 1.0.8802.1.1.2.1.4          # lldpRemTable
   ```
   或经 RPC：`misectel.switch get_topology`。
3. 容器侧反向核对：`docker exec lldp-sim /usr/sbin/lldpcli show neighbors`。

**判定**：设备 `lldpStatsRxPortFramesTotal(wan)` 递增，`lldpRemSysName=LLDP-TEST-HOST`、
`lldpRemPortId=enx00e03b83213f`；`get_topology` 返回完整邻居。

> 注意：`lldpd -r` 为「仅接收」模式，模拟发送端须去掉 `-r`，否则设备侧收不到（Rx 计数为 0）。

## 4. 安全功能测试（HTTPS RPC）

**配置**：设置管理口令并确保 HTTPS 可达。

**步骤**：
```sh
MISECTEL_PASSWORD='Admin@12345678' \
  scripts/run-feature-validation.sh https://192.168.1.1 /tmp/feature-validation
```

**判定**：静态 ARP/IP-MAC 绑定、Proxy ARP、DoS/ARP-DHCP 防护、端口重定向环路拒绝、
角色权限、TLS Syslog 白名单、HTTPS 证书各断言通过，测试后配置恢复。

## 5. NAT 性能测试

**配置**：WAN 与 LAN/VRF 两侧接入独立测试终端（或 RTL8152 USB 网卡）。

**步骤**：
```sh
scripts/run-nat-performance.sh
```

**判定**：记录 pps、正反向吞吐、丢包、CPU、时延。当前 15Kpps 通过；100Mbps 与 <1ms
为待整改项（见 `01-test-report.md`）。

## 6. 组播 NAT 测试

**配置**：WAN 侧与 VRF1/LAN1 侧各接终端，加载 `act_pedit`/`act_csum`。

**步骤**：配置 WAN `239.20.20.20:5000` ↔ VRF1 `239.10.10.10:5000` 组播映射，双向发送
组播，抓包核对目的组改写与源地址 SNAT。测试后删除临时规则。

## 7. CLI 测试

**配置**：厂家调试账号，隔离管理网。SSH 默认按安全策略关闭，需先在「Access Security」
开启 SSHv2 后复测。

**步骤**：
```sh
ssh root@192.168.1.1
ubus call misectel.vrf get_status
```

**判定**：SSHv2 可登录，状态查询/配置备份恢复正常，调试入口未向普通用户开放。

## 8. 可靠性专项（待执行）

- 30*24H 长稳、大量 ARP 冲击下管理面可用性、内存泄漏监控（`free` 曲线）。
- 异常掉电（反复断电观察 FLASH/配置完整性）。
- 异常配置导入（构造损坏配置核对拒绝）。
- WEB/SNMP/CLI 并发配置一致性。
- 32M 变体：升级中断电、corrupt-slot 回滚、crash-loop 回退、双槽位出厂启动。

## 9. 静态检查脚本

```sh
sh scripts/check-switch-manager.sh
sh scripts/check-vrf-manager.sh
sh scripts/check-security-manager.sh
```

## 10. 测试用例与覆盖率

- 按模块测试用例：`docs/deliverable/testcases/<module>.md`（21 个模块）。
- 汇总/索引：`docs/deliverable/testcases/index.md`、`all-testcases.md`。
- XMind：`docs/deliverable/testcases/requirements-testcases.xmind`。
- PDF：`docs/deliverable/testcases/requirements-testcases.pdf`。
- 覆盖率：`docs/deliverable/testcases/coverage.md`。

由 `scripts/generate-srs-testcases.mjs`（数据源 `scripts/srs-requirements.mjs`）从 SRS
需求生成；PDF 由 `scripts/md2pdf.js` 转换。
