# 网关 Web 功能实机交付报告

项目：NEX905-F-405 NAT Gateway
设备：`nex905,f-405`（兼容 `misectel,7621evb`）
测试日期：2026-08-19
测试地址：`https://192.168.1.99`
测试账号：`admin`
测试方式：实机 SSH、串口、HTTPS JSON-RPC、Playwright Chromium、固件解包检查

## 1. 交付结论

本轮结果为 **有条件交付，存在 1 个运行时阻断项和 1 个待定位 Web 异常**。

- 固件构建、设备型号校验、设备端 SHA-256、`sysupgrade -T`、保留配置升级和
  重启恢复均通过。
- `gateway-*` 路由、admin 登录、Overview、WAN、VRF、交换、安全、系统、升级、
  日志页面均已在实机打开；桌面和移动端 Overview 渲染通过。
- 主机名保存、NAT 映射新增/刷新/删除、LLDP system name 保存通过。其中 NAT
  CRUD 的通过结果是在 VRF 全局开关为禁用的基线配置下取得，证明配置持久化，
  不代表启用后的数据面生效。
- 首轮发现安全页面固件内仍注册旧路由而返回 404。已强制刷新 APK/rootfs，解包
  确认并重新刷入，最终设备注册 `admin/network/gateway-security`。
- 当前测试主机通过下联交换端口到达设备。启用 VRF 后该端口被移入隔离域，
  `192.168.1.99` 管理路径中断，需要串口关闭 VRF 才能恢复。因此本拓扑下未能
  完成“VRF 启用后 NAT 与安全策略的 HTTPS 端到端验收”。
- 完整页面流程记录到一次 `uci/get: Access denied` 浏览器异常，尚未定位到具体
  UCI config；Overview 独立桌面/移动测试没有复现该异常。

## 2. 固件与设备基线

| 项目 | 实测值 | 结果 |
| --- | --- | --- |
| sysupgrade 镜像 | `immortalwrt-ramips-mt7621-nex905_f-405-squashfs-sysupgrade.bin` | PASS |
| SHA-256 | `c42bfa76f126229feeae2961dd238ef9bd30dbc8c01a91f9e4adbcd62705b29b` | PASS |
| 设备端镜像校验 | 主机与设备哈希一致，`sysupgrade -T` 返回成功 | PASS |
| 固件版本 | ImmortalWrt 25.12-SNAPSHOT `r37897+2-2e69fe12a9` | PASS |
| 内核 | Linux `6.12.85` | PASS |
| 设备型号 | `NAT Gateway NEX905-F-405` | PASS |
| 管理地址 | `192.168.1.99/24`，默认网关 `192.168.1.1` | PASS |
| 上游连通 | 设备到 `192.168.1.1` 三次 ICMP 全部超时 | 环境未就绪 |

镜像刷写前额外解包 squashfs，确认安全页面菜单键为
`admin/network/gateway-security`，避免仅依据源码或增量构建成功判断交付内容。

## 3. Web 功能验收

| 功能 | 实机操作与断言 | 结果 |
| --- | --- | --- |
| admin 登录 | HTTPS 表单登录，root-backed rpcd `admin` 会话 | PASS |
| Overview | 4 个状态卡、4 个 VRF 项、WAN `192.168.1.99/24` | PASS |
| 中性 URL | `/admin/gateway-dashboard/overview`，页面无旧品牌路由链接 | PASS |
| 桌面布局 | 1440x1000，无横向溢出或页面脚本错误 | PASS |
| 移动布局 | 390x844，卡片单列显示，无横向溢出 | PASS |
| Administration | 主机名保存并通过 `system.board` 回读 | PASS |
| WAN Network | `gateway-network` 页面加载和现有静态配置展示 | PASS |
| VRF NAT | 4 个 VRF 配置、端口、表号和 mark 展示 | PASS |
| NAT 映射 CRUD | 新增 `playwright_test`、刷新回读、删除后为 0 | PASS（配置态） |
| Switch Operations | 页面加载，SNMP/LLDP 标签可访问 | PASS |
| LLDP 配置 | system name 保存并通过 `misectel.switch.get_config` 回读 | PASS |
| ARP/IP-MAC 页面 | `gateway-security` 页面加载，不再返回 404 | PASS |
| IP-MAC CRUD | VRF 禁用时按设计拒绝缺失 `br-vrf1`；启用后管理路径中断 | BLOCKED |
| Access Security | 用户、TLS Syslog、HTTPS 证书区域正常渲染 | PASS（只读） |
| Upgrade | 上传页面正常；本轮固件通过 CLI 保留配置升级 | PASS |
| System Log | syslog 页面正常加载 | PASS |
| ACL/控制台 | 完整流程出现一次 `uci/get -32002 Access denied` | FAIL |

