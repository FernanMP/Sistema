<?php

$host = getenv('DB_HOST') ?: 'localhost';
$db = getenv('DB_NAME') ?: 'ara';
$user = getenv('DB_USER') ?: 'postgres';
$pass = getenv('DB_PASS') ?: '';
$port = getenv('DB_PORT') ?: '5432';
$env = getenv('APP_ENV') ?: 'development';

$options = [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
];

try {
    $conexion = new PDO(
        "pgsql:host=$host;port=$port;dbname=$db;options='--client_encoding=UTF8'",
        $user,
        $pass,
        $options
    );
    error_log("INFO: Conexión PostgreSQL establecida | BD: $db");
} catch (PDOException $e) {
    error_log("CRITICAL: Falla de conexión PostgreSQL: " . $e->getMessage());
    http_response_code(500);
    $mensaje = ($env === 'development')
        ? "Error de conexión BD: " . $e->getMessage()
        : "Error interno del servidor";
    die(json_encode(["error" => $mensaje]));
}
?>