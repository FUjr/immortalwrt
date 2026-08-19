# 测试配置说明（非 Web 测试）

本文档说明除 Web 界面外各测试项的配置方法、操作步骤与判定依据，供测试执行方复现。

## 1. 测试拓扑与设备

- 设备：`misectel,7621evb`（NEX905-F-40，16MB），串口 `/dev/ttyCH343USB0`（115200 8N1）。
- 测试主机：Linux，`enp6s18`（管理网），两个 USB 网卡（RTL8152/8153）接入 LAN1/LAN2。
- 固件：ImmortalWrt `r37884+10-2f19f2b9cb`。

## 2. 系统启动与端口测试（发板测试）

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
   主机侧给 USB 网卡配 `192.168.10.101/24`、`192.168.10.102/24`（后者放入独立 netns），
   双向 `ping`。
4. 查询 FDB 与交换运维 API：
   ```sh
   bridge fdb show br br-test
   ubus call misectel.switch get_macs '{"page":1,"limit":20}'
   ```

**判定**：LAN1/LAN2 协商 100Mbps 全双工；两个 USB 网卡 MAC 分别学到 lan1/lan2；
双向 ping 0% 丢包。

详细结果见 [`docs/board-bringup-test-report.md`](board-bringup-test-report.md)。

## 3. SNMP 测试

**配置**：启用 SNMP 并设置 v3 口令：
```sh
uci set misectel_switch.snmp.enabled='1'
uci set misectel_switch.snmp.auth_password='test-auth-pass-123'
uci set misectel_switch.snmp.privacy_password='test-priv-pass-123'
uci commit misectel_switch
/etc/init.d/misectel-switch reload
```

**步骤**（在设备本地执行，或从 NMS 以 `192.168.1.1` 为目标）：

1. 企业 OID 与基础信息：
   ```sh
   snmpget -v2c -c public localhost sysObjectID.0   # enterprises.62446.6.1.905.1
   snmpget -v2c -c public localhost sysDescr.0
   ```
2. BRIDGE-MIB（VRF 桥 MAC）与 ENTITY-MIB：
   ```sh
   snmpget -v2c -c public localhost 1.3.6.1.2.1.17.1.1.0    # Hex-STRING: 02 76 21 00 03 E9
   snmpwalk -v2c -c public localhost 1.3.6.1.2.1.47.1.1.1.1
   ```
3. SNMP Set（可写管理标签）：
   ```sh
   snmpset -v2c -c public localhost sysLocation.0 s "BoardTest-RoomA"
   snmpset -v2c -c public localhost sysDescr.0 s "hack"        # 应返回 noAccess
   ```
4. SNMPv3 authPriv：
   ```sh
   snmpget -v3 -l authPriv -u misectel -a SHA-256 -A test-auth-pass-123 \
     -x AES-256 -X test-priv-pass-123 localhost sysName.0
   ```

**判定**：`sysObjectID.0 = 1.3.6.1.4.1.62446.6.1.905.1`；`dot1dBaseBridgeAddress`
为 VRF 桥 MAC；Set 仅允许 3 个管理标签，`sysDescr` 拒绝。

详细结果见 [`docs/snmp-mib-delivery-report.md`](snmp-mib-delivery-report.md)、
[`docs/snmp-mib-design.md`](snmp-mib-design.md)。

## 4. 安全功能测试（HTTPS RPC）

**配置**：设置管理口令并确保 HTTPS 可达。

**步骤**：
```sh
MISECTEL_PASSWORD='Admin@12345678' \
  scripts/run-feature-validation.sh https://192.168.1.1 /tmp/feature-validation
```

**判定**：安全能力（静态 ARP/IP-MAC 绑定、Proxy ARP、DoS/ARP-DHCP 防护、端口重定向
环路拒绝、角色权限、TLS Syslog 白名单、HTTPS 证书）各断言通过，测试后配置恢复。

## 5. NAT 性能测试

**配置**：WAN 与 LAN/VRF 两侧接入独立测试终端（或 RTL8152 USB 网卡）。

**步骤**：
```sh
scripts/run-nat-performance.sh
```

**判定**：记录 pps、正反向吞吐、丢包、CPU、时延（15Kpps 已通过；100Mbps 与
<1ms 为待整改项，见 `docs/requirements.md` 容量门禁）。

## 6. CLI 测试

**配置**：厂家调试账号，隔离管理网。

**步骤**：
```sh
ssh root@192.168.1.1
# 状态查询、配置备份/恢复、批量脚本
ubus call misectel.vrf get_status
```

**判定**：SSHv2 可登录，状态查询/配置备份恢复正常，调试入口未向普通用户开放。

## 7. 静态检查脚本

交换机/安全/系统各模块的静态检查（`feed` 仓库 `scripts/check-*.sh`）：
```sh
sh scripts/check-switch-manager.sh
sh scripts/check-vrf-manager.sh
sh scripts/check-security-manager.sh
```

## 8. 测试用例与覆盖率

功能需求测试用例（100 条、25 分类）由 `scripts/generate-requirements-testcases.mjs`
从 `docs/delivery-report.md` 需求矩阵生成：

- XMind：`docs/testcases/7621-nat-gateway-requirements-testcases.xmind`
- Markdown：`docs/testcases/7621-nat-gateway-requirements-testcases.md`
- PDF：`docs/testcases/7621-nat-gateway-requirements-testcases.pdf`
- 覆盖率：`docs/testcases/7621-nat-gateway-coverage.md`
