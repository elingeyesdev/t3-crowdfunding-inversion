import {test,expect,fixtures as f,headers,data} from './fixtures';

for(const [account,verified] of [
  ['donor',true],['owner',true],['otherOwner',true],
  ['unverifiedDonor',false],['unverifiedOwner',false],
] as const) test(`${account}: fixture email state matches the authenticated server identity`,async({request})=>{
  const identity=await data(await request.get('/api/v1/auth/me',{headers:headers(account)}));
  expect(identity.id).toBe(f.accounts[account].id);
  expect(identity.emailVerified).toBe(verified);
  expect(f.accounts[account].emailVerified).toBe(verified);
});

test('unverified donor cannot contribute or create a reward claim and no financial data changes',async({request})=>{
  const auth=headers('unverifiedDonor');
  const before=await data(await request.get('/api/v1/investors/me/capital',{headers:auth}));
  const campaign=await data(await request.get(`/api/v1/campaigns/public/${f.campaigns.published}`));
  const rejected=await request.post('/api/v1/investments',{headers:auth,data:{campaignId:f.campaigns.published,amount:100,rewardTierId:f.reward}});
  expect(rejected.status()).toBe(403);
  expect((await rejected.json()).code).toBe('EMAIL_VERIFICATION_REQUIRED');
  expect(await data(await request.get('/api/v1/investors/me/capital',{headers:auth}))).toEqual(before);
  expect(await data(await request.get('/api/v1/investments/me',{headers:auth}))).toHaveLength(0);
  expect(await data(await request.get(`/api/v1/campaigns/${f.campaigns.published}/rewards/claims`,{headers:headers('owner')}))).toHaveLength(0);
  const after=await data(await request.get(`/api/v1/campaigns/public/${f.campaigns.published}`));
  expect(after.currentAmount).toBe(campaign.currentAmount);
  expect(after.investorCount).toBe(campaign.investorCount);
});

for(const [campaign,action,status] of [
  ['unverifiedDraft','submit-for-review','draft'],
  ['unverifiedApproved','publish','approved'],
] as const)test(`unverified owner cannot ${action} and the campaign state and history stay unchanged`,async({request})=>{
  const auth=headers('unverifiedOwner');
  const base=`/api/v1/entrepreneurs/me/campaigns/${f.campaigns[campaign]}`;
  const profile=await data(await request.get('/api/v1/entrepreneurs/me/profile',{headers:auth}));
  expect(profile.identityVerified).toBe(true);
  const before=await data(await request.get(base,{headers:auth}));
  expect(before.status).toBe(status);
  expect(new Date(before.endDate).getTime()).toBeGreaterThan(Date.now());
  const history=await data(await request.get(base+'/history',{headers:auth}));
  const rejected=await request.post(base+'/'+action,{headers:auth});
  expect(rejected.status()).toBe(403);
  expect((await rejected.json()).code).toBe('EMAIL_VERIFICATION_REQUIRED');
  const after=await data(await request.get(base,{headers:auth}));
  expect(after.status).toBe(status);
  expect(after.publishedAt).toBe(before.publishedAt);
  expect(await data(await request.get(base+'/history',{headers:auth}))).toEqual(history);
  expect((await request.get(`/api/v1/campaigns/public/${f.campaigns[campaign]}`)).status()).toBe(404);
});
