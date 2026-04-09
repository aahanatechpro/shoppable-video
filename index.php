<?php
// Proxy requests to the Node.js app running on its dedicated local port.
// This allows the app to work on Cloudways PHP hosting

$requestUri = $_SERVER['REQUEST_URI'] ?? '/';
$requestMethod = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$body = file_get_contents('php://input');
$nodePort = getenv('SHOPPABLE_VIDEO') ?: '3002';
$target = 'http://127.0.0.1:' . $nodePort . $requestUri;
$host = $_SERVER['HTTP_HOST'] ?? 'phpstack-683830-6336116.cloudwaysapps.com';
$https = (
    (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ||
    (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https')
);
$scheme = $https ? 'https' : 'http';

$ch = curl_init($target);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false);
curl_setopt($ch, CURLOPT_HEADER, true);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $requestMethod);
curl_setopt($ch, CURLOPT_ENCODING, '');

$headers = [
    'Host: ' . $host,
    'X-Forwarded-Host: ' . $host,
    'X-Forwarded-Proto: ' . $scheme,
    'X-Forwarded-Port: ' . ($https ? '443' : '80'),
];
if (function_exists('getallheaders')) {
    foreach (getallheaders() as $name => $value) {
        $lowerName = strtolower($name);
        if (!in_array($lowerName, ['host', 'x-forwarded-host', 'x-forwarded-proto', 'x-forwarded-port'], true)) {
            $headers[] = $name . ': ' . $value;
        }
    }
} else {
    foreach ($_SERVER as $name => $value) {
        if (substr($name, 0, 5) === 'HTTP_') {
            $headerName = str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($name, 5)))));
            $lowerName = strtolower($headerName);
            if (!in_array($lowerName, ['host', 'x-forwarded-host', 'x-forwarded-proto', 'x-forwarded-port'], true)) {
                $headers[] = $headerName . ': ' . $value;
            }
        }
    }
}
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);

if (!empty($body)) {
    curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
}

$response = curl_exec($ch);
if ($response === false) {
    http_response_code(502);
    header('Content-Type: text/plain');
    echo 'Bad Gateway: could not connect to Node app.';
    curl_close($ch);
    exit;
}

$headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$headerText = substr($response, 0, $headerSize);
$body = substr($response, $headerSize);

curl_close($ch);

http_response_code($httpCode);

$headerLines = preg_split('/\r?\n/', trim($headerText));
foreach ($headerLines as $line) {
    if (strpos($line, ':') !== false && !preg_match('/^(HTTP|Content-Length|Content-Encoding|Transfer-Encoding|Connection)/i', $line)) {
        header($line, false);
    }
}

// If cURL decoded the response body, make sure the browser does not try to decode it again.
header('Content-Encoding: identity');

echo $body;
?>
