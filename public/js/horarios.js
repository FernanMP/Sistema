/* ════════════════════════════════════════════
   HORARIOS — parseo & render & storage
   ════════════════════════════════════════════ */
var ALIASES = {
  color:     ['color'],
  clave:     ['clave','codigo','código','matricula','matrícula','key'],
  grupo:     ['grupo','group','grp'],
  materia:   ['materia','asignatura','subject','nombre materia','nombre de la materia'],
  lunes:     ['lunes','lun','mon','monday'],
  martes:    ['martes','mar','tue','tuesday'],
  miercoles: ['miércoles','miercoles','mie','mier','wed','wednesday'],
  jueves:    ['jueves','jue','thu','thursday'],
  viernes:   ['viernes','vie','fri','friday'],
  sabado:    ['sábado','sabado','sab','sat','saturday'],
  unidades:  ['unidades','unidad','hrs','horas','credits','créditos','creditos'],
};
var DAYS = ['lunes','martes','miercoles','jueves','viernes','sabado'];
var DAY_NUM = { lunes:1, martes:2, miercoles:3, jueves:4, viernes:5, sabado:6 }; 
var DAY_LABEL = { lunes:'lunes', martes:'martes', miercoles:'miércoles', jueves:'jueves', viernes:'viernes', sabado:'sábado' };
var MESES = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];

var lastUsedHeader=false;
var lastColMap=null;
var currentScheduleId=null; // ID del horario que está cargado actualmente

/* ── Storage Functions ── */
function getSavedSchedules() {
  return JSON.parse(localStorage.getItem('horarios_guardados') || '[]');
}
function setSavedSchedules(list) {
  localStorage.setItem('horarios_guardados', JSON.stringify(list));
}
function loadSavedList() {
  var list = getSavedSchedules();
  var sel = document.getElementById('savedSelect');
  sel.innerHTML = '<option value="">-- Nuevo (Sin Guardar) --</option>';
  list.forEach(function(item) {
    var opt = document.createElement('option');
    opt.value = item.id;
    opt.textContent = item.name + ' (' + new Date(parseInt(item.id)).toLocaleDateString() + ')';
    sel.appendChild(opt);
  });
  if(currentScheduleId) {
    sel.value = currentScheduleId;
    document.getElementById('btnDeleteSaved').disabled = false;
    document.getElementById('btnSave').style.display='none';
    document.getElementById('btnUpdate').style.display='inline-block';
  } else {
    sel.value = "";
    document.getElementById('btnDeleteSaved').disabled = true;
    if(window._data && window._data.length > 0) {
      document.getElementById('btnSave').style.display='inline-block';
      document.getElementById('btnUpdate').style.display='none';
    } else {
      document.getElementById('btnSave').style.display='none';
      document.getElementById('btnUpdate').style.display='none';
    }
  }
}

function onSelectSaved() {
  var sel = document.getElementById('savedSelect');
  var id = sel.value;
  if(!id) {
    clearAll(); // Switch to new
    return;
  }
  var list = getSavedSchedules();
  var item = list.find(function(it) { return it.id === id; });
  if(item) {
    currentScheduleId = id;
    document.getElementById('btnDeleteSaved').disabled = false;
    lastColMap = item.rawColMap || {clave:0,grupo:1,materia:2,lunes:3,martes:4,miercoles:5,jueves:6,viernes:7,sabado:8,unidades:9};
    lastUsedHeader = item.rawUsedHeader || false;
    // Mock the data rows format expected by renderTable
    var fakeDataRows = item.data.map(function(obj) {
      var row = [];
      for(var k in lastColMap) {
        row[lastColMap[k]] = obj[k] || '';
      }
      return row;
    });
    renderColMap(lastColMap);
    renderTable(fakeDataRows, lastColMap);
    document.getElementById('rawInput').value = item.rawText || '';
    showStatus('Horario "' + item.name + '" cargado correctamente.', 'success');
  }
}

function saveAsDialog() {
  if(!window._data || !window._data.length) {
    alert("No hay datos para guardar. Ingresa un horario primero.");
    return;
  }
  var name = prompt("Asigna un nombre a este horario (ej. 'Semestre 2026-1'):");
  if(!name || !name.trim()) return;
  
  var id = Date.now().toString();
  var newItem = {
    id: id,
    name: name.trim(),
    data: window._data,
    rawColMap: lastColMap,
    rawUsedHeader: lastUsedHeader,
    rawText: document.getElementById('rawInput').value
  };
  
  var list = getSavedSchedules();
  list.push(newItem);
  setSavedSchedules(list);
  currentScheduleId = id;
  loadSavedList();
  showStatus('Horario guardado: ' + name, 'success');
}

