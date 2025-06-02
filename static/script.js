/**
 * ESP32 Control Panel - JavaScript
 * 
 * Este script maneja la interacción con la interfaz de usuario y
 * la comunicación con el backend Flask a través de API REST.
 */

// Estado global de los datos
let panelData = {
    direction: false,
    move: false,
    emergency: false,
    manual: false,
    esp32_modbus: false,
    esp32_sim_internet: false,
    reference_speed: 0,
    actual_speed: 0,
    motor1_temp: 0,
    motor2_temp: 0,
    motor1_current: 0,
    motor2_current: 0,
    total_current: 0,
    distance: 0
};

// Configuración de conexión
let connectionConfig = {
    serialPort: '',
    referenceSpeed: 0
};

// Unidades para los valores numéricos
const units = {
    reference_speed: 'mm/s',
    actual_speed: 'mm/s',
    motor1_temp: '°C',
    motor2_temp: '°C',
    motor1_current: 'A',
    motor2_current: 'A',
    total_current: 'A',
    distance: 'm'
};

const precisionMap = {
    reference_speed: 0,
    actual_speed: 1,
    motor1_temp: 2,
    motor2_temp: 2,
    motor1_current: 3,
    motor2_current: 3,
    total_current: 3,
    distance: 2
};

let lastDirection = null;


// Elementos DOM
const updateButton = document.getElementById('updateButton');
const updateButtonMobile = document.getElementById('updateButtonMobile');
const errorPanel = document.getElementById('errorPanel');
const errorMessage = document.getElementById('errorMessage');
const serialPortSelect = document.getElementById('serial-port');
const referenceSpeedSelect = document.getElementById('reference-speed');
const applyConfigButton = document.getElementById('apply-config');

document.addEventListener('DOMContentLoaded', function () {
    fetchSerialPorts();
    fetchReferenceSpeedOptions();
    fetchData(true);  // Carga inicial con toast

    // 🔄 Actualización automática cada 1 segundo (sin toast)
    setInterval(fetchData, 1000);

    updateButton.addEventListener('click', () => fetchData(true));
    updateButtonMobile.addEventListener('click', () => fetchData(true));
    applyConfigButton.addEventListener('click', applyConfiguration);
    setupSwitches();
});



/**
 * Obtiene la lista de puertos seriales disponibles
 */
async function fetchSerialPorts() {
    try {
        const response = await fetch('/api/serial_ports');
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Limpiar opciones actuales
        serialPortSelect.innerHTML = '';
        
        // Añadir opciones de puertos
        if (data.ports && data.ports.length > 0) {
            data.ports.forEach(port => {
                const option = document.createElement('option');
                option.value = port;
                option.textContent = port;
                serialPortSelect.appendChild(option);
            });
            
            // Seleccionar el puerto actual si existe
            if (data.current_port) {
                serialPortSelect.value = data.current_port;
                connectionConfig.serialPort = data.current_port;
            }
        } else {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No hay puertos disponibles';
            serialPortSelect.appendChild(option);
        }
    } catch (error) {
        console.error('Error al obtener puertos seriales:', error);
        
        // Opción de error
        serialPortSelect.innerHTML = '';
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Error al cargar puertos';
        serialPortSelect.appendChild(option);
    }
}

/**
 * Obtiene las opciones de velocidad de referencia disponibles
 */
async function fetchReferenceSpeedOptions() {
    try {
        const response = await fetch('/api/reference_speed_options');
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Limpiar opciones actuales
        referenceSpeedSelect.innerHTML = '';
        
        // Añadir opciones de velocidad
        if (data.options && data.options.length > 0) {
            data.options.forEach(speed => {
                const option = document.createElement('option');
                option.value = speed;
                option.textContent = `${speed} RPM`;
                referenceSpeedSelect.appendChild(option);
            });
            
            // Seleccionar la velocidad actual si existe
            if (data.current_speed !== undefined) {
                referenceSpeedSelect.value = data.current_speed;
                connectionConfig.referenceSpeed = data.current_speed;
            }
        } else {
            const option = document.createElement('option');
            option.value = '';
            option.textContent = 'No hay opciones disponibles';
            referenceSpeedSelect.appendChild(option);
        }
    } catch (error) {
        console.error('Error al obtener opciones de velocidad:', error);
        
        // Opción de error
        referenceSpeedSelect.innerHTML = '';
        
        // Añadir opciones predeterminadas en caso de error
        const defaultSpeeds = [0, 100, 200, 300, 400, 500, 750, 1000, 1500, 2000];
        defaultSpeeds.forEach(speed => {
            const option = document.createElement('option');
            option.value = speed;
            option.textContent = `${speed} RPM`;
            referenceSpeedSelect.appendChild(option);
        });
        
        // Mostrar notificación de error
        showToast('Error al cargar opciones de velocidad. Usando valores predeterminados.', 'error');
    }
}

