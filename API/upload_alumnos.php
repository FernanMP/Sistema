<?php

header("Content-Type: application/json; charset=UTF-8");
header("X-Content-Type-Options: nosniff");
header("X-Frame-Options: DENY");
header("Referrer-Policy: no-referrer");
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

error_log("=== INICIO UPLOAD ===");

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit(json_encode(["error" => "Método no permitido"]));
}

// FIX 1: IP sin spoofing
function obtenerIP(): string {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'IP_DESCONOCIDA';
    return filter_var($ip, FILTER_VALIDATE_IP) ? $ip : 'IP_INVALIDA';
}

// FIX 5: Limpiar null bytes y chars de control
function limpiarCampo(string $valor): string {
    return preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $valor);
}

$ip = obtenerIP();

session_set_cookie_params([
    'lifetime' => 0, 'path' => '/', 'secure' => false,
    'httponly' => true, 'samesite' => 'Strict',
]);
session_start();

// FIX 3: Rate limiting (máx 5 uploads por minuto)
$claveRL = 'rl_upload_' . md5($ip);
$ahora   = time();
if (!isset($_SESSION[$claveRL])) {
    $_SESSION[$claveRL] = ['count' => 0, 'desde' => $ahora];
}
if ($ahora - $_SESSION[$claveRL]['desde'] > 60) {
    $_SESSION[$claveRL] = ['count' => 0, 'desde' => $ahora];
}
$_SESSION[$claveRL]['count']++;
if ($_SESSION[$claveRL]['count'] > 5) {
    http_response_code(429);
    header("Retry-After: 60");
    error_log("SECURITY: Rate limit upload_alumnos | IP: $ip");
    exit(json_encode(["error" => "Demasiadas solicitudes. Espera 1 minuto."]));
}

// FIX 2: CSRF con expiración de 10 minutos
$tokenRecibido = $_POST['csrf_token'] ?? '';

if (empty($tokenRecibido) || empty($_SESSION['csrf_token'])) {
    error_log("SECURITY: CSRF token ausente | IP: $ip");
    http_response_code(403);
    exit(json_encode(["error" => "Token de seguridad inválido"]));
}

if (time() - ($_SESSION['csrf_token_ts'] ?? 0) > 600) {
    unset($_SESSION['csrf_token'], $_SESSION['csrf_token_ts']);
    http_response_code(403);
    exit(json_encode(["error" => "Token de seguridad expirado. Recarga la página."]));
}

if (!hash_equals($_SESSION['csrf_token'], $tokenRecibido)) {
    error_log("SECURITY: CSRF token inválido | IP: $ip");
    http_response_code(403);
    exit(json_encode(["error" => "Token de seguridad inválido"]));
}

unset($_SESSION['csrf_token'], $_SESSION['csrf_token_ts']);

// ============================================================
// VALIDACIÓN DE ARCHIVO
// ============================================================
if (!isset($_FILES['archivo']) || $_FILES['archivo']['error'] !== UPLOAD_ERR_OK) {
    $codigoError = $_FILES['archivo']['error'] ?? 'sin archivo';
    error_log("ERROR: No se recibió archivo válido | código: $codigoError | IP: $ip");
    http_response_code(400);
    exit(json_encode(["error" => "No se recibió ningún archivo válido"]));
}

$archivo = $_FILES['archivo'];

if ($archivo['size'] > 2 * 1024 * 1024) {
    http_response_code(400);
    exit(json_encode(["error" => "El archivo excede el límite de 2 MB"]));
}

$extension = strtolower(pathinfo($archivo['name'], PATHINFO_EXTENSION));
if ($extension !== 'txt') {
    http_response_code(400);
    exit(json_encode(["error" => "Solo se permiten archivos .txt"]));
}

$finfo = new finfo(FILEINFO_MIME_TYPE);
$mimeReal = $finfo->file($archivo['tmp_name']);
$mimesPermitidos = ['text/plain', 'text/csv', 'application/octet-stream'];

if (!in_array($mimeReal, $mimesPermitidos, true)) {
    error_log("SECURITY: MIME inválido: $mimeReal | Archivo: {$archivo['name']} | IP: $ip");
    http_response_code(400);
    exit(json_encode(["error" => "El contenido del archivo no corresponde a texto plano"]));
}

// ============================================================
// LEER Y PARSEAR ARCHIVO
// ============================================================
$contenido = file_get_contents($archivo['tmp_name']);
if ($contenido === false) {
    http_response_code(500);
    exit(json_encode(["error" => "Error al leer el archivo"]));
}

// FIX 5: Eliminar null bytes del contenido completo
$contenido = str_replace("\0", "", $contenido);

