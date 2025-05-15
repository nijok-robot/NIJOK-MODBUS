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
from pymodbus.client import ModbusSerialClient
from pymodbus.exceptions import ModbusException, ConnectionException

# Configurar logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Configuración del cliente Modbus
SERIAL_PORT = 'COM7'  # Cambiar según el puerto serie utilizado
BAUDRATE = 115200
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
}

def create_modbus_client():
    """Crea y devuelve un cliente Modbus RTU configurado."""
    client = ModbusSerialClient(
        port=SERIAL_PORT,
        baudrate=BAUDRATE,
        bytesize=8,
        parity='N',
        stopbits=1,
        timeout=1
    )
    return client

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

def read_registers():
    """
    Lee todos los registros definidos en REGISTER_MAP del dispositivo Modbus.
    
    Returns:
        dict: Diccionario con los valores leídos o None si hay un error.
    """
    client = create_modbus_client()
    result = {}
    
    try:
        if not client.connect():
            logger.error("No se pudo conectar al dispositivo Modbus")
            return None
        
        # Leer coils (valores booleanos)
        coil_addresses = [reg[0] for name, reg in REGISTER_MAP.items() if reg[1] == 'coil']
        if coil_addresses:
            start_address = min(coil_addresses)
            count = max(coil_addresses) - start_address + 1
            coil_response = client.read_coils(start_address, count, unit=SLAVE_ID)
            
            if not coil_response.isError():
                for name, reg in REGISTER_MAP.items():
                    if reg[1] == 'coil':
                        address = reg[0]
                        result[name] = coil_response.bits[address - start_address]
            else:
                logger.error(f"Error al leer coils: {coil_response}")
        
        # Leer holding registers (valores numéricos)
        holding_addresses = [reg[0] for name, reg in REGISTER_MAP.items() if reg[1] == 'holding']
        if holding_addresses:
            start_address = min(holding_addresses)
            count = max(holding_addresses) - start_address + 1
            holding_response = client.read_holding_registers(start_address, count, unit=SLAVE_ID)
            
            if not holding_response.isError():
                for name, reg in REGISTER_MAP.items():
                    if reg[1] == 'holding':
                        address, _, _, scale = reg
                        result[name] = holding_response.registers[address - start_address] * scale
            else:
                logger.error(f"Error al leer holding registers: {holding_response}")
        
        return result
    
    except ConnectionException as e:
        logger.error(f"Error de conexión: {e}")
        return None
    except ModbusException as e:
        logger.error(f"Error de Modbus: {e}")
        return None
    except Exception as e:
        logger.error(f"Error inesperado: {e}")
        return None
    finally:
        client.close()

def write_register(register_name, value):
    """
    Escribe un valor en un registro específico.
    
    Args:
        register_name (str): Nombre del registro a escribir
        value: Valor a escribir (booleano para coils, numérico para holding registers)
    
    Returns:
        bool: True si la escritura fue exitosa, False en caso contrario
    """
    if register_name not in REGISTER_MAP:
        logger.error(f"Registro '{register_name}' no definido")
        return False
    
    client = create_modbus_client()
    
    try:
        if not client.connect():
            logger.error("No se pudo conectar al dispositivo Modbus")
            return False
        
        reg_info = REGISTER_MAP[register_name]
        address = reg_info[0]
        reg_type = reg_info[1]
        
        if reg_type == 'coil':
            # Escribir coil (valor booleano)
            response = client.write_coil(address, bool(value), slave=SLAVE_ID)
        elif reg_type == 'holding':
            # Escribir holding register (valor numérico)
            scale = reg_info[3]
            scaled_value = int(float(value) / scale)
            response = client.write_register(address, scaled_value, slave=SLAVE_ID)
        else:
            logger.error(f"Tipo de registro '{reg_type}' no soportado")
            return False
        
        if response.isError():
            logger.error(f"Error al escribir en el registro: {response}")
            return False
        
        return True
    
    except ConnectionException as e:
        logger.error(f"Error de conexión: {e}")
        return False
    except ModbusException as e:
        logger.error(f"Error de Modbus: {e}")
        return False
    except Exception as e:
        logger.error(f"Error inesperado: {e}")
        return False
    finally:
        client.close()

# Para pruebas directas del módulo
if __name__ == '__main__':
    print("Verificando conexión...")
    status = check_connection()
    print(f"Estado: {status}")
    
    if status['connected']:
        print("Leyendo registros...")
        data = read_registers()
        print(f"Datos: {data}")