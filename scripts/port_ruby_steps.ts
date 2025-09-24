/*
  Port Ruby Cucumber step definitions to TypeScript Cucumber step definitions.
  - Scans the Uyuni repo Ruby steps folder
  - Generates TypeScript step files under testsuite/step_definitions/ruby_ported
  - Applies basic Capybara->Playwright mappings for common patterns
  - Preserves original Ruby body as a block comment for reference

  Usage:
    npx ts-node scripts/port_ruby_steps.ts
*/

import * as fs from 'fs';
import * as path from 'path';

const RUBY_STEPS_DIR = '/Users/oscar/Workspace/SUSE/uyuni/testsuite/features/step_definitions';
const OUTPUT_DIR = path.resolve(__dirname, '../testsuite/step_definitions');

// Ensure output dir exists
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

interface StepDef {
  keyword: 'Given' | 'When' | 'Then';
  regexLiteral: string; // including the surrounding /.../
  args: string[]; // arg names from Ruby block (arg1, text, etc.)
  body: string;   // Ruby body
}

function parseRubySteps(fileContent: string): StepDef[] {
  const lines = fileContent.split(/\r?\n/);
  const steps: StepDef[] = [];

  const startRe = /^\s*(Given|When|Then)\s*\(\s*(\/.*\/)\s*\)\s*do(?:\s*\|(.*)\|\s*)?$/;
  // Fallback: Given(/regex/) do |args|, also support single quotes around the regex literal are rare but ignore

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(startRe);
    if (!m) continue;

    const keyword = m[1] as StepDef['keyword'];
    const regexLiteral = m[2];
    const argListStr = (m[3] || '').trim();
    const args = argListStr
      ? argListStr.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

    // Capture body with do..end depth
    let body = '';
    let depth = 1;
    let j = i + 1;
    while (j < lines.length) {
      const line = lines[j];
      // naive depth tracking
      if (/(\bdo\b|\bcase\b|\bbegin\b|\bdef\b|\bif\b|\bunless\b|\bwhile\b|\buntil\b)/.test(line)) {
        depth++;
      }
      if (/^\s*end\s*$/.test(line)) {
        depth--;
        if (depth === 0) {
          break; // do not include this end line
        }
      }
      body += line + '\n';
      j++;
    }

    steps.push({ keyword, regexLiteral, args, body });
    i = j; // continue after 'end'
  }

  return steps;
}

