/**
 * js_pase_lista.js
 * Pase de lista manual
 * Usa la tabla `alumnos` del sistema existente.
 */

'use strict';

// ── Estado global ──────────────────────────────────────────────
let alumnos      = [];      // [{nocontrol, nombre, grupo, periodo}]
let asistencia   = [];      // null | 'P' (Presente) | 'A' (Ausente) | 'J' (Justificado) por índice

// Alumnos dummy para demostración local sin base de datos
const dummyStudents = [
    { nocontrol: "20120101", nombre: "Aguilar Pérez Juan Carlos" },
    { nocontrol: "20120102", nombre: "Bautista Gómez María José" },
    { nocontrol: "20120103", nombre: "Castillo Herrera Luis Antonio" },
    { nocontrol: "20120104", nombre: "Díaz Morales Ana Sofía" },
    { nocontrol: "20120105", nombre: "Espinoza Ruiz Diego" },
    { nocontrol: "20120106", nombre: "Flores Martínez Valeria" },
    { nocontrol: "20120107", nombre: "García López Carlos Eduardo" },
    { nocontrol: "20120108", nombre: "Hernández Ramírez Laura" },
    { nocontrol: "20120109", nombre: "Jiménez Sánchez Miguel Ángel" },
    { nocontrol: "20120110", nombre: "López Fernández Diana" }
];

// ── Referencias al DOM ─────────────────────────────────────────
const btnCargar    = document.getElementById('btn-cargar');
const btnExportar  = document.getElementById('btn-exportar');
const inpGrupo     = document.getElementById('inp-grupo');
const inpPeriodo   = document.getElementById('inp-periodo');
const selHorario   = document.getElementById('sel-horario');
const selMateria   = document.getElementById('sel-materia');
const selUnidad    = document.getElementById('sel-unidad');
const selActividad = document.getElementById('sel-actividad');

const inpFecha         = document.getElementById('inp-fecha');
const btnMarcarTodos   = document.getElementById('btn-marcar-todos');
const btnGuardar       = document.getElementById('btn-guardar');

// Inicializar fecha de hoy
document.addEventListener('DOMContentLoaded', () => {
    const today = new Date();
    // Ajustar a zona horaria local
    const tzOffset = today.getTimezoneOffset() * 60000; 
    const localISOTime = (new Date(today - tzOffset)).toISOString().slice(0, 10);
    if(inpFecha) inpFecha.value = localISOTime;
});

// ── Cargar Horarios Guardados al iniciar ───────────────────────
let horariosGuardados = [];
document.addEventListener('DOMContentLoaded', () => {
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
});

selHorario.addEventListener('change', () => {
    selMateria.innerHTML = '<option value="">-- Selecciona Materia --</option>';
    inpGrupo.value = '';
    
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
            opt.dataset.nombreMateria = mat.materia || '';
            selMateria.appendChild(opt);
        });
    }
});

selMateria.addEventListener('change', () => {
    if (selMateria.value === '') {
        inpGrupo.value = '';
    } else {
        const selectedOpt = selMateria.options[selMateria.selectedIndex];
        inpGrupo.value = selectedOpt.dataset.grupo || '';
    }
});


