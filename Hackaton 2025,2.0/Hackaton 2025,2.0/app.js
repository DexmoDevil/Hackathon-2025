// Variables globales para guardar datos
let datosArchivo = []; // JSON del archivo del usuario
let fincasAPI = [];   // Lista de todas las fincas
let lotesAPI = [];     // Lista de TODOS los lotes
let perimetrosLotes = {}; // GeoJSON de los lotes

// ✅ Función para manejar errores en todas las peticiones
async function fetchSeguro(url, opciones) {
    try {
        const respuesta = await fetch(url, opciones);

        if (!respuesta.ok) {
            const texto = await respuesta.text();
            console.error("Error HTTP:", respuesta.status, texto);
            throw new Error(`Error ${respuesta.status}: ${texto.slice(0, 200)}`);
        }

        const tipo = respuesta.headers.get("content-type") || "";
        if (!tipo.includes("application/json")) {
            const texto = await respuesta.text();
            console.error("Respuesta no es JSON:", texto.slice(0, 200));
            throw new Error("El servidor devolvió HTML o texto en lugar de JSON");
        }

        return await respuesta.json();
    } catch (err) {
        console.error("Error en fetchSeguro:", err);
        alert(`Error al conectar con Sioma: ${err.message}`);
        throw err;
    }
}

// 🔹 Token del Hackathon (NO lleva "Bearer")
const USER_TOKEN = "TZtFlm+l9CS0ksbBr3eqbQ==";

// ==========================================================
// 🚀 ¡NUEVO! ID de usuario proporcionado
const USUARIO_ID = 4736; 
// ==========================================================


// 🔹 Encabezado correcto según Sioma Hackathon 2025
const headersComunes = {
    'api-token': USER_TOKEN,
    'Content-Type': 'application/json'
};


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

        // (Usamos la variable 'headersComunes' definida arriba)
        
        // ✅ Reemplazado por fetchSeguro()
        fincasAPI = await fetchSeguro('https://api.sioma.dev/4/usuarios/sujetos', {
            method: 'GET',
            headers: { ...headersComunes, 'tipo-sujetos': '[1]' }
        });

        lotesAPI = await fetchSeguro('https://api.sioma.dev/4/usuarios/sujetos', {
            method: 'GET',
            headers: { ...headersComunes, 'tipo-sujetos': '[3]' }
        });


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


// ==========================================================
// --- ¡CAMBIO IMPORTANTE AQUÍ! ---
// 3. Evento: Cuando el usuario selecciona una finca
// ==========================================================
selectFinca.addEventListener('change', (e) => {
    const fincaId = e.target.value; // Este es el "key_value"

    // Limpiar siempre
    selectLoteApi.innerHTML = '<option>Seleccione una finca</option>';
    selectLoteApi.disabled = true;
    perimetrosLotes = {}; // Reiniciamos los perímetros

    if (!fincaId) return;

    // 1. Filtramos la lista 'lotesAPI' que ya teníamos
    const lotesDeLaFinca = lotesAPI.filter(lote => lote.finca_id == fincaId);

    if (lotesDeLaFinca.length === 0) {
        selectLoteApi.innerHTML = '<option>Finca sin lotes</option>';
        return;
    }

    // 2. Llenamos el dropdown de lotes
    selectLoteApi.innerHTML = '<option value="">Seleccione un lote (API)</option>';
    lotesDeLaFinca.forEach(lote => {
        selectLoteApi.innerHTML += `<option value="${lote.nombre}">${lote.nombre}</option>`;

        // 🚀 ¡URL CORREGIDA! 
        // Usamos la nueva URL y el USUARIO_ID que te dieron.
        fetchSeguro(`https://api.sioma.dev/4/puntos_lotes?lote_id=${lote.key_value}&usuario_id=${USUARIO_ID}`, {
            method: 'GET',
            headers: headersComunes // Usamos los headers comunes
        })
            .then(geojson => {
                // Asumimos que esta URL devuelve el GeoJSON del perímetro
                // (Aunque se llame "puntos_lotes", L.geoJSON lo dibujará)
                if (geojson && geojson.type) {
                    perimetrosLotes[lote.nombre] = geojson;
                }
            })
            .catch(err => console.warn("Sin perímetro/puntos para lote", lote.nombre, err));

    });

    selectLoteApi.disabled = false;
});


