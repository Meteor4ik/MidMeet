// ============================================================
// 0. API BASE
// ============================================================
const API_BASE = window.location.protocol === 'file:'
    ? 'https://midmeet.onrender.com'
    : '';


// ============================================================
// 1. КАРТА
// ============================================================
const map = L.map('map').setView([55.7558, 37.6173], 13);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
}).addTo(map);


// ============================================================
// 1.1. КНОПКА "СЛЕДОВАТЬ ЗА МНОЙ"
// ============================================================
let followMe = false;
let followBtn = null;

function createFollowButton() {
    const div = document.createElement('div');
    div.id = 'follow-btn';
    div.innerHTML = '◎';
    div.title = 'Следовать за мной';
    div.style.cssText = `
        position: fixed;
        top: 50%;
        right: 15px;
        transform: translateY(-50%);
        background: white;
        width: 44px;
        height: 44px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 22px;
        cursor: pointer;
        box-shadow: 0 2px 12px rgba(0,0,0,0.35);
        user-select: none;
        transition: all 0.2s;
        z-index: 9999;
        border: none;
    `;

    div.onclick = function (e) {
        e.stopPropagation();
        followMe = !followMe;
        updateFollowButton();
        if (followMe && myPosition) {
            map.setView([myPosition.lat, myPosition.lng], map.getZoom());
        }
    };

    document.body.appendChild(div);
    followBtn = div;
}

function updateFollowButton() {
    if (!followBtn) return;

    if (followMe) {
        followBtn.style.background = '#007AFF';
        followBtn.style.color = 'white';
    } else {
        followBtn.style.background = 'white';
        followBtn.style.color = 'black';
    }
}


// ============================================================
// 2. ЭЛЕМЕНТЫ UI
// ============================================================
const statusEl = document.getElementById('status');
const panelStart = document.getElementById('panel-start');
const panelHost = document.getElementById('panel-host');
const panelGuest = document.getElementById('panel-guest');
const roomCodeEl = document.getElementById('room-code');
const partnerInfo = document.getElementById('partner-info');
const partnerInfoGuest = document.getElementById('partner-info-guest');

const meetingInfo = document.getElementById('meeting-info');
const meetingValue = document.getElementById('meeting-value');
const meetingInfoGuest = document.getElementById('meeting-info-guest');
const meetingValueGuest = document.getElementById('meeting-value-guest');

const timeInfo = document.getElementById('time-info');
const timeValue = document.getElementById('time-value');
const timeInfoGuest = document.getElementById('time-info-guest');
const timeValueGuest = document.getElementById('time-value-guest');

const btnCreate = document.getElementById('btn-create');
const btnJoin = document.getElementById('btn-join');
const btnLeave = document.getElementById('btn-leave');
const btnLeaveHost = document.getElementById('btn-leave-host');
const inputCode = document.getElementById('input-code');

const settingsBtn = document.getElementById('settings-btn');
const settingsPanel = document.getElementById('settings-panel');
const inputName = document.getElementById('input-name');
const inputCustomCode = document.getElementById('input-custom-code');
const btnSaveName = document.getElementById('btn-save-name');


// ============================================================
// 3. СОСТОЯНИЕ
// ============================================================
let myPosition = null;
let partnerPosition = null;
let myRole = null;
let roomCode = null;

let myMarker = null;
let partnerMarker = null;
let meetingMarker = null;
let myRouteLine = null;
let partnerRouteLine = null;

let pollInterval = null;

let myName = localStorage.getItem('myName') || 'Участник';
let myCustomCode = localStorage.getItem('myCustomCode') || '';

let lastRouteUpdate = 0;
const ROUTE_UPDATE_INTERVAL = 8000;

let myHeading = 0;
let partnerHeading = 0;


