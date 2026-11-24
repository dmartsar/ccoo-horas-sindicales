/**
 * ============================================
 * PWA Horas Sindicales CCOO - ACEINSA
 * Lógica principal en Vanilla JavaScript
 * ============================================
 */

// ============================================
// CONSTANTES
// ============================================
const STORAGE_KEYS = {
    HISTORIAL: 'historialHorasSindicales',
    SIGNATURE: 'ultimaFirmaGuardada',
    DRAFT: 'borradorActual'
};

const EMAIL_CONFIG = {
    to: ['rrhh@aceinsa.es', 'mjbustillo@aceinsa.es', 'jmolina@aceinsa.es', 'jmpiqueres@aceinsa.es'],
    subject: 'Comunicación de Horas Sindicales - CCOO ACEINSA',
    cc: '',
    bcc: ''
};

const WHATSAPP_NUMBER = '34600000000'; // Reemplazar con número real si es necesario

// ============================================
// ESTADO DE LA APLICACIÓN
// ============================================
const appState = {
    currentDraft: null,
    signature: null,
    canvas: null,
    context: null,
    isDrawing: false,
    lastPoint: null
};

// ============================================
// INICIALIZACIÓN
// ============================================
document.addEventListener('DOMContentLoaded', initApp);

function initApp() {
    registerServiceWorker();
    setupCanvas();
    loadFormData();
    setupEventListeners();
    loadHistory();
    loadDraft();
    setupDate();
    updateTramoSection();
    checkForUpdates();
}

// ============================================
// SERVICE WORKER
// ============================================
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('sw.js')
                .then(registration => {
                    console.log('ServiceWorker registration successful');
                    
                    // Escuchar mensajes del Service Worker
                    navigator.serviceWorker.addEventListener('message', (event) => {
                        if (event.data.type === 'UPDATE_AVAILABLE') {
                            showToast('Nueva versión disponible. Recarga la página.', 'info');
                        }
                    });
                })
                .catch(err => {
                    console.log('ServiceWorker registration failed: ', err);
                });
        });
    }
}

function checkForUpdates() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then(registration => {
            if (registration) {
                registration.update().catch(() => {});
            }
        });
    }
}

// ============================================
// CANVAS PARA FIRMA
// ============================================
function setupCanvas() {
    const canvas = document.getElementById('signatureCanvas');
    const clearBtn = document.getElementById('clearSignature');
    
    if (!canvas) return;
    
    appState.canvas = canvas;
    appState.context = canvas.getContext('2d');
    
    // Configurar tamaño del canvas
    resizeCanvas();
    window.addEventListener('resize', debounce(resizeCanvas, 250));
    
    // Configurar estilo del canvas
    canvas.style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--background-color');
    
    // Eventos de dibujo (Touch)
    canvas.addEventListener('touchstart', startDrawing, { passive: false });
    canvas.addEventListener('touchmove', draw, { passive: false });
    canvas.addEventListener('touchend', endDrawing);
    canvas.addEventListener('touchcancel', endDrawing);
    
    // Eventos de dibujo (Mouse)
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', endDrawing);
    canvas.addEventListener('mouseleave', endDrawing);
    
    // Botón de limpiar
    clearBtn.addEventListener('click', clearSignature);
    
    // Limpiar canvas inicial
    clearSignature();
}

function resizeCanvas() {
    if (!appState.canvas) return;
    
    const container = appState.canvas.parentElement;
    const maxWidth = 400;
    const width = Math.min(container.clientWidth, maxWidth);
    const height = 200;
    
    appState.canvas.width = width;
    appState.canvas.height = height;
    
    // Redibujar firma si existe
    if (appState.signature) {
        redrawSignature();
    } else {
        clearCanvas();
    }
}

function startDrawing(e) {
    appState.isDrawing = true;
    const point = getCanvasPoint(e);
    appState.lastPoint = point;
    
    // Añadir clase para ocultar placeholder
    appState.canvas.classList.add('has-signature');
}

