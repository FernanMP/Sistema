
let csrfToken = '';

async function obtenerCSRF() {
    try {
        const resp  = await fetch('../API/csrf_token.php');
        const datos = await resp.json();
        csrfToken = datos.csrf_token;
    } catch (err) {
        console.error("No se pudo obtener token de seguridad:", err.message);
        mostrarMensaje("Error de seguridad. Recarga la página.", "#dc2626");
        document.querySelector("button[type='submit']").disabled = true;
    }
}

document.addEventListener('DOMContentLoaded', obtenerCSRF);

document.getElementById("formAlumnoPassword").addEventListener("submit", async function (e) {
    e.preventDefault();

    const password  = document.getElementById("password").value;
    const confirmar = document.getElementById("confirmar").value;

    if (password !== confirmar) {
        mostrarMensaje("✗ Las contraseñas no coinciden", "#dc2626");
        return;
    }
    if (password.length < 8) {
        mostrarMensaje("✗ La contraseña debe tener al menos 8 caracteres", "#dc2626");
        return;
    }
    if (password.length > 72) {
        mostrarMensaje("✗ La contraseña no puede superar 72 caracteres", "#dc2626");
        return;
    }
    if (!csrfToken) {
        mostrarMensaje("✗ Token de seguridad no disponible. Recarga la página.", "#dc2626");
        return;
    }

    const btnSubmit     = document.querySelector("button[type='submit']");
    const textoOriginal = btnSubmit.textContent;
    btnSubmit.textContent = "Registrando...";
    btnSubmit.disabled    = true;

    const datos = new FormData(this);
    // FIX 2: CSRF token incluido
    datos.append('csrf_token', csrfToken);

    try {
        const response = await fetch("../API/alta_con_password.php", {
            method: "POST",
            body: datos
        });

        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch {
            throw new Error("Respuesta del servidor inválida");
        }

        if (data.status === "ok") {
            // FIX 3: textContent — nunca innerHTML con datos externos
            mostrarMensaje("✓ " + data.mensaje, "#16a34a");
            this.reset();
            actualizarBarraFortaleza(0);
            // FIX 4: Renovar token
            await obtenerCSRF();
        } else {
            mostrarMensaje("✗ " + (data.error || "Error desconocido"), "#dc2626");
            if (response.status === 403) await obtenerCSRF();
        }
    } catch (error) {
        console.error("Error de comunicación:", error.message);
        mostrarMensaje("✗ Error de comunicación con el sistema", "#dc2626");
    } finally {
        btnSubmit.textContent = textoOriginal;
        btnSubmit.disabled    = false;
    }
});

// ============================================================
// Helpers
// ============================================================
function mostrarMensaje(texto, color) {
    const msg = document.getElementById("respuesta");
    msg.style.color = color;
    // FIX 3: textContent es siempre seguro — nunca interpretar HTML del servidor
    msg.textContent = texto;
}

document.getElementById("togglePassword").addEventListener("click", function () {
    const input = document.getElementById("password");
    const esPassword = input.getAttribute("type") === "password";
    input.setAttribute("type", esPassword ? "text" : "password");
    this.textContent = esPassword ? "🔓" : "🔒";
});

document.getElementById("password").addEventListener("input", function () {
    const password = this.value;

    let fortaleza = 0;
    if (password.length >= 8)              fortaleza++;
    if (password.length >= 12)             fortaleza++;
    if (/[A-Z]/.test(password))           fortaleza++;
    if (/[0-9]/.test(password))           fortaleza++;
    if (/[^A-Za-z0-9]/.test(password))   fortaleza++;

    actualizarBarraFortaleza(fortaleza);
});

function actualizarBarraFortaleza(fortaleza) {
    const barra = document.querySelector(".strength-bar");
    if (!barra) return;
    barra.className = "strength-bar";
    if (fortaleza === 0)         return;
    if (fortaleza <= 2)          barra.classList.add("weak");
    else if (fortaleza <= 3)     barra.classList.add("medium");
    else                         barra.classList.add("strong");
}

document.getElementById("confirmar").addEventListener("input", function () {
    const password  = document.getElementById("password").value;
    const confirmar = this.value;

    if (confirmar && password !== confirmar) {
        this.style.borderColor = "#dc2626";
    } else if (confirmar && password === confirmar) {
        this.style.borderColor = "#10b981";
    } else {
        this.style.borderColor = "#e5e7eb";
    }
});