// ============================================================
// 4. CSS-АНИМАЦИЯ
// ============================================================
const styleEl = document.createElement('style');
styleEl.textContent = `
    @keyframes pulse-blue {
        0%   { transform: translate(-50%, -50%) scale(1);   opacity: 0.7; }
        50%  { transform: translate(-50%, -50%) scale(1.6); opacity: 0.2; }
        100% { transform: translate(-50%, -50%) scale(1);   opacity: 0.7; }
    }
    @keyframes pulse-red {
        0%   { transform: translate(-50%, -50%) scale(1);   opacity: 0.7; }
        50%  { transform: translate(-50%, -50%) scale(1.6); opacity: 0.2; }
        100% { transform: translate(-50%, -50%) scale(1);   opacity: 0.7; }
    }
`;
document.head.appendChild(styleEl);


// ============================================================
// 5. ИКОНКА "КАПЛЯ"
// ============================================================
function createUserIcon(heading, color, glowColor, pulseAnim) {
    return L.divIcon({
        className: '',
        html: `
            <div style="position:relative;width:60px;height:60px;">
                <div style="
                    position:absolute;top:50%;left:50%;
                    width:50px;height:50px;border-radius:50%;
                    background:radial-gradient(circle, ${glowColor} 0%, transparent 70%);
                    animation:${pulseAnim} 2s infinite;
                    transform:translate(-50%,-50%);
                "></div>
                <div style="
                    position:absolute;top:50%;left:50%;
                    width:28px;height:28px;
                    transform:translate(-50%,-50%) rotate(${heading}deg);
                    transition:transform 0.3s ease;
                ">
                    <svg viewBox="0 0 32 32" width="28" height="28">
                        <path d="M16 2 L22 14 A8 8 0 1 1 10 14 Z"
                              fill="${color}"
                              stroke="white"
                              stroke-width="2"/>
                        <circle cx="16" cy="18" r="3" fill="white" opacity="0.5"/>
                    </svg>
                </div>
            </div>
        `,
        iconSize: [60, 60],
        iconAnchor: [30, 30]
    });
}


