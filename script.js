const API_URL = 'https://script.google.com/macros/s/AKfycbyWn0dsA-9gG16YLGzn7HLaNQIqRxLWh_n4xWn5VO2_IdS-tT074ckEYOb1xwFNLYeQGg/exec';

const state = {
  data: null,
  cargado: false,
  error: null,
  programaActual: null
};

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function hoyEnNicaragua() {
  const ahora = new Date();

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Managua',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(ahora);
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
  const hoyISO = hoyEnNicaragua();
  const hoy = fechaISOaLocal(hoyISO);
  const dia = hoy.getDay();

  let delta = (1 - dia + 7) % 7;

  if (delta === 0 && dia === 1) {
    delta = 0;
  }

  const prox = new Date(
    hoy.getFullYear(),
    hoy.getMonth(),
    hoy.getDate() + delta
  );

  return toISO(prox);
}

function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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

function setStatus(kind, text) {
  const el = document.getElementById('status');
  const txt = document.getElementById('status-text');

  if (!el || !txt) return;

  el.className = 'status is-' + kind;
  txt.textContent = text;
}

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

    const d = json.data || {};

    state.data = {
      programas: d.programas || [],
      equipos: d.equipos || [],
      canciones: d.canciones || []
    };

    // Diagnóstico: permite comprobar qué enlaces llegan desde Google Sheets.
    console.log('Canciones recibidas desde Google Sheets:', state.data.canciones);

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

    document.querySelectorAll('.loading-card p').forEach((t, i) => {
      t.textContent = [
        'Cargando el programa…',
        'Cargando los equipos…',
        'Cargando el repertorio…'
      ][i];
    });

    renderTodo();
  }
}

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

  const [ld, er, em, ct] = ids[vista].map(id => document.getElementById(id));

  if (!ld || !er || !em || !ct) return;

  [ld, er, em, ct].forEach(el => el.classList.add('hidden'));

  const indice = {
    loading: 0,
    error: 1,
    empty: 2,
    content: 3
  }[estado];

  const target = [ld, er, em, ct][indice];

  if (target) {
    target.classList.remove('hidden');
  }
}

function renderPrograma() {
  if (!state.cargado) {
    mostrarSolo('programa', 'loading');
    return;
  }

  if (state.error) {
    document.getElementById('programa-error-msg').textContent = state.error;
    mostrarSolo('programa', 'error');
    return;
  }

  const prog = state.programaActual;

  if (!prog) {
    mostrarSolo('programa', 'empty');
    return;
  }

  document.getElementById('prog-nombre').textContent = prog.Nombre_encuentro || 'Encuentro';
  document.getElementById('prog-fecha').textContent = formatearFechaLarga(prog.Fecha);
  document.getElementById('prog-hora').textContent = prog.Hora || '—';
  document.getElementById('prog-lugar').textContent = prog.Lugar || '—';

  const badge = document.getElementById('prog-estado');

  badge.textContent = prog.Estado || '—';
  badge.className = 'badge ' + (
    prog.Estado === 'Confirmado'
      ? 'is-confirmado'
      : prog.Estado === 'Cancelado'
        ? 'is-cancelado'
        : ''
  );

  renderEquipoEnLista('prog-equipo-a', 'A', prog.ID_programa);
  renderEquipoEnLista('prog-equipo-b', 'B', prog.ID_programa);
  renderCancionesEnLista('prog-canciones', prog.ID_programa);

  mostrarSolo('programa', 'content');
}

function renderEquipos() {
  if (!state.cargado) {
    mostrarSolo('equipos', 'loading');
    return;
  }

  if (state.error) {
    document.getElementById('equipos-error-msg').textContent = state.error;
    mostrarSolo('equipos', 'error');
    return;
  }

  const prog = state.programaActual;

  if (!prog) {
    mostrarSolo('equipos', 'empty');
    return;
  }

  document.getElementById('equipos-context').textContent =
    `Encuentro: ${prog.Nombre_encuentro} · ${formatearFechaLarga(prog.Fecha)} · ${prog.Hora || ''} · ${prog.Lugar || ''}`.trim();

  renderEquipoEnLista('equipos-a', 'A', prog.ID_programa);
  renderEquipoEnLista('equipos-b', 'B', prog.ID_programa);

  mostrarSolo('equipos', 'content');
}

