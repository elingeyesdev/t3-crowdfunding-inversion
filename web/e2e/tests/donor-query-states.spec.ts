import {test,expect,fixtures as f} from './fixtures';

test.beforeEach(async({page,baseURL})=>{
  await page.route('**/*',route=>route.request().url().startsWith(baseURL!)?route.continue():route.abort());
  await page.addInitScript(user=>{
    localStorage.setItem('accessToken',user.token);localStorage.setItem('userId',user.id);
    localStorage.setItem('userEmail',user.email);localStorage.setItem('userRole','investor');
  },f.accounts.donor);
});

for(const entry of ['/dashboard','/profile']) for(const status of [0,500,401]) {
  test(`${entry}: history ${status} is recoverable and never claims the profile is missing`,async({page})=>{
    let fail=true, calls=0;
    await page.route('**/api/v1/investments/me',async route=>{
      calls++;
      if(!fail)return route.continue();
      if(!status)return route.abort('connectionrefused');
      await route.fulfill({status,json:{message:'Synthetic internal details'}});
    });
    await page.goto(entry);
    const alert=page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(page.getByText('Completar Perfil de Donador',{exact:true})).toHaveCount(0);
    await expect(page.getByText('¡Casi listo para donar!',{exact:true})).toHaveCount(0);
    await expect(page.getByText('Sin Donaciones Aún',{exact:true})).toHaveCount(0);
    expect(calls).toBe(1);
    if(status===401){
      await expect(alert).toContainText('Tu sesión venció');
      await expect(alert.getByRole('link',{name:'Iniciar sesión',exact:true})).toHaveAttribute('href','/login');
    }else{
      if(status===500)await expect(alert).not.toContainText('Synthetic internal details');
      fail=false;
      await alert.getByRole('button',{name:'Reintentar',exact:true}).click();
      await expect(alert).toHaveCount(0);
      expect(calls).toBe(2);
      if(entry==='/profile')await expect(page.getByText('Sin Donaciones Aún',{exact:true})).toBeVisible();
    }
  });
}

test('a failed profile query does not open onboarding and retry recovers the real profile',async({page})=>{
  let fail=true;
  await page.route('**/api/v1/investors/me/profile',async route=>{
    if(!fail)return route.continue();
    await route.fulfill({status:500,json:{message:'Synthetic internal details'}});
  });
  await page.goto('/profile');
  await expect(page.getByRole('alert')).toContainText('No se pudo cargar tu perfil');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('Completar Ahora',{exact:true})).toHaveCount(0);
  fail=false;
  await page.getByRole('button',{name:'Reintentar',exact:true}).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByText('Sin Donaciones Aún',{exact:true})).toBeVisible();
});

test('only a confirmed capital profile 404 offers profile creation',async({page})=>{
  await page.route('**/api/v1/investors/me/capital',route=>route.fulfill({status:404,json:{message:'Not found'}}));
  await page.goto('/dashboard');
  await expect(page.getByRole('link',{name:'Completar Perfil de Donador'})).toBeVisible();
});
