# 7621 vrf evb 交付物目录

本机名称：`7621 vrf evb`（board_name `misectel,7621evb`，产品型号 NEX905-F-40）。
本目录为《NEX905-F-40 软件需求规格说明书》(V1.0，CH26010012) 对应的交付与测试文档，
按 SRS 第 4 章（4.1 ~ 4.21，共 21 个模块、86 条需求）组织。

## 文档索引

| 文件 | 说明 |
| --- | --- |
| [`00-delivery-boundary.md`](00-delivery-boundary.md) | 交付边界（逐条标注交付状态） |
| [`01-test-report.md`](01-test-report.md) | 测试报告（基于测试用例的执行结果） |
| [`02-delivery-instruction.md`](02-delivery-instruction.md) | 交付说明（Web Playwright 验证 + 截图 + 操作指引） |
| [`03-test-config-guide.md`](03-test-config-guide.md) | 非 Web 测试配置说明 |
| [`04-snmp-mib-implementation.md`](04-snmp-mib-implementation.md) | SNMP MIB 实现说明（对照原产品 MIB 说明书） |
| [`testcases/`](testcases/) | 按模块拆分的测试用例 + XMind + PDF + 覆盖率 |

## 测试用例（testcases/）

- 模块文件：`mac.md`、`port.md`、`qos.md`、`vlan.md`、`ipaddr.md`、`arp.md`、`dns.md`、
  `ntp.md`、`lldp.md`、`snmp.md`、`web.md`、`sys.md`、`cli.md`、`route.md`、`nat.md`、
  `dhcp.md`、`acl.md`、`sec.md`、`log.md`、`rel.md`、`ops.md`。
- 索引/汇总：`index.md`、`all-testcases.md`。
- 产物：`requirements-testcases.xmind`、`requirements-testcases.pdf`、`coverage.md`。

## 生成与复现

```sh
node scripts/generate-srs-testcases.mjs   # 生成测试用例 + 交付边界 + xmind
NODE_PATH=$HOME/.npm/_npx/e41f203b7505f1fb/node_modules \
  node scripts/md2pdf.js docs/deliverable/testcases/all-testcases.md \
    docs/deliverable/testcases/requirements-testcases.pdf   # 生成 PDF

# Web 配置 Playwright 实机验证
GATEWAY_URL=https://192.168.1.1 GATEWAY_PASSWORD='Admin@12345678' \
  NODE_PATH=$HOME/.npm/_npx/e41f203b7505f1fb/node_modules \
  node scripts/capture-nex905-web-test.js

# SNMP 工具（docker net-snmp）
docker run -d --name snmp-tools --network host --entrypoint sh alpine:3.22 \
  -c "apk add --no-cache net-snmp-tools >/dev/null 2>&1; sleep infinity"

# LLDP 邻居模拟（docker lldpd）
docker run -d --name lldp-sim --network host --hostname LLDP-TEST-HOST \
  --cap-add NET_RAW --cap-add NET_ADMIN \
  alpine:3.22 sh -c "apk add --no-cache lldpd >/dev/null 2>&1; exec lldpd -d -I enx00e03b83213f -c"
```
