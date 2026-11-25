import { test as base, expect, type APIRequestContext } from '@playwright/test';
import { copyFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const runtime = process.env.UFM_E2E_RUNTIME!;
export const fixtures = JSON.parse(readFileSync(resolve(runtime, 'fixtures.json'), 'utf8'));
export const test = base.extend<{ isolated: void }>({
  isolated: [async ({}, use) => { copyFileSync(resolve(runtime, 'baseline.sqlite'), resolve(runtime, 'runtime.sqlite')); await use(); }, { auto: true }],
});
export { expect };
export function headers(role = 'donor') { return { Authorization: `Bearer ${fixtures.accounts[role].token}`, Accept: 'application/json' }; }
export async function data(response: Awaited<ReturnType<APIRequestContext['get']>>, status = 200) {
  expect(response.status(), await response.text()).toBe(status);
  return (await response.json()).data;
}
export async function invest(request: APIRequestContext, amount: number, rewardTierId?: string) {
  return request.post('/api/v1/investments', { headers: headers(), data: { campaignId: fixtures.campaigns.published, amount, ...(rewardTierId ? { rewardTierId } : {}) } });
}
