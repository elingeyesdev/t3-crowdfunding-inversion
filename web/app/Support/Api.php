<?php

namespace App\Support;

use App\Services\LegacyKycFiles;
use Illuminate\Contracts\Support\Arrayable;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;

class Api
{
    public static function camel(mixed $value): mixed
    {
        if ($value instanceof \DateTimeInterface) {
            return $value->format(DATE_ATOM);
        }
        if ($value instanceof Arrayable) {
            $value = $value->toArray();
        }
        if (is_object($value)) {
            $value = (array) $value;
        }
        if (! is_array($value)) {
            return $value;
        }
        $result = [];
        foreach ($value as $key => $item) {
            $result[is_string($key) ? Str::camel($key) : $key] = self::camel($item);
        }

        return $result;
    }

    public static function snake(array $value): array
    {
        return collect($value)->mapWithKeys(fn ($item, $key) => [Str::snake($key) => $item])->all();
    }

    public static function ok(mixed $data = null, int $status = 200, bool $camel = true)
    {
        $data = self::privateUrls($data);

        return response()->json(['data' => $camel ? self::camel($data) : $data, 'message' => 'Operación exitosa', 'statusCode' => $status], $status);
    }

    private static function privateUrls(mixed $data): mixed
    {
        if ($data instanceof Arrayable) {
            $data = $data->toArray();
        }
        if (is_array($data)) {
            return array_map([self::class, 'privateUrls'], $data);
        }
        if (is_string($data)) {
            $kycUrl = LegacyKycFiles::privateUrl($data);
            if ($kycUrl !== null) {
                // Serialization must not mint KYC credentials from user-controlled
                // text such as a bio containing another profile's document path.
                if (! LegacyKycFiles::maySign($kycUrl)) {
                    return $data;
                }
                $data = $kycUrl;
            }
            // Only canonical paths are signed; encoded separators or traversal
            // must not bypass the KYC ownership check above.
            if (preg_match('#^/api/v1/private-files/(?:kyc|documents)/[a-zA-Z0-9._-]+$#', $data) && ! str_contains($data, '..')) {
                return URL::temporarySignedRoute('private.file', now()->addMinutes(15), ['path' => substr($data, 22)]);
            }
        }

        return $data;
    }

    public static function page($query, $request, ?callable $map = null): array
    {
        $limit = max(1, min(100, (int) $request->input('limit', 20)));
        $page = $query->paginate($limit, ['*'], 'page', max(1, (int) $request->input('page', 1)));
        $items = $map ? $page->getCollection()->map($map)->all() : $page->items();

        return ['data' => $items, 'meta' => ['totalItems' => $page->total(), 'itemCount' => count($items), 'itemsPerPage' => $limit, 'totalPages' => $page->lastPage(), 'currentPage' => $page->currentPage()]];
    }
}
