<?php

header("Content-Type: application/json; charset=UTF-8");
header("X-Content-Type-Options: nosniff");
header("X-Frame-Options: DENY");
header("Referrer-Policy: no-referrer");
header("Content-Security-Policy: default-src 'none'");
header("X-Permitted-Cross-Domain-Policies: none");
header("Permissions-Policy: camera=(), microphone=(), geolocation=()");
header("Cache-Control: no-store");

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

// FIX 2: IP sin posibilidad de spoofing
function obtenerIP(): string {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'IP_DESCONOCIDA';
    return filter_var($ip, FILTER_VALIDATE_IP) ? $ip : 'IP_INVALIDA';
}

// FIX 4: Limpiar null bytes y chars de control
function limpiarCampo(string $valor): string {
    return preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $valor);
}

session_set_cookie_params([
    'lifetime' => 0, 'path' => '/', 'secure' => false,
    'httponly' => true, 'samesite' => 'Strict',
]);
session_start();

$ip = obtenerIP();

// FIX 3: Rate limiting (máx 10 registros con password por minuto — más estricto)
$claveRL = 'rl_password_' . md5($ip);
$ahora   = time();
if (!isset($_SESSION[$claveRL])) {
    $_SESSION[$claveRL] = ['count' => 0, 'desde' => $ahora];
}
if ($ahora - $_SESSION[$claveRL]['desde'] > 60) {
    $_SESSION[$claveRL] = ['count' => 0, 'desde' => $ahora];
}
$_SESSION[$claveRL]['count']++;
if ($_SESSION[$claveRL]['count'] > 10) {
    http_response_code(429);
    header("Retry-After: 60");
    error_log("SECURITY: Rate limit alta_con_password | IP: $ip");
    exit(json_encode(["error" => "Demasiadas solicitudes. Espera 1 minuto."]));
}

// FIX 1: CSRF con expiración de 10 minutos
$tokenRecibido = $_POST['csrf_token'] ?? '';
if (empty($tokenRecibido) || empty($_SESSION['csrf_token'])) {
    http_response_code(403);
    exit(json_encode(["error" => "Token de seguridad inválido"]));
}
if (time() - ($_SESSION['csrf_token_ts'] ?? 0) > 600) {
    unset($_SESSION['csrf_token'], $_SESSION['csrf_token_ts']);
    http_response_code(403);
    exit(json_encode(["error" => "Token de seguridad expirado. Recarga la página."]));
}
if (!hash_equals($_SESSION['csrf_token'], $tokenRecibido)) {
    http_response_code(403);
    error_log("SECURITY: CSRF inválido en alta_con_password | IP: $ip");
    exit(json_encode(["error" => "Token de seguridad inválido"]));
}
unset($_SESSION['csrf_token'], $_SESSION['csrf_token_ts']);

require_once "../config/conexion.php";

// Leer y sanitizar — password SIN trim (espacios pueden ser intencionales)
$nocontrol = limpiarCampo(trim($_POST['nocontrol'] ?? ''));
$nombre    = limpiarCampo(trim($_POST['nombre']    ?? ''));
$email     = strtolower(limpiarCampo(trim($_POST['email'] ?? '')));
$grupo     = limpiarCampo(trim($_POST['grupo']    ?? ''));
$periodo   = limpiarCampo(trim($_POST['periodo']  ?? ''));
$password  = $_POST['password'] ?? ''; // Sin trim, sin limpiarCampo (es un campo especial)

// Validaciones
$errores = [];

if (empty($nocontrol))                                         $errores[] = "El No. Control es obligatorio";
elseif (!preg_match('/^[A-Za-z]?[0-9]{2,10}$/', $nocontrol)) $errores[] = "Formato de No. Control inválido";

if (empty($nombre))                                            $errores[] = "El nombre es obligatorio";
elseif (mb_strlen($nombre) > 100)                              $errores[] = "El nombre excede 100 caracteres";