// Normalizar saltos de línea
$contenido = str_replace(["\r\n", "\r"], "\n", $contenido);

$lineas = explode("\n", trim($contenido));
$lineas = array_values(array_filter($lineas, fn($l) => trim($l) !== ''));

if (count($lineas) < 2) {
    http_response_code(400);
    exit(json_encode(["error" => "El archivo debe tener encabezados y al menos un registro"]));
}

$MAX_REGISTROS = 50;
$totalLineasDatos = count($lineas) - 1;
if ($totalLineasDatos > $MAX_REGISTROS) {
    http_response_code(400);
    exit(json_encode([
        "error" => "El archivo excede el límite de $MAX_REGISTROS registros (contiene $totalLineasDatos)"
    ]));
}

$encabezados = array_map('strtolower', array_map('trim', str_getcsv($lineas[0])));
error_log("Encabezados: " . implode(", ", $encabezados));

$requeridas = ['username', 'firstname', 'email'];
$faltantes  = array_diff($requeridas, $encabezados);
if (!empty($faltantes)) {
    http_response_code(400);
    exit(json_encode([
        "error"        => "Faltan columnas: " . implode(", ", $faltantes),
        "tus_columnas" => $encabezados,
        "requeridas"   => $requeridas
    ]));
}

$idxUsername  = array_search('username',  $encabezados);
$idxFirstname = array_search('firstname', $encabezados);
$idxEmail     = array_search('email',     $encabezados);
$idxGrupo     = array_search('grupo',     $encabezados);
$idxPeriodo   = array_search('periodo',   $encabezados);

// ============================================================
// PROCESAR REGISTROS
// ============================================================
$alumnos = [];
$errores = [];

for ($i = 1; $i < count($lineas); $i++) {
    $linea = trim($lineas[$i]);
    if (empty($linea)) continue;

    $datos = str_getcsv($linea);

    $username  = limpiarCampo(trim($datos[$idxUsername] ?? ''));
    $nocontrol = preg_replace('/[^A-Za-z0-9]/', '', $username);

    if (empty($nocontrol) || !preg_match('/^[A-Za-z]?[0-9]{2,10}$/', $nocontrol)) {
        $errores[] = "Línea " . ($i + 1) . ": username inválido ('$username')";
        continue;
    }

    $nombre = limpiarCampo(trim($datos[$idxFirstname] ?? ''));
    if (empty($nombre) || mb_strlen($nombre) > 100) {
        $errores[] = "Línea " . ($i + 1) . ": nombre vacío o demasiado largo";
        continue;
    }

    // FIX 6: CSV Injection en nombre
    if (preg_match('/^[=+\-@\t\r|]/', $nombre)) {
        $errores[] = "Línea " . ($i + 1) . ": nombre contiene caracteres no permitidos";
        continue;
    }

    $email = strtolower(limpiarCampo(trim($datos[$idxEmail] ?? '')));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($email) > 100) {
        $errores[] = "Línea " . ($i + 1) . ": email inválido ('$email')";
        continue;
    }

    $grupo   = ($idxGrupo   !== false) ? limpiarCampo(trim($datos[$idxGrupo]   ?? '')) : '';
    $periodo = ($idxPeriodo !== false) ? limpiarCampo(trim($datos[$idxPeriodo] ?? '')) : '';

    if (empty($grupo))   $grupo   = limpiarCampo(trim($_POST['grupo_default']   ?? ''));
    if (empty($periodo)) $periodo = limpiarCampo(trim($_POST['periodo_default'] ?? ''));
    $materia = limpiarCampo(trim($_POST['materia_default'] ?? 'Sin asignar'));

    if (empty($grupo)) {
        $errores[] = "Línea " . ($i + 1) . ": grupo vacío";
        continue;
    }
    if (empty($periodo)) {
        $errores[] = "Línea " . ($i + 1) . ": periodo vacío";
        continue;
    }
    if (empty($materia)) {
        $errores[] = "Línea " . ($i + 1) . ": materia vacía";
        continue;
    }
    if (mb_strlen($grupo) > 10 || mb_strlen($periodo) > 10 || mb_strlen($materia) > 100) {
        $errores[] = "Línea " . ($i + 1) . ": grupo, periodo o materia demasiado largo";
        continue;
    }

    // FIX 6: CSV Injection en grupo, periodo y materia
    if (preg_match('/^[=+\-@\t\r|]/', $grupo) || preg_match('/^[=+\-@\t\r|]/', $periodo) || preg_match('/^[=+\-@\t\r|]/', $materia)) {
        $errores[] = "Línea " . ($i + 1) . ": grupo, periodo o materia contiene caracteres no permitidos";
        continue;
    }

    $alumnos[] = compact('nocontrol', 'nombre', 'email', 'grupo', 'periodo', 'materia');
}

