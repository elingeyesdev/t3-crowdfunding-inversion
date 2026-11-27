<?php
// Fixtures exclusivas de la base efímera del ejecutor móvil. Nunca usar en datos reales.
$temp = getenv('UNIFUNDME_HTTP_TEMP');
$bootstrap = getenv('UNIFUNDME_HTTP_BOOTSTRAP');
if (getenv('UNIFUNDME_TRACKING_FIXTURES') !== 'true' || !$temp || !$bootstrap ||
    !str_starts_with(basename($temp), 'unifundme28-http-') ||
    realpath(dirname($bootstrap)) !== realpath($temp)) {
    throw new RuntimeException('Se requiere el ejecutor HTTP aislado.');
}
$app = require $bootstrap;
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
if (realpath(dirname(config('database.connections.sqlite.database'))) !== realpath($temp)) {
    throw new RuntimeException('La base de fixtures debe pertenecer al directorio temporal.');
}
if (app()->environment() !== 'testing' || realpath(config('database.connections.sqlite.database')) !== realpath(getenv('DB_DATABASE'))) throw new RuntimeException('Unsafe database');
function fid($n) { return 'a0000000-0000-4000-8000-'.str_pad((string)$n,12,'0',STR_PAD_LEFT); }
$people=[];
foreach (['owner'=>'entrepreneur','donor'=>'investor','other'=>'investor'] as $name=>$role) {
 $u=App\Models\User::create(['email'=>'tracking28-'.$name.'@example.test','password_hash'=>Illuminate\Support\Facades\Hash::make('SyntheticOnly28'),'is_active'=>true,'email_verified'=>true]);
 $u->assignRole($role); $u->{$role}()->create(['first_name'=>ucfirst($name),'last_name'=>'Fixture']); $people[$name]=$u;
}
$category=App\Models\Category::firstOrFail();
foreach ([1=>'published',2=>'failed',3=>'draft'] as $n=>$status) {
 App\Models\Campaign::forceCreate(['id'=>fid($n),'creator_id'=>$people['owner']->id,'category_id'=>$category->id,'title'=>'Campaña '.$n,'slug'=>'tracking28-'.$n,'description'=>'Seguimiento móvil de campañas','status'=>$status,'goal_amount'=>1000,'current_amount'=>$n===1?300:0,'currency'=>'BOB','min_investment'=>10,'published_at'=>$n===3?null:now(),'end_date'=>$n===2?now()->subDay():now()->addMonth()]);
}
App\Models\RewardTier::forceCreate(['id'=>fid(20),'campaign_id'=>fid(1),'title'=>'Kit','description'=>'Producto','amount'=>100,'currency'=>'BOB','min_percentage'=>10,'max_percentage'=>20,'current_claims'=>1,'is_active'=>true,'items'=>[]]);
foreach ([201=>[1,'donor',100,'completed',20],202=>[1,'donor',100,'completed',null],203=>[2,'donor',80,'refunded',null],204=>[3,'donor',50,'completed',null],205=>[1,'other',100,'completed',null]] as $n=>[$campaign,$who,$amount,$status,$reward]) {
 App\Models\Investment::forceCreate(['id'=>fid($n),'campaign_id'=>fid($campaign),'investor_id'=>$people[$who]->id,'amount'=>$amount,'currency'=>'BOB','status'=>$status,'reward_tier_id'=>$reward?fid($reward):null,'refunded_amount'=>$status==='refunded'?$amount:0]);
}
App\Models\RewardClaim::forceCreate(['id'=>fid(211),'investment_id'=>fid(201),'status'=>'shipped','tracking_number'=>'GUIA-28','tracking_url'=>'https://tracking.example.test/28','shipped_at'=>now()]);
App\Models\RewardClaim::forceCreate(['id'=>fid(212),'investment_id'=>fid(203),'status'=>'cancelled']);
App\Models\CampaignMilestone::forceCreate(['id'=>fid(220),'campaign_id'=>fid(1),'title'=>'Prototipo','status'=>'in_progress','progress_percentage'=>60,'sort_order'=>1,'evidence_urls'=>[]]);
for ($i=1;$i<=12;$i++) {
 App\Models\CampaignUpdate::forceCreate(['id'=>fid(300+$i),'campaign_id'=>fid(1),'author_id'=>$people['owner']->id,'title'=>'Avance '.$i,'content'=>'Contenido público '.$i,'is_public'=>true,'attachments'=>[]]);
}
foreach ([321=>[2,true,'Campaña reembolsada'],322=>[1,false,'Privado'],323=>[3,true,'Borrador oculto']] as $n=>[$campaign,$public,$title]) {
 App\Models\CampaignUpdate::forceCreate(['id'=>fid($n),'campaign_id'=>fid($campaign),'author_id'=>$people['owner']->id,'title'=>$title,'content'=>'Contenido de prueba','is_public'=>$public,'attachments'=>[]]);
}
echo "ISOLATED_FIXTURES_READY\n";
