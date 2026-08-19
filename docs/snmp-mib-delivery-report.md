# Misectel 7621EVB SNMP/MIB 交付与实机验证报告

交付日期：2026-08-05  
设备：Misectel 7621EVB NAT Gateway，`misectel,7621evb`  
实测固件：ImmortalWrt 25.12-SNAPSHOT，`r0+37877-52c94e7647`  
管理地址：`10.96.210.253/24`  
测试主机：`10.96.210.226/24`

## 1. 交付结论

当前版本已交付基于 Net-SNMP 的标准 MIB 只读监控、LLDP AgentX 接入、
SNMPv3 强认证加密和事件 Trap。实机验证通过 SNMPv3
`SHA-256/AES-256` 的 Get、GetNext、BulkGet、IF-MIB、IF-MIB 64 位计数、
EtherLike-MIB、LLDP-MIB 和 SNMPv3 Trap。

当前不具备通过 SNMP Set 修改设备配置的能力。私有 MIB 仅定义通知对象，
且仍使用 Net-SNMP 实验 OID，并存在 SMIv2 元数据警告。因此，标准 MIB
监控可交付使用，私有 MIB 适合作为开发联调版本，不应直接作为正式客户
企业 MIB 定版。

| 验收项 | 结果 | 说明 |
| --- | --- | --- |
| SNMPv3 SHA-256/AES-256 | PASS | 本机和 WAN 外部主机查询均成功 |
| Get | PASS | `sysDescr.0` 返回固件内核信息 |
| GetNext | PASS | 外部 NMS 返回下一个 system 对象 |
| BulkGet | PASS | 返回接口 `lo`、`eth0`、`lan4`、`wan`、`lan1` 等 |
| MIB-II/RFC1213 | PASS | system 与 interfaces 对象可查询 |
| IF-MIB/IF-X-MIB | PASS | 状态、错误及 64 位字节计数可查询 |
| EtherLike-MIB | PASS | `dot3StatsTable` 返回接口索引和部分错误计数 |
| LLDP-MIB | PASS | 返回本地端口和真实邻居 `ImmortalWrt` |
| SNMPv3 Trap | PASS | 私有事件、LLDP 变化、端口错误和标准 linkDown 均被接收 |
| 私有 MIB 解析 | WARN | OID 可解析，但缺少完整 `CONTACT-INFO` 元数据 |
| SNMP Set | FAIL | 返回 `noAccess`，产品配置明确为只读 |
| 正式企业 OID | BLOCKED | 当前 `8072.9999` 不是 Misectel 正式企业号 |
| 配置恢复 | PASS | 测试后 SNMP、交换机和防火墙配置逐字节恢复 |

## 2. 已集成组件

正式镜像包含：

- `snmpd-ssl 5.9.4-r6`
- `snmp-utils-ssl 5.9.4-r6`
- `snmp-mibs 5.9.4-r6`
- `libnetsnmp-ssl 5.9.4-r6`
- `lldpd 1.0.20-r1`，启用 SNMP AgentX
- `MISECTEL-SWITCH-MIB.txt`

Net-SNMP SSL 变体额外启用 Blumenthal AES，支持 SNMPv3 AES-256；代理
额外编入 `etherlike-mib/dot3StatsTable`。`lldpd` 通过
`/var/run/agentx.sock` 向主 `snmpd` 提供 LLDP-MIB。

## 3. MIB 能力

### 3.1 标准 MIB

| MIB | 主要用途 | 本次实测 |
| --- | --- | --- |
| SNMPv2-MIB/MIB-II | 系统描述、名称、运行时间 | `sysDescr.0` |
| IF-MIB | 接口名称、管理/运行状态、流量、错误 | WAN 状态与错误计数 |
| IF-MIB ifXTable | 64 位收发字节计数 | `ifHCInOctets`、`ifHCOutOctets` |
| EtherLike-MIB | 以太网接口及 802.3 错误统计 | `dot3StatsTable` |
| LLDP-MIB | 本地端口、系统描述、远端邻居 | 本地 5 个端口和真实邻居 |

具体计数是否存在取决于 Linux 驱动和 DSA/PHY 是否导出对应 ethtool
统计。例如本次 WAN 的 FCS 和 frame-too-long 对象返回 0，而
single-collision 对象返回 `No Such Instance`。这表示 MIB 表已注册，不代表
每种 PHY 统计项都有底层数据来源。

### 3.2 Misectel 私有通知 MIB

设备内文件：

```text
/usr/share/snmp/mibs/MISECTEL-SWITCH-MIB.txt
```

当前源码文件 SHA-256：

```text
2caa68138da93ba44e7e889dd3bf4dda2089650dfb55e5ad41c4818a07bddfea
```

当前根 OID：

```text
1.3.6.1.4.1.62446.6.1.905.1
```

（已迁移到汇川企业号 62446；原 Net-SNMP 实验 OID `8072.9999` 不再使用。）

通知 OID 与字段：

