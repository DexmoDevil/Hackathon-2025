// Inicializar mapa
const mapa = L.map('mapa-visualizador').setView([7.33, -76.72], 14);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(mapa);

let capaMapa = L.layerGroup().addTo(mapa);
let datosCargados = [];

const archivoInput = document.getElementById("archivo-spots");
const btnValidar = document.getElementById("btn-validar");
const mensajes = document.getElementById("mensajes-validacion");
const selectLote = document.getElementById("select-lote-preview");

// Manejo de carga de archivos CSV o XLSX
archivoInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const extension = file.name.split(".").pop().toLowerCase();
  if (extension === "csv") {
    Papa.parse(file, {
      header: true,
      complete: (results) => procesarDatos(results.data)
    });
  } else if (extension === "xlsx") {
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const hoja = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(hoja);
      procesarDatos(json);
    };
    reader.readAsArrayBuffer(file);
  } else {
    mensajes.textContent = "Formato no compatible. Use CSV o XLSX.";
  }
});

// Procesar datos cargados
function procesarDatos(data) {
  if (!data.length) {
    mensajes.textContent = "El archivo está vacío.";
    return;
  }

  const columnas = Object.keys(data[0]);
  const latCol = columnas.find(c => /lat/i.test(c));
  const lngCol = columnas.find(c => /lon|lng/i.test(c));
  const loteCol = columnas.find(c => /lote/i.test(c));
  const nombreCol = columnas.find(c => /nombre|palma/i.test(c));

  if (!latCol || !lngCol || !loteCol) {
    mensajes.textContent = "No se pudieron detectar las columnas de latitud, longitud o lote.";
    return;
  }

  datosCargados = data.filter(d => d[latCol] && d[lngCol]);
  if (!datosCargados.length) {
    mensajes.textContent = "No se encontraron coordenadas válidas.";
    return;
  }

  const lotes = [...new Set(datosCargados.map(d => d[loteCol]))];
  selectLote.innerHTML = lotes.map(l => `<option value="${l}">${l}</option>`).join("");
  selectLote.disabled = false;
  btnValidar.disabled = false;

  mensajes.textContent = `Archivo cargado correctamente. ${lotes.length} lotes detectados.`;

  datosCargados.latCol = latCol;
  datosCargados.lngCol = lngCol;
  datosCargados.loteCol = loteCol;
  datosCargados.nombreCol = nombreCol;
}

// Eventos de botones y select
btnValidar.addEventListener("click", () => mostrarLote(selectLote.value));
selectLote.addEventListener("change", () => mostrarLote(selectLote.value));

// ======================
// Super Omega mostrarLote
// ======================
function mostrarLote(nombreLote) {
  capaMapa.clearLayers();
  const { latCol, lngCol, loteCol, nombreCol } = datosCargados;
  const loteFiltrado = datosCargados.filter(d => d[loteCol] == nombreLote);
  if (!loteFiltrado.length) return;

  const color = stringToColor(nombreLote);

  // Offset pequeño único por lote
  const offsetFactor = 0.0001;
  const offsetLat = hashCode(nombreLote) % 1000 / 10000000;
  const offsetLng = (hashCode(nombreLote) * 7) % 1000 / 10000000;

  const puntos = loteFiltrado.map(d => [
    parseFloat(d[latCol]) + offsetLat,
    parseFloat(d[lngCol]) + offsetLng
  ]);

  // Dibujar líneas rectas entre puntos consecutivos
  for (let i = 0; i < puntos.length - 1; i++) {
    L.polyline([puntos[i], puntos[i+1]], { color, weight: 3 }).addTo(capaMapa);
  }

  // Dibujar marcadores con tooltip
  puntos.forEach((p, i) => {
    const spot = loteFiltrado[i];
    const nombre = nombreCol ? spot[nombreCol] : '';
    L.circleMarker(p, { radius: 4, color })
      .bindTooltip(nombre)
      .addTo(capaMapa);
  });

  mapa.fitBounds(puntos);
  mensajes.textContent = `Mostrando ${puntos.length} puntos del lote ${nombreLote}.`;
}

// Generar color único por lote
function stringToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const r = (hash >> 0) & 0xFF;
  const g = (hash >> 8) & 0xFF;
  const b = (hash >> 16) & 0xFF;
  return `rgb(${r},${g},${b})`;
}

// Hash determinístico para offset
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  return Math.abs(hash);
}