function updateSaved() {
  if(!currentScheduleId) return;
  if(!window._data || !window._data.length) return;
  var list = getSavedSchedules();
  var idx = list.findIndex(function(it) { return it.id === currentScheduleId; });
  if(idx >= 0) {
    list[idx].data = window._data;
    list[idx].rawColMap = lastColMap;
    list[idx].rawUsedHeader = lastUsedHeader;
    list[idx].rawText = document.getElementById('rawInput').value;
    setSavedSchedules(list);
    showStatus('Horario actualizado.', 'success');
  }
}

function deleteSaved() {
  if(!currentScheduleId) {
    alert("No hay ningún horario seleccionado para borrar.");
    return;
  }
  if(confirm('¿Estás seguro de que deseas eliminar este horario guardado?')) {
    var list = getSavedSchedules();
    var idToDelete = String(currentScheduleId);
    
    var index = list.findIndex(function(it) { return String(it.id) === idToDelete; });
    
    if (index > -1) {
       list.splice(index, 1);
       setSavedSchedules(list);
       
       currentScheduleId = null;
       
       try {
           clearAll();
       } catch(e) {
           console.error("Error en clearAll:", e);
           loadSavedList(); // Fallback
       }
       
       alert('Horario borrado de tu lista de guardados con éxito.');
    } else {
       alert('Error: No se encontró este horario en tus guardados.');
    }
  }
}


/* ── Utility Base ── */
function norm(s){ return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim(); }
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function detectField(header){
  var h=norm(header);
  for(var field in ALIASES){
    var list=ALIASES[field];
    for(var i=0;i<list.length;i++){
      var a=norm(list[i]);
      if(h===a||h.startsWith(a)) return field;
    }
  }
  return null;
}
function buildMap(headerRow){
  var map={};
  for(var i=0;i<headerRow.length;i++){
    var field=detectField(headerRow[i]);
    if(field&&!(field in map)) map[field]=i;
  }
  return map;
}
function findHeader(rows){
  for(var i=0;i<Math.min(rows.length,10);i++){
    var joined=norm(rows[i].join(' '));
    var hasDay=joined.includes('lunes')||joined.includes('martes');
    var hasField=joined.includes('clave')||joined.includes('materia')||joined.includes('grupo');
    if(hasDay||hasField) return i;
  }
  return -1;
}
function parseText(text){
  return text.replace(/\r\n/g,'\n').replace(/\r/g,'\n')
    .split('\n')
    .map(function(l){return l.split('\t');})
    .filter(function(r){return r.some(function(c){return c.trim()!=='';});});
}
function getCell(row,colMap,field){
  var i=colMap[field];
  if(i===undefined||row[i]===undefined) return '';
  return row[i].trim();
}

function process(text){
  currentScheduleId = null; // New load clears current schedule context
  
  var rows=parseText(text);
  if(!rows.length){showStatus('No se detectó contenido.','error');return;}
  var headerIdx=findHeader(rows);
  var colMap,dataRows;
  if(headerIdx>=0){
    colMap=buildMap(rows[headerIdx]);
    dataRows=rows.slice(headerIdx+1);
    lastUsedHeader=true;
  } else {
    colMap={clave:0,grupo:1,materia:2,lunes:3,martes:4,miercoles:5,jueves:6,viernes:7,sabado:8,unidades:9};
    dataRows=rows;
    lastUsedHeader=false;
    showStatus('⚠️ No se encontró encabezado. Usando orden por defecto.','warn');
  }
  lastColMap=colMap;
  renderColMap(colMap);
  dataRows=dataRows.filter(function(r){
    var clave=colMap.clave!==undefined?(r[colMap.clave]||'').trim():'';
    var mat=colMap.materia!==undefined?(r[colMap.materia]||'').trim():'';
    if(!clave&&!mat) return false;
    if(norm(clave)==='clave'||norm(clave)==='color') return false;
    return true;
  });
  if(!dataRows.length){showStatus('No se encontraron filas de datos válidas.','error');return;}
  renderTable(dataRows,colMap);
  loadSavedList(); // To ensure UI reflects new unsaved state
}

