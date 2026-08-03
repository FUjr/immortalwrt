#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const baseUrl = String(process.env.GATEWAY_URL || 'https://10.96.210.253').replace(/\/$/, '');
const username = process.env.GATEWAY_USERNAME || 'root';
const password = process.env.GATEWAY_PASSWORD;
const outputDir = path.resolve(process.env.SCREENSHOT_DIR || 'tmp/vrf-guide');

if (!password) {
	console.error('GATEWAY_PASSWORD is required');
	process.exit(2);
}

fs.mkdirSync(outputDir, { recursive: true });

async function login(page) {
	await page.goto(`${baseUrl}/cgi-bin/luci/`, { waitUntil: 'domcontentloaded' });
	const passwordInput = page.locator('input[name="luci_password"]');

	if (await passwordInput.count()) {
		await page.locator('input[name="luci_username"]').fill(username);
		await passwordInput.fill(password);
		await Promise.all([
			page.waitForLoadState('domcontentloaded'),
			page.locator('input[type="submit"]').click()
		]);
	}
}

async function main() {
	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext({
		ignoreHTTPSErrors: true,
		viewport: { width: 1440, height: 1000 }
	});
	const page = await context.newPage();
	const errors = [];
	let step = 'login';
	const trackErrors = (trackedPage, label) => {
		const handler = (error) => errors.push(`[${step}/${label}] ${trackedPage.url()}: ${error.stack || error.message}`);
		trackedPage.on('pageerror', handler);
		return handler;
	};

	await login(page);
	trackErrors(page, 'main');
	step = 'desktop dashboard';
	await page.goto(`${baseUrl}/cgi-bin/luci/admin/misectel-dashboard`, { waitUntil: 'networkidle' });
	await page.locator('.misectel-dashboard-vrf').first().waitFor({ state: 'visible' });

	const dashboardText = await page.locator('#maincontent').innerText();
	const vrfCount = await page.locator('.misectel-dashboard-vrf').count();
	const forbidden = [ 'Cellular Data', 'Modem Connection', 'Ethernet Port' ].filter((text) => dashboardText.includes(text));

	if (vrfCount !== 4)
		throw new Error(`expected 4 VRFs on dashboard, got ${vrfCount}`);
	if (forbidden.length)
		throw new Error(`gateway dashboard still contains: ${forbidden.join(', ')}`);

	await page.screenshot({ path: path.join(outputDir, '01-dashboard-vrf-status.png'), fullPage: true });
	if (errors.length)
		throw new Error(`dashboard page errors: ${errors.join('; ')}`);
	await page.goto(`${baseUrl}/cgi-bin/luci/admin/network/misectel-network`, { waitUntil: 'networkidle' });
	step = 'WAN network';
	await page.locator('.misectel-hero__title', { hasText: 'WAN Network' }).waitFor({ state: 'attached' });
	await page.screenshot({ path: path.join(outputDir, '02-wan-network.png'), fullPage: true });
	if (errors.length)
		throw new Error(`WAN page errors: ${errors.join('; ')}`);

	await page.goto(`${baseUrl}/cgi-bin/luci/admin/network/misectel-vrf`, { waitUntil: 'networkidle' });
	step = 'VRF overview';
	await page.locator('.misectel-hero__title', { hasText: 'VRF NAT' }).waitFor({ state: 'attached' });
	await page.screenshot({ path: path.join(outputDir, '03-vrf-configuration.png'), fullPage: true });
	if (errors.length)
		throw new Error(`VRF overview errors: ${errors.join('; ')}`);

	const vrfEditorPage = await context.newPage();
	trackErrors(vrfEditorPage, 'vrf-editor');
	step = 'VRF member editor';
	await vrfEditorPage.goto(`${baseUrl}/cgi-bin/luci/admin/network/misectel-vrf`, { waitUntil: 'networkidle' });
	await vrfEditorPage.locator('.misectel-list-item').nth(1).getByRole('button', { name: 'Edit' }).click();
	await vrfEditorPage.locator('.modal').waitFor({ state: 'visible' });
	await vrfEditorPage.screenshot({ path: path.join(outputDir, '04-vrf-member-editor.png'), fullPage: true });
	if (errors.length)
		throw new Error(`VRF member editor errors: ${errors.join('; ')}`);
	vrfEditorPage.removeAllListeners('pageerror');
	await vrfEditorPage.close();

	const mappingEditorPage = await context.newPage();
	trackErrors(mappingEditorPage, 'mapping-editor');
	step = 'NAT mapping editor';
	await mappingEditorPage.goto(`${baseUrl}/cgi-bin/luci/admin/network/misectel-vrf`, { waitUntil: 'networkidle' });
	const mappingCard = mappingEditorPage.locator('.misectel-list-item', { hasText: 'usb0_test' });
	await mappingCard.getByRole('button', { name: 'Edit' }).click();
	await mappingEditorPage.locator('.modal').waitFor({ state: 'visible' });
	await mappingEditorPage.screenshot({ path: path.join(outputDir, '05-nat-mapping-editor.png'), fullPage: true });
	if (errors.length)
		throw new Error(`NAT mapping editor errors: ${errors.join('; ')}`);
	mappingEditorPage.removeAllListeners('pageerror');
	await mappingEditorPage.close();

	await page.setViewportSize({ width: 390, height: 844 });
	step = 'mobile dashboard';
	await page.goto(`${baseUrl}/cgi-bin/luci/admin/misectel-dashboard`, { waitUntil: 'networkidle' });
	await page.locator('.misectel-dashboard-vrf').first().waitFor({ state: 'visible' });
	await page.screenshot({ path: path.join(outputDir, '06-dashboard-mobile.png'), fullPage: true });

	if (errors.length)
		throw new Error(`browser page errors: ${errors.join('; ')}`);

	const result = {
		base_url: baseUrl,
		vrf_count: vrfCount,
		forbidden_dashboard_labels: forbidden,
		page_errors: errors,
		screenshots: fs.readdirSync(outputDir).filter((name) => name.endsWith('.png')).sort()
	};
	fs.writeFileSync(path.join(outputDir, 'playwright-result.json'), `${JSON.stringify(result, null, 2)}\n`);
	console.log(JSON.stringify(result, null, 2));
	await browser.close();
}

main().catch((error) => {
	console.error(error.stack || error.message);
	process.exit(1);
});