function renderEquipoEnLista(ulId, equipo, idPrograma) {
  const ul = document.getElementById(ulId);

  if (!ul) return;

  ul.innerHTML = '';

  const miembros = (state.data.equipos || [])
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

    li.appendChild(persona);
    li.appendChild(funcion);
    ul.appendChild(li);
  });
}

function renderCanciones() {
  if (!state.cargado) {
    mostrarSolo('canciones', 'loading');
    return;
  }

  if (state.error) {
    document.getElementById('canciones-error-msg').textContent = state.error;
    mostrarSolo('canciones', 'error');
    return;
  }

  const prog = state.programaActual;

  if (!prog) {
    mostrarSolo('canciones', 'empty');
    return;
  }

  document.getElementById('canciones-context').textContent =
    `Encuentro: ${prog.Nombre_encuentro} · ${formatearFechaLarga(prog.Fecha)}`.trim();

  const hay = renderCancionesEnLista('canciones-lista', prog.ID_programa);

  if (!hay) {
    mostrarSolo('canciones', 'empty');
    return;
  }

  mostrarSolo('canciones', 'content');
}

/* =====================================================
   FUNCIONES PARA LOS ENLACES DE YOUTUBE
===================================================== */

// Lee el enlace aunque el nombre del campo venga con
// una variación de mayúsculas o un nombre alternativo.
function obtenerCampoYouTube(cancion) {
  if (!cancion) return '';

  return (
    cancion.Link_YouTube ||
    cancion.link_youtube ||
    cancion.LINK_YOUTUBE ||
    cancion.URL_YouTube ||
    cancion.Url_YouTube ||
    cancion.youtube ||
    ''
  ).toString().trim();
}

// Acepta enlaces habituales de YouTube y los normaliza.
function obtenerUrlYouTube(url) {
  if (!url) return '';

  try {
    let texto = String(url).trim();

    if (!texto) return '';

    // Si la celda contiene solo el enlace sin protocolo.
    if (!/^https?:\/\//i.test(texto)) {
      texto = 'https://' + texto.replace(/^\/+/, '');
    }

    const enlace = new URL(texto);

    const dominio = enlace.hostname
      .toLowerCase()
      .replace(/^www\./, '');

    const esYouTube =
      dominio === 'youtube.com' ||
      dominio.endsWith('.youtube.com') ||
      dominio === 'youtu.be';

    if (!esYouTube) {
      console.warn('El enlace no pertenece a YouTube:', texto);
      return '';
    }

    // Los enlaces se abren mediante HTTPS.
    enlace.protocol = 'https:';

    return enlace.href;

  } catch (error) {
    console.warn('No se pudo interpretar el enlace de YouTube:', url);
    return '';
  }
}

/* =====================================================
   RENDERIZADO DE LAS CANCIONES
===================================================== */

