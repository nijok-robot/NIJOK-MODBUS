from flask import Flask, render_template, jsonify, request
import modbus_client
import logging

# Configurar logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Datos iniciales para simular cuando no hay conexión Modbus
default_data = {
    "direction": False,
    "move": False,
    "emergency": False,
    "manual": False,
    "esp32_modbus": False,
    "esp32_sim_internet": False,
    "reference_speed": 0,
    "actual_speed": 0,
    "motor1_temp": 0,
    "motor2_temp": 0,
    "motor1_current": 0,
    "motor2_current": 0,
    "total_current": 0,
    "distance": 0
}

@app.route('/')
def index():
    """Renderiza la página principal del panel de control"""
    return render_template('index.html')

@app.route('/api/get_registers', methods=['GET'])
def get_registers():
    """API endpoint para obtener todos los valores de los registros"""
    try:
        # Intentar leer los registros del dispositivo Modbus
        data = modbus_client.read_registers()
        if data:
            return jsonify(data)
        else:
            logger.warning("No se pudieron leer los registros, devolviendo datos por defecto")
            return jsonify(default_data)
    except Exception as e:
        logger.error(f"Error al obtener registros: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/set_register', methods=['POST'])
def set_register():
    """API endpoint para establecer el valor de un registro específico"""
    try:
        data = request.json
        register = data.get('register')
        value = data.get('value')
        value_type = data.get('type')
        
        if not register or value is None or not value_type:
            return jsonify({"error": "Faltan parámetros requeridos"}), 400
        
        # Convertir el valor según el tipo
        if value_type == 'boolean':
            value = bool(value)
        elif value_type == 'numeric':
            value = float(value)
        
        # Escribir el valor en el registro
        success = modbus_client.write_register(register, value)
        
        if success:
            return jsonify({"success": True, "message": f"Registro {register} actualizado correctamente"})
        else:
            return jsonify({"error": f"No se pudo actualizar el registro {register}"}), 500
    
    except Exception as e:
        logger.error(f"Error al establecer registro: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/status', methods=['GET'])
def get_status():
    """API endpoint para verificar el estado de la conexión Modbus"""
    try:
        status = modbus_client.check_connection()
        return jsonify(status)
    except Exception as e:
        logger.error(f"Error al verificar estado: {str(e)}")
        return jsonify({"connected": False, "error": str(e)}), 500

if __name__ == '__main__':
    # Para desarrollo, habilitar el modo debug
    app.run(debug=True, host='0.0.0.0', port=5000)