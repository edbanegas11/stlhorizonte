import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, collection, onSnapshot, query, orderBy, 
    addDoc, serverTimestamp, doc, getDoc, setDoc, deleteDoc, updateDoc 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- CONFIGURACIÓN DE FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyD1TTVRTLRucgeDlr1Y_4u9wgliwCN394w",
    authDomain: "transportehub.firebaseapp.com",
    projectId: "transportehub",
    storageBucket: "transportehub.firebasestorage.app",
    messagingSenderId: "808325379323",
    appId: "1:808325379323:web:24df80a708e7b9bc396c5e"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const USER_ID = "usuario_principal";

// --- ESTADO LOCAL ---
let localTransactions = [];
let reportSubView = 'income';
let unidadesConfig = ['Hyundai County', 'Toyota Hiace'];
let catEgresos = ['Combustible', 'Sueldos y Viáticos', 'Repuestos', 'Mantenimiento', 'Gastos de Operaciones'];
let catIngresos = []; // Valores por defecto

window.updateFilterOptions = () => {
    const filterSelect = document.getElementById('global-filter');
    if (!filterSelect) return;

    // 1. Obtener el mes actual en formato "YYYY-MM" (ej: 2026-02)
    const hoy = new Date();
    const mesActual = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0');

    // 2. Extraer periodos únicos de las transacciones
    const periods = [...new Set(localTransactions
        .filter(t => t.date)
        .map(t => t.date.substring(0, 7))
    )].sort().reverse();

    const years = [...new Set(periods.map(p => p.substring(0, 4)))].sort().reverse();

    // 3. Construir el HTML
    let optionsHtml = `<option value="all">Ver Todo el Histórico</option>`;

    if (years.length > 0) {
        optionsHtml += `<optgroup label="Años">`;
        years.forEach(year => {
            optionsHtml += `<option value="${year}">Todo el año ${year}</option>`;
        });
        optionsHtml += `</optgroup>`;
    }

    if (periods.length > 0) {
        optionsHtml += `<optgroup label="Meses">`;
        periods.forEach(period => {
            const [year, month] = period.split('-');
            const dateObj = new Date(year, parseInt(month) - 1);
            const monthName = dateObj.toLocaleString('es-HN', { month: 'long' }).toUpperCase();
            
            // Si el periodo coincide con el mes actual, le ponemos 'selected'
            const isSelected = (period === mesActual) ? 'selected' : '';
            optionsHtml += `<option value="${period}" ${isSelected}>${monthName} ${year}</option>`;
        });
        optionsHtml += `</optgroup>`;
    }

    filterSelect.innerHTML = optionsHtml;

    // 4. Si después de cargar, el selector quedó en "Ver Todo" pero existe el mes actual, lo forzamos
    if (filterSelect.value === 'all' && periods.includes(mesActual)) {
        filterSelect.value = mesActual;
    }
};

// --- 1. ACCIONES DE FIREBASE ---
window.saveIncome = async () => {
    const elAmount = document.getElementById('in-amount');
    const elUnit = document.getElementById('in-unit');
    const elCategory = document.getElementById('in-category');
    const elDesc = document.getElementById('in-description'); 
    const elDate = document.getElementById('in-date'); // <--- CAPTURAR FECHA

    if (!elAmount.value || !elUnit.value || !elCategory.value || !elDate.value) {
        return alert("⚠️ Faltan datos: Por favor llena todos los campos, incluida la fecha.");
    }

    try {
        await addDoc(collection(db, 'usuarios', USER_ID, 'movimientos'), {
            type: 'income',
            description: elDesc && elDesc.value.trim() ? elDesc.value.trim().toUpperCase() : elCategory.value.trim().toUpperCase(), 
            amount: parseFloat(elAmount.value),
            category: elCategory.value,
            unit: elUnit.value,
            date: elDate.value, // <--- USA LA FECHA DEL INPUT (YYYY-MM-DD)
            createdAt: serverTimestamp()
        });

        // Limpieza
        elAmount.value = '';        
        if(elDesc) elDesc.value = ''; 
        elUnit.selectedIndex = 0;   
        elCategory.selectedIndex = 0;
        // Opcional: No limpiar la fecha para facilitar ingresos múltiples del mismo día

        if (typeof fetchTransactions === 'function') await fetchTransactions();
        showView('dashboard'); 
        
    } catch (e) { 
        console.error("Error al guardar:", e); 
        alert("❌ No se pudo guardar el ingreso");
    }
};

// Asegúrate de agregar "window." al principio
window.closeEditModal = () => {
    const modal = document.getElementById('modal-edit');
    if (modal) {
        modal.classList.add('hidden');
    }
};

