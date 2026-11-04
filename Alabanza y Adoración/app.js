const API_URL = 'https://script.google.com/macros/s/AKfycbyWn0dsA-9gG16YLGzn7HLaNQIqRxLWh_n4xWn5VO2_IdS-tT074ckEYOb1xwFNLYeQGg/exec';

const state = {
  data: null,
  cargado: false,
  error: null,
  programaActual: null
};

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

// =====================================================
// FECHAS
// =====================================================

function hoyEnNicaragua() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Managua',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

function fechaISOaLocal(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatearFechaLarga(iso) {
  const d = fechaISOaLocal(iso);
  return `${capitalizar(DIAS[d.getDay()])} ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
}

function capitalizar(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function proximoLunesISO() {
  const hoy = fechaISOaLocal(hoyEnNicaragua());
  const delta = (1 - hoy.getDay() + 7) % 7;

  return toISO(new Date(
    hoy.getFullYear(),
    hoy.getMonth(),
    hoy.getDate() + delta
  ));
}

function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// =====================================================
// SELECCIÓN DEL PROGRAMA
// =====================================================

function seleccionarPrograma(programas) {
  if (!programas || !programas.length) return null;

  const hoyISO = hoyEnNicaragua();
  const proxLun = proximoLunesISO();

  const activos = programas.filter(p => p.Estado !== 'Cancelado');
  const exacto = activos.find(p => p.Fecha === proxLun);

  if (exacto) return exacto;

  const futuros = activos
    .filter(p => p.Fecha >= hoyISO)
    .sort((a, b) => a.Fecha.localeCompare(b.Fecha));

  return futuros.length ? futuros[0] : null;
}

// =====================================================
// ESTADO DE CONEXIÓN
// =====================================================

function setStatus(kind, text) {
  const el = document.getElementById('status');
  const txt = document.getElementById('status-text');

  if (!el || !txt) return;

  el.className = 'status is-' + kind;
  txt.textContent = text;
}

// =====================================================
// CARGAR DATOS
// =====================================================

async function cargarDatos() {
  setStatus('loading', 'Cargando…');

  mostrarSolo('programa', 'loading');
  mostrarSolo('equipos', 'loading');
  mostrarSolo('canciones', 'loading');

  const timerAviso = setTimeout(() => {
    document.querySelectorAll('.loading-card p').forEach(t => {
      t.textContent = 'Conectando con la nube... un momento.';
    });
  }, 3000);

  try {
    const resp = await fetch(API_URL, {
      method: 'GET',
      redirect: 'follow'
    });

    if (!resp.ok) {
      throw new Error('HTTP ' + resp.status);
    }

    const json = await resp.json();

    if (!json || json.ok !== true) {
      throw new Error((json && json.error) || 'Respuesta inválida');
    }

    const d = json.data || json;

    state.data = {
      programas: d.programas || [],
      equipos: d.equipos || [],
      canciones: d.canciones || []
    };

    console.log('Datos recibidos:', state.data);

    console.table(state.data.canciones.map(c => ({
      cancion: c.Titulo_cancion,
      enlace: obtenerCampoYouTube(c),
      enlaceValido: obtenerUrlYouTube(obtenerCampoYouTube(c))
    })));

    state.error = null;
    state.cargado = true;
    state.programaActual = seleccionarPrograma(state.data.programas);

    setStatus('ok', 'Actualizado');

  } catch (err) {
    console.error('Error al cargar los datos:', err);

    state.error = err.message || 'Error desconocido';
    state.cargado = true;
    state.programaActual = null;

    setStatus('error', 'Error de conexión');

  } finally {
    clearTimeout(timerAviso);
    renderTodo();
  }
}

// =====================================================
// RENDERIZADO GENERAL
// =====================================================

function renderTodo() {
  renderPrograma();
  renderEquipos();
  renderCanciones();
}

function mostrarSolo(vista, estado) {
  const ids = {
    programa: [
      'programa-loading',
      'programa-error',
      'programa-empty',
      'programa-content'
    ],
    equipos: [
      'equipos-loading',
      'equipos-error',
      'equipos-empty',
      'equipos-content'
    ],
    canciones: [
      'canciones-loading',
      'canciones-error',
      'canciones-empty',
      'canciones-content'
    ]
  };

  if (!ids[vista]) return;

  const elementos = ids[vista].map(id => document.getElementById(id));

  if (elementos.some(el => !el)) return;

  elementos.forEach(el => el.classList.add('hidden'));

  const indice = {
    loading: 0,
    error: 1,
    empty: 2,
    content: 3
  }[estado];

  if (indice !== undefined) {
    elementos[indice].classList.remove('hidden');
  }
}

// =====================================================
// PROGRAMA
// =====================================================

function renderPrograma() {
  if (!state.cargado) {
    mostrarSolo('programa', 'loading');
    return;
  }

  if (state.error) {
    const error = document.getElementById('programa-error-msg');
    if (error) error.textContent = state.error;
    mostrarSolo('programa', 'error');
    return;
  }

  const prog = state.programaActual;

  if (!prog) {
    mostrarSolo('programa', 'empty');
    return;
  }

  const asignaciones = {
    'prog-nombre': prog.Nombre_encuentro || 'Encuentro',
    'prog-fecha': formatearFechaLarga(prog.Fecha),
    'prog-hora': prog.Hora || '—',
    'prog-lugar': prog.Lugar || '—'
  };

  Object.entries(asignaciones).forEach(([id, valor]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = valor;
  });

  const badge = document.getElementById('prog-estado');

  if (badge) {
    badge.textContent = prog.Estado || '—';
    badge.className = 'badge ' + (
      prog.Estado === 'Confirmado'
        ? 'is-confirmado'
        : prog.Estado === 'Cancelado'
          ? 'is-cancelado'
          : ''
    );
  }

  renderEquipoEnLista('prog-equipo-a', 'A', prog.ID_programa);
  renderEquipoEnLista('prog-equipo-b', 'B', prog.ID_programa);
  renderCancionesEnLista('prog-canciones', prog.ID_programa);

  mostrarSolo('programa', 'content');
}

// =====================================================
// EQUIPOS
// =====================================================

function renderEquipos() {
  if (!state.cargado) {
    mostrarSolo('equipos', 'loading');
    return;
  }

  if (state.error) {
    const error = document.getElementById('equipos-error-msg');
    if (error) error.textContent = state.error;
    mostrarSolo('equipos', 'error');
    return;
  }

  const prog = state.programaActual;

  if (!prog) {
    mostrarSolo('equipos', 'empty');
    return;
  }

  const contexto = document.getElementById('equipos-context');

  if (contexto) {
    contexto.textContent =
      `Encuentro: ${prog.Nombre_encuentro} · ${formatearFechaLarga(prog.Fecha)} · ${prog.Hora || ''} · ${prog.Lugar || ''}`.trim();
  }

  renderEquipoEnLista('equipos-a', 'A', prog.ID_programa);
  renderEquipoEnLista('equipos-b', 'B', prog.ID_programa);

  mostrarSolo('equipos', 'content');
}

function renderEquipoEnLista(ulId, equipo, idPrograma) {
  const ul = document.getElementById(ulId);
  if (!ul) return;

  ul.innerHTML = '';

  const miembros = (state.data?.equipos || [])
    .filter(e =>
      String(e.ID_programa).trim() === String(idPrograma).trim() &&
      String(e.Equipo).trim() === equipo
    )
    .sort((a, b) => Number(a.Orden) - Number(b.Orden));

  if (!miembros.length) {
    ul.innerHTML = '<li class="empty-msg">Sin integrantes asignados</li>';
    return;
  }

  miembros.forEach(m => {
    const li = document.createElement('li');

    const persona = document.createElement('span');
    persona.className = 'persona';
    persona.textContent = m.Nombre_integrante || '';

    const funcion = document.createElement('span');
    funcion.className = 'funcion';
    funcion.textContent = m.Funcion_o_instrumento || '';

    li.append(persona, funcion);
    ul.appendChild(li);
  });
}

// =====================================================
// CANCIONES
// =====================================================

function renderCanciones() {
  if (!state.cargado) {
    mostrarSolo('canciones', 'loading');
    return;
  }

  if (state.error) {
    const error = document.getElementById('canciones-error-msg');
    if (error) error.textContent = state.error;
    mostrarSolo('canciones', 'error');
    return;
  }

  const prog = state.programaActual;

  if (!prog) {
    mostrarSolo('canciones', 'empty');
    return;
  }

  const contexto = document.getElementById('canciones-context');

  if (contexto) {
    contexto.textContent =
      `Encuentro: ${prog.Nombre_encuentro} · ${formatearFechaLarga(prog.Fecha)}`;
  }

  const hay = renderCancionesEnLista('canciones-lista', prog.ID_programa);

  mostrarSolo('canciones', hay ? 'content' : 'empty');
}

// =====================================================
// YOUTUBE
// =====================================================

function obtenerCampoYouTube(cancion) {
  if (!cancion) return '';

  const campo = Object.keys(cancion).find(
    key => key.trim().toLowerCase() === 'link_youtube'
  );

  return campo ? String(cancion[campo] || '').trim() : '';
}

function obtenerUrlYouTube(url) {
  if (!url) return '';

  try {
    let texto = String(url).trim();

    if (!texto) return '';

    if (!/^https?:\/\//i.test(texto)) {
      texto = 'https://' + texto.replace(/^\/+/, '');
    }

    const enlace = new URL(texto);
    const dominio = enlace.hostname.toLowerCase().replace(/^www\./, '');

    const esYouTube =
      dominio === 'youtube.com' ||
      dominio.endsWith('.youtube.com') ||
      dominio === 'youtu.be';

    if (!esYouTube) return '';

    enlace.protocol = 'https:';
    return enlace.href;

  } catch (error) {
    console.warn('Enlace de YouTube inválido:', url);
    return '';
  }
}

// =====================================================
// LISTA DE CANCIONES
// =====================================================

function renderCancionesEnLista(olId, idPrograma) {
  const ol = document.getElementById(olId);
  if (!ol) return false;

  ol.innerHTML = '';

  const canciones = (state.data?.canciones || [])
    .filter(c =>
      String(c.ID_programa).trim() === String(idPrograma).trim()
    )
    .sort((a, b) => Number(a.Orden) - Number(b.Orden));

  if (!canciones.length) {
    ol.innerHTML = '<li class="empty-msg">Sin canciones programadas</li>';
    return false;
  }

  canciones.forEach(c => {
    const li = document.createElement('li');

    const numero = document.createElement('span');
    numero.className = 'song-num';
    numero.setAttribute('aria-hidden', 'true');
    numero.textContent = c.Orden || '';

    const informacion = document.createElement('div');

    const titulo = document.createElement('div');
    titulo.className = 'song-title';
    titulo.textContent = c.Titulo_cancion || '';

    informacion.appendChild(titulo);

    if (c.Artista_o_version) {
      const artista = document.createElement('div');
      artista.className = 'song-artist';
      artista.textContent = c.Artista_o_version;
      informacion.appendChild(artista);
    }

    const acciones = document.createElement('div');
    acciones.className = 'song-actions';

    const tono = document.createElement('span');
    tono.className = 'song-key';
    tono.textContent = c.Tonalidad || '—';
    acciones.appendChild(tono);

    // VER LETRA: solamente cuando hay contenido.
    if (c.Notas && String(c.Notas).trim() !== '') {
      const boton = document.createElement('button');

      boton.type = 'button';
      boton.className = 'btn-ver-letra';
      boton.textContent = 'Ver letra';

      boton.dataset.titulo = c.Titulo_cancion || '';
      boton.dataset.tono = c.Tonalidad || 'C';
      boton.dataset.letra = c.Notas || '';

      acciones.appendChild(boton);
    }

    // YOUTUBE: aparece exclusivamente en el repertorio.
    const enlaceOriginal = obtenerCampoYouTube(c);
    const enlaceValido = obtenerUrlYouTube(enlaceOriginal);

    if (enlaceValido) {
      const youtube = document.createElement('a');

      youtube.className = 'youtube-song-link';
      youtube.href = enlaceValido;
      youtube.target = '_blank';
      youtube.rel = 'noopener noreferrer';
      youtube.textContent = '▶ YouTube';

      youtube.setAttribute(
        'aria-label',
        'Abrir ' + (c.Titulo_cancion || 'canción') + ' en YouTube'
      );

      acciones.appendChild(youtube);
    }

    li.append(numero, informacion, acciones);
    ol.appendChild(li);
  });

  return true;
}

// =====================================================
// MODAL Y TRANSPOSICIÓN
// =====================================================

const modal = document.getElementById('modal-letra');
const modalTitulo = document.getElementById('modal-titulo');
const modalTono = document.getElementById('modal-tono');
const modalTexto = document.getElementById('modal-letra-texto');

const btnSubir = document.getElementById('btn-subir-tono');
const btnBajar = document.getElementById('btn-bajar-tono');

let letraOriginal = '';
let tonoOriginal = 'C';
let semitonos = 0;

const NOTAS = [
  'C', 'C#', 'D', 'D#', 'E', 'F',
  'F#', 'G', 'G#', 'A', 'A#', 'B'
];

const NOTAS_BEMOLES = [
  'C', 'Db', 'D', 'Eb', 'E', 'F',
  'Gb', 'G', 'Ab', 'A', 'Bb', 'B'
];

function transponerAcordes(texto, semitonos) {
  return texto.replace(
    /\b([A-G][#b]?(?:m|maj|min|dim|aug|sus|add)?[0-9]*)\b/g,
    match => {
      const notaBase = match.charAt(0);

      const alteracion =
        match.charAt(1) === '#' || match.charAt(1) === 'b'
          ? match.charAt(1)
          : '';

      const sufijo = match.substring(1 + alteracion.length);
      const notaCompleta = notaBase + alteracion;

      let index = NOTAS.indexOf(notaCompleta);

      if (index === -1) {
        index = NOTAS_BEMOLES.indexOf(notaCompleta);
      }

      if (index === -1) return match;

      const nuevoIndex = (index + semitonos + 120) % 12;
      return NOTAS[nuevoIndex] + sufijo;
    }
  );
}

function actualizarModal() {
  if (!modalTexto || !modalTono) return;

  modalTexto.textContent = transponerAcordes(
    letraOriginal,
    semitonos
  );

  modalTono.textContent = transponerAcordes(
    tonoOriginal,
    semitonos
  );
}

function abrirModal(titulo, tono, letra) {
  if (!modal) return;

  if (modalTitulo) {
    modalTitulo.textContent = titulo;
  }

  letraOriginal = letra || '';
  tonoOriginal = tono || 'C';
  semitonos = 0;

  actualizarModal();

  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function cerrarModal() {
  if (!modal) return;

  modal.classList.add('hidden');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

document.addEventListener('click', e => {
  const boton = e.target.closest('.btn-ver-letra');

  if (boton) {
    abrirModal(
      boton.dataset.titulo,
      boton.dataset.tono,
      boton.dataset.letra
    );
  }

  if (e.target.closest('#modal-close')) {
    cerrarModal();
  }

  if (e.target === modal) {
    cerrarModal();
  }
});

if (btnSubir) {
  btnSubir.addEventListener('click', () => {
    semitonos++;
    actualizarModal();
  });
}

if (btnBajar) {
  btnBajar.addEventListener('click', () => {
    semitonos--;
    actualizarModal();
  });
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) {
    cerrarModal();
  }
});

// =====================================================
// NAVEGACIÓN
// =====================================================

function activarVista(nombre) {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    const activa = btn.dataset.view === nombre;

    btn.classList.toggle('is-active', activa);
    btn.setAttribute('aria-selected', activa ? 'true' : 'false');
  });

  document.querySelectorAll('.view').forEach(vista => {
    vista.classList.add('hidden');
  });

  const vistaSeleccionada = document.getElementById('view-' + nombre);

  if (vistaSeleccionada) {
    vistaSeleccionada.classList.remove('hidden');
  }
}

// =====================================================
// INICIO
// =====================================================

document.addEventListener('DOMContentLoaded', () => {
  const footerYear = document.getElementById('footer-year');

  if (footerYear) {
    footerYear.textContent = new Date().getFullYear();
  }

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activarVista(btn.dataset.view);
    });
  });

  [
    'programa-retry',
    'equipos-retry',
    'canciones-retry'
  ].forEach(id => {
    const boton = document.getElementById(id);

    if (boton) {
      boton.addEventListener('click', cargarDatos);
    }
  });

  cargarDatos();
});
