// --- КЛАССИЧЕСКАЯ ИНИЦИАЛИЗАЦИЯ (Без полноэкранного режима) ---
const tg = window.Telegram ? window.Telegram.WebApp : null;

if (tg) {
    tg.expand(); // Просто разворачиваем на стандартную высоту
    
    if (tg.isVersionAtLeast && tg.isVersionAtLeast('6.1')) {
        tg.setHeaderColor('#FFF8EE');
        tg.setBackgroundColor('#FFF8EE');
    }
    
    // ВАЖНО: Команда, которая снимает вечный лоадер на телефонах
    if (tg.ready) tg.ready(); 
}

// Заглушка для тестов на ПК (убрали опасные символы '?.' для старых телефонов)
const user = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.id) 
    ? tg.initDataUnsafe.user 
    : {
        id: 999888777,
        first_name: "Разработчик",
        photo_url: ""
    };



// --- ОБНОВЛЕННАЯ ГЕНЕРАЦИЯ АВАТАРА (Теперь он кликабельный) ---
const avatarContainer = document.getElementById('userAvatar');
if (user && user.photo_url) {
    avatarContainer.innerHTML = `<img src="${user.photo_url}" class="avatar" onclick="openProfile()">`;
} else {
    const initial = user?.first_name ? user.first_name.charAt(0).toUpperCase() : 'Г';
    avatarContainer.innerHTML = `<div class="avatar" onclick="openProfile()">${initial}</div>`;
}

// Заполняем данные внутри профиля сразу при старте
const profileAvatarContainer = document.getElementById('profileAvatarBig');
if (user && user.photo_url) {
    profileAvatarContainer.innerHTML = `<img src="${user.photo_url}">`;
} else {
    const initial = user?.first_name ? user.first_name.charAt(0).toUpperCase() : 'Г';
    profileAvatarContainer.innerHTML = initial;
}
if (user?.first_name) {
    document.getElementById('profileName').innerText = user.first_name;
}

let STORE_SETTINGS = {
    freeDeliveryThreshold: 60,
    deliveryCost: 15,
    defaultMargin: 1.7,
    categoryMargins: { "Жидкости": 1.7, "Расходники": 1.5, "Устройства": 1.3 },
    editLockStatus: 2,
    openDate: null,
    closeDate: null
};


    // --- ШАГ 4: МОЗГ ТАЙМЕРА И ПРОВЕРКИ ---
let timerInterval = null;

function checkStoreStatus() {
    if (currentUserData && currentUserData.status === 'admin') return true;

    const now = new Date();
    const openTime = STORE_SETTINGS.openDate ? new Date(STORE_SETTINGS.openDate) : null;
    const closeTime = STORE_SETTINGS.closeDate ? new Date(STORE_SETTINGS.closeDate) : null;

    if (!openTime || !closeTime) return false;
    if (now >= openTime && now <= closeTime) return true;
    return false; 
}