// 5. Evento: Cuando el usuario selecciona un archivo (Sin cambios)
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
                  _error: (err) => {
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


// 6. Evento: Cuando el usuario presiona "Validar Datos" (Sin cambios)
btnValidar.addEventListener('click', () => {
    mensajesDiv.innerHTML = 'Validando...';
    btnEnviar.disabled = true;

    const errores = [];
    const coordenadas = new Set();
    const lineasPosiciones = {};

    const fincaIdSeleccionada = selectFinca.value;
    if (!fincaIdSeleccionada) {
        mensajesDiv.innerHTML = `<strong class="text-sioma-error">Error: Debe seleccionar una finca primero.</strong>`;
        return;
    }

    const lotesValidosParaFinca = lotesAPI.filter(lote => lote.finca_id == fincaIdSeleccionada);
    const nombresLotesValidos = lotesValidosParaFinca.map(lote => lote.nombre);
    
    datosArchivo.forEach((row, index) => {
        const fila = index + 2; 

        if (!row.Lote || !nombresLotesValidos.includes(row.Lote)) {
            errores.push(`Fila ${fila}: El lote '${row.Lote}' no es válido para esta finca.`);
        }
        const coordKey = `${row.Latitud},${row.Longitud}`;
        if (coordenadas.has(coordKey)) {
            errores.push(`Fila ${fila}: Coordenadas (${row.Latitud}) duplicadas.`);
        } else {
            coordenadas.add(coordKey);
        }
        const lote = row.Lote;
        const linea = row['Línea palma'];
        const pos = row['Posición palma'];
        if (lote && linea && pos) { 
            if (!lineasPosiciones[lote]) { lineasPosiciones[lote] = {}; }
            if (!lineasPosiciones[lote][linea]) { lineasPosiciones[lote][linea] = new Set(); }
            if (lineasPosiciones[lote][linea].has(pos)) {
                errores.push(`Fila ${fila}: En Lote '${lote}', la Línea ${linea} ya tiene una Posición ${pos}.`);
            } else {
                lineasPosiciones[lote][linea].add(pos);
            }
        }
    });

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


// 8. Inicializar el mapa (Sin cambios)
const mapa = L.map('mapa-visualizador').setView([7.33, -76.72], 15);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(mapa);
const selectLotePreview = document.getElementById('select-lote-preview');
let capaMapa = L.layerGroup().addTo(mapa);
function cargarLotesParaPreview() {
    const lotesEnArchivo = [...new Set(datosArchivo.map(row => row.Lote).filter(l => l))];
    selectLotePreview.innerHTML = '<option value="">Seleccione un lote</option>';
    lotesEnArchivo.forEach(lote => {
        selectLotePreview.innerHTML += `<option value="${lote}">${lote}</option>`;
    });
    selectLotePreview.disabled = false;
}

// 9. Evento: Previsualizar (Sin cambios)
selectLotePreview.addEventListener('change', (e) => {
    const loteSeleccionado = e.target.value;
    capaMapa.clearLayers();
    if (!loteSeleccionado) return;

    const spotsDelLote = datosArchivo.filter(row => row.Lote === loteSeleccionado);
    const perimetro = perimetrosLotes[loteSeleccionado];

    // Dibuja el perímetro (si la nueva URL lo devolvió)
    if (perimetro) {
        try {
            const capaPerimetro = L.geoJSON(perimetro).addTo(capaMapa);
            mapa.fitBounds(capaPerimetro.getBounds());
        } catch (error) {
            console.error("Error al dibujar GeoJSON (la URL 'puntos_lotes' puede no devolver un polígono):", error);
        }
    }

    const lineas = {};
    spotsDelLote.forEach(spot => {
        const lat = parseFloat(spot.Latitud);
        const lon = parseFloat(spot.Longitud);
        if (!isNaN(lat) && !isNaN(lon)) {
            const lineaNum = spot['Línea palma'];
            if (!lineas[lineaNum]) { lineas[lineaNum] = []; }
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


// 10. Evento: Cuando el usuario presiona "Enviar" (Sin cambios)
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
        const csvHeader = "nombre_spot,lat,lng,lote_id,linea,posicion,nombre_planta,finca_id\n";
        let csvBody = "";
        for (const row of datosArchivo) {
            const nombreLote = row.Lote;
            const linea = row['Línea palma'];
            const posicion = row['Posición palma'];
            const loteInfo = lotesAPI.find(l => l.nombre === nombreLote && l.finca_id == finca_id);
            if (!loteInfo) { throw new Error(`No se encontró ID para el lote '${nombreLote}' en la finca.`); }
            const lote_id = loteInfo.key_value;
            const lat = row.Latitud;
            const lng = row.Longitud;
            const nombre_planta = `L${lote_id}L${linea}P${posicion}`;
            const nombre_spot = `L${lote_id}L${linea}S${posicion}`;
            csvBody += `${nombre_spot},${lat},${lng},${lote_id},${linea},${posicion},${nombre_planta},${finca_id}\n`;
        }
        const csvFinal = csvHeader + csvBody;
        const formData = new FormData();
        const csvFile = new File([csvFinal], "spots_validados.csv", { type: "text/csv" });
        formData.append("file", csvFile);
        mensajesDiv.innerHTML = '<strong class="text-gray-700">Enviando datos a Sioma...</strong>';
        
        // 🚨 ¡ADVERTENCIA! Esta URL sigue estando mal
        const resultado = await fetchSeguro('https://platanizador.sioma.dev/4/spots/upload', {//MALO# **API Endpoint - Subir spots** https://plantizador.sioma.dev/api/v1
            method: 'POST',
            headers: { 'api-token': USER_TOKEN },
			body: formData
        });
        
        if (resultado.status === 'success') {
            mensajesDiv.innerHTML = `<strong class="text-sioma-success">¡Éxito!</strong> ${resultado.message}`;
            datosArchivo = [];
            inputArchivo.value = '';
            selectLotePreview.disabled = true;
            selectLotePreview.innerHTML = '<option>Valide un archivo</option>';
            btnValidar.disabled = true;
            btnEnviar.disabled = true;
        } else {
            throw new Error(resultado.message || `Error desconocido de la API`);
        }
    } catch (error) {
        console.error('Error enviando a Sioma:', error);
        mensajesDiv.innerHTML = `<strong class="text-sioma-error">Error al enviar:</strong> ${error.message}`;
        btnEnviar.disabled = false;
  	}
});