function draw(e) {
    if (!appState.isDrawing) return;
    
    e.preventDefault();
    const point = getCanvasPoint(e);
    
    drawLine(appState.lastPoint, point);
    appState.lastPoint = point;
}

function endDrawing() {
    appState.isDrawing = false;
    appState.lastPoint = null;
    
    // Guardar firma
    saveSignature();
}

function getCanvasPoint(e) {
    const canvas = appState.canvas;
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    
    if (e.touches) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }
    
    return {
        x: clientX - rect.left,
        y: clientY - rect.top
    };
}

function drawLine(from, to) {
    const ctx = appState.context;
    
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#212121';
    ctx.lineWidth = 3;
    
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(to.x, to.y);
    ctx.stroke();
}

function clearCanvas() {
    const ctx = appState.context;
    const canvas = appState.canvas;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    appState.canvas.classList.remove('has-signature');
    appState.signature = null;
}

function clearSignature() {
    clearCanvas();
    localStorage.removeItem(STORAGE_KEYS.SIGNATURE);
    updateFormState();
}

function saveSignature() {
    const canvas = appState.canvas;
    const signatureData = canvas.toDataURL('image/png');
    appState.signature = signatureData;
    localStorage.setItem(STORAGE_KEYS.SIGNATURE, signatureData);
    updateFormState();
}

function redrawSignature() {
    if (!appState.signature) return;
    
    const img = new Image();
    img.onload = () => {
        appState.context.drawImage(img, 0, 0, appState.canvas.width, appState.canvas.height);
        appState.canvas.classList.add('has-signature');
    };
    img.src = appState.signature;
}

function loadSignature() {
    const savedSignature = localStorage.getItem(STORAGE_KEYS.SIGNATURE);
    if (savedSignature) {
        appState.signature = savedSignature;
        redrawSignature();
    }
}

// ============================================
// EVENT LISTENERS
// ============================================
function setupEventListeners() {
    // Modalidad change
    const modalidadRadios = document.querySelectorAll('input[name="modalidad"]');
    modalidadRadios.forEach(radio => {
        radio.addEventListener('change', updateTramoSection);
    });
    
    // Botones de acciones
    document.getElementById('generatePreview').addEventListener('click', generatePreview);
    document.getElementById('saveDraft').addEventListener('click', saveDraft);
    document.getElementById('sendEmail').addEventListener('click', sendEmail);
    document.getElementById('shareWhatsApp').addEventListener('click', shareViaWhatsApp);
    document.getElementById('shareDocument').addEventListener('click', shareDocument);
    document.getElementById('printDocument').addEventListener('click', printDocument);
    
    // Historial
    document.getElementById('toggleHistory').addEventListener('click', toggleHistory);
    document.getElementById('exportHistory').addEventListener('click', exportHistory);
    document.getElementById('importHistory').addEventListener('click', showImportModal);
    
    // Modal de importación
    document.getElementById('cancelImport').addEventListener('click', hideImportModal);
    document.getElementById('confirmImport').addEventListener('click', confirmImport);
    
    // Cargar firma guardada
    loadSignature();
    
    // Auto-guardar formulario cada 30 segundos
    setInterval(autoSaveDraft, 30000);
    
    // Guardar al cambiar valores
    const form = document.getElementById('horasSindicalesForm');
    form.addEventListener('input', updateFormState);
    form.addEventListener('change', updateFormState);
}

function updateTramoSection() {
    const modalidad = document.querySelector('input[name="modalidad"]:checked').value;
    const tramoSection = document.getElementById('tramoHorarioSection');
    
    if (modalidad === 'tramo_horario') {
        tramoSection.classList.remove('hidden');
    } else {
        tramoSection.classList.add('hidden');
    }
}

function setupDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('fecha').value = today;
}

