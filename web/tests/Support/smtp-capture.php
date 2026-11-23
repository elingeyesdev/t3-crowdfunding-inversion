<?php

// One-message SMTP capture for integration tests. Never forwards mail.
$server = stream_socket_server('tcp://127.0.0.1:0', $code, $error);
if (! $server) {
    fwrite(STDERR, 'Could not bind the local SMTP test listener.');
    exit(1);
}
echo json_encode(['address' => stream_socket_get_name($server, false)])."\n";
flush();
$client = stream_socket_accept($server, 10);
if (! $client) {
    fclose($server);
    exit(1);
}
stream_set_timeout($client, 10);
fwrite($client, "220 localhost SMTP test capture\r\n");
while (($line = fgets($client)) !== false) {
    $command = strtoupper(strtok(trim($line), ' '));
    if ($command === 'EHLO' || $command === 'HELO') {
        fwrite($client, "250-localhost\r\n250 SIZE 1048576\r\n");
    } elseif ($command === 'DATA') {
        fwrite($client, "354 End with a dot\r\n");
        $message = '';
        while (($line = fgets($client)) !== false && $line !== ".\r\n") {
            $message .= str_starts_with($line, '..') ? substr($line, 1) : $line;
            if (strlen($message) > 1048576) {
                exit(1);
            }
        }
        echo json_encode(['message' => base64_encode($message)])."\n";
        flush();
        fwrite($client, "250 Captured\r\n");
        break;
    } elseif ($command === 'QUIT') {
        fwrite($client, "221 Bye\r\n");
        break;
    } else {
        fwrite($client, "250 OK\r\n");
    }
}
fclose($client);
fclose($server);
