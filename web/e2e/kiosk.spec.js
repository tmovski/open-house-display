import { expect, test } from '@playwright/test';
import { API_KEY } from '../playwright.config.js';

const PIN = '2468';

async function finishSetup(page, start = 'sample') {
  await page.goto('/');
  await page.getByLabel('PIN', { exact: true }).fill(PIN);
  await page.getByLabel('Confirm PIN').fill(PIN);
  await page.getByText(start === 'sample' ? 'Sample listing' : 'Blank listing', { exact: true }).click();
  await page.getByRole('button', { name: 'Finish setup' }).click();
}

async function openAgentTools(page) {
  const door = page.locator('.agent-door');
  const box = await door.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1_700);
  await page.mouse.up();
  for (const digit of PIN) await page.getByRole('button', { name: digit, exact: true }).click();
  await page.getByRole('button', { name: 'Unlock' }).click();
  await expect(page.getByRole('heading', { name: 'Agent tools' })).toBeVisible();
}

async function signIn(page, { first, last, email }) {
  await page.getByRole('button', { name: 'Sign in' }).first().click();
  await page.getByLabel('First name').fill(first);
  await page.getByLabel('Last name').fill(last);
  await page.getByLabel('Email').fill(email);
  await page.getByText('Within 3 months').click();
  await page.locator('.signin').getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: `Thanks, ${first}.` })).toBeVisible();
}

test('a visitor signs in and tours the home', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await finishSetup(page);

  await expect(page.locator('.plaque')).toHaveText('2418');
  await expect(page.getByText('$489,000')).toBeVisible();

  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.locator('.signin').getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toContainText('Fix 3 things');

  await page.getByLabel('First name').fill('Maya');
  await page.getByLabel('Last name').fill('Okafor');
  await page.getByLabel('Mobile phone').fill('248 555 0199');
  await page.getByText('Yes', { exact: true }).click();
  await page.getByLabel('Agent’s name').fill('Jordan Lee');
  await page.locator('.signin').getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Thanks, Maya.' })).toBeVisible();

  await page.getByRole('button', { name: 'See the rooms' }).click();
  await expect(page.getByRole('heading', { name: 'Front exterior' })).toBeVisible();
  await page.getByRole('button', { name: 'Next photo' }).click();
  await expect(page.getByRole('heading', { name: 'Living room' })).toBeVisible();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('heading', { name: 'Kitchen' })).toBeVisible();
  await page.getByRole('button', { name: /Primary bath/ }).click();
  await expect(page.getByRole('button', { name: 'Next photo' })).toBeDisabled();

  expect(errors).toEqual([]);
});

test('sign-ins survive a reload and export to a spreadsheet', async ({ page }) => {
  await finishSetup(page);
  await signIn(page, { first: 'Sam', last: 'Patel', email: 'sam@example.com' });
  await page.reload();
  await openAgentTools(page);
  await page.getByRole('tab', { name: /Sign-ins/ }).click();
  await expect(page.getByRole('cell', { name: 'Sam Patel' })).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export to spreadsheet' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^open-house-sign-ins-\d{4}-\d{2}-\d{2}\.csv$/);
  const text = await (await download.createReadStream()).toArray().then((chunks) => Buffer.concat(chunks).toString('utf8'));
  expect(text).toContain('Sam,Patel,sam@example.com');
});

test('the tablet syncs sign-ins to the server', async ({ page, request }) => {
  await finishSetup(page);
  await signIn(page, { first: 'Lena', last: 'Brooks', email: 'lena@example.com' });
  await page.getByRole('button', { name: 'Done' }).click();

  await openAgentTools(page);
  await page.getByRole('tab', { name: 'Settings' }).click();
  await page.getByLabel('Server address').fill('http://localhost:8787');
  await page.getByLabel('API key').fill(API_KEY);
  await page.getByRole('button', { name: 'Test connection' }).click();
  await expect(page.getByText('Connected to the server')).toBeVisible();
  await page.getByRole('button', { name: 'Save sync settings' }).click();

  await page.getByRole('tab', { name: /Sign-ins/ }).click();
  await expect(page.getByText('Synced', { exact: true })).toBeVisible({ timeout: 10_000 });

  const res = await request.get('http://localhost:8787/api/leads', { headers: { Authorization: `Bearer ${API_KEY}` } });
  const { leads } = await res.json();
  expect(leads.map((l) => l.email)).toContain('lena@example.com');
});

test('agent tools stay locked after wrong PINs', async ({ page }) => {
  await finishSetup(page);
  const door = page.locator('.agent-door');
  const box = await door.boundingBox();
  await page.mouse.move(box.x + 10, box.y + 10);
  await page.mouse.down();
  await page.waitForTimeout(1_700);
  await page.mouse.up();
  for (let attempt = 0; attempt < 5; attempt++) {
    for (const d of '0000') await page.getByRole('button', { name: d, exact: true }).click();
    await page.getByRole('button', { name: 'Unlock' }).click();
  }
  await expect(page.getByText(/Too many wrong tries/)).toBeVisible();
  for (const digit of PIN) await page.getByRole('button', { name: digit, exact: true }).click();
  await page.getByRole('button', { name: 'Unlock' }).click();
  await expect(page.getByRole('heading', { name: 'Agent tools' })).toHaveCount(0);
});

test('an agent builds a listing from scratch', async ({ page }) => {
  await finishSetup(page, 'blank');
  await expect(page.getByRole('heading', { name: 'Agent tools' })).toBeVisible();
  await page.getByLabel('Street address').fill('77 Maple Row');
  await page.getByLabel('City').fill('Plymouth');
  await page.getByLabel('Asking price').fill('$365,000');
  await page.getByLabel('Name', { exact: true }).fill('Darius');
  await page.getByRole('button', { name: 'Save listing' }).click();
  await expect(page.getByText('Listing saved')).toBeVisible();

  await page.getByRole('tab', { name: 'Rooms and photos' }).click();
  await page.getByRole('button', { name: 'Add a room' }).click();
  await page.getByPlaceholder('Room name').fill('Sunroom');
  await page.locator('input[type=file]').setInputFiles({
    name: 'sunroom.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="300" height="200" fill="#c9a452"/></svg>'),
  });
  await expect(page.locator('.photo-tile')).toHaveCount(1);
  await expect(page.getByText('All changes saved')).toBeVisible();

  await page.getByRole('button', { name: 'Lock and return' }).click();
  await expect(page.locator('.plaque')).toHaveText('77');
  await expect(page.getByText('Hosted by')).toBeVisible();
  await page.getByRole('button', { name: 'See the rooms' }).click();
  await expect(page.getByRole('heading', { name: 'Sunroom' })).toBeVisible();
});

test('works on a phone-sized portrait screen without sideways scrolling', async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await finishSetup(page);
  for (const screen of ['welcome', 'signin', 'tour']) {
    if (screen === 'signin') await page.getByRole('button', { name: 'Sign in' }).first().click();
    if (screen === 'tour') {
      await page.getByRole('button', { name: 'Cancel' }).click();
      await page.getByRole('button', { name: 'See the rooms' }).click();
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${screen} overflows horizontally`).toBeLessThanOrEqual(0);
  }
  await page.close();
});
