
let csrfToken = '';

// FIX 1: Obtener token CSRF al cargar la página
async function obtenerCSRF() {
    try {
        const resp  = await fetch('../API/csrf_token.php');
        const datos = await resp.json();
        csrfToken = datos.csrf_token;
    } catch (err) {
        console.error("No se pudo obtener el token de seguridad:", err.message);
        mostrarMensaje("Error de seguridad. Recarga la página.", "#dc2626");
        document.querySelector("button[type='submit']").disabled = true;
    }
}

document.addEventListener('DOMContentLoaded', obtenerCSRF);

document.getElementById("formAlumno").addEventListener("submit", async function (e) {
    e.preventDefault();

    if (!csrfToken) {
        mostrarMensaje("Token de seguridad no disponible. Recarga la página.", "#dc2626");
        return;
    }

    const btn = this.querySelector("button[type='submit']");
    const textoOriginal = btn.textContent;
    btn.textContent = "Registrando...";
    btn.disabled = true;

    const datos = new FormData(this);
    // FIX 2: Incluir CSRF token en el FormData
    datos.append('csrf_token', csrfToken);

    try {
        const response = await fetch("../API/alta_alumno.php", {
            method: "POST",
            body: datos
        });

        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch {
            throw new Error("El servidor devolvió una respuesta inesperada");
        }

        if (data.status === "ok") {
            mostrarMensaje("✓ " + data.mensaje, "#16a34a");
            this.reset();
            // FIX 3: Renovar token para la siguiente operación
            await obtenerCSRF();
        } else {
            mostrarMensaje("✗ " + (data.error || "Error desconocido"), "#dc2626");
            // Si el token expiró, renovar
            if (response.status === 403) await obtenerCSRF();
        }
    } catch (error) {
        console.error("Error de comunicación:", error.message);
        mostrarMensaje("Error de comunicación con el sistema.", "#dc2626");
    } finally {
        btn.textContent = textoOriginal;
        btn.disabled = false;
    }
});

function mostrarMensaje(texto, color) {
    const msg = document.getElementById("respuesta");
    // Usar textContent siempre — nunca innerHTML con datos del servidor
    msg.style.color = color;
    msg.textContent = texto;
}
