<?php

header("Content-Type: application/json; charset=UTF-8");
header("X-Content-Type-Options: nosniff");
header("X-Frame-Options: DENY");
header("Referrer-Policy: no-referrer");
header("Content-Security-Policy: default-src 'none'");
header("X-Permitted-Cross-Domain-Policies: none");
header("Permissions-Policy: camera=(), microphone=(), geolocation=()");
header("Cache-Control: no-store");

// CORS local
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$permitidos = ['http://localhost', 'http://127.0.0.1', 'http://localhost:8080'];
if (in_array($origin, $permitidos, true)) {
    header("Access-Control-Allow-Origin: $origin");
} else {
    header("Access-Control-Allow-Origin: *");
}
header("Access-Control-Allow-Methods: POST");

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit(json_encode(["error" => "Método no permitido"]));
}

// FIX 2: IP real sin posibilidad de spoofing — solo REMOTE_ADDR
// X-Forwarded-For es manipulable por el cliente; solo usarla si hay
// un proxy reverso de confianza configurado explícitamente.
function obtenerIP(): string {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'IP_DESCONOCIDA';
    return filter_var($ip, FILTER_VALIDATE_IP) ? $ip : 'IP_INVALIDA';
}

// FIX 4: Eliminar null bytes y caracteres de control de un campo
function limpiarCampo(string $valor): string {
    // Eliminar null bytes (\0) y chars de control ASCII 1-31 excepto \t \n \r
    return preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $valor);
}

// FIX 3: Rate limiting por IP (máx 20 intentos por minuto en sesión)
session_set_cookie_params([
    'lifetime' => 0, 'path' => '/', 'secure' => false,
    'httponly' => true, 'samesite' => 'Strict',
]);
session_start();

$ip = obtenerIP();
$claveRL = 'rl_alta_' . md5($ip);
$ahora   = time();

if (!isset($_SESSION[$claveRL])) {
    $_SESSION[$claveRL] = ['count' => 0, 'desde' => $ahora];
}

// Resetear ventana si pasó 1 minuto
if ($ahora - $_SESSION[$claveRL]['desde'] > 60) {
    $_SESSION[$claveRL] = ['count' => 0, 'desde' => $ahora];
}

$_SESSION[$claveRL]['count']++;

if ($_SESSION[$claveRL]['count'] > 20) {
    http_response_code(429);
    header("Retry-After: 60");
    error_log("SECURITY: Rate limit alta_alumno | IP: $ip");
    exit(json_encode(["error" => "Demasiadas solicitudes. Espera 1 minuto."]));
}

// FIX 1: Validar token CSRF (mismo mecanismo que upload_alumnos)
$tokenRecibido = $_POST['csrf_token'] ?? '';
if (empty($tokenRecibido) || empty($_SESSION['csrf_token'])) {
    http_response_code(403);
    error_log("SECURITY: CSRF token ausente en alta_alumno | IP: $ip");
    exit(json_encode(["error" => "Token de seguridad inválido"]));
}
// Expiración de 10 minutos
if (time() - ($_SESSION['csrf_token_ts'] ?? 0) > 600) {
    unset($_SESSION['csrf_token'], $_SESSION['csrf_token_ts']);
    http_response_code(403);
    exit(json_encode(["error" => "Token de seguridad expirado. Recarga la página."]));
}
if (!hash_equals($_SESSION['csrf_token'], $tokenRecibido)) {
    http_response_code(403);
    error_log("SECURITY: CSRF inválido en alta_alumno | IP: $ip");
    exit(json_encode(["error" => "Token de seguridad inválido"]));
}
unset($_SESSION['csrf_token'], $_SESSION['csrf_token_ts']); // One-time use

require_once "../config/conexion.php";

// Leer, limpiar null bytes y hacer trim
$nocontrol = limpiarCampo(trim($_POST['NoControl'] ?? ''));
$nombre    = limpiarCampo(trim($_POST['Nombre']    ?? ''));
$email     = strtolower(limpiarCampo(trim($_POST['Email']  ?? '')));
$grupo     = limpiarCampo(trim($_POST['Grupo']    ?? ''));
$periodo   = limpiarCampo(trim($_POST['Periodo']  ?? ''));

// Validar campos vacíos
if (empty($nocontrol) || empty($nombre) || empty($email) || empty($grupo) || empty($periodo)) {
    http_response_code(400);
    exit(json_encode(["error" => "Todos los campos son obligatorios"]));
}

