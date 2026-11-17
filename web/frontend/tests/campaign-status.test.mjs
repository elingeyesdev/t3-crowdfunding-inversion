import test from 'node:test';
import assert from 'node:assert/strict';
import { CAMPAIGN_GROUPS, campaignStatusLabel, matchesCampaignGroup } from '../src/utils/campaignStatus.ts';
import { collectCampaignPages } from '../src/utils/campaignPages.ts';

const expected = {
  draft: 'drafts', rejected: 'drafts', pending_review: 'review', in_review: 'review',
  approved: 'approved', published: 'active', partially_funded: 'active', funded: 'funded',
  completed: 'completed', failed: 'completed', cancelled: 'completed', suspended: 'suspended',
};

test('each API status belongs to exactly the agreed group and has a readable label', () => {
  for (const [status, group] of Object.entries(expected)) {
    assert.deepEqual(CAMPAIGN_GROUPS.filter(g => matchesCampaignGroup(status, g.value)).map(g => g.value), [group]);
    assert.equal(matchesCampaignGroup(status, 'all'), true);
    assert.notEqual(campaignStatusLabel(status), status);
    assert.notEqual(campaignStatusLabel(status), 'Estado desconocido');
  }
  assert.equal(campaignStatusLabel('funded'), 'Financiada');
  assert.equal(campaignStatusLabel('cancelled'), 'Cancelada');
  assert.equal(campaignStatusLabel('new_state'), 'Estado desconocido');
  assert.equal(matchesCampaignGroup('new_state', 'completed'), false);
});

test('finalized results and counters exclude approvals, rejection, funding and suspension', () => {
  const campaigns = Object.keys(expected).map(status => ({ status }));
  const final = campaigns.filter(c => matchesCampaignGroup(c.status, 'completed'));
  assert.deepEqual(final.map(c => c.status), ['completed', 'failed', 'cancelled']);
  const total = CAMPAIGN_GROUPS.reduce((n, g) => n + campaigns.filter(c => matchesCampaignGroup(c.status, g.value)).length, 0);
  assert.equal(total, campaigns.length);
});

test('feeds load later pages before calculating filters and counts', async () => {
  const calls = [];
  const statuses = [...Array(12).fill('published'), 'approved', 'failed', 'cancelled'];
  const result = await collectCampaignPages(async page => {
    calls.push(page);
    const data = statuses.slice((page - 1) * 12, page * 12).map((status, i) => ({ id: (page - 1) * 12 + i, status }));
    return { data, meta: { currentPage: page, totalPages: 2, totalItems: 15, itemCount: data.length, itemsPerPage: 12 } };
  });
  assert.deepEqual(calls, [1, 2]);
  assert.equal(result.data.length, 15);
  assert.equal(result.data.filter(c => matchesCampaignGroup(c.status, 'completed')).length, 2);
  assert.equal(result.data.filter(c => matchesCampaignGroup(c.status, 'approved')).length, 1);
  assert.equal(result.meta.itemCount, 15);
});

test('an incomplete load fails instead of presenting partial counters', async () => {
  await assert.rejects(collectCampaignPages(async page => {
    if (page === 2) throw new Error('Page unavailable');
    return { data: [{ status: 'published' }], meta: { currentPage: 1, totalPages: 2, totalItems: 2, itemCount: 1, itemsPerPage: 1 } };
  }), /Page unavailable/);
});
