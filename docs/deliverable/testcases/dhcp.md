# DHCP功能 测试用例（SRS 4.16）

模块代码：`DHCP`；需求条目：2。

| ID | 需求编号 | 用例名称 | 优先级 | 前置条件 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- | --- | --- | --- |
| DHCP-001 | 4.16.1 | DHCP Client(WAN) | P0 | WAN 侧有 DHCP 服务 | 1. 配置 WAN DHCP Client<br>2. 获取并释放租约<br>3. 核对默认不开启与持久化 | WAN DHCP Client 可用，默认不开启 |
| DHCP-002 | 4.16.2 | DHCP Server(LAN) | P0 | LAN/VRF 侧有 DHCP 客户端 | 1. 配置每 VRF 地址池/网关/DNS<br>2. 客户端获取租约核对下发内容<br>3. 验证静态 MAC 租约与重载恢复 | LAN DHCP Server 可用，地址池跟随内网段 |
