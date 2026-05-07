document.getElementById("formLogin").addEventListener("submit", function (e) {
    e.preventDefault();

    const nocontrol = document.getElementById("nocontrol").value.trim();
    const password  = document.getElementById("password").value;
    const msg       = document.getElementById("respuesta");
    const btn       = document.getElementById("btnLogin");

    // Limpiar estado anterior
    msg.textContent = "";
    document.getElementById("nocontrol").classList.remove("campo-error");
    document.getElementById("password").classList.remove("campo-error");

    // Validaciones cliente
    if (!nocontrol) {
        marcarError("nocontrol", "El número de control es obligatorio");
        return;
    }

    if (!/^[A-Za-z]?[0-9]{2,10}$/.test(nocontrol)) {
        marcarError("nocontrol", "Formato inválido (ej: A001, u200000)");
        return;
    }

    if (!password) {
        marcarError("password", "La contraseña es obligatoria");
        return;
    }

    if (password.length < 8) {
        marcarError("password", "La contraseña debe tener al menos 8 caracteres");
        return;
    }

    // Bloquear botón mientras espera respuesta
    const textoOriginal = btn.textContent;
    btn.textContent  = "Verificando...";
    btn.disabled     = true;

    const datos = new FormData();
    datos.append("nocontrol", nocontrol);
    datos.append("password",  password);

    fetch("../API/login.php", {
        method: "POST",
        body: datos
    })
    .then(async function (response) {
        const text = await response.text();
        try {
            return { status: response.status, data: JSON.parse(text) };
        } catch {
            throw new Error("Respuesta del servidor inválida");
        }
    })
    .then(function ({ status, data }) {

        if (data.status === "ok") {
            // Login exitoso
            mostrarMensaje("✓ " + data.mensaje, "#16a34a");

            // Redirigir tras 1.2 segundos (puedes cambiar la URL destino)
            setTimeout(function () {
                window.location.href = data.redirect || "../index.html";
            }, 1200);

        } else if (status === 429) {
            // Demasiados intentos
            document.getElementById("alertBloqueado").style.display = "block";
            mostrarMensaje("", "");

        } else {
            // Credenciales incorrectas u otro error
            mostrarMensaje("✗ " + (data.error || "Credenciales incorrectas"), "#dc2626");
            document.getElementById("password").value = "";
            document.getElementById("password").focus();
        }
    })
    .catch(function (error) {
        console.error("Error de comunicación:", error.message);
        mostrarMensaje("✗ Error de comunicación con el sistema", "#dc2626");
    })
    .finally(function () {
        btn.textContent = textoOriginal;
        btn.disabled    = false;
    });
});

// ============================================================
// Helpers
// ============================================================

function mostrarMensaje(texto, color) {
    const msg = document.getElementById("respuesta");
    msg.style.color   = color;
    msg.style.marginTop = "15px";
    msg.style.textAlign = "center";
    msg.style.fontSize  = "14px";
    msg.style.fontWeight = "500";
    msg.textContent = texto;
}

function marcarError(campoId, mensaje) {
    const campo = document.getElementById(campoId);
    campo.classList.add("campo-error");
    campo.focus();
    mostrarMensaje("✗ " + mensaje, "#dc2626");
}

// Toggle mostrar/ocultar contraseña
document.getElementById("togglePassword").addEventListener("click", function () {
    const input     = document.getElementById("password");
    const esOculto  = input.type === "password";
    input.type      = esOculto ? "text" : "password";
    this.textContent = esOculto ? "🔓" : "🔒";
});

// Quitar error visual al escribir
["nocontrol", "password"].forEach(function (id) {
    document.getElementById(id).addEventListener("input", function () {
        this.classList.remove("campo-error");
        document.getElementById("respuesta").textContent = "";
        document.getElementById("alertBloqueado").style.display = "none";
    });
});