## 4. VRF 运行时验证

临时设置 `misectel_vrf.main.enabled=1` 后，设备成功创建：

- `vrf-vrf1` 到 `vrf-vrf4`，路由表分别为 `1001` 到 `1004`；
- 4 个 VRF link 状态均为 true；
- `ip misectel_vrf` nftables 表、prerouting/mark/postrouting 链；
- 每个 VRF 到 WAN 的 SNAT 规则，源地址为 `192.168.1.99`。

随后测试主机到 `192.168.1.99` 的二层路径中断。串口日志显示 LAN1-LAN4 被加入
对应 `br-vrf<N>`；关闭全局开关后端口离开桥，管理路径立即恢复。该现象说明控制
面创建成功，但当前线缆接入的并非独立 WAN 管理路径。需要把测试主机接到真实 WAN
口，或从某个 VRF 内使用正确的管理地址/路由后，重跑以下项目：

1. 启用状态下的 NAT 映射新增、apply、confirm、rollback；
2. IP-MAC binding 新增、静态邻居生效、删除；
3. Proxy ARP、DoS monitor、DHCP guard 和 Redirect；
4. VRF 到 WAN 及 WAN 到 VRF 的真实报文验证。

## 5. 本地契约与夹具测试

以下 14 项检查最终全部通过：

`security-manager`、`security-firewall`、`security-redirect`、`security-ui`、
`switch-manager`、`switch-ui`、`syslog-tls`、`https-certificate`、
`system-security`、`vrf-manager`、`vrf-hnat`、`vrf-multicast`、
`vrf-subnet-validator`、`misectel-system-upgrade`。

`check-vrf-manager.sh` 原先仍断言旧的单条件出厂初始化和旧管理地址，本轮已更新为
当前三条件迁移逻辑、`192.168.1.99` 管理地址和 `192.168.1.1` 网关后通过。

## 6. 配置恢复与现场状态

- 测试前备份完整 `/etc/config`。
- 测试后恢复备份、删除测试生成的 confirmed 快照并重启。
- 对恢复前后配置目录执行递归 diff，结果无差异。
- `playwright_test` NAT 映射和 `playwright_arp`/`delivery_probe` 绑定均不存在。
- 最终 `misectel_vrf.main.enabled=0`，与测试前状态一致。
- 最终管理地址可达，3 次 ICMP 零丢包，设备 SSH 正常。

## 7. 证据

- 完整页面流程结果：
  [`gateway-web-20260819-run2/web-test-result.json`](deliverable/assets/gateway-web-20260819-run2/web-test-result.json)
- Overview 桌面截图：
  [`01-dashboard.png`](deliverable/assets/gateway-web-20260819-run2/01-dashboard.png)
- 安全页面截图：
  [`09-security.png`](deliverable/assets/gateway-web-20260819-run2/09-security.png)
- Access Security 截图：
  [`16-access-security.png`](deliverable/assets/gateway-web-20260819-run2/16-access-security.png)
- 移动端截图：
  [`19-dashboard-mobile.png`](deliverable/assets/gateway-web-20260819-run2/19-dashboard-mobile.png)

## 8. 未纳入本轮通过声明

本轮没有宣称以下项目通过：真实端口到端口 NAT 流量、性能门槛、SNMP 外部管理站
读写、真实 DoS/组播流量、TLS Syslog 接收端、证书替换、恢复出厂、断电升级和 32M
双槽回滚。这些项目需要对应拓扑、外部端点或会改变设备状态的专项验收。
