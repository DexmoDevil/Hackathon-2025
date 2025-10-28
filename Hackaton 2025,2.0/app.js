// Variables globales para guardar datos
let datosArchivo = []; // JSON del archivo del usuario
let fincasAPI = [];   // Lista de todas las fincas
let lotesAPI = [];     // Lista de TODOS los lotes
let perimetrosLotes = {}; // GeoJSON de los lotes

// --- CAMBIO ---
// ¡Asegúrate de poner tu token real aquí!
const USER_TOKEN = "TZtFlm+l9CS0ksbBr3eqbQ==";//Pegar el user token ahí
if (USER_TOKEN === "TZtFlm+l9CS0ksbBr3eqbQ==") {
    console.warn("ADVERTENCIA: Debes poner tu USER_TOKEN real en app.js");
}

const selectFinca = document.getElementById('select-finca');
const selectLoteApi = document.getElementById('select-lote-api');
const inputArchivo = document.getElementById('archivo-spots');
const btnValidar = document.getElementById('btn-validar');
const btnEnviar = document.getElementById('btn-enviar');
const mensajesDiv = document.getElementById('mensajes-validacion');


// --- CAMBIO ---
// Al iniciar la App, cargamos Fincas Y Lotes al mismo tiempo.
document.addEventListener('DOMContentLoaded', async () => {
    try {
        mensajesDiv.innerHTML = "Cargando configuración de Sioma...";

        // 1. Preparamos ambas peticiones
        const headersComunes = {
            'Authorization': USER_TOKEN,
            'Content-Type': 'application/json'
        };

        const peticionFincas = fetch('https://api.sioma.dev/4/usuarios/sujetos', {
            method: 'GET',
            headers: { ...headersComunes, 'tipo-sujetos': '[1]' } // [1] = Fincas
        });

        const peticionLotes = fetch('https://api.sioma.dev/4/usuarios/sujetos', {
            method: 'GET',
            headers: { ...headersComunes, 'tipo-sujetos': '[3]' } // [3] = Lotes
        });

        // 2. Ejecutamos ambas al mismo tiempo
        const [responseFincas, responseLotes] = await Promise.all([peticionFincas, peticionLotes]);

        if (!responseFincas.ok) throw new Error(`Error ${responseFincas.status} (Fincas)`);
        if (!responseLotes.ok) throw new Error(`Error ${responseLotes.status} (Lotes)`);

        // 3. Guardamos los resultados
        fincasAPI = await responseFincas.json();
        lotesAPI = await responseLotes.json(); // Esta es la lista COMPLETA de lotes

        // 4. Llenar el dropdown de fincas
        selectFinca.innerHTML = '<option value="">Seleccione una finca</option>';
        fincasAPI.forEach(finca => {
            // Usamos key_value (ID) y nombre, como dice la API
            selectFinca.innerHTML += `<option value="${finca.key_value}">${finca.nombre}</option>`;
        });
        
        selectFinca.disabled = false;
        mensajesDiv.innerHTML = "Por favor, seleccione finca y cargue un archivo.";

    } catch (error) {
        console.error('Error cargando configuración:', error);
        mensajesDiv.innerHTML = `<strong class="text-sioma-error">Error al cargar: ${error.message}</strong>`;
        selectFinca.innerHTML = '<option>Error al cargar</option>';
    }
});


// --- CAMBIO ---
// 3. Evento: Cuando el usuario selecciona una finca
// ¡YA NO HACE FETCH! Ahora filtra la lista local.
selectFinca.addEventListener('change', (e) => {
    const fincaId = e.target.value; // Este es el "key_value"
    
    // Limpiar siempre
    selectLoteApi.innerHTML = '<option>Seleccione una finca</option>';
    selectLoteApi.disabled = true;
    perimetrosLotes = {};

    if (!fincaId) return;

    // 1. Filtramos la lista 'lotesAPI' que ya teníamos
    // Usamos == en vez de === porque fincaId puede ser string y finca_id número
    const lotesDeLaFinca = lotesAPI.filter(lote => lote.finca_id == fincaId);

    if (lotesDeLaFinca.length === 0) {
        selectLoteApi.innerHTML = '<option>Finca sin lotes</option>';
        return;
    }
    
    // 2. Llenamos el dropdown de lotes
    selectLoteApi.innerHTML = '<option value="">Seleccione un lote (API)</option>';
    lotesDeLaFinca.forEach(lote => {
        // Usamos el 'nombre' del lote como valor
        selectLoteApi.innerHTML += `<option value="${lote.nombre}">${lote.nombre}</option>`;
        
        // Guardamos el perímetro si existe (Aunque la API no lo mostró, lo dejamos por si acaso)
        if (lote.perimetro_geojson) {
             perimetrosLotes[lote.nombre] = lote.perimetro_geojson;
        }
    });
    
    selectLoteApi.disabled = false;
});


