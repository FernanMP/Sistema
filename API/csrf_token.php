<?php

header("Content-Type: application/json; charset=UTF-8");
header("X-Content-Type-Options: nosniff");
header("Cache-Control: no-store, no-cache, must-revalidate");

// CORS local: permite cualquier origen local
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$permitidos = ['http://localhost', 'http://127.0.0.1', 'http://localhost:8080', 'http://localhost:80'];
if (in_array($origin, $permitidos, true)) {
    header("Access-Control-Allow-Origin: $origin");
} else {
    header("Access-Control-Allow-Origin: *"); // Local: permisivo
}

// FIX 1 y 2: Configurar sesión segura antes de iniciarla
session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'secure'   => false,       // false en local (sin HTTPS)
    'httponly' => true,        // FIX: JS no puede leer la cookie de sesión
    'samesite' => 'Strict',   // FIX: protege contra CSRF via cookies
]);

session_start();
session_regenerate_id(true); // FIX 2: Previene session fixation

// FIX 3: Token con timestamp
$token = bin2hex(random_bytes(32)); // 256 bits de entropía

$_SESSION['csrf_token']    = $token;
$_SESSION['csrf_token_ts'] = time(); // Expiración en 10 minutos

echo json_encode(["csrf_token" => $token]);
?>
