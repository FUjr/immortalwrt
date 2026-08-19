# 7621 vrf evb SNMP MIB 实现说明

本机名称：`7621 vrf evb`（board_name `misectel,7621evb`，产品型号 NEX905-F-40）
固件：ImmortalWrt 25.12-SNAPSHOT `r37896-45f33e0f05`
对照：`NAT 交换机 NEX905-F-40 SNMP MIB`（V1.0，2026-08-07）
实现与验证日期：2026-08-14

本文档按原产品 SNMP MIB 说明书的 9 个公共 MIB 分组，逐条标注实现状态与实测结果。
所有实测均以 docker net-snmp 工具对 `192.168.1.1` 执行。

## 1. 实现总览

| # | MIB 分组 | 状态 | 说明 |
| --- | --- | --- | --- |
| 2.1 | 系统信息(system) | **已实现** | 全字段，含 sysContact/sysName/sysLocation 读写 |
| 2.2 | 设备 MAC 地址(BRIDGE-MIB) | **已实现** | dot1dBaseBridgeAddress |
| 2.3 | 物理实体(ENTITY-MIB) | **已实现** | entPhysicalTable 全字段（含本次新增 entPhysicalIndex） |
| 2.4 | LLDP | **已实现** | 标准 LLDP-MIB(1.0.8802.1.1.2) + LLDP-V2-MIB(1.3.111.2.802.1.1.13) 均实现 |
| 2.5 | IF-MIB | **已实现** | ifNumber/ifTable |
| 2.6 | ifXTable | **已实现** | ifName 等 |
| 2.7 | RFC1213-MIB | **部分实现** | ipAddrTable 已实现；ipRouteTable(RFC1213) 已废弃，由 ipCidrRouteTable 替代 |
| 2.8 | SNMP-TARGET-MIB | **已实现** | snmpTargetSpinLock 已注册；snmpTargetAddrTable/ParamsTable 注册但为空（read-create） |
| 2.9 | SNMP-COMMUNITY-MIB | **未实现** | net-snmp 5.9.4 模块集未提供 snmpCommunityTable |

## 2. 各分组实测

### 2.1 系统信息(system)

节点 `1.3.6.1.2.1.1`。

| 字段 | OID | 属性 | 实测 |
| --- | --- | --- | --- |
| sysDescr | .1 | 只读 | `Linux 7621 vrf evb 6.12.85 ...` |
| sysObjectID | .2 | 只读 | `enterprises.62446.6.1.905.1`（即 1.3.6.1.4.1.62446.6.1.905.1） |
| sysUpTime | .3 | 只读 | Timeticks（正常） |
| sysContact | .4 | **读写** | `snmpset` 写入成功并回读一致 |
| sysName | .5 | **读写** | `7621 vrf evb`，`snmpset` 成功 |
| sysLocation | .6 | **读写** | `Suzhou`，`snmpset` 成功 |
| sysServices | .7 | 只读 | `76`（本次修复：snmpd.conf 用 `sysservices` 指令） |

- 反向验证：`sysDescr.0`/`sysObjectID.0` Set 返回 `noAccess`（只读保护）。
- SNMPv3 authPriv 下三标签 Set 亦成功。

### 2.2 设备 MAC 地址(BRIDGE-MIB)

| 字段 | OID | 实测 |
| --- | --- | --- |
| dot1dBaseBridgeAddress | 1.3.6.1.2.1.17.1.1 | `02 76 21 00 03 E9`（VRF 桥 MAC） |

### 2.3 物理实体(ENTITY-MIB)

`entPhysicalTable` = `1.3.6.1.2.1.47.1.1.1.1`。chassis=索引 1，端口 wan/lan1-4=索引 2-6。

| 字段 | OID | 实测 |
| --- | --- | --- |
| entPhysicalIndex | .1 | 1..6（本次新增） |
| entPhysicalDescr | .2 | `NEX905-F-40` / wan / lan1-4 |
| entPhysicalClass | .5 | chassis(3) / port(10) |
| entPhysicalName | .7 | `NEX905-F-40` / wan / lan1-4 |
| entPhysicalHardwareRev | .8 | 空（无硬件版本数据） |
| entPhysicalSoftwareRev | .10 | `ImmortalWrt 25.12-SNAPSHOT r37896-45f33e0f05` |
| entPhysicalSerialNum | .11 | 空（无序列号数据） |
| entPhysicalMfgName | .12 | `Inovance` |
| entPhysicalModelName | .13 | `NEX905-F-40` |

> entPhysicalClass chassis 为 3，sysObjectID 为 1.3.6.1.4.1.62446.6.1.905.1，符合说明书要求。

### 2.4 LLDP

标准 LLDP-MIB（IEEE 802.1AB-2005）经 lldpd AgentX 提供（`1.0.8802.1.1.2`），
LLDP-V2-MIB（IEEE 802.1AB-2009，说明书要求）经自研 pass_persist 提供
（`1.3.111.2.802.1.1.13`，脚本 `misectel-snmp-lldpv2`）。