// 5. Evento: Cuando el usuario selecciona un archivo (Sin cambios, esta versión es correcta)
inputArchivo.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    
    btnValidar.disabled = true;
    mensajesDiv.innerHTML = '<strong class="text-gray-700">Leyendo archivo...</strong>';
    
    const reader = new FileReader();

    reader.onload = (event) => {
        try {
            const data = event.target.result;
            
            if (fileName.endsWith('.csv')) {
                Papa.parse(data, {
                    header: true, 
                    skipEmptyLines: true,
                    complete: (results) => {
                        datosArchivo = results.data;
                        btnValidar.disabled = false;
                        mensajesDiv.innerHTML = `<strong class="text-sioma-success">Archivo ${file.name} cargado. Listo para validar.</strong>`;
                    },
                    error: (err) => { 
                        mensajesDiv.innerHTML = `<strong class="text-sioma-error">Error leyendo CSV: ${err.message}</strong>`;
                        inputArchivo.value = '';
                    }
                });
            } else if (fileName.endsWith('.xlsx')) {
                const workbook = XLSX.read(data, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                datosArchivo = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
                btnValidar.disabled = false;
                mensajesDiv.innerHTML = `<strong class="text-sioma-success">Archivo ${file.name} cargado. Listo para validar.</strong>`;
            } else {
                mensajesDiv.innerHTML = `<strong class="text-sioma-error">Error: Tipo de archivo no válido. Use .csv o .xlsx.</strong>`;
                inputArchivo.value = '';
            }
        } catch (error) {
            mensajesDiv.innerHTML = `<strong class="text-sioma-error">Error fatal al procesar el archivo: ${error.message}</strong>`;
            inputArchivo.value = '';
        }
    };

    reader.onerror = () => {
        mensajesDiv.innerHTML = `<strong class="text-sioma-error">No se pudo leer el archivo.</strong>`;
        inputArchivo.value = '';
    };

    if (fileName.endsWith('.csv')) {
        reader.readAsText(file);
    } else if (fileName.endsWith('.xlsx')) {
        reader.readAsBinaryString(file);
    }
});


