<?php

// ============================================================
// get_alumnos.php — Devuelve alumnos filtrados por grupo/periodo
// Usado por: pase_de_lista.html (js_pase_lista.js)
// ============================================================

header("Content-Type: application/json; charset=UTF-8");
header("X-Content-Type-Options: nosniff");
header("X-Frame-Options: DENY");
header("Referrer-Policy: no-referrer");
header("Cache-Control: no-store");

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$permitidos = ['http://localhost', 'http://127.0.0.1', 'http://localhost:8080'];
if (in_array($origin, $permitidos, true)) {
    header("Access-Control-Allow-Origin: $origin");
}
else {
    $dominioPermitido = getenv('APP_ORIGIN') ?: 'https://tudominio.edu.mx';
    header("Access-Control-Allow-Origin: $dominioPermitido");
}
header("Access-Control-Allow-Methods: GET");

// Solo GET
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    exit(json_encode(["error" => "Método no permitido"]));
}

// ── IP sin spoofing ──────────────────────────────────────────
function obtenerIP(): string
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'IP_DESCONOCIDA';
    return filter_var($ip, FILTER_VALIDATE_IP) ? $ip : 'IP_INVALIDA';
}
$ip = obtenerIP();

// ── Rate limiting por IP — máx 30 consultas por minuto ───────
session_set_cookie_params([
    'lifetime' => 0, 'path' => '/', 'secure' => false,
    'httponly' => true, 'samesite' => 'Strict',
]);
session_start();

$claveRL = 'rl_get_alumnos_' . md5($ip);
$ahora = time();
if (!isset($_SESSION[$claveRL])) {
    $_SESSION[$claveRL] = ['count' => 0, 'desde' => $ahora];
}
if ($ahora - $_SESSION[$claveRL]['desde'] > 60) {
    $_SESSION[$claveRL] = ['count' => 0, 'desde' => $ahora];
}
$_SESSION[$claveRL]['count']++;
if ($_SESSION[$claveRL]['count'] > 30) {
    http_response_code(429);
    header("Retry-After: 60");
    exit(json_encode(["error" => "Demasiadas solicitudes. Espera 1 minuto."]));
}

// ── Leer y validar parámetros ─────────────────────────────────
$grupo = trim($_GET['grupo'] ?? '');
$periodo = trim($_GET['periodo'] ?? '');
$materia = trim($_GET['materia'] ?? '');

if (empty($grupo) || empty($periodo) || empty($materia)) {
    http_response_code(400);
    exit(json_encode(["error" => "Los parámetros 'grupo', 'periodo' y 'materia' son obligatorios"]));
}

// Eliminar null bytes y chars de control
$grupo = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $grupo);
$periodo = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $periodo);
$materia = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $materia);

if (mb_strlen($grupo) > 10 || mb_strlen($periodo) > 10 || mb_strlen($materia) > 100) {
    http_response_code(400);
    exit(json_encode(["error" => "Parámetros demasiado largos"]));
}

// Prevención básica de inyección de caracteres especiales
if (preg_match('/[^A-Za-z0-9\-_\s]/', $grupo) || preg_match('/[^A-Za-z0-9\-_\s]/', $periodo) || preg_match('/[^A-Za-z0-9\-_\sáéíóúÁÉÍÓÚñÑ]/', $materia)) {
    http_response_code(400);
    exit(json_encode(["error" => "Parámetros contienen caracteres no permitidos"]));
}

// ── Consultar la BD ───────────────────────────────────────────
require_once "../config/conexion.php";

try {
    $stmt = $conexion->prepare(
        "SELECT nocontrol, nombre, grupo, periodo, materia
         FROM alumnos
         WHERE grupo   = :grupo
           AND periodo = :periodo
           AND materia = :materia
         ORDER BY nombre ASC"
    );
    $stmt->execute([
        ':grupo' => $grupo,
        ':periodo' => $periodo,
        ':materia' => $materia,
    ]);
    $alumnos = $stmt->fetchAll();

    error_log(json_encode([
        "evento" => "get_alumnos_ok",
        "grupo" => $grupo,
        "periodo" => $periodo,
        "cantidad" => count($alumnos),
        "ip" => $ip,
        "ts" => date('c')
    ]));

    echo json_encode([
        "status" => "ok",
        "grupo" => $grupo,
        "periodo" => $periodo,
        "total" => count($alumnos),
        "alumnos" => $alumnos
    ]);

}
catch (PDOException $e) {
    error_log(json_encode([
        "evento" => "get_alumnos_error",
        "msg" => $e->getMessage(),
        "ip" => $ip,
        "ts" => date('c')
    ]));
    http_response_code(500);
    echo json_encode(["error" => "Error al consultar la base de datos"]);
}
?>