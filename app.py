from flask import Flask, render_template, jsonify, request
import modbus_client
import logging
import serial.tools.list_ports

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

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
    "distance": 0,
    # Nuevos campos para consumo eléctrico y voltajes
    "power_consumption": 0,
    "voltage_24v": 0,
    "voltage_5v": 0,
    "duty_motor1": 0,
    "duty_motor2": 0
}

reference_speed_options = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 70, 100]

@app.route('/')
def index():
    logger.info("Renderizando interfaz principal...")
    try:
        data = modbus_client.read_registers()
        if data is None:
            logger.warning("Modbus no devolvió datos válidos. Usando valores por defecto.")
            data = default_data
    except Exception as e:
        logger.error(f"Error al cargar registros en la interfaz: {e}")
        data = default_data
    return render_template('index.html', **data)

@app.route('/api/get_registers', methods=['GET'])
def get_registers():
    try:
        logger.info("API - Obteniendo registros de Modbus...")
        data = modbus_client.read_registers()
        if data is not None:
            return jsonify(data)
        else:
            return jsonify(default_data)
    except Exception as e:
        logger.error(f"Error al obtener registros: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/set_register', methods=['POST'])
def set_register():
    try:
        data = request.json
        register = data.get('register')
        value = data.get('value')
        value_type = data.get('type')

        if not register or value is None or not value_type:
            return jsonify({"error": "Faltan parámetros requeridos"}), 400

        # Verificar que no se intenten modificar campos de solo lectura
        readonly_fields = ['power_consumption', 'voltage_24v', 'voltage_5v']
        if register in readonly_fields:
            return jsonify({
                "error": f"El campo {register} es de solo lectura y no puede ser modificado"
            }), 400

        if value_type == 'boolean':
            value = bool(value)
        elif value_type == 'numeric':
            value = float(value)

        success = modbus_client.write_register(register, value)

        if success:
            return jsonify({"success": True, "message": f"Registro {register} actualizado"})
        else:
            return jsonify({"error": f"No se pudo actualizar el registro {register}"}), 500

    except Exception as e:
        logger.error(f"Error en set_register: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/status', methods=['GET'])
def get_status():
    try:
        status = modbus_client.check_connection()
        return jsonify(status)
    except Exception as e:
        logger.error(f"Error en status: {e}")
        return jsonify({"connected": False, "error": str(e)}), 500

@app.route('/api/serial_ports', methods=['GET'])
def get_serial_ports():
    try:
        ports = [port.device for port in serial.tools.list_ports.comports()]
        current_port = modbus_client.SERIAL_PORT
        return jsonify({"success": True, "ports": ports, "current_port": current_port})
    except Exception as e:
        logger.error(f"Error obteniendo puertos seriales: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/reference_speed_options', methods=['GET'])
def get_reference_speed_options():
    try:
        try:
            data = modbus_client.read_registers()
            current_speed = data.get('reference_speed', 0) if data else 0
        except Exception as modbus_error:
            logger.warning(f"No se pudo leer velocidad actual: {modbus_error}")
            current_speed = 0

        return jsonify({
            "success": True,
            "options": reference_speed_options,
            "current_speed": current_speed
        })
    except Exception as e:
        logger.error(f"Error en reference_speed_options: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/apply_configuration', methods=['POST'])
def apply_configuration():
    try:
        data = request.json
        serial_port = data.get('serial_port')
        reference_speed = data.get('reference_speed')

        if not serial_port:
            return jsonify({"error": "Puerto serial no especificado"}), 400
        if reference_speed is None:
            return jsonify({"error": "Velocidad no especificada"}), 400

        modbus_client.SERIAL_PORT = serial_port
        logger.info(f"Puerto serial cambiado a: {serial_port}")

        try:
            success = modbus_client.write_register('reference_speed', reference_speed)
            if success:
                logger.info(f"Velocidad de referencia actualizada a {reference_speed}")
        except Exception as modbus_error:
            logger.warning(f"No se pudo escribir la velocidad: {modbus_error}")

        return jsonify({
            "success": True,
            "message": "Configuración aplicada",
            "warning": "Verifique si la comunicación fue exitosa"
        })

    except Exception as e:
        logger.error(f"Error aplicando configuración: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
