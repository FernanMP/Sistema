document.addEventListener('DOMContentLoaded', function () {

    const dropZone          = document.getElementById('dropZone');
    const fileInput         = document.getElementById('fileInput');
    const dropLabel         = document.getElementById('dropLabel');
    const fileInfo          = document.getElementById('fileInfo');
    const btnUpload         = document.getElementById('btnUpload');
    const progressContainer = document.getElementById('progressContainer');
    const previewContainer  = document.getElementById('previewContainer');
    const jsonPreview       = document.getElementById('jsonPreview');
    const resultado         = document.getElementById('resultado');
    const togglePreview     = document.getElementById('togglePreview');
    const downloadTemplate  = document.getElementById('downloadTemplate');

    // CSRF: se pide en segundo plano, NO bloquea la UI
    async function obtenerCSRF() {
        try {
            const resp  = await fetch('../API/csrf_token.php');
            const datos = await resp.json();
            const campo = document.getElementById('csrf_token');
            if (campo) campo.value = datos.csrf_token;
        } catch (err) {
            console.warn("CSRF token no disponible:", err.message);
        }
    }
    obtenerCSRF(); // sin await — no bloquea nada

    // ============================================================
    // Cargar Horarios y Materias (Igual que en Pase de Lista)
    // ============================================================
    const selHorario = document.getElementById('sel-horario');
    const selMateria = document.getElementById('sel-materia');
    const inpGrupoDef = document.getElementById('grupo_default');
    const inpMateriaDef = document.getElementById('materia_default');
    const inpPeriodoDef = document.getElementById('periodo_default');
    let horariosGuardados = [];

    try {
        horariosGuardados = JSON.parse(localStorage.getItem('horarios_guardados') || '[]');
        if (horariosGuardados.length > 0) {
            horariosGuardados.forEach(h => {
                const opt = document.createElement('option');
                opt.value = h.id;
                opt.textContent = h.name;
                selHorario.appendChild(opt);
            });
        } else {
            selHorario.innerHTML = '<option value="">No hay horarios guardados</option>';
            selHorario.disabled = true;
        }
    } catch(e) {}

    selHorario.addEventListener('change', () => {
        selMateria.innerHTML = '<option value="">-- Selecciona Materia --</option>';
        inpGrupoDef.value = '';
        inpMateriaDef.value = '';
        
        if (!selHorario.value) {
            selMateria.disabled = true;
            return;
        }
        
        const h = horariosGuardados.find(x => String(x.id) === String(selHorario.value));
        if (h && h.data) {
            selMateria.disabled = false;
            h.data.forEach((mat, idx) => {
                const opt = document.createElement('option');
                opt.value = idx;
                opt.textContent = (mat.materia || 'Sin nombre') + ' (G: ' + (mat.grupo || 'N/A') + ')';
                opt.dataset.grupo = mat.grupo || '';
                selMateria.appendChild(opt);
            });
        }
    });

    selMateria.addEventListener('change', () => {
        if (selMateria.value === '') {
            inpGrupoDef.value = '';
            inpMateriaDef.value = '';
        } else {
            const selectedOpt = selMateria.options[selMateria.selectedIndex];
            inpGrupoDef.value = selectedOpt.dataset.grupo || '';
            // Guardar el nombre de la materia (sin el grupo que viene en el textContent)
            inpMateriaDef.value = selectedOpt.textContent.split(' (G:')[0] || '';
        }
    });

    // ============================================================
    // Click en la zona / Drag & Drop
    // ============================================================
    dropZone.addEventListener('click', function () {
        fileInput.click();
    });

    dropZone.addEventListener('dragover', function (e) {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', function () {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', function (e) {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length) {
            fileInput.files = e.dataTransfer.files;
            manejarArchivoSeleccionado(e.dataTransfer.files[0]);
        }
    });

    fileInput.addEventListener('change', function () {
        if (fileInput.files.length) {
            manejarArchivoSeleccionado(fileInput.files[0]);
        }
    });

    // ============================================================
    // Validar archivo seleccionado
    // ============================================================
    function manejarArchivoSeleccionado(archivo) {
        if (archivo.size > 2 * 1024 * 1024) {
            mostrarError('El archivo excede el límite de 2 MB');
            fileInput.value    = '';
            btnUpload.disabled = true;
            return;
        }

        if (!archivo.name.toLowerCase().endsWith('.txt')) {
            mostrarError('Solo se permiten archivos .txt');
            fileInput.value    = '';
            btnUpload.disabled = true;
            return;
        }

        const tamañoKB = (archivo.size / 1024).toFixed(1);
        fileInfo.textContent           = '📎 ' + archivo.name + ' (' + tamañoKB + ' KB)';
        fileInfo.style.display         = 'flex';
        dropLabel.textContent          = archivo.name;
        btnUpload.disabled             = false;
        resultado.innerHTML            = '';
        previewContainer.style.display = 'none';
    }

    // ============================================================
    // Envío
    // ============================================================
    document.getElementById('uploadForm').addEventListener('submit', async function (e) {
        e.preventDefault();

        if (!fileInput.files.length) return;
        
        if (!inpGrupoDef.value) {
            mostrarError('Por favor, selecciona un Horario y una Materia para asignar a los alumnos.');
            return;
        }
        if (!inpPeriodoDef.value.trim()) {
            mostrarError('Por favor, ingresa el Periodo Escolar (ej. 2026-1).');
            return;
        }

        btnUpload.disabled              = true;
        progressContainer.style.display = 'block';
        resultado.innerHTML             = '';

        const formData = new FormData(this);
        // El grupo_default y periodo_default ya van en el formData porque tienen atributo "name"

        try {
            const response = await fetch('../API/upload_alumnos.php', {
                method: 'POST',
                body: formData
            });

            const text = await response.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch {
                throw new Error('Respuesta del servidor inválida');
            }

            progressContainer.style.display = 'none';

            if (data.status === 'success') {
                mostrarResultadosExito(data);

                if (data.preview && data.preview.length) {
                    jsonPreview.textContent        = JSON.stringify(data.preview, null, 2);
                    previewContainer.style.display = 'block';
                }

                fileInput.value        = '';
                fileInfo.style.display = 'none';
                dropLabel.textContent  = 'Arrastra tu archivo aquí o haz clic para seleccionar';
                obtenerCSRF();

            } else {
                mostrarResultadosError(data);
                if (response.status === 403) obtenerCSRF();
            }

        } catch (error) {
            progressContainer.style.display = 'none';
            mostrarError('Error de comunicación con el servidor: ' + error.message);
        } finally {
            btnUpload.disabled = false;
        }
    });

    // ============================================================
    // UI — sin innerHTML con datos del servidor (seguro contra XSS)
    // ============================================================
    function mostrarResultadosExito(data) {
        resultado.innerHTML = '';

        const div = document.createElement('div');
        div.className = 'resultado-exito';

        const titulo = document.createElement('p');
        titulo.style.cssText = 'color:#166534;font-weight:bold;margin-bottom:15px;';
        titulo.textContent = '✓ ' + (data.message || 'Archivo procesado exitosamente');
        div.appendChild(titulo);

        const stats = document.createElement('div');
        stats.className = 'resumen-stats';

        [
            { label: 'Insertados', val: data.insertados || 0,       cls: 'insertados' },
            { label: 'Duplicados', val: data.duplicados || 0,       cls: 'duplicados' },
            { label: 'Fallidos',   val: data.fallidos?.length || 0, cls: 'fallidos'   },
        ].forEach(function (item) {
            const el = document.createElement('div');
            el.className = 'stat-item ' + item.cls;
            const num = document.createElement('span');
            num.className   = 'stat-numero';
            num.textContent = String(item.val);
            el.appendChild(num);
            el.appendChild(document.createTextNode(item.label));
            stats.appendChild(el);
        });
        div.appendChild(stats);

        if (data.fallidos && data.fallidos.length > 0) {
            const lista = document.createElement('ul');
            lista.className = 'lista-fallidos';
            data.fallidos.forEach(function (fallo) {
                const li = document.createElement('li');
                li.textContent = fallo;
                lista.appendChild(li);
            });
            div.appendChild(lista);
        }

        resultado.appendChild(div);
    }

    function mostrarResultadosError(data) {
        resultado.innerHTML = '';

        const div = document.createElement('div');
        div.className = 'resultado-error';

        const titulo = document.createElement('p');
        titulo.style.cssText = 'color:#991b1b;font-weight:bold;margin-bottom:10px;';
        titulo.textContent = '✗ ' + (data.message || 'Error al procesar el archivo');
        div.appendChild(titulo);

        if (data.errores && data.errores.length > 0) {
            const lista = document.createElement('ul');
            lista.style.cssText = 'margin-top:10px;padding-left:20px;';
            data.errores.forEach(function (err) {
                const li = document.createElement('li');
                li.style.cssText = 'color:#991b1b;font-size:12px;margin-bottom:5px;';
                li.textContent   = err;
                lista.appendChild(li);
            });
            div.appendChild(lista);
        }

        resultado.appendChild(div);
    }

    function mostrarError(mensaje) {
        resultado.innerHTML = '';
        const div = document.createElement('div');
        div.className = 'resultado-error';
        const p = document.createElement('p');
        p.style.cssText = 'color:#991b1b;font-weight:bold;';
        p.textContent   = '✗ ' + mensaje;
        div.appendChild(p);
        resultado.appendChild(div);
    }

    // Toggle vista previa
    togglePreview.addEventListener('click', function () {
        const oculto = jsonPreview.style.display === 'none';
        jsonPreview.style.display = oculto ? 'block' : 'none';
        togglePreview.textContent = oculto ? '▼' : '▶';
    });

    // Plantilla descargable
    downloadTemplate.addEventListener('click', function (e) {
        e.preventDefault();
        const contenido = [
            'username,firstname,email',
            'u200000,JUAN PEREZ,itlac200000@lcardenas.tecnm.mx',
            'u200001,MARIA LOPEZ,itlac200001@lcardenas.tecnm.mx',
            'u200002,CARLOS RAMIREZ,itlac200002@lcardenas.tecnm.mx',
            'u200003,ANA TORRES,itlac200003@lcardenas.tecnm.mx',
            'u200004,LUIS FERNANDO,itlac200004@lcardenas.tecnm.mx'
        ].join('\n');

        const blob = new Blob([contenido], { type: 'text/plain;charset=utf-8' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = 'plantilla_alumnos.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
});