function renderTable(dataRows,colMap){
  var tbody=document.getElementById('tbody');
  tbody.innerHTML='';
  var savedData=[];
  dataRows.forEach(function(row){
    var tr=document.createElement('tr');
    mkTd(tr,getCell(row,colMap,'clave'),'td-clave');
    mkTd(tr,getCell(row,colMap,'grupo'),'td-grupo');
    mkTd(tr,getCell(row,colMap,'materia'),'td-materia');
    DAYS.forEach(function(day){
      var val=getCell(row,colMap,day);
      var td=document.createElement('td');
      td.className='td-day';
      td.innerHTML=val?'<span class="day-badge">'+esc(val)+'</span>':'<span class="empty-cell">—</span>';
      tr.appendChild(td);
    });
    mkTd(tr,getCell(row,colMap,'unidades'),'td-unid');
    tbody.appendChild(tr);
    savedData.push({
      clave:getCell(row,colMap,'clave'),
      grupo:getCell(row,colMap,'grupo'),
      materia:getCell(row,colMap,'materia'),
      lunes:getCell(row,colMap,'lunes'),
      martes:getCell(row,colMap,'martes'),
      miercoles:getCell(row,colMap,'miercoles'),
      jueves:getCell(row,colMap,'jueves'),
      viernes:getCell(row,colMap,'viernes'),
      sabado:getCell(row,colMap,'sabado'),
      unidades:getCell(row,colMap,'unidades'),
    });
  });
  window._data=savedData;
  document.getElementById('rowCount').textContent=dataRows.length+' materia(s) detectadas';
  document.getElementById('emptyState').style.display='none';
  document.getElementById('resultArea').style.display='block';
  document.getElementById('btnExport').style.display='inline-block';
  document.getElementById('btnGenerar').style.display='inline-block';
  
  if(!currentScheduleId) {
    document.getElementById('btnSave').style.display='inline-block';
    document.getElementById('btnUpdate').style.display='none';
  } else {
    document.getElementById('btnSave').style.display='none';
    document.getElementById('btnUpdate').style.display='inline-block';
  }

  if(lastUsedHeader && !currentScheduleId) showStatus('✅ '+dataRows.length+' materias importadas detectando encabezados.','success');
}

function mkTd(tr,val,cls){
  var td=document.createElement('td');
  td.className=cls;
  td.textContent=val;
  tr.appendChild(td);
}
function showStatus(msg,type){
  var bar=document.getElementById('statusBar');
  bar.style.display = ''; // Limpiar cualquier display:none insertado por botón limpiar
  bar.textContent=msg;
  bar.className='status-bar '+type;
}
function renderColMap(colMap){
  var required=['clave','grupo','materia','lunes','martes','miercoles','jueves','viernes'];
  var tags=document.getElementById('colTags');
  tags.innerHTML='';
  var labels={color:'Color',clave:'Clave',grupo:'Grupo',materia:'Materia',lunes:'Lunes',martes:'Martes',miercoles:'Miércoles',jueves:'Jueves',viernes:'Viernes',sabado:'Sábado',unidades:'Unidades'};
  for(var field in colMap){
    var sp=document.createElement('span');
    sp.className='col-tag';
    sp.textContent=(labels[field]||field)+' → col '+(colMap[field]+1);
    tags.appendChild(sp);
  }
  required.forEach(function(f){
    if(!(f in colMap)){
      var sp=document.createElement('span');
      sp.className='col-tag miss';
      sp.textContent=(labels[f]||f)+' ✗';
      tags.appendChild(sp);
    }
  });
  document.getElementById('colMap').classList.add('visible');
}

