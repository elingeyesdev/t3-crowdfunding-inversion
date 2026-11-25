<?php
declare(strict_types=1);
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$public = realpath(dirname(__DIR__, 2).'/public');
$file = realpath($public.'/'.ltrim(rawurldecode($path ?: '/'), '/'));
if ($file && str_starts_with($file, $public.DIRECTORY_SEPARATOR) && is_file($file)) {
    return false;
}
$app = require __DIR__.'/bootstrap.php';
$app->handleRequest(Illuminate\Http\Request::capture());
