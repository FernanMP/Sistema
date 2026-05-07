<?php

// ============================================================
// login.php — Autenticación contra alumnos_con_password
// ============================================================

header("Content-Type: application/json; charset=UTF-8");
header("X-Content-Type-Options: nosniff");
header("X-Frame-Options: DENY");
header("Referrer-Policy: no-referrer");
header("Content-Security-Policy: default-src 'none'");
header("Cache-Control: no-store");

$origin     = $_SERVER['HTTP_ORIGIN'] ?? '';
$permitidos = ['http://localhost', 'http://127.0.0.1', 'http://localhost:8080'];
if (in_array($origin, $permitidos, true)) {
    header("Access-Control-Allow-Origin: $origin");
} else {
    $dominioPermitido = getenv('APP_ORIGIN') ?: 'https://tudominio.edu.mx';
    header("Access-Control-Allow-Origin: $dominioPermitido");
}
header("Access-Control-Allow-Methods: POST");

// Solo POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit(json_encode(["error" => "Método no permitido"]));
}

// ============================================================
// IP segura (sin spoofing)
// ============================================================
function obtenerIP(): string {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'IP_DESCONOCIDA';
    return filter_var($ip, FILTER_VALIDATE_IP) ? $ip : 'IP_INVALIDA';
}

$ip = obtenerIP();

// ============================================================
// Rate limiting por IP — máx 10 intentos por 5 minutos
// ============================================================
session_set_cookie_params([
    'lifetime' => 0,
    'path'     => '/',
    'secure'   => false,   // cambiar a true en producción con HTTPS
    'httponly' => true,
    'samesite' => 'Strict',
]);
session_start();

$claveRL = 'rl_login_' . md5($ip);
$ahora   = time();

if (!isset($_SESSION[$claveRL])) {
    $_SESSION[$claveRL] = ['count' => 0, 'desde' => $ahora, 'bloqueado_hasta' => 0];
}

// Si está bloqueado, verificar si ya pasó el tiempo
if ($_SESSION[$claveRL]['bloqueado_hasta'] > $ahora) {
    $restante = $_SESSION[$claveRL]['bloqueado_hasta'] - $ahora;
    http_response_code(429);
    header("Retry-After: $restante");
    error_log("SECURITY: Login bloqueado por rate limit | IP: $ip");
    exit(json_encode(["error" => "Demasiados intentos. Espera {$restante} segundos."]));
}

// Resetear contador si pasaron más de 5 minutos
if ($ahora - $_SESSION[$claveRL]['desde'] > 300) {
    $_SESSION[$claveRL] = ['count' => 0, 'desde' => $ahora, 'bloqueado_hasta' => 0];
}

$_SESSION[$claveRL]['count']++;

// Bloquear 5 minutos tras 10 intentos fallidos
if ($_SESSION[$claveRL]['count'] > 10) {
    $_SESSION[$claveRL]['bloqueado_hasta'] = $ahora + 300;
    http_response_code(429);
    header("Retry-After: 300");
    error_log("SECURITY: Login rate limit activado | IP: $ip | Intentos: {$_SESSION[$claveRL]['count']}");
    exit(json_encode(["error" => "Demasiados intentos fallidos. Bloqueado 5 minutos."]));
}

// ============================================================
// Leer y validar campos
// ============================================================
$nocontrol = trim($_POST['nocontrol'] ?? '');
$password  = $_POST['password'] ?? '';   // Sin trim: espacios pueden ser intencionales

$errores = [];

if (empty($nocontrol)) {
    $errores[] = "El número de control es obligatorio";
} elseif (!preg_match('/^[A-Za-z]?[0-9]{2,10}$/', $nocontrol)) {
    $errores[] = "Formato de número de control inválido";
} elseif (mb_strlen($nocontrol) > 15) {
    $errores[] = "Número de control demasiado largo";
}

if (empty($password)) {
    $errores[] = "La contraseña es obligatoria";
} elseif (strlen($password) < 8) {
    $errores[] = "Contraseña demasiado corta";
} elseif (strlen($password) > 72) {
    $errores[] = "Contraseña demasiado larga";
}

if (!empty($errores)) {
    http_response_code(400);
    exit(json_encode(["error" => implode(". ", $errores)]));
}

// ============================================================
// Consultar la BD
// ============================================================
require_once "../config/conexion.php";

try {
    $stmt = $conexion->prepare(
        "SELECT nocontrol, nombre, email, grupo, periodo, password
         FROM alumnos_con_password
         WHERE nocontrol = :nocontrol
         LIMIT 1"
    );
    $stmt->execute([':nocontrol' => $nocontrol]);
    $alumno = $stmt->fetch();

    // Siempre ejecutar password_verify aunque no exista el usuario
    // (evita timing attack por enumeración de usuarios)
    $hashFalso  = '$2y$12$invalido.hash.para.evitar.timing.ataques.xxxxxxxxxxxxx';
    $hashReal   = $alumno ? $alumno['password'] : $hashFalso;
    $credencial = password_verify($password, $hashReal);

    if (!$alumno || !$credencial) {
        // Log de intento fallido — sin revelar si el usuario existe o no
        error_log(json_encode([
            "evento"    => "login_fallido",
            "nocontrol" => $nocontrol,
            "ip"        => $ip,
            "intento"   => $_SESSION[$claveRL]['count'],
            "ts"        => date('c')
        ]));

        http_response_code(401);
        // Mensaje genérico: no revelar si el usuario existe
        exit(json_encode(["error" => "Número de control o contraseña incorrectos"]));
    }

    // ============================================================
    // Login exitoso
    // ============================================================

    // Resetear contador de intentos
    $_SESSION[$claveRL] = ['count' => 0, 'desde' => $ahora, 'bloqueado_hasta' => 0];

    // Regenerar ID de sesión (evita session fixation)
    session_regenerate_id(true);

    // Guardar datos del alumno autenticado en sesión
    $_SESSION['alumno'] = [
        'nocontrol' => $alumno['nocontrol'],
        'nombre'    => $alumno['nombre'],
        'email'     => $alumno['email'],
        'grupo'     => $alumno['grupo'],
        'periodo'   => $alumno['periodo'],
        'login_ts'  => $ahora,
    ];

    error_log(json_encode([
        "evento"    => "login_exitoso",
        "nocontrol" => $alumno['nocontrol'],
        "ip"        => $ip,
        "ts"        => date('c')
    ]));

    echo json_encode([
        "status"   => "ok",
        "mensaje"  => "Bienvenido, " . $alumno['nombre'],
        "redirect" => "../index.html",   // Cambia por tu página principal post-login
        "alumno"   => [
            "nocontrol" => $alumno['nocontrol'],
            "nombre"    => $alumno['nombre'],
            "grupo"     => $alumno['grupo'],
            "periodo"   => $alumno['periodo'],
        ]
    ]);

} catch (PDOException $e) {
    error_log(json_encode([
        "evento" => "login_error_bd",
        "msg"    => $e->getMessage(),
        "ip"     => $ip,
        "ts"     => date('c')
    ]));
    http_response_code(500);
    echo json_encode(["error" => "Error interno del servidor"]);
}
?>