// Validar longitudes máximas
$limites = [
    'NoControl' => [$nocontrol, 15],
    'Nombre'    => [$nombre,    100],
    'Email'     => [$email,     100],
    'Grupo'     => [$grupo,     10],
    'Periodo'   => [$periodo,   10],
];
foreach ($limites as $campo => [$valor, $max]) {
    if (mb_strlen($valor) > $max) {
        http_response_code(400);
        exit(json_encode(["error" => "El campo $campo excede la longitud máxima"]));
    }
}

// Validar formato nocontrol
if (!preg_match('/^[A-Za-z]?[0-9]{2,10}$/', $nocontrol)) {
    http_response_code(400);
    exit(json_encode(["error" => "Formato de No. Control inválido"]));
}

// Validar email
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    exit(json_encode(["error" => "Correo electrónico inválido"]));
}

// FIX 5: Validar dominio institucional (ajusta según tu institución)
// Descomenta si quieres restringir solo a correos institucionales:
// $dominioValido = 'lcardenas.tecnm.mx';
// if (!str_ends_with($email, '@' . $dominioValido)) {
//     http_response_code(400);
//     exit(json_encode(["error" => "Solo se aceptan correos del dominio @$dominioValido"]));
// }

// CSV Injection: rechazar campos que empiecen con caracteres de fórmula
foreach (['nombre' => $nombre, 'grupo' => $grupo, 'periodo' => $periodo] as $campo => $val) {
    if (preg_match('/^[=+\-@\t\r|]/', $val)) {
        http_response_code(400);
        exit(json_encode(["error" => "El campo $campo contiene caracteres no permitidos"]));
    }
}

try {
    // Verificar duplicados explícitamente (FIX 7: no depender del mensaje de excepción)
    $checkNC = $conexion->prepare("SELECT 1 FROM alumnos WHERE nocontrol = :nc AND grupo = :grupo AND periodo = :periodo LIMIT 1");
    $checkNC->execute([':nc' => $nocontrol, ':grupo' => $grupo, ':periodo' => $periodo]);
    if ($checkNC->fetchColumn()) {
        http_response_code(409);
        exit(json_encode(["error" => "El número de control ya está registrado en este grupo y periodo"]));
    }

    $checkEM = $conexion->prepare("SELECT 1 FROM alumnos WHERE email = :email AND grupo = :grupo AND periodo = :periodo LIMIT 1");
    $checkEM->execute([':email' => $email, ':grupo' => $grupo, ':periodo' => $periodo]);
    if ($checkEM->fetchColumn()) {
        http_response_code(409);
        exit(json_encode(["error" => "El correo electrónico ya está registrado en este grupo y periodo"]));
    }

    $sql = "INSERT INTO alumnos (nocontrol, nombre, email, grupo, periodo)
            VALUES (:nocontrol, :nombre, :email, :grupo, :periodo)";

    $stmt = $conexion->prepare($sql);

    // Audit log estructurado (sin datos personales sensibles más allá del nocontrol)
    error_log(json_encode([
        "evento"    => "alta_alumno_intento",
        "nocontrol" => $nocontrol,
        "ip"        => $ip,
        "ts"        => date('c')
    ]));

    $stmt->execute([
        ':nocontrol' => $nocontrol,
        ':nombre'    => $nombre,
        ':email'     => $email,
        ':grupo'     => $grupo,
        ':periodo'   => $periodo,
    ]);

    error_log(json_encode([
        "evento"    => "alta_alumno_ok",
        "nocontrol" => $nocontrol,
        "ip"        => $ip,
        "ts"        => date('c')
    ]));

    echo json_encode(["status" => "ok", "mensaje" => "Alumno registrado exitosamente"]);

} catch (PDOException $e) {
    error_log(json_encode([
        "evento"    => "alta_alumno_error_sql",
        "nocontrol" => $nocontrol,
        "ip"        => $ip,
        "sqlstate"  => $e->getCode(),
        "ts"        => date('c')
    ]));

    $codigo = $e->getCode();
    if ($codigo == 23505) {
        http_response_code(409);
        echo json_encode(["error" => "El registro ya existe (número de control o email duplicado)"]);
    } elseif ($codigo == 23514) {
        http_response_code(400);
        echo json_encode(["error" => "Los datos no cumplen el formato requerido"]);
    } else {
        http_response_code(500);
        echo json_encode(["error" => "No se pudo procesar la solicitud"]);
    }
}
?>
