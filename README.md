# Sistema Escolar ITLAC

Sistema web para la gestión de alumnos, pase de lista, horarios y carga masiva, desarrollado como parte de las actividades de "Desarrollo de Software Seguro".

## Requisitos Previos

Para ejecutar este proyecto en tu entorno local, necesitas tener instalado:
1. Un servidor web con soporte para PHP (como **XAMPP**, **WAMP**, **MAMP** o **Laragon**).
2. **PostgreSQL** (versión 12 o superior) instalado y corriendo.

## Instrucciones de Instalación

### 1. Clonar el repositorio
Clona este repositorio dentro de la carpeta pública de tu servidor web (por ejemplo, `htdocs` en XAMPP o `www` en WAMP).
```bash
git clone <URL_DEL_REPOSITORIO>
```

### 2. Configurar la Base de Datos
1. Abre tu gestor de base de datos PostgreSQL (como pgAdmin o DBeaver).
2. Crea una nueva base de datos (por ejemplo, con el nombre `ara`).
3. Importa el archivo SQL que viene incluido en el proyecto para crear las tablas necesarias:
   - Ruta del archivo: `sql/ara.sql`

### 3. Configurar la Conexión en PHP
1. Ve a la carpeta `config/` dentro del proyecto.
2. Abre el archivo `conexion.php`.
3. Verifica que las credenciales coincidan con las de tu servidor local de PostgreSQL (host, puerto, usuario, contraseña y nombre de la base de datos).

### 4. Ejecutar el proyecto
1. Enciende los servicios de Apache (o Nginx) en tu servidor local (XAMPP/WAMP).
2. Abre tu navegador web y dirígete a: `http://localhost/Ara` (ajusta la ruta dependiendo del nombre de la carpeta donde clonaste el proyecto).

## Estructura Principal
- `/API/` - Contiene todos los endpoints y lógica del backend en PHP (altas, cargas masivas, etc.).
- `/public/` - Contiene el frontend (HTML, CSS, JS) y las interfaces de usuario.
- `/sql/` - Contiene el respaldo de la base de datos en PostgreSQL.
- `/config/` - Archivos de configuración y conexión a la base de datos.
