#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Modbus RTU Client para ESP32 Control Panel
-----------------------------------------
Este script proporciona funcionalidades para comunicarse con un dispositivo
Modbus RTU a través de un puerto serie.
"""

import time
import logging
import serial.tools.list_ports
from pymodbus.client import ModbusSerialClient
from pymodbus.exceptions import ModbusException, ConnectionException

# Configurar logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Configuración del cliente Modbus
SERIAL_PORT = 'COM11'  # Cambiar según el puerto serie utilizado
BAUDRATE = 9600
SLAVE_ID = 1  # ID del esclavo Modbus

# Mapeo de registros Modbus
# Estos mapeos deben ajustarse según la configuración del dispositivo esclavo
REGISTER_MAP = {
    # Coils (valores booleanos) - Dirección, tipo, descripción
    'direction': (0, 'coil', 'Dirección de movimiento'),
    'move': (1, 'coil', 'Activar movimiento'),
    'emergency': (2, 'coil', 'Parada de emergencia'),
    'manual': (3, 'coil', 'Modo manual'),
    'esp32_modbus': (4, 'coil', 'Estado de conexión ModBUS'),
    'esp32_sim_internet': (5, 'coil', 'Estado de conexión a Internet'),
    
    # Holding Registers (valores numéricos) - Dirección, tipo, descripción, factor de escala
    'reference_speed': (0, 'holding', 'Velocidad de referencia', 1),
    'actual_speed': (1, 'holding', 'Velocidad real', 1),
    'motor1_temp': (2, 'holding', 'Temperatura motor 1', 0.1),
    'motor2_temp': (3, 'holding', 'Temperatura motor 2', 0.1),
    'motor1_current': (4, 'holding', 'Corriente motor 1', 0.01),
    'motor2_current': (5, 'holding', 'Corriente motor 2', 0.01),
    'total_current': (6, 'holding', 'Corriente total', 0.01),
    'distance': (7, 'holding', 'Distancia recorrida', 0.1),
    # Nuevos registros para consumo eléctrico y voltajes
    'power_consumption': (8, 'holding', 'Consumo eléctrico', 0.01),
    'voltage_24v': (9, 'holding', 'Voltaje línea 24V', 0.01),
    'voltage_5v': (10, 'holding', 'Voltaje línea 5V', 0.01),
    'duty_motor1': (11, 'holding', 'Voltaje línea 24V', 1),
    'duty_motor2': (12, 'holding', 'Voltaje línea 5V', 1),
}

def get_available_ports():
    """
    Obtiene la lista de puertos seriales disponibles en el sistema.
    
    Returns:
        list: Lista de nombres de puertos disponibles.
    """
    return [port.device for port in serial.tools.list_ports.comports()]

def create_modbus_client():
    """Crea y devuelve un cliente Modbus RTU configurado."""
    client = ModbusSerialClient(
        port=SERIAL_PORT,
        baudrate=BAUDRATE,
        bytesize=8,
        parity='E',
        stopbits=1,
        timeout=1,
    )
    return client

def limpiar_buffer(client):
    """
    Limpia los búferes de entrada y salida del cliente Modbus para evitar residuos de datos.
    """
    try:
        if client.socket:
            client.socket.reset_input_buffer()
            client.socket.reset_output_buffer()
            logger.debug("Búfer serial limpiado correctamente.")
    except Exception as e:
        logger.warning(f"No se pudo limpiar el buffer serial: {e}")

def check_connection():
    """
    Verifica la conexión con el dispositivo Modbus.
    
    Returns:
        dict: Estado de la conexión.
    """
    client = create_modbus_client()
    try:
        connected = client.connect()
        return {
            "connected": connected,
            "port": SERIAL_PORT,
            "baudrate": BAUDRATE,
            "slave_id": SLAVE_ID
        }
    except Exception as e:
        logger.error(f"Error al verificar conexión: {str(e)}")
        return {"connected": False, "error": str(e)}
    finally:
        client.close()

def read_registers(retries=3, delay=0.5):
    client = create_modbus_client()
    result = {}

    for attempt in range(1, retries + 1):
        try:
            logger.info(f"Intento {attempt} de lectura Modbus...")

            if not client.connect():
                logger.warning("No se pudo conectar al dispositivo Modbus")
                time.sleep(delay)
                continue
            
            limpiar_buffer(client)

            # Leer coils (booleanos)
            coil_addresses = [reg[0] for name, reg in REGISTER_MAP.items() if reg[1] == 'coil']
            if coil_addresses:
                start = min(coil_addresses)
                count = max(coil_addresses) - start + 1
                coil_response = client.read_coils(slave=SLAVE_ID, address=start, count=count)

                if not coil_response.isError():
                    for name, reg in REGISTER_MAP.items():
                        if reg[1] == 'coil':
                            result[name] = coil_response.bits[reg[0] - start]
                else:
                    logger.error(f"Error al leer coils: {coil_response}")
                    continue

            # Leer holding registers (numéricos)
            holding_addresses = [reg[0] for name, reg in REGISTER_MAP.items() if reg[1] == 'holding']
            if holding_addresses:
                start = min(holding_addresses)
                count = max(holding_addresses) - start + 1
                holding_response = client.read_holding_registers(slave=SLAVE_ID, address=start, count=count)

                if not holding_response.isError():
                    for name, reg in REGISTER_MAP.items():
                        if reg[1] == 'holding':
                            address, _, _, scale = reg
                            result[name] = holding_response.registers[address - start] * scale
                else:
                    logger.error(f"Error al leer holding registers: {holding_response}")
                    continue

            client.close()
            return result

        except Exception as e:
            logger.error(f"Error en intento {attempt}: {e}")
            time.sleep(delay)

    client.close()
    return None

def write_register(register_name, value):
    if register_name not in REGISTER_MAP:
        logger.error(f"Registro '{register_name}' no definido")
        return False

    client = create_modbus_client()

    try:
        if not client.connect():
            logger.error("No se pudo conectar al dispositivo Modbus")
            return False
        limpiar_buffer(client)

        address, reg_type, *_ = REGISTER_MAP[register_name]
        if reg_type == 'coil':
            response = client.write_coil(address, bool(value), slave=SLAVE_ID)
        elif reg_type == 'holding':
            scale = REGISTER_MAP[register_name][3]
            scaled_value = int(float(value) / scale)
            response = client.write_register(address, scaled_value, slave=SLAVE_ID)
        else:
            logger.error(f"Tipo de registro '{reg_type}' no soportado")
            return False

        if response.isError():
            logger.error(f"Error al escribir en el registro: {response}")
            return False

        return True

    except Exception as e:
        logger.error(f"Error inesperado: {e}")
        return False

    finally:
        client.close()

# Para pruebas directas del módulo
if __name__ == '__main__':
    print("Puertos seriales disponibles:")
    ports = get_available_ports()
    for port in ports:
        print(f" - {port}")
    
    print("\nVerificando conexión...")
    status = check_connection()
    print(f"Estado: {status}")
    
    if status['connected']:
        print("Leyendo registros...")
        data = read_registers()
        print(f"Datos: {data}")
