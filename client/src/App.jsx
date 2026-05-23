import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { 
    AppstoreOutlined, 
    UnorderedListOutlined, 
    PictureOutlined, 
    ShoppingCartOutlined,
    PlusOutlined,
    MinusOutlined,
    DownOutlined,
    UpOutlined,
    SearchOutlined,
    FilterOutlined,
    UserOutlined,
    ClockCircleOutlined,
    StopOutlined,
    SwapOutlined,
    CloseOutlined,
    CheckOutlined
} from '@ant-design/icons';

import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';

// Импортируем внешние экраны оформления заказа и профиля
import Checkout from './components/Checkout.jsx';
import Profile from './components/Profile.jsx';
import AdminPanel from './components/AdminPanel.jsx';
import Registration from './components/Registration.jsx';

export default function App() {
    // === СОСТОЯНИЯ АВТОРИЗАЦИИ И НАВИГАЦИИ ===
    const [authStatus, setAuthStatus] = useState('loading'); 
    const [currentScreen, setCurrentScreen] = useState('catalog'); // 'catalog', 'checkout', 'profile'
    
    // === ДАННЫЕ ===
    const [groupedSeries, setGroupedSeries] = useState([]); 
    const [originalProducts, setOriginalProducts] = useState([]); 
    const [categories, setCategories] = useState(['Все']); 
    
    // Границы для ползунков (ЦЕНА и КРЕПОСТЬ)
    const [globalMinMaxPrice, setGlobalMinMaxPrice] = useState([0, 10000]); 
    const [globalMinMaxStrength, setGlobalMinMaxStrength] = useState([0, 100]); 
    
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // === СОСТОЯНИЯ ИНТЕРФЕЙСА ===
    const [viewMode, setViewMode] = useState('grid');
    const [cart, setCart] = useState({});
    const [expandedSeries, setExpandedSeries] = useState({}); 
    
    const [activeCategory, setActiveCategory] = useState('Все'); 
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearchActive, setIsSearchActive] = useState(false);
    
    const [sortOrder, setSortOrder] = useState('alpha_asc'); 
    const [showSortModal, setShowSortModal] = useState(false);
    
    // Текущие значения ползунков в фильтре
    const [priceFilter, setPriceFilter] = useState([0, 10000]); 
    const [strengthFilter, setStrengthFilter] = useState([0, 100]);
    const [showFilterModal, setShowFilterModal] = useState(false);

    const user = window.Telegram?.WebApp?.initDataUnsafe?.user;

    // === КОМПОНЕНТ КНОПОК КОРЗИНЫ ===
    const CartControls = ({ productId }) => {
        const qty = cart[productId] || 0;
        if (qty === 0) {
            return (
                <button 
                    onClick={() => addToCart(productId)} 
                    style={{ backgroundColor: '#2ecc71', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '20px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px', boxShadow: '0 2px 6px rgba(46, 204, 113, 0.3)' }}
                >
                    Добавить
                </button>
            );
        }
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f0f2f5', borderRadius: '20px', padding: '4px', minWidth: '90px' }}>
                <button onClick={() => removeFromCart(productId)} style={{ width: '28px', height: '28px', borderRadius: '50%', border: 'none', backgroundColor: 'white', color: '#2ecc71', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}><MinusOutlined style={{ fontSize: '12px' }} /></button>
                <span style={{ fontWeight: 'bold', color: '#2c3e50', fontSize: '14px', margin: '0 8px' }}>{qty}</span>
                <button onClick={() => addToCart(productId)} style={{ width: '28px', height: '28px', borderRadius: '50%', border: 'none', backgroundColor: '#2ecc71', color: 'white', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}><PlusOutlined style={{ fontSize: '12px' }} /></button>
            </div>
        );
    };

    useEffect(() => {
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.ready();
            window.Telegram.WebApp.expand();
        }
        checkUserAccess();
    }, []);

    const checkUserAccess = async () => {
        const effectiveUserId = user?.id || 999888777;
        try {
            const { data, error } = await supabase.from('users').select('status').eq('id', effectiveUserId).single();
            
            // Если ошибка PGRST116 (строка не найдена) — это абсолютно новый юзер!
            if (error && error.code === 'PGRST116') {
                return setAuthStatus('new_user');
            }
            
            // Если какая-то другая ошибка сети, уводим в pending от греха подальше
            if (error || !data) return setAuthStatus('pending');
            
            if (['approved', 'admin', 'developer'].includes(data.status)) {
                setAuthStatus(data.status); 
                fetchCatalogData();
            } else if (data.status === 'pending') {
                setAuthStatus('pending');
            } else {
                setAuthStatus('blocked');
            }
        } catch (err) {
            setAuthStatus('blocked');
        }
    };

    const calculatePricingWithConfig = (product, currentConfig) => {
        let rawCost = product.price_10;
        if (typeof rawCost === 'string') rawCost = rawCost.replace(/[^0-9.,]/g, '').replace(',', '.');
        const costPrice = parseFloat(rawCost) || 0;
        if (!currentConfig) return 0;
        const margin = (currentConfig.category_margins && currentConfig.category_margins[product.category]) || currentConfig.default_margin || 1.0;
        return Math.round(costPrice * margin);
    };

    const parseStrength = (str) => {
        if (!str || str === '—') return null;
        const match = str.match(/\d+(\.\d+)?/);
        return match ? parseFloat(match[0]) : null;
    };

    const fetchCatalogData = async () => {
        setLoading(true);
        try {
            const [productsRes, imagesRes, configRes] = await Promise.all([
                supabase.from('products').select('*').eq('availability', 'есть'),
                supabase.from('series_images').select('*'),
                supabase.from('config').select('*').eq('id', 1).single()
            ]);

            if (productsRes.error) throw productsRes.error;
            setConfig(configRes.data);
            setOriginalProducts(productsRes.data || []);

            const uniqueCategories = ['Все', ...new Set(productsRes.data.map(p => p.category).filter(Boolean))];
            setCategories(uniqueCategories);
            
            let minP = Infinity, maxP = -Infinity;
            let minS = Infinity, maxS = -Infinity;

            const groups = {};
            productsRes.data.forEach(product => {
                const price = calculatePricingWithConfig(product, configRes.data);
                if (price < minP) minP = price;
                if (price > maxP) maxP = price;

                const strNum = parseStrength(product.strength);
                if (strNum !== null) {
                    if (strNum < minS) minS = strNum;
                    if (strNum > maxS) maxS = strNum;
                }

                const safeSeries = product.series === '—' ? 'default_series' : product.series;
                const key = `${product.manufacturer}_${safeSeries}`;
                
                if (!groups[key]) {
                    const imageRecord = imagesRes.data.find(img => img.manufacturer === product.manufacturer && img.series === product.series);
                    groups[key] = {
                        id: key,
                        manufacturer: product.manufacturer,
                        series: product.series,
                        imageUrl: imageRecord ? imageRecord.image_url : null,
                        category: product.category,
                        strength: product.strength, 
                        flavors: []
                    };
                }
                groups[key].flavors.push(product);
            });

            if (minP === Infinity) minP = 0;
            if (maxP === -Infinity) maxP = 5000;
            if (minS === Infinity) minS = 0;
            if (maxS === -Infinity) maxS = 100;

            setGlobalMinMaxPrice([minP, maxP]);
            setPriceFilter([minP, maxP]);
            setGlobalMinMaxStrength([minS, maxS]);
            setStrengthFilter([minS, maxS]);
            
            setGroupedSeries(Object.values(groups));
        } catch (error) {
            console.error('Ошибка загрузки каталога:', error);
        } finally {
            setLoading(false);
        }
    };

    const calculatePricing = (product) => calculatePricingWithConfig(product, config);

    const toggleSeries = (seriesId) => {
        setExpandedSeries(prev => ({ ...prev, [seriesId]: !prev[seriesId] }));
        if (window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.selectionChanged();
    };

    const addToCart = (productId) => {
        setCart(prev => ({ ...prev, [productId]: (prev[productId] || 0) + 1 }));
        if (window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    };

    const removeFromCart = (productId) => {
        setCart(prev => {
            const newCart = { ...prev };
            if (newCart[productId] > 1) newCart[productId] -= 1;
            else delete newCart[productId];
            if (Object.keys(newCart).length === 0 && currentScreen === 'checkout') {
                setCurrentScreen('catalog'); 
            }
            return newCart;
        });
        if (window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    };

    const totalItems = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
    const totalPrice = Object.entries(cart).reduce((total, [id, qty]) => {
        const prod = originalProducts.find(p => p.id === id);
        return prod ? total + (calculatePricing(prod) * qty) : total;
    }, 0);

    // === ЛОГИКА СОРТИРОВКИ И ФИЛЬТРАЦИИ ===
    let processedSeries = groupedSeries.map(group => {
        let matchingFlavors = group.flavors;

        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const groupMatches = group.manufacturer.toLowerCase().includes(q) || (group.series !== '—' && group.series.toLowerCase().includes(q));
            if (!groupMatches) matchingFlavors = matchingFlavors.filter(f => f.flavor.toLowerCase().includes(q));
        }

        if (strengthFilter[0] > globalMinMaxStrength[0] || strengthFilter[1] < globalMinMaxStrength[1]) {
            matchingFlavors = matchingFlavors.filter(f => {
                const sNum = parseStrength(f.strength);
                if (sNum === null) return false; 
                return sNum >= strengthFilter[0] && sNum <= strengthFilter[1];
            });
        }

        if (priceFilter[0] > globalMinMaxPrice[0] || priceFilter[1] < globalMinMaxPrice[1]) {
            matchingFlavors = matchingFlavors.filter(f => {
                const p = calculatePricing(f);
                return p >= priceFilter[0] && p <= priceFilter[1];
            });
        }
        return { ...group, flavors: matchingFlavors };
    });

    processedSeries = processedSeries.filter(g => g.flavors.length > 0);
    if (activeCategory !== 'Все') processedSeries = processedSeries.filter(g => g.category === activeCategory);

    processedSeries.sort((a, b) => {
        const minPriceA = Math.min(...a.flavors.map(f => calculatePricing(f)));
        const minPriceB = Math.min(...b.flavors.map(f => calculatePricing(f)));
        if (sortOrder === 'price_asc') return minPriceA - minPriceB;
        if (sortOrder === 'price_desc') return minPriceB - minPriceA;
        const nameA = `${a.manufacturer} ${a.series}`.toLowerCase();
        const nameB = `${b.manufacturer} ${b.series}`.toLowerCase();
        if (sortOrder === 'alpha_asc') return nameA.localeCompare(nameB);
        if (sortOrder === 'alpha_desc') return nameB.localeCompare(nameA);
        return 0;
    });

    const renderedCategories = {};
    processedSeries.forEach(g => {
        if (!renderedCategories[g.category]) renderedCategories[g.category] = [];
        renderedCategories[g.category].push(g);
    });

    const isFilterActive = priceFilter[0] > globalMinMaxPrice[0] || priceFilter[1] < globalMinMaxPrice[1] || strengthFilter[0] > globalMinMaxStrength[0] || strengthFilter[1] < globalMinMaxStrength[1];

    const Placeholder = () => (
        <div style={{ width: '100%', height: '150px', backgroundColor: '#f5f7fa', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            <PictureOutlined style={{ fontSize: '32px', color: '#d1d8e0' }} />
        </div>
    );

    // === УСЛОВНЫЕ ЭКРАНЫ ЗАГЛУШЕК ===
    if (authStatus === 'loading') return <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa' }}>Загрузка...</div>;
    if (authStatus === 'pending') return <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa', padding: '20px', textAlign: 'center' }}><ClockCircleOutlined style={{ fontSize: '48px', color: '#f39c12', margin: '0 0 16px 0' }} /><h2 style={{ color: '#2c3e50', margin: '0 0 8px 0' }}>Заявка на рассмотрении</h2></div>;
    if (authStatus === 'blocked') return <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa', padding: '20px', textAlign: 'center' }}><StopOutlined style={{ fontSize: '48px', color: '#e74c3c', margin: '0 0 16px 0' }} /><h2 style={{ color: '#2c3e50', margin: '0 0 8px 0' }}>Доступ закрыт</h2></div>;
    if (authStatus === 'new_user') return <Registration onComplete={() => setAuthStatus('pending')} />;
    if (loading) return <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa' }}>Загрузка каталога...</div>;

    // === НАВИГАЦИЯ: ЭКРАН ОФОРМЛЕНИЯ ЗАКАЗА ===
    if (currentScreen === 'checkout') {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#e0e4e8', fontFamily: 'sans-serif' }}>
                <div style={{ width: '100%', maxWidth: '393px', backgroundColor: '#f8f9fa', minHeight: '100vh', boxShadow: '0 0 30px rgba(0,0,0,0.15)', position: 'relative' }}>
                    <Checkout 
                        cart={cart}
                        setCart={setCart}
                        products={originalProducts}
                        config={config}
                        goBack={() => setCurrentScreen('catalog')}
                    />
                </div>
            </div>
        );
    }

    // === НАВИГАЦИЯ: ЭКРАН ПРОФИЛЯ ПО СКРИНШОТУ ===
    if (currentScreen === 'profile') {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#e0e4e8', fontFamily: 'sans-serif' }}>
                <div style={{ width: '100%', maxWidth: '393px', backgroundColor: '#f8f9fa', minHeight: '100vh', boxShadow: '0 0 30px rgba(0,0,0,0.15)', position: 'relative' }}>
                    <Profile 
                        goBack={(target) => {
                            if (target === 'admin_panel') setCurrentScreen('admin');
                            else setCurrentScreen('catalog');
                        }}
                        products={originalProducts}
                        config={config}
                        authStatus={authStatus}
                    />
                </div>
            </div>
        );
    }

    // === НАВИГАЦИЯ: МОБИЛЬНАЯ АДМИН ПАНЕЛЬ ===
    if (currentScreen === 'admin') {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#e0e4e8', fontFamily: 'sans-serif' }}>
                <div style={{ width: '100%', maxWidth: '393px', backgroundColor: '#f8f9fa', minHeight: '100vh', boxShadow: '0 0 30px rgba(0,0,0,0.15)', position: 'relative' }}>
                    <AdminPanel 
                        goBack={() => setCurrentScreen('profile')}
                    />
                </div>
            </div>
        );
    }

    // === ГЛАВНЫЙ ЭКРАН: КАТАЛОГ ===
    return (
        <div style={{ display: 'flex', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#e0e4e8', fontFamily: 'sans-serif' }}>
            <style>{`.no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`}</style>
            <div style={{ width: '100%', maxWidth: '393px', backgroundColor: '#f8f9fa', minHeight: '100vh', boxShadow: '0 0 30px rgba(0,0,0,0.15)', position: 'relative' }}>
                <div style={{ padding: '16px', paddingBottom: '90px' }}>
                    
                    {/* ШАПКА */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <div><div style={{ fontSize: '11px', color: '#7f8c8d', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}>Клуб</div><div style={{ fontSize: '24px', fontWeight: '900', color: '#2c3e50', lineHeight: '1' }}>Пышка</div></div>
                        <div 
                            onClick={() => setCurrentScreen('profile')}
                            style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#ecf0f1', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', cursor: 'pointer' }}
                        >
                            {user?.photo_url ? <img src={user.photo_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <UserOutlined style={{ color: '#95a5a6', fontSize: '20px' }} />}
                        </div>
                    </div>

                    {/* ПОИСК И КАТЕГОРИИ */}
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', alignItems: 'center', minHeight: '42px' }}>
                        {isSearchActive ? (
                            <div style={{ display: 'flex', width: '100%', gap: '8px' }}>
                                <input type="text" placeholder="Бренд, линейка, вкус..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} autoFocus style={{ flexGrow: 1, padding: '10px 14px', borderRadius: '12px', border: 'none', outline: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }} />
                                <button onClick={() => { setIsSearchActive(false); setSearchQuery(''); }} style={{ width: '42px', height: '42px', borderRadius: '12px', border: 'none', backgroundColor: '#e74c3c', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', cursor: 'pointer' }}><CloseOutlined /></button>
                            </div>
                        ) : (
                            <>
                                <button onClick={() => setIsSearchActive(true)} style={{ width: '42px', height: '42px', borderRadius: '12px', border: 'none', backgroundColor: 'white', color: '#2c3e50', display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.03)', cursor: 'pointer' }}><SearchOutlined style={{ fontSize: '18px' }} /></button>
                                <div className="no-scrollbar" style={{ display: 'flex', gap: '8px', overflowX: 'auto' }}>
                                    {categories.map(cat => (
                                        <button key={cat} onClick={() => { setActiveCategory(cat); if (window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.selectionChanged(); }} style={{ padding: '10px 18px', borderRadius: '12px', border: 'none', whiteSpace: 'nowrap', fontWeight: '600', cursor: 'pointer', backgroundColor: activeCategory === cat ? '#2c3e50' : 'white', color: activeCategory === cat ? 'white' : '#7f8c8d', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>{cat}</button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* СТРОКА СОРТИРОВКИ И ФИЛЬТРОВ */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => setShowFilterModal(true)} style={{ padding: '8px 14px', borderRadius: '12px', border: 'none', backgroundColor: isFilterActive ? '#3498db' : 'white', color: isFilterActive ? 'white' : '#7f8c8d', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)', cursor: 'pointer', transition: '0.2s' }}>
                                <FilterOutlined /> Фильтры
                            </button>
                            <button onClick={() => setShowSortModal(true)} style={{ padding: '8px 14px', borderRadius: '12px', border: 'none', backgroundColor: 'white', color: '#7f8c8d', fontWeight: 'bold', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.03)', cursor: 'pointer' }}>
                                <SwapOutlined rotate={90} /> Сорт
                            </button>
                        </div>
                        <div style={{ display: 'flex', backgroundColor: '#ecf0f1', borderRadius: '10px', padding: '4px' }}>
                            <button onClick={() => setViewMode('list')} style={{ padding: '6px 12px', border: 'none', borderRadius: '8px', cursor: 'pointer', backgroundColor: viewMode === 'list' ? 'white' : 'transparent', boxShadow: viewMode === 'list' ? '0 2px 6px rgba(0,0,0,0.05)' : 'none', color: viewMode === 'list' ? '#2c3e50' : '#95a5a6' }}><UnorderedListOutlined style={{ fontSize: '16px' }} /></button>
                            <button onClick={() => setViewMode('grid')} style={{ padding: '6px 12px', border: 'none', borderRadius: '8px', cursor: 'pointer', backgroundColor: viewMode === 'grid' ? 'white' : 'transparent', boxShadow: viewMode === 'grid' ? '0 2px 6px rgba(0,0,0,0.05)' : 'none', color: viewMode === 'grid' ? '#2c3e50' : '#95a5a6' }}><AppstoreOutlined style={{ fontSize: '16px' }} /></button>
                        </div>
                    </div>

                    {/* ЛЕНТА ТОВАРОВ */}
                    {Object.keys(renderedCategories).length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '60px 0', color: '#95a5a6' }}>
                            <SearchOutlined style={{ fontSize: '40px', marginBottom: '10px', color: '#d1d8e0' }} />
                            <div style={{ fontWeight: 'bold' }}>Ничего не найдено</div>
                        </div>
                    ) : (
                        Object.keys(renderedCategories).map(categoryName => (
                            <div key={categoryName} style={{ marginBottom: '28px' }}>
                                <h2 style={{ fontSize: '18px', fontWeight: '900', color: '#2c3e50', marginBottom: '16px' }}>{categoryName}</h2>
                                {viewMode === 'list' ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {renderedCategories[categoryName].map(group => {
                                            const isExpanded = !!expandedSeries[group.id];
                                            return (
                                                <div key={group.id} style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
                                                    <div onClick={() => toggleSeries(group.id)} style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', backgroundColor: isExpanded ? '#f8f9fa' : 'white' }}>
                                                        <div>
                                                            <div style={{ fontWeight: '800', color: '#2c3e50', fontSize: '16px' }}>{group.manufacturer}</div>
                                                            {group.series !== '—' && <div style={{ fontSize: '13px', color: '#7f8c8d', marginTop: '4px' }}>{group.series}</div>}
                                                        </div>
                                                        <div style={{ color: '#95a5a6', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                            <span style={{ backgroundColor: '#ecf0f1', padding: '4px 8px', borderRadius: '8px', fontWeight: 'bold', color: '#7f8c8d' }}>{group.flavors.length} шт</span>
                                                            {isExpanded ? <UpOutlined /> : <DownOutlined />}
                                                        </div>
                                                    </div>
                                                    {isExpanded && (
                                                        <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', borderTop: '1px solid #f0f2f5' }}>
                                                            {group.flavors.map((flavor, index) => (
                                                                <div key={flavor.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: index !== group.flavors.length - 1 ? '1px solid #f0f2f5' : 'none' }}>
                                                                    <div style={{ flexGrow: 1, paddingRight: '15px' }}>
                                                                        <div style={{ fontSize: '14px', color: '#2c3e50', fontWeight: '600' }}>{flavor.flavor} {flavor.strength !== '—' && `| ${flavor.strength}`}</div>
                                                                        <div style={{ fontSize: '14px', color: '#2ecc71', fontWeight: '900', marginTop: '4px' }}>{calculatePricing(flavor)} ₽</div>
                                                                    </div>
                                                                    <CartControls productId={flavor.id} />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                        {renderedCategories[categoryName].map(group => {
                                            const isExpanded = !!expandedSeries[group.id];
                                            return (
                                                <div key={group.id} style={{ backgroundColor: 'white', borderRadius: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', overflow: 'hidden', display: 'flex', flexDirection: 'column', gridColumn: isExpanded ? '1 / -1' : 'auto' }}>
                                                    <div onClick={() => toggleSeries(group.id)} style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                                                        <div style={{ position: 'relative' }}>
                                                            {group.imageUrl ? <img src={group.imageUrl} alt={group.series} style={{ width: '100%', height: isExpanded ? '220px' : '150px', objectFit: 'cover' }} /> : <Placeholder />}
                                                            {group.strength && group.strength !== '—' && (
                                                                <div style={{ position: 'absolute', top: '10px', right: '10px', backgroundColor: 'rgba(255, 255, 255, 0.9)', color: '#2c3e50', padding: '4px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: '900', backdropFilter: 'blur(5px)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>{group.strength}</div>
                                                            )}
                                                        </div>
                                                        <div style={{ padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: isExpanded ? '#f8f9fa' : 'white', flexGrow: 1 }}>
                                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                <div style={{ fontSize: '14px', fontWeight: '900', color: '#2c3e50', lineHeight: '1.2' }}>{group.manufacturer}</div>
                                                                {group.series !== '—' && <div style={{ fontSize: '12px', color: '#7f8c8d', marginTop: '4px' }}>{group.series}</div>}
                                                            </div>
                                                            <div style={{ color: '#95a5a6', marginLeft: '8px' }}>{isExpanded ? <UpOutlined /> : <DownOutlined />}</div>
                                                        </div>
                                                    </div>
                                                    {isExpanded && (
                                                        <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', backgroundColor: 'white', borderTop: '1px solid #f0f2f5' }}>
                                                            {group.flavors.map((flavor, index) => (
                                                                <div key={flavor.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: index !== group.flavors.length - 1 ? '1px solid #f0f2f5' : 'none' }}>
                                                                    <div style={{ flexGrow: 1, paddingRight: '15px' }}>
                                                                        <div style={{ fontSize: '14px', color: '#2c3e50', fontWeight: '600' }}>{flavor.flavor} {flavor.strength !== '—' && `| ${flavor.strength}`}</div>
                                                                        <div style={{ fontSize: '14px', color: '#2ecc71', fontWeight: '900', marginTop: '4px' }}>{calculatePricing(flavor)} ₽</div>
                                                                    </div>
                                                                    <CartControls productId={flavor.id} />
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* МОДАЛКА: СОРТИРОВКА */}
                {showSortModal && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' }} onClick={() => setShowSortModal(false)}>
                        <div style={{ width: '100%', maxWidth: '393px', backgroundColor: 'white', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '24px', boxSizing: 'border-box' }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h3 style={{ margin: 0, fontSize: '18px', color: '#2c3e50', fontWeight: '900' }}>Сортировка</h3>
                                <CloseOutlined onClick={() => setShowSortModal(false)} style={{ fontSize: '18px', color: '#95a5a6', cursor: 'pointer' }} />
                            </div>
                            <div onClick={() => { setSortOrder('price_asc'); setShowSortModal(false); }} style={{ padding: '16px 0', borderBottom: '1px solid #f0f2f5', display: 'flex', justifyContent: 'space-between', cursor: 'pointer', fontWeight: sortOrder === 'price_asc' ? 'bold' : 'normal', color: sortOrder === 'price_asc' ? '#2ecc71' : '#2c3e50' }}>Сначала дешевые {sortOrder === 'price_asc' && <CheckOutlined />}</div>
                            <div onClick={() => { setSortOrder('price_desc'); setShowSortModal(false); }} style={{ padding: '16px 0', borderBottom: '1px solid #f0f2f5', display: 'flex', justifyContent: 'space-between', cursor: 'pointer', fontWeight: sortOrder === 'price_desc' ? 'bold' : 'normal', color: sortOrder === 'price_desc' ? '#2ecc71' : '#2c3e50' }}>Сначала дорогие {sortOrder === 'price_desc' && <CheckOutlined />}</div>
                            <div onClick={() => { setSortOrder('alpha_asc'); setShowSortModal(false); }} style={{ padding: '16px 0', borderBottom: '1px solid #f0f2f5', display: 'flex', justifyContent: 'space-between', cursor: 'pointer', fontWeight: sortOrder === 'alpha_asc' ? 'bold' : 'normal', color: sortOrder === 'alpha_asc' ? '#2ecc71' : '#2c3e50' }}>По алфавиту (А - Я) {sortOrder === 'alpha_asc' && <CheckOutlined />}</div>
                            <div onClick={() => { setSortOrder('alpha_desc'); setShowSortModal(false); }} style={{ padding: '16px 0', display: 'flex', justifyContent: 'space-between', cursor: 'pointer', fontWeight: sortOrder === 'alpha_desc' ? 'bold' : 'normal', color: sortOrder === 'alpha_desc' ? '#2ecc71' : '#2c3e50' }}>По алфавиту (Я - А) {sortOrder === 'alpha_desc' && <CheckOutlined />}</div>
                        </div>
                    </div>
                )}

                {/* МОДАЛКА: ФИЛЬТРЫ */}
                {showFilterModal && (
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' }} onClick={() => setShowFilterModal(false)}>
                        <div style={{ width: '100%', maxWidth: '393px', backgroundColor: 'white', borderTopLeftRadius: '24px', borderTopRightRadius: '24px', padding: '24px', boxSizing: 'border-box' }} onClick={e => e.stopPropagation()}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                <h3 style={{ margin: 0, fontSize: '18px', color: '#2c3e50', fontWeight: '900' }}>Фильтры</h3>
                                <CloseOutlined onClick={() => setShowFilterModal(false)} style={{ fontSize: '18px', color: '#95a5a6', cursor: 'pointer' }} />
                            </div>
                            
                            {/* СЛАЙДЕР ЦЕНЫ */}
                            <div style={{ marginBottom: '32px' }}>
                                <h4 style={{ margin: '0 0 16px 0', color: '#2c3e50', fontSize: '15px' }}>Диапазон цены (₽)</h4>
                                <div style={{ padding: '0 8px' }}>
                                    <Slider 
                                        range 
                                        min={globalMinMaxPrice[0]} 
                                        max={globalMinMaxPrice[1]} 
                                        value={priceFilter} 
                                        onChange={(val) => setPriceFilter(val)} 
                                        trackStyle={[{ backgroundColor: '#2ecc71', height: '6px' }]} 
                                        handleStyle={[
                                            { borderColor: '#2ecc71', backgroundColor: 'white', opacity: 1, width: '20px', height: '20px', marginTop: '-7px' }, 
                                            { borderColor: '#2ecc71', backgroundColor: 'white', opacity: 1, width: '20px', height: '20px', marginTop: '-7px' }
                                        ]} 
                                        railStyle={{ backgroundColor: '#ecf0f1', height: '6px' }} 
                                    />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
                                    <span style={{ fontWeight: 'bold', color: '#2c3e50', backgroundColor: '#f8f9fa', padding: '6px 12px', borderRadius: '8px' }}>{priceFilter[0]} ₽</span>
                                    <span style={{ fontWeight: 'bold', color: '#2c3e50', backgroundColor: '#f8f9fa', padding: '6px 12px', borderRadius: '8px' }}>{priceFilter[1]} ₽</span>
                                </div>
                            </div>

                            {/* СЛАЙДЕР КРЕПОСТИ */}
                            <div style={{ marginBottom: '32px' }}>
                                <h4 style={{ margin: '0 0 16px 0', color: '#2c3e50', fontSize: '15px' }}>Диапазон крепости</h4>
                                <div style={{ padding: '0 8px' }}>
                                    <Slider range min={globalMinMaxStrength[0]} max={globalMinMaxStrength[1]} value={strengthFilter} onChange={(val) => setStrengthFilter(val)} trackStyle={[{ backgroundColor: '#3498db', height: '6px' }]} handleStyle={[{ borderColor: '#3498db', backgroundColor: 'white', opacity: 1, width: '20px', height: '20px', marginTop: '-7px' }, { borderColor: '#3498db', backgroundColor: 'white', opacity: 1, width: '20px', height: '20px', marginTop: '-7px' }]} railStyle={{ backgroundColor: '#ecf0f1', height: '6px' }} />
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
                                    <span style={{ fontWeight: 'bold', color: '#2c3e50', backgroundColor: '#f8f9fa', padding: '6px 12px', borderRadius: '8px' }}>{strengthFilter[0]}</span>
                                    <span style={{ fontWeight: 'bold', color: '#2c3e50', backgroundColor: '#f8f9fa', padding: '6px 12px', borderRadius: '8px' }}>{strengthFilter[1]}</span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={() => { setPriceFilter([...globalMinMaxPrice]); setStrengthFilter([...globalMinMaxStrength]); }} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', backgroundColor: '#f0f2f5', color: '#7f8c8d', fontWeight: 'bold', cursor: 'pointer' }}>Сбросить</button>
                                <button onClick={() => setShowFilterModal(false)} style={{ flex: 2, padding: '14px', borderRadius: '12px', border: 'none', backgroundColor: '#2ecc71', color: 'white', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 15px rgba(46, 204, 113, 0.3)' }}>Показать товары</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* ПЛАВАЮЩАЯ КОРЗИНА */}
                {totalItems > 0 && (
                    <div style={{ position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '361px', padding: '0 16px', boxSizing: 'border-box', zIndex: 100 }}>
                        <button 
                            onClick={() => setCurrentScreen('checkout')} 
                            style={{ width: '100%', backgroundColor: '#2ecc71', color: 'white', border: 'none', padding: '16px', borderRadius: '16px', fontWeight: '900', fontSize: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 8px 25px rgba(46, 204, 113, 0.4)', cursor: 'pointer' }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <ShoppingCartOutlined style={{ fontSize: '20px' }} />
                                <span style={{ backgroundColor: 'rgba(255,255,255,0.25)', padding: '4px 10px', borderRadius: '10px' }}>{totalItems} шт.</span>
                            </div>
                            <span>Корзина • {totalPrice} ₽</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}