LLDP-V2-MIB 实测（docker lldpd 模拟邻居 `LLDP-TEST-HOST`）：

| 表 | 字段 | 实测 |
| --- | --- | --- |
| lldpV2LocSysName | 1.3.3.0 | `7621 vrf evb` |
| lldpV2LocSysDesc | 1.3.4.0 | `Misectel 7621EVB NAT Gateway` |
| lldpV2LocPortTable | 1.3.7.1.* | wan/lan1-4 的 IfIndex/IdSubtype(3)/Id(MAC)/Desc |
| lldpV2RemChassisId | 1.4.1.1.6 | `00 E0 3B 83 21 3F` |
| lldpV2RemPortId/Desc | 1.4.1.1.8/9 | `00 E0 3B 83 21 3F` / `enx00e03b83213f` |
| lldpV2RemSysName | 1.4.1.1.10 | `LLDP-TEST-HOST` |
| lldpV2RemSysDesc | 1.4.1.1.11 | `Alpine Linux ...` |
| lldpV2RemSysCapSupported/Enabled | 1.4.1.1.12/13 | `39 00` / `28 00` |
| lldpV2RemManAddrTable | 1.4.2.1.* | `10.96.210.226`（管理地址） |

### 2.5 IF-MIB / 2.6 ifXTable

| 字段 | 实测 |
| --- | --- |
| ifNumber.0 | 16 |
| ifTable/ifDescr | lo/eth0/lan4/... |
| ifXTable/ifName | lo/eth0/lan4/... |

### 2.7 RFC1213-MIB

| 表 | 实测 |
| --- | --- |
| ipAddrTable (1.3.6.1.2.1.4.20) | 127.0.0.1 / 192.168.1.1 / 192.168.10.1 |
| ipRouteTable (1.3.6.1.2.1.4.21) | 已废弃，由 ipCidrRouteTable(RFC2096) 替代 |

### 2.8 SNMP-TARGET-MIB

| 对象 | 实测 |
| --- | --- |
| snmpTargetSpinLock.0 | 0（已注册） |
| snmpTargetAddrTable | 已注册，空表（read-create，可通过 `trapsess` 或 Set 建行） |
| snmpTargetParamsTable | 同上 |

### 2.9 SNMP-COMMUNITY-MIB

`snmpCommunityTable`（`1.3.6.1.6.3.18.1.1`）未实现：net-snmp 5.9.4 本模块集不包含
该表（SNMPv1/v2c 与 v3 共存通过 `com2sec→group→access` 机制实现，而非
snmpCommunityTable MIB）。

## 3. 本次实现内容

| 变更 | 文件 | 说明 |
| --- | --- | --- |
| SNMP Set 修复 | `feeds/packages/net/net-snmp/files/snmpd.init` | `sysLocation/sysContact/sysName` 改用 `psys*` 持久指令，使三标签可写 |
| entPhysicalIndex 补齐 | `misectel_switch_luci/.../misectel-snmp-mib` | 新增 `entPhysicalIndex(.1)` 输出 |
| sysServices 修复 | `feeds/packages/net/net-snmp/files/snmpd.init` | `sysService` 指令改为 `sysservices` |
| sysServices 默认值 | `misectel_switch_luci/.../misectel-switch-apply` | 新增 `snmpd.system.sysService='76'` |
| LLDP-V2-MIB 实现 | `misectel_switch_luci/.../misectel-snmp-lldpv2` | 新增 pass_persist（`lldpcli -f json` + `jq`），服务 1.3.111.2.802.1.1.13 |
| LLDP-V2-MIB 注册 | `misectel_switch_luci/.../misectel-switch-apply` | 新增 `pass_lldpv2` 的 pass_persist 配置 |
| jq 依赖 | `misectel_switch_luci/.../Makefile` | 新增 `+jq` 依赖 |

## 4. 已知差异（未实现/不可行）

1. **SNMP-COMMUNITY-MIB**：net-snmp 5.9.4 无 `snmpCommunityTable` 模块（v1/v2c↔v3
   共存实际由 com2sec→group→access 实现，功能在但无对应 MIB 表）。
2. **ipRouteTable(RFC1213)**：已废弃，标准以 ipCidrRouteTable 替代。
3. **entPhysicalHardwareRev/SerialNum**：缺硬件版本/序列号数据，返回空（符合说明书"未提供则空字符串"）。
4. **LLDP-V2-MIB trap（lldpV2RemTablesChange）**：说明书的告警通知（1.3.111.2.802.1.1.13.0.0.1）未实现（pass_persist 无法发 trap，需 lldpd/自定义通知机制）。

完整测试用例见 [`testcases/`](testcases/)；交付边界见
[`00-delivery-boundary.md`](00-delivery-boundary.md)；测试报告见
[`01-test-report.md`](01-test-report.md)。