function mapToTsImplementation(step: StepDef): string | null {
  // Extract regex content without surrounding slashes for matching
  const rx = step.regexLiteral.trim();
  const core = rx.replace(/^\//, '').replace(/\/$/, '');

  // Basic pattern mappings based on common Uyuni steps
  // Note: Use the same argument names as parsed, defaulting to arg1, arg2, ... if missing
  const a = (...ix: number[]) => ix.map((n, i) => step.args[n] || `arg${n + 1}`);

  // Helpers used inside mapping
  const header = `  const { getBrowserInstances } = require('../helpers/core/env');\n  const { page } = getBrowserInstances();\n`;

  // Patterns and generated bodies
  const patterns: { re: RegExp; body: () => string }[] = [
    // UI: left menu navigation
    {
      re: /I follow the left menu/,
      body: () => {
        const [menuVar] = a(0);
        return (
`  const { getBrowserInstances } = require('../helpers/core/env');
  const { clickLinkAndWait } = require('../helpers/core/commonlib');
  const { page } = getBrowserInstances();
  const last = String(${menuVar}).split('>').map((s)=>String(s).trim()).pop();
  await clickLinkAndWait(page, "a:has-text('" + last + "')");`
        );
      }
    },
    // UI: link presence
    {
      re: /I should see a \\"\(\[\^\\\"]\*\)\\" link\$/,
      body: () => {
        const [textVar] = a(0);
        return (
`  const { getBrowserInstances } = require('../helpers/core/env');
  const { page } = getBrowserInstances();
  const visible = await page.getByRole('link', { name: ${textVar} }).isVisible().catch(()=>false);
  if (!visible) throw new Error('Link ' + String(${textVar}) + ' is not visible');`
        );
      }
    },
    // UI: follow in content area
    {
      re: /I follow \\".*\\" in the content area/,
      body: () => {
        const [linkVar] = a(0);
        return (
`  const { getBrowserInstances } = require('../helpers/core/env');
  const { clickLinkAndWait } = require('../helpers/core/commonlib');
  const { page } = getBrowserInstances();
  await clickLinkAndWait(page, "section >> a:has-text('" + String(${linkVar}) + "')");`
        );
      }
    },
    // UI: check checkbox by id
    {
      re: /^\^I check \"/,
      body: () => {
        const [idVar] = a(0);
        return (
`  const { getBrowserInstances } = require('../helpers/core/env');
  const { page } = getBrowserInstances();
  const cb = page.locator('#' + String(${idVar}));
  if (await cb.count() === 0) throw new Error('Checkbox #' + String(${idVar}) + ' not found');
  if (!(await cb.isChecked())) { await cb.check().catch(()=>cb.click().catch(()=>{})); }
  if (!(await cb.isChecked())) throw new Error('Checkbox ' + String(${idVar}) + ' not checked.');`
        );
      }
    },
    // REMOTE: service enabled
    {
      re: /service.*is enabled on/,
      body: () => {
        const [serviceVar, hostVar] = a(0,1);
        return (
`  const { getTarget } = require('../helpers/system/remote_nodes_env');
  const node = await getTarget(${hostVar});
  const { stdout } = await node.run("systemctl is-enabled '" + String(${serviceVar}) + "'", { checkErrors: false });
  const status = (stdout || '').trim().split(/\n+/).pop();
  if (status !== 'enabled') throw new Error('Service ' + String(${serviceVar}) + ' not enabled on ' + String(${hostVar}) + ' (got: ' + status + ')');`
        );
      }
    },
    // REMOTE: service active
    {
      re: /service.*is active on/,
      body: () => {
        const [serviceVar, hostVar] = a(0,1);
        return (
`  const { getTarget } = require('../helpers/system/remote_nodes_env');
  const node = await getTarget(${hostVar});
  const { stdout } = await node.run("systemctl is-active '" + String(${serviceVar}) + "'", { checkErrors: false });
  const status = (stdout || '').trim().split(/\n+/).pop();
  if (status !== 'active') throw new Error('Service ' + String(${serviceVar}) + ' not active on ' + String(${hostVar}) + ' (got: ' + status + ')');`
        );
      }
    },
    // REMOTE: socket enabled
    {
      re: /socket.*is enabled on/,
      body: () => {
        const [socketVar, hostVar] = a(0,1);
        return (
`  const { getTarget } = require('../helpers/system/remote_nodes_env');
  const node = await getTarget(${hostVar});
  const { stdout } = await node.run("systemctl is-enabled '" + String(${socketVar}) + ".socket'", { checkErrors: false });
  const status = (stdout || '').trim().split(/\n+/).pop();
  if (status !== 'enabled') throw new Error('Socket ' + String(${socketVar}) + ' not enabled on ' + String(${hostVar}) + ' (got: ' + status + ')');`
        );
      }
    },
    // REMOTE: socket active
    {
      re: /socket.*is active on/,
      body: () => {
        const [socketVar, hostVar] = a(0,1);
        return (
`  const { getTarget } = require('../helpers/system/remote_nodes_env');
  const node = await getTarget(${hostVar});
  const { stdout } = await node.run("systemctl is-active '" + String(${socketVar}) + ".socket'", { checkErrors: false });
  const status = (stdout || '').trim().split(/\n+/).pop();
  if (status !== 'active') throw new Error('Socket ' + String(${socketVar}) + ' not active on ' + String(${hostVar}) + ' (got: ' + status + ')');`
        );
      }
    },
    // REMOTE: reverse resolution should work
    {
      re: /reverse resolution should work for/,
      body: () => {
        const [hostVar] = a(0);
        return (
`  const { getTarget } = require('../helpers/system/remote_nodes_env');
  const node = await getTarget(${hostVar});
  const { stdout: result, exitCode } = await node.run("date +%s; getent hosts " + node.fullHostname + "; date +%s", { checkErrors: false });
  if (exitCode !== 0) throw new Error('cannot do reverse resolution');
  const lines = (result || '').split("\n");
  const initial = parseInt(lines[0] || '0', 10);
  const out = String(lines[1] || '');
  const end = parseInt(lines[2] || '0', 10);
  const elapsed = end - initial;
  if (elapsed > 2) throw new Error('reverse resolution took too long (' + elapsed + ' seconds)');
  if (!out.includes(node.fullHostname)) throw new Error('reverse resolution returned ' + out + ', expected to see ' + node.fullHostname);`
        );
      }
    },
    // REMOTE: clock exact
    {
      re: /the clock from .* should be exact/,
      body: () => {
        const [hostVar] = a(0);
        return (
`  const { getTarget } = require('../helpers/system/remote_nodes_env');
  const node = await getTarget(${hostVar});
  const { stdout: clockNode } = await node.run("date +'%'s");
  const clockController = Math.floor(Date.now() / 1000);
  const diff = parseInt(String(clockNode).trim(), 10) - clockController;
  if (Math.abs(diff) >= 2) throw new Error('clocks differ by ' + diff + ' seconds');`
        );
      }
    },
  ,
    {
      re: /^\^I should see a \"\(\[\^\\\"]\*\)\" text\$$/,
      body: () => {
        const [textVar] = a(0);
        return (
`  const { getBrowserInstances } = require('../helpers/core/env');
  const { checkTextAndCatchRequestTimeoutPopup } = require('../helpers/core/commonlib');
  const { page } = getBrowserInstances();
  const ok = await checkTextAndCatchRequestTimeoutPopup(page, ${textVar});
  if (!ok) throw new Error("Text '" + ${textVar} + "' not found");`
        );
      }
    },
    {
      re: /^\^I should not see a \"\(\[\^\\\"]\*\)\" text\$$/,
      body: () => {
        const [textVar] = a(0);
        return (
`  const { getBrowserInstances } = require('../helpers/core/env');
  const { page } = getBrowserInstances();
  const visible = await page.getByText(${textVar}).isVisible().catch(() => false);
  if (visible) throw new Error("Text '" + ${textVar} + "' found on the page");`
        );
      }
    },
    {
      re: /^\^I click on \"\(\[\^\\\"]\*\)\"\$$/,
      body: () => {
        const [btnVar] = a(0);
        return (
`  const { getBrowserInstances } = require('../helpers/core/env');
  const { clickLinkOrButtonAndWait } = require('../helpers/core/commonlib');
  const { page } = getBrowserInstances();
  // Try button first, then link
  const button = page.getByRole('button', { name: ${btnVar} });
  if (await button.isVisible().catch(() => false)) {
    await clickLinkOrButtonAndWait(page, 'button:has-text("' + ${btnVar} + '")');
  } else {
    await clickLinkOrButtonAndWait(page, 'a:has-text("' + ${btnVar} + '")');
  }`
        );
      }
    },
    {
      re: /^\^I follow \"\(\[\^\\\"]\*\)\"\$$/,
      body: () => {
        const [linkVar] = a(0);
        return (
`  const { getBrowserInstances } = require('../helpers/core/env');
  const { clickLinkAndWait } = require('../helpers/core/commonlib');
  const { page } = getBrowserInstances();
  await clickLinkAndWait(page, 'a:has-text("' + ${linkVar} + '")');`
        );
      }
    },
    {
      re: /^\^I enter \"\(\[\^\\\"]\*\)\" as \"\(\[\^\\\"]\*\)\"\$$/,
      body: () => {
        const [textVar, fieldVar] = a(0, 1);
        return (
`  const { getBrowserInstances } = require('../helpers/core/env');
  const { page } = getBrowserInstances();
  // Prefer label, fallback to id/name
  const byLabel = page.getByLabel(${fieldVar});
  if (await byLabel.isVisible().catch(() => false)) {
    await byLabel.fill(${textVar});
  } else {
    const input = page.locator('#' + ${fieldVar} + ', [name="' + ${fieldVar} + '"]');
    await input.first().fill(${textVar});
  }`
        );
      }
    },
    {
      re: /^\^I wait until I see \"\(\[\^\\\"]\*\)\" text\$$/,
      body: () => {
        const [textVar] = a(0);
        return (
`  const { getBrowserInstances } = require('../helpers/core/env');
  const { checkTextAndCatchRequestTimeoutPopup } = require('../helpers/core/commonlib');
  const { page } = getBrowserInstances();
  const ok = await checkTextAndCatchRequestTimeoutPopup(page, ${textVar});
  if (!ok) throw new Error("Text '" + ${textVar} + "' not found");`
        );
      }
    },
    {
      re: /^\^I wait until I do not see \"\(\[\^\\\"]\*\)\" text\$$/,
      body: () => {
        const [textVar] = a(0);
        return (
`  const { getBrowserInstances } = require('../helpers/core/env');
  const { repeatUntilTimeout } = require('../helpers/core/commonlib');
  const { page } = getBrowserInstances();
  const gone = await repeatUntilTimeout(async () => !(await page.getByText(${textVar}).isVisible().catch(() => false)));
  if (!gone) throw new Error("Text '" + ${textVar} + "' still visible");`
        );
      }
    },
    {
      re: /^\^I select \"\(\[\^\\\"]\*\)\" from \"\(\[\^\\\"]\*\)\"\$$/,
      body: () => {
        const [optionVar, fieldVar] = a(0, 1);
        return (
`  const { getBrowserInstances } = require('../helpers/core/env');
  const { page } = getBrowserInstances();
  // Try native <select>
  const native = page.locator('select#' + ${fieldVar} + ', select[name="' + ${fieldVar} + '"]');
  if (await native.first().isVisible().catch(() => false)) {
    await native.first().selectOption({ label: String(${optionVar}) });
  } else {
    // Custom React selector
    const ctrl = page.locator(".data-testid-" + ${fieldVar} + "-child__control").first();
    await ctrl.click();
    const opt = page.locator(".data-testid-" + ${fieldVar} + "-child__option", { hasText: String(${optionVar}) }).first();
    await opt.click();
  }`
        );
      }
    },
  ];

  for (const p of patterns) {
    if (p.re.test(core)) {
      return p.body();
    }
  }

  return null;
}

function generateTsFile(basename: string, steps: StepDef[]): string {
  const lines: string[] = [];
  lines.push("import { Given, When, Then } from '@cucumber/cucumber';");
  lines.push("// Central helpers (browser, page, utilities)");
  lines.push("import * as Helpers from '../helpers';");
  lines.push('');

  steps.forEach((s) => {
    const impl = mapToTsImplementation(s);
    const params = s.args.length ? s.args.join(', ') : '...args: any[]';
    const header = `${s.keyword}(${s.regexLiteral}, async function (${params}) {`;
    lines.push(header);

    if (impl) {
      lines.push(impl);
    } else {
      // Skeleton with TODO and original Ruby body in comments
      lines.push("  // TODO: Port this step body to Playwright/Helpers");
      lines.push("  // Original Ruby implementation (commented line-by-line to avoid '*/' sequences in paths):");
      s.body.split('\n').forEach((ln) => lines.push('  // ' + ln));
      lines.push("  throw new Error('Step not yet implemented (auto-generated)')");
    }

    lines.push('});');
    lines.push('');
  });

  return lines.join('\n');
}

function run() {
  const files = fs.readdirSync(RUBY_STEPS_DIR).filter((f) => f.endsWith('.rb'));
  for (const file of files) {
    const full = path.join(RUBY_STEPS_DIR, file);
    const content = fs.readFileSync(full, 'utf8');
    const steps = parseRubySteps(content);
    if (steps.length === 0) continue;

    const outName = file.replace(/\.rb$/, '.ts');
    const outPath = path.join(OUTPUT_DIR, outName);
    const tsContent = generateTsFile(outName, steps);
    fs.writeFileSync(outPath, tsContent, 'utf8');
    console.log(`Generated: ${path.relative(process.cwd(), outPath)} (${steps.length} steps)`);
  }
}

run();