// ── Cargar alumnos desde la BD ─────────────────────────────────
btnCargar.addEventListener('click', async () => {
    const grupo   = inpGrupo.value.trim();
    const periodo = inpPeriodo.value.trim();

    if (!selMateria.value) {
        mostrarMensaje('Selecciona una materia primero.', 'error');
        return;
    }
    if (!grupo || !periodo) {
        mostrarMensaje('Falta información del grupo o el periodo.', 'error');
        return;
    }

    btnCargar.disabled     = true;
    btnCargar.textContent  = '⏳ Buscando...';
    mostrarMensaje('Consultando base de datos...', 'info');

    try {
        const matOpt = selMateria.options[selMateria.selectedIndex];
        const materia = matOpt.dataset.nombreMateria || '';

        const url = `../API/get_alumnos.php?grupo=${encodeURIComponent(grupo)}&periodo=${encodeURIComponent(periodo)}&materia=${encodeURIComponent(materia)}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 'ok') {
            alumnos = data.alumnos;
            asistencia = new Array(alumnos.length).fill(null);

            mostrarMensaje('✓ ' + alumnos.length + ' alumno(s) cargados — ' + materia + ' (Grupo ' + grupo + ') · ' + periodo, 'exito');
            mostrarControles();
            loadActividades();
            
            // Intentar cargar asistencia guardada para la fecha actual
            cargarAsistenciaGuardada();
            
            renderLista();
        } else {
            throw new Error(data.error || 'Error al cargar alumnos');
        }

    } catch (err) {
        mostrarMensaje('✗ ' + err.message, 'error');
    } finally {
        btnCargar.disabled    = false;
        btnCargar.textContent = '🔍 Buscar y cargar alumnos';
    }
});

// ── Cargar Actividades ─────────────────────────────────────────
function loadActividades() {
    if (!selMateria || selMateria.selectedIndex <= 0) return;
    const opt = selMateria.options[selMateria.selectedIndex];
    const grupo = opt.dataset.grupo || '';
    const matName = opt.dataset.nombreMateria || '';
    const materiaKey = `${matName}_${grupo}`;
    const unidad = selUnidad.value;
    
    selActividad.innerHTML = '<option value="">-- Selecciona Actividad --</option>';
    
    const key = `actividades_${materiaKey}_u${unidad}`;
    const data = localStorage.getItem(key);
    if (data) {
        try {
            const actData = JSON.parse(data);
            actData.forEach((act, idx) => {
                const o = document.createElement('option');
                o.value = idx;
                o.textContent = act.name + (act.date ? ` (${act.date})` : '');
                // Si la actividad tiene fecha por defecto, la podemos usar
                if (act.date) o.dataset.date = act.date;
                selActividad.appendChild(o);
            });
        } catch(e) {}
    }
    
    if (selActividad.options.length === 1) {
        selActividad.innerHTML = '<option value="">Sin actividades configuradas</option>';
    }
}

if (selUnidad) {
    selUnidad.addEventListener('change', () => {
        loadActividades();
        // Resetear la lista de asistencia al cambiar la unidad/actividad
        if (alumnos.length > 0) {
            asistencia = new Array(alumnos.length).fill(null);
            renderLista();
        }
    });
}

if (selActividad) {
    selActividad.addEventListener('change', () => {
        if (alumnos.length > 0) {
            asistencia = new Array(alumnos.length).fill(null);
            
            // Si la actividad tiene fecha, auto-llenar el input de fecha (opcional)
            const opt = selActividad.options[selActividad.selectedIndex];
            if (opt && opt.dataset.date && inpFecha) {
                inpFecha.value = opt.dataset.date;
            }
            
            cargarAsistenciaGuardada();
            renderLista();
            mostrarMensaje('Lista actualizada para la actividad seleccionada', 'info');
        }
    });
}

// ── Mostrar/ocultar controles ──────────────────────────────────
function mostrarControles() {
    document.getElementById('stats-bar').style.display    = 'grid';
    document.getElementById('controles').style.display    = 'block';
}

// ── Render lista ───────────────────────────────────────────────
function renderLista() {
    const contenedor = document.getElementById('contenedor-lista');
    contenedor.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'lista-wrap';

    const header = document.createElement('div');
    header.className = 'lista-header';
    header.innerHTML = '<span>#</span><span>Nombre</span><span>Asistencia</span>';
    wrap.appendChild(header);

    alumnos.forEach((a, i) => {
        const estado = asistencia[i];
        
        let rowClass = '';
        if (estado === 'P') rowClass = ' fila-presente';
        else if (estado === 'A') rowClass = ' fila-ausente';
        else if (estado === 'J') rowClass = ' fila-justificado';
        
        const fila = document.createElement('div');
        fila.className = 'alumno-fila' + rowClass;
        fila.id = 'fila-' + i;

        const infoWrap = document.createElement('div');
        infoWrap.className = 'alumno-info';

        const num = document.createElement('span');
        num.className   = 'num-fila';
        num.textContent = i + 1;

        const nombre = document.createElement('span');
        nombre.className   = 'nombre-alumno';
        nombre.textContent = a.nombre;

        infoWrap.appendChild(num);
        infoWrap.appendChild(nombre);

        const botonesWrap = document.createElement('div');
        botonesWrap.className = 'botones-estado';

        const btnP = document.createElement('button');
        btnP.className   = 'btn-estado' + (estado === 'P' ? ' presente-activo' : '');
        btnP.innerHTML = '✓ Presente';
        btnP.addEventListener('click', () => marcarAsistencia(i, 'P'));

        const btnA = document.createElement('button');
        btnA.className   = 'btn-estado' + (estado === 'A' ? ' ausente-activo'  : '');
        btnA.innerHTML = '✗ Ausente';
        btnA.addEventListener('click', () => marcarAsistencia(i, 'A'));

        const btnJ = document.createElement('button');
        btnJ.className   = 'btn-estado' + (estado === 'J' ? ' justificado-activo'  : '');
        btnJ.innerHTML = '⚠ Justificado';
        btnJ.addEventListener('click', () => marcarAsistencia(i, 'J'));

        botonesWrap.appendChild(btnP);
        botonesWrap.appendChild(btnA);
        botonesWrap.appendChild(btnJ);

        fila.appendChild(infoWrap);
        fila.appendChild(botonesWrap);
        wrap.appendChild(fila);
    });

    contenedor.appendChild(wrap);
    actualizarStats();
}

// ── Marcar asistencia ──────────────────────────────────────────
function marcarAsistencia(idx, estado) {
    asistencia[idx] = estado;
    renderLista();
}

btnMarcarTodos.addEventListener('click', () => {
    asistencia = new Array(alumnos.length).fill('P');
    renderLista();
    mostrarMensaje('Se han marcado todos como presentes.', 'info');
});

// ── Guardar en LocalStorage ────────────────────────────────────
function getStorageKey() {
    const grupo = inpGrupo.value.trim();
    if (selMateria.selectedIndex <= 0) return null;
    const opt = selMateria.options[selMateria.selectedIndex];
    const matName = opt.dataset.nombreMateria || '';
    const materiaKey = `${matName}_${grupo}`;
    const unidad = selUnidad.value;
    const actividadIdx = selActividad.value;
    
    if (actividadIdx === '') return null; // No hay actividad seleccionada
    
    return `asistencia_${materiaKey}_u${unidad}_act${actividadIdx}`;
}

btnGuardar.addEventListener('click', () => {
    if (!alumnos.length) return;
    const key = getStorageKey();
    if (!key) {
        mostrarMensaje('Por favor, selecciona una Unidad y una Actividad.', 'error');
        return;
    }
    localStorage.setItem(key, JSON.stringify(asistencia));
    mostrarMensaje('Asistencia guardada correctamente para esta actividad.', 'exito');
});

function cargarAsistenciaGuardada() {
    const key = getStorageKey();
    if (!key) return;
    
    const guardada = localStorage.getItem(key);
    if (guardada) {
        try {
            const arr = JSON.parse(guardada);
            if (arr && arr.length === alumnos.length) {
                asistencia = arr;
            }
        } catch(e) {}
    }
}

inpFecha.addEventListener('change', () => {
    if (alumnos.length > 0) {
        asistencia = new Array(alumnos.length).fill(null);
        cargarAsistenciaGuardada();
        renderLista();
        mostrarMensaje('Lista actualizada para la fecha ' + inpFecha.value, 'info');
    }
});

// ── Estadísticas ───────────────────────────────────────────────
function actualizarStats() {
    const presentes = asistencia.filter(a => a === 'P').length;
    const ausentes  = asistencia.filter(a => a === 'A').length;
    const justificados = asistencia.filter(a => a === 'J').length;

    document.getElementById('stat-total').textContent     = alumnos.length;
    document.getElementById('stat-presentes').textContent = presentes;
    document.getElementById('stat-ausentes').textContent  = ausentes + justificados;

    calcularRiesgoAsistencia();
}

// ── Escaneo Global de Asistencias ──────────────────────────────
function calcularRiesgoAsistencia() {
    const grupo = inpGrupo.value.trim();
    if (!grupo || !alumnos.length) return;
    
    // statsAlumnos almacena: { totales: int, faltas: int }
    const statsAlumnos = alumnos.map(() => ({ totales: 0, faltas: 0 }));
    
    // Buscar en todo el localStorage las listas guardadas de este grupo
    // La llave ahora es: asistencia_MATERIA_GRUPO_uX_actY
    if (selMateria.selectedIndex <= 0) return;
    const opt = selMateria.options[selMateria.selectedIndex];
    const matName = opt.dataset.nombreMateria || '';
    const materiaKey = `${matName}_${grupo}`;
    const unidad = selUnidad.value;

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        // Validar si pertenece a la misma materia y unidad (para "Todas las faltas" de la unidad)
        // Opcional: si quieres de TODAS las unidades, quita el _u${unidad}
        if (key && key.startsWith(`asistencia_${materiaKey}_`)) {
            try {
                const arr = JSON.parse(localStorage.getItem(key));
                if (arr && arr.length === alumnos.length) {
                    arr.forEach((estado, idx) => {
                        if (estado !== null) { // Si se registró algo ese día
                            statsAlumnos[idx].totales++;
                            if (estado === 'A') {
                                statsAlumnos[idx].faltas++;
                            }
                        }
                    });
                }
            } catch(e) {}
        }
    }
    
    // Integrar la vista actual que no se ha guardado aún (para que reaccione al instante)
    const currentKey = getStorageKey();
    let currentSaved = null;
    try { currentSaved = JSON.parse(localStorage.getItem(currentKey)); } catch(e){}
    
    // Si la lista actual no está guardada (o es diferente), sumamos/restamos lo actual
    // Para simplificar, mejor recalculamos usando la 'asistencia' de la pantalla
    // en lugar del guardado actual de esa fecha.
    alumnos.forEach((a, idx) => {
        const estadoActual = asistencia[idx];
        const guardadoEseDia = currentSaved ? currentSaved[idx] : null;
        
        // Restar lo guardado de hoy para evitar doble conteo
        if (guardadoEseDia !== null) {
            statsAlumnos[idx].totales--;
            if (guardadoEseDia === 'A') statsAlumnos[idx].faltas--;
        }
        
        // Sumar lo que el maestro acaba de picar en pantalla
        if (estadoActual !== null) {
            statsAlumnos[idx].totales++;
            if (estadoActual === 'A') statsAlumnos[idx].faltas++;
        }
    });
    
    // Aplicar estilos a la fila de cada alumno en base a su historial
    statsAlumnos.forEach((stats, idx) => {
        const fila = document.getElementById(`fila-${idx}`);
        if (!fila) return;
        
        const infoWrap = fila.querySelector('.alumno-info');
        if (!infoWrap) return;
        
        // Criterio: Tiene al menos un pase de lista registrado Y todas son faltas
        if (stats.totales > 0 && stats.faltas === stats.totales) {
            fila.style.borderLeft = '4px solid #dc2626';
            fila.style.backgroundColor = '#fef2f2'; // Fondo rojo claro
            
            // Agregar el badge si no existe
            if (!fila.querySelector('.badge-riesgo')) {
                const badge = document.createElement('span');
                badge.className = 'badge-riesgo';
                badge.textContent = `⚠️ 0% Asistencia (${stats.faltas} faltas)`;
                badge.style.color = '#dc2626';
                badge.style.fontSize = '11px';
                badge.style.fontWeight = 'bold';
                badge.style.backgroundColor = '#fee2e2';
                badge.style.padding = '3px 8px';
                badge.style.borderRadius = '12px';
                badge.style.marginLeft = '8px';
                badge.style.whiteSpace = 'nowrap';
                
                infoWrap.appendChild(badge);
            } else {
                // Actualizar por si el número de faltas cambió
                fila.querySelector('.badge-riesgo').textContent = `⚠️ 0% Asistencia (${stats.faltas} faltas)`;
            }
        } else {
            // Remover estilos si ya no está en riesgo
            fila.style.borderLeft = '';
            fila.style.backgroundColor = '';
            const badge = fila.querySelector('.badge-riesgo');
            if (badge) badge.remove();
        }
    });
}

// ── Helpers UI ─────────────────────────────────────────────────
function mostrarMensaje(texto, tipo) {
    const el = document.getElementById('msg-estado');
    el.textContent = texto;
    el.className   = tipo;
}

// ── Exportar ───────────────────────────────────────────────────
btnExportar.addEventListener('click', () => {
    const box   = document.getElementById('export-box');
    const fechaSel = inpFecha.value;

    const grupo   = inpGrupo.value.trim();
    const periodo = inpPeriodo.value.trim();
    const materiaSel = document.getElementById('sel-materia');
    const matName = materiaSel.options[materiaSel.selectedIndex].text;

    let txt  = 'REPORTE DE ASISTENCIA — ITLAC\n';
    txt += 'Materia: ' + matName + '\n';
    txt += 'Periodo: ' + periodo + '\n';
    txt += 'Fecha: ' + fechaSel + '\n';
    txt += '─'.repeat(48) + '\n';

    alumnos.forEach((a, i) => {
        let estStr = '  SIN MARCAR';
        if (asistencia[i] === 'P') estStr = '✓ PRESENTE';
        if (asistencia[i] === 'A') estStr = '✗ AUSENTE';
        if (asistencia[i] === 'J') estStr = '⚠ JUSTIFICADO';
        
        const nc = a.nocontrol.padEnd(10);
        txt += nc + '  ' + a.nombre.padEnd(30) + estStr + '\n';
    });

    txt += '─'.repeat(48) + '\n';
    const p  = asistencia.filter(a => a === 'P').length;
    const ab = asistencia.filter(a => a === 'A').length;
    const j  = asistencia.filter(a => a === 'J').length;
    const sm = asistencia.filter(a => a === null).length;
    txt += `Presentes: ${p}  |  Ausentes: ${ab}  |  Justificados: ${j}  |  Sin marcar: ${sm}  |  Total: ${alumnos.length}`;

    box.textContent    = txt;
    box.style.display  = 'block';
    box.scrollIntoView({ behavior: 'smooth' });
});