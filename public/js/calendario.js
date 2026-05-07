/* ════════════════════════════════════════════
   CALENDARIO — Lógica de renderizado
   ════════════════════════════════════════════ */

var currentDate = new Date();
var currentScheduleData = null;
var currentScheduleId = null;

var MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

var DAY_MAP = {
    1: 'lunes',
    2: 'martes',
    3: 'miercoles',
    4: 'jueves',
    5: 'viernes',
    6: 'sabado',
    0: 'domingo'
};

var SHORT_DAYS = ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'];

function getSavedSchedules() {
    return JSON.parse(localStorage.getItem('horarios_guardados') || '[]');
}

function init() {
    loadSavedList();
    renderCalendar();
}

function loadSavedList() {
    var list = getSavedSchedules();
    var sel = document.getElementById('scheduleSelect');
    sel.innerHTML = '<option value="">-- Selecciona un Horario --</option>';
    
    list.forEach(function(item) {
        var opt = document.createElement('option');
        opt.value = item.id;
        opt.textContent = item.name + ' (' + new Date(parseInt(item.id)).toLocaleDateString() + ')';
        sel.appendChild(opt);
    });
}

function onSelectSchedule() {
    var sel = document.getElementById('scheduleSelect');
    var id = sel.value;
    
    if(!id) {
        currentScheduleData = null;
        currentScheduleId = null;
        document.getElementById('calendarWrapper').style.display = 'none';
        document.getElementById('emptyState').style.display = 'block';
        return;
    }
    
    var list = getSavedSchedules();
    var item = list.find(function(it) { return it.id === id; });
    if(item) {
        currentScheduleId = id;
        currentScheduleData = item.data;
        document.getElementById('calendarWrapper').style.display = 'block';
        document.getElementById('emptyState').style.display = 'none';
        renderCalendar();
    }
}

function changeMonth(delta) {
    currentDate.setMonth(currentDate.getMonth() + delta);
    renderCalendar();
}

function goToday() {
    currentDate = new Date();
    renderCalendar();
}

function renderCalendar() {
    var year = currentDate.getFullYear();
    var month = currentDate.getMonth();
    
    document.getElementById('currentMonthLabel').textContent = MONTH_NAMES[month] + ' ' + year;
    
    var daysContainer = document.getElementById('calendarDays');
    daysContainer.innerHTML = '';
    
    var firstDay = new Date(year, month, 1).getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var daysInPrevMonth = new Date(year, month, 0).getDate();
    
    var today = new Date();
    var isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;
    var currentDay = today.getDate();
    
    // Fill previous month trailing days
    for (var i = 0; i < firstDay; i++) {
        var prevDayNum = daysInPrevMonth - firstDay + i + 1;
        daysContainer.appendChild(createDayCell(prevDayNum, 'other-month', i));
    }
    
    // Fill current month days
    for (var d = 1; d <= daysInMonth; d++) {
        var dayOfWeek = new Date(year, month, d).getDay();
        var extraClass = (isCurrentMonth && d === currentDay) ? 'today' : '';
        daysContainer.appendChild(createDayCell(d, extraClass, dayOfWeek));
    }
    
    // Fill next month leading days to complete grid (up to 42 cells)
    var totalCells = firstDay + daysInMonth;
    var remainingCells = 42 - totalCells;
    if(totalCells <= 35) remainingCells = 35 - totalCells;
    
    for (var j = 1; j <= remainingCells; j++) {
        var nexDayOfWeek = new Date(year, month + 1, j).getDay();
        daysContainer.appendChild(createDayCell(j, 'other-month', nexDayOfWeek));
    }
}

function createDayCell(dayNumber, extraClass, dayOfWeek) {
    var cell = document.createElement('div');
    cell.className = 'day-cell ' + (extraClass || '');
    
    var numDiv = document.createElement('div');
    numDiv.className = 'day-number';
    numDiv.textContent = dayNumber;
    numDiv.setAttribute('data-mobile-day', SHORT_DAYS[dayOfWeek]);
    cell.appendChild(numDiv);
    
    var eventsDiv = document.createElement('div');
    eventsDiv.className = 'events';
    
    // If we have schedule data and this is not another month's day
    if(currentScheduleData && extraClass !== 'other-month') {
        var dayKey = DAY_MAP[dayOfWeek];
        
        currentScheduleData.forEach(function(materia, idx) {
            // Check if materia has schedule on this day
            if(materia[dayKey] && materia[dayKey].trim() !== '') {
                var evt = document.createElement('div');
                var colorIdx = idx % 11; // 11 colors defined in CSS
                evt.className = 'event bg-color-' + colorIdx;
                evt.textContent = materia.materia || 'Sin Nombre';
                evt.title = (materia.materia || 'Materia') + '\n' + 
                            'Clave: ' + materia.clave + '\n' + 
                            'Grupo: ' + materia.grupo + '\n' + 
                            'Horario: ' + materia[dayKey];
                
                var sub = document.createElement('span');
                sub.className = 'event-sub';
                sub.textContent = materia[dayKey];
                evt.appendChild(sub);
                
                eventsDiv.appendChild(evt);
            }
        });
    }
    
    cell.appendChild(eventsDiv);
    return cell;
}

// Inicializar
document.addEventListener('DOMContentLoaded', init);