// --- CAMBIO ---
// 6. Evento: Cuando el usuario presiona "Validar Datos"
// Corregido para usar la lista de lotes filtrada
btnValidar.addEventListener('click', () => {
    mensajesDiv.innerHTML = 'Validando...';
    btnEnviar.disabled = true;

    const errores = [];
    const coordenadas = new Set();
    const lineasPosiciones = {}; 

    // --- Lógica de validación corregida ---
    const fincaIdSeleccionada = selectFinca.value;
    if (!fincaIdSeleccionada) {
        mensajesDiv.innerHTML = `<strong class="text-sioma-error">Error: Debe seleccionar una finca primero.</strong>`;
        return;
    }

    // Obtenemos los nombres de lotes válidos SÓLO para la finca seleccionada
    const lotesValidosParaFinca = lotesAPI.filter(lote => lote.finca_id == fincaIdSeleccionada);
    const nombresLotesValidos = lotesValidosParaFinca.map(lote => lote.nombre);
    // --- Fin de la corrección ---
    
    datosArchivo.forEach((row, index) => {
        const fila = index + 2; 

        // Validación 1: Lotes inválidos
        if (!row.Lote || !nombresLotesValidos.includes(row.Lote)) {
            errores.push(`Fila ${fila}: El lote '${row.Lote}' no es válido para esta finca.`);
        }

        // Validación 2: Coordenadas duplicadas
        const coordKey = `${row.Latitud},${row.Longitud}`;
        if (coordenadas.has(coordKey)) {
            errores.push(`Fila ${fila}: Coordenadas (${row.Latitud}) duplicadas.`);
        } else {
            coordenadas.add(coordKey);
        }

        // Validación 3: Inconsistencias Línea/Posición
        const lote = row.Lote;
        const linea = row['Línea palma'];
        const pos = row['Posición palma'];

        if (lote && linea && pos) { 
            if (!lineasPosiciones[lote]) {
                lineasPosiciones[lote] = {};
            }
            if (!lineasPosiciones[lote][linea]) {
                lineasPosiciones[lote][linea] = new Set();
            }

            if (lineasPosiciones[lote][linea].has(pos)) {
                errores.push(`Fila ${fila}: En Lote '${lote}', la Línea ${linea} ya tiene una Posición ${pos}.`);
            } else {
                lineasPosiciones[lote][linea].add(pos);
            }
        }
    });

    // 7. Mostrar resumen de errores
    if (errores.length > 0) {
        mensajesDiv.innerHTML = `<strong class="text-sioma-error">Errores Encontrados (${errores.length}):</strong><br>`;
        mensajesDiv.innerHTML += `<ul class="text-sioma-error list-disc list-inside">${errores.map(e => `<li>${e}</li>`).join('')}</ul>`;
        mensajesDiv.innerHTML += "Por favor, corrija el archivo manualmente y vuelva a cargarlo.";
    } else {
        mensajesDiv.innerHTML = `<strong class="text-sioma-success">¡Validación exitosa!</strong> ${datosArchivo.length} registros validados.`;
        btnEnviar.disabled = false; 
        cargarLotesParaPreview();
    }
});