function renderCancionesEnLista(olId, idPrograma) {
  const ol = document.getElementById(olId);

  if (!ol) return false;

  ol.innerHTML = '';

  const canciones = (state.data.canciones || [])
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

    // Número de canción
    const numero = document.createElement('span');
    numero.className = 'song-num';
    numero.setAttribute('aria-hidden', 'true');
    numero.textContent = c.Orden || '';

    // Información de la canción
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

    // Contenedor de acciones
    const acciones = document.createElement('div');
    acciones.className = 'song-actions';

    // Tonalidad
    const tono = document.createElement('span');
    tono.className = 'song-key';
    tono.textContent = c.Tonalidad || '—';

    acciones.appendChild(tono);

    // Botón para ver la letra.
    // Es independiente del enlace de YouTube.
    if (c.Notas && String(c.Notas).trim() !== '') {
      const boton = document.createElement('button');

      boton.type = 'button';
      boton.className = 'btn-ver-letra';
      boton.textContent = 'Ver letra';

      boton.dataset.titulo = c.Titulo_cancion || '';
      boton.dataset.tono = c.Tonalidad || '—';
      boton.dataset.letra = c.Notas || '';
      boton.dataset.youtube = obtenerCampoYouTube(c);

      acciones.appendChild(boton);
    }

    // Enlace directo a YouTube.
    // Se muestra aunque la canción no tenga letra.
    const enlaceOriginal = obtenerCampoYouTube(c);
    const enlaceValido = obtenerUrlYouTube(enlaceOriginal);

    console.log(
      'YouTube:',
      c.Titulo_cancion,
      '| Campo recibido:',
      enlaceOriginal,
      '| Enlace válido:',
      enlaceValido
    );

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

    li.appendChild(numero);
    li.appendChild(informacion);
    li.appendChild(acciones);

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
const modalYouTube = document.getElementById('modal-youtube');

const btnSubir = document.getElementById('btn-subir-tono');
const btnBajar = document.getElementById('btn-bajar-tono');

let letraOriginal = '';
let tonoOriginal = 'C';
let semitonos = 0;

const NOTAS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTAS_BEMOLES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

function transponerAcordes(texto, semitonos) {
  return texto.replace(
    /\b([A-G][#b]?m?(?:aj|dim|aug|sus|add)?[0-9]*)\b/g,
    (match) => {
      let notaBase = match.charAt(0);
      let alteracion =
        match.charAt(1) === '#' || match.charAt(1) === 'b'
          ? match.charAt(1)
          : '';

      let sufijo = match.substring(1 + alteracion.length);
      let notaCompleta = notaBase + alteracion;

      let index = NOTAS.indexOf(notaCompleta);

      if (index === -1) {
        index = NOTAS_BEMOLES.indexOf(notaCompleta);
      }

      if (index !== -1) {
        let nuevoIndex = (index + semitonos + 12) % 12;
        return NOTAS[nuevoIndex] + sufijo;
      }

      return match;
    }
  );
}

function actualizarModal() {
  modalTexto.innerHTML = transponerAcordes(letraOriginal, semitonos)
    .replace(/\n/g, '<br>');

  const tonoActual = transponerAcordes(tonoOriginal, semitonos);
  modalTono.textContent = tonoActual;
}

function abrirModal(titulo, tono, letra, urlYouTube) {
  if (!modal) return;

  modalTitulo.textContent = titulo;
  letraOriginal = letra || '';
  tonoOriginal = tono || 'C';
  semitonos = 0;

  actualizarModal();

  const enlaceValido = obtenerUrlYouTube(urlYouTube);

  if (modalYouTube) {
    if (enlaceValido) {
      modalYouTube.href = enlaceValido;
      modalYouTube.classList.remove('hidden');
    } else {
      modalYouTube.removeAttribute('href');
      modalYouTube.classList.add('hidden');
    }
  }

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function cerrarModal() {
  if (!modal) return;

  modal.classList.add('hidden');
  document.body.style.overflow = '';
}

// Abrir la letra de la canción seleccionada.
document.getElementById('contenido').addEventListener('click', (e) => {
  const boton = e.target.closest('.btn-ver-letra');

  if (!boton) return;

  abrirModal(
    boton.dataset.titulo,
    boton.dataset.tono,
    boton.dataset.letra,
    boton.dataset.youtube
  );
});

// Controles de transposición.
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

// Cerrar ventana modal.
if (modalClose) {
  modalClose.addEventListener('click', cerrarModal);
}

if (modal) {
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      cerrarModal();
    }
  });
}

document.addEventListener('keydown', (e) => {
  if (
    e.key === 'Escape' &&
    modal &&
    !modal.classList.contains('hidden')
  ) {
    cerrarModal();
  }
});

// ====== NAVEGACIÓN ENTRE VISTAS ======

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

// ====== INICIO DE LA APLICACIÓN ======

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

  const programaRetry = document.getElementById('programa-retry');
  const equiposRetry = document.getElementById('equipos-retry');
  const cancionesRetry = document.getElementById('canciones-retry');

  if (programaRetry) {
    programaRetry.addEventListener('click', cargarDatos);
  }

  if (equiposRetry) {
    equiposRetry.addEventListener('click', cargarDatos);
  }

  if (cancionesRetry) {
    cancionesRetry.addEventListener('click', cargarDatos);
  }

  cargarDatos();
});
