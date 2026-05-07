document.addEventListener('DOMContentLoaded', () => {
    cargarMateriasSelect();
});

function cargarMateriasSelect() {
    const selMateria = document.getElementById('selectMateria');
    if (!selMateria) return;
    
    try {
        const horariosGuardados = JSON.parse(localStorage.getItem('horarios_guardados') || '[]');
        if (horariosGuardados.length > 0) {
            horariosGuardados.forEach(h => {
                if (h.data && h.data.length > 0) {
                    h.data.forEach((mat) => {
                        const opt = document.createElement('option');
                        const nombreMateria = mat.materia || 'Sin nombre';
                        const grupo = mat.grupo || 'N/A';
                        
                        opt.value = `${nombreMateria}_${grupo}`;
                        opt.textContent = `${nombreMateria} (G: ${grupo})`;
                        
                        if (!Array.from(selMateria.options).some(o => o.value === opt.value)) {
                            selMateria.appendChild(opt);
                        }
                    });
                }
            });
        }
    } catch(e) {}
}

// Alumnos dummy para demostración
const dummyStudents = [
    { id: 1, name: "Aguilar Pérez Juan Carlos", asistencia: 100 },
    { id: 2, name: "Bautista Gómez María José", asistencia: 95 },
    { id: 3, name: "Castillo Herrera Luis Antonio", asistencia: 80 },
    { id: 4, name: "Díaz Morales Ana Sofía", asistencia: 100 },
    { id: 5, name: "Espinoza Ruiz Diego", asistencia: 60 },
];

let currentActivities = [];
let alumnosEnGrid = []; // Para guardar la lista real de alumnos cargados