| 名称 | OID | 内容 |
| --- | --- | --- |
| `misectelSecurityEvent` | `.1.3.6.1.4.1.62446.6.1.905.1.2.1` | 通用事件通知 |
| `misectelEventType` | `.1.3.6.1.4.1.62446.6.1.905.1.1.1` | 事件类型 |
| `misectelEventPort` | `.1.3.6.1.4.1.62446.6.1.905.1.1.2` | 端口或子系统 |
| `misectelEventMessage` | `.1.3.6.1.4.1.62446.6.1.905.1.1.3` | 可读事件说明 |

链路 UP/DOWN 使用标准 `linkUp`/`linkDown` Trap OID；CPU 高负载、端口
错误、带宽阈值、广播/多播阈值、新 MAC、非法 MAC、端口安全关断和 LLDP
变化使用上述私有通知，并携带三个私有字段。

## 4. 使用方法

### 4.1 Web 配置

1. 登录 HTTPS 管理页。
2. 进入“交换运维（Switch Operations）”。
3. 选择“SNMP / LLDP”。
4. 启用 SNMP，并在生产环境关闭 SNMPv1 和 SNMPv2c。
5. 设置监听地址、允许的管理源、SNMPv3 用户名、认证算法和加密算法。
6. 设置认证口令和加密口令，均不少于 8 个字符。
7. 如需 Trap，启用“Send traps”，填写接收端、端口和 SNMPv3。
8. 点击“Apply Configuration”，确认页面状态显示“SNMP active”。

设备出厂时 SNMP 服务整体关闭。源配置中 v2c 选项预置为启用且 community
为 `public`，因此生产启用 SNMP 时必须显式关闭 v1/v2c，只保留 SNMPv3，
不能直接使用默认 community。

### 4.2 SNMPv3 查询

以下命令在 NMS 主机执行。示例中的地址、用户和口令必须替换为实际值；
命令行口令可能出现在进程列表中，正式 NMS 应使用受限权限的凭据文件或
平台凭据库。

```sh
DEVICE_IP='10.96.210.253'
SNMP_USER='<snmpv3-user>'
AUTH_PASS='<authentication-password>'
PRIV_PASS='<privacy-password>'

snmpget -v3 -l authPriv -u "$SNMP_USER" \
  -a SHA-256 -A "$AUTH_PASS" -x AES-256 -X "$PRIV_PASS" \
  "$DEVICE_IP" .1.3.6.1.2.1.1.1.0

snmpwalk -v3 -l authPriv -u "$SNMP_USER" \
  -a SHA-256 -A "$AUTH_PASS" -x AES-256 -X "$PRIV_PASS" \
  "$DEVICE_IP" .1.3.6.1.2.1.2

snmpbulkget -v3 -l authPriv -u "$SNMP_USER" \
  -a SHA-256 -A "$AUTH_PASS" -x AES-256 -X "$PRIV_PASS" \
  -Cn0 -Cr10 "$DEVICE_IP" .1.3.6.1.2.1.2.2.1.2
```

查询 EtherLike 和 LLDP：

```sh
snmpwalk -v3 -l authPriv -u "$SNMP_USER" \
  -a SHA-256 -A "$AUTH_PASS" -x AES-256 -X "$PRIV_PASS" \
  "$DEVICE_IP" .1.3.6.1.2.1.10.7.2

snmpwalk -v3 -l authPriv -u "$SNMP_USER" \
  -a SHA-256 -A "$AUTH_PASS" -x AES-256 -X "$PRIV_PASS" \
  "$DEVICE_IP" .1.0.8802.1.1.2
```

### 4.3 加载私有 MIB

将设备中的 `MISECTEL-SWITCH-MIB.txt` 安装到 NMS MIB 目录后执行：

```sh
export MIBDIRS="/usr/share/snmp/mibs:<private-mib-directory>"
export MIBS='+MISECTEL-SWITCH-MIB'

snmptranslate -On MISECTEL-SWITCH-MIB::misectelSecurityEvent
```

迁移后返回 `.1.3.6.1.4.1.62446.6.1.905.1.2.1`，并已补齐 MODULE-IDENTITY 的
CONTACT-INFO、REVISION 等元数据，替换为汇川企业 OID `1.3.6.1.4.1.62446`。

### 4.4 接收 SNMPv3 Trap

Net-SNMP 的 SNMPv3 Trap 用户需要按“Trap 发送方 EngineID”本地化。当前
版本中 `snmptrap` 发送方 EngineID 与 `snmpd` 代理 EngineID 不同，不能直接
把查询代理的 EngineID 用于 Trap 接收端。接收端示例：

```text
createUser -e 0x<TRAP_SENDER_ENGINE_ID> <user> SHA-256 <auth-pass> AES-256 <priv-pass>
authUser log <user> priv
```

然后启动接收器：

```sh
snmptrapd -f -Lo -n -C -c /etc/snmp/snmptrapd.conf udp:162
```

首次部署应从发送端的 SNMPv3 Trap 报文确认 authoritative EngineID，再在
接收器创建用户。正式产品建议让 Trap 发送工具显式复用固定 EngineID，并
在 Web/API 中显示该值，避免接收端依赖抓包配置。

