#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const baseUrl = String(process.env.GATEWAY_URL || 'https://192.168.1.1').replace(/\/$/, '');
const password = process.env.GATEWAY_PASSWORD || 'Admin@12345678';
const imagePath = process.env.FIRMWARE_IMAGE || 'bin/targets/ramips/mt7621/immortalwrt-ramips-mt7621-misectel_7621evb-squashfs-sysupgrade.bin';

async function main() {
  const image = path.resolve(imagePath);
  if (!fs.existsSync(image)) throw new Error(`image not found: ${image}`);
  console.log(`firmware: ${image} (${fs.statSync(image).size} bytes)`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();

  await page.goto(`${baseUrl}/cgi-bin/luci/`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[name="luci_username"]').fill('root');
  await page.locator('input[name="luci_password"]').fill(password);
  await Promise.all([page.waitForLoadState('domcontentloaded').catch(() => {}), page.locator('input[type="submit"]').click()]);
  await page.waitForTimeout(2500);

  await page.goto(`${baseUrl}/cgi-bin/luci/admin/system/gateway-system/upgrade`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  await page.locator('input[type="file"]').first().setInputFiles(image);
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: 'Start Upgrade' }).first().click();
  console.log('uploading + validating firmware...');
  await page.getByRole('button', { name: 'Confirm Upgrade' }).first().waitFor({ state: 'visible', timeout: 90000 }).catch(() => {});
  const confirmVisible = await page.getByRole('button', { name: 'Confirm Upgrade' }).count();
  if (confirmVisible !== 1) {
    const txt = await page.locator('body').innerText().catch(() => '');
    console.error('Confirm Upgrade not visible:', txt.slice(0, 500));
    process.exit(2);
  }
  console.log('firmware validated');

  // trigger sysupgrade with --force (compat version 1.0 -> 1.1) via file.exec
  const execResult = await page.evaluate(async () => {
    const L = window.L;
    const exec = L.rpc.declare({ object: 'file', method: 'exec', params: ['command', 'params', 'env'] });
    return await exec('/sbin/sysupgrade', ['--force', '/tmp/firmware.bin']).catch((e) => ({ err: String(e) }));
  });
  console.log('sysupgrade exec:', JSON.stringify(execResult));
  await browser.close();

  // poll for the device to go down then come back
  const { execSync } = require('child_process');
  let down = false, up = false;
  for (let i = 0; i < 72; i++) {
    let reachable = true;
    try { execSync('ping -c 1 -W 2 192.168.1.1', { stdio: 'ignore' }); } catch (e) { reachable = false; }
    if (!down && !reachable) { down = true; console.log(`device went down at ${i * 5}s`); }
    if (down && reachable) { up = true; console.log(`device came back at ${i * 5}s`); break; }
    await new Promise((r) => setTimeout(r, 5000));
  }
  console.log(`reboot ${up ? 'OK' : 'FAILED'}`);
  process.exit(up ? 0 : 1);
}

main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
