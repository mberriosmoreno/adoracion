const API_URL = 'https://script.google.com/macros/s/AKfycbyWn0dsA-9gG16YLGzn7HLaNQIqRxLWh_n4xWn5VO2_IdS-tT074ckEYOb1xwFNLYeQGg/exec';

const state = { data: null, cargado: false, error: null, programaActual: null };
const DIAS = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

function hoyEnNicaragua() {
  const ahora = new Date();
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Managua', year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);
}
function fechaISOaLocal(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); }
function formatearFechaLarga(iso) { const d = fechaISOaLocal(iso); return `${capitalizar(DIAS[d.getDay()])} ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`; }
function capitalizar(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function proximoLunesISO() {
  const hoyISO = hoyEnNicaragua();
  const hoy = fechaISOaLocal(hoyISO);
  const dia = hoy.getDay();
  let delta = (1 - dia + 7) % 7;
  if (delta === 0 && dia === 1) delta = 0;
  const prox = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + delta);
  return toISO(prox);
}
function toISO(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

function seleccionarPrograma(programas) {
  if (!programas || !programas.length) return null;
  const hoyISO = hoyEnNicaragua();
  const proxLun = proximoLunesISO();
  const activos = programas.filter(p => p.Estado !== 'Cancelado');
  const exacto = activos.find(p => p.Fecha === proxLun);
  if (exacto) return exacto;
  const futuros = activos.filter(p => p.Fecha >= hoyISO).sort((a, b) => a.Fecha.localeCompare(b.Fecha));
  return futuros.length ? futuros[0] : null;
}

function setStatus(kind, text) {
  const el = document.getElementById('status'); const txt = document.getElementById('status-text');
  if (!el || !txt) return;
  el.className = 'status is-' + kind; txt.textContent = text;
}

async function cargarDatos() {
  setStatus('loading', 'Cargando…');
  mostrarSolo('programa', 'loading'); mostrarSolo('equipos', 'loading'); mostrarSolo('canciones', 'loading');
  
  const timerAviso = setTimeout(() => { 
    document.querySelectorAll('.loading-card p').forEach(t => t.textContent = 'Conectando con la nube... un momento.'); 
  }, 3000);

  try {
    const resp = await fetch(API_URL, { method: 'GET', redirect: 'follow' });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const json = await resp.json();
    if (!json || json.ok !== true) throw new Error((json && json.error) || 'Respuesta inválida');
    
    const d = json.data || {};
    state.data = { programas: d.programas || [], equipos: d.equipos || [], canciones: d.canciones || [] };
    state.error = null; 
    state.cargado = true;
    state.programaActual = seleccionarPrograma(state.data.programas);
    setStatus('ok', 'Actualizado');
  } catch (err) {
    state.error = err.message || 'Error desconocido';
    state.cargado = true; 
    state.programaActual = null; 
    setStatus('error', 'Error de conexión');
  } finally {
    clearTimeout(timerAviso);
    document.querySelectorAll('.loading-card p').forEach((t, i) => { 
      t.textContent = ['Cargando el programa…','Cargando los equipos…','Cargando el repertorio…'][i]; 
    });
    renderTodo();
  }
}

function renderTodo() { renderPrograma(); renderEquipos(); renderCanciones(); }

function mostrarSolo(vista, estado) {
  const ids = { programa: ['programa-loading','programa-error','programa-empty','programa-content'], equipos: ['equipos-loading','equipos-error','equipos-empty','equipos-content'], canciones: ['canciones-loading','canciones-error','canciones-empty','canciones-content'] };
  const [ld, er, em, ct] = ids[vista].map(id => document.getElementById(id));
  if (!ld || !er || !em || !ct) return;
  [ld, er, em, ct].forEach(el => el.classList.add('hidden'));
  const target = [ld, er, em, ct][{loading:0,error:1,empty:2,content:3}[estado]];
  if (target) target.classList.remove('hidden');
}

function renderPrograma() {
  if (!state.cargado) { mostrarSolo('programa', 'loading'); return; }
  if (state.error) { document.getElementById('programa-error-msg').textContent = state.error; mostrarSolo('programa', 'error'); return; }
  const prog = state.programaActual;
  if (!prog) { mostrarSolo('programa', 'empty'); return; }
  document.getElementById('prog-nombre').textContent = prog.Nombre_encuentro || 'Encuentro';
  document.getElementById('prog-fecha').textContent = formatearFechaLarga(prog.Fecha);
  document.getElementById('prog-hora').textContent = prog.Hora || '—';
  document.getElementById('prog-lugar').textContent = prog.Lugar || '—';
  const badge = document.getElementById('prog-estado');
  badge.textContent = prog.Estado || '—';
  badge.className = 'badge ' + (prog.Estado === 'Confirmado' ? 'is-confirmado' : prog.Estado === 'Cancelado' ? 'is-cancelado' : '');
  renderEquipoEnLista('prog-equipo-a', 'A', prog.ID_programa); 
  renderEquipoEnLista('prog-equipo-b', 'B', prog.ID_programa); 
  renderCancionesEnLista('prog-canciones', prog.ID_programa);
  mostrarSolo('programa', 'content');
}

function renderEquipos() {
  if (!state.cargado) { mostrarSolo('equipos', 'loading'); return; }
  if (state.error) { document.getElementById('equipos-error-msg').textContent = state.error; mostrarSolo('equipos', 'error'); return; }
  const prog = state.programaActual;
  if (!prog) { mostrarSolo('equipos', 'empty'); return; }
  document.getElementById('equipos-context').textContent = `Encuentro: ${prog.Nombre_encuentro} · ${formatearFechaLarga(prog.Fecha)} · ${prog.Hora || ''} · ${prog.Lugar || ''}`.trim();
  renderEquipoEnLista('equipos-a', 'A', prog.ID_programa); 
  renderEquipoEnLista('equipos-b', 'B', prog.ID_programa);
  mostrarSolo('equipos', 'content');
}

function renderEquipoEnLista(ulId, equipo, idPrograma) {
  const ul = document.getElementById(ulId); if (!ul) return;
  ul.innerHTML = '';
  const miembros = (state.data.equipos || []).filter(e => e.ID_programa === idPrograma && e.Equipo === equipo).sort((a, b) => a.Orden - b.Orden);
  if (!miembros.length) { ul.innerHTML = '<li class="empty-msg">Sin integrantes asignados</li>'; return; }
  miembros.forEach(m => { ul.innerHTML += `<li><span class="persona">${m.Nombre_integrante}</span><span class="funcion">${m.Funcion_o_instrumento || ''}</span></li>`; });
}

function renderCanciones() {
  if (!state.cargado) { mostrarSolo('canciones', 'loading'); return; }
  if (state.error) { document.getElementById('canciones-error-msg').textContent = state.error; mostrarSolo('canciones', 'error'); return; }
  const prog = state.programaActual;
  if (!prog) { mostrarSolo('canciones', 'empty'); return; }
  document.getElementById('canciones-context').textContent = `Encuentro: ${prog.Nombre_encuentro} · ${formatearFechaLarga(prog.Fecha)}`.trim();
  const hay = renderCancionesEnLista('canciones-lista', prog.ID_programa);
  if (!hay) { mostrarSolo('canciones', 'empty'); return; }
  mostrarSolo('canciones', 'content');
}

function renderCancionesEnLista(olId, idPrograma) {
  const ol = document.getElementById(olId); if (!ol) return false;
  ol.innerHTML = '';
  const canciones = (state.data.canciones || []).filter(c => c.ID_programa === idPrograma).sort((a, b) => a.Orden - b.Orden);
  
  if (!canciones.length) { ol.innerHTML = '<li class="empty-msg">Sin canciones programadas</li>'; return false; }

  canciones.forEach(c => {
    const li = document.createElement('li');
    const btnHtml = c.Notas 
      ? `<button class="btn-ver-letra" data-titulo="${c.Titulo_cancion}" data-tono="${c.Tonalidad || '—'}" data-letra="${c.Notas.replace(/"/g, '&quot;')}">Ver letra</button>` 
      : '';

    li.innerHTML = `
      <span class="song-num" aria-hidden="true">${c.Orden}</span>
      <div>
        <div class="song-title">${c.Titulo_cancion}</div>
        ${c.Artista_o_version ? `<div class="song-artist">${c.Artista_o_version}</div>` : ''}
      </div>
      <div class="song-actions">
        <span class="song-key">${c.Tonalidad || '—'}</span>
        ${btnHtml}
      </div>
    `;
    ol.appendChild(li);
  });
  return true;
}

// ====== LÓGICA DE LA VENTANA MODAL Y TRANSPOSICIÓN ======
const modal = document.getElementById('modal-letra');
const modalTitulo = document.getElementById('modal-titulo');
const modalTono = document.getElementById('modal-tono');
const modalTexto = document.getElementById('modal-letra-texto');
const modalClose = document.getElementById('modal-close');
const btnSubir = document.getElementById('btn-subir-tono');
const btnBajar = document.getElementById('btn-bajar-tono');

let letraOriginal = "";
let tonoOriginal = "C";
let semitonos = 0; // Contador de cambios

const NOTAS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTAS_BEMOLES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

function transponerAcordes(texto, semitonos) {
  // Busca acordes comunes (C, G, Am, F#m, etc.) que estén solos o entre corchetes
  return texto.replace(/\b([A-G][#b]?m?(?:aj|dim|aug|sus|add)?[0-9]*)\b/g, (match) => {
    let notaBase = match.charAt(0);
    let alteracion = match.charAt(1) === '#' || match.charAt(1) === 'b' ? match.charAt(1) : '';
    let sufijo = match.substring(1 + alteracion.length);
    
    let notaCompleta = notaBase + alteracion;
    let index = NOTAS.indexOf(notaCompleta);
    if (index === -1) index = NOTAS_BEMOLES.indexOf(notaCompleta);
    
    if (index !== -1) {
      let nuevoIndex = (index + semitonos + 12) % 12;
      return NOTAS[nuevoIndex] + sufijo; // Devolvemos en sostenidos para simplificar
    }
    return match;
  });
}

function actualizarModal() {
  modalTexto.innerHTML = transponerAcordes(letraOriginal, semitonos).replace(/\n/g, '<br>');
  // Mostrar el tono actualizado (si es un acorde válido)
  const tonoActual = transponerAcordes(tonoOriginal, semitonos);
  modalTono.textContent = tonoActual;
}

function abrirModal(titulo, tono, letra) {
  if (!modal) return;
  modalTitulo.textContent = titulo;
  letraOriginal = letra;
  tonoOriginal = tono || 'C';
  semitonos = 0;
  
  actualizarModal();
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function cerrarModal() {
  if (!modal) return;
  modal.classList.add('hidden');
  document.body.style.overflow = '';
}

document.getElementById('contenido').addEventListener('click', (e) => {
  if (e.target && e.target.classList.contains('btn-ver-letra')) {
    const btn = e.target;
    abrirModal(btn.dataset.titulo, btn.dataset.tono, btn.dataset.letra);
  }
});

if(btnSubir) btnSubir.addEventListener('click', () => { semitonos++; actualizarModal(); });
if(btnBajar) btnBajar.addEventListener('click', () => { semitonos--; actualizarModal(); });

if(modalClose) modalClose.addEventListener('click', cerrarModal);
if(modal) modal.addEventListener('click', (e) => { if (e.target === modal) cerrarModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) cerrarModal(); });

function activarVista(nombre) {
  document.querySelectorAll('.nav-btn').forEach(btn => { const on = btn.dataset.view === nombre; btn.classList.toggle('is-active', on); btn.setAttribute('aria-selected', on ? 'true' : 'false'); });
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.getElementById('view-' + nombre).classList.remove('hidden');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('footer-year').textContent = new Date().getFullYear();
  document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', () => activarVista(btn.dataset.view)));
  document.getElementById('programa-retry').addEventListener('click', cargarDatos);
  document.getElementById('equipos-retry').addEventListener('click', cargarDatos);
  document.getElementById('canciones-retry').addEventListener('click', cargarDatos);
  cargarDatos();
});