// ============================================================
// 6. ИКОНКА M
// ============================================================
const meetingIcon = L.divIcon({
    className: '',
    html: `
        <div style="position:relative;width:40px;height:40px;">
            <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
                        width:16px;height:16px;border-radius:50%;
                        background:#34C759;border:3px solid white;
                        box-shadow:0 0 10px rgba(52,199,89,0.9);"></div>
        </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 20]
});


// ============================================================
// 7. HAVERSINE
// ============================================================
function haversine(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const toRad = (deg) => deg * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}


// ============================================================
// 8. BEARING
// ============================================================
function bearing(lat1, lng1, lat2, lng2) {
    const toRad = (deg) => deg * Math.PI / 180;
    const toDeg = (rad) => rad * 180 / Math.PI;

    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δλ = toRad(lng2 - lng1);

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

    return (toDeg(Math.atan2(y, x)) + 360) % 360;
}


// ============================================================
// 9. ФОРМАТЫ
// ============================================================
function formatDistance(meters) {
    if (meters < 1000) return Math.round(meters) + ' м';
    return (meters / 1000).toFixed(2) + ' км';
}

function formatDuration(seconds) {
    const min = Math.round(seconds / 60);
    if (min < 1) return '< 1 мин';
    if (min < 60) return min + ' мин';
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h + ' ч ' + m + ' мин';
}


// ============================================================
// 10. OSRM
// ============================================================
const OSRM_URL = 'https://routing.openstreetmap.de/routed-foot';

async function fetchRoute(from, to) {
    const url = `${OSRM_URL}/route/v1/foot/` +
                `${from.lng},${from.lat};${to.lng},${to.lat}` +
                `?overview=full&geometries=geojson`;
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        if (!data.routes || data.routes.length === 0) return null;
        const route = data.routes[0];
        return {
            coords: route.geometry.coordinates.map(c => [c[1], c[0]]),
            distance: route.distance,
            duration: route.duration
        };
    } catch (err) {
        console.warn('OSRM route error:', err);
        return null;
    }
}


// ============================================================
// 11. ТОЧКА НА МАРШРУТЕ
// ============================================================
function findMidpointOnRoute(coords, targetDistance) {
    let accumulated = 0;
    for (let i = 1; i < coords.length; i++) {
        const [lat1, lng1] = coords[i - 1];
        const [lat2, lng2] = coords[i];
        const segDist = haversine(lat1, lng1, lat2, lng2);
        if (accumulated + segDist >= targetDistance) {
            const remaining = targetDistance - accumulated;
            const ratio = segDist > 0 ? remaining / segDist : 0;
            const midLat = lat1 + (lat2 - lat1) * ratio;
            const midLng = lng1 + (lng2 - lng1) * ratio;
            return {
                lat: midLat,
                lng: midLng,
                before: coords.slice(0, i),
                mid: [midLat, midLng],
                after: coords.slice(i)
            };
        }
        accumulated += segDist;
    }
    const last = coords[coords.length - 1];
    return {
        lat: last[0],
        lng: last[1],
        before: coords.slice(0, -1),
        mid: [last[0], last[1]],
        after: [last]
    };
}


// ============================================================
// 12. РАСЧЁТ M И МАРШРУТОВ
// ============================================================
async function updateRoutes() {
    if (!myPosition || !partnerPosition) return;

    const now = Date.now();
    if (now - lastRouteUpdate < ROUTE_UPDATE_INTERVAL) return;
    lastRouteUpdate = now;

    const fullRoute = await fetchRoute(myPosition, partnerPosition);
    if (!fullRoute) {
        console.warn('Не удалось построить маршрут');
        return;
    }

    const coords = fullRoute.coords;
    const totalDistance = fullRoute.distance;
    const totalDuration = fullRoute.duration;

    console.log(`🚶 Пеший маршрут: ${formatDistance(totalDistance)}, ${formatDuration(totalDuration)}`);

    const halfDistance = totalDistance / 2;
    const midResult = findMidpointOnRoute(coords, halfDistance);
    const m = { lat: midResult.lat, lng: midResult.lng };

    console.log(`🎯 M: ${formatDistance(halfDistance)} от старта`);

    if (meetingMarker) {
        meetingMarker.setLatLng([m.lat, m.lng]);
    } else {
        meetingMarker = L.marker([m.lat, m.lng], { icon: meetingIcon }).addTo(map);
    }

    const myHalfCoords = [...midResult.before, midResult.mid];
    const partnerHalfCoords = [midResult.mid, ...midResult.after];

    if (myRouteLine) {
        myRouteLine.setLatLngs(myHalfCoords);
    } else {
        myRouteLine = L.polyline(myHalfCoords, {
            color: '#007AFF', weight: 5, opacity: 0.8
        }).addTo(map);
    }

    if (partnerRouteLine) {
        partnerRouteLine.setLatLngs(partnerHalfCoords);
    } else {
        partnerRouteLine = L.polyline(partnerHalfCoords, {
            color: '#FF3B30', weight: 5, opacity: 0.8
        }).addTo(map);
    }

    const myDist = halfDistance;
    const myTime = totalDuration / 2;

    if (myRole === 'host') {
        meetingInfo.classList.remove('hidden');
        meetingValue.textContent = formatDistance(myDist);
        timeInfo.classList.remove('hidden');
        timeValue.textContent = formatDuration(myTime);
    }
    if (myRole === 'guest') {
        meetingInfoGuest.classList.remove('hidden');
        meetingValueGuest.textContent = formatDistance(myDist);
        timeInfoGuest.classList.remove('hidden');
        timeValueGuest.textContent = formatDuration(myTime);
    }

    updateCompactBlock();

    console.log(`✅ До M: ${formatDistance(myDist)}, ${formatDuration(myTime)}`);
}


// ============================================================
// 13. УСТАНОВКА СВОЕЙ ПОЗИЦИИ
// ============================================================
function setMyPosition(lat, lng, accuracy, source) {
    if (myPosition) {
        const d = haversine(myPosition.lat, myPosition.lng, lat, lng);
        if (d > 3) {
            myHeading = bearing(myPosition.lat, myPosition.lng, lat, lng);
        }
    }

    myPosition = { lat, lng, accuracy: accuracy || 0 };
    statusEl.textContent = `📍 ${lat.toFixed(5)}, ${lng.toFixed(5)} (±${Math.round(accuracy)} м) [${source}]`;

    const icon = createUserIcon(myHeading, '#007AFF', 'rgba(0,122,255,0.5)', 'pulse-blue');

    if (myMarker) {
        myMarker.setLatLng([lat, lng]);
        myMarker.setIcon(icon);
    } else {
        myMarker = L.marker([lat, lng], { icon: icon }).addTo(map);
        map.setView([lat, lng], 15);
    }

    if (followMe) {
        map.setView([lat, lng], map.getZoom());
    }

    updateRoutes();

    if (roomCode && myRole) {
        sendMyPosition();
    }
}


// ============================================================
// 14. GPS
// ============================================================
function startTracking() {
    if (!navigator.geolocation) {
        statusEl.textContent = '❌ GPS не поддерживается';
        return;
    }
    statusEl.textContent = '⏳ Ищу GPS...';

    navigator.geolocation.watchPosition(
        (position) => {
            if (window.debugPositionActive) return;
            setMyPosition(
                position.coords.latitude,
                position.coords.longitude,
                position.coords.accuracy,
                'GPS'
            );
        },
        (error) => {
            statusEl.textContent = '❌ Ошибка GPS: ' + error.message;
        },
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );
}


// ============================================================
// 15. ПАНЕЛИ
// ============================================================
function showPanel(name) {
    panelStart.classList.add('hidden');
    panelHost.classList.add('hidden');
    panelGuest.classList.add('hidden');
    if (name === 'start') panelStart.classList.remove('hidden');
    if (name === 'host')  panelHost.classList.remove('hidden');
    if (name === 'guest') panelGuest.classList.remove('hidden');
}


// ============================================================
// 16. СВОРАЧИВАНИЕ ПАНЕЛИ + КОМПАКТ-БЛОК
// ============================================================
function togglePanel(toggleEl) {
    const panel = toggleEl.parentElement;
    panel.classList.toggle('collapsed');
}

function updateCompactBlock() {
    let dist = '—';
    let time = '—';

    if (myRole === 'host') {
        dist = document.getElementById('meeting-value')?.textContent || '—';
        time = document.getElementById('time-value')?.textContent || '—';
    } else if (myRole === 'guest') {
        dist = document.getElementById('meeting-value-guest')?.textContent || '—';
        time = document.getElementById('time-value-guest')?.textContent || '—';
    }

    const distHost = document.getElementById('compact-distance-host');
    const timeHost = document.getElementById('compact-time-host');
    const distGuest = document.getElementById('compact-distance-guest');
    const timeGuest = document.getElementById('compact-time-guest');

    if (distHost) distHost.textContent = `👣 ${dist}`;
    if (timeHost) timeHost.textContent = `⏱️ ${time}`;
    if (distGuest) distGuest.textContent = `👣 ${dist}`;
    if (timeGuest) timeGuest.textContent = `⏱️ ${time}`;
}


// ============================================================
// 17. СОЗДАНИЕ
// ============================================================
async function createMeeting() {
    try {
        const res = await fetch(`${API_BASE}/api/room/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                custom_code: myCustomCode || null,
                name: myName
            })
        });
        if (!res.ok) {
            const err = await res.json();
            alert('Ошибка: ' + (err.detail || 'не удалось создать'));
            return;
        }
        const data = await res.json();
        roomCode = data.code;
        myRole = data.role;
        roomCodeEl.textContent = roomCode;
        showPanel('host');
        startPolling();
    } catch (err) {
        alert('Ошибка создания встречи: ' + err.message);
    }
}