if (!empty($errores)) {
    http_response_code(400);
    exit(json_encode([
        "status"  => "error",
        "message" => "Errores en el archivo. Ningún registro fue insertado.",
        "errores" => $errores
    ]));
}

if (empty($alumnos)) {
    http_response_code(400);
    exit(json_encode(["status" => "error", "message" => "No hay registros válidos en el archivo"]));
}

error_log(json_encode([
    "evento"    => "carga_masiva_inicio",
    "registros" => count($alumnos),
    "ip"        => $ip,
    "ts"        => date('c')
]));

require_once "../config/conexion.php";

// ============================================================
// FIX 4: INSERTAR EN TRANSACCIÓN ATÓMICA
// ============================================================
try {
    $insertados = 0;
    $duplicados = 0;
    $fallidos   = [];

    $stmtChkNC = $conexion->prepare(
        "SELECT 1 FROM alumnos WHERE nocontrol = :nocontrol AND materia = :materia AND grupo = :grupo AND periodo = :periodo LIMIT 1"
    );
    $stmtChkEM = $conexion->prepare(
        "SELECT 1 FROM alumnos WHERE email = :email AND materia = :materia AND grupo = :grupo AND periodo = :periodo LIMIT 1"
    );
    $stmtIns = $conexion->prepare(
        "INSERT INTO alumnos (nocontrol, nombre, email, grupo, periodo, materia)
         VALUES (:nocontrol, :nombre, :email, :grupo, :periodo, :materia)"
    );

    // FIX 4: Transacción — o todo o nada
    $conexion->beginTransaction();

    foreach ($alumnos as $alumno) {
        try {
            // FIX 8: Verificar duplicados explícitamente en el mismo contexto (materia/grupo/periodo)
            $stmtChkNC->execute([
                ':nocontrol' => $alumno['nocontrol'],
                ':materia'   => $alumno['materia'],
                ':grupo'     => $alumno['grupo'],
                ':periodo'   => $alumno['periodo']
            ]);
            if ($stmtChkNC->fetchColumn()) {
                $duplicados++;
                $fallidos[] = "N/C {$alumno['nocontrol']}: ya registrado en esta materia";
                continue;
            }

            $stmtChkEM->execute([
                ':email'   => $alumno['email'],
                ':materia' => $alumno['materia'],
                ':grupo'   => $alumno['grupo'],
                ':periodo' => $alumno['periodo']
            ]);
            if ($stmtChkEM->fetchColumn()) {
                $duplicados++;
                $fallidos[] = "N/C {$alumno['nocontrol']}: email ya registrado en esta materia";
                continue;
            }

            $stmtIns->execute([
                ':nocontrol' => $alumno['nocontrol'],
                ':nombre'    => $alumno['nombre'],
                ':email'     => $alumno['email'],
                ':grupo'     => $alumno['grupo'],
                ':periodo'   => $alumno['periodo'],
                ':materia'   => $alumno['materia'],
            ]);
            $insertados++;

        } catch (PDOException $e) {
            // Errores inesperados de BD durante el loop
            error_log(json_encode([
                "evento"   => "upload_insert_error",
                "nc"       => $alumno['nocontrol'],
                "sqlstate" => $e->getCode(),
                "ts"       => date('c')
            ]));
            $fallidos[] = "N/C {$alumno['nocontrol']}: error al insertar";
        }
    }

    $conexion->commit(); // FIX 4: Confirmar todos los cambios atómicamente

    error_log(json_encode([
        "evento"     => "carga_masiva_ok",
        "insertados" => $insertados,
        "duplicados" => $duplicados,
        "ip"         => $ip,
        "ts"         => date('c')
    ]));

    echo json_encode([
        "status"     => "success",
        "message"    => "Archivo procesado correctamente",
        "insertados" => $insertados,
        "duplicados" => $duplicados,
        "fallidos"   => $fallidos,
        "preview"    => array_map(fn($a) => [
            'nocontrol' => $a['nocontrol'],
            'nombre'    => $a['nombre'],
            'email'     => $a['email'],
        ], array_slice($alumnos, 0, 5))
    ]);

} catch (Exception $e) {
    if ($conexion->inTransaction()) {
        $conexion->rollBack(); // FIX 4: Revertir si algo falló
    }
    error_log(json_encode([
        "evento" => "carga_masiva_error_general",
        "msg"    => $e->getMessage(),
        "ip"     => $ip,
        "ts"     => date('c')
    ]));
    http_response_code(500);
    echo json_encode(["error" => "Error al procesar la carga"]);
}
?>
