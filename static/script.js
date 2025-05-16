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
    reference_speed: 'RPM',
    actual_speed: 'RPM',
    motor1_temp: '°C',
    motor2_temp: '°C',
    motor1_current: 'A',
    motor2_current: 'A',
    total_current: 'A',
    distance: 'm'
};

// Elementos DOM
const updateButton = document.getElementById('updateButton');
const updateButtonMobile = document.getElementById('updateButtonMobile');
const errorPanel = document.getElementById('errorPanel');
const errorMessage = document.getElementById('errorMessage');
const serialPortSelect = document.getElementById('serial-port');
const referenceSpeedSelect = document.getElementById('reference-speed');
const applyConfigButton = document.getElementById('apply-config');

// Inicialización cuando el DOM está listo
document.addEventListener('DOMContentLoaded', function () {
    
     // Cargar puertos seriales disponibles
     fetchSerialPorts();
    
     // Cargar opciones de velocidad de referencia
     fetchReferenceSpeedOptions();

    // Cargar datos iniciales
    fetchData();
    
    // Configurar eventos para los botones de actualización
    updateButton.addEventListener('click', fetchData);
    updateButtonMobile.addEventListener('click', fetchData);

    // Configurar evento para el botón de aplicar configuración
    applyConfigButton.addEventListener('click', applyConfiguration);
    
    // Configurar eventos para los interruptores
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
 */
async function fetchData() {
    // Mostrar estado de carga
    updateButton.disabled = true;
    updateButtonMobile.disabled = true;
    
    try {
        const response = await fetch('/api/get_registers');
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Actualizar el estado global
        panelData = data;
        
        // Actualizar la interfaz
        updateUI();
        
        // Ocultar panel de error si estaba visible
        errorPanel.style.display = 'none';
        
        // Mostrar notificación de éxito
        showToast('Datos actualizados correctamente', 'success');
    } catch (error) {
        console.error('Error al obtener datos:', error);
        
        // Mostrar panel de error
        errorMessage.textContent = error.message || 'Error de conexión con el servidor';
        errorPanel.style.display = 'block';
        
        // Mostrar notificación de error
        showToast('Error al actualizar datos', 'error');
    } finally {
        // Restaurar estado de los botones
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

/**
 * Actualiza la interfaz de usuario con los datos actuales
 */
function updateUI() {
    // Actualizar interruptores booleanos
    for (const [key, value] of Object.entries(panelData)) {
        const switchElement = document.getElementById(`switch-${key}`);
        if (switchElement) {
            switchElement.checked = value;
        }
        
        // Actualizar valores numéricos
        const valueElement = document.getElementById(key);
        if (valueElement && typeof value === 'number') {
            valueElement.textContent = `${value} ${units[key] || ''}`;
        }
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