import tkinter as tk
import ttkbootstrap as ttk 
from ttkbootstrap.constants import *
from tkinter import filedialog, messagebox
import os
import requests
import threading
import json
from .motor_limpieza import LimpiezaSpots
from PIL import Image, ImageTk 

class AppLimpieza(ttk.Window): 
    def __init__(self):
        
        super().__init__(
            themename="lumen", # Tema de fondo blanco
            title="PalmClean V1.0 - Preparación y Envío a API (SIOMA)"
        )
        self.geometry("700x750") # <-- Un poco más alto para los nuevos campos
        
        self.input_path = ""
        self.output_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "Palmas_LIMPIAS.csv")
        self.api_url = "https://plantizador.sioma.dev/api/v1" # URL de la API
        
        self.limpiador = None 
        self.logo_tk_image = None
        
        # --- NUEVAS VARIABLES ---
        self.finca_id_var = tk.StringVar()
        self.token_var = tk.StringVar() # Para el token de autorización
        self.btn_subir = None # Referencia al botón de subida
        
        self.create_widgets()
        self.setup_limpiador()

    def setup_limpiador(self):
        self.limpiador = LimpiezaSpots(umbral_metros=1.0, update_callback=self.update_progress)

    def create_widgets(self):
        main_frame = ttk.Frame(self, padding="20 20 20 20")
        main_frame.pack(fill=BOTH, expand=True)

        # --- CABECERA CON LOGO ---
        try:
            base_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            logo_path = os.path.join(base_path, "assets", "logo_sioma.png")
            original_image = Image.open(logo_path)
            resized_image = original_image.resize((250, 60), Image.Resampling.LANCZOS)
            self.logo_tk_image = ImageTk.PhotoImage(resized_image) 
            ttk.Label(main_frame, image=self.logo_tk_image).pack(pady=(0, 10))
        except Exception as e:
            print(f"Advertencia: No se pudo cargar el logo. {e}")
            ttk.Label(main_frame, text="SIOMA", font=('Arial', 28, 'bold'), bootstyle=SUCCESS).pack(pady=(0, 5))

        ttk.Label(main_frame, text="PalmClean V1.0 - Preparación y Envío a API", font=('Arial', 14)).pack(pady=(0, 20))
        ttk.Separator(main_frame).pack(fill=X, pady=10)
        
        # --- 1. Configuración de Entrada ---
        ttk.Label(main_frame, text="1. Configuración", font=('Arial', 18, 'bold')).pack(pady=(10, 10), anchor=W)
        
        # --- NUEVO: Frame para los campos de entrada ---
        entry_frame = ttk.Frame(main_frame)
        entry_frame.pack(fill=X, pady=5)

        ttk.Label(entry_frame, text="ID de Finca (Obligatorio):", font=('Arial', 14, 'bold')).pack(pady=(5, 0), anchor=W)
        self.entry_finca_id = ttk.Entry(entry_frame, textvariable=self.finca_id_var, font=('Arial', 16))
        self.entry_finca_id.pack(pady=(0, 10), fill=X)
        
        # --- NUEVO: Campo para el Token de Autorización ---
        ttk.Label(entry_frame, text="Token de Autorización API:", font=('Arial', 14, 'bold')).pack(pady=(5, 0), anchor=W)
        self.entry_token = ttk.Entry(entry_frame, textvariable=self.token_var, font=('Arial', 16), show="*")
        self.entry_token.pack(pady=(0, 10), fill=X)


        # --- 2. Acciones ---
        ttk.Label(main_frame, text="2. Acciones", font=('Arial', 18, 'bold')).pack(pady=(10, 10), anchor=W)
        
        self.label_archivo = ttk.Label(main_frame, text="❌ Archivo NO cargado.", bootstyle=DANGER)
        self.label_archivo.pack(pady=5, fill=X)
        
        frame_botones = ttk.Frame(main_frame)
        frame_botones.pack(fill=X, pady=10)

        self.btn_seleccionar = ttk.Button(
            frame_botones, 
            text="🔍 Buscar Archivo", 
            command=self.seleccionar_archivo, 
            bootstyle=PRIMARY
        )
        self.btn_seleccionar.pack(side=LEFT, fill=X, expand=True, padx=(0, 5))
        
        self.btn_limpiar = ttk.Button(
            frame_botones, 
            text="✨ 1. INICIAR LIMPIEZA", 
            command=self.ejecutar_limpieza, 
            state=DISABLED, 
            bootstyle=SUCCESS
        )
        self.btn_limpiar.pack(side=LEFT, fill=X, expand=True, padx=(5, 0))

        # --- 3. Progreso y Resultados ---
        ttk.Separator(main_frame).pack(fill=X, pady=15)
        ttk.Label(main_frame, text="3. Progreso y Resultados", font=('Arial', 18, 'bold')).pack(pady=(0, 10), anchor=W)

        self.progress_bar = ttk.Progressbar(main_frame, orient=HORIZONTAL, mode='determinate', bootstyle=(INFO, STRIPED))
        self.progress_bar.pack(fill=X, pady=(5, 5))
        
        self.label_progreso_msg = ttk.Label(main_frame, text="Esperando inicio...", bootstyle=INFO)
        self.label_progreso_msg.pack(pady=(0, 10), fill=X)
        
        # --- NUEVO: Botón de Subir a la API ---
        self.btn_subir = ttk.Button(
            main_frame, 
            text="🛰️ 2. SUBIR A SIOMA (API)", 
            command=self.iniciar_subida_api, 
            state=DISABLED, 
            bootstyle=(INFO, OUTLINE) # Estilo 'outline'
        )
        self.btn_subir.pack(fill=X, pady=10, ipady=10) # Botón más grande

        self.label_reporte = ttk.Label(main_frame, text="Presione 'Iniciar' para ver los resultados.", justify=LEFT)
        self.label_reporte.pack(pady=5, fill=X, anchor=W)

    # --- Funciones de Lógica (Limpieza) ---

    def update_progress(self, percentage: int, message: str, bootstyle=None):
        self.progress_bar['value'] = percentage
        
        if bootstyle:
            style = bootstyle
        elif "ERROR" in message:
            style = DANGER
        elif "TERMINADO" in message:
            style = SUCCESS
        else:
            style = INFO
            
        self.label_progreso_msg.config(text=f"Progreso ({percentage}%): {message}", bootstyle=style)
        self.update_idletasks()

    def seleccionar_archivo(self):
        file_path = filedialog.askopenfilename(
            defaultextension=".csv",
            filetypes=[("Archivos de Datos", "*.csv *.xlsx")]
        )
        if file_path:
            self.btn_limpiar.config(state=NORMAL)
            self.btn_subir.config(state=DISABLED) # Desactivar subida hasta que se limpie
            self.input_path = file_path
            nombre_archivo = os.path.basename(file_path)
            self.label_archivo.config(text=f"✅ Archivo cargado: {nombre_archivo}", bootstyle=SUCCESS)
            self.label_reporte.config(text="Listo para iniciar limpieza.", bootstyle=DEFAULT)
            self.progress_bar['value'] = 0
            self.label_progreso_msg.config(text="Esperando inicio...", bootstyle=INFO)
        else:
            self.label_archivo.config(text="❌ Archivo NO cargado.", bootstyle=DANGER)
            self.btn_limpiar.config(state=DISABLED)

    def ejecutar_limpieza(self):
        finca_id = self.finca_id_var.get().strip()
        if not finca_id:
            messagebox.showerror("Error de Configuración", "Debe ingresar un 'ID de Finca' para procesar el archivo.")
            return

        self.btn_limpiar.config(state=DISABLED, text="⏳ PROCESANDO...")
        self.btn_seleccionar.config(state=DISABLED)
        self.btn_subir.config(state=DISABLED)
        self.update_progress(0, "Iniciando proceso...")

        # (Revertimos el cambio del 'FutureWarning' para evitar el 'KeyError')
        success, reporte_texto = self.limpiador.procesar_y_exportar(self.input_path, self.output_path, finca_id)
        
        self.btn_limpiar.config(state=NORMAL, text="✨ 1. INICIAR LIMPIEZA")
        self.btn_seleccionar.config(state=NORMAL)

        if success:
            self.label_reporte.config(text=reporte_texto.strip(), bootstyle=SUCCESS)
            self.label_progreso_msg.config(text="¡LIMPIEZA TERMINADA! Archivo Listo para subir.", bootstyle=SUCCESS)
            self.btn_subir.config(state=NORMAL) # <-- Activa el botón de subida
            messagebox.showinfo("¡Éxito!", f"¡Limpieza finalizada! El archivo 'Palmas_LIMPIAS.csv' está listo.\n\nAhora puede presionar el botón 'SUBIR A SIOMA'.")
        else:
            self.label_reporte.config(text=reporte_texto.strip(), bootstyle=DANGER)
            self.label_progreso_msg.config(text="ERROR EN EL PROCESO DE LIMPIEZA.", bootstyle=DANGER)
            messagebox.showerror("Error Grave", f"Hubo un fallo en la limpieza. Revise el reporte en pantalla.")

    # --- NUEVAS Funciones de Lógica (API) ---

    def iniciar_subida_api(self):
        """Prepara e inicia el hilo de subida a la API."""
        token = self.token_var.get().strip()
        if not token:
            messagebox.showerror("Error de Configuración", "Debe ingresar un 'Token de Autorización API' para subir el archivo.")
            return
            
        # Desactivar botones durante la subida
        self.btn_limpiar.config(state=DISABLED)
        self.btn_seleccionar.config(state=DISABLED)
        self.btn_subir.config(state=DISABLED, text="🛰️ SUBIENDO A API...")
        
        self.update_progress(0, "Iniciando subida a la API...", bootstyle=INFO)
        
        # Iniciar la subida en un hilo separado para no congelar la GUI
        threading.Thread(
            target=self._ejecutar_subida_api, 
            args=(token, self.output_path), 
            daemon=True
        ).start()

    def _ejecutar_subida_api(self, token, filepath):
        """Contiene la lógica de red (requests). Se ejecuta en un hilo."""
        try:
            # 1. Preparar cabeceras y archivos
            headers = {'Authorization': token} # La doc no especifica 'Bearer ', así que se envía directo
            
            with open(filepath, 'rb') as f:
                files = {'file': (os.path.basename(filepath), f, 'text/csv')}
                
                # 2. Hacer la petición POST (timeout de 60s)
                response = requests.post(self.api_url, headers=headers, files=files, timeout=60)

            # 3. Analizar la respuesta
            if response.status_code == 200:
                try:
                    data = response.json()
                    if data.get("status") == "success":
                        msg = f"✅ ÉXITO API: {data.get('message')}"
                        style = SUCCESS
                    else:
                        msg = f"❌ ERROR API: {data.get('message')} (Código: {data.get('codigo')})"
                        style = DANGER
                except requests.exceptions.JSONDecodeError:
                    msg = f"❌ ERROR API: La respuesta del servidor no es un JSON válido. (Respuesta: {response.text[:100]}...)"
                    style = DANGER
            else:
                msg = f"❌ ERROR HTTP: {response.status_code}. (Respuesta: {response.text[:100]}...)"
                style = DANGER

        except requests.exceptions.Timeout:
            msg = "❌ ERROR API: Timeout. El servidor tardó más de 60 segundos en responder."
            style = DANGER
        except requests.exceptions.ConnectionError:
            msg = "❌ ERROR API: No se pudo conectar al servidor. Revisa tu internet o la URL de la API."
            style = DANGER
        except Exception as e:
            msg = f"❌ ERROR INESPERADO: {str(e)}"
            style = DANGER
        
        # 4. Enviar el resultado de vuelta a la GUI (de forma segura)
        self.after(0, self.finalizar_subida, msg, style)

    def finalizar_subida(self, message, bootstyle):
        """Actualiza la GUI cuando la subida termina. Se ejecuta en el hilo principal."""
        self.label_reporte.config(text=message, bootstyle=bootstyle)
        
        if bootstyle == SUCCESS:
            self.label_progreso_msg.config(text="¡Archivo subido con éxito!", bootstyle=SUCCESS)
            self.progress_bar['value'] = 100
        else:
            self.label_progreso_msg.config(text="Fallo al subir el archivo.", bootstyle=DANGER)
            
        # Reactivar todos los botones
        self.btn_limpiar.config(state=NORMAL)
        self.btn_seleccionar.config(state=NORMAL)
        self.btn_subir.config(state=NORMAL, text="🛰️ 2. SUBIR A SIOMA (API)")