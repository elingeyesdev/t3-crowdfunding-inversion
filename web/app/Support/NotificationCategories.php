<?php

namespace App\Support;

use Illuminate\Database\Eloquent\Builder;

class NotificationCategories
{
    // This is the source for both SQL filtering and the category sent to React.
    private const RULES = [
        'campaign' => ['prefixes' => ['campaign_']],
        'investment' => ['prefixes' => ['investment_']],
        'kyc' => ['prefixes' => ['kyc_']],
        'chat' => ['types' => ['new_message', 'new_comment']],
        'financial' => ['prefixes' => ['financial_', 'document_']],
    ];

    public static function names(): array
    {
        return [...array_keys(self::RULES), 'system'];
    }

    public static function forType(?string $type): string
    {
        $type = strtolower($type ?? '');
        foreach (self::RULES as $category => $rule) {
            if (in_array($type, $rule['types'] ?? [], true)) {
                return $category;
            }
            foreach ($rule['prefixes'] ?? [] as $prefix) {
                if (str_starts_with($type, $prefix)) {
                    return $category;
                }
            }
        }

        return 'system';
    }

    public static function filter(Builder $query, string $category): void
    {
        $clauses = [];
        $bindings = [];
        $rules = $category === 'system' ? self::RULES : [$category => self::RULES[$category]];
        foreach ($rules as $rule) {
            foreach ($rule['prefixes'] ?? [] as $prefix) {
                // Underscores in event prefixes are literal, not LIKE wildcards.
                $clauses[] = "LOWER(type_code) LIKE ? ESCAPE '!'";
                $bindings[] = str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $prefix).'%';
            }
            foreach ($rule['types'] ?? [] as $type) {
                $clauses[] = 'LOWER(type_code) = ?';
                $bindings[] = $type;
            }
        }
        $sql = implode(' OR ', $clauses);
        if ($category === 'system') {
            // Group the fallback with NULL explicitly, preserving user isolation.
            $query->where(fn ($q) => $q->whereNull('type_code')->orWhereRaw('NOT ('.$sql.')', $bindings));
        } else {
            $query->whereRaw('('.$sql.')', $bindings);
        }
    }
}