document.addEventListener('paste',function(e){
  // Solo procesar si el foco NO está en un input normal (para que no interfiera con modal)
  if(e.target.tagName==='INPUT' || e.target.tagName==='TEXTAREA') return;
  var text=e.clipboardData.getData('text/plain');
  if(!text||!text.trim()) return;
  e.preventDefault();
  document.getElementById('rawInput').value = text;
  process(text);
});
function processRaw(){
  var text=document.getElementById('rawInput').value;
  if(!text.trim()){showStatus('El área está vacía.','error');return;}
  process(text);
}
function toggleRaw(){
  var a=document.getElementById('rawInput');
  a.style.display=a.style.display==='none'?'block':'none';
}
function clearAll(){
  document.getElementById('tbody').innerHTML='';
  document.getElementById('emptyState').style.display='block';
  document.getElementById('resultArea').style.display='none';
  document.getElementById('btnExport').style.display='none';
  document.getElementById('btnGenerar').style.display='none';
  document.getElementById('btnSave').style.display='none';
  document.getElementById('btnUpdate').style.display='none';
  document.getElementById('listasSection').style.display='none';
  document.getElementById('listasContainer').innerHTML='';
  document.getElementById('rawInput').value='';
  document.getElementById('rawInput').style.display='none';
  document.getElementById('statusBar').className='status-bar';
  document.getElementById('statusBar').style.display='none'; // hide it visually too
  document.getElementById('colMap').classList.remove('visible');
  window._data=null;
  currentScheduleId=null;
  loadSavedList();
}
function exportJSON(){
  if(!window._data) return;
  var blob=new Blob([JSON.stringify(window._data,null,2)],{type:'application/json'});
  var a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='horarios.json';
  a.click();
}

/* ════════════════════════════════════════════
   MODAL — fechas especiales
   ════════════════════════════════════════════ */
function abrirModal(){
  document.getElementById('overlay').classList.add('open');
}
function cerrarModal(){
  document.getElementById('overlay').classList.remove('open');
}
document.getElementById('overlay').addEventListener('click',function(e){
  if(e.target===this) cerrarModal();
});

function addSpecial(fecha,label,tipo){
  var list=document.getElementById('specialList');
  var item=document.createElement('div');
  item.className='special-item';
  item.innerHTML=
    '<input type="date" value="'+(fecha||'')+'" placeholder="Fecha">' +
    '<input type="text" value="'+(label||'')+'" placeholder="Descripción (ej. Día de Muertos)">' +
    '<select>'+
      '<option value="festivo"'+(tipo==='festivo'?' selected':'')+'>🔴 Festivo</option>'+
      '<option value="suspension"'+(tipo==='suspension'?' selected':'')+'>🟡 Suspensión</option>'+
    '</select>'+
    '<button class="rm-btn" onclick="this.parentElement.remove()">✕</button>';
  list.appendChild(item);
}

/* ════════════════════════════════════════════
   GENERACIÓN DE LISTAS
   ════════════════════════════════════════════ */