function startDropTimer() {
    if (timerInterval) clearInterval(timerInterval);
    
    const openTime = STORE_SETTINGS.openDate ? new Date(STORE_SETTINGS.openDate).getTime() : null;
    const container = document.getElementById('dropTimerContainer');
    const statusText = document.getElementById('closedStatusText');

    if (!openTime || openTime < new Date().getTime()) {
        if(container) container.style.display = 'none';
        if(statusText) statusText.innerText = "Ждите анонса следующего дропа! Включайте уведомления 🔔";
        return;
    }

    if(container) container.style.display = 'block';
    if(statusText) statusText.innerText = "Мы готовим для вас кое-что вкусное. Открытие через:";

    timerInterval = setInterval(() => {
        const now = new Date().getTime();
        const distance = openTime - now;

        if (distance < 0) {
            clearInterval(timerInterval);
            location.reload(); 
            return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((distance % (1000 * 60)) / 1000);

        document.getElementById('timerDays').innerText = days < 10 ? '0' + days : days;
        document.getElementById('timerHours').innerText = hours < 10 ? '0' + hours : hours;
        document.getElementById('timerMins').innerText = mins < 10 ? '0' + mins : mins;
        document.getElementById('timerSecs').innerText = secs < 10 ? '0' + secs : secs;
    }, 1000);
}

// Новый массив для хранения статусов из БД
let ORDER_STATUSES = [];

const SB_URL = "https://hblqhusypxuoioultjfz.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhibHFodXN5cHh1b2lvdWx0amZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NTcyNDcsImV4cCI6MjA5MjUzMzI0N30.KzHgvO8x6X0MOC742Vm-gXggMnYdnms5bnSzInO9OOY"; 

let allProducts = [];
let currentCategory = 'Все';
let searchQuery = '';
let sortState = 'default';
let filters = { minStr: 0, maxStr: 100, brands: [] };

let cart = JSON.parse(localStorage.getItem('cart_v1')) || {};
let appState = 'catalog'; 
let deliveryMode = 'pickup'; 

let selectedProduct = null;
let currentQty = 1;

// --- ОБНОВЛЕННЫЙ РАСЧЕТ ЦЕНЫ ---
function getRetailPrice(priceString, category) {
    // Чистим строку (уважая дроби)
    const cleanString = String(priceString).replace(',', '.').replace(/[^\d.]/g, '');
    const basePrice = parseFloat(cleanString) || 0;
    
    // Ищем процент накрутки для категории, если не нашли — берем дефолт
    const margin = STORE_SETTINGS.categoryMargins[category] || STORE_SETTINGS.defaultMargin;
    
    return Math.round(basePrice * margin);
}

function parseStrengthNum(str) {
    if (!str || str === "—" || str === "Н/Д") return 0;
    const match = str.match(/\d+/);
    return match ? parseInt(match[0]) : 0;
}

// --- УМНАЯ КНОПКА (Теперь на 100% кастомная) ---
const MainBtn = {
    setText: (text) => {
        document.getElementById('fakeMainButton').innerText = text;
    },
    show: () => {
        document.getElementById('fakeMainButton').style.display = 'block';
    },
    hide: () => {
        document.getElementById('fakeMainButton').style.display = 'none';
    }
};

// Никаких проверок tg.MainButton больше нет, 
// клик по кнопке уже висит в HTML (onclick="mainButtonHandler()")

if (tg?.MainButton) {
    tg.MainButton.onClick(mainButtonHandler);
}

async function loadProducts() {
    try {
        // --- СНАЧАЛА ГРУЗИМ НАСТРОЙКИ И СТАТУСЫ ---
        const [configResp, statusesResp] = await Promise.all([
            fetch(`${SB_URL}/rest/v1/config?id=eq.1&select=*`, { headers: { "apikey": SB_KEY, "Authorization": `Bearer ${SB_KEY}` } }),
            fetch(`${SB_URL}/rest/v1/order_statuses?order=sort_order`, { headers: { "apikey": SB_KEY, "Authorization": `Bearer ${SB_KEY}` } })
        ]);
        
        const configData = await configResp.json();
        if (configData && configData.length > 0) {
            const db = configData[0];
            STORE_SETTINGS.freeDeliveryThreshold = db.free_delivery_threshold || 60;
            STORE_SETTINGS.deliveryCost = db.delivery_cost || 15;
            STORE_SETTINGS.defaultMargin = db.default_margin || 1.7;
            STORE_SETTINGS.categoryMargins = db.category_margins || STORE_SETTINGS.categoryMargins;
            STORE_SETTINGS.editLockStatus = db.edit_lock_status || 2;
            STORE_SETTINGS.openDate = db.open_date || null;
            STORE_SETTINGS.closeDate = db.close_date || null;
        }

        ORDER_STATUSES = await statusesResp.json();

        // --- ДАЛЬШЕ ТВОЙ ОБЫЧНЫЙ КОД (fetch products) ---
        const response = await fetch(`${SB_URL}/rest/v1/products?limit=10000&order=category`, {
            headers: { "apikey": SB_KEY, "Authorization": `Bearer ${SB_KEY}` }
        });
        const rawProducts = await response.json();
        
        allProducts = rawProducts.filter(p => {
            const cleanString = String(p.price_10).replace(',', '.').replace(/[^\d.]/g, '');
            const basePrice = parseFloat(cleanString) || 0;
            const availStr = String(p.availability || '').toLowerCase().trim();
            const isAvailable = availStr === 'есть' || availStr === 'в наличии' || availStr === 'true' || p.availability === true;
            return basePrice <= 100 && isAvailable;
        });
        
        document.getElementById('loader').style.display = 'none';

        // --- ШАГ 3: ПРОВЕРКА ОТКРЫТИЯ МАГАЗИНА ---
        if (!checkStoreStatus()) {
            // Если магазин закрыт — показываем заглушку и запускаем таймер
            // (Предполагаю, что у тебя есть функция showScreen, либо просто прячем/показываем блоки)
            const closedScreen = document.getElementById('closedScreen');
            if (closedScreen) closedScreen.style.display = 'flex';
            
            startDropTimer();
            if (tg) tg.MainButton.hide();
        } else {
            // Если открыто — рисуем товары как обычно
            renderCategories();
            populateBrandsFilter();
            renderProducts();
            updateMainButtonState(); 
        }
        // -----------------------------------------
    } catch (e) {
        console.error(e);
        alert("Ошибка загрузки.");
    }


// --------------------------------------

function checkStoreStatus() {
    if (currentUserData && currentUserData.status === 'admin') return true; // Админам можно всегда

    const now = new Date();
    const openTime = STORE_SETTINGS.openDate ? new Date(STORE_SETTINGS.openDate) : null;
    const closeTime = STORE_SETTINGS.closeDate ? new Date(STORE_SETTINGS.closeDate) : null;

    if (!openTime || !closeTime) return false;
    if (now >= openTime && now <= closeTime) return true;
    return false; 
}

function startDropTimer() {
    if (timerInterval) clearInterval(timerInterval);
    
    const openTime = STORE_SETTINGS.openDate ? new Date(STORE_SETTINGS.openDate).getTime() : null;
    const container = document.getElementById('dropTimerContainer');
    const statusText = document.getElementById('closedStatusText');

    if (!openTime || openTime < new Date().getTime()) {
        if(container) container.style.display = 'none';
        if(statusText) statusText.innerText = "Ждите анонса следующего дропа! Включайте уведомления 🔔";
        return;
    }

    if(container) container.style.display = 'block';
    if(statusText) statusText.innerText = "Мы готовим для вас кое-что вкусное. Открытие через:";

    timerInterval = setInterval(() => {
        const now = new Date().getTime();
        const distance = openTime - now;

        if (distance < 0) {
            clearInterval(timerInterval);
            location.reload(); 
            return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        document.getElementById('timerDays').innerText = days < 10 ? '0' + days : days;
        document.getElementById('timerHours').innerText = hours < 10 ? '0' + hours : hours;
        document.getElementById('timerMins').innerText = minutes < 10 ? '0' + minutes : minutes;
        document.getElementById('timerSecs').innerText = seconds < 10 ? '0' + seconds : seconds;
    }, 1000);
}
}

function toggleSearch() {
    const container = document.getElementById('searchContainer');
    container.classList.toggle('active');
    if (container.classList.contains('active')) document.getElementById('searchInput').focus();
    else { document.getElementById('searchInput').value = ''; searchQuery = ''; renderProducts(); }
}

function handleSearch() { searchQuery = document.getElementById('searchInput').value.toLowerCase().trim(); renderProducts(); }

function renderCategories() {
    const cats = ['Все', ...new Set(allProducts.map(p => p.category))];
    document.getElementById('catList').innerHTML = cats.map(c => `<div class="cat-btn ${c === 'Все' ? 'active' : ''}" onclick="filterCat('${c}', this)">${c}</div>`).join('');
}

function filterCat(cat, el) {
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active'); currentCategory = cat; renderProducts();
}

function toggleSortMenu(e) { e.stopPropagation(); document.getElementById('sortMenu').classList.toggle('active'); }
document.addEventListener('click', () => { document.getElementById('sortMenu').classList.remove('active'); });

function applySort(type) {
    sortState = type;
    const labels = { 'default': 'По умолчанию', 'price_asc': 'Сначала дешевые', 'price_desc': 'Сначала дорогие', 'strength_asc': 'Сначала легкие', 'strength_desc': 'Сначала крепкие' };
    document.getElementById('currentSortText').innerText = labels[type] || 'Сортировка';
    renderProducts();
}

function populateBrandsFilter() {
    const brands = [...new Set(allProducts.map(p => p.manufacturer !== "Расходники" ? p.manufacturer : p.series))].filter(Boolean);
    document.getElementById('brandList').innerHTML = brands.sort().map(b => `<label class="custom-checkbox"><input type="checkbox" value="${b.replace(/"/g, '&quot;')}"><span class="checkmark"></span>${b}</label>`).join('');
}

function openFilterSheet() { document.getElementById('overlay').classList.add('active'); document.getElementById('filterSheet').classList.add('active'); }

function updateRange() {
    let minSlider = document.getElementById('minStrength'), maxSlider = document.getElementById('maxStrength');
    if (parseInt(minSlider.value) > parseInt(maxSlider.value)) { let temp = minSlider.value; minSlider.value = maxSlider.value; maxSlider.value = temp; }
    document.getElementById('strengthValues').innerText = `${minSlider.value} - ${maxSlider.value} мг`;
    const minP = (minSlider.value / 100) * 100, maxP = (maxSlider.value / 100) * 100;
    document.getElementById('sliderTrack').style.background = `linear-gradient(to right, #E8C396 ${minP}%, #D97736 ${minP}%, #D97736 ${maxP}%, #E8C396 ${maxP}%)`;
}

function resetFilters() {
    document.getElementById('minStrength').value = 0; document.getElementById('maxStrength').value = 100;
    document.querySelectorAll('#brandList input:checked').forEach(cb => cb.checked = false);
    updateRange(); applyFilters();
}

function applyFilters() {
    filters.minStr = parseInt(document.getElementById('minStrength').value); filters.maxStr = parseInt(document.getElementById('maxStrength').value);
    filters.brands = Array.from(document.querySelectorAll('#brandList input:checked')).map(cb => cb.value);
    closeSheets(); updateFilterButtonState(); renderProducts();
}

function updateFilterButtonState() {
    let count = filters.brands.length + ((filters.minStr > 0 || filters.maxStr < 100) ? 1 : 0);
    const btn = document.getElementById('filterBtn'), arrow = document.getElementById('filterArrow'), counter = document.getElementById('filterCount');
    if (count > 0) { btn.classList.add('active'); arrow.style.display = 'none'; counter.style.display = 'flex'; counter.innerText = count; }
    else { btn.classList.remove('active'); arrow.style.display = 'inline'; counter.style.display = 'none'; }
}

function renderProducts() {
    const gridContainer = document.getElementById('productGrid');
    const statusLabel = document.getElementById('searchStatus');
    
    let filtered = allProducts;
    if (currentCategory !== 'Все') filtered = filtered.filter(p => p.category === currentCategory);
    if (searchQuery) filtered = filtered.filter(p => (p.flavor && p.flavor.toLowerCase().includes(searchQuery)) || (p.series && p.series.toLowerCase().includes(searchQuery)) || (p.manufacturer && p.manufacturer.toLowerCase().includes(searchQuery)));
    if (filters.brands.length > 0 || filters.minStr > 0 || filters.maxStr < 100) {
        filtered = filtered.filter(p => {
            const strNum = parseStrengthNum(p.strength), bName = p.manufacturer !== "Расходники" ? p.manufacturer : p.series;
            return (strNum >= filters.minStr && strNum <= filters.maxStr) && (filters.brands.length === 0 || filters.brands.includes(bName));
        });
    }

    if (searchQuery) statusLabel.innerText = filtered.length > 0 ? `Найдено: ${filtered.length}` : `Упс, такого нету :(`; else statusLabel.innerText = '';
    if (filtered.length === 0) { gridContainer.innerHTML = ""; return; }

    const grouped = {};
    filtered.forEach(p => {
        let seriesName = (p.series && p.series !== "—") ? p.series : p.manufacturer;
        seriesName = seriesName.replace(/new\s+/i, '').trim(); 
        
        const brandName = p.manufacturer !== "Расходники" ? p.manufacturer : "Расходники";
        const strength = (p.strength && p.strength !== "—" && p.strength !== "Н/Д") ? p.strength : "";
        
        // Убрали catTag из отображения, но оставили категорию в ключе (groupKey), чтобы жидкости и одноразки одного бренда не склеились
        const groupKey = `${p.category}_${brandName}_${seriesName}_${strength}`;
        
        if (!grouped[groupKey]) {
            grouped[groupKey] = { 
                category: p.category, // Запоминаем категорию для заголовков
                brand: brandName, 
                series: seriesName, 
                strength: strength, 
                strNum: parseStrengthNum(strength), 
                items: [] 
            };
        }
        grouped[groupKey].items.push(p);
    });

    let groupsArray = Object.values(grouped);
    
    // Сначала сортируем, чтобы если вкладка "Все", группы выстроились по категориям
    if (sortState !== 'default') {
        groupsArray.forEach(g => { 
            g.minPrice = Math.min(...g.items.map(i => getRetailPrice(i.price_10, i.category))); 
            g.maxPrice = Math.max(...g.items.map(i => getRetailPrice(i.price_10, i.category))); 
        });
    }

    groupsArray.sort((a, b) => {
        // Если "Все" - группируем по алфавиту категорий
        if (currentCategory === 'Все') {
            if (a.category < b.category) return -1;
            if (a.category > b.category) return 1;
        }
        
        // Дальше применяем пользовательскую сортировку (если есть)
        if (sortState === 'price_asc') return a.minPrice - b.minPrice;
        if (sortState === 'price_desc') return b.maxPrice - a.maxPrice;
        if (sortState === 'strength_asc') return a.strNum - b.strNum;
        if (sortState === 'strength_desc') return b.strNum - a.strNum;
        return 0;
    });

    let html = '';
    const isOpen = (searchQuery || filters.brands.length > 0 || sortState !== 'default') ? 'open' : '';
    
    let currentPrintedCategory = ''; // Переменная для отслеживания смены категорий

    groupsArray.forEach(group => {
        // Если вкладка "Все" и категория поменялась - рисуем заголовок
        if (currentCategory === 'Все' && group.category !== currentPrintedCategory) {
            currentPrintedCategory = group.category;
            // Стилизуем заголовок прямо здесь, чтобы не лезть в CSS
            html += `<h2 style="text-align: left; font-size: 18px; font-weight: 900; color: #5C3A21; margin: 25px 0 10px 10px;">${currentPrintedCategory}</h2>`;
        }

        const cardsHtml = group.items.map(item => {
            return `<div class="card" onclick='openProductSheet(${JSON.stringify(item).replace(/'/g, "&apos;")})'>
                ${item.is_new ? '<div class="badge-new">NEW</div>' : ''}
                <div class="title">${item.flavor}</div>
                <div class="price">${getRetailPrice(item.price_10, item.category)} р.</div>
            </div>`;
        }).join('');
        
        // Убрали ${group.tag} из верстки аккордеона
        html += `<details class="accordion" ${isOpen}>
                    <summary class="accordion-summary">
                        <div class="group-title">
                            <span class="group-brand">${group.brand !== group.series ? group.brand : ''}</span>
                            <div class="group-name">${group.series} ${group.strength ? `<span class="group-strength">${group.strength}</span>` : ''}</div>
                        </div>
                    </summary>
                    <div class="accordion-content">
                        <div class="products-grid">${cardsHtml}</div>
                    </div>
                 </details>`;
    });
    gridContainer.innerHTML = html;
}

function closeSheets() { document.getElementById('overlay').classList.remove('active'); document.querySelectorAll('.bottom-sheet').forEach(s => s.classList.remove('active')); selectedProduct = null; }

function openProductSheet(product) {
    selectedProduct = product; currentQty = 1;
    document.getElementById('sheetTitle').innerText = product.flavor;
    const series = (product.series && product.series !== "—") ? product.series : product.manufacturer;
    const strength = (product.strength && product.strength !== "—" && product.strength !== "Н/Д") ? ` • ${product.strength}` : "";
    document.getElementById('sheetSubtitle').innerText = `${series}${strength}`;
    
    // Передаем категорию для правильного расчета
    const price = getRetailPrice(product.price_10, product.category);
    document.getElementById('sheetPrice').innerText = `${price} р.`;
    document.getElementById('sheetQty').innerText = currentQty;
    document.getElementById('sheetTotal').innerText = price * currentQty;
    
    document.getElementById('overlay').classList.add('active'); document.getElementById('bottomSheet').classList.add('active');
    if (tg?.HapticFeedback && tg.isVersionAtLeast && tg.isVersionAtLeast('6.1')) tg.HapticFeedback.impactOccurred('light');
}

function changeQty(delta) {
    currentQty += delta; if (currentQty < 1) currentQty = 1; if (currentQty > 20) currentQty = 20; 
    document.getElementById('sheetQty').innerText = currentQty;
    
    // Передаем категорию
    const price = getRetailPrice(selectedProduct.price_10, selectedProduct.category);
    document.getElementById('sheetTotal').innerText = price * currentQty;
    
    if (tg?.HapticFeedback && tg.isVersionAtLeast && tg.isVersionAtLeast('6.1')) tg.HapticFeedback.selectionChanged();
}

function saveCart() { localStorage.setItem('cart_v1', JSON.stringify(cart)); }

function getCartTotals() {
    let sum = 0, count = 0;
    for (const key in cart) { 
        sum += getRetailPrice(cart[key].product.price_10, cart[key].product.category) * cart[key].qty; 
        count += cart[key].qty; 
    }
    return { sum, count };
}

function addToCart() {
    const itemId = selectedProduct.id || (selectedProduct.flavor + selectedProduct.series);
    if(cart[itemId]) cart[itemId].qty += currentQty; else cart[itemId] = { product: selectedProduct, qty: currentQty };
    saveCart(); closeSheets();
    if (tg?.HapticFeedback && tg.isVersionAtLeast && tg.isVersionAtLeast('6.1')) tg.HapticFeedback.notificationOccurred('success');
    updateMainButtonState();
}

function updateMainButtonState() {
    const { sum, count } = getCartTotals();
    
    if (appState === 'catalog') {
        if (count > 0) { MainBtn.setText(`Корзина: ${count} шт. на ${sum} р.`); MainBtn.show(); }
        else MainBtn.hide();
    } else if (appState === 'cart') {
        MainBtn.setText(`Перейти к оформлению`); MainBtn.show();
    } else if (appState === 'checkout') {
        let finalSum = sum;
        if (deliveryMode === 'delivery' && sum < STORE_SETTINGS.free_delivery_threshold) finalSum += STORE_SETTINGS.deliveryCost;
        MainBtn.setText(`Подтвердить заказ на ${finalSum} р.`); MainBtn.show();
    }
}

function mainButtonHandler() {
    if (appState === 'catalog') openCart();
    else if (appState === 'cart') openCheckout();
    else if (appState === 'checkout') submitOrder();
}

function openCart() {
    appState = 'cart'; renderCartList();
    document.getElementById('cartScreen').classList.add('active');
    updateMainButtonState();
}
function closeCart() { appState = 'catalog'; document.getElementById('cartScreen').classList.remove('active'); updateMainButtonState(); }

function renderCartList() {
    const list = document.getElementById('cartList'); 
    const { sum, count } = getCartTotals();
    if (count === 0) { list.innerHTML = `<div style="text-align:center; padding: 40px 0; color:#8B5E3C; font-weight:bold;">Корзина пуста 😔</div>`; document.getElementById('cartTotalSum').innerText = 0; return; }
    
    let html = '';
    for (const key in cart) {
        const p = cart[key].product, price = getRetailPrice(p.price_10, p.category);
        html += `
        <div class="cart-item-wrapper">
            <div class="cart-item-bg" onclick="removeCartItem('${key}')">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                <span>Удалить</span>
            </div>
            <div class="cart-item" ontouchstart="handleSwipeStart(event, this)" ontouchmove="handleSwipeMove(event, this)" ontouchend="handleSwipeEnd(event, this)">
                <div class="cart-item-info">
                    <div class="title">${p.flavor}</div>
                    <div class="subtitle">${p.series} ${p.strength && p.strength !== '—' && p.strength !== 'Н/Д' ? `• ${p.strength}` : ''}</div>
                    <div class="price">${price} р.</div>
                </div>
                <div class="qty-controls small">
                    <button class="qty-btn" onclick="updateCartItem('${key}', -1)">-</button>
                    <div class="qty-value">${cart[key].qty}</div>
                    <button class="qty-btn" onclick="updateCartItem('${key}', 1)">+</button>
                </div>
            </div>
        </div>`;
    }
    list.innerHTML = html; document.getElementById('cartTotalSum').innerText = sum;
}

function updateCartItem(key, delta) {
    if (cart[key]) {
        cart[key].qty += delta; 
        
        // Теперь количество не может упасть ниже 1
        if (cart[key].qty < 1) {
            cart[key].qty = 1; 
        }
        
        saveCart(); renderCartList(); updateMainButtonState();
    }
    if (tg?.HapticFeedback && tg.isVersionAtLeast && tg.isVersionAtLeast('6.1')) tg.HapticFeedback.selectionChanged();
}

// Новая функция для полного удаления (вызывается при клике на красную кнопку)
function removeCartItem(key) {
    delete cart[key];
    saveCart(); 
    renderCartList(); 
    updateMainButtonState();
    if (getCartTotals().count === 0) closeCart();
    if (tg?.HapticFeedback && tg.isVersionAtLeast && tg.isVersionAtLeast('6.1')) tg.HapticFeedback.impactOccurred('medium');
}

function openCheckout() { appState = 'checkout'; document.getElementById('checkoutScreen').classList.add('active'); setDeliveryMode('pickup'); updateMainButtonState(); }
function closeCheckout() { appState = 'cart'; document.getElementById('checkoutScreen').classList.remove('active'); updateMainButtonState(); }

function setDeliveryMode(mode) {
    deliveryMode = mode; document.querySelectorAll('.delivery-tabs .tab').forEach(t => t.classList.remove('active'));
    if (mode === 'pickup') {
        document.getElementById('tabPickup').classList.add('active');
        document.getElementById('pickupInfo').style.display = 'block'; document.getElementById('deliveryInfo').style.display = 'none';
    } else {
        document.getElementById('tabDelivery').classList.add('active');
        document.getElementById('pickupInfo').style.display = 'none'; document.getElementById('deliveryInfo').style.display = 'block';
        const { sum } = getCartTotals();
        document.getElementById('deliveryCostText').innerText = sum >= STORE_SETTINGS.free_delivery_threshold ? 'Доставка: Бесплатно' : `Доставка: ${STORE_SETTINGS.deliveryCost} р.`;
    }
    updateMainButtonState();
}

async function submitOrder() {
    // ЗАЩИТА ОТ ЗОЛУШКИ
    if (!checkStoreStatus()) {
        alert("Ой! Магазин только что закрылся 😔 Заказы больше не принимаются.");
        location.reload();
        return;
    }

    let address = '';
    if (deliveryMode === 'delivery') {
        address = document.getElementById('deliveryAddress').value.trim();
        if (!address) { alert("Пожалуйста, введи адрес доставки!"); return; }
    }
    
    // Блокируем кнопку
    const originalBtnText = document.getElementById('fakeMainButton').innerText;
    MainBtn.setText('Обработка...');

    try {
        // 1. Проверяем наличие активного заказа, который еще можно редактировать
        const checkResp = await fetch(`${SB_URL}/rest/v1/orders?user_id=eq.${user.id}&status_id=lt.${STORE_SETTINGS.editLockStatus}&order=created_at.desc&limit=1`, {
            headers: { "apikey": SB_KEY, "Authorization": `Bearer ${SB_KEY}` }
        });
        const existingOrders = await checkResp.json();
        const activeOrder = existingOrders.length > 0 ? existingOrders[0] : null;

        let finalItems = {};
        let finalDeliveryType = deliveryMode;
        let finalAddress = address;

        if (activeOrder) {
            // СЛИЯНИЕ: Берем товары из старого заказа
            finalItems = activeOrder.items;
            finalDeliveryType = activeOrder.delivery_type; // Сохраняем тип доставки из первого заказа
            finalAddress = activeOrder.address || address;

            // Добавляем новые товары из текущей корзины
            for (let key in cart) {
                if (finalItems[key]) {
                    finalItems[key].qty += cart[key].qty;
                } else {
                    finalItems[key] = cart[key];
                }
            }
        } else {
            // Создаем новый набор товаров
            finalItems = cart;
        }

        // 2. ПЕРЕСЧЕТ ИТОГО: Считаем сумму заново по всем товарам
        let productsSum = 0;
        for (let key in finalItems) {
            const p = finalItems[key].product;
            productsSum += getRetailPrice(p.price_10, p.category) * finalItems[key].qty;
        }

        let finalSum = productsSum;
        let hasPaidDelivery = false;
        if (finalDeliveryType === 'delivery' && productsSum < STORE_SETTINGS.free_delivery_threshold) {
            finalSum += STORE_SETTINGS.deliveryCost;
            hasPaidDelivery = true;
        }

        const orderData = {
            user_id: user.id,
            user_name: user.first_name, // <--- ДОБАВЬ ЭТУ СТРОКУ
            items: finalItems,
            total_price: finalSum,
            delivery_type: finalDeliveryType,
            address: finalAddress || null
        };

        let response;
        if (activeOrder) {
            // ОБНОВЛЯЕМ существующий (PATCH)
            response = await fetch(`${SB_URL}/rest/v1/orders?id=eq.${activeOrder.id}`, {
                method: 'PATCH',
                headers: { 
                    "Content-Type": "application/json", 
                    "apikey": SB_KEY, 
                    "Authorization": `Bearer ${SB_KEY}` 
                },
                body: JSON.stringify(orderData)
            });
        } else {
            // СОЗДАЕМ новый (POST)
            orderData.status_id = 1;
            response = await fetch(`${SB_URL}/rest/v1/orders`, {
                method: 'POST',
                headers: { 
                    "Content-Type": "application/json", 
                    "apikey": SB_KEY, 
                    "Authorization": `Bearer ${SB_KEY}` 
                },
                body: JSON.stringify(orderData)
            });
        }

        if (!response.ok) throw new Error("Ошибка базы");

        // Очистка
        cart = {}; saveCart(); closeCheckout(); closeCart(); renderProducts();
        showToast(activeOrder ? "Заказ дополнен! ➕" : "Заказ оформлен! 🎉");
        toggleNotificationDot(true);
        loadActiveOrder();

    } catch (e) {
        console.error(e);
        alert("Ошибка связи с сервером");
        MainBtn.setText(originalBtnText);
    }
}


// --- КНОПКА НАВЕРХ И СКРОЛЛ ---
window.addEventListener('scroll', () => {
    const btn = document.getElementById('scrollTopBtn');
    // Если проскроллили больше 300 пикселей вниз — показываем кнопку
    if (window.scrollY > 300) {
        btn.classList.add('visible');
    } else {
        btn.classList.remove('visible');
    }
});

function scrollToTop() {
    // Плавный скролл на самый верх
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Даем легкую вибрацию, чтобы действие ощущалось физически
    if (tg?.HapticFeedback && tg.isVersionAtLeast && tg.isVersionAtLeast('6.1')) {
        tg.HapticFeedback.selectionChanged();
    }
}

// --- ФИЗИКА СВАЙПА В КОРЗИНЕ ---
let touchStartX = 0;
let currentDragItem = null;

function handleSwipeStart(e, element) {
    touchStartX = e.touches[0].clientX;
    currentDragItem = element;
    // Отключаем плавную анимацию возврата, чтобы карточка прилипла к пальцу
    element.style.transition = 'none'; 
}

function handleSwipeMove(e, element) {
    if (!currentDragItem) return;
    let deltaX = e.touches[0].clientX - touchStartX;
    
    // Разрешаем тянуть только влево, и ставим лимит натягивания в -100px
    if (deltaX > 0) deltaX = 0;
    if (deltaX < -100) deltaX = -100;
    
    element.style.transform = `translateX(${deltaX}px)`;
}

function handleSwipeEnd(e, element) {
    if (!currentDragItem) return;
    let deltaX = e.changedTouches[0].clientX - touchStartX;
    
    // Включаем обратно плавность
    element.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
    
    // Если смахнули влево больше чем на 45 пикселей — фиксируем открытую кнопку
    if (deltaX < -45) {
        element.style.transform = `translateX(-80px)`; // 80px — ширина красной кнопки
        if (tg?.HapticFeedback && tg.isVersionAtLeast && tg.isVersionAtLeast('6.1')) {
            tg.HapticFeedback.impactOccurred('light'); // Легкий щелчок
        }
    } else {
        // Иначе прячем кнопку обратно (эффект резинки)
        element.style.transform = `translateX(0px)`;
    }
    currentDragItem = null;
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.innerText = message;
    toast.classList.add('show');
    
    // Прячем через 3 секунды
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// --- ЭКРАН ПРОФИЛЯ ---
function openProfile() {
    appState = 'profile';
    document.getElementById('profileScreen').classList.add('active');
    MainBtn.hide(); 
    loadActiveOrder(); // <--- Подгружаем актуальный заказ при открытии
}

function closeProfile() {
    // 1. Убираем экран профиля в любом случае
    document.getElementById('profileScreen').classList.remove('active');

    // 2. Проверяем, открыт ли сейчас магазин
    if (!checkStoreStatus()) {
        // Если магазин закрыт — показываем экран-заглушку
        showScreen('closedScreen');
    } else {
        // Если открыт — возвращаемся в каталог (твой старый код)
        appState = 'catalog';
        // На всякий случай убедимся, что главный экран активен
        const mainScreen = document.getElementById('mainScreen');
        if (mainScreen) mainScreen.classList.add('active');
    }

    // 3. Скрываем кнопку "Назад" в Телеграм и обновляем главную кнопку
    if (tg) {
        tg.BackButton.hide();
    }
    updateMainButtonState();
}


// --- АВТОРИЗАЦИЯ И ПРОФИЛЬ ---
let currentUserData = null; // Здесь будем хранить данные юзера из базы

async function checkUser() {
    // Если мы тестируем с ПК вне Телеграма, прерываем функцию
    if (!user || !user.id) return; 

    try {
        // Ищем пользователя в таблице users по его Telegram ID
        // ВАЖНО: Если твоя колонка с ID называется иначе (например, tg_id или telegram_id), 
        // замени 'id=eq.' на 'tg_id=eq.'
        const response = await fetch(`${SB_URL}/rest/v1/users?id=eq.${user.id}&select=*`, {
            headers: { 
                "apikey": SB_KEY, 
                "Authorization": `Bearer ${SB_KEY}` 
            }
        });
        
        const data = await response.json();

        if (data && data.length > 0) {
            currentUserData = data[0]; // Запоминаем данные юзера
            
            // Если статус admin — прокачиваем профиль!
            if (currentUserData.status === 'admin') {
                // Меняем бейджик
                const badge = document.getElementById('profileStatusBadge');
                badge.innerText = 'Администратор';
                badge.style.background = 'rgba(255, 59, 48, 0.15)'; // Делаем красным для солидности
                badge.style.color = '#FF3B30';
                
                // Показываем скрытую кнопку Админ-панели
                document.getElementById('adminMenuBtn').style.display = 'flex';
            }
            
            // Если у юзера есть сохраненное имя в базе, можем использовать его
            // document.getElementById('profileName').innerText = currentUserData.name || user.first_name;
        } else {
            // Если пользователя нет в базе, можно в будущем отправлять запрос на его создание
            console.log("Новый пользователь, в базе пока не числится");
        }
    } catch (e) {
        console.error("Ошибка проверки пользователя:", e);
    }
}


// --- УВЕДОМЛЕНИЯ И ИНТЕРФЕЙС ---
function showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return; // Защита от ошибки, если HTML еще не добавлен
    
    toast.innerText = message;
    toast.classList.add('show');
    
    // Прячем через 3 секунды
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function toggleNotificationDot(show) {
    // Ищем аватарку и добавляем/убираем точку (создаем её на лету, если нет)
    const avatar = document.getElementById('userAvatar');
    let dot = document.getElementById('notifDot');
    
    if (show) {
        if (!dot) {
            dot = document.createElement('div');
            dot.id = 'notifDot';
            dot.className = 'notification-dot';
            dot.style.display = 'block';
            avatar.style.position = 'relative';
            avatar.appendChild(dot);
        } else {
            dot.style.display = 'block';
        }
    } else if (dot) {
        dot.style.display = 'none';
    }
}

// Глобальная переменная для хранения текущего заказа
let currentActiveOrder = null;

// --- ЗАГРУЗКА АКТИВНОГО ЗАКАЗА В ПРОФИЛЬ ---
async function loadActiveOrder() {
    if (!user || !user.id) return;

    try {
        const response = await fetch(`${SB_URL}/rest/v1/orders?user_id=eq.${user.id}&status_id=lt.5&order=created_at.desc&limit=1`, {
            headers: { "apikey": SB_KEY, "Authorization": `Bearer ${SB_KEY}` }
        });
        
        const orders = await response.json();
        const card = document.getElementById('activeOrderCard');

        if (orders && orders.length > 0) {
            currentActiveOrder = orders[0];
            const activeOrder = currentActiveOrder;
            const shortId = activeOrder.id.substring(0, 6).toUpperCase();
            
            // Динамическая проверка блокировки
            const canEdit = activeOrder.status_id < STORE_SETTINGS.editLockStatus;
            
            // Динамический поиск имени статуса
            const statusObj = ORDER_STATUSES.find(s => s.id === activeOrder.status_id);
            const statusText = statusObj ? statusObj.label : 'Обработка';

            let itemsHtml = ''; 
            let subtotal = 0;
            
            // 1. ДВУХУРОВНЕВАЯ ГРУППИРОВКА: Категория -> Линейка
            const groupedItems = {};
            for (const key in activeOrder.items) {
                const item = activeOrder.items[key];
                const p = item.product;
                const price = getRetailPrice(p.price_10, p.category);
                const itemTotal = price * item.qty;
                subtotal += itemTotal;
                
                const categoryName = p.category || "Другое";
                
                let groupName = (p.series && p.series !== "—" && p.series !== "Н/Д") ? p.series : (p.manufacturer !== "Расходники" ? p.manufacturer : "Расходники");
                groupName = groupName.replace(/new\s+/i, '').trim();
                
                // Создаем структуру, если её еще нет
                if (!groupedItems[categoryName]) groupedItems[categoryName] = {};
                if (!groupedItems[categoryName][groupName]) groupedItems[categoryName][groupName] = [];
                
                // Закидываем товар
                groupedItems[categoryName][groupName].push({ flavor: p.flavor, qty: item.qty, total: itemTotal });
            }

            // 2. Генерируем HTML (Сначала Категория, потом Линейки)
            for (const categoryName in groupedItems) {
                // Выводим заголовок категории (например: ЖИДКОСТИ)
                itemsHtml += `<div style="font-weight: 900; color: #D97736; margin-top: 15px; margin-bottom: 8px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid rgba(217, 119, 54, 0.2); padding-bottom: 4px;">${categoryName}</div>`;
                
                const groups = groupedItems[categoryName];
                for (const groupName in groups) {
                    // Выводим название линейки
                    itemsHtml += `<div style="text-align: left; font-weight: bold; color: #5C3A21; margin-top: 8px; margin-bottom: 4px; font-size: 13px;">${groupName}:</div>`;
                    
                    // Перечисляем вкусы
                    groups[groupName].forEach(i => {
                        itemsHtml += `
                            <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px; padding-left: 10px; color: #5C3A21;">
                                <span style="flex: 1; text-align: left;">— ${i.flavor} (${i.qty} шт.)</span>
                                <span style="font-weight: bold; margin-left: 10px; text-align: right;">${i.total} р.</span>
                            </div>`;
                    });
                }
            }

            // 3. Строка Доставки (в самом низу чека)
            if (activeOrder.delivery_type === 'delivery') {
                const isFree = subtotal >= STORE_SETTINGS.free_delivery_threshold;
                const deliveryPriceText = isFree ? 'Бесплатно' : `${STORE_SETTINGS.deliveryCost} р.`;
                
                itemsHtml += `
                    <div style="display: flex; justify-content: space-between; margin-top: 15px; border-top: 1px dashed rgba(232, 195, 150, 0.4); padding-top: 10px; font-size: 13px; color: #5C3A21;">
                        <span style="flex: 1; text-align: left; font-weight: bold;">Доставка</span>
                        <span style="font-weight: bold; margin-left: 10px; text-align: right; ${isFree ? 'color: #D97736;' : ''}">${deliveryPriceText}</span>
                    </div>`;
            }

            const progressPercent = (activeOrder.status_id / 4) * 100;

            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                    <div style="text-align: left;">
                        <div style="font-weight: 900; color: #5C3A21; font-size: 16px;">Заказ #${shortId}</div>
                        <div style="color: #8B5E3C; font-size: 14px; margin-bottom: 4px;">Итого: ${activeOrder.total_price} р.</div>
                        
                        <div style="color: #D97736; font-size: 13px; font-weight: bold; cursor: pointer; display: flex; align-items: center;" onclick="toggleOrderDetails()">
                            <span id="expandBtnText">Развернуть</span>
                            <svg id="expandArrow" class="expand-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="6 9 12 15 18 9"></polyline>
                            </svg>
                        </div>
                    </div>
                    <div style="background: rgba(217, 119, 54, 0.1); color: #D97736; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: bold;">
                        ${statusText}
                    </div>
                </div>

                <div style="height: 6px; background: rgba(232, 195, 150, 0.3); border-radius: 3px; width: 100%; overflow: hidden; margin-bottom: 5px;">
                    <div style="height: 100%; background: #D97736; width: ${progressPercent}%; border-radius: 3px; transition: width 0.5s ease;"></div>
                </div>

                <div id="orderDetailsGrid" class="order-details-grid">
                    <div class="order-details-inner" style="text-align: left;">
                        <div style="border-top: 1px solid rgba(232, 195, 150, 0.2); margin-top: 15px; padding-top: 5px;">
                            <div style="margin-bottom: 20px;">${itemsHtml}</div>
                            
                            ${canEdit ? `
                                <div style="display: flex; gap: 10px;">
                                    <button class="btn-main small-btn" style="flex: 1; padding: 12px 0; font-size: 13px;" onclick="editOrder()">Редактировать</button>
                                    <button class="btn-main small-btn" style="flex: 1; padding: 12px 0; font-size: 13px; background: #FF3B30; border-color: rgba(255, 255, 255, 0.3); box-shadow: 0 8px 24px rgba(255, 59, 48, 0.25);" onclick="deleteOrder()">Удалить</button>
                                </div>
                            ` : `<div style="text-align: center; color: #8B5E3C; font-size: 12px; font-style: italic;">Заказ уже в работе, редактирование невозможно</div>`}
                        </div>
                    </div>
                </div>
            `;
            
            toggleNotificationDot(false);
        } else {
            currentActiveOrder = null;
            card.innerHTML = `<div class="no-order-text">Сейчас у тебя нет активных заказов</div><button class="btn-main small-btn" onclick="closeProfile()">Сделать заказ +</button>`;
        }
    } catch (e) { 
        console.error("Ошибка загрузки заказа:", e); 
    }
}

// --- ФУНКЦИИ УПРАВЛЕНИЯ ЗАКАЗОМ ---

function toggleOrderDetails() {
    const grid = document.getElementById('orderDetailsGrid');
    const btnText = document.getElementById('expandBtnText');
    const arrow = document.getElementById('expandArrow');

    // Переключаем классы
    grid.classList.toggle('open');
    arrow.classList.toggle('open');

    // Меняем текст
    if (grid.classList.contains('open')) {
        btnText.innerText = 'Свернуть';
    } else {
        btnText.innerText = 'Развернуть';
    }
}

async function deleteOrder() {
    if (!currentActiveOrder) return;
    // Защита от случайного нажатия (очень важно для мобилок)
    if (!confirm("Точно хочешь отменить этот заказ?")) return; 

    try {
        await fetch(`${SB_URL}/rest/v1/orders?id=eq.${currentActiveOrder.id}`, {
            method: 'DELETE',
            headers: { "apikey": SB_KEY, "Authorization": `Bearer ${SB_KEY}` }
        });
        showToast("Заказ отменен");
        loadActiveOrder(); // Перезагрузит блок и покажет заглушку
    } catch (e) {
        console.error("Ошибка удаления:", e);
        alert("Не удалось удалить заказ.");
    }
}

async function editOrder() {
    if (!currentActiveOrder) return;

    try {
        // 1. Возвращаем товары в глобальную корзину
        cart = currentActiveOrder.items;
        saveCart();

        // 2. Удаляем старый заказ из базы данных
        await fetch(`${SB_URL}/rest/v1/orders?id=eq.${currentActiveOrder.id}`, {
            method: 'DELETE',
            headers: { "apikey": SB_KEY, "Authorization": `Bearer ${SB_KEY}` }
        });

        showToast("Заказ возвращен в корзину");
        
        // 3. Закрываем профиль и открываем корзину, чтобы продолжить покупки
        closeProfile();
        openCart();
        
        // Обновляем состояние профиля в фоне
        loadActiveOrder(); 
    } catch (e) {
        console.error("Ошибка редактирования:", e);
    }
}

loadProducts(); 
updateRange();
checkUser(); // <--- Добавили запуск проверки пользователя

// ==========================================
// --- АДМИН-ПАНЕЛЬ (МОДУЛЬ ЗАКАЗОВ) ---
// ==========================================

function openAdminPanel() {
    appState = 'admin';
    document.getElementById('adminScreen').classList.add('active');
    switchAdminTab('orders'); // Открываем вкладку заказов при входе
}

function closeAdminPanel() {
    appState = 'profile';
    document.getElementById('adminScreen').classList.remove('active');
}

function switchAdminTab(tab) {
    document.querySelectorAll('#adminScreen .tab').forEach(t => t.classList.remove('active'));
    document.getElementById('adminContent').innerHTML = '<div class="loader"></div>';
    
    if (tab === 'orders') {
        document.getElementById('adminTabOrders').classList.add('active');
        loadAdminOrders();
    } else if (tab === 'catalog') {
        document.getElementById('adminTabCatalog').classList.add('active');
        document.getElementById('adminContent').innerHTML = '<div style="text-align:center; padding:40px; color:#8B5E3C;">Раздел товаров в разработке 🛠</div>';
    } else if (tab === 'users') {
        // НОВЫЙ БЛОК ДЛЯ ЮЗЕРОВ
        document.getElementById('adminTabUsers').classList.add('active');
        loadAdminUsers();
    } else if (tab === 'settings') {
        document.getElementById('adminTabSettings').classList.add('active');
        renderAdminSettings(); 
    }
}

// --- БЛОК УПРАВЛЕНИЯ ПОЛЬЗОВАТЕЛЯМИ ---

async function loadAdminUsers() {
    try {
        const response = await fetch(`${SB_URL}/rest/v1/users?order=created_at.desc`, {
            headers: { "apikey": SB_KEY, "Authorization": `Bearer ${SB_KEY}` }
        });
        
        const data = await response.json();
        
        // Защита от ошибок Supabase (например, проблема с доступами)
        if (data.error) {
            console.error("Supabase Error:", data.error);
            document.getElementById('adminContent').innerHTML = `<div style="text-align:center; padding: 20px; color: red;">Ошибка БД: ${data.error.message}</div>`;
            return;
        }
        
        // Защита от случаев, если вернулся не массив
        if (!Array.isArray(data)) {
            document.getElementById('adminContent').innerHTML = `<div style="text-align:center; padding: 20px; color: red;">Данные не являются списком</div>`;
            return;
        }

        renderAdminUsers(data);
    } catch (e) {
        console.error("Ошибка загрузки пользователей:", e);
        document.getElementById('adminContent').innerHTML = '<div style="text-align:center; padding: 20px; color: red;">Ошибка сети (см. F12)</div>';
    }
}

function renderAdminUsers(users) {
    const container = document.getElementById('adminContent');
    if (!users || users.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding: 40px 0; color:#8B5E3C; font-weight:bold;">База пользователей пуста</div>`;
        return;
    }

    let html = '<div style="padding-bottom: 100px;">';
    
    users.forEach(u => {
        // Цвета для разных статусов (левая полоска карточки)
        const statusColors = {
            'pending': '#f39c12',  // Оранжевый
            'approved': '#2ecc71', // Зеленый
            'blocked': '#FF3B30',  // Красный
            'admin': '#9b59b6'     // Фиолетовый
        };
        const color = statusColors[u.status] || '#8B5E3C';

        html += `
        <div class="admin-order-card" style="border-left: 4px solid ${color}; position: relative;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:10px;">
                <div>
                    <div style="font-weight:900; font-size:15px; color:#5C3A21;">${u.full_name}</div>
                    <div style="font-size:12px; color:#8B5E3C; margin-top:4px;">
                        <a href="tg://user?id=${u.id}" style="color:#3498db; text-decoration:none;">@${u.username}</a> | ID: ${u.id}
                    </div>
                    <div style="font-size:12px; color:#8B5E3C; margin-top:2px;"><b>Откуда:</b> ${u.source || 'Не указано'}</div>
                    <div style="font-size:11px; color:#aab7b8; margin-top:2px;">Зарег: ${new Date(u.created_at).toLocaleDateString('ru-RU')}</div>
                </div>
                
                <div style="cursor: pointer; font-size: 18px; padding: 5px; opacity: 0.8;" 
                     onclick="deleteUser(${u.id}, '${u.full_name.replace(/'/g, "\\'")}')" 
                     title="Удалить пользователя">🗑️</div>
            </div>
            
            <div style="margin-top: 15px; border-top: 1px dashed rgba(232, 195, 150, 0.3); padding-top: 15px;">
                <label style="font-size: 11px; font-weight: bold; color: #8B5E3C; margin-bottom: 5px; display: block;">СТАТУС ДОСТУПА:</label>
                <select class="address-input" style="margin:0; padding:10px; font-size:13px; font-weight:bold; color:${color}; border-color:${color}; outline:none;" onchange="changeUserStatus(${u.id}, this.value)">
                    <option value="pending" ${u.status === 'pending' ? 'selected' : ''}>⏳ Ожидает апрува</option>
                    <option value="approved" ${u.status === 'approved' ? 'selected' : ''}>✅ Принят (Покупатель)</option>
                    <option value="admin" ${u.status === 'admin' ? 'selected' : ''}>👑 Администратор</option>
                    <option value="blocked" ${u.status === 'blocked' ? 'selected' : ''}>🚫 Заблокирован</option>
                </select>
            </div>
        </div>`;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

async function changeUserStatus(userId, newStatus) {
    try {
        await fetch(`${SB_URL}/rest/v1/users?id=eq.${userId}`, {
            method: 'PATCH',
            headers: { "Content-Type": "application/json", "apikey": SB_KEY, "Authorization": `Bearer ${SB_KEY}` },
            body: JSON.stringify({ status: newStatus })
        });
        showToast("Статус пользователя изменен! 👤");
        // Обновлять весь список не обязательно, цвет select'а изменится при следующем заходе, 
        // но можно и вызвать loadAdminUsers() для красоты
    } catch (e) {
        console.error("Ошибка смены статуса:", e);
        alert("Не удалось обновить статус в базе.");
    }
}

async function deleteUser(userId, userName) {
    // Спрашиваем подтверждение, так как действие необратимо
    if (!confirm(`🚨 Точно удалить пользователя "${userName}" навсегда?\n\nВместе с ним могут удалиться и все его заказы.`)) {
        return;
    }

    try {
        const response = await fetch(`${SB_URL}/rest/v1/users?id=eq.${userId}`, {
            method: 'DELETE',
            headers: { 
                "apikey": SB_KEY, 
                "Authorization": `Bearer ${SB_KEY}` 
            }
        });

        if (response.ok) {
            showToast("Пользователь удален 🗑️");
            loadAdminUsers(); // Сразу перерисовываем список, чтобы он исчез с экрана
        } else {
            const err = await response.json();
            alert("Ошибка удаления в базе: " + (err.message || "Неизвестная ошибка"));
        }
    } catch (e) {
        console.error("Ошибка при удалении:", e);
        alert("Не удалось отправить запрос на удаление.");
    }
}

async function loadAdminOrders() {
    try {
        // Грузим все заказы со статусом меньше 5 (5 = Завершен/В архиве)
        const response = await fetch(`${SB_URL}/rest/v1/orders?status_id=lt.5&order=created_at.desc`, {
            headers: { "apikey": SB_KEY, "Authorization": `Bearer ${SB_KEY}` }
        });
        const orders = await response.json();
        renderAdminOrders(orders);
    } catch (e) {
        console.error("Ошибка загрузки заказов админа:", e);
        document.getElementById('adminContent').innerHTML = '<div style="text-align:center; padding: 20px; color: red;">Ошибка сети</div>';
    }
}

function renderAdminOrders(orders) {
    const container = document.getElementById('adminContent');
    if (!orders || orders.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding: 40px 0; color:#8B5E3C; font-weight:bold;">Нет активных заказов 🎉</div>`;
        return;
    }

    // 1. СЧИТАЕМ СТАТИСТИКУ (по активным заказам)
    let statsSum = 0;
    let statsItemsCount = 0;
    let statsOrdersCount = orders.length;

    orders.forEach(o => {
        statsSum += o.total_price;
        for (let k in o.items) statsItemsCount += o.items[k].qty;
    });

    // Формируем блок статистики
    let html = `
    <div class="admin-stats-grid">
        <div class="admin-stat-card">
            <div class="admin-stat-label">Сумма</div>
            <div class="admin-stat-value">${statsSum}р</div>
        </div>
        <div class="admin-stat-card">
            <div class="admin-stat-label">Позиций</div>
            <div class="admin-stat-value">${statsItemsCount}шт</div>
        </div>
        <div class="admin-stat-card">
            <div class="admin-stat-label">Заказов</div>
            <div class="admin-stat-value">${statsOrdersCount}</div>
        </div>
    </div>
    <div style="padding-bottom: 200px;">`;

    // 2. РЕНДЕРИМ КАРТОЧКИ ЗАКАЗОВ
    orders.forEach(o => {
        const shortId = o.id.substring(0, 6).toUpperCase();
        const date = new Date(o.created_at).toLocaleString('ru-RU', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'});
        
        let itemsCount = 0;
        const groupedItems = {};

        // Группировка товаров для админа (Категория -> Линейка)
        for (let k in o.items) {
            const item = o.items[k];
            const p = item.product;
            itemsCount += item.qty;

            const cat = p.category || "Другое";
            let series = (p.series && p.series !== "—" && p.series !== "Н/Д") ? p.series : (p.manufacturer !== "Расходники" ? p.manufacturer : "Расходники");
            series = series.replace(/new\s+/i, '').trim();

            if (!groupedItems[cat]) groupedItems[cat] = {};
            if (!groupedItems[cat][series]) groupedItems[cat][series] = [];
            groupedItems[cat][series].push(item);
        }

        // Собираем HTML состава (группировка как в профиле юзера)
        let itemsHtml = '';
        for (const cat in groupedItems) {
            itemsHtml += `<div class="admin-item-category-title">${cat}</div>`;
            for (const series in groupedItems[cat]) {
                itemsHtml += `<div class="admin-item-series-title">${series}:</div>`;
                groupedItems[cat][series].forEach(item => {
                    const price = getRetailPrice(item.product.price_10, item.product.category);
                    itemsHtml += `
                        <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 13px; padding-left: 10px; color: #5C3A21;">
                            <span style="flex: 1; text-align: left;">— ${item.product.flavor} (${item.qty} шт.)</span>
                            <span style="font-weight: bold;">${price * item.qty} р.</span>
                        </div>`;
                });
            }
        }

        // Находим текущий статус из динамического массива ORDER_STATUSES
        const currentStatus = ORDER_STATUSES.find(s => s.id === o.status_id) || { label: 'Неизвестно' };
        
        // Цветовая схема (можно расширить или вынести в базу)
        const colors = ['#D97736', '#f39c12', '#3498db', '#2ecc71', '#95a5a6'];
        const statusColor = colors[(o.status_id - 1) % colors.length] || '#E8C396';

        // Генерируем опции выпадающего меню динамически
        let statusOptionsHtml = '';
        ORDER_STATUSES.forEach(st => {
            if (st.is_active || st.id === o.status_id) {
                statusOptionsHtml += `<div class="admin-status-option" onclick="changeOrderStatus('${o.id}', ${st.id})">${st.label}</div>`;
            }
        });

        const buyerName = o.user_name || `Юзер #${o.user_id.toString().substring(0,4)}`;

        html += `
        <div class="admin-order-card">
            <div class="admin-order-header">
                <div class="admin-order-id">#${shortId}</div>
                <div class="admin-order-date">${date}</div>
            </div>
            <div class="admin-order-body">
                <b>Итого:</b> <span style="color: #D97736; font-weight: 900;">${itemsCount} товаров — ${o.total_price} р.</span><br>
                <b>Доставка:</b> ${o.delivery_type === 'delivery' ? '🚗 Курьер (' + (o.address || 'адрес не указан') + ')' : '📍 Самовывоз'}<br>
                <b>Покупатель:</b> <a href="tg://user?id=${o.user_id}" style="color: #3498db; text-decoration: none; font-weight: bold; border-bottom: 1px dashed #3498db;">${buyerName} 💬</a>
            </div>
            
            <div style="color: #D97736; font-size: 13px; font-weight: bold; cursor: pointer; display: flex; align-items: center; margin-bottom: 15px;" onclick="toggleAdminOrderItems('${o.id}')">
                <span id="adminExpandText-${o.id}">Развернуть состав</span>
                <svg id="adminExpandArrow-${o.id}" class="expand-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
            </div>
            
            <div id="adminOrderItems-${o.id}" class="admin-order-items-grid">
                <div class="admin-order-items-inner">
                    <div style="background: rgba(232, 195, 150, 0.1); padding: 12px; border-radius: 12px; border: 1px solid rgba(232,195,150,0.2);">
                        ${itemsHtml}
                    </div>
                </div>
            </div>
            
            <div class="admin-status-wrapper">
                <div class="admin-status-btn" style="border-color: ${statusColor}; color: ${statusColor};" onclick="toggleAdminStatusMenu(event, '${o.id}')">
                    ${currentStatus.label} <span>▼</span>
                </div>
                <div class="admin-status-menu" id="adminStatusMenu-${o.id}">
                    ${statusOptionsHtml}
                </div>
            </div>
        </div>`;
    });
    html += '</div>';
    container.innerHTML = html;
}

// --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ АДМИНКИ ---

function toggleAdminOrderItems(orderId) {
    const grid = document.getElementById(`adminOrderItems-${orderId}`);
    const text = document.getElementById(`adminExpandText-${orderId}`);
    const arrow = document.getElementById(`adminExpandArrow-${orderId}`);
    
    grid.classList.toggle('open');
    arrow.classList.toggle('open');
    
    if (grid.classList.contains('open')) {
        text.innerText = 'Свернуть состав';
    } else {
        // Чтобы вернуть кол-во штук, мы просто пишем Развернуть состав
        text.innerText = 'Развернуть состав';
    }
}

function toggleAdminStatusMenu(e, orderId) {
    e.stopPropagation();
    // Закрываем все другие открытые менюшки
    document.querySelectorAll('.admin-status-menu').forEach(menu => {
        if(menu.id !== `adminStatusMenu-${orderId}`) menu.classList.remove('active');
    });
    // Переключаем текущую
    document.getElementById(`adminStatusMenu-${orderId}`).classList.toggle('active');
}

// Закрываем меню статусов при клике в любое другое место
document.addEventListener('click', () => { 
    document.querySelectorAll('.admin-status-menu').forEach(m => m.classList.remove('active')); 
});

async function changeOrderStatus(orderId, newStatus) {
    // Мы убрали confirm(), чтобы админ мог менять статус в 2 клика без надоедливых окон
    try {
        await fetch(`${SB_URL}/rest/v1/orders?id=eq.${orderId}`, {
            method: 'PATCH',
            headers: { "Content-Type": "application/json", "apikey": SB_KEY, "Authorization": `Bearer ${SB_KEY}` },
            body: JSON.stringify({ status_id: parseInt(newStatus) })
        });
        
        showToast("Статус обновлен!");
        loadAdminOrders(); // Перезагружаем список
        
        if (tg?.HapticFeedback && tg.isVersionAtLeast && tg.isVersionAtLeast('6.1')) {
            tg.HapticFeedback.notificationOccurred('success');
        }
    } catch (e) {
        alert("Ошибка при обновлении статуса базы.");
    }
}


// --- РАЗДЕЛ НАСТРОЕК В АДМИНКЕ ---

function renderAdminSettings() {
    const container = document.getElementById('adminContent');
    
    // Форматируем для HTML (с учетом часового пояса)
    const formatForInput = (isoString) => {
        if (!isoString) return '';
        const d = new Date(isoString);
        return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0,16);
    };

    let catMarginsHtml = '';
    for (let cat in STORE_SETTINGS.categoryMargins) {
        catMarginsHtml += `
            <div style="margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
                <label style="font-size: 13px; font-weight: bold;">${cat}:</label>
                <input type="number" step="0.1" class="address-input" style="width: 80px; padding: 8px; margin: 0;" 
                       id="set-margin-${cat}" value="${STORE_SETTINGS.categoryMargins[cat]}">
            </div>`;
    }

    // Генерируем список статусов для настройки
    let statusesHtml = '';
    ORDER_STATUSES.forEach(st => {
        statusesHtml += `
            <div style="display: flex; gap: 10px; margin-bottom: 10px; align-items: center;">
                <span style="font-size: 12px; font-weight: bold; width: 20px;">${st.id}.</span>
                <input type="text" class="address-input" style="padding: 10px; margin: 0; flex-grow: 1;" id="status-label-${st.id}" value="${st.label}">
                <label style="display: flex; flex-direction: column; align-items: center; font-size: 10px; gap: 4px;">
                    Активен
                    <input type="checkbox" id="status-active-${st.id}" ${st.is_active ? 'checked' : ''} style="width: 16px; height: 16px; accent-color: #D97736;">
                </label>
            </div>
        `;
    });

    container.innerHTML = `
        <div style="padding-bottom: 100px;">
            <div class="checkout-info" style="margin-bottom: 20px; border-left: 4px solid #f39c12;">
                <h4 style="margin-top:0; border-bottom: 1px solid #eee; padding-bottom: 10px;">⏰ Расписание (Дропы)</h4>
                <p style="font-size: 11px; opacity: 0.7; margin-bottom: 10px;">Если даты не заданы, магазин закрыт. Время местное.</p>
                
                <label style="display:block; font-size: 12px; font-weight: bold; margin-bottom: 5px;">Открытие:</label>
                <input type="datetime-local" id="set-open-date" class="address-input" value="${formatForInput(STORE_SETTINGS.openDate)}">
                
                <label style="display:block; font-size: 12px; font-weight: bold; margin-bottom: 5px; margin-top: 10px;">Закрытие:</label>
                <input type="datetime-local" id="set-close-date" class="address-input" value="${formatForInput(STORE_SETTINGS.closeDate)}">
            </div>

            <div class="checkout-info" style="margin-bottom: 20px;">
                <h4 style="margin-top:0; border-bottom: 1px solid #eee; padding-bottom: 10px;">Статусы заказов</h4>
                <p style="font-size: 11px; opacity: 0.7; margin-bottom: 15px;">Названия статусов и их видимость в меню</p>
                ${statusesHtml}
                
                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px dashed #E8C396;">
                    <label style="display:block; font-size: 12px; font-weight: bold; margin-bottom: 5px; color: #FF3B30;">
                        🔒 Блокировать изменение заказа со статуса (ID):
                    </label>
                    <input type="number" id="set-lock-status" class="address-input" value="${STORE_SETTINGS.editLockStatus}">
                </div>
            </div>

            <div class="checkout-info" style="margin-bottom: 20px;">
                <h4 style="margin-top:0; border-bottom: 1px solid #eee; padding-bottom: 10px;">Доставка</h4>
                <label style="display:block; font-size: 12px; font-weight: bold; margin-bottom: 5px;">Бесплатно от (руб):</label>
                <input type="number" id="set-free-limit" class="address-input" value="${STORE_SETTINGS.freeDeliveryThreshold}">
                <label style="display:block; font-size: 12px; font-weight: bold; margin-bottom: 5px; margin-top: 10px;">Стоимость доставки:</label>
                <input type="number" id="set-delivery-cost" class="address-input" value="${STORE_SETTINGS.deliveryCost}">
            </div>

            <div class="checkout-info" style="margin-bottom: 20px;">
                <h4 style="margin-top:0; border-bottom: 1px solid #eee; padding-bottom: 10px;">Наценки (Коэффициенты)</h4>
                <label style="display:block; font-size: 12px; font-weight: bold; margin-bottom: 5px;">Общая (default):</label>
                <input type="number" step="0.1" id="set-default-margin" class="address-input" value="${STORE_SETTINGS.defaultMargin}">
                <div style="border-top: 1px solid #eee; margin: 15px 0; padding-top: 15px;">
                    ${catMarginsHtml}
                </div>
            </div>

            <button class="btn-main" onclick="saveAdminSettings()">Сохранить всё 💾</button>
        </div>
    `;
}

async function saveAdminSettings() {
    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = 'Сохранение...';

    // 1. Собираем Настройки
    let newCatMargins = {};
    for (let cat in STORE_SETTINGS.categoryMargins) {
        newCatMargins[cat] = parseFloat(document.getElementById(`set-margin-${cat}`).value);
    }

    STORE_SETTINGS.freeDeliveryThreshold = parseInt(document.getElementById('set-free-limit').value);
    STORE_SETTINGS.deliveryCost = parseInt(document.getElementById('set-delivery-cost').value);
    STORE_SETTINGS.defaultMargin = parseFloat(document.getElementById('set-default-margin').value);
    STORE_SETTINGS.categoryMargins = newCatMargins;
    STORE_SETTINGS.editLockStatus = parseInt(document.getElementById('set-lock-status').value);

    const newConfigDB = {
        free_delivery_threshold: STORE_SETTINGS.freeDeliveryThreshold,
        delivery_cost: STORE_SETTINGS.deliveryCost,
        default_margin: STORE_SETTINGS.defaultMargin,
        category_margins: STORE_SETTINGS.categoryMargins,
        edit_lock_status: STORE_SETTINGS.editLockStatus
    };

    try {
        // Сохраняем конфиг
        await fetch(`${SB_URL}/rest/v1/config?id=eq.1`, {
            method: 'PATCH',
            headers: { "Content-Type": "application/json", "apikey": SB_KEY, "Authorization": `Bearer ${SB_KEY}` },
            body: JSON.stringify(newConfigDB)
        });

        // 2. Сохраняем Статусы (отправляем каждый измененный статус в базу)
        for (let st of ORDER_STATUSES) {
            const newLabel = document.getElementById(`status-label-${st.id}`).value;
            const newActive = document.getElementById(`status-active-${st.id}`).checked;
            
            if (st.label !== newLabel || st.is_active !== newActive) {
                await fetch(`${SB_URL}/rest/v1/order_statuses?id=eq.${st.id}`, {
                    method: 'PATCH',
                    headers: { "Content-Type": "application/json", "apikey": SB_KEY, "Authorization": `Bearer ${SB_KEY}` },
                    body: JSON.stringify({ label: newLabel, is_active: newActive })
                });
                // Обновляем локально
                st.label = newLabel;
                st.is_active = newActive;
            }
        }

        showToast("Настройки обновлены! ✨");
        renderProducts(); // Перерисовываем каталог на случай смены цен
    } catch (e) {
        console.error(e);
        alert("Не удалось сохранить настройки в базу.");
    } finally {
        btn.innerText = originalText;
    }
}

