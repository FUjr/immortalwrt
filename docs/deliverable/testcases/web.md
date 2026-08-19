# WEB网管 测试用例（SRS 4.11）

模块代码：`WEB`；需求条目：6。

| ID | 需求编号 | 用例名称 | 优先级 | 前置条件 | 操作步骤 | 预期结果 |
| --- | --- | --- | --- | --- | --- | --- |
| WEB-001 | 4.11.1 | 支持HTTP/HTTPS | P0 | 浏览器与管理主机就绪 | 1. 发起 HTTPS/HTTP 连接<br>2. 核对端口与默认使能状态<br>3. 核对会话超时 | HTTPS 默认使能，HTTP 默认关闭，超时 15 分钟 |
| WEB-002 | 4.11.2 | SSL证书 | P0 | 浏览器可查看证书 | 1. 核对证书字段(CN/O/OU/有效期/密钥长度)<br>2. 核对 SAN/KeyUsage/ExtendedKeyUsage<br>3. 导入客户证书并核对回退 | 证书字段符合规范，客户证书可导入 |
| WEB-003 | 4.11.3 | TLS算法 | P0 | 具备 TLS 1.0-1.3 客户端 | 1. 分别发起 TLS 1.0/1.1/1.2/1.3 连接<br>2. 核对弱协议被拒、1.2/1.3 通过<br>3. 核对加密套件 | 支持 TLS 1.2/1.3，弱协议被拒 |
| WEB-004 | 4.11.4 | 支持登录认证 | P0 | 准备管理员/运维/只读账号 | 1. 各角色登录并核对权限边界<br>2. 核对会话/审计/错误提示<br>3. 核对默认账号 | 登录认证与权限分级可用 |
| WEB-005 | 4.11.5 | 升级 | P0 | 准备型号匹配与不匹配固件 | 1. 上传固件并核对校验<br>2. 保留配置升级并等待重上线<br>3. 核对失败镜像被拒 | Web 升级可用，镜像校验通过后才可写入 |
| WEB-006 | 4.11.6 | 功能配置 | P0 | 浏览器登录 HTTPS 管理界面(root/Admin@12345678) | 1. 登录：HTTPS 登录成功，进入 Overview 首页，核对 WAN 状态、活动 VRF、NAT 映射数量显示<br>2. Administration：配置主机名 Hostname=7621 vrf evb，Save System Settings 后 board.hostname 回读一致<br>3. Network(WAN)：核对 WAN 协议(DHCP/静态/PPPoE)、IPv4、掩码、网关、DNS 配置页可编辑<br>4. VRF NAT：新增 Host 1:1 映射(Name/Internal IPv4/External IPv4)→Save 落盘→刷新仍在→Delete 移除<br>5. Switch Operations(Ports)：核对端口速率/双工/RX-TX 流控/入口出口限速/风暴抑制字段可配置<br>6. Switch Operations(MAC Security)：核对 MAC 上限/违规动作/允许 MAC 列表字段可配置<br>7. Switch Operations(SNMP/LLDP)：配置 LLDP 系统名 System name=7621 vrf evb 并 Apply Configuration，RPC 回读 lldp.system_name 一致<br>8. ARP & IP-MAC Security：新增 IP-MAC 绑定(Name/IPv4/MAC/Static ARP)→Save 落盘→经 RPC 删除<br>9. System Management/Administration/Access Security/Upgrade/System Log：逐页加载并截图<br>10. 移动端(390×844)首页：核对无文字/控件重叠<br>11. 全程记录页面 JavaScript 错误(pageerror) | 上述各前端页面与配置功能均通过 Web 操作验证并落盘，RPC/SNMP 回读一致 |