function generarListas(){
  var inicio=document.getElementById('fechaInicio').value;
  var fin=document.getElementById('fechaFin').value;
  var numUnidades=parseInt(document.getElementById('numUnidades').value)||3;
  if(!inicio||!fin){alert('Por favor ingresa las fechas del periodo.');return;}

  var dInicio=new Date(inicio+'T00:00:00');
  var dFin=new Date(fin+'T00:00:00');
  if(dFin<=dInicio){alert('La fecha de fin debe ser posterior al inicio.');return;}

  // Recopilar fechas especiales
  var especiales={};
  document.querySelectorAll('#specialList .special-item').forEach(function(item){
    var inputs=item.querySelectorAll('input');
    var selects=item.querySelectorAll('select');
    var f=inputs[0].value;
    var label=inputs[1].value||'Especial';
    var tipo=selects[0].value;
    if(f) especiales[f]={label:label,tipo:tipo};
  });

  cerrarModal();

  var container=document.getElementById('listasContainer');
  container.innerHTML='';
  document.getElementById('listasSection').style.display='block';

  if(!window._data||!window._data.length){alert('Primero importa el horario.');return;}

  window._data.forEach(function(mat,idx){
    // Detectar qué días tiene esta materia
    var diasMateria=[];
    DAYS.forEach(function(day){
      if(mat[day]&&mat[day].trim()!=='') diasMateria.push(day);
    });
    if(!diasMateria.length) return;

    // Generar todas las fechas del semestre para esos días
    var todasFechas=[];
    var cur=new Date(dInicio);
    while(cur<=dFin){
      var dow=cur.getDay(); // 0=dom,1=lun,2=mar,3=mie,4=jue,5=vie,6=sab
      diasMateria.forEach(function(day){
        if(DAY_NUM[day]===dow){
          var key=cur.toISOString().slice(0,10);
          todasFechas.push({
            date:new Date(cur),
            key:key,
            label:pad(cur.getDate())+'.'+MESES[cur.getMonth()],
            dayName:DAY_LABEL[day],
            especial:especiales[key]||null
          });
        }
      });
      cur.setDate(cur.getDate()+1);
    }
    // Ordenar por fecha
    todasFechas.sort(function(a,b){return a.date-b.date;});

    // Dividir en unidades (igual tamaño aproximado, sobrantes a la última)
    var totalFechas=todasFechas.length;
    var fechasPorUnidad=Math.max(1, Math.floor(totalFechas/numUnidades));

    // Construir card
    var card=document.createElement('div');
    card.className='lista-card';

    var diasStr=diasMateria.map(function(d){return DAY_LABEL[d];}).join(', ');
    card.innerHTML=
      '<div class="lista-card-header">'+
        '<div class="mat-info">'+
          '<div class="mat-nombre">'+esc(mat.materia||'Sin nombre')+'</div>'+
          '<div class="mat-sub">'+esc(mat.clave)+' · Grupo '+esc(mat.grupo)+'</div>'+
        '</div>'+
        '<div class="mat-dias-badge">'+esc(diasStr)+' · '+totalFechas+' sesiones</div>'+
      '</div>';

    // Tabla lista
    var wrapper=document.createElement('div');
    wrapper.className='lista-wrapper';

    var tabla=document.createElement('table');
    tabla.className='lista';
    tabla.id='lista-'+idx;

    /* ── THEAD fila 1: nombre de día ── */
    var thead=document.createElement('thead');
    var trDia=document.createElement('tr');

    // Celdas fijas
    appendTh(trDia,'Nombre','th-nombre',2);        // rowspan 2
    appendTh(trDia,'Email','th-email',2);
    appendTh(trDia,'DIAGNÓSTICO','th-diag',2);

    // Columnas de fechas por unidad
    var unidadActual=0;
    var contadorEnUnidad=0;

    todasFechas.forEach(function(f,i){
      var unidadIdx=Math.min(numUnidades - 1, Math.floor(i/fechasPorUnidad));
      if(unidadIdx!==unidadActual){
        // Agregar 5 actividades por defecto al finalizar la unidad anterior
        if (unidadActual !== -1) {
          for(var act=1; act<=5; act++){
            var thA = document.createElement('th');
            thA.className = 'th-actividad';
            thA.rowSpan = 2;
            thA.textContent = 'A' + act;
            thA.title = 'Actividad ' + act;
            trDia.appendChild(thA);
          }
        }
        unidadActual=unidadIdx;
        contadorEnUnidad=0;
      }
      if(contadorEnUnidad===0){
        var thU=document.createElement('th');
        thU.className='th-unidad';
        thU.rowSpan=2;
        thU.textContent='Unidad '+(unidadIdx+1);
        trDia.appendChild(thU);
      }
      var thD=document.createElement('th');
      thD.className='th-diasem';
      thD.textContent=f.dayName.substring(0,3);
      trDia.appendChild(thD);
      contadorEnUnidad++;
    });
    // Agregar 5 actividades de la última unidad
    for(var act=1; act<=5; act++){
      var thA = document.createElement('th');
      thA.className = 'th-actividad';
      thA.rowSpan = 2;
      thA.textContent = 'A' + act;
      thA.title = 'Actividad ' + act;
      trDia.appendChild(thA);
    }

    appendTh(trDia,'Asistencias','th-asistencias',2);
    thead.appendChild(trDia);

    /* ── THEAD fila 2: fechas ── */
    var trFecha=document.createElement('tr');
    unidadActual=-1;
    contadorEnUnidad=0;

    todasFechas.forEach(function(f,i){
      var unidadIdx=Math.min(numUnidades - 1, Math.floor(i/fechasPorUnidad));
      if(unidadIdx!==unidadActual){
        unidadActual=unidadIdx;
        contadorEnUnidad=0;
      }
      var thF=document.createElement('th');
      thF.className='th-fecha'+(f.especial?' '+f.especial.tipo:'');
      thF.textContent=f.label;
      thF.title=(f.especial?'['+f.especial.tipo.toUpperCase()+'] '+f.especial.label+' — ':'')+f.key;
      thF.dataset.key=f.key;
      thF.dataset.listIdx=idx;
      thF.addEventListener('click',function(){toggleEspecialHeader(this,idx);});
      trFecha.appendChild(thF);
      contadorEnUnidad++;
    });

    thead.appendChild(trFecha);
    tabla.appendChild(thead);

    /* ── TBODY: 30 filas de alumnos ── */
    var tbody2=document.createElement('tbody');
    for(var r=0;r<30;r++){
      var tr2=document.createElement('tr');
      if(r===0) tr2.classList.add('placeholder');

      var tdNom=document.createElement('td');
      tdNom.className='td-nombre';
      tdNom.contentEditable='true';
      tdNom.textContent=r===0?'Nombre':'';
      tr2.appendChild(tdNom);

      var tdEmail=document.createElement('td');
      tdEmail.className='td-email';
      tdEmail.contentEditable='true';
      tdEmail.textContent='';
      tr2.appendChild(tdEmail);

      var tdDiag=document.createElement('td');
      tdDiag.className='td-diag';
      tdDiag.contentEditable='true';
      tr2.appendChild(tdDiag);

      unidadActual=-1;
      contadorEnUnidad=0;

      todasFechas.forEach(function(f,i){
        var unidadIdx=Math.min(numUnidades - 1, Math.floor(i/fechasPorUnidad));
        if(unidadIdx!==unidadActual){
          if(unidadActual !== -1) {
            // Agregar 5 actividades por defecto al finalizar la unidad anterior
            for(var act=1; act<=5; act++){
              var tdA = document.createElement('td');
              tdA.className = 'td-actividad';
              tdA.contentEditable = 'true';
              tr2.appendChild(tdA);
            }
          }
          unidadActual=unidadIdx;
          contadorEnUnidad=0;
          var tdU=document.createElement('td');
          tdU.className='td-unidad';
          tr2.appendChild(tdU);
        }
        var tdF=document.createElement('td');
        tdF.className='td-fecha'+(f.especial?' '+f.especial.tipo:'');
        tdF.dataset.key=f.key;
        tdF.dataset.listIdx=idx;
        tdF.addEventListener('click',function(){toggleEspecialCell(this,idx);});
        tr2.appendChild(tdF);
        contadorEnUnidad++;
      });
      // Agregar 5 actividades de la última unidad
      for(var act=1; act<=5; act++){
        var tdA = document.createElement('td');
        tdA.className = 'td-actividad';
        tdA.contentEditable = 'true';
        tr2.appendChild(tdA);
      }

      var tdAs=document.createElement('td');
      tdAs.className='td-asistencias';
      tdAs.textContent='';
      tr2.appendChild(tdAs);

      tbody2.appendChild(tr2);
    }
    tabla.appendChild(tbody2);
    wrapper.appendChild(tabla);
    card.appendChild(wrapper);
    container.appendChild(card);
  });

  document.getElementById('listasSection').scrollIntoView({behavior:'smooth'});
}