// Abrir el modal con los datos actuales
window.editTransaction = (id) => {
    const t = localTransactions.find(item => item.id === id);
    if (!t) return;

    const modal = document.getElementById('modal-edit');
    const unitSelect = document.getElementById('edit-unit');
    const catContainer = document.getElementById('edit-cat-container');
    const title = document.getElementById('edit-title');

    document.getElementById('edit-id').value = id;

    // Llenar unidades
    unitSelect.innerHTML = unidadesConfig.map(u => 
        `<option value="${u}" ${u === t.unit ? 'selected' : ''}>${u}</option>`
    ).join('');

    // --- BLOQUE DE FECHA (Común para ambos) ---
    const dateHTML = `
        <div class="mb-6">
            <p class="text-[10px] font-black uppercase text-slate-400 ml-2 mb-1">Fecha del Movimiento</p>
            <input type="date" id="edit-date" value="${t.date || ''}" 
                class="w-full p-4 bg-blue-50/50 rounded-2xl font-bold text-sm outline-none border-2 border-blue-100 text-blue-600">
        </div>
    `;

    if (t.type === 'income') {
        title.innerText = "Editar Ingreso";
        title.className = "text-lg font-black text-green-600 uppercase italic";
        
        catContainer.innerHTML = dateHTML + `
            <div class="space-y-4">
                <div>
                    <p class="text-[10px] font-black uppercase text-slate-400 ml-2 mb-1">Monto Lps</p>
                    <input type="number" id="edit-amount-income" value="${t.amount}" 
                        class="w-full p-4 bg-slate-50 rounded-2xl font-black text-xl outline-none text-green-600 border-2 border-green-50">
                </div>
                <div>
                    <p class="text-[10px] font-black uppercase text-slate-400 ml-2 mb-1">Descripción de Viaje</p>
                    <input type="text" id="edit-description-income" value="${t.description || ''}" 
                        oninput="this.value = this.value.toUpperCase()"
                        class="w-full p-4 bg-slate-50 rounded-2xl font-bold text-sm outline-none border-2 border-slate-50 uppercase">
                </div>
                <div>
                    <p class="text-[10px] font-black uppercase text-slate-400 ml-2 mb-1">Categoría</p>
                    <select id="edit-category-income" class="w-full p-4 bg-slate-50 rounded-2xl font-bold text-sm outline-none">
                        ${catIngresos.map(c => `<option value="${c}" ${c === t.category ? 'selected' : ''}>${c}</option>`).join('')}
                    </select>
                </div>
            </div>
        `;
    } else {
        title.innerText = "Editar Gasto";
        title.className = "text-lg font-black text-red-600 uppercase italic";

        catContainer.innerHTML = dateHTML + `
            <p class="text-[10px] font-black uppercase text-slate-400 ml-2 mb-1 text-center italic">Detalle de Gasto</p>
            <div class="grid grid-cols-1 gap-3 max-h-[40vh] overflow-y-auto pr-2 custom-scroll">
                ${catEgresos.map(cat => {
                    const esMismaCat = (t.category === cat);
                    return `
                        <div class="bg-slate-50 p-3 rounded-2xl border ${esMismaCat ? 'border-red-200 bg-red-50/40' : 'border-slate-100'} space-y-2">
                            <span class="text-[10px] font-black uppercase text-slate-500 ml-1">${cat}</span>
                            <div class="flex gap-2">
                                <input type="text" data-edit-desc="${cat}" value="${esMismaCat ? (t.description || '') : ''}"
                                    oninput="this.value = this.value.toUpperCase()"
                                    class="flex-1 p-3 bg-white rounded-xl text-[10px] font-bold outline-none border border-slate-200 uppercase">
                                <input type="number" step="0.01" data-cat="${cat}" value="${esMismaCat ? t.amount : ''}"
                                    class="edit-expense-input w-24 p-3 bg-white rounded-xl text-right font-black text-sm outline-none border border-slate-200">
                            </div>
                        </div>`;
                }).join('')}
            </div>
        `;
    }
    modal.classList.remove('hidden');
};

// --- ELIMINAR TRANSACCIÓN ---
window.deleteTransaction = async (id) => {
    // Confirmación de seguridad
    if (confirm("¿Estás seguro de que deseas eliminar este movimiento? Esta acción no se puede deshacer.")) {
        try {
            // Referencia al documento específico
            const docRef = doc(db, 'usuarios', USER_ID, 'movimientos', id);
            
            // Ejecutar eliminación en Firebase
            await deleteDoc(docRef);
            
            
        } catch (e) {
            console.error("Error al eliminar:", e);
            alert("No se pudo eliminar el registro: " + e.message);
        }
    }
};