// ============================================================
// 18. ПОДКЛЮЧЕНИЕ
// ============================================================
async function joinMeeting() {
    const code = inputCode.value.trim().toUpperCase();
    if (code.length < 4) {
        alert('Код должен быть минимум 4 символа');
        return;
    }
    try {
        const res = await fetch(`${API_BASE}/api/room/${code}/join`, { method: 'POST' });
        if (!res.ok) {
            alert('Комната не найдена');
            return;
        }
        const data = await res.json();
        roomCode = data.code;
        myRole = data.role;
        showPanel('guest');
        startPolling();
    } catch (err) {
        alert('Ошибка подключения: ' + err.message);
    }
}


// ============================================================
// 19. ОТПРАВКА ПОЗИЦИИ
// ============================================================
async function sendMyPosition() {
    if (!roomCode || !myRole || !myPosition) return;
    try {
        await fetch(`${API_BASE}/api/room/${roomCode}/position`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                code: roomCode,
                role: myRole,
                name: myName,
                lat: myPosition.lat,
                lng: myPosition.lng,
                accuracy: myPosition.accuracy
            })
        });
    } catch (err) {
        console.warn('Не удалось отправить позицию:', err);
    }
}


// ============================================================
// 20. ПОЛУЧЕНИЕ СОСТОЯНИЯ
// ============================================================
async function fetchRoomState() {
    if (!roomCode) return;
    try {
        const res = await fetch(`${API_BASE}/api/room/${roomCode}/state`);
        if (!res.ok) return;
        const state = await res.json();
        updatePartner(state);
    } catch (err) {
        console.warn('Не удалось получить состояние:', err);
    }
}


