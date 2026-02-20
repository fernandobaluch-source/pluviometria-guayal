(function () {
    'use strict';

    // --- Firebase Initialization ---
    if (!firebase.apps.length) {
        const firebaseConfig = {
            apiKey: "AIzaSyDO7V87xp-BGXOnFtMZK4oNyVe4Ub4xG9c",
            authDomain: "pluviometros-app.firebaseapp.com",
            projectId: "pluviometros-app",
            storageBucket: "pluviometros-app.firebasestorage.app",
            messagingSenderId: "269748174052",
            appId: "1:269748174052:web:cc79eb81f10f8ba9a340f1",
            measurementId: "G-0TN2STZKV3"
        };
        firebase.initializeApp(firebaseConfig);
    }

    // Enable Offline Persistence
    firebase.firestore().enablePersistence()
        .catch((err) => {
            if (err.code == 'failed-precondition') {
                console.warn("Persistencia falló: múltiples pestañas abiertas.");
            } else if (err.code == 'unimplemented') {
                console.warn("Persistencia no soportada por el navegador.");
            }
        });

    // --- Constants ---
    const SESSION_KEY = 'pluviometria_session';
    const ACCENT_COLORS = ['accent-blue', 'accent-green', 'accent-orange', 'accent-purple', 'accent-red'];
    const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    // Default admin user (created only if no users exist in Firestore)
    const DEFAULT_ADMIN = {
        username: 'admin',
        fullname: 'Administrador',
        password: 'admin123',
        role: 'admin',
        createdAt: new Date().toISOString()
    };

    // --- State ---
    let records = [];
    let users = [];
    let currentUser = null;
    let dateOffset = 0;
    let selectedDate = null;
    let isFirestoreReady = false;

    // ========================
    // AUTH SYSTEM & DATA SYNC
    // ========================

    function initDataSync() {
        const db = firebase.firestore();

        // Sync Users
        db.collection('users').onSnapshot((snapshot) => {
            users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Create default admin if empty
            if (users.length === 0) {
                db.collection('users').add(DEFAULT_ADMIN);
            }

            // Re-render user list if modal is open
            if (document.getElementById('userModal').style.display !== 'none') {
                renderUserList();
            }
        }, (error) => {
            console.error("Error syncing users:", error);
        });

        // Sync Records
        db.collection('records').orderBy('timestamp', 'desc').onSnapshot((snapshot) => {
            records = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            if (currentUser) {
                renderDatePills();
                renderHistory();
                updateStats();
            }
            isFirestoreReady = true;
            console.log("Conectado a Firestore: ", records.length, " registros recibidos.");
            document.getElementById('welcomeMsg').innerHTML += ' <span style="color:#22c55e;font-size:0.6rem;">● En línea</span>';
        }, (error) => {
            console.error("Error syncing records:", error);
            document.getElementById('welcomeMsg').innerHTML += ' <span style="color:#ef4444;font-size:0.6rem;">● Desconectado</span>';
            showToast('Error de conexión con la base de datos');
        });
    }

    function getSession() {
        try {
            const data = localStorage.getItem(SESSION_KEY);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            return null;
        }
    }

    function setSession(user) {
        const session = { username: user.username, fullname: user.fullname, role: user.role };
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        return session;
    }

    function clearSession() {
        localStorage.removeItem(SESSION_KEY);
    }

    function authenticate(username, password) {
        if (username === DEFAULT_ADMIN.username && password === DEFAULT_ADMIN.password) {
            return DEFAULT_ADMIN;
        }
        return users.find(u => u.username === username && u.password === password) || null;
    }

    // ========================
    // LOGIN UI
    // ========================

    function initAuth() {
        const session = getSession();
        if (session) {
            const userExists = users.length === 0 || users.find(u => u.username === session.username);
            if (userExists) {
                currentUser = session;
                showApp();
                return;
            }
            clearSession();
        }
        showLogin();
    }

    function showLogin() {
        document.getElementById('loginOverlay').classList.remove('hidden');
        document.getElementById('appContainer').style.display = 'none';
        document.getElementById('loginUser').value = '';
        document.getElementById('loginPass').value = '';
        document.getElementById('loginError').classList.remove('show');
        document.getElementById('loginUser').focus();
    }

    function showApp() {
        document.getElementById('loginOverlay').classList.add('hidden');
        document.getElementById('appContainer').style.display = '';

        const welcomeMsg = document.getElementById('welcomeMsg');
        welcomeMsg.textContent = `Hola, ${currentUser.fullname}`;

        const inputColaborador = document.getElementById('inputColaborador');
        inputColaborador.value = currentUser.fullname;

        const btnUsers = document.getElementById('btnUsers');
        btnUsers.style.display = currentUser.role === 'admin' ? '' : 'none';

        initApp();
    }

    function bindLoginEvents() {
        const loginForm = document.getElementById('loginForm');
        if (!loginForm) return;

        loginForm.addEventListener('submit', function (e) {
            e.preventDefault();
            const username = document.getElementById('loginUser').value.trim().toLowerCase();
            const password = document.getElementById('loginPass').value;

            const user = authenticate(username, password);
            if (user) {
                currentUser = setSession(user);
                showApp();
            } else {
                document.getElementById('loginError').classList.add('show');
                const passEl = document.getElementById('loginPass');
                if (passEl) {
                    passEl.value = '';
                    passEl.focus();
                }
            }
        });

        const loginUser = document.getElementById('loginUser');
        const loginPass = document.getElementById('loginPass');

        if (loginUser) loginUser.addEventListener('input', () => {
            document.getElementById('loginError').classList.remove('show');
        });
        if (loginPass) loginPass.addEventListener('input', () => {
            document.getElementById('loginError').classList.remove('show');
        });
    }

    // ========================
    // USER MANAGEMENT MODAL
    // ========================

    function openUserModal() {
        document.getElementById('userModal').style.display = '';
        renderUserList();
        document.getElementById('newUsername').focus();
    }

    function closeUserModal() {
        document.getElementById('userModal').style.display = 'none';
    }

    function renderUserList() {
        const container = document.getElementById('userListContainer');
        container.innerHTML = '';

        users.forEach(user => {
            const item = document.createElement('div');
            item.className = 'user-item';
            const isDefaultAdmin = user.username === 'admin';
            item.innerHTML = `
                <div class="user-info">
                    <span class="user-name">${user.fullname}</span>
                    <span class="user-meta">@${user.username}</span>
                </div>
                <div class="user-actions">
                    <span class="user-role-badge ${user.role === 'admin' ? 'role-admin' : 'role-colaborador'}">${user.role}</span>
                    ${!isDefaultAdmin ? `
                        <button class="btn-delete-user" data-id="${user.id}" data-username="${user.username}" title="Eliminar usuario">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                        </button>
                    ` : ''}
                </div>
            `;
            container.appendChild(item);
        });

        container.querySelectorAll('.btn-delete-user').forEach(btn => {
            btn.addEventListener('click', () => {
                const username = btn.getAttribute('data-username');
                const id = btn.getAttribute('data-id');
                if (confirm(`¿Eliminar al usuario "${username}"?`)) {
                    const db = firebase.firestore();
                    db.collection('users').doc(id).delete()
                        .then(() => showToast('Usuario eliminado'))
                        .catch(err => console.error("Error removing user: ", err));
                }
            });
        });
    }

    function bindUserModalEvents() {
        document.getElementById('btnUsers').addEventListener('click', openUserModal);
        document.getElementById('closeUserModal').addEventListener('click', closeUserModal);

        document.getElementById('userModal').addEventListener('click', (e) => {
            if (e.target.id === 'userModal') closeUserModal();
        });

        document.getElementById('createUserForm').addEventListener('submit', function (e) {
            e.preventDefault();
            const errorEl = document.getElementById('createUserError');
            const username = document.getElementById('newUsername').value.trim().toLowerCase();
            const fullname = document.getElementById('newFullname').value.trim();
            const password = document.getElementById('newPassword').value;
            const role = document.getElementById('newRole').value;

            if (!username || !fullname || !password) {
                errorEl.textContent = 'Complete todos los campos';
                errorEl.style.display = 'block';
                return;
            }
            if (password.length < 4) {
                errorEl.textContent = 'La contraseña debe tener al menos 4 caracteres';
                errorEl.style.display = 'block';
                return;
            }
            if (users.find(u => u.username === username)) {
                errorEl.textContent = `El usuario "${username}" ya existe`;
                errorEl.style.display = 'block';
                return;
            }

            errorEl.style.display = 'none';

            const db = firebase.firestore();
            db.collection('users').add({
                username,
                fullname,
                password,
                role,
                createdAt: new Date().toISOString()
            }).then(() => {
                document.getElementById('newUsername').value = '';
                document.getElementById('newFullname').value = '';
                document.getElementById('newPassword').value = '';
                document.getElementById('newRole').value = 'colaborador';
                showToast(`✓ Usuario "${username}" creado`);
            }).catch(err => {
                console.error("Error adding user: ", err);
                errorEl.textContent = 'Error al crear usuario: ' + err.message;
                errorEl.style.display = 'block';
            });
        });
    }

    // ========================
    // MAIN APP
    // ========================

    function initApp() {
        setDefaultDate();
        renderDatePills();
        renderHistory();
        updateStats();
        bindAppEvents();
    }

    function getEl(id) { return document.getElementById(id); }

    function setDefaultDate() {
        getEl('inputFecha').value = formatDateISO(new Date());
    }

    // --- Date Helpers ---
    function formatDateISO(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function formatDateDisplay(isoStr) {
        const parts = isoStr.split('-');
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    function formatTimestamp(ts) {
        const d = new Date(ts);
        const hours = String(d.getHours()).padStart(2, '0');
        const mins = String(d.getMinutes()).padStart(2, '0');
        return `${hours}:${mins}`;
    }

    // --- Date Selector ---
    function getWeekDates(weekOffset) {
        const today = new Date();
        const dayOfWeek = today.getDay();
        const monday = new Date(today);
        monday.setDate(today.getDate() - dayOfWeek + 1 + (weekOffset * 7));
        const dates = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(monday);
            d.setDate(monday.getDate() + i);
            dates.push(d);
        }
        return dates;
    }

    function getRecordCountForDate(isoDate) {
        return records.filter(r => r.fecha === isoDate).length;
    }

    function renderDatePills() {
        const datePills = getEl('datePills');
        const dates = getWeekDates(dateOffset);
        datePills.innerHTML = '';
        dates.forEach(date => {
            const iso = formatDateISO(date);
            const count = getRecordCountForDate(iso);
            const pill = document.createElement('button');
            pill.className = 'date-pill';
            pill.type = 'button';
            if (selectedDate === iso) pill.classList.add('active');
            if (count > 0) pill.classList.add('has-records');
            pill.innerHTML = `
                <span class="day-name">${DAY_NAMES[date.getDay()]}</span>
                <span class="day-num">${date.getDate()}</span>
                ${count > 0 ? `<span class="record-count">${count}</span>` : ''}
            `;
            pill.addEventListener('click', () => {
                selectedDate = (selectedDate === iso) ? null : iso;
                if (selectedDate) getEl('inputFecha').value = selectedDate;
                renderDatePills();
                renderHistory();
                updateStats();
            });
            datePills.appendChild(pill);
        });
    }

    // --- App Events ---
    let appEventsBound = false;
    function bindAppEvents() {
        if (appEventsBound) return;
        appEventsBound = true;

        getEl('rainForm').addEventListener('submit', handleSubmit);
        getEl('btnExport').addEventListener('click', handleExport);
        getEl('btnLogout').addEventListener('click', handleLogout);
        getEl('datePrev').addEventListener('click', () => { dateOffset--; renderDatePills(); });
        getEl('dateNext').addEventListener('click', () => { dateOffset++; renderDatePills(); });

        getEl('inputMedicion').addEventListener('input', () => {
            getEl('inputMedicion').closest('.form-group').classList.remove('has-error');
        });
        getEl('inputPluviometro').addEventListener('change', () => {
            getEl('inputPluviometro').closest('.form-group').classList.remove('has-error');
        });
    }

    function handleLogout() {
        clearSession();
        currentUser = null;
        appEventsBound = false;
        showLogin();
    }

    function handleSubmit(e) {
        e.preventDefault();
        let hasError = false;

        const pluviometro = getEl('inputPluviometro').value;
        if (!pluviometro) {
            getEl('inputPluviometro').closest('.form-group').classList.add('has-error');
            if (!hasError) { getEl('inputPluviometro').focus(); hasError = true; }
        }

        const medicion = getEl('inputMedicion').value.trim();
        if (!medicion || isNaN(parseFloat(medicion))) {
            getEl('inputMedicion').closest('.form-group').classList.add('has-error');
            if (!hasError) { getEl('inputMedicion').focus(); hasError = true; }
        }

        if (hasError) return;

        const record = {
            timestamp: new Date().toISOString(),
            fecha: getEl('inputFecha').value,
            pluviometro: parseInt(pluviometro),
            colaborador: currentUser ? currentUser.fullname : 'Anónimo',
            usuario: currentUser ? currentUser.username : '',
            medicion: parseFloat(medicion),
            comentario: getEl('inputComentario').value.trim()
        };

        const db = firebase.firestore();
        db.collection('records').add(record)
            .then((docRef) => {
                getEl('inputMedicion').value = '';
                getEl('inputComentario').value = '';
                getEl('inputMedicion').closest('.form-group').classList.remove('has-error');
                showToast('✓ Registro guardado en la nube');
            })
            .catch((error) => {
                console.error("Error writing document: ", error);
                showToast('Error al guardar el registro');
            });
    }

    // --- Render History ---
    function renderHistory() {
        const historyList = getEl('historyList');
        const filtered = selectedDate
            ? records.filter(r => r.fecha === selectedDate)
            : records;

        if (filtered.length === 0) {
            historyList.innerHTML = '';
            historyList.appendChild(createEmptyState());
            getEl('historyCount').textContent = '0';
            return;
        }

        getEl('historyCount').textContent = filtered.length.toString();
        historyList.innerHTML = '';
        filtered.forEach((record, index) => {
            historyList.appendChild(createRecordCard(record, index));
        });
    }

    function createEmptyState() {
        const div = document.createElement('div');
        div.className = 'empty-state';
        div.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="empty-icon">
                <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
            </svg>
            <p>No hay registros${selectedDate ? ' para esta fecha' : ' aún'}</p>
            <span>Los registros aparecerán aquí</span>
        `;
        return div;
    }

    function createRecordCard(record, index) {
        const accentClass = ACCENT_COLORS[index % ACCENT_COLORS.length];
        const card = document.createElement('div');
        card.className = 'record-card';
        card.style.animationDelay = `${index * 0.05}s`;

        card.innerHTML = `
            <div class="record-accent ${accentClass}"></div>
            <div class="record-content">
                <div class="record-top">
                    <div class="record-measurement">${record.medicion.toFixed(1)} <span>mm</span> <span style="margin-left:6px;font-size:0.7rem;background:rgba(56,132,255,0.1);padding:2px 8px;border-radius:10px;color:#3884ff;">P${record.pluviometro || '?'}</span></div>
                    <button class="record-delete" title="Eliminar registro" data-id="${record.id}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                    </button>
                </div>
                <div class="record-meta">
                    <div class="record-meta-item">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                        ${formatDateDisplay(record.fecha)}
                    </div>
                    <div class="record-meta-item">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                        </svg>
                        ${formatTimestamp(record.timestamp)}
                    </div>
                    <div class="record-meta-item">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                        </svg>
                        ${record.colaborador}
                    </div>
                </div>
                ${record.comentario ? `<div class="record-comment">"${record.comentario}"</div>` : ''}
            </div>
        `;

        const deleteBtn = card.querySelector('.record-delete');
        deleteBtn.addEventListener('click', () => {
            if (confirm('¿Eliminar este registro de la base de datos?')) {
                const db = firebase.firestore();
                db.collection('records').doc(record.id).delete()
                    .then(() => showToast('Registro eliminado'))
                    .catch(err => console.error("Error handling document: ", err));
            }
        });

        return card;
    }

    // --- Stats ---
    function updateStats() {
        const filtered = selectedDate
            ? records.filter(r => r.fecha === selectedDate)
            : records;

        const total = filtered.length;
        const sum = filtered.reduce((acc, r) => acc + (r.medicion || 0), 0);
        const avg = total > 0 ? sum / total : 0;
        const max = total > 0 ? Math.max(...filtered.map(r => r.medicion || 0)) : 0;

        // Total Mensual (Suma de los promedios diarios del mes actual)
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const monthPrefix = `${yyyy}-${mm}`;

        const monthlyRecords = records.filter(r => r.fecha && r.fecha.startsWith(monthPrefix));

        // Agrupar por día para promediar
        const dailyData = {};
        monthlyRecords.forEach(r => {
            if (!dailyData[r.fecha]) dailyData[r.fecha] = [];
            dailyData[r.fecha].push(r.medicion || 0);
        });

        let monthSum = 0;
        Object.values(dailyData).forEach(measurements => {
            const daySum = measurements.reduce((a, b) => a + b, 0);
            const dayAvg = daySum / measurements.length;
            monthSum += dayAvg;
        });

        animateValue(getEl('statTotal'), total, false);
        animateValue(getEl('statAvg'), avg, true);
        animateValue(getEl('statMax'), max, true);
        animateValue(getEl('statMonthTotal'), monthSum, true);
    }

    function animateValue(el, target, isDecimal) {
        if (!el) return;
        const current = parseFloat(el.textContent) || 0;
        const diff = target - current;
        const steps = 20;
        let step = 0;
        const timer = setInterval(() => {
            step++;
            const progress = step / steps;
            const eased = 1 - Math.pow(1 - progress, 3);
            const value = current + diff * eased;
            el.textContent = isDecimal ? value.toFixed(1) : Math.round(value).toString();
            if (step >= steps) clearInterval(timer);
        }, 20);
    }

    // --- Export to Excel ---
    function handleExport() {
        if (records.length === 0) {
            showToast('No hay registros para exportar');
            return;
        }

        const data = records.map(r => ({
            'Timestamp': new Date(r.timestamp).toLocaleString('es-AR'),
            'Fecha': formatDateDisplay(r.fecha),
            'Pluviómetro N°': r.pluviometro || '',
            'Colaborador': r.colaborador,
            'Medición (mm)': r.medicion,
            'Comentario': r.comentario || ''
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        ws['!cols'] = [
            { wch: 20 }, { wch: 12 }, { wch: 16 }, { wch: 20 }, { wch: 15 }, { wch: 40 }
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Pluviometría Guayal');
        const today = formatDateISO(new Date());
        XLSX.writeFile(wb, `Pluviometria_${today}.xlsx`);
        showToast('📥 Archivo Excel descargado');
    }

    // --- Toast ---
    function showToast(message) {
        const toast = getEl('toast');
        const toastMsg = getEl('toastMsg');
        if (toast && toastMsg) {
            toastMsg.textContent = message;
            toast.classList.add('show');
            setTimeout(() => { toast.classList.remove('show'); }, 2500);
        }
    }

    // ========================
    // BOOTSTRAP
    // ========================
    document.addEventListener('DOMContentLoaded', function () {
        initDataSync();
        bindLoginEvents();
        bindUserModalEvents();
        setTimeout(initAuth, 1000);
    });
})();