// ============================================
// GESTIÓN DE FORMULARIO
// ============================================
function getFormData() {
    return {
        delegado: document.getElementById('delegado').value,
        empresa: document.getElementById('empresa').value,
        fecha: document.getElementById('fecha').value,
        modalidad: document.querySelector('input[name="modalidad"]:checked').value,
        horaInicio: document.getElementById('horaInicio').value,
        horaFin: document.getElementById('horaFin').value,
        observaciones: document.getElementById('observaciones').value,
        firma: appState.signature,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}

function setFormData(data) {
    if (!data) return;
    
    document.getElementById('delegado').value = data.delegado || 'DAVID MARTINEZ';
    document.getElementById('empresa').value = data.empresa || 'ACEINSA CONSERVACION VILLAJOYOSA';
    document.getElementById('fecha').value = data.fecha || new Date().toISOString().split('T')[0];
    
    if (data.modalidad) {
        const radio = document.querySelector(`input[name="modalidad"][value="${data.modalidad}"]`);
        if (radio) radio.checked = true;
    }
    
    document.getElementById('horaInicio').value = data.horaInicio || '';
    document.getElementById('horaFin').value = data.horaFin || '';
    document.getElementById('observaciones').value = data.observaciones || '';
    
    if (data.firma) {
        appState.signature = data.firma;
        redrawSignature();
    } else {
        clearCanvas();
    }
    
    updateTramoSection();
    updateFormState();
}

function updateFormState() {
    const formData = getFormData();
    appState.currentDraft = formData;
    
    // Guardar borrador temporalmente
    localStorage.setItem(STORAGE_KEYS.DRAFT, JSON.stringify(formData));
    
    // Validar formulario
    validateForm();
}

function loadFormData() {
    const savedDraft = localStorage.getItem(STORAGE_KEYS.DRAFT);
    if (savedDraft) {
        try {
            const draft = JSON.parse(savedDraft);
            setFormData(draft);
        } catch (e) {
            console.error('Error al cargar borrador:', e);
        }
    }
}

function loadDraft() {
    // Se carga automáticamente en loadFormData
}

function saveDraft() {
    const formData = getFormData();
    
    if (!validateForm(true)) {
        showToast('Completa los campos obligatorios', 'error');
        return;
    }
    
    // Guardar en historial como borrador
    saveToHistory(formData, 'borrador');
    
    showToast('Borrador guardado correctamente', 'success');
}

function autoSaveDraft() {
    const formData = getFormData();
    localStorage.setItem(STORAGE_KEYS.DRAFT, JSON.stringify(formData));
}

function validateForm(showMessage = false) {
    const formData = getFormData();
    
    if (!formData.delegado || !formData.fecha) {
        if (showMessage) {
            showToast('Debes completar el nombre y la fecha', 'error');
        }
        return false;
    }
    
    if (formData.modalidad === 'tramo_horario') {
        if (!formData.horaInicio || !formData.horaFin) {
            if (showMessage) {
                showToast('Debes especificar las horas para el tramo horario', 'error');
            }
            return false;
        }
    }
    
    if (!formData.firma) {
        if (showMessage) {
            showToast('Debes añadir tu firma', 'error');
        }
        return false;
    }
    
    return true;
}

// ============================================
// GENERACIÓN DE DOCUMENTO
// ============================================
function generatePreview() {
    if (!validateForm(true)) return;
    
    const formData = getFormData();
    const previewContainer = document.getElementById('documentPreview');
    const previewSection = document.getElementById('previewSection');
    
    const documentHTML = generateDocumentHTML(formData);
    previewContainer.innerHTML = documentHTML;
    previewSection.classList.remove('hidden');
    
    // Scroll a la vista previa
    previewSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    showToast('Vista previa generada', 'success');
}

function generateDocumentHTML(formData) {
    const formatDate = (dateStr) => {
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
    };
    
    const getModalidadText = () => {
        if (formData.modalidad === 'jornada_completa') {
            return 'TODA LA JORNADA LABORAL';
        } else {
            return `DE ${formData.horaInicio || ''} A ${formData.horaFin || ''} HORAS`;
        }
    };
    
    return `
        <div class="document-content">
            <div class="cco-header">
                <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 100'%3E%3Crect width='400' height='100' fill='%23d32f2f'/%3E%3Ctext x='200' y='35' font-size='24' text-anchor='middle' fill='white' font-family='Arial, sans-serif'%3ECOMISIONS OBRERES%3C/text%3E%3Ctext x='200' y='55' font-size='16' text-anchor='middle' fill='white' font-family='Arial, sans-serif'%3ede l%26apos;Hàbitat del País Valencià%3C/text%3E%3Ctext x='200' y='75' font-size='14' text-anchor='middle' fill='white' font-family='Arial, sans-serif'%3ECCOO HÀBITAT ALICANTE%3C/text%3E%3C/svg%3E" alt="CCOO Hábitat Alicante" style="max-width: 100%; height: auto; margin-bottom: 1rem;">
                <div class="cco-subtitle">Comunicación de horas sindicales</div>
            </div>
            
            <div class="document-body">
                <p style="margin-bottom: 1.5rem; text-align: right;">Villajoyosa, ${formatDate(formData.fecha)}</p>
                
                <p style="margin-bottom: 1.5rem;">
                    Por medio del presente escrito, en mi calidad de delegado/a sindical de CCOO en la empresa 
                    <strong>${formData.empresa}</strong>, y amparado en lo dispuesto en el <strong>Art. 68.e del Estatuto de los Trabajadores</strong> 
                    y <strong>Ley Orgánica 11/1985</strong>, comunico que voy a hacer uso de horas sindicales retribuidas con el siguiente detalle:
                </p>
                
                <div class="form-field">
                    <span class="form-label">Delegado/a:</span>
                    <span class="form-value"><strong>${formData.delegado}</strong></span>
                </div>
                
                <div class="form-field">
                    <span class="form-label">Empresa:</span>
                    <span class="form-value">${formData.empresa}</span>
                </div>
                
                <div class="form-field">
                    <span class="form-label">Fecha:</span>
                    <span class="form-value">${formatDate(formData.fecha)}</span>
                </div>
                
                <div class="form-field">
                    <span class="form-label">Modalidad:</span>
                    <span class="form-value">
                        <span class="checkbox checked">X</span> ${getModalidadText()}
                    </span>
                </div>
                
                ${formData.observaciones ? `
                <div class="form-field">
                    <span class="form-label">Observaciones:</span>
                    <span class="form-value">${formData.observaciones}</span>
                </div>
                ` : ''}
                
                <p style="margin-top: 1.5rem; margin-bottom: 2rem;">
                    Atentamente,
                </p>
                
                <div class="signature-display">
                    <div style="text-align: right; margin-bottom: 0.5rem;"><strong>Firma:</strong></div>
                    ${formData.firma ? `<img src="${formData.firma}" alt="Firma digital" class="signature-image">` : '<div style="min-height: 50px; border-bottom: 1px solid #333; width: 200px; margin-left: auto;"></div>'}
                </div>
                
                <div style="margin-top: 2rem; text-align: right;">
                    <div><strong>${formData.delegado}</strong></div>
                    <div style="font-size: 0.9em; color: #666;">Delegado/a Sindical CCOO</div>
                </div>
            </div>
            
            <div class="legal-footer">
                <p><strong>Fundamento Legal:</strong></p>
                <p>Art. 68.e del Estatuto de los Trabajadores: "Los delegados sindicales tendrán derecho a un crédito de horas mensuales retribuidas para el ejercicio de sus funciones sindicales. Dicho crédito será de las horas que se fijen en los convenios colectivos. A falta de pacto, la CONFEDERACIÓN SINDICAL DE COMISIONES OBRERAS tendrán derecho a 8 horas al mes."</p>
                <p>Ley Orgánica 11/1985, de 2 de agosto, de Libertad Sindical.</p>
            </div>
        </div>
    `;
}

// ============================================
// EXPORTACIÓN Y COMPARTIR
// ============================================
function sendEmail() {
    if (!validateForm(true)) return;
    
    const formData = getFormData();
    const documentHTML = generateDocumentHTML(formData);
    
    // Crear texto plano para el email
    const formatDate = (dateStr) => {
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('es-ES');
    };
    
    const getModalidadText = () => {
        if (formData.modalidad === 'jornada_completa') {
            return 'Toda la jornada laboral';
        } else {
            return `Tramo horario de ${formData.horaInicio || ''} a ${formData.horaFin || ''} horas`;
        }
    };
    
    const emailBody = `
COMUNICACIÓN DE HORAS SINDICALES - CCOO ACEINSA

Villajoyosa, ${formatDate(formData.fecha)}

Por medio del presente escrito, en mi calidad de delegado/a sindical de CCOO en la empresa ${formData.empresa}, y amparado en lo dispuesto en el Art. 68.e del Estatuto de los Trabajadores y Ley Orgánica 11/1985, comunico que voy a hacer uso de horas sindicales retribuidas.

Datos de la comunicación:
- Delegado/a: ${formData.delegado}
- Empresa: ${formData.empresa}
- Fecha: ${formatDate(formData.fecha)}
- Modalidad: ${getModalidadText()}
${formData.observaciones ? `- Observaciones: ${formData.observaciones}` : ''}

Fundamento Legal:
Art. 68.e del Estatuto de los Trabajadores y Ley Orgánica 11/1985 de Libertad Sindical.

Atentamente,
${formData.delegado}
Delegado/a Sindical CCOO

---
Documento generado desde la PWA de Gestión de Horas Sindicales CCOO ACEINSA
`;
    
    // Codificar el cuerpo y asunto
    const emailSubject = encodeURIComponent(EMAIL_CONFIG.subject);
    const emailBodyEncoded = encodeURIComponent(emailBody);
    const emailTo = EMAIL_CONFIG.to.join(',');
    
    // Crear enlace mailto
    const mailtoLink = `mailto:${emailTo}?subject=${emailSubject}&body=${emailBodyEncoded}`;
    
    // Abrir cliente de email
    window.location.href = mailtoLink;
    
    // Guardar en historial como enviado
    saveToHistory(formData, 'enviado');
    
    showToast('Email preparado. Selecciona tu cliente de correo.', 'success');
}

function shareViaWhatsApp() {
    if (!validateForm(true)) return;
    
    const formData = getFormData();
    
    const formatDate = (dateStr) => {
        const date = new Date(dateStr + 'T00:00:00');
        return date.toLocaleDateString('es-ES');
    };
    
    const getModalidadText = () => {
        if (formData.modalidad === 'jornada_completa') {
            return 'Toda la jornada laboral';
        } else {
            return `Tramo horario de ${formData.horaInicio || ''} a ${formData.horaFin || ''} horas`;
        }
    };
    
    const message = `
📋 COMUNICACIÓN DE HORAS SINDICALES - CCOO ACEINSA

📍 Villajoyosa, ${formatDate(formData.fecha)}

Delegado/a: ${formData.delegado}
Empresa: ${formData.empresa}
Fecha: ${formatDate(formData.fecha)}
Modalidad: ${getModalidadText()}
${formData.observaciones ? `Observaciones: ${formData.observaciones}` : ''}

Amparado en el Art. 68.e del ET y LO 11/1985.

Generado desde PWA CCOO ACEINSA
`;
    
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/?text=${encodedMessage}`;
    
    window.open(whatsappUrl, '_blank');
    
    showToast('WhatsApp abierto. Comparte el mensaje.', 'success');
}

function shareDocument() {
    if (!validateForm(true)) return;
    
    const formData = getFormData();
    const documentHTML = generateDocumentHTML(formData);
    
    // Crear objeto para compartir
    const shareData = {
        title: 'Comunicación de Horas Sindicales',
        text: `Comunicación de horas sindicales - ${formData.delegado} - ${formData.fecha}`,
        url: window.location.href
    };
    
    // Intentar usar Web Share API
    if (navigator.share) {
        navigator.share(shareData)
            .then(() => {
                showToast('Documento compartido', 'success');
                saveToHistory(formData, 'compartido');
            })
            .catch((error) => {
                if (error.name !== 'AbortError') {
                    showToast('Error al compartir: ' + error.message, 'error');
                }
            });
    } else {
        // Fallback: copiar al portapapeles
        fallbackShare(formData);
    }
}

function fallbackShare(formData) {
    const text = `
COMUNICACIÓN DE HORAS SINDICALES - CCOO ACEINSA

Delegado/a: ${formData.delegado}
Empresa: ${formData.empresa}
Fecha: ${new Date(formData.fecha).toLocaleDateString('es-ES')}
Modalidad: ${formData.modalidad === 'jornada_completa' ? 'Toda la jornada' : `Tramo ${formData.horaInicio} a ${formData.horaFin}`}
${formData.observaciones ? `Observaciones: ${formData.observaciones}` : ''}
`;
    
    navigator.clipboard.writeText(text)
        .then(() => {
            showToast('Texto copiado al portapapeles. Pega en tu aplicación favorita.', 'success');
            saveToHistory(formData, 'compartido');
        })
        .catch(() => {
            showToast('No se pudo copiar al portapapeles', 'error');
        });
}

function printDocument() {
    if (!validateForm(true)) return;
    
    const formData = getFormData();
    const previewContainer = document.getElementById('documentPreview');
    
    // Generar y mostrar vista previa temporalmente
    const documentHTML = generateDocumentHTML(formData);
    previewContainer.innerHTML = documentHTML;
    
    // Forzar impresión
    setTimeout(() => {
        window.print();
        
        // Guardar en historial
        saveToHistory(formData, 'impreso');
    }, 250);
}

// ============================================
// HISTORIAL
// ============================================
function saveToHistory(data, action) {
    let history = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORIAL)) || [];
    
    const historyItem = {
        id: Date.now().toString(),
        data: data,
        action: action,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    history.unshift(historyItem);
    
    // Limitar historial a 50 entradas
    if (history.length > 50) {
        history = history.slice(0, 50);
    }
    
    localStorage.setItem(STORAGE_KEYS.HISTORIAL, JSON.stringify(history));
    
    // Recargar la lista del historial
    loadHistory();
}

function loadHistory() {
    const historyList = document.getElementById('historyList');
    const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORIAL)) || [];
    
    if (history.length === 0) {
        historyList.innerHTML = `
            <div class="empty-state">
                <span class="icon">📋</span>
                <p>No hay entradas en el historial</p>
            </div>
        `;
        return;
    }
    
    historyList.innerHTML = '';
    
    history.forEach(item => {
        const historyItem = createHistoryItem(item);
        historyList.appendChild(historyItem);
    });
}

function createHistoryItem(item) {
    const div = document.createElement('div');
    div.className = 'history-item';
    div.dataset.id = item.id;
    
    const date = new Date(item.createdAt);
    const formattedDate = date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    const modalidadText = item.data.modalidad === 'jornada_completa' 
        ? 'Toda la jornada' 
        : `Tramo ${item.data.horaInicio || ''} a ${item.data.horaFin || ''}`;
    
    div.innerHTML = `
        <div class="history-item-header">
            <span class="history-item-date">${formattedDate}</span>
            <span class="history-badge ${item.action}">${getActionLabel(item.action)}</span>
        </div>
        <div class="history-item-delegado">${item.data.delegado}</div>
        <div class="history-item-preview">
            ${item.data.empresa} - ${item.data.fecha} - ${modalidadText}
        </div>
        <div class="history-item-actions">
            <button class="btn btn-small" onclick="loadHistoryItem('${item.id}')">
                <span class="icon">📄</span> Cargar
            </button>
            <button class="btn btn-small btn-success" onclick="exportSingleItem('${item.id}')">
                <span class="icon">📥</span> Exportar
            </button>
            <button class="btn btn-small btn-danger" onclick="deleteHistoryItem('${item.id}')">
                <span class="icon">🗑️</span> Eliminar
            </button>
        </div>
    `;
    
    return div;
}

function getActionLabel(action) {
    const labels = {
        'borrador': 'Borrador',
        'enviado': 'Enviado',
        'compartido': 'Compartido',
        'impreso': 'Impreso'
    };
    return labels[action] || action;
}

function toggleHistory() {
    const historyList = document.getElementById('historyList');
    const toggleBtn = document.getElementById('toggleHistory');
    
    historyList.classList.toggle('hidden');
    
    if (historyList.classList.contains('hidden')) {
        toggleBtn.textContent = 'Mostrar Historial';
        toggleBtn.innerHTML = '<span class="icon">📋</span> Mostrar Historial';
    } else {
        toggleBtn.textContent = 'Ocultar Historial';
        toggleBtn.innerHTML = '<span class="icon">📋</span> Ocultar Historial';
    }
}

function loadHistoryItem(itemId) {
    const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORIAL)) || [];
    const item = history.find(i => i.id === itemId);
    
    if (item) {
        setFormData(item.data);
        showToast(`Cargado: ${item.data.delegado} (${new Date(item.data.fecha).toLocaleDateString('es-ES')})`, 'success');
    }
}

function deleteHistoryItem(itemId) {
    if (!confirm('¿Estás seguro de que quieres eliminar esta entrada del historial?')) return;
    
    let history = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORIAL)) || [];
    history = history.filter(i => i.id !== itemId);
    localStorage.setItem(STORAGE_KEYS.HISTORIAL, JSON.stringify(history));
    
    loadHistory();
    showToast('Entrada eliminada', 'success');
}

function exportSingleItem(itemId) {
    const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORIAL)) || [];
    const item = history.find(i => i.id === itemId);
    
    if (item) {
        const dataStr = JSON.stringify(item, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `horas-sindicales-${item.data.delegado}-${item.id}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        showToast('Entrada exportada', 'success');
    }
}