// ============================================================
// 21. ПАРТНЁР
// ============================================================
function updatePartner(state) {
    const partner = myRole === 'host' ? state.guest : state.host;

    if (myRole === 'host') {
        if (state.guest) {
            partnerInfo.textContent = `✅ ${state.guest.name} подключён`;
        } else {
            partnerInfo.textContent = '⏳ Партнёр не подключён';
            if (partnerPosition) {
                partnerPosition = null;
                if (partnerMarker) { map.removeLayer(partnerMarker); partnerMarker = null; }
                if (partnerRouteLine) { map.removeLayer(partnerRouteLine); partnerRouteLine = null; }
                if (meetingMarker) { map.removeLayer(meetingMarker); meetingMarker = null; }
                if (myRouteLine) { map.removeLayer(myRouteLine); myRouteLine = null; }
                meetingInfo.classList.add('hidden');
                timeInfo.classList.add('hidden');
            }
        }
    }
    if (myRole === 'guest') {
        partnerInfoGuest.textContent = `Партнёр: ${state.host.name}`;
    }

    if (partner && partner.lat != null && partner.lng != null) {
        if (partnerPosition) {
            const d = haversine(partnerPosition.lat, partnerPosition.lng, partner.lat, partner.lng);
            if (d > 3) {
                partnerHeading = bearing(partnerPosition.lat, partnerPosition.lng, partner.lat, partner.lng);
            }
        }

        partnerPosition = { lat: partner.lat, lng: partner.lng };
        const latlng = [partner.lat, partner.lng];

        const icon = createUserIcon(partnerHeading, '#FF3B30', 'rgba(255,59,48,0.5)', 'pulse-red');

        if (partnerMarker) {
            partnerMarker.setLatLng(latlng);
            partnerMarker.setIcon(icon);
        } else {
            partnerMarker = L.marker(latlng, { icon: icon }).addTo(map);
            if (myMarker) {
                const bounds = L.latLngBounds([myMarker.getLatLng(), latlng]);
                map.fitBounds(bounds, { padding: [80, 80] });
            }
        }
        updateRoutes();

        if (myRole === 'guest') {
            partnerInfoGuest.textContent = `✅ ${partner.name}`;
        }

        // Форсируем обновление компакт-блока
        setTimeout(updateCompactBlock, 300);
    }
}


// ============================================================
// 22. POLLING
// ============================================================
function startPolling() {
    if (pollInterval) clearInterval(pollInterval);
    sendMyPosition();
    fetchRoomState();
    pollInterval = setInterval(() => {
        sendMyPosition();
        fetchRoomState();
    }, 2000);
}