## 5. 实机验证记录

### 5.1 环境与恢复措施

- 测试前备份 `/etc/config/misectel_switch`、`snmpd` 和 `firewall`。
- 测试期间仅启用 SNMPv3，算法为 SHA-256/AES-256。
- WAN 外部 NMS 位于同一二层，通过 UDP/161 查询设备。
- Trap 接收端使用独立二层地址和 UDP/1162，避免修改主机防火墙。
- 测试后恢复三份配置并用 `cmp` 校验，停止并禁用 SNMP。

### 5.2 查询结果

`sysDescr.0`：

```text
Linux ImmortalWrt 6.12.85 #0 SMP Wed Aug 5 03:29:43 2026 mips
```

WAN 接口：

```text
ifDescr.4       = "wan"
ifAdminStatus.4 = up(1)
ifOperStatus.4  = up(1)
ifInErrors.4    = 0
ifOutErrors.4   = 0
```

IF-MIB 64 位计数：

```text
ifHCInOctets.4  = 287701
ifHCOutOctets.4 = 177821
```

EtherLike `dot3StatsIndex` 返回接口索引 2 至 7。WAN 实测：

```text
dot3StatsFCSErrors.4   = 0
dot3StatsFrameTooLongs.4 = 0
```

LLDP-MIB 返回 5 个本地物理端口，并发现真实远端系统：

```text
lldpRemSysName = "ImmortalWrt"
```

外部 NMS 的 GetNext 返回 `sysObjectID.0`；BulkGet 连续返回 `lo`、`eth0`、
`lan4`、`wan`、`lan1`。目标镜像内的精简工具没有 `snmpgetnext`、
`snmpbulkget` 和 `snmptranslate` 命令，但代理能够正确处理外部 NMS 发来的
对应协议请求。

### 5.3 安全与写操作

使用 SNMPv3 对 `sysLocation.0` 执行 Set，设备返回：

```text
Error in packet.
Reason: noAccess
```

在本次强制 v3 配置下，以 v2c community 查询超时且无响应。由此确认测试
配置只允许 SNMPv3 authPriv，且当前 MIB 访问为只读。

### 5.4 Trap 验证

SNMPv3 接收端成功解密收到：

```text
snmpTrapOID.0 = 1.3.6.1.4.1.62446.6.1.905.1.2.1
eventType     = "delivery_test"
eventPort     = "snmp"
eventMessage  = "MIB delivery trap verification"
```

监控进程运行期间还自动上报了：

- `lldp_change`：LLDP 邻居拓扑变化。
- `port_error`：LAN1 错误/丢包增量事件。

通过事件接口合成一次 linkDown 交付测试，接收端收到标准
`IF-MIB::linkDown` OID，并携带端口 `lan3` 和私有说明字段。本轮没有拔插
正在使用的物理网线，因此标准 linkDown 的 OID 映射已验证，但真实 carrier
变化触发仍需在不影响业务的验收窗口复测。

### 5.5 恢复结果

测试结束后：

- `misectel_switch`、`snmpd`、`firewall` 与测试前备份逐字节一致。
- SNMP 服务为 disabled/stopped。
- LLDP 服务继续运行。
- 含固定测试说明的两条人工事件记录已删除；监控自动产生的状态事件保留。
- 临时 Trap 容器、macvlan、凭据和测试文件已清理。
- 管理地址连续 2 次 ICMP 零丢包，平均 0.735 ms。

## 6. 已知问题与后续整改

1. 向 IANA 申请或确认 Misectel 企业号，替换 `8072.9999`。
   （已完成：迁移到汇川企业 OID `1.3.6.1.4.1.62446.6.1.905.1`。）
2. 补齐私有 MIB 的 CONTACT-INFO、REVISION、合规描述并通过严格 SMIv2 lint。
3. 为 Trap 发送方提供固定、可查询的 EngineID，并在 Web/API 中展示。
4. 如果客户要求 SNMP Set，先定义可写对象、角色权限、事务回滚和审计，
   不能简单开放当前 `.1` 全视图写权限。
   （已实现：`sysContact`/`sysName`/`sysLocation` 通过 VACM 写视图开放 Set，
   并设置企业 `sysObjectID`、BRIDGE-MIB、ENTITY-MIB、SNMP-TARGET-MIB，见
   `docs/snmp-mib-design.md`。）
5. 为 VRF/NAT、端口配置、告警历史等产品对象设计正式私有标量和表；当前
   私有 MIB 只有通知，不支持轮询这些业务配置。
6. 修正配置应用期间出现的一次非致命 `Command failed: Not found`，虽然
   本次 `snmpd`、AgentX、查询和 Trap 均正常，但正式验收不应保留不明错误。
7. 增加真实网线 Link Up/Down、Trap 风暴抑制、长时间轮询、NMS 兼容性和
   重启后 EngineID/用户持久化专项测试。

PEN 归属依据：[IANA Private Enterprise Numbers，8072](https://www.iana.org/assignments/enterprise-numbers/?page=81)。