// Guardar los cambios en Firebase
window.updateTransactionFirebase = async () => {
    const id = document.getElementById('edit-id')?.value;
    const unit = document.getElementById('edit-unit')?.value;
    const newDate = document.getElementById('edit-date')?.value; // <--- CAPTURAMOS LA FECHA EDITADA
    const tOriginal = localTransactions.find(item => item.id === id);
    
    if (!id || !tOriginal) return;

    let updateData = { 
        unit: unit || tOriginal.unit,
        date: newDate || tOriginal.date // <--- ACTUALIZAMOS LA FECHA
    };

    if (tOriginal.type === 'income') {
        const elAmt = document.getElementById('edit-amount-income');
        const elCat = document.getElementById('edit-category-income');
        const elDesc = document.getElementById('edit-description-income');

        const amt = elAmt ? parseFloat(elAmt.value) : tOriginal.amount;
        const cat = elCat ? elCat.value : tOriginal.category;
        const desc = elDesc ? elDesc.value.trim() : "";

        updateData.amount = amt || 0;
        updateData.category = cat;
        updateData.description = desc ? desc.toUpperCase() : (cat ? cat.toUpperCase() : tOriginal.description);
        
    } else {
        const inputs = document.querySelectorAll('.edit-expense-input');
        let totalEncontrado = 0;
        let catEncontrada = '';
        let descEncontrada = '';
        
        inputs.forEach(inp => {
            const val = parseFloat(inp.value) || 0;
            if (val > 0) {
                totalEncontrado = val;
                catEncontrada = inp.dataset.cat;
                const inputDesc = document.querySelector(`[data-edit-desc="${catEncontrada}"]`);
                descEncontrada = inputDesc ? inputDesc.value.trim().toUpperCase() : '';
            }
        });
        
        updateData.amount = totalEncontrado || tOriginal.amount;
        updateData.category = catEncontrada || tOriginal.category;
        updateData.description = descEncontrada || (catEncontrada || tOriginal.description);
    }

    try {
        const docRef = doc(db, 'usuarios', USER_ID, 'movimientos', id);
        await updateDoc(docRef, updateData);
        
        closeEditModal();
        if (typeof fetchTransactions === 'function') await fetchTransactions();
        
    } catch (e) {
        console.error("Error al actualizar:", e);
        alert("Error: " + e.message);
    }
};
// --- 1. NAVEGACIÓN ENTRE VISTAS ---
window.showView = (viewName) => {
    // 1. Ocultar todas las secciones
    // Agregamos 'calculator' a la lista para que se oculte cuando vas a otras pantallas
    const views = ['dashboard', 'income', 'expense', 'history', 'settings', 'calculator'];
    views.forEach(v => {
        const section = document.getElementById(`view-${v}`);
        if (section) section.classList.add('hidden');
    });

    // 2. Mostrar la sección seleccionada
    const target = document.getElementById(`view-${viewName}`);
    if (target) {
        target.classList.remove('hidden');
        window.scrollTo(0, 0);
    }

    // 3. ACTUALIZAR COLORES DE LA BARRA DE NAVEGACIÓN
    // Agregamos el mapeo del botón "Cotizar"
    const navButtons = {
        'dashboard': 'nav-home',
        'history': 'nav-reports',
        'calculator': 'nav-calc',
        'settings': 'nav-settings'
    };
  
    // Resetear fechas en formularios de ingresos/gastos
    const hoy = new Date().toISOString().split('T')[0];
    if (document.getElementById('in-date')) document.getElementById('in-date').value = hoy;
    if (document.getElementById('ex-date')) document.getElementById('ex-date').value = hoy;

    // Primero: Apagamos todos los botones (Estado inactivo)
    Object.values(navButtons).forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.classList.remove('opacity-100');
            btn.classList.add('opacity-40');
            
            const svg = btn.querySelector('svg');
            const span = btn.querySelector('span');

            if (svg) {
                svg.classList.remove('text-amber-400');
                svg.classList.add('text-slate-400');
                svg.style.color = ''; 
                svg.style.filter = 'none';
            }
            if (span) {
                span.classList.remove('text-amber-400');
                span.classList.add('text-slate-400');
                span.style.color = '';
            }
        }
    });

    // Segundo: Encendemos el botón activo (Efecto Ámbar con Brillo)
    const activeId = navButtons[viewName];
    if (activeId) {
        const activeBtn = document.getElementById(activeId);
        activeBtn.classList.remove('opacity-40');
        activeBtn.classList.add('opacity-100');
        
        const icon = activeBtn.querySelector('svg');
        const text = activeBtn.querySelector('span');
        
        if (icon) {
            icon.classList.remove('text-slate-400');
            icon.classList.add('text-amber-400');
            icon.style.color = '#fbbf24'; 
            icon.style.filter = 'drop-shadow(0 0 8px rgba(251, 191, 36, 0.5))';
        }
        if (text) {
            text.classList.remove('text-slate-400');
            text.classList.add('text-amber-400');
            text.style.color = '#fbbf24';
        }
    }

    // --- 4. LÓGICA DE CARGA DE DATOS ---
    if (viewName === 'history') renderHistory();
    if (viewName === 'settings') renderSettings();
    
    // Si entras a la calculadora, puedes resetear los campos si quieres:
    if (viewName === 'calculator') {
        const resultDiv = document.getElementById('calc-result');
        if (resultDiv) resultDiv.classList.add('hidden');
    }
    
    if (viewName === 'expense') {
        prepararVistaGastos();
        if (typeof fillUnitSelects === 'function') fillUnitSelects();
    }
    
    if (viewName === 'income') {
        if (typeof fillUnitSelects === 'function') fillUnitSelects();
        const inAmount = document.getElementById('in-amount');
        if (inAmount) inAmount.value = '';
    }
};

window.setReportSubView = (type) => {
    reportSubView = type;
    
    // Cambiar estilos de los botones (Estilo de la imagen)
    const btnInc = document.getElementById('btn-report-inc');
    const btnExp = document.getElementById('btn-report-exp');
    
    if (type === 'income') {
        btnInc.className = "flex-1 py-2 rounded-xl font-bold text-green-600 bg-white shadow-sm";
        btnExp.className = "flex-1 py-2 rounded-xl font-bold text-slate-400";
    } else {
        btnExp.className = "flex-1 py-2 rounded-xl font-bold text-red-600 bg-white shadow-sm";
        btnInc.className = "flex-1 py-2 rounded-xl font-bold text-slate-400";
    }
    
    renderHistory();
};