function exportHistory() {
    const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORIAL)) || [];
    
    if (history.length === 0) {
        showToast('No hay datos en el historial para exportar', 'error');
        return;
    }
    
    const dataStr = JSON.stringify(history, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `historial-horas-sindicales-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showToast('Historial exportado', 'success');
}

function showImportModal() {
    document.getElementById('importModal').classList.remove('hidden');
    document.getElementById('importTextarea').value = '';
    document.getElementById('importTextarea').focus();
}

function hideImportModal() {
    document.getElementById('importModal').classList.add('hidden');
}

function confirmImport() {
    const textarea = document.getElementById('importTextarea');
    const jsonText = textarea.value.trim();
    
    if (!jsonText) {
        showToast('No hay datos para importar', 'error');
        return;
    }
    
    try {
        const importedData = JSON.parse(jsonText);
        
        if (!Array.isArray(importedData)) {
            throw new Error('El formato no es válido. Se esperaba un array.');
        }
        
        // Guardar en localStorage
        let existingHistory = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORIAL)) || [];
        
        // Verificar que no haya duplicados
        importedData.forEach(item => {
            if (!existingHistory.some(e => e.id === item.id)) {
                existingHistory.unshift(item);
            }
        });
        
        localStorage.setItem(STORAGE_KEYS.HISTORIAL, JSON.stringify(existingHistory));
        
        hideImportModal();
        loadHistory();
        showToast(`Importados ${importedData.length} registros`, 'success');
        
    } catch (e) {
        showToast(`Error al importar: ${e.message}`, 'error');
    }
}

// ============================================
// UTILIDADES
// ============================================
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast ' + type;
    toast.classList.remove('hidden');
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 300);
    }, 4000);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ============================================
// COMPATIBILIDAD CON NAVEGADORES ANTIGUOS
// ============================================
if (!window.Promise) {
    // Polyfill para Promise (no se incluye, pero se recomienda)
    console.warn('Polyfill para Promise recomendado');
}

if (!String.prototype.includes) {
    String.prototype.includes = function(search, start) {
        if (typeof start !== 'number') {
            start = 0;
        }
        if (start + search.length > this.length) {
            return false;
        }
        return this.indexOf(search, start) !== -1;
    };
}

// Hacer disponibles las funciones globales
window.loadHistoryItem = loadHistoryItem;
window.deleteHistoryItem = deleteHistoryItem;
window.exportSingleItem = exportSingleItem;