/**
 * Aplica la configuración seleccionada
 */
async function applyConfiguration() {
    const selectedPort = serialPortSelect.value;
    const selectedSpeed = parseInt(referenceSpeedSelect.value, 10);
    
    if (!selectedPort) {
        showToast('Por favor, seleccione un puerto serial', 'error');
        return;
    }
    
    if (isNaN(selectedSpeed)) {
        showToast('Por favor, seleccione una velocidad válida', 'error');
        return;
    }
    
    // Deshabilitar botón mientras se aplica la configuración
    applyConfigButton.disabled = true;
    
    try {
        // Enviar configuración al servidor
        const response = await fetch('/api/apply_configuration', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                serial_port: selectedPort,
                reference_speed: selectedSpeed
            }),
        });
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            // Actualizar configuración local
            connectionConfig.serialPort = selectedPort;
            connectionConfig.referenceSpeed = selectedSpeed;
            
            // Actualizar datos del panel
            fetchData();
            
            // Mostrar mensaje de éxito
            showToast('Configuración aplicada correctamente', 'success');
            
            // Si hay una advertencia, mostrarla también
            if (result.warning) {
                setTimeout(() => {
                    showToast(`Advertencia: ${result.warning}`, 'warning');
                }, 1000);
            }
        } else {
            throw new Error(result.error || 'Error desconocido');
        }
    } catch (error) {
        console.error('Error al aplicar configuración:', error);
        showToast(`Error: ${error.message}`, 'error');
    } finally {
        // Restaurar botón
        applyConfigButton.disabled = false;
    }
}




/**
 * Configura los eventos para los interruptores booleanos
 */
function setupSwitches() {
    const switches = document.querySelectorAll('input[type="checkbox"][data-register]');
    
    switches.forEach(switchElement => {
        switchElement.addEventListener('change', function() {
            const register = this.getAttribute('data-register');
            const value = this.checked;
            
            updateRegister(register, value, 'boolean');
        });
    });
}

/**
 * Obtiene los datos del servidor y actualiza la interfaz
 * @param {boolean} showToastOnSuccess - Muestra toast si es true
 */
async function fetchData(showToastOnSuccess = false) {
    updateButton.disabled = true;
    updateButtonMobile.disabled = true;

    try {
        const response = await fetch('/api/get_registers');

        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const data = await response.json();

        panelData = data;
        updateUI();

        errorPanel.style.display = 'none';

        if (showToastOnSuccess) {
            showToast('Datos actualizados correctamente', 'success');
        }

    } catch (error) {
        console.error('Error al obtener datos:', error);
        errorMessage.textContent = error.message || 'Error de conexión con el servidor';
        errorPanel.style.display = 'block';
        showToast('Error al actualizar datos', 'error');
    } finally {
        updateButton.disabled = false;
        updateButtonMobile.disabled = false;
    }
}


/**
 * Actualiza un registro en el servidor
 * @param {string} register - Nombre del registro
 * @param {any} value - Valor a establecer
 * @param {string} type - Tipo de valor ('boolean' o 'numeric')
 */
async function updateRegister(register, value, type) {
    try {
        // Actualizar la interfaz inmediatamente para mejor respuesta
        if (type === 'boolean') {
            document.getElementById(`switch-${register}`).checked = value;
        }
        
        const response = await fetch('/api/set_register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                register,
                value,
                type
            }),
        });
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            // Actualizar el estado global
            panelData[register] = value;
            showToast(`${register} actualizado correctamente`, 'success');
        } else {
            throw new Error(result.error || 'Error desconocido');
        }
    } catch (error) {
        console.error(`Error al actualizar ${register}:`, error);
        
        // Revertir cambio en la interfaz en caso de error
        if (type === 'boolean') {
            document.getElementById(`switch-${register}`).checked = panelData[register];
        }
        
        showToast(`Error al actualizar ${register}`, 'error');
    }
}