async function loadEvaluationGrid() {
    const materia = document.getElementById('selectMateria').value;
    const unidad = document.getElementById('selectUnidad').value;

    if (!materia) {
        showToast('Selecciona una materia primero.', 'error');
        return;
    }

    // 1. Intentar cargar las actividades (rúbrica) configuradas previamente
    const storageKey = `actividades_${materia}_u${unidad}`;
    const storedData = localStorage.getItem(storageKey);

    if (!storedData) {
        showToast('No hay actividades configuradas para esta materia/unidad. Ve a "Configurar Actividades" primero.', 'error');
        hideGrid();
        return;
    }

    currentActivities = JSON.parse(storedData);

    if (currentActivities.length === 0) {
        showToast('La rúbrica de esta unidad está vacía.', 'error');
        hideGrid();
        return;
    }

    // 2. Cargar Alumnos Reales desde la BD
    try {
        // Extraer grupo del value (formato: Materia_Grupo)
        const parts = materia.split('_');
        const grupo = parts[parts.length - 1];
        const nombreMateria = materia.replace(`_${grupo}`, '');
        const periodo = document.getElementById('periodoEvaluacion')?.value || '2026-1'; // Ajustar según UI

        const url = `../API/get_alumnos.php?grupo=${encodeURIComponent(grupo)}&periodo=${encodeURIComponent(periodo)}&materia=${encodeURIComponent(nombreMateria)}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.status === 'ok') {
            alumnosEnGrid = data.alumnos;
            
            // 3. Si hay actividades y alumnos, construimos la tabla
            buildGrid();
            
            // 4. Mostrar el grid y ocultar empty state
            document.getElementById('emptyState').style.display = 'none';
            document.getElementById('evaluationArea').style.display = 'block';
            
            showToast('Lista y rúbrica cargadas exitosamente.', 'success');
        } else {
            throw new Error(data.error || 'Error al cargar alumnos');
        }
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
        hideGrid();
    }
}

function buildGrid() {
    const thead = document.getElementById('gradesThead');
    const tbody = document.getElementById('gradesTbody');

    // Construir Encabezados
    let trHead = '<tr>';
    trHead += '<th class="th-student">Alumno</th>';
    
    // Columnas de Actividades
    currentActivities.forEach((act, index) => {
        const teamClass = act.isTeam ? 'th-team' : '';
        const teamIcon = act.isTeam ? '<span class="team-badge" title="Actividad en Equipo">👥</span>' : '';

        trHead += `
            <th class="th-activity ${teamClass}">
                ${act.name} ${teamIcon}
                <span class="max-points-label">Max: ${act.points} pts</span>
            </th>
        `;
    });

    // Columna de Asistencia
    trHead += '<th class="th-asistencia">Asistencia %</th>';
    // Columna Total
    trHead += '<th class="th-total">Calif. Final</th>';
    trHead += '</tr>';
    
    thead.innerHTML = trHead;

    // Construir Filas de Alumnos
    tbody.innerHTML = '';
    
    // Generar o recuperar calificaciones
    const materia = document.getElementById('selectMateria').value;
    const unidad = document.getElementById('selectUnidad').value;
    const gradesKey = `calificaciones_${materia}_u${unidad}`;
    const savedGrades = JSON.parse(localStorage.getItem(gradesKey)) || {};

    alumnosEnGrid.forEach(student => {
        const studentRow = document.createElement('tr');
        studentRow.dataset.studentId = student.nocontrol;

        const teamNum = savedGrades[student.nocontrol] && savedGrades[student.nocontrol].team ? savedGrades[student.nocontrol].team : '';

        let trContent = `
            <td class="td-student">
                <div class="student-name-wrapper">
                    <input type="number" class="team-number-input" placeholder="Eq" value="${teamNum}" min="1" max="50" title="Número de Equipo" oninput="syncTeamOnNumberChange(this)">
                    <span class="student-name">${student.nombre}</span>
                </div>
            </td>`;
        
        // Celdas de Actividades
        currentActivities.forEach((act, actIndex) => {
            // Recuperar valor si existe
            let val = savedGrades[student.nocontrol] && savedGrades[student.nocontrol][actIndex] !== undefined ? savedGrades[student.nocontrol][actIndex] : '';
            
            // Poner 0 automático si la fecha de entrega ya pasó y la celda está vacía
            let isPastDue = false;
            if (val === '' && act.date) {
                const today = new Date();
                today.setHours(0,0,0,0);
                const actDate = new Date(act.date + 'T00:00:00'); // Forzar zona horaria local correcta
                
                if (today > actDate) {
                    val = 0;
                    isPastDue = true;
                }
            }

            const syncCall = act.isTeam ? `syncTeamGrades(this);` : '';
            const pastDueClass = isPastDue ? 'past-due-auto' : '';
            
            trContent += `
                <td>
                    <input type="number" 
                        class="grade-input ${pastDueClass}" 
                        data-max="${act.points}" 
                        data-act-index="${actIndex}"
                        data-is-team="${act.isTeam}"
                        value="${val}"
                        min="0" max="${act.points}" 
                        oninput="validateInput(this); ${syncCall} calculateRow(this)"
                    >
                </td>
            `;
        });

        // Celda Asistencia calculada automáticamente
        let asistenciasTotales = 0;
        let pasesDeListaContados = 0;
        
        currentActivities.forEach((act, actIndex) => {
            const listKey = `asistencia_${materia}_u${unidad}_act${actIndex}`;
            const listDataStr = localStorage.getItem(listKey);
            if (listDataStr) {
                pasesDeListaContados++;
                try {
                    const listData = JSON.parse(listDataStr);
                    const studentIdx = alumnosEnGrid.findIndex(s => s.nocontrol === student.nocontrol);
                    // Consideramos Presente ('P') o Justificado ('J') como asistencia válida
                    if (studentIdx !== -1 && (listData[studentIdx] === 'P' || listData[studentIdx] === 'J')) {
                        asistenciasTotales++;
                    }
                } catch(e) {}
            }
        });
        
        let asisVal = 100; // Por defecto 100% si no hay listas
        if (pasesDeListaContados > 0) {
            asisVal = Math.round((asistenciasTotales / pasesDeListaContados) * 100);
        } else if (savedGrades[student.nocontrol] && savedGrades[student.nocontrol].asistencia !== undefined) {
            asisVal = savedGrades[student.nocontrol].asistencia;
        }
        
        trContent += `
            <td>
                <input type="number" 
                    class="attendance-input" 
                    value="${asisVal}"
                    min="0" max="100"
                    readonly
                    title="Calculado automáticamente desde Pase de Lista"
                    style="background-color: #f3f4f6; cursor: not-allowed; font-weight: bold;"
                >
            </td>
        `;

        // Celda Total
        trContent += `<td class="td-final final-score">0</td>`;

        studentRow.innerHTML = trContent;
        tbody.appendChild(studentRow);
        
        // Calcular inicial para esta fila
        calculateRow(studentRow.querySelector('.grade-input') || studentRow.querySelector('.attendance-input'));
    });
    
    // Actualizar estadísticas al terminar de construir la tabla
    updateStats();
}

function hideGrid() {
    document.getElementById('emptyState').style.display = 'block';
    document.getElementById('evaluationArea').style.display = 'none';
}

function validateInput(inputEl, maxOverride = null) {
    const max = maxOverride || parseFloat(inputEl.getAttribute('data-max'));
    let val = parseFloat(inputEl.value);

    inputEl.classList.remove('input-error');

    if (val > max) {
        inputEl.classList.add('input-error');
        showToast(`El valor excede el máximo permitido (${max}).`, 'error');
    } else if (val < 0) {
        inputEl.value = 0;
    }
}

function calculateRow(elementInRow) {
    if(!elementInRow) return;
    const row = elementInRow.closest('tr');
    
    const grades = row.querySelectorAll('.grade-input');
    const attendance = row.querySelector('.attendance-input');
    const finalScoreEl = row.querySelector('.final-score');

    let sum = 0;
    let totalMaxPoints = 0;
    let hasErrors = false;

    // Sumar actividades y obtener el máximo posible
    grades.forEach(input => {
        if(input.classList.contains('input-error')) hasErrors = true;
        
        // Solo contabilizar si la actividad tiene calificación o si ya pasó su fecha (que tiene 0 automático)
        if (input.value !== '') {
            const val = parseFloat(input.value) || 0;
            const max = parseFloat(input.dataset.max) || 0;
            sum += val;
            totalMaxPoints += max;
        }
    });

    if(attendance.classList.contains('input-error')) hasErrors = true;
    const attVal = parseFloat(attendance.value) || 0;
    
    // Escalar las tareas a 100: Si el alumno tiene todos los puntos posibles, su base es 100.
    let taskPercentage = totalMaxPoints > 0 ? (sum / totalMaxPoints) * 100 : 0;

    // Obtener la ponderación configurada para la asistencia
    const materia = document.getElementById('selectMateria').value;
    const unidad = document.getElementById('selectUnidad').value;
    let attWeight = parseFloat(localStorage.getItem(`asistencia_peso_${materia}_u${unidad}`));
    if (isNaN(attWeight)) attWeight = 10; // Valor por defecto 10%
    
    let taskWeight = 100 - attWeight;

    // Calcular la calificación final con los pesos dinámicos
    const finalGrade = Math.round((taskPercentage * (taskWeight / 100)) + (attVal * (attWeight / 100)));

    if (hasErrors) {
        finalScoreEl.textContent = "ERR";
        finalScoreEl.className = "td-final final-score"; // Reset classes
        return;
    }

    finalScoreEl.textContent = finalGrade;
    finalScoreEl.className = "td-final final-score"; // Reset classes

    if (finalGrade >= 70) {
        finalScoreEl.classList.add('aprobado');
    } else {
        finalScoreEl.classList.add('reprobado');
    }
    
    // Llamar a actualizar estadísticas de forma diferida para no saturar si hay cálculos en lote
    clearTimeout(window.statsTimeout);
    window.statsTimeout = setTimeout(updateStats, 100);
}

function saveGrades() {
    const materia = document.getElementById('selectMateria').value;
    const unidad = document.getElementById('selectUnidad').value;
    
    const rows = document.querySelectorAll('#gradesTbody tr');
    const gradesData = {};
    let globalError = false;

    rows.forEach(row => {
        const studentId = row.dataset.studentId;
        const inputs = row.querySelectorAll('.grade-input');
        const attendance = row.querySelector('.attendance-input');
        const teamInput = row.querySelector('.team-number-input');
        
        const actGrades = {};
        
        inputs.forEach(input => {
            if(input.classList.contains('input-error')) globalError = true;
            const val = input.value.trim();
            actGrades[input.dataset.actIndex] = val === '' ? '' : parseFloat(val);
        });

        gradesData[studentId] = {
            ...actGrades,
            asistencia: parseFloat(attendance.value) || 0,
            team: teamInput.value
        };
    });

    if (globalError) {
        showToast('Existen errores en algunas capturas (exceden el máximo). Corrige antes de guardar.', 'error');
        return;
    }

    const gradesKey = `calificaciones_${materia}_u${unidad}`;
    localStorage.setItem(gradesKey, JSON.stringify(gradesData));
    
    showToast('Calificaciones guardadas exitosamente en el sistema.', 'success');
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

function syncTeamGrades(sourceInput) {
    const val = sourceInput.value;
    const colIndex = sourceInput.getAttribute('data-act-index');
    const sourceRow = sourceInput.closest('tr');
    const teamNum = sourceRow.querySelector('.team-number-input').value;
    
    // Si el alumno no tiene equipo asignado, no sincronizamos
    if (!teamNum) return;

    // Buscar a todos los alumnos que tengan el mismo número de equipo
    const allRows = document.querySelectorAll('#gradesTbody tr');
    allRows.forEach(row => {
        if (row === sourceRow) return; // Saltar al alumno origen
        
        const rowTeam = row.querySelector('.team-number-input').value;
        if (rowTeam === teamNum) {
            const targetInput = row.querySelector(`input[data-act-index="${colIndex}"]`);
            if (targetInput && targetInput.value !== val) {
                targetInput.value = val;
                validateInput(targetInput);
                calculateRow(targetInput);
            }
        }
    });
}

function syncTeamOnNumberChange(teamInput) {
    const teamNum = teamInput.value;
    if (!teamNum) return;
    
    const currentRow = teamInput.closest('tr');
    
    // Buscar a alguien más del mismo equipo que ya tenga calificaciones
    const allRows = document.querySelectorAll('#gradesTbody tr');
    for (let row of allRows) {
        if (row === currentRow) continue;
        
        const rowTeam = row.querySelector('.team-number-input').value;
        if (rowTeam === teamNum) {
            // Copiar las calificaciones de este compañero de equipo a mi fila
            const myInputs = currentRow.querySelectorAll('.grade-input[data-is-team="true"]');
            myInputs.forEach(myInput => {
                const colIndex = myInput.getAttribute('data-act-index');
                const partnerInput = row.querySelector(`input[data-act-index="${colIndex}"]`);
                if (partnerInput && partnerInput.value !== '') {
                    myInput.value = partnerInput.value;
                    validateInput(myInput);
                    calculateRow(myInput);
                }
            });
            break; // Ya copiamos de un compañero, no necesitamos más
        }
    }
}

function updateStats() {
    const rows = document.querySelectorAll('#gradesTbody tr');
    if (rows.length === 0) return;

    let passCount = 0;
    let failCount = 0;
    let absenceRiskCount = 0;

    rows.forEach(row => {
        const finalScoreEl = row.querySelector('.final-score');
        const attendanceInput = row.querySelector('.attendance-input');
        
        const finalGrade = parseInt(finalScoreEl.textContent);
        const attendance = parseFloat(attendanceInput.value) || 0;

        // Limpiar estado de riesgo
        row.style.backgroundColor = '';
        const nameEl = row.querySelector('.student-name');
        if (nameEl) nameEl.style.color = '';

        if (!isNaN(finalGrade)) {
            if (finalGrade >= 70) {
                passCount++;
            } else {
                failCount++;
            }
        }

        // Riesgo por faltas (0% asistencia = todas las faltas)
        if (attendance === 0) {
            absenceRiskCount++;
            row.style.backgroundColor = '#fef2f2'; // Fondo rojo muy suave
            if (nameEl) nameEl.style.color = '#dc2626'; // Nombre en rojo
        }
    });

    const totalCalculated = passCount + failCount;
    const pctPass = totalCalculated > 0 ? Math.round((passCount / totalCalculated) * 100) : 0;
    const pctFail = totalCalculated > 0 ? Math.round((failCount / totalCalculated) * 100) : 0;

    document.getElementById('pctPass').textContent = pctPass + '%';
    document.getElementById('pctFail').textContent = pctFail + '%';
    document.getElementById('numAbsences').textContent = absenceRiskCount;
}
