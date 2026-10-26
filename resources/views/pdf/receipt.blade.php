<!doctype html><html lang="es"><head><meta charset="UTF-8"><style>body{font-family:DejaVu Sans,sans-serif;color:#1c2b1e;font-size:12px}h1{color:#4a7f1a}header{border-bottom:4px solid #72b626;padding-bottom:20px}td{padding:10px}table{width:100%}.amount{background:#f5fce8;padding:20px;font-size:22px}footer{margin-top:40px;color:#666;font-size:10px}</style></head><body>
<header><h1>UniFundMe</h1><h2>Comprobante de aporte</h2></header>
<p>Operación: {{ $investment->id }}</p><table>
<tr><td>Donante</td><td>{{ $investment->investor->investor?->first_name }} {{ $investment->investor->investor?->last_name }}</td></tr>
<tr><td>Correo</td><td>{{ $investment->investor->email }}</td></tr>
<tr><td>Campaña</td><td>{{ $investment->campaign->title }}</td></tr>
<tr><td>Fecha</td><td>{{ $investment->created_at->timezone('America/La_Paz')->format('d/m/Y H:i') }}</td></tr>
<tr><td>Estado</td><td>{{ $investment->status }}</td></tr>
@if($investment->reward)<tr><td>Recompensa</td><td>{{ $investment->reward->title }}</td></tr>@endif
</table><p class="amount">{{ $investment->currency }} {{ number_format($investment->amount,2,',','.') }}</p>
<footer>UniFundMe · Comprobante digital generado automáticamente.</footer></body></html>