if (empty($email))                                             $errores[] = "El email es obligatorio";
elseif (!filter_var($email, FILTER_VALIDATE_EMAIL))            $errores[] = "Email inválido";
elseif (mb_strlen($email) > 100)                               $errores[] = "El email excede 100 caracteres";

if (empty($grupo))                                             $errores[] = "El grupo es obligatorio";
elseif (mb_strlen($grupo) > 10)                                $errores[] = "El grupo excede 10 caracteres";

if (empty($periodo))                                           $errores[] = "El periodo es obligatorio";
elseif (mb_strlen($periodo) > 10)                              $errores[] = "El periodo excede 10 caracteres";

if (mb_strlen($nocontrol) > 15)                                $errores[] = "El No. Control excede 15 caracteres";

if (empty($password))                                          $errores[] = "La contraseña es obligatoria";
elseif (strlen($password) < 8)                                 $errores[] = "Mínimo 8 caracteres";
elseif (strlen($password) > 72)                                $errores[] = "Máximo 72 caracteres (límite bcrypt)";

// FIX 5: CSV Injection prevention
foreach (['nombre' => $nombre, 'grupo' => $grupo, 'periodo' => $periodo] as $campo => $val) {
    if (!empty($val) && preg_match('/^[=+\-@\t\r|]/', $val)) {
        $errores[] = "El campo $campo contiene caracteres no permitidos";
    }
}

if (!empty($errores)) {
    http_response_code(400);
    exit(json_encode(["error" => implode(". ", $errores)]));
}

try {
    // FIX 8: Verificar duplicados explícitamente con SELECT (no con str_contains en excepción)
    $checkNC = $conexion->prepare(
        "SELECT 1 FROM alumnos_con_password WHERE nocontrol = :nocontrol LIMIT 1"
    );
    $checkNC->execute([':nocontrol' => $nocontrol]);
    if ($checkNC->fetchColumn()) {
        http_response_code(409);
        exit(json_encode(["error" => "El número de control ya está registrado"]));
    }

    $checkEmail = $conexion->prepare(
        "SELECT 1 FROM alumnos_con_password WHERE email = :email LIMIT 1"
    );
    $checkEmail->execute([':email' => $email]);
    if ($checkEmail->fetchColumn()) {
        http_response_code(409);
        exit(json_encode(["error" => "El email ya está registrado"]));
    }

    // Bcrypt costo 12
    $passwordHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);
    if ($passwordHash === false) {
        throw new Exception("Fallo al generar hash de contraseña");
    }

    // FIX 6: Log estructurado JSON
    error_log(json_encode([
        "evento"    => "registro_password_intento",
        "nocontrol" => $nocontrol,
        "ip"        => $ip,
        "ts"        => date('c')
    ]));

    $sql = "INSERT INTO alumnos_con_password (nocontrol, nombre, email, grupo, periodo, password)
            VALUES (:nocontrol, :nombre, :email, :grupo, :periodo, :password)";

    $stmt = $conexion->prepare($sql);
    $stmt->execute([
        ':nocontrol' => $nocontrol,
        ':nombre'    => $nombre,
        ':email'     => $email,
        ':grupo'     => $grupo,
        ':periodo'   => $periodo,
        ':password'  => $passwordHash,
    ]);

    error_log(json_encode([
        "evento"    => "registro_password_ok",
        "nocontrol" => $nocontrol,
        "ip"        => $ip,
        "ts"        => date('c')
    ]));

    echo json_encode([
        "status"  => "ok",
        "mensaje" => "Alumno registrado exitosamente con contraseña segura"
    ]);

} catch (PDOException $e) {
    error_log(json_encode([
        "evento"   => "registro_password_error_sql",
        "sqlstate" => $e->getCode(),
        "ip"       => $ip,
        "ts"       => date('c')
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
} catch (Exception $e) {
    error_log(json_encode([
        "evento" => "registro_password_error_general",
        "msg"    => $e->getMessage(),
        "ip"     => $ip,
        "ts"     => date('c')
    ]));
    http_response_code(500);
    echo json_encode(["error" => "Error al procesar la solicitud"]);
}
?>