// 8. Inicializar el mapa (solo una vez)
const mapa = L.map('mapa-visualizador').setView([7.33, -76.72], 15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(mapa);

const selectLotePreview = document.getElementById('select-lote-preview');
let capaMapa = L.layerGroup().addTo(mapa);

// Función para poblar el dropdown de previsualización
function cargarLotesParaPreview() {
    const lotesEnArchivo = [...new Set(datosArchivo.map(row => row.Lote).filter(l => l))];
    selectLotePreview.innerHTML = '<option value="">Seleccione un lote</option>';
    lotesEnArchivo.forEach(lote => {
        selectLotePreview.innerHTML += `<option value="${lote}">${lote}</option>`;
    });
    selectLotePreview.disabled = false;
}

// 9. Evento: Cuando el usuario selecciona un lote para previsualizar
// (Añadido try/catch para el perímetro)
selectLotePreview.addEventListener('change', (e) => {
    const loteSeleccionado = e.target.value;
    capaMapa.clearLayers(); 
    if (!loteSeleccionado) return;

    const spotsDelLote = datosArchivo.filter(row => row.Lote === loteSeleccionado);
    const perimetro = perimetrosLotes[loteSeleccionado];
    
    // --- CAMBIO ---
    // Añadido try/catch por si el perímetro no existe o es inválido
    if (perimetro) {
        try {
            const capaPerimetro = L.geoJSON(perimetro).addTo(capaMapa);
            mapa.fitBounds(capaPerimetro.getBounds()); 
        } catch (error) {
            console.error("Error al dibujar perímetro (puede faltar en la API de Lotes):", error);
        }
    }
    // --- Fin del cambio ---

    const lineas = {}; 
    spotsDelLote.forEach(spot => {
        const lat = parseFloat(spot.Latitud);
        const lon = parseFloat(spot.Longitud);
        
        if (!isNaN(lat) && !isNaN(lon)) {
            const lineaNum = spot['Línea palma'];
            if (!lineas[lineaNum]) {
                lineas[lineaNum] = [];
            }
            lineas[lineaNum].push([lat, lon]);

            L.marker([lat, lon])
                .addTo(capaMapa)
                .bindPopup(`Lote: ${spot.Lote}<br>Línea: ${lineaNum}<br>Posición: ${spot['Posición palma']}`);
        }
    });

    for (const lineaNum in lineas) {
        const spotsOrdenados = lineas[lineaNum]; 
        L.polyline(spotsOrdenados, { color: 'blue', weight: 1, opacity: 0.7 }).addTo(capaMapa);
    }
});


// --- CAMBIO TOTAL ---
// 10. Evento: Cuando el usuario presiona "Enviar"
// Reescribo para que coincida con la API 'POST /api/v1/spots/upload'
btnEnviar.addEventListener('click', async () => {
    if (datosArchivo.length === 0) return;

    btnEnviar.disabled = true;
    mensajesDiv.innerHTML = '<strong class="text-gray-700">Traduciendo y preparando datos...</strong>';

    const finca_id = selectFinca.value;
    if (!finca_id) {
         mensajesDiv.innerHTML = '<strong class="text-sioma-error">Error: Finca no seleccionada.</strong>';
         btnEnviar.disabled = false;
         return;
    }

    try {
        // --- 1. TRADUCCIÓN DE JSON A CSV ---
        // Columnas que la API 'upload' espera
        const csvHeader = "nombre_spot,lat,lng,lote_id,linea,posicion,nombre_planta,finca_id\n";
        let csvBody = "";
        
        for (const row of datosArchivo) {
            const nombreLote = row.Lote;
            const linea = row['Línea palma'];
            const posicion = row['Posición palma'];

            // Buscamos el ID del lote (key_value) usando el nombre y la finca_id
            const loteInfo = lotesAPI.find(l => l.nombre === nombreLote && l.finca_id == finca_id);
            
            if (!loteInfo) {
                // Esto no debería pasar si la validación (Paso 6) fue correcta
                throw new Error(`No se encontró ID para el lote '${nombreLote}' en la finca.`);
            }

            const lote_id = loteInfo.key_value; // ID numérico del lote

            // Mapeo de columnas
            const lat = row.Latitud;
            const lng = row.Longitud;
            
            // Generación de IDs (según documentación de la API)
            // L{lote_id}L{linea}P{posicion}
            const nombre_planta = `L${lote_id}L${linea}P${posicion}`;
            // L{lote_id}L{linea}S{posicion} (Asumiendo S=Spot, P=Posición)
            const nombre_spot = `L${lote_id}L${linea}S${posicion}`; 

            csvBody += `${nombre_spot},${lat},${lng},${lote_id},${linea},${posicion},${nombre_planta},${finca_id}\n`;
        }

        const csvFinal = csvHeader + csvBody;

        // --- 2. CREACIÓN DE FORMDATA ---
        const formData = new FormData();
        const csvFile = new File([csvFinal], "spots_validados.csv", { type: "text/csv" });
        formData.append("file", csvFile); // El 'key' debe ser 'file'

        mensajesDiv.innerHTML = '<strong class="text-gray-700">Enviando datos a Sioma...</strong>';

        // --- 3. ENVÍO A LA API CORRECTA ---
        const response = await fetch('https://api.sioma.dev/api/v1/spots/upload', { 
            method: 'POST',
            headers: {
                // NO PONER 'Content-Type', el navegador lo hace solo para FormData
                'Authorization': USER_TOKEN
            },
            body: formData // Enviamos el FormData
        });

        const resultado = await response.json(); // La API de upload responde con JSON

        if (response.ok && resultado.status === 'success') {
            mensajesDiv.innerHTML = `<strong class="text-sioma-success">¡Éxito!</strong> ${resultado.message}`;
            
            // Limpiar todo
            datosArchivo = [];
            inputArchivo.value = '';
            selectLotePreview.disabled = true;
            selectLotePreview.innerHTML = '<option>Valide un archivo</option>';
            btnValidar.disabled = true;
            btnEnviar.disabled = true;

        } else {
            // Manejar errores de la API (ej. "Múltiples fincas", "Columnas faltantes")
            throw new Error(resultado.message || `Error ${response.status}`);
        }

    } catch (error) {
        console.error('Error enviando a Sioma:', error);
        mensajesDiv.innerHTML = `<strong class="text-sioma-error">Error al enviar:</strong> ${error.message}`;
        btnEnviar.disabled = false; 
    }
});