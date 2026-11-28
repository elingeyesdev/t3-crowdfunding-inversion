import {test,expect,fixtures as f,headers,data} from './fixtures';

const comments='/api/v1/campaigns/'+f.campaigns.published+'/comments';
test.beforeEach(async({page,baseURL})=>{
  await page.route('**/*',route=>route.request().url().startsWith(baseURL!)?route.continue():route.abort());
  await page.addInitScript(user=>{
    localStorage.setItem('accessToken',user.token);localStorage.setItem('userId',user.id);
    localStorage.setItem('userEmail',user.email);localStorage.setItem('userRole','investor');
  },f.accounts.donor);
});

test('failed comment query offers retry instead of an empty list or zero counter',async({page,request})=>{
  await data(await request.post(comments,{headers:headers(),data:{content:'Comentario existente de prueba'}}),201);
  let fail=true;
  await page.route('**'+comments+'?*',async route=>{
    if(!fail)return route.continue();
    await route.fulfill({status:500,json:{message:'Synthetic internal error'}});
  });
  await page.goto('/campaign/'+f.campaigns.published);
  await page.getByRole('button',{name:'Comentarios',exact:true}).click();
  const section=page.locator('#campaign-comments');
  await expect(section.getByRole('alert')).toContainText('No se pudieron cargar los comentarios');
  await expect(section).not.toContainText('Sé el primero en comentar');
  await expect(section.getByRole('heading')).not.toContainText('(0)');
  fail=false;
  await section.getByRole('button',{name:'Reintentar',exact:true}).click();
  await expect(section.getByText('Comentario existente de prueba',{exact:true})).toBeVisible();
  await expect(section.getByRole('heading')).toContainText('(1)');
});

test('posting failure keeps the draft and a pending request cannot be sent twice',async({page,request})=>{
  let fail=true,calls=0,release!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**'+comments,async route=>{
    if(route.request().method()!=='POST')return route.continue();
    calls++;
    if(!fail)return route.continue();
    await gate;
    await route.fulfill({status:500,json:{message:'Synthetic internal error'}});
  });
  await page.goto('/campaign/'+f.campaigns.published);
  await page.getByRole('button',{name:'Comentarios',exact:true}).click();
  const section=page.locator('#campaign-comments');
  await expect(section.getByText('Sé el primero en comentar',{exact:true})).toBeVisible();
  const text='Comentario que se conserva para reintentar';
  await section.getByRole('textbox').fill(text);
  await section.getByRole('button',{name:'Publicar comentario',exact:true}).evaluate(button=>{button.click();button.click();});
  await expect(section.getByRole('status')).toHaveText('Publicando comentario...');
  await expect(section.getByRole('textbox')).toBeDisabled();expect(calls).toBe(1);
  release();
  await expect(section.getByRole('alert')).toContainText('El texto se conserva');
  await expect(section.getByRole('textbox')).toHaveValue(text);
  expect(await data(await request.get(comments,{headers:headers()}))).toHaveLength(0);
  fail=false;
  await section.getByRole('button',{name:'Reintentar',exact:true}).click();
  await expect(section.getByRole('textbox')).toHaveValue('');
  await expect(section.getByText(text,{exact:true})).toBeVisible();
  expect(calls).toBe(2);
  const saved=await data(await request.get(comments,{headers:headers()}));
  expect(saved).toHaveLength(1);expect(saved[0].content).toBe(text);
});

for(const initiallyLiked of [false,true])test(`failed ${initiallyLiked?'unlike':'like'} restores the count and retries against Laravel`,async({page,request})=>{
  const saved=await data(await request.post(comments,{headers:headers(),data:{content:'Comentario para probar likes'}}),201);
  await data(await request.post(comments,{headers:headers(),data:{content:'Segundo comentario para comprobar bloqueo'}}),201);
  const path=comments+'/'+saved.id+'/like';
  if(initiallyLiked)await data(await request.post(path,{headers:headers()}));
  let fail=true,calls=0,release!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**'+comments+'/*/like',async route=>{
    calls++;
    if(!fail)return route.continue();
    await gate;await route.fulfill({status:500,json:{message:'Synthetic internal error'}});
  });
  await page.goto('/campaign/'+f.campaigns.published);
  await page.getByRole('button',{name:'Comentarios',exact:true}).click();
  const section=page.locator('#campaign-comments');
  const bubble=section.locator('.flex-1.min-w-0').filter({has:page.getByText('Comentario para probar likes',{exact:true})});
  const like=bubble.getByRole('button',{name:/me gusta al comentario/});
  await expect(like).toHaveAttribute('aria-pressed',String(initiallyLiked));
  await section.getByRole('textbox').fill('Borrador conservado durante el like');
  await like.evaluate(button=>{button.click();button.click();});
  await expect(like).toHaveAttribute('aria-pressed',String(!initiallyLiked));
  await expect(like).toBeDisabled();
  await expect(section.getByRole('button',{name:/me gusta al comentario/}).first()).toBeDisabled();
  await expect(section.getByRole('button',{name:'Publicar comentario',exact:true})).toBeDisabled();expect(calls).toBe(1);
  release();
  await expect(bubble.getByRole('alert')).toContainText('Se restauró el estado anterior');
  await expect(like).toHaveAttribute('aria-pressed',String(initiallyLiked));
  await expect(like).toHaveText(initiallyLiked?'1':'Me gusta');
  await expect(section.getByRole('textbox')).toHaveValue('Borrador conservado durante el like');
  fail=false;await bubble.getByRole('button',{name:'Reintentar',exact:true}).click();
  await expect(like).toHaveAttribute('aria-pressed',String(!initiallyLiked));
  await expect(like).toHaveText(initiallyLiked?'Me gusta':'1');
  const row=(await data(await request.get(comments,{headers:headers()}))).find(comment=>comment.id===saved.id);
  expect(row.likedByMe).toBe(!initiallyLiked);expect(row.likesCount).toBe(initiallyLiked?0:1);
});
