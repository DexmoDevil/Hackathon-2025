import requests
import urllib3

# Desactiva advertencias SSL (solo en desarrollo)
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# --- CONFIGURACIÓN ---
url = "https://api.sioma.dev/api/v1/spots/upload"
token = "TZtFlm+l9CS0ksbBr3eqbQ=="   # tu token real
csv_file = "Spots.csv"              # nombre del archivo CSV

# --- ENVÍO DEL ARCHIVO ---
try:
    with open(csv_file, "rb") as f:
        files = {"file": f}
        headers = {"Authorization": f"Bearer {token}"}

        print("⏳ Subiendo archivo a Sioma...")
        response = requests.post(url, files=files, headers=headers, verify=False)

        if response.status_code == 200:
            print("✅ Respuesta del servidor:")
            print(response.text)
        else:
            print(f"❌ Error {response.status_code}:")
            print(response.text)

except FileNotFoundError:
    print(f"⚠️ No se encontró el archivo {csv_file}. Colócalo en la misma carpeta que este script.")
except Exception as e:
    print(f"⚠️ Error inesperado: {e}")
