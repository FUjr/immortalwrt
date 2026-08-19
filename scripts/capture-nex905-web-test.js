#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const baseUrl = String(process.env.GATEWAY_URL || 'https://192.168.1.1').replace(/\/$/, '');
const username = process.env.GATEWAY_USERNAME || 'root';
const password = process.env.GATEWAY_PASSWORD || 'Admin@12345678';
const outputDir = path.resolve(process.env.SCREENSHOT_DIR || 'docs/deliverable/assets/web-test');
const targetHostname = process.env.TARGET_HOSTNAME || '7621 vrf evb';

fs.mkdirSync(outputDir, { recursive: true });

const screenshots = [];
const checks = [];
const errors = [];

async function shot(page, name) {
  await page.screenshot({ path: path.join(outputDir, name), fullPage: true });
  screenshots.push(name);
}

function record(name, ok, detail) {
  checks.push({ name, ok: !!ok, detail: detail || '' });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1440, height: 1000 }
  });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`[pageerror] ${page.url()}: ${e.message}`));

  const go = async (rel) => {
    await page.goto(`${baseUrl}/cgi-bin/luci/${rel}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
  };

  // ---- login ----
  await page.goto(`${baseUrl}/cgi-bin/luci/`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[name="luci_username"]').fill(username);
  await page.locator('input[name="luci_password"]').fill(password);
  await Promise.all([
    page.waitForLoadState('domcontentloaded'),
    page.locator('input[type="submit"]').click()
  ]);
  await page.waitForTimeout(2500);
  const loggedIn = (await page.locator('input[name="luci_password"]').count()) === 0;
  record('login', loggedIn, `user=${username}`);

  // ---- 1. dashboard ----
  await go('admin/gateway-dashboard');
  await shot(page, '01-dashboard.png');

  // ---- 2. Administration: configure device hostname via web ----
  await go('admin/system/gateway-system/admin');
  await shot(page, '14-administration.png');
  const hostnameInput = page.locator('input[placeholder="Hostname"]').first();
  await hostnameInput.fill(targetHostname);
  await shot(page, '15-administration-hostname-filled.png');
  await page.getByRole('button', { name: 'Save System Settings' }).first().click();
  let hostnameSet = false;
  let board;
  for (let attempt = 0; attempt < 6 && !hostnameSet; attempt++) {
    await page.waitForTimeout(2000);
    board = await page.evaluate(async () => {
      const L = window.L;
      const b = L.rpc.declare({ object: 'system', method: 'board', params: [] });
      return await b();
    }).catch((e) => ({ error: String(e) }));
    hostnameSet = board && board.hostname === targetHostname;
  }
  record('web_configure_hostname', hostnameSet, `hostname=${board && board.hostname}`);

  // ---- 3. WAN network ----
  await go('admin/network/gateway-network');
  await shot(page, '02-wan-network.png');

  // ---- 4. VRF NAT overview ----
  await go('admin/network/gateway-vrf');
  await shot(page, '03-vrf-overview.png');

  // ---- 5. NAT mapping add -> persist -> delete ----
  const mappingCard = page.locator('.misectel-card', { hasText: 'NAT Mappings' }).first();
  await mappingCard.getByRole('button', { name: 'Add' }).first().click();
  await page.locator('.modal').waitFor({ state: 'visible' });
  await shot(page, '04-mapping-editor-empty.png');

  const modal = page.locator('.modal').first();
  function field(label) {
    return modal.locator('.misectel-field', { hasText: label }).first().locator('.misectel-field__control input, .misectel-field__control select').first();
  }
  await field('Name').fill('playwright_test');
  await field('Internal IPv4').fill('192.168.10.101');
  await field('External IPv4').fill('192.168.1.50');
  await shot(page, '05-mapping-editor-filled.png');

  await modal.getByRole('button', { name: 'Save' }).first().click();
  await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null);
  await page.waitForTimeout(900);
  const mappingPersisted = await page.locator('.misectel-list-item', { hasText: 'playwright_test' }).count();
  await shot(page, '06-mapping-persisted.png');
  record('web_configure_nat_mapping_add', mappingPersisted === 1, `count=${mappingPersisted}`);

  const persistedItem = page.locator('.misectel-list-item', { hasText: 'playwright_test' }).first();
  await persistedItem.getByRole('button', { name: 'Delete' }).first().click();
  await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null);
  await page.waitForTimeout(900);
  const mappingAfterDelete = await page.locator('.misectel-list-item', { hasText: 'playwright_test' }).count();
  await shot(page, '07-mapping-deleted.png');
  record('web_configure_nat_mapping_delete', mappingAfterDelete === 0, `count=${mappingAfterDelete}`);

  // ---- 6. switch operations: configure LLDP system name via web ----
  await go('admin/network/gateway-switch');
  await shot(page, '08-switch-operations.png');
  await page.getByRole('button', { name: 'SNMP / LLDP' }).first().click();
  await page.waitForTimeout(500);
  await shot(page, '08b-switch-snmp-lldp.png');
  const lldpNameField = page.locator('.misectel-field', { hasText: 'System name' }).first().locator('input').first();
  await lldpNameField.fill('7621 vrf evb');
  const authPassField = page.locator('.misectel-field', { hasText: 'Authentication password' }).first().locator('input').first();
  await authPassField.fill('test-auth-pass-123');
  const privPassField = page.locator('.misectel-field', { hasText: 'Privacy password' }).first().locator('input').first();
  await privPassField.fill('test-priv-pass-123');
  await page.getByRole('button', { name: 'Apply Configuration' }).first().click();
  await page.waitForTimeout(3000);
  const lldpCfg = await page.evaluate(async () => {
    const L = window.L;
    const get = L.rpc.declare({ object: 'misectel.switch', method: 'get_config', params: [] });
    const c = await get();
    return c.config.lldp;
  }).catch((e) => ({ error: String(e) }));
  const lldpNameSet = lldpCfg && lldpCfg.system_name === '7621 vrf evb';
  record('web_configure_lldp_system_name', lldpNameSet, `system_name=${lldpCfg && lldpCfg.system_name}`);

  // ---- 7. security: add IP-MAC binding -> persist -> delete (via RPC) ----
  await go('admin/network/gateway-security');
  await shot(page, '09-security.png');
  await page.getByRole('button', { name: 'Add binding' }).first().click();
  await page.locator('.modal').waitFor({ state: 'visible' });
  const secModal = page.locator('.modal').first();
  function secField(label) {
    return secModal.locator('.misectel-field', { hasText: label }).first().locator('.misectel-field__control input, .misectel-field__control select').first();
  }
  await secField('Name').fill('playwright_arp');
  await secField('IPv4 address').fill('192.168.10.200');
  await secField('MAC address').fill('02:76:21:00:00:99');
  await shot(page, '10-binding-editor-filled.png');
  await secModal.getByRole('button', { name: 'Save' }).first().click();
  await page.waitForTimeout(1200);
  const bindingPersisted = await page.locator('td', { hasText: 'playwright_arp' }).count();
  await shot(page, '11-binding-persisted.png');
  record('web_configure_binding_add', bindingPersisted >= 1, `count=${bindingPersisted}`);

  const rowDeleteButtons = await page.locator('tr', { hasText: 'playwright_arp' }).getByRole('button', { name: 'Delete' }).count();
  await shot(page, '12-binding-actions-broken.png');
  record('binding_row_delete_button_present', rowDeleteButtons > 0, `delete_buttons=${rowDeleteButtons}`);

  const rpcResult = await page.evaluate(async () => {
    const L = window.L;
    const del = L.rpc.declare({ object: 'misectel.security', method: 'delete_binding', params: ['name', 'generation'] });
    const get = L.rpc.declare({ object: 'misectel.security', method: 'get_bindings', params: ['page', 'limit', 'query', 'vrf', 'port'] });
    const before = await get(1, 50, '', '', '');
    const r = await del('playwright_arp', before.generation);
    const after = await get(1, 50, '', '', '');
    return { ok: r.result === true, after_total: after.total };
  }).catch((e) => ({ error: String(e) }));
  await page.waitForTimeout(500);
  record('binding_delete_via_rpc', rpcResult.ok === true && rpcResult.after_total === 0, JSON.stringify(rpcResult));

  // ---- 8. system management / access security / upgrade / log ----
  await go('admin/system/gateway-system/device');
  await shot(page, '13-system-management.png');

  await go('admin/system/gateway-system/security');
  await shot(page, '16-access-security.png');

  await go('admin/system/gateway-system/upgrade');
  await shot(page, '17-upgrade.png');

  await go('admin/system/logs/syslog');
  await shot(page, '18-system-log.png');

  // ---- 9. mobile dashboard ----
  await page.setViewportSize({ width: 390, height: 844 });
  await go('admin/gateway-dashboard');
  await shot(page, '19-dashboard-mobile.png');

  const result = {
    base_url: baseUrl,
    username,
    target_hostname: targetHostname,
    checks,
    page_errors: errors,
    screenshots
  };
  fs.writeFileSync(path.join(outputDir, 'web-test-result.json'), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  const failed = checks.some((c) => !c.ok);
  if (failed) process.exitCode = 2;
  if (errors.length) process.exitCode = 2;
}

main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
