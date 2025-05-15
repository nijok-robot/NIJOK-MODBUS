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

// Inicialización cuando el DOM está listo
document.addEventListener('DOMContentLoaded', function() {
    // Cargar datos iniciales
    fetchData();
    
    // Configurar eventos para los botones de actualización
    updateButton.addEventListener('click', fetchData);
    updateButtonMobile.addEventListener('click', fetchData);
    
    // Configurar eventos para los interruptores
    setupSwitches();
});

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
 * @param {string} type - Tipo de notificación ('success' o 'error')
 */
function showToast(message, type) {
    // Crear elemento toast
    const toast = document.createElement('div');
    toast.className = 'toast';
    
    // Icono según el tipo
    const iconName = type === 'success' ? 'check-circle' : 'alert-circle';
    
    toast.innerHTML = `
        <div class="toast-icon">
            <i data-lucide="${iconName}"></i>
        </div>
        <div class="toast-content">
            <h4>${type === 'success' ? 'Éxito' : 'Error'}</h4>
            <p>${message}</p>
        </div>
    `;
    
    // Añadir al DOM
    document.body.appendChild(toast);
    
    // Inicializar icono
    lucide.createIcons({
        icons: {
            'check-circle': {},
            'alert-circle': {}
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