// ============================================================
// 23. ВЫХОД
// ============================================================
async function leaveMeeting() {
    if (roomCode && myRole) {
        try {
            await fetch(`${API_BASE}/api/room/${roomCode}/leave`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role: myRole })
            });
        } catch (err) {
            console.warn('Не удалось выйти:', err);
        }
    }

    if (pollInterval) clearInterval(pollInterval);
    pollInterval = null;

    roomCode = null;
    myRole = null;
    partnerPosition = null;
    lastRouteUpdate = 0;

    if (partnerMarker) { map.removeLayer(partnerMarker); partnerMarker = null; }
    if (meetingMarker) { map.removeLayer(meetingMarker); meetingMarker = null; }
    if (myRouteLine) { map.removeLayer(myRouteLine); myRouteLine = null; }
    if (partnerRouteLine) { map.removeLayer(partnerRouteLine); partnerRouteLine = null; }

    meetingInfo.classList.add('hidden');
    meetingInfoGuest.classList.add('hidden');
    timeInfo.classList.add('hidden');
    timeInfoGuest.classList.add('hidden');

    showPanel('start');
}


// ============================================================
// 24. НАСТРОЙКИ
// ============================================================
function openSettings() {
    inputName.value = myName;
    inputCustomCode.value = myCustomCode;
    settingsPanel.classList.toggle('hidden');
}

function saveName() {
    const newName = inputName.value.trim();
    if (newName.length === 0) {
        alert('Имя не может быть пустым');
        return;
    }
    const newCode = inputCustomCode.value.trim().toUpperCase();
    if (newCode.length > 0) {
        if (newCode.length < 4 || newCode.length > 20) {
            alert('Код должен быть от 4 до 20 символов');
            return;
        }
        if (!/^[A-Z0-9]+$/.test(newCode)) {
            alert('Код может содержать только буквы и цифры');
            return;
        }
    }
    myName = newName;
    myCustomCode = newCode;
    localStorage.setItem('myName', myName);
    localStorage.setItem('myCustomCode', myCustomCode);
    settingsPanel.classList.add('hidden');
    if (roomCode && myRole) {
        sendMyPosition();
    }
}


// ============================================================
// 25. DEBUG
// ============================================================
window.setPos = function(lat, lng) {
    window.debugPositionActive = true;
    lastRouteUpdate = 0;
    setMyPosition(parseFloat(lat), parseFloat(lng), 5, 'DEBUG');
    console.log(`✅ Debug-позиция: ${lat}, ${lng}. GPS игнорируется.`);
};

window.resetPos = function() {
    window.debugPositionActive = false;
    lastRouteUpdate = 0;
    console.log('🔄 Debug выключен, GPS снова активен');
};

window.help = function() {
    console.log(`
🎯 Команды:
  setPos(55.7539, 37.6208)    — Красная площадь
  setPos(55.7571, 37.6317)    — Китай-город
  setPos(55.7300, 37.6010)    — Парк Горького
  setPos(55.7517, 37.5930)    — Арбат
  resetPos()                  — вернуться к GPS
  help()                      — эта справка
    `);
};

console.log('💡 Введите help() в консоли, чтобы увидеть команды отладки');


// ============================================================
// 26. СОБЫТИЯ
// ============================================================
btnCreate.addEventListener('click', createMeeting);
btnJoin.addEventListener('click', joinMeeting);
btnLeave.addEventListener('click', leaveMeeting);
btnLeaveHost.addEventListener('click', leaveMeeting);
settingsBtn.addEventListener('click', openSettings);
btnSaveName.addEventListener('click', saveName);

inputCode.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') joinMeeting();
});

inputName.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') saveName();
});


// ============================================================
// 27. СТАРТ
// ============================================================
createFollowButton();
startTracking();

setInterval(() => {
    if (myPosition && partnerPosition && myRole && roomCode) {
        lastRouteUpdate = 0;
        updateRoutes();
    }
}, 8000);