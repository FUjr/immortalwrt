# NAT Gateway NEX905-F-405 Web 与设备标识设计文档

项目：设备级网络解决方案 V1R1（CH26010012）
设备：`nex905,f-405`（MT7621，16 MiB SPI NOR，4×LAN + 1×WAN）
拟制：研发　日期：2026-08-19（V1.0 新制定）

## 1 文档目的

本文档定义 NAT Gateway NEX905-F-405 产品化的设备标识、出厂默认配置、Web
品牌与交互、SNMP/NTP 页面以及系统指示灯/喂狗 GPIO 的实现方式，作为本次
代码修改与测试的依据。对应实现散落在两处仓库：

- 主仓 `immortalwrt-switch`：新设备 profile、DTS、构建脚本。
- feed `misectel_switch_luci`：OEM 默认值、LuCI 页面、主题、SNMP/LLDP
  默认值、喂狗服务。

## 2 设备标识

| 项目 | 值 | 说明 |
| --- | --- | --- |
| `model_name` | `NAT Gateway NEX905-F-405` | Web 与 NMS 展示的型号名 |
| 设备型号（board） | `nex905,f-405` | DTS `compatible`，新设备 profile |
| 设备名称（hostname） | `NEX905-F-40` | 出厂主机名 |
| 序列号（SN） | WAN 口 MAC 地址 | 大写冒号格式 |

### 2.1 SN = WAN 口 MAC

序列号一律取 WAN 口 MAC（`wan` 设备的 `address`，缺省回退 `eth0`），用于
一切需要设备唯一标识的场景：

- SNMP `snmpd` engineID：`engineidnic=wan`（已有）。
- ENTITY-MIB `entPhysicalSerialNum`：`/etc/device_info` 无显式 `serial`
  时回退 WAN MAC。
- 后续接入 NMS、License 等场景遵循同一约定。

### 2.2 型号与模型名

- DTS `model = "NAT Gateway NEX905-F-405"`，`compatible` 新增
  `nex905,f-405`，保留 `mediatek,mt7621-soc`。
- `misectel.main.model_name` 作为 Web/NMS 兜底型号名；`fw_printenv`
  `owrt_oem_model_name` 优先，未设置时回退该 UCI 值，再回退 `board.model`。

## 3 出厂默认配置

| 参数 | 默认值 | 实现位置 |
| --- | --- | --- |
| 管理/LAN 设备地址 | `192.168.1.99/24` | vrf-gateway 出厂 `network.wan` |
| 网关地址 | `192.168.1.1` | vrf-gateway 出厂 `network.wan.gateway` |
| 设备名称 | `NEX905-F-40` | vrf-gateway 出厂 `system.hostname` |
| WEB 账号 | `admin` | vrf-gateway 出厂 `rpcd` `login` 段（无 Linux 用户） |
| WEB 密码 | `Admin@123` | vrf-gateway 出厂设置 root 密码并创建 `admin` rpcd 登录 |

说明：vrf_gateway 模式下 `network.lan` 桥被删除，物理 WAN 即管理口，出厂
静态地址 `192.168.1.99/24`、默认网关 `192.168.1.1`，满足「LAN 设备地址
192.168.1.99、网关 192.168.1.1」的出厂要求。WEB 账号 `admin` 通过
`/etc/config/rpcd` 的 `login` 段实现（复用 `misectel-system-manager` 的
Web/NMS 账号机制），不创建 SSH 可用账号；root 保留为系统/SSH 账号。
同一套默认值也保留在 `misectel-oem-defaults` 的 `99_misectel-oem-defaults`
中，供包含该 OEM 包的镜像使用。

## 4 Web 向导移除

- 删除 `setup` / `setup-wizard` 菜单项与 `misectel-dashboard/setup-wizard`
  视图、`misectel_setup_wizard` rpcd 及其 unauthenticated ACL。
- `misectel.setup.completed=1`、`misectel_vrf.main.setup_complete=1`，转发
  默认启用，不再强制首启改密。
- 主题 `header.ut`/`footer.ut` 移除向导重定向与 `data-setup-required`。
- 首页 `overview.js` 移除配置向导引导块。

## 5 Web 品牌中性化

Web 端去除公司英文品牌信息，改用中性名词：

| 位置 | 原值 | 新值 |
| --- | --- | --- |
| 登录页标题 / 顶栏品牌 / 浏览器 title | `Misectel VRF NAT Gateway` | `NAT Gateway NEX905-F-40` |
| 页脚品牌 | `Misectel LuCI Theme` | `NAT Gateway` |
| 页脚「Powered by github」链接 | 存在 | 移除 |
| 交换机拓扑本机名回退 | `Misectel Gateway` | `NAT Gateway` |
| 主题登录标题回退 | `Misectel` | `NAT Gateway` |

默认值同步中性化：SNMPv3 用户名 `misectel` → `User`；LLDP 系统描述
`Misectel 7621EVB NAT Gateway` → `NAT Gateway NEX905-F-405`；SNMP
`sysDescr` 同值。

## 6 SNMP / LLDP 页面

- SNMPv3 用户名默认 `User`。
- 系统描述（LLDP `system_description` 与 SNMP `sysDescr`）默认
  `NAT Gateway NEX905-F-405`。

## 7 NTP 时间设置

系统 → Administration 页「System Config」新增：

- **NTP 服务器地址**：逗号/空格分隔，写 `system.ntp.server` 列表，保存后
  `sysntpd` 重启。
- **设置时间**：`datetime-local` 输入 + 「应用时间」按钮，经
  `luci.setLocaltime` 立即设置系统时间。

## 8 WAN 保存提示

网络页保存 WAN/LAN 设置成功后，顶部弹出成功通知
「Network settings saved and applied」；失败仍弹出错误通知。

## 9 GPIO

| GPIO | 功能 | 实现 |
| --- | --- | --- |
| `gpio12` | 系统灯，闪烁 | 新包 `misectel-watchdog` 每秒翻转一次 |
| `gpio18` | 喂狗输出信号 | 同包每秒翻转，产生外部看门狗喂狗脉冲 |

- DTS `state_default` 将 `uart2`（gpio12）复用为 GPIO；`wdt` 组（gpio18）
  原已复用为 GPIO。
- **注意**：MT7621 内置交换机 CPU 口（gmac0）占用 RGMII2 引脚组
  （io22-33），`rgmii2` 组必须保持交换机功能、不能复用为 GPIO。因此
  io23 物理上不可用，喂狗输出改用 wdt 组引脚 io18。
- 用户态通过 sysfs GPIO 驱动。MT7621 的 96 个 GPIO 以三个 32 引脚 bank
  动态分配全局编号，脚本按 `gpiochip*/base` 动态换算物理引脚到全局号。
  `misectel-watchdog` init 服务由 procd 托管，进程退出自动重启。

## 10 验证方式

- JS：`node --check`；shell：`sh -n`；`git diff --check`。
- 构建：`./scripts/build-nex905-f-405.sh`，校验镜像 ≤ 15936 KiB、manifest
  含 `misectel-watchdog` 等关键包。
- 实机：登录页品牌、首页型号、SNMP 用户名/系统描述、NTP 手动设时、
  WAN 保存提示、gpio12 闪烁与 gpio18 波形、SN=WAN MAC（`snmpwalk`
  `entPhysicalSerialNum` 对比）。
