<?php

namespace App\Http\Controllers;

use App\Models\Campaign;
use App\Models\EntrepreneurProfile;
use App\Models\Investment;
use App\Models\InvestorProfile;
use App\Models\Role;
use App\Models\Transaction;
use App\Services\ProfileReadiness;
use App\Support\Api;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ProfileController extends Controller
{
    private function kind(Request $r): string
    {
        return str_contains($r->path(), 'entrepreneurs') ? 'entrepreneur' : 'investor';
    }

    private function query(Request $r)
    {
        return $this->kind($r) === 'entrepreneur' ? EntrepreneurProfile::query() : InvestorProfile::query();
    }

    public function show(Request $r)
    {
        return Api::ok($this->query($r)->where('user_id', $r->user()->id)->firstOrFail());
    }

    public function publicShow(Request $r, string $id)
    {
        $profile = $this->query($r)->findOrFail($id);

        return Api::ok($profile->only(['id', 'user_id', 'first_name', 'last_name', 'display_name', 'bio', 'company_name', 'website', 'linkedin_url', 'city', 'country', 'avatar_url', 'cover_url', 'identity_verified', 'total_campaigns', 'total_raised', 'total_investments', 'created_at']));
    }

    public function save(Request $r)
    {
        $creating = $r->isMethod('post');
        $query = $this->query($r)->where('user_id', $r->user()->id);
        if ($creating) {
            abort_if($query->exists(), 409, 'El perfil ya existe.');
        }
        $profile = $creating ? null : $query->firstOrFail();
        $required = $creating ? 'required' : 'sometimes';
        $rules = ['firstName' => "$required|string|min:2|max:100", 'lastName' => "$required|string|min:2|max:100", 'displayName' => ['nullable', 'string', 'max:150', Rule::unique($this->kind($r).'_profiles', 'display_name')->ignore($profile?->id)], 'bio' => 'nullable|string|max:2000'];
        foreach (['city', 'state', 'country', 'postalCode', 'taxId', 'addressLine1', 'addressLine2', 'addressLine', 'companyName', 'bankName', 'bankAccountNumber'] as $f) {
            $rules[$f] = 'nullable|string|max:255';
        }
        foreach (['website', 'linkedinUrl'] as $f) {
            $rules[$f] = 'nullable|url:http,https|max:512';
        }
        if ($this->kind($r) === 'investor') {
            $rules['investorType'] = 'sometimes|in:individual,institutional,angel';
            $rules['minInvestment'] = 'nullable|numeric|min:0|max:9999999999999.99';
            $rules['maxInvestment'] = 'sometimes|numeric|min:0|max:9999999999999.99';
        }
        $data = Api::snake($r->validate($rules));
        $fields = $this->kind($r) === 'entrepreneur' ? ['first_name', 'last_name', 'display_name', 'bio', 'city', 'state', 'country', 'postal_code', 'address_line', 'company_name', 'bank_name', 'bank_account_number', 'website', 'linkedin_url'] : ['first_name', 'last_name', 'display_name', 'bio', 'city', 'state', 'country', 'postal_code', 'address_line1', 'address_line2', 'tax_id', 'investor_type', 'min_investment', 'max_investment'];
        $data = array_intersect_key($data, array_flip($fields));

        return DB::transaction(function () use ($r, $creating, $data) {
            $existing = $this->query($r)->where('user_id', $r->user()->id)->lockForUpdate()->first();
            if (isset($data['max_investment'])) {
                abort_if($data['max_investment'] < ($existing?->total_invested ?? 0), 422, 'El capital no puede ser menor al monto invertido.');
            }
            if ($creating) {
                $profile = $this->query($r)->create(['user_id' => $r->user()->id, ...$data]);
            } else {
                $existing->update($data);
                $profile = $existing->fresh();
            }
            $r->user()->assignRole($this->kind($r));

            return Api::ok($profile, $creating ? 201 : 200);
        });
    }

    public function destroy(Request $r)
    {
        return DB::transaction(function () use ($r) {
            $profile = $this->query($r)->where('user_id', $r->user()->id)->lockForUpdate()->firstOrFail();
            $dependent = $this->kind($r) === 'entrepreneur' ? Campaign::where('creator_id', $r->user()->id)->exists() : Investment::where('investor_id', $r->user()->id)->exists();
            abort_if($dependent, 422, 'No puedes eliminar un perfil con campañas o inversiones registradas.');
            $profile->delete();
            $r->user()->roles()->detach(Role::where('name', $this->kind($r))->value('id'));

            return Api::ok();
        });
    }

    public function readiness(Request $r, ProfileReadiness $service)
    {
        $missing = $service->missing($r->user()->entrepreneur);

        return Api::ok(['canCreateCampaigns' => ! $missing, 'missingRequirements' => $missing]);
    }

    public function image(Request $r)
    {
        $profile = $this->query($r)->where('user_id', $r->user()->id)->firstOrFail();
        $r->validate(['file' => 'required|file|mimes:jpg,jpeg,png,webp,avif|max:10240']);
        $field = str_ends_with($r->path(), '/cover') ? 'cover_url' : 'avatar_url';
        $path = $r->file('file')->store('profiles', 'public');
        $profile->update([$field => '/storage/'.$path]);

        return Api::ok($profile->fresh());
    }

    public function kyc(Request $r)
    {
        $profile = $r->user()->entrepreneur()->firstOrFail();
        abort_if($profile->kyc_status === 'pending', 422, 'El KYC ya está en revisión.');
        $r->validate(['idDocument' => 'required|file|mimes:pdf,jpg,jpeg,png,webp|max:10240', 'faceVideo' => 'required|file|mimes:jpg,jpeg,png,webp,mp4,webm,mov|max:51200']);
        $docs = [];
        foreach (['idDocument', 'faceVideo'] as $field) {
            $path = $r->file($field)->store('kyc', 'local');
            $docs[] = ['type' => $field === 'faceVideo' ? 'faceValidation' : $field, 'url' => '/api/v1/private-files/'.$path, 'uploadedAt' => now()->toIso8601String()];
        }
        $profile->update(['verification_documents' => $docs, 'kyc_status' => 'pending', 'identity_verified' => false, 'kyc_rejection_reason' => null]);

        return Api::ok($profile->fresh());
    }

    public function capital(Request $r)
    {
        $p = $r->user()->investor()->firstOrFail();
        $investments = Investment::where('investor_id', $r->user()->id);

        return Api::ok(['totalInvestments' => $p->total_investments, 'totalInvested' => $p->total_invested, 'maxInvestmentLimit' => $p->max_investment, 'availableCapital' => round(($p->max_investment ?? 0) - $p->total_invested, 2), 'pendingAmount' => (float) (clone $investments)->where('status', 'pending')->sum('amount'), 'completedInvestments' => (clone $investments)->where('status', 'completed')->count()]);
    }

    public function addCapital(Request $r)
    {
        $data = $r->validate(['amount' => 'required|numeric|min:0.01|max:1000000000|decimal:0,2', 'notes' => 'nullable|string|max:1000']);

        return DB::transaction(function () use ($r, $data) {
            $p = $r->user()->investor()->lockForUpdate()->firstOrFail();
            $newMax = bcadd((string) ($p->max_investment ?? 0), (string) $data['amount'], 2);
            $p->update(['max_investment' => $newMax]);
            Transaction::create(['user_id' => $r->user()->id, 'transaction_type' => 'capital_addition', 'amount' => $data['amount'], 'notes' => $data['notes'] ?? null]);

            return Api::ok(['newMax' => (float) $newMax, 'availableCapital' => (float) bcsub($newMax,(string) $p->total_invested,2)]);
        });
    }
}
