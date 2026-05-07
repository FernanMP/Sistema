document.addEventListener('DOMContentLoaded', () => {
    // Initial load check
    checkEmptyState();
    
    // Cargar materias dinámicamente
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

// Función para manejar el click en Agregar Actividad
function handleAddActivity() {
    const tbody = document.getElementById('tbodyActividades');
    const currentCount = tbody.children.length;
    
    // Si la tabla está vacía, agregamos 5 de golpe
    if (currentCount === 0) {
        for (let i = 1; i <= 5; i++) {
            addActivityRow(`A${i}`, '', '', false);
        }
        showToast('Se agregaron 5 actividades por defecto.', 'success');
    } else {
        // Si ya hay actividades, agregamos 1 más
        addActivityRow(`A${currentCount + 1}`, '', '', false);
    }
}

// Función para agregar una nueva fila a la tabla
function addActivityRow(name = '', points = '', date = '', isTeam = false) {
    const tbody = document.getElementById('tbodyActividades');
    const tr = document.createElement('tr');
    
    tr.innerHTML = `
        <td>
            <input type="text" class="act-name" placeholder="Ej. Tarea 1.1" value="${name}" required>
        </td>
        <td>
            <input type="number" class="act-points" placeholder="0" min="0" max="100" value="${points}" oninput="calculateTotal()" required>
        </td>
        <td>
            <input type="date" class="act-date" value="${date}" required>
        </td>
        <td>
            <div class="toggle-team">
                <input type="checkbox" class="act-team" ${isTeam ? 'checked' : ''}>
            </div>
        </td>
        <td class="td-actions">
            <button class="btn-icon" onclick="deleteRow(this)" title="Eliminar Actividad">✖</button>
        </td>
    `;
    
    tbody.appendChild(tr);
    checkEmptyState();
    calculateTotal();
}

// Eliminar fila
function deleteRow(button) {
    const row = button.closest('tr');
    row.remove();
    checkEmptyState();
    calculateTotal();
}

// Limpiar la tabla completa
function clearTable() {
    if(confirm('¿Estás seguro de que deseas eliminar todas las actividades de la vista actual?')) {
        document.getElementById('tbodyActividades').innerHTML = '';
        checkEmptyState();
        calculateTotal();
    }
}

// Revisar si la tabla está vacía para mostrar el empty state
function checkEmptyState() {
    const tbody = document.getElementById('tbodyActividades');
    const emptyState = document.getElementById('emptyState');
    const tableContainer = document.getElementById('tableContainer');
    
    if (tbody.children.length === 0) {
        emptyState.style.display = 'block';
        tableContainer.style.display = 'none';
    } else {
        emptyState.style.display = 'none';
        tableContainer.style.display = 'block';
    }
}

// Calcular el total de puntos y actualizar UI
function calculateTotal() {
    const pointInputs = document.querySelectorAll('.act-points');
    let total = 0;
    
    pointInputs.forEach(input => {
        const val = parseFloat(input.value);
        if (!isNaN(val)) {
            total += val;
        }
    });
    
    const totalEl = document.getElementById('totalPoints');
    const summaryContainer = document.getElementById('pointsSummary');
    
    totalEl.textContent = total;
    
    // Remover clases de estado
    summaryContainer.classList.remove('success', 'error');
    
    // Lógica de colores (asumiendo que 100 es lo ideal)
    if (total === 100) {
        summaryContainer.classList.add('success');
    } else if (total > 100) {
        summaryContainer.classList.add('error');
    }
}

// Guardar configuración en localStorage
function saveConfig() {
    const materia = document.getElementById('selectMateria').value;
    const unidad = document.getElementById('selectUnidad').value;
    
    if (!materia) {
        showToast('Por favor selecciona una materia.', 'error');
        return;
    }
    
    const rows = document.querySelectorAll('#tbodyActividades tr');
    if (rows.length === 0) {
        showToast('No hay actividades para guardar.', 'error');
        return;
    }
    
    const actividades = [];
    let hasError = false;
    
    rows.forEach(row => {
        const name = row.querySelector('.act-name').value.trim();
        const points = row.querySelector('.act-points').value;
        const date = row.querySelector('.act-date').value;
        const isTeam = row.querySelector('.act-team').checked;
        
        if (!name || !points) {
            hasError = true;
        }
        
        actividades.push({ name, points: parseFloat(points), date, isTeam });
    });
    
    if (hasError) {
        showToast('Hay campos vacíos en las actividades. Revísalos por favor.', 'error');
        return;
    }
    
    const storageKey = `actividades_${materia}_u${unidad}`;
    localStorage.setItem(storageKey, JSON.stringify(actividades));
    
    // Guardar peso de asistencia
    const asistenciaPeso = document.getElementById('asistenciaPeso').value;
    localStorage.setItem(`asistencia_peso_${materia}_u${unidad}`, asistenciaPeso);
    
    showToast('Configuración guardada exitosamente.', 'success');
}

// Cargar configuración de localStorage
function loadConfig() {
    const materia = document.getElementById('selectMateria').value;
    const unidad = document.getElementById('selectUnidad').value;
    
    if (!materia) return;
    
    const storageKey = `actividades_${materia}_u${unidad}`;
    const data = localStorage.getItem(storageKey);
    
    document.getElementById('tbodyActividades').innerHTML = '';
    
    if (data) {
        const actividades = JSON.parse(data);
        actividades.forEach(act => {
            addActivityRow(act.name, act.points, act.date, act.isTeam);
        });
        
        // Cargar peso de asistencia
        const peso = localStorage.getItem(`asistencia_peso_${materia}_u${unidad}`);
        if (peso !== null) {
            document.getElementById('asistenciaPeso').value = peso;
        } else {
            document.getElementById('asistenciaPeso').value = "10";
        }
        
        showToast(`Datos cargados para la Unidad ${unidad}`, 'success');
    } else {
        document.getElementById('asistenciaPeso').value = "10";
        
        // Cargar 5 actividades por defecto
        for (let i = 1; i <= 5; i++) {
            addActivityRow(`A${i}`, '', '', false);
        }
        
        checkEmptyState();
        calculateTotal();
        // showToast('No hay configuración guardada para esta selección.', 'error');
    }
}

// Mostrar notificaciones flotantes (Toast)
function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    // Eliminar después de 3.5 segundos
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}