function pad(n){return n<10?'0'+n:String(n);}
function appendTh(tr,text,cls,rowspan){
  var th=document.createElement('th');
  th.className=cls;
  th.textContent=text;
  if(rowspan) th.rowSpan=rowspan;
  tr.appendChild(th);
  return th;
}

function toggleEspecialHeader(thEl,listIdx){
  var key=thEl.dataset.key;
  if(thEl.classList.contains('festivo')){
    thEl.classList.remove('festivo');
    thEl.classList.add('suspension');
    markColumn(listIdx,key,'suspension');
  } else if(thEl.classList.contains('suspension')){
    thEl.classList.remove('suspension');
    markColumn(listIdx,key,'');
  } else {
    thEl.classList.add('festivo');
    markColumn(listIdx,key,'festivo');
  }
}

function toggleEspecialCell(tdEl){
  if(tdEl.classList.contains('festivo')){
    tdEl.classList.remove('festivo');
    tdEl.classList.add('suspension');
  } else if(tdEl.classList.contains('suspension')){
    tdEl.classList.remove('suspension');
  } else {
    tdEl.classList.add('festivo');
  }
}

function markColumn(listIdx,key,tipo){
  var tabla=document.getElementById('lista-'+listIdx);
  if(!tabla) return;
  tabla.querySelectorAll('td[data-key="'+key+'"]').forEach(function(td){
    td.classList.remove('festivo','suspension');
    if(tipo) td.classList.add(tipo);
  });
}

// Cargar la lista al iniciar
document.addEventListener('DOMContentLoaded', function() {
  loadSavedList();
});
