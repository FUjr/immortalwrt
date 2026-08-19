#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const baseUrl = String(process.env.GATEWAY_URL || 'https://192.168.1.1').replace(/\/$/, '');
const username = process.env.GATEWAY_USERNAME || 'root';
const password = process.env.GATEWAY_PASSWORD || 'Admin@12345678';
const outputDir = path.resolve(process.env.SCREENSHOT_DIR || 'tmp/web-test');

if (!password) {
	console.error('GATEWAY_PASSWORD is required');
	process.exit(2);
}

fs.mkdirSync(outputDir, { recursive: true });

const screenshots = [];
const errors = [];

function esc(s) { return String(s).replace(/\s+/g, ' ').trim(); }

async function shot(page, name) {
	await page.screenshot({ path: path.join(outputDir, name), fullPage: true });
	screenshots.push(name);
}

async function main() {
	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext({
		ignoreHTTPSErrors: true,
		viewport: { width: 1440, height: 1000 }
	});
	const page = await context.newPage();
	page.on('pageerror', (e) => errors.push(`[pageerror] ${page.url()}: ${e.message}`));

	// ---- login ----
	await page.goto(`${baseUrl}/cgi-bin/luci/`, { waitUntil: 'domcontentloaded' });
	await page.locator('input[name="luci_password"]').fill(password);
	await Promise.all([
		page.waitForLoadState('domcontentloaded'),
		page.locator('input[type="submit"]').click()
	]);
	await page.goto(`${baseUrl}/cgi-bin/luci/admin/misectel-dashboard`, { waitUntil: 'networkidle' });

	// ---- 1. dashboard ----
	await page.locator('.misectel-dashboard-vrf, .misectel-hero__title').first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
	await shot(page, '01-dashboard.png');

	// ---- 2. WAN network ----
	await page.goto(`${baseUrl}/cgi-bin/luci/admin/network/misectel-network`, { waitUntil: 'networkidle' });
	await page.locator('.misectel-hero__title, #maincontent').first().waitFor({ state: 'attached' }).catch(() => {});
	await shot(page, '02-wan-network.png');

	// ---- 3. VRF NAT overview ----
	await page.goto(`${baseUrl}/cgi-bin/luci/admin/network/misectel-vrf`, { waitUntil: 'networkidle' });
	await page.locator('.misectel-hero__title', { hasText: 'VRF NAT' }).waitFor({ state: 'attached' }).catch(() => {});
	await page.locator('.misectel-list-item').first().waitFor({ state: 'visible' }).catch(() => {});
	await shot(page, '03-vrf-overview.png');

	// ---- 4. add a NAT mapping (one_to_one), verify it persists after reload ----
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
	const addNav = page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null);
	await addNav;
	await page.waitForTimeout(800);

	// after commit the page reloads; verify the mapping is now listed
	await page.locator('.misectel-list-item', { hasText: 'playwright_test' }).first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
	const mappingPersisted = await page.locator('.misectel-list-item', { hasText: 'playwright_test' }).count();
	await shot(page, '06-mapping-persisted.png');
	if (mappingPersisted !== 1)
		throw new Error(`mapping 'playwright_test' did not persist after save (found ${mappingPersisted})`);

	// ---- 5. delete the mapping, verify removal ----
	const persistedItem = page.locator('.misectel-list-item', { hasText: 'playwright_test' }).first();
	const delNav = page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => null);
	await persistedItem.getByRole('button', { name: 'Delete' }).first().click();
	await delNav;
	await page.waitForTimeout(800);
	const mappingAfterDelete = await page.locator('.misectel-list-item', { hasText: 'playwright_test' }).count();
	await shot(page, '07-mapping-deleted.png');
	if (mappingAfterDelete !== 0)
		throw new Error(`mapping 'playwright_test' was not deleted (found ${mappingAfterDelete})`);

	// ---- 6. switch operations ----
	await page.goto(`${baseUrl}/cgi-bin/luci/admin/network/misectel-switch`, { waitUntil: 'networkidle' });
	await page.locator('.misectel-hero__title', { hasText: 'Switch Operations' }).waitFor({ state: 'attached' }).catch(() => {});
	await page.waitForTimeout(800);
	await shot(page, '08-switch-operations.png');

	// ---- 7. security ----
	await page.goto(`${baseUrl}/cgi-bin/luci/admin/network/misectel-security`, { waitUntil: 'networkidle' });
	await page.locator('.misectel-hero__title, #maincontent').first().waitFor({ state: 'attached' }).catch(() => {});
	await page.waitForTimeout(800);
	await shot(page, '09-security.png');

	// ---- 8. system management ----
	await page.goto(`${baseUrl}/cgi-bin/luci/admin/system/misectel-system/misectel`, { waitUntil: 'networkidle' });
	await page.locator('.misectel-hero__title, #maincontent').first().waitFor({ state: 'attached' }).catch(() => {});
	await page.waitForTimeout(800);
	await shot(page, '10-system-management.png');

	// ---- 9. upgrade page ----
	await page.goto(`${baseUrl}/cgi-bin/luci/admin/system/misectel-system/upgrade`, { waitUntil: 'networkidle' });
	await page.locator('.misectel-hero__title, #maincontent').first().waitFor({ state: 'attached' }).catch(() => {});
	await page.waitForTimeout(800);
	await shot(page, '11-upgrade.png');

	// ---- 10. mobile dashboard ----
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto(`${baseUrl}/cgi-bin/luci/admin/misectel-dashboard`, { waitUntil: 'networkidle' });
	await page.locator('.misectel-dashboard-vrf, .misectel-hero__title').first().waitFor({ state: 'visible', timeout: 20000 }).catch(() => {});
	await shot(page, '12-dashboard-mobile.png');

	const result = {
		base_url: baseUrl,
		mapping_persisted: mappingPersisted === 1,
		mapping_deleted: mappingAfterDelete === 0,
		page_errors: errors,
		screenshots
	};
	fs.writeFileSync(path.join(outputDir, 'web-test-result.json'), `${JSON.stringify(result, null, 2)}\n`);
	console.log(JSON.stringify(result, null, 2));
	await browser.close();
	if (errors.length)
		process.exitCode = 2;
}

main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
