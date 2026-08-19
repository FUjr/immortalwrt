#!/usr/bin/env node
'use strict';

// Convert a structured Markdown test-case document to PDF using Playwright's
// bundled Chromium. Handles headings, tables, lists, code blocks and the <br>
// inline HTML used inside table cells.

const fs = require('fs');
const path = require('path');

function esc(text) {
	return String(text)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

function inline(text) {
	// keep <br> intact, escape everything else
	return text
		.replace(/<br\s*\/?>/gi, '<br/>')
		.replace(/`([^`]+)`/g, (_m, c) => `<code>${esc(c)}</code>`)
		.replace(/\*\*([^*]+)\*\*/g, (_m, c) => `<strong>${esc(c)}</strong>`)
		.replace(/[<>&]/g, (ch) => esc(ch));
}

function markdownToHtml(md) {
	const lines = md.split('\n');
	const out = [];
	let inCode = false;
	let inTable = false;
	let tableHtml = [];
	let listType = null;

	const closeTable = () => {
		if (inTable) {
			out.push('<table>');
			out.push(...tableHtml);
			out.push('</table>');
			inTable = false;
			tableHtml = [];
		}
	};
	const closeList = () => {
		if (listType) {
			out.push(`</${listType}>`);
			listType = null;
		}
	};

	for (const raw of lines) {
		const line = raw;

		if (line.startsWith('```')) {
			closeTable(); closeList();
			if (inCode) { out.push('</code></pre>'); inCode = false; }
			else { out.push('<pre><code>'); inCode = true; }
			continue;
		}
		if (inCode) { out.push(esc(line)); continue; }

		if (/^\|.*\|$/.test(line)) {
			closeList();
			const cells = line.slice(1, -1).split('|').map((c) => c.trim());
			if (/^\s*:?-+:?\s*$/.test(cells.join('|')) || cells.every((c) => /^:?-+:?$/.test(c))) {
				// separator row
				continue;
			}
			if (!inTable) { inTable = true; }
			const tag = tableHtml.length === 0 && !inTable ? 'th' : 'td';
			const isHeader = tableHtml.length === 0;
			tableHtml.push('<tr>' + cells.map((c) => `<${isHeader ? 'th' : 'td'}>${inline(c)}</${isHeader ? 'th' : 'td'}>`).join('') + '</tr>');
			continue;
		}
		closeTable();

		if (/^#{1,6}\s+/.test(line)) {
			closeList();
			const level = line.match(/^(#+)/)[1].length;
			const text = inline(line.replace(/^#+\s+/, ''));
			out.push(`<h${level}>${text}</h${level}>`);
			continue;
		}
		if (/^\s*[-*]\s+/.test(line)) {
			if (listType !== 'ul') { closeList(); out.push('<ul>'); listType = 'ul'; }
			out.push(`<li>${inline(line.replace(/^\s*[-*]\s+/, ''))}</li>`);
			continue;
		}
		if (/^\s*\d+[.)]\s+/.test(line)) {
			if (listType !== 'ol') { closeList(); out.push('<ol>'); listType = 'ol'; }
			out.push(`<li>${inline(line.replace(/^\s*\d+[.)]\s+/, ''))}</li>`);
			continue;
		}
		if (line.trim() === '') {
			closeList();
			continue;
		}
		closeList();
		out.push(`<p>${inline(line)}</p>`);
	}
	closeTable(); closeList();
	if (inCode) out.push('</code></pre>');
	return out.join('\n');
}

const pageCss = `
@page { size: A4; margin: 14mm; }
body { font-family: "Noto Sans CJK SC", "WenQuanYi", "Source Han Sans CN", "Microsoft YaHei", sans-serif; font-size: 11px; line-height: 1.5; color: #222; }
h1 { font-size: 20px; border-bottom: 2px solid #333; padding-bottom: 6px; }
h2 { font-size: 15px; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 4px; color: #1a4d8f; }
h3 { font-size: 13px; margin-top: 16px; }
table { border-collapse: collapse; width: 100%; margin: 8px 0; }
th, td { border: 1px solid #bbb; padding: 5px 6px; text-align: left; vertical-align: top; word-break: break-word; }
th { background: #eef2f7; font-weight: 600; }
code { background: #f4f4f4; padding: 0 3px; border-radius: 2px; font-family: monospace; }
pre { background: #f6f8fa; padding: 8px; overflow-x: auto; }
pre code { background: none; padding: 0; }
ol, ul { margin: 6px 0 6px 22px; }
`;

async function main() {
	const [input, output] = process.argv.slice(2);
	if (!input || !output) {
		console.error('usage: md2pdf.js <input.md> <output.pdf>');
		process.exit(2);
	}
	const md = fs.readFileSync(input, 'utf8');
	const body = markdownToHtml(md);
	const html = `<!doctype html><html><head><meta charset="utf-8"><style>${pageCss}</style></head><body>${body}</body></html>`;

	const { chromium } = require('playwright');
	const browser = await chromium.launch({ headless: true });
	const page = await browser.newPage();
	await page.setContent(html, { waitUntil: 'networkidle' });
	await page.pdf({ path: output, format: 'A4', printBackground: true, margin: { top: '14mm', bottom: '14mm', left: '14mm', right: '14mm' } });
	await browser.close();
	console.log(`PDF written: ${output} (${fs.statSync(output).size} bytes)`);
}

main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