// --- 2. RENDERIZADO DEL DASHBOARD (INICIO) ---
// --- RENDERIZADO DEL DASHBOARD ACTUALIZADO ---
window.renderDashboard = () => {
    const listaTransacciones = document.getElementById('lista-transacciones');
    const balanceTotal = document.getElementById('balance-total');
    const dashIn = document.getElementById('dash-total-in');
    const dashOut = document.getElementById('dash-total-out');
    const filtro = document.getElementById('global-filter')?.value || 'all';
    
    if (!listaTransacciones) return;

    // 1. FILTRADO: Decidir qué data procesar
    const dataFiltrada = localTransactions.filter(t => {
        if (filtro === 'all') return true;
        return t.date && t.date.startsWith(filtro);
    });

    let totalGeneral = 0;
    let sumaIngresos = 0;
    let sumaGastos = 0;

    // 2. Procesamos totales sobre la data filtrada
    dataFiltrada.forEach((t) => {
        const monto = parseFloat(t.amount) || 0;
        if (t.type === 'income') {
            sumaIngresos += monto;
            totalGeneral += monto;
        } else {
            sumaGastos += monto;
            totalGeneral -= monto;
        }
    });

    // 3. Ordenamos y tomamos los 10 más actuales del periodo filtrado
    const recientes = [...dataFiltrada]
        .sort((a, b) => {
            const dateA = new Date((a.date || "2000-01-01") + 'T00:00:00').getTime();
            const dateB = new Date((b.date || "2000-01-01") + 'T00:00:00').getTime();
            if (dateB !== dateA) return dateB - dateA;
            const createA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
            const createB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
            return createB - createA;
        })
        .slice(0, 10);

    // 4. Generamos el HTML
    let html = '';
    recientes.forEach((t) => {
        const isInc = t.type === 'income';
        const monto = parseFloat(t.amount) || 0;
        const mainText = t.description || t.category;
        const dateObj = new Date((t.date || "") + 'T00:00:00');
        const displayDate = t.date ? dateObj.toLocaleDateString('es-HN', {day:'2-digit', month:'2-digit'}) : 'S/F';

        html += `
            <div class="bg-white p-4 rounded-[2rem] shadow-sm border border-slate-100 flex justify-between items-center mx-1 mb-2 active:scale-[0.98] transition-transform">
                <div class="flex flex-col min-w-0 flex-1 pr-3">
                    <p class="text-[11px] font-black text-slate-800 uppercase italic truncate leading-none mb-1">${mainText}</p>
                    <p class="text-[9px] font-bold text-slate-400 uppercase tracking-tight flex items-center gap-1">
                        <span class="${isInc ? 'text-emerald-500' : 'text-red-500'} font-black">${t.category}</span> 
                        <span class="text-slate-300">•</span> 
                        <span class="text-blue-500 font-black">${displayDate}</span>
                        <span class="text-slate-300">•</span> 
                        <span class="text-slate-500">${t.unit || 'S/U'}</span>
                    </p>
                </div>
                <div class="text-right">
                    <p class="font-black text-sm ${isInc ? 'text-emerald-600' : 'text-red-600'} whitespace-nowrap leading-none">
                        ${isInc ? '+' : '-'} L ${monto.toLocaleString('en-US', {minimumFractionDigits: 2})}
                    </p>
                </div>
            </div>`;
    });

    listaTransacciones.innerHTML = html || `<p class="text-center py-10 text-slate-400 text-[10px] font-black uppercase tracking-widest">Sin movimientos en este periodo</p>`;

    if (balanceTotal) balanceTotal.innerText = `L ${totalGeneral.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
    if (dashIn) dashIn.innerText = `L ${sumaIngresos.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
    if (dashOut) dashOut.innerText = `L ${sumaGastos.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
};

// --- 3. RENDERIZADO DE HISTORIAL AGRUPADO ---
window.renderHistory = function() {
    const container = document.getElementById('historial-agrupado');
    const reportBalance = document.getElementById('report-balance-caja');
    
    // IDs de los montos en los botones (asegúrate de que coincidan con el HTML)
    const tabIn = document.getElementById('tab-total-in');
    const tabOut = document.getElementById('tab-total-out');
    
    const filtro = document.getElementById('global-filter')?.value || 'all';
    if (!container) return;

    // 1. FILTRADO INICIAL: Periodo Global
    const dataFiltradaPeriodo = localTransactions.filter(t => {
        if (filtro === 'all') return true;
        return t.date && t.date.startsWith(filtro);
    });

    // 2. Cálculo de Totales para Botones y Balance
    let sumaIn = 0;
    let sumaOut = 0;

    dataFiltradaPeriodo.forEach(t => {
        const amt = parseFloat(t.amount) || 0;
        if (t.type === 'income') sumaIn += amt;
        else sumaOut += amt;
    });

    // 3. Insertar montos en los botones de la subvista
    if (tabIn) tabIn.innerText = `L ${sumaIn.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
    if (tabOut) tabOut.innerText = `L ${sumaOut.toLocaleString('en-US', {minimumFractionDigits: 2})}`;

    // 4. Balance del periodo filtrado
    let balanceTotal = sumaIn - sumaOut;
    if (reportBalance) {
        reportBalance.innerText = `L ${balanceTotal.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
    }

    // 5. Filtrado por tipo (Ingreso/Gasto) para la lista visual
    const filteredByType = dataFiltradaPeriodo.filter(t => t.type === reportSubView);
    const groups = {};

    filteredByType.forEach(t => {
        const dateStr = t.date || new Date().toISOString().split('T')[0];
        const dateObj = new Date(dateStr + 'T00:00:00');
        const year = dateObj.getFullYear();
        const month = dateObj.toLocaleString('es-HN', { month: 'long' }).toUpperCase();
        
        if (!groups[year]) groups[year] = {};
        if (!groups[year][month]) groups[year][month] = [];
        groups[year][month].push({...t, dateObj: dateObj});
    });

    let html = '';
    const sortedYears = Object.keys(groups).sort((a, b) => b - a);

    sortedYears.forEach(year => {
        html += `
            <div class="flex items-center gap-4 my-8 px-2">
                <div class="h-[1px] flex-1 bg-slate-200"></div>
                <span class="text-2xl font-black text-slate-300 italic tracking-tighter">${year}</span>
                <div class="h-[1px] flex-1 bg-slate-200"></div>
            </div>`;
        
        const mesesNombres = ["ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO", "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE"];
        const sortedMonths = Object.keys(groups[year]).sort((a, b) => mesesNombres.indexOf(b) - mesesNombres.indexOf(a));

        sortedMonths.forEach(month => {
            html += `<h3 class="text-[10px] font-black uppercase text-slate-400 ml-4 border-l-4 border-blue-500 pl-3 italic mb-4 tracking-[0.2em]">${month}</h3><div class="space-y-3 mb-10">`;
            
            groups[year][month].sort((a, b) => b.dateObj - a.dateObj).forEach(t => {
                const isInc = t.type === 'income';
                html += `
                <div class="bg-white p-4 rounded-[2rem] shadow-sm border border-slate-100 flex justify-between items-center mx-2">
                    <div class="flex flex-col min-w-0 flex-1 pr-3">
                        <p class="text-[11px] font-black text-slate-800 uppercase italic truncate mb-1">${t.description || t.category}</p>
                        <p class="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1">
                            <span class="${isInc ? 'text-green-500' : 'text-red-500'} font-black">${t.category}</span> 
                            <span class="text-slate-300">•</span> 
                            <span class="text-blue-500 font-black">${t.unit || 'S/U'}</span>
                        </p>
                    </div>
                    <div class="flex items-center gap-3">
                        <div class="text-right">
                            <p class="font-black text-sm ${isInc ? 'text-green-600' : 'text-red-600'}">L ${parseFloat(t.amount).toLocaleString('en-US', {minimumFractionDigits: 2})}</p>
                            <p class="text-[8px] font-bold text-slate-400 uppercase mt-1">${t.dateObj.toLocaleDateString('es-HN', {day:'2-digit', month:'2-digit'})}</p>
                        </div>
                        <div class="flex flex-col gap-1 border-l border-slate-50 pl-2">
                            <button onclick="editTransaction('${t.id}')" class="p-2 rounded-xl bg-slate-50"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" class="text-orange-500"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg></button>
                            <button onclick="deleteTransaction('${t.id}')" class="p-2 rounded-xl bg-slate-50"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" class="text-red-500"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></button>
                        </div>
                    </div>
                </div>`;
            });
            html += `</div>`;
        });
    });

    container.innerHTML = html || '<p class="text-center py-20 text-slate-400 font-bold uppercase text-[10px]">No hay registros en este periodo</p>';
    if (typeof renderReportBreakdown === 'function') renderReportBreakdown();
}

// --- AÑADIR NUEVA UNIDAD ---
window.addUnit = async () => {
    const input = document.getElementById('new-unit-input');
    const val = input.value.trim();
    
    if (!val) return alert("Escribe el nombre de la unidad");

    // Evitar duplicados
    if (unidadesConfig.includes(val)) return alert("Esta unidad ya existe");

    unidadesConfig.push(val); // Añadir al array local
    await saveConfig();       // Guardar en Firebase
    input.value = '';         // Limpiar input
    renderSettings();         // Refrescar lista visual
    updateSelects();          // Refrescar selectores de formularios
};

window.addCatIngreso = async () => {
    const input = document.getElementById('new-cat-in-input');
    const val = input.value.trim();
    if (!val) return alert("Escribe el nombre");
    if (catIngresos.includes(val)) return alert("Ya existe");

    catIngresos.push(val);
    await saveConfig(); // Asegúrate de actualizar saveConfig para incluir catIngresos
    input.value = '';
    renderSettings();
    updateSelects();
};

// --- AÑADIR NUEVA CATEGORÍA ---
window.addCategory = async () => {
    const input = document.getElementById('new-cat-input');
    const val = input.value.trim();

    if (!val) return alert("Escribe el nombre de la categoría");

    // Evitar duplicados
    if (catEgresos.includes(val)) return alert("Esta categoría ya existe");

    catEgresos.push(val);     // Añadir al array local
    await saveConfig();       // Guardar en Firebase
    input.value = '';         // Limpiar input
    renderSettings();         // Refrescar lista visual
    updateSelects();          // Refrescar selectores de formularios
};
// --- 4. GESTIÓN DE CONFIGURACIÓN (UNIDADES Y CAT) ---
async function loadConfig() {
    const docRef = doc(db, 'usuarios', USER_ID, 'config', 'preferencias');
    try {
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            const data = snap.data();
            if (data.unidades) unidadesConfig = data.unidades;
            if (data.catEgresos) catEgresos = data.catEgresos;
            if (data.catIngresos) catIngresos = data.catIngresos;
        }
    } catch (e) {
        console.error("Error cargando configuración:", e);
    }
    // ESTO ES CLAVE: Actualiza la interfaz con lo que sea que haya (Firebase o valores por defecto)
    updateSelects();
    renderSettings();
}

function renderSettings() {
    const unitList = document.getElementById('lista-unidades-ajustes');
    const catList = document.getElementById('lista-categorias-ajustes');

    if (unitList) {
    unitList.innerHTML = unidadesConfig.map((u, i) => `
        <div class="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
            <span class="text-xs font-bold text-slate-600 uppercase italic">${u}</span>
            <button onclick="deleteUnit(${i})" 
                    class="p-2 rounded-lg transition-all active:scale-90 hover:bg-red-50 group">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" 
                     class="text-red-400 group-hover:text-red-600 transition-colors">
                    <path d="M3 6h18"/>
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                </svg>
            </button>
        </div>`).join('');
}

  const catInList = document.getElementById('lista-cat-ingresos-ajustes');
    if (catInList) {
        catInList.innerHTML = catIngresos.map((c, i) => `
            <div class="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span class="text-xs font-bold text-slate-600 uppercase italic">${c}</span>
                <button onclick="deleteCatIn(${i})" 
                        class="p-2 rounded-lg transition-all active:scale-90 hover:bg-red-50 group">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" 
                         class="text-red-400 group-hover:text-red-600 transition-colors">
                        <path d="M3 6h18"/>
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                    </svg>
                </button>
            </div>`).join('');
    }
      
if (catList) {
    catList.innerHTML = catEgresos.map((c, i) => `
        <div class="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
            <span class="text-xs font-bold text-slate-600 uppercase italic">${c}</span>
            <button onclick="deleteCat(${i})" 
                    class="p-2 rounded-lg transition-all active:scale-90 hover:bg-red-50 group">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" 
                     class="text-red-400 group-hover:text-red-600 transition-colors">
                    <path d="M3 6h18"/>
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                </svg>
            </button>
        </div>`).join('');
    }
}
// --- RENDERIZAR DISTRIBUCIÓN DE GASTOS (BARRAS) ---
// 1. LA FUNCIÓN PRINCIPAL (Sustituye la que tienes)
window.renderReportBreakdown = () => {
    const container = document.getElementById('lista-breakdown');
    const wrapper = document.getElementById('report-breakdown-container');
    const titleElem = document.getElementById('breakdown-title');
    const iconElem = document.getElementById('breakdown-icon');
    
    // Filtro inteligente
    const filtro = document.getElementById('global-filter')?.value || 'all';
    
    if (!container || !wrapper) return;

    // Filtrar data por Periodo y Tipo
    const data = localTransactions.filter(t => {
        const cumpleFecha = (filtro === 'all') || (t.date && t.date.startsWith(filtro));
        return cumpleFecha && t.type === reportSubView;
    });

    if (data.length === 0) {
        wrapper.classList.add('hidden');
        return;
    }

    wrapper.classList.remove('hidden');
    const isIncome = reportSubView === 'income';
    
    titleElem.innerText = isIncome ? 'Ingresos por Unidad' : 'Gastos por Unidad';
    iconElem.innerText = isIncome ? '📊' : '📉';

    const accentColor = isIncome ? 'text-green-600' : 'text-red-600';
    const barColor = isIncome ? 'bg-green-500' : 'bg-red-500';

    const mapaUnidades = {};
    const totalesGlobalesPorCat = {};

    data.forEach(t => {
        const u = t.unit || 'Sin Unidad';
        const c = t.category || (isIncome ? 'Sin Contrato' : 'Sin Categoría');
        const monto = parseFloat(t.amount) || 0;

        if (!mapaUnidades[u]) mapaUnidades[u] = { total: 0, cats: {} };
        mapaUnidades[u].total += monto;
        mapaUnidades[u].cats[c] = (mapaUnidades[u].cats[c] || 0) + monto;
        totalesGlobalesPorCat[c] = (totalesGlobalesPorCat[c] || 0) + monto;
    });

    let html = '';

    // SECCIÓN A: Por Unidad
    Object.entries(mapaUnidades).sort((a, b) => b[1].total - a[1].total).forEach(([unidad, info]) => {
        html += `
            <div class="mb-6 p-5 bg-slate-50 rounded-[2rem] border border-slate-100">
                <div class="flex justify-between items-center mb-4 border-b border-slate-200 pb-2">
                    <span class="text-[11px] font-black uppercase text-slate-700 italic">📦 ${unidad}</span>
                    <span class="text-lg font-black ${accentColor}">L ${info.total.toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                </div>
                <div class="space-y-4">
                    ${window.generarBarrasInternas(info.cats, info.total, barColor, accentColor)}
                </div>
            </div>
        `;
    });

    // SECCIÓN B: Resumen Global
    const totalGeneral = Object.values(totalesGlobalesPorCat).reduce((a, b) => a + b, 0);
    html += `
        <div class="mt-8 pt-6 border-t-2 border-dashed border-slate-200">
            <h4 class="text-[9px] font-black uppercase text-slate-400 mb-4 tracking-widest text-center italic">Resumen Global</h4>
            <div class="space-y-4">
                ${window.generarBarrasInternas(totalesGlobalesPorCat, totalGeneral, 'bg-blue-600', 'text-blue-600')}
            </div>
        </div>
    `;

    container.innerHTML = html;
};

// 2. LA FUNCIÓN AUXILIAR (Esta es la que te falta o no encuentra)
// Le ponemos window. para que sea accesible desde cualquier parte
window.generarBarrasInternas = (diccionarioCats, totalPadre, colorBarra, colorTexto) => {
    return Object.entries(diccionarioCats)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, monto]) => {
            const porcentaje = totalPadre > 0 ? (monto / totalPadre) * 100 : 0;
            return `
                <div class="space-y-1.5">
                    <div class="flex justify-between items-end">
                        <div class="flex flex-col">
                            <span class="text-[9px] font-bold uppercase text-slate-500 leading-none">${cat}</span>
                            <span class="text-[11px] font-black text-slate-800 tracking-tighter">
                                L ${monto.toLocaleString('en-US', {minimumFractionDigits: 2})}
                            </span>
                        </div>
                        <span class="text-[10px] font-black ${colorTexto} bg-white px-2 py-0.5 rounded-md border border-slate-100">
                            ${porcentaje.toFixed(1)}%
                        </span>
                    </div>
                    <div class="w-full h-2 bg-white rounded-full overflow-hidden border border-slate-100 shadow-inner">
                        <div class="h-full ${colorBarra} transition-all duration-1000" style="width: ${porcentaje}%"></div>
                    </div>
                </div>
            `;
        }).join('');
};

function updateSelects() {
    const selUnitIn = document.getElementById('in-unit');
    const selUnitEx = document.getElementById('ex-unit');
    const selCatEx = document.getElementById('ex-category');

    // Llenar selectores de Unidades (Ingresos y Gastos)
    const opcionesUnidades = '<option value="">Seleccionar Unidad...</option>' + 
        unidadesConfig.map(u => `<option value="${u}">${u}</option>`).join('');

    if (selUnitIn) selUnitIn.innerHTML = opcionesUnidades;
    if (selUnitEx) selUnitEx.innerHTML = opcionesUnidades;
  
    const selectInCat = document.getElementById('in-category');
    if (selectInCat) {
        selectInCat.innerHTML = catIngresos.map(c => `<option value="${c}">${c}</option>`).join('');
    }
    // Llenar selector de Categorías (Gastos)
    if (selCatEx) {
        selCatEx.innerHTML = '<option value="">Categoría...</option>' + 
            catEgresos.map(c => `<option value="${c}">${c}</option>`).join('');
    }
}

window.deleteUnit = async (index) => {
    if (confirm(`¿Eliminar la unidad "${unidadesConfig[index]}"?`)) {
        unidadesConfig.splice(index, 1); // Quitar del array local
        await saveConfig();              // Guardar en Firebase
        renderSettings();                // Actualizar lista visual
        updateSelects();                 // Actualizar menús desplegables
    }
};

window.deleteCatIn = async (index) => {
    if (!confirm("¿Eliminar esta categoría de ingresos?")) return;

    catIngresos.splice(index, 1); // Quitar del array local
    await saveConfig();           // Guardar cambios en Firebase
    renderSettings();             // Refrescar lista en Ajustes
    updateSelects();              // Refrescar selector en el formulario
};

// --- ELIMINAR CATEGORÍA ---
window.deleteCat = async (index) => {
    if (confirm(`¿Eliminar la categoría "${catEgresos[index]}"?`)) {
        catEgresos.splice(index, 1);     // Quitar del array local
        await saveConfig();              // Guardar en Firebase
        renderSettings();                // Actualizar lista visual
        updateSelects();                 // Actualizar menús desplegables
    }
};
async function saveConfig() {
    const configRef = doc(db, 'usuarios', USER_ID, 'config', 'preferencias');
    try {
        await setDoc(configRef, { 
            unidades: unidadesConfig, 
            catEgresos: catEgresos, 
            catIngresos: catIngresos
        });
    } catch (e) {
        console.error("Error al guardar configuración:", e);
        alert("No se pudo guardar en la nube.");
    }
}


function prepararVistaGastos() {
    const container = document.getElementById('container-categorias-dinamicas');
    const selectUnidad = document.getElementById('ex-unit');
    
    // 1. Limpiar todo
    container.innerHTML = '';
    
    // 2. Crear las tarjetas de gasto (Nota + Monto)
    catEgresos.forEach(cat => {
        const div = document.createElement('div');
        // Estilo de tarjeta para que no se vea amontonado en el iPhone
        div.className = "bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-2 mb-1";
        
        div.innerHTML = `
            <div class="flex justify-between items-center px-1">
                <p class="text-[10px] font-black uppercase text-slate-500">${cat}</p>
                <span class="text-[9px] text-slate-300 italic font-bold tracking-tighter text-right">LEMPIRAS</span>
            </div>
            
            <div class="flex gap-2">
                <input type="text" 
                    data-desc-cat="${cat}" 
                    placeholder="NOTA O DETALLE..." 
                    oninput="this.value = this.value.toUpperCase()"
                    class="expense-desc-input flex-1 p-3 bg-white rounded-xl text-[10px] font-bold outline-none border border-slate-200 focus:ring-2 focus:ring-red-500 uppercase">
                
                <div class="w-32 relative">
                    <input type="number" 
                        step="0.01"
                        data-cat="${cat}" 
                        class="expense-input w-full bg-white p-3 rounded-xl text-right font-black text-red-600 outline-none border border-slate-200 focus:ring-2 focus:ring-red-500" 
                        placeholder="0.00">
                </div>
            </div>
        `;
        container.appendChild(div);
    });
}

// --- GUARDAR GASTO CORREGIDO ---
window.saveMultipleExpenses = async () => {
    const unit = document.getElementById('ex-unit').value;
    const date = document.getElementById('ex-date').value; // <--- CAPTURAR FECHA
    const inputs = document.querySelectorAll('.expense-input'); 
    
    if (!unit) return alert("Selecciona una unidad");
    if (!date) return alert("Selecciona la fecha del gasto"); // <--- VALIDACIÓN

    const batch = [];

    inputs.forEach(input => {
        const monto = parseFloat(input.value);
        if (monto > 0) {
            const categoria = input.dataset.cat;
            const inputDesc = document.querySelector(`[data-desc-cat="${categoria}"]`);
            const nota = inputDesc ? inputDesc.value.trim().toUpperCase() : '';

            batch.push({
                type: 'expense',
                unit: unit,
                category: categoria,
                description: nota || categoria, 
                amount: monto,
                date: date, // <--- ASIGNAR LA FECHA SELECCIONADA
                createdAt: serverTimestamp()
            });
        }
    });

    if (batch.length === 0) return alert("Ingresa al menos un monto");

    try {
        // Guardamos todos en Firebase
        for (const gasto of batch) {
            await addDoc(collection(db, 'usuarios', USER_ID, 'movimientos'), gasto);
        }
        
        // Limpiamos los campos después de guardar
        document.querySelectorAll('.expense-input, .expense-desc-input').forEach(i => i.value = '');
        
        if (typeof fetchTransactions === 'function') await fetchTransactions();
        showView('dashboard');
        
    } catch (e) {
        alert("Error: " + e.message);
    }
};

// --- 6. FUNCIONES DE APOYO ---
window.setReportSubView = (type) => {
    reportSubView = type;
    
    const btnInc = document.getElementById('btn-report-inc');
    const btnExp = document.getElementById('btn-report-exp');
    
    if (type === 'income') {
        btnInc.className = "flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest bg-white text-green-600 shadow-sm";
        btnExp.className = "flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest text-slate-500";
    } else {
        btnExp.className = "flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest bg-white text-red-600 shadow-sm";
        btnInc.className = "flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest text-slate-500";
    }
    
    renderHistory();
};

window.exportToExcel = () => {
    if (!localTransactions || localTransactions.length === 0) return alert("No hay datos");

    const inputUsuario = prompt("Exportar Mes/Año (ej: MARZO 2026) o deja vacío para TODO:");
    const filtro = inputUsuario ? inputUsuario.toUpperCase().trim() : null;

    // Encabezados optimizados para Tabla Dinámica
    // GRUPO servirá para separar Ingresos de Gastos y sumarlos por aparte
    const headers = ["FECHA", "MES", "AÑO", "UNIDAD", "GRUPO", "CATEGORIA", "DESCRIPCION", "MONTO"];
    
    const filteredData = localTransactions.filter(t => {
        if (!filtro) return true;
        const dateObj = new Date((t.date || "2000-01-01") + 'T00:00:00');
        const mesT = dateObj.toLocaleString('es-HN', { month: 'long' }).toUpperCase();
        const añoT = dateObj.getFullYear().toString();
        return mesT.includes(filtro) || añoT.includes(filtro) || `${mesT} ${añoT}`.includes(filtro);
    });

    const rows = filteredData.map(t => {
        const dateObj = new Date((t.date || "2000-01-01") + 'T00:00:00');
        const monto = parseFloat(t.amount) || 0;
        
        return [
            t.date,
            dateObj.toLocaleString('es-HN', { month: 'long' }).toUpperCase(),
            dateObj.getFullYear(),
            t.unit || 'S/U',
            t.type === 'income' ? '1-INGRESOS' : '2-GASTOS', // El número ayuda a ordenar en Excel
            t.category,
            (t.description || '').replace(/;/g, ','),
            t.type === 'income' ? monto : -monto // IMPORTANTE: Negativo para gastos
        ];
    });

    let csvContent = "\uFEFF";
    csvContent += headers.join(";") + "\n";
    rows.forEach(row => csvContent += row.join(";") + "\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Contabilidad_${filtro || 'General'}.csv`);
    link.click();
};

window.calcularTarifa = () => {
    const bus = document.getElementById('calc-bus').value;
    const zona = document.getElementById('calc-dest').value;
    const km = parseFloat(document.getElementById('calc-km').value) || 0;
    const days = parseInt(document.getElementById('calc-days').value) || 1;
    
    let totalKmDía1 = 0;
    let pagoChoferTotal = 0;
    let viaticosChoferTotal = 0;
    let precioGalon = 90; // Precio actual aproximado

    // 1. TARIFA DE COBRO (Recorrido Día 1)
    if (bus === 'hiace') {
        if (km <= 30) totalKmDía1 = 1000;
        else if (km <= 50) totalKmDía1 = km * 30;
        else if (km <= 100) totalKmDía1 = km * 20;
        else if (km <= 200) totalKmDía1 = km * 16;
        else if (km <= 300) totalKmDía1 = km * 11;
        else if (km <= 600) totalKmDía1 = km * 11;
        else totalKmDía1 = km * 10;
    } else { // County
        if (km <= 30) totalKmDía1 = 1500;
        else if (km <= 50) totalKmDía1 = km * 42;
        else if (km <= 100) totalKmDía1 = km * 32;
        else if (km <= 200) totalKmDía1 = km * 28;
        else if (km <= 300) totalKmDía1 = km * 16;
        else if (km <= 600) totalKmDía1 = km * 16;
        else totalKmDía1 = km * 14;
    }

    // 2. PAGO DE CHOFER Y VIÁTICOS (Día 1)
    if (zona === 'nacional') {
        if (km <= 100) { pagoChoferTotal = 500; viaticosChoferTotal = 200; }
        else if (km <= 500) { pagoChoferTotal = 700; viaticosChoferTotal = 300; }
        else { pagoChoferTotal = 1000; viaticosChoferTotal = 500; }
    } else { // Internacional (Día 1)
        pagoChoferTotal = 1000;
        viaticosChoferTotal = 1000;
    }

    // 3. COMBUSTIBLE
    const rendimiento = bus === 'hiace' ? 30 : 20;
    const costoFuel = (km / rendimiento) * precioGalon;

    // 4. DÍAS EXTRAS (Gastos y Cobros)
    const cobroPaqueteExtra = zona === 'internacional' ? 7000 : 5000;
    const totalCobroDiasExtra = (days - 1) * cobroPaqueteExtra;

    // Gasto real de días extras (Chofer + Viáticos adicionales)
    if (days > 1) {
        const pagoDiarioExtra = zona === 'internacional' ? 1000 : 1000; // Sueldo
        const viaticoDiarioExtra = zona === 'internacional' ? 1000 : 1500; // Hotel/Comida estimado
        pagoChoferTotal += (days - 1) * pagoDiarioExtra;
        viaticosChoferTotal += (days - 1) * viaticoDiarioExtra;
    }

    // 5. TOTALES Y UTILIDAD
    const granTotalCobro = Math.round((totalKmDía1 + totalCobroDiasExtra) / 100) * 100;
    const gastosTotales = pagoChoferTotal + viaticosChoferTotal + costoFuel;
    const utilidadFinal = granTotalCobro - gastosTotales;

    // 6. MOSTRAR RESULTADOS
    document.getElementById('calc-result').classList.remove('hidden');
    document.getElementById('res-total').innerText = `L ${granTotalCobro.toLocaleString('en-US')}`;
    document.getElementById('res-val-km').innerText = `L ${totalKmDía1.toLocaleString('en-US')}`;
    document.getElementById('res-val-days').innerText = `L ${totalCobroDiasExtra.toLocaleString('en-US')}`;
    document.getElementById('res-val-chofer').innerText = `L ${(pagoChoferTotal + viaticosChoferTotal).toLocaleString('en-US')}`;
    document.getElementById('res-val-fuel').innerText = `L ${costoFuel.toLocaleString('en-US', {maximumFractionDigits: 0})}`;
    document.getElementById('res-val-utilidad').innerText = `L ${utilidadFinal.toLocaleString('en-US', {maximumFractionDigits: 0})}`;
};

window.enviarCotizacionWhatsApp = () => {
    const bus = document.getElementById('calc-bus').options[document.getElementById('calc-bus').selectedIndex].text;
    const km = document.getElementById('calc-km').value;
    const days = document.getElementById('calc-days').value;
    const total = document.getElementById('res-total').innerText;

    const mensaje = `*STL HORIZONTE - COTIZACIÓN*%0A%0A` +
                    `*Unidad:* ${bus}%0A` +
                    `*Distancia:* ${km} KM%0A` +
                    `*Duración:* ${days} Día(s)%0A%0A` +
                    `*TOTAL ESTIMADO:* ${total}%0A%0A` +
                    `_Precios sujetos a cambios según disponibilidad._`;

    window.open(`https://wa.me/?text=${mensaje}`, '_blank');
};

// --- 7. LISTENERS TIEMPO REAL ---
const q = query(collection(db, 'usuarios', USER_ID, 'movimientos'), orderBy('createdAt', 'desc'));

onSnapshot(q, (snapshot) => {
    localTransactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderDashboard();
    renderHistory();
    localTransactions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // 1. Primero actualizamos el selector con los meses reales que vinieron de Firebase
    window.updateFilterOptions(); 
    
    // 2. Luego dibujamos todo lo demás
    renderDashboard();
    if (typeof renderHistory === 'function') renderHistory();
});

// Inicializar
loadConfig();