function formatFloatSmart(value, decimals = 3) {
    return parseFloat(value.toFixed(decimals)).toString();
}

/**
 * Actualiza la interfaz de usuario con los datos actuales
 */
function updateUI() {
    for (const [key, value] of Object.entries(panelData)) {
        const switchElement = document.getElementById(`switch-${key}`);
        if (switchElement) {
            switchElement.checked = value;
        }

        const valueElement = document.getElementById(key);
        if (valueElement && typeof value === 'number') {
            const decimals = precisionMap[key] !== undefined ? precisionMap[key] : 3;
            const formatted = formatFloatSmart(value, decimals);
            valueElement.textContent = `${formatted} ${units[key] || ''}`;
        }
    }

    // Indicadores de conexión
    ['esp32_modbus', 'esp32_sim_internet'].forEach((statusKey) => {
        const indicator = document.getElementById(`status-${statusKey}`);
        if (indicator) {
            if (panelData[statusKey]) {
                indicator.textContent = 'Conectado';
                indicator.classList.add('connected');
            } else {
                indicator.textContent = 'Desconectado';
                indicator.classList.remove('connected');
            }
        }
    });

    //Ícono de dirección
    const directionIcon = document.getElementById('direction-icon');
    if (directionIcon) {
        const isUp = panelData.direction;
        const isMoving = panelData.move;

        // Detectar si la dirección ha cambiado respecto al estado anterior
        if (lastDirection !== null && lastDirection !== isUp) {
            directionIcon.classList.add('bounce');

            // Eliminar la clase después de la animación para poder reutilizarla
            setTimeout(() => {
                directionIcon.classList.remove('bounce');
            }, 300); // igual al duration de la animación
        }

        lastDirection = isUp;

        // Mantener siempre arrow-up, rotarlo según dirección
        directionIcon.setAttribute('data-lucide', 'arrow-up');

        lucide.createIcons({ icons: { 'arrow-up': {} } });

        // Rotación visual
        directionIcon.style.transform = isUp ? 'rotate(0deg)' : 'rotate(180deg)';

        // Color según movimiento
        directionIcon.classList.remove('active', 'inactive');
        directionIcon.classList.add(isMoving ? 'active' : 'inactive');
    }

}


/**
 * Muestra una notificación toast
 * @param {string} message - Mensaje a mostrar
 * @param {string} type - Tipo de notificación ('success', 'error', 'warning')
 */
function showToast(message, type) {
    // Crear elemento toast
    const toast = document.createElement('div');
    toast.className = 'toast';
    
    // Icono según el tipo
    let iconName, title;
    switch (type) {
        case 'success':
            iconName = 'check-circle';
            title = 'Éxito';
            break;
        case 'warning':
            iconName = 'alert-triangle';
            title = 'Advertencia';
            break;
        case 'error':
        default:
            iconName = 'alert-circle';
            title = 'Error';
            break;
    }
    
    // Añadir clase de color según el tipo
    if (type === 'warning') {
        toast.style.borderLeft = '4px solid var(--warning)';
    } else if (type === 'error') {
        toast.style.borderLeft = '4px solid var(--danger)';
    } else {
        toast.style.borderLeft = '4px solid var(--success)';
    }
    
    toast.innerHTML = `
        <div class="toast-icon" style="color: ${type === 'warning' ? 'var(--warning)' : (type === 'error' ? 'var(--danger)' : 'var(--success)')}">
            <i data-lucide="${iconName}"></i>
        </div>
        <div class="toast-content">
            <h4>${title}</h4>
            <p>${message}</p>
        </div>
    `;
    
    // Añadir al DOM
    document.body.appendChild(toast);
    
    // Inicializar icono
    lucide.createIcons({
        icons: {
            'check-circle': {},
            'alert-circle': {},
            'alert-triangle': {}
        },
        attrs: {
            class: ['icon']
        }
    });
    
    // Mostrar el toast
    setTimeout(() => {
        toast.classList.add('active');
    }, 100);
    
    // Ocultar y eliminar después de 3 segundos
    setTimeout(() => {
        toast.classList.remove('active');
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, 3000);
}