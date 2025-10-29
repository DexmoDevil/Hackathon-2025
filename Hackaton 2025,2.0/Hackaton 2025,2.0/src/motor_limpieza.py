import pandas as pd
from sklearn.cluster import DBSCAN
import numpy as np
import os
from typing import Dict, Any, Tuple

class LimpiezaSpots:
    """
    Motor HÍBRIDO (v3 - OPTIMIZADO) compatible con API.
    Optimizado para alta velocidad (vectorización de Haversine).
    """
    
    def __init__(self, umbral_metros: float = 1.0, update_callback=None):
        self.umbral_metros = umbral_metros
        self.stats = {}
        self.update_callback = update_callback 

    def _report_progress(self, step: int, total_steps: int, message: str):
        if self.update_callback:
            progress = int((step / total_steps) * 100)
            self.update_callback(progress, message)

    def _haversine_np(self, lon1, lat1, lon2, lat2):
        """
        Calcula la distancia en metros entre arrays de coordenadas.
        """
        lon1, lat1, lon2, lat2 = map(np.radians, [lon1, lat1, lon2, lat2])
        dlon = lon2 - lon1 
        dlat = lat2 - lat1 
        a = np.sin(dlat/2)**2 + np.cos(lat1) * np.cos(lat2) * np.sin(dlon/2)**2
        c = 2 * np.arcsin(np.sqrt(a)) 
        r = 6371000 # Radio de la Tierra en metros
        return c * r

    def _cargar_y_normalizar(self, file_path: str, finca_id_manual: str) -> pd.DataFrame | None:
        self._report_progress(1, 6, "1/5: Cargando archivo y detectando formato...")
        
        try:
            _, extension = os.path.splitext(file_path)
            extension = extension.lower()
            
            if extension == '.csv':
                try:
                    df = pd.read_csv(file_path, dtype=str)
                except Exception:
                    df = pd.read_csv(file_path, sep=';', dtype=str)
            elif extension == '.xlsx':
                df = pd.read_excel(file_path, dtype=str)
            else:
                self._report_progress(1, 6, f"ERROR: Extensión no soportada: {extension}.")
                return None
        except Exception as e:
            self._report_progress(1, 6, f"ERROR: No se pudo leer el archivo: {e}")
            return None

        df.columns = df.columns.str.strip().str.lower()
        columnas_actuales = set(df.columns)
        
        # --- CASO 1: Formato Nuevo (12 columnas) ---
        if 'nombre_spot' in columnas_actuales and 'lote_id' in columnas_actuales:
            self._report_progress(1, 6, "1/5: Detectado Formato Nuevo API. Validando...")
            
            columnas_requeridas = {
                'nombre_spot', 'lat', 'lng', 'lote_id', 'linea', 
                'posicion', 'nombre_planta', 'finca_id'
            }
            if not columnas_requeridas.issubset(columnas_actuales):
                faltantes = columnas_requeridas - columnas_actuales
                self._report_progress(1, 6, f"ERROR: Faltan columnas: {faltantes}")
                return None
            
            fincas_en_archivo = df['finca_id'].unique()
            if len(fincas_en_archivo) > 1:
                self._report_progress(1, 6, f"ERROR: Múltiples fincas en archivo: {fincas_en_archivo}")
                return None
            
            if 'tipo_poligono_id' not in df.columns: df['tipo_poligono_id'] = '1'
            if 'distancia' not in df.columns: df['distancia'] = '9'
            if 'fecha_siembra' not in df.columns: df['fecha_siembra'] = '2006-01-01'
            if 'tipo_variedad_id' not in df.columns: df['tipo_variedad_id'] = '5'
            
            df_limpio = df.rename(columns={
                'lote_id': 'Lote',
                'linea': 'Linea',
                'posicion': 'Palma',
                'lng': 'Longitud',
                'lat': 'Latitud'
            })

        # --- CASO 2: Formato Antiguo (5 columnas) ---
        elif 'lote' in columnas_actuales and 'longitud' in columnas_actuales and 'latitud' in columnas_actuales:
            self._report_progress(1, 6, "1/5: Detectado Formato Antiguo. Convirtiendo a API...")
            
            df_limpio = df.rename(columns={
                'lote': 'Lote',
                'linea': 'Linea',
                'palma': 'Palma',
                'longitud': 'Longitud',
                'latitud': 'Latitud'
            })
            
            df_limpio['lat'] = df_limpio['Latitud']
            df_limpio['lng'] = df_limpio['Longitud']
            df_limpio['lote_id'] = df_limpio['Lote']
            df_limpio['posicion'] = df_limpio['Palma']
            
            df_limpio['nombre_planta'] = 'L' + df_limpio['Lote'].astype(str) + \
                                       'L' + df_limpio['Linea'].astype(str) + \
                                       'P' + df_limpio['Palma'].astype(str)
            
            df_limpio['nombre_spot'] = 'SPOT_' + df_limpio['Lote'].astype(str) + \
                                     '_L' + df_limpio['Linea'].astype(str) + \
                                     '_P' + df_limpio['Palma'].astype(str)
            
            df_limpio['finca_id'] = finca_id_manual
            
            df_limpio['tipo_poligono_id'] = '1'
            df_limpio['distancia'] = '9'
            df_limpio['fecha_siembra'] = '2006-01-01'
            df_limpio['tipo_variedad_id'] = '5'
            
        # --- CASO 3: Formato Desconocido ---
        else:
            self._report_progress(1, 6, "ERROR: Formato de archivo no reconocido.")
            print(f"Columnas encontradas: {list(columnas_actuales)}")
            return None

        # --- Procesamiento común (tipos de datos y coordenadas) ---
        try:
            df_limpio['Latitud'] = pd.to_numeric(df_limpio['Latitud'], errors='coerce')
            df_limpio['Longitud'] = pd.to_numeric(df_limpio['Longitud'], errors='coerce')
            df_limpio['Linea'] = pd.to_numeric(df_limpio['Linea'], errors='coerce', downcast='integer')
            df_limpio['Palma'] = pd.to_numeric(df_limpio['Palma'], errors='coerce', downcast='integer')
        except Exception as e:
            self._report_progress(1, 6, f"ERROR: Fallo al convertir tipos de datos: {e}")
            return None

        df_limpio = df_limpio.dropna(subset=['Latitud', 'Longitud']).reset_index(drop=True)
        
        self.stats['original'] = len(df_limpio)
        return df_limpio


    def _corregir_duplicados_exactos(self, df: pd.DataFrame) -> pd.DataFrame:
        self._report_progress(2, 6, "2/5: Eliminando duplicados idénticos (rápido)...")
        registros_iniciales = len(df)
        df_dedup_exacto = df.drop_duplicates(subset=['Latitud', 'Longitud'], keep='first').reset_index(drop=True)
        self.stats['eliminados_exactos'] = registros_iniciales - len(df_dedup_exacto)
        return df_dedup_exacto

    def _corregir_duplicados_espaciales(self, df: pd.DataFrame) -> pd.DataFrame:
        self._report_progress(3, 6, "3/5: Usando IA (DBSCAN) para errores de GPS (lento)...")
        coords = df[['Latitud', 'Longitud']].values
        epsilon = self.umbral_metros / 6371000 
        db = DBSCAN(eps=epsilon, min_samples=1, metric='haversine').fit(np.radians(coords))
        df['cluster'] = db.labels_
        df_final = pd.DataFrame()
        for _, grupo in df.groupby('cluster'):
            df_final = pd.concat([df_final, grupo.iloc[[0]]])
        self.stats['eliminados_espaciales'] = len(df) - len(df_final)
        return df_final.drop(columns=['cluster']).reset_index(drop=True)

    # --- FUNCIÓN DE SECUENCIA OPTIMIZADA ---
    def _corregir_secuencia_palmas(self, df: pd.DataFrame) -> pd.DataFrame:
        self._report_progress(4, 6, "4/5: Corrigiendo secuencia (optimizado)...")

        def reordenar_linea(grupo):
            grupo_valido = grupo.dropna(subset=['Palma']).copy()
            if grupo_valido.empty:
                return grupo 
            
            palma_inicio = grupo_valido.loc[grupo_valido['Palma'].idxmin()]
            lat_inicio = palma_inicio['Latitud']
            lng_inicio = palma_inicio['Longitud']
            
            lats_grupo = grupo['Latitud'].values
            lngs_grupo = grupo['Longitud'].values
            
            distancias = self._haversine_np(lng_inicio, lat_inicio, lngs_grupo, lats_grupo)
            grupo['distancia_inicio'] = distancias
            
            grupo_ordenado = grupo.sort_values(by='distancia_inicio').reset_index(drop=True)
            
            grupo_ordenado['Palma_Corregida'] = grupo_ordenado.index + 1
            return grupo_ordenado

        # --- CÓDIGO CORRECTO (sin include_groups=False) ---
        df_corregido = df.groupby(['Lote', 'Linea'], dropna=False, group_keys=False).apply(reordenar_linea)
        
        df_corregido = df_corregido.reset_index(drop=True)
        
        df_corregido['Palma_Original'] = df_corregido['Palma']
        correcciones_totales = df_corregido[df_corregido['Palma_Original'].notna() & 
                                            (df_corregido['Palma_Original'] != df_corregido['Palma_Corregida'])].shape[0]
        self.stats['corregidos_secuencia'] = correcciones_totales
        
        df_corregido['Palma'] = df_corregido['Palma_Corregida']
        
        df_corregido = df_corregido.drop(columns=['Palma_Corregida', 'distancia_inicio', 'Palma_Original'])
        return df_corregido

    # --- FUNCIÓN PRINCIPAL DE EXPORTACIÓN ---
    def procesar_y_exportar(self, input_file_path: str, output_file_path: str, finca_id_manual: str) -> Tuple[bool, str]:
        self.stats = {'original': 0, 'eliminados_exactos': 0, 'eliminados_espaciales': 0, 'corregidos_secuencia': 0, 'final': 0}
        
        df = self._cargar_y_normalizar(input_file_path, finca_id_manual)
        if df is None:
            self._report_progress(0, 6, "ERROR: Archivo no válido.")
            return False, "Error al cargar o interpretar el archivo. Verifique el formato y las columnas."

        df = self._corregir_duplicados_exactos(df)
        df = self._corregir_duplicados_espaciales(df)
        df_limpio = self._corregir_secuencia_palmas(df)
        
        self._report_progress(5, 6, "5/5: Guardando el archivo corregido...")
        self.stats['final'] = len(df_limpio)

        df_exportar = df_limpio.rename(columns={
            'Lote': 'lote_id_interno_TEMP', 
            'Linea': 'linea_interno_TEMP',
            'Palma': 'posicion',
            'Longitud': 'lng',
            'Latitud': 'lat'
        })
        
        columnas_finales = [
            'nombre_spot', 'lat', 'lng', 'lote_id', 'linea', 'posicion', 
            'nombre_planta', 'finca_id', 'tipo_poligono_id', 'distancia', 
            'fecha_siembra', 'tipo_variedad_id'
        ]
        
        # Esta lógica ahora SÍ funcionará porque 'linea_interno_TEMP'
        # y 'lote_id_interno_TEMP' siempre se crearán
        if 'lote_id' not in df_exportar.columns:
            df_exportar['lote_id'] = df_exportar['lote_id_interno_TEMP']
        if 'linea' not in df_exportar.columns:
            df_exportar['linea'] = df_exportar['linea_interno_TEMP']

        df_exportar_final = df_exportar[columnas_finales]

        try:
            df_exportar_final.to_csv(
                output_file_path, 
                index=False, 
                sep=',', # Separador de coma para la API
                lineterminator='\r\n' 
            )
        except Exception as e:
            self._report_progress(100, 100, "ERROR: No se pudo guardar el archivo.")
            return False, f"Error al guardar el archivo limpio: {e}"

        total_eliminados = self.stats['eliminados_exactos'] + self.stats['eliminados_espaciales']
        reporte = f"""
        ✅ Tareas completadas con ÉXITO.
        
        Registros iniciales: {self.stats['original']}
        ✨ Registros finales listos: {self.stats['final']}
        
        - 🗑️ Duplicados eliminados: {total_eliminados}
        - ✏️ Palmas Reordenadas: {self.stats['corregidos_secuencia']}
        
        Archivo listo para API: {os.path.basename(output_file_path)}
        """
        self._report_progress(6, 6, "¡PROCESO TERMINADO! Revisar reporte.")
        return True, reporte