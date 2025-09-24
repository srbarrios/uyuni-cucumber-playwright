// Copyright (c) 2025 SUSE LLC.
// Licensed under the terms of the MIT license.

import { Page, Locator } from '@playwright/test';
import { TIMEOUTS } from './env';

/**
 * Function to check or uncheck a checkbox in the package list with the possibility to select the last package version
 *
 * @param page - The Playwright Page object
 * @param action - Either 'check' or 'uncheck'
 * @param text - The text to match in the row
 * @param lastVersion - Whether to select the row with the latest package version
 */
export async function toggleCheckboxInPackageList(
  page: Page,
  action: 'check' | 'uncheck',
  text: string,
  lastVersion: boolean = false
): Promise<void> {
  if (!lastVersion) {
    return toggleCheckboxInList(page, action, text);
  }

  try {
    const linkElements = await page.locator("div.table-responsive table tbody tr td.sortedCol a").all();
    const packages = await Promise.all(linkElements.map(el => el.textContent()));
    const packageNames = packages.filter((name): name is string => name !== null);
    const latest = getLatestPackage(packageNames);

    const xpath = `//div[@class='table-responsive']/table/tbody/tr/td[@class=' sortedCol']/a[text()='${latest}']/../../td/input[@type='checkbox']`;
    const checkbox = page.locator(xpath).first();
    
    const shouldCheck = action === 'check';
    const isChecked = await checkbox.isChecked();
    
    if (isChecked !== shouldCheck) {
      await checkbox.check();
    }
  } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`[toggle_checkbox] fallback to text match: ${errorMessage}`);
      await toggleCheckboxInList(page, action, text);
  }
}

/**
 * Function to check or uncheck a checkbox in a table first row matching the provided text
 *
 * @param page - The Playwright Page object
 * @param action - Either 'check' or 'uncheck'
 * @param text - The text to match in the row
 */
export async function toggleCheckboxInList(
  page: Page,
  action: 'check' | 'uncheck',
  text: string
): Promise<void> {
  const xpath = `//div[@class="table-responsive"]/table/tbody/tr[.//td[contains(.,'${text}')]]//input[@type='checkbox']`;
  
  const checkbox = page.locator(xpath).first();
  await checkbox.waitFor({ timeout: TIMEOUTS.default * 1000 });

  const shouldCheck = action === 'check';
  const isChecked = await checkbox.isChecked();
  
  if (isChecked !== shouldCheck) {
    if (shouldCheck) {
      await checkbox.check();
    } else {
      await checkbox.uncheck();
    }
  }
}

/**
 * Function to enter a package name into the "Filter by Package Name" input field
 *
 * @param page - The Playwright Page object
 * @param packageName - The package name to enter
 * @throws {Error} If the package name is empty
 */
export async function filterByPackageName(page: Page, packageName: string): Promise<void> {
  if (!packageName || packageName.trim() === '') {
    throw new Error('Package name is not set');
  }

  const filterInput = page.locator("input[placeholder='Filter by Package Name: ']");
  await filterInput.fill(packageName);
}

/**
 * Toggles a checkbox based on the desired action.
 *
 * @param page - The Playwright Page object
 * @param action - Either 'check' or 'uncheck'
 * @param id - The HTML id of the checkbox input element
 *
 * This function ensures the checkbox ends in the desired state by comparing
 * the current checked status with the intended one. It performs a click only
 * if necessary (e.g., when current and desired states differ).
 */
export async function toggleCheckbox(page: Page, action: 'check' | 'uncheck', id: string): Promise<void> {
  const checkbox = page.locator(`#${id}`);
  const shouldCheck = action === 'check';
  const isChecked = await checkbox.isChecked();

  if (isChecked !== shouldCheck) {
    if (shouldCheck) {
      await checkbox.check();
    } else {
      await checkbox.uncheck();
    }
  }
}

/**
 * Returns the textual state of a checkbox (toggle) based on its HTML ID.
 *
 * @param page - The Playwright Page object
 * @param id - The ID of the checkbox element
 * @returns "checked" if the box is selected, "unchecked" otherwise
 */
export async function getCheckboxState(page: Page, id: string): Promise<'checked' | 'unchecked'> {
  const checkbox = page.locator(`#${id}`);
  const isChecked = await checkbox.isChecked();
  return isChecked ? 'checked' : 'unchecked';
}

/**
 * Helper function to get the latest version of a package from a list of package names
 * This is a simplified version - you might want to implement more sophisticated version comparison
 *
 * @param packages - Array of package name strings
 * @returns The latest package name
 */
function getLatestPackage(packages: string[]): string {
  if (packages.length === 0) {
    throw new Error('No packages provided');
  }

  // Parse a package string expected like "name-version-release"
  // Returns numeric arrays for version and release to compare similar to Ruby's Gem::Version logic
  const parsePkg = (pkg: string) => {
    // Try to capture name, version, release
    const m = pkg.match(/^(.+?)-(\d+(?:\.\d+)*?)-(.+)$/);
    if (!m) {
      return {
        versionNums: [0, 0, 0],
        releaseNums: [0],
        original: pkg,
      };
    }
    const versionStr = m[2];
    const releaseStr = m[3];

    const versionNums = versionStr
      .split('.')
      .map((n) => (Number.isFinite(parseInt(n, 10)) ? parseInt(n, 10) : 0));

    // Extract numeric sequences from release (e.g., "3.oe2403sp1" -> [3, 2403, 1])
    const releaseNums = (releaseStr.match(/\d+/g) || []).map((n) => parseInt(n, 10));

    return { versionNums, releaseNums: releaseNums.length ? releaseNums : [0], original: pkg };
  };

  const cmpNumArrays = (a: number[], b: number[]) => {
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) {
      const av = a[i] ?? 0;
      const bv = b[i] ?? 0;
      if (av !== bv) return av - bv;
    }
    return 0;
  };

  let latest = packages[0];
  let latestParsed = parsePkg(latest);

  for (let i = 1; i < packages.length; i++) {
    const current = packages[i];
    const curParsed = parsePkg(current);

    const vCmp = cmpNumArrays(curParsed.versionNums, latestParsed.versionNums);
    if (vCmp > 0) {
      latest = current;
      latestParsed = curParsed;
      continue;
    }
    if (vCmp === 0) {
      const rCmp = cmpNumArrays(curParsed.releaseNums, latestParsed.releaseNums);
      if (rCmp > 0) {
        latest = current;
        latestParsed = curParsed;
      }
    }
  }

  return latest;
}
