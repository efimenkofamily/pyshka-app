import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { 
    LeftOutlined, 
    LoadingOutlined, 
    DownOutlined,
    UpOutlined,
    UserOutlined,
    DeleteOutlined,
    SettingOutlined,
    ShoppingOutlined,
    TeamOutlined
} from '@ant-design/icons';

export default function AdminPanel({ goBack }) {
    const [activeTab, setActiveTab] = useState('orders'); // 'orders', 'users', 'settings'
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [loading, setLoading] = useState(true);
    
    // Данные
    const [orders, setOrders] = useState([]);
    const [users, setUsers] = useState([]);
    const [config, setConfig] = useState({});
    const [statuses, setStatuses] = useState([]);
    
    // UI состояния
    const [expandedOrders, setExpandedOrders] = useState({});

    useEffect(() => {
        fetchAllData();
    }, []);

    const fetchAllData = async () => {
        setLoading(true);
        try {
            // Грузим заказы
            const { data: ordersData } = await supabase.from('orders').select('*').order('id', { ascending: false });
            setOrders(ordersData || []);

            // Грузим юзеров
            const { data: usersData } = await supabase.from('users').select('*').order('created_at', { ascending: false });
            setUsers(usersData || []);

            // Грузим конфиг (для расписания)
            const { data: configData } = await supabase.from('config').select('*').eq('id', 1).single();
            setConfig(configData || {});

            // Грузим статусы
            const { data: statusData } = await supabase.from('order_statuses').select('*').order('sort_order', { ascending: true });
            setStatuses(statusData || []);

        } catch (error) {
            console.error('Ошибка загрузки админки:', error);
        } finally {
            setLoading(false);
        }
    };

    // --- ОБРАБОТЧИКИ СОБЫТИЙ ---

    const handleOrderStatusChange = async (orderId, newStatusId) => {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status_id: parseInt(newStatusId) } : o));
        await supabase.from('orders').update({ status_id: parseInt(newStatusId) }).eq('id', orderId);
    };

    const handleUserRoleChange = async (userId, newRole) => {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: newRole } : u));
        await supabase.from('users').update({ status: newRole }).eq('id', userId);
    };

    // Просто меняем значения локально на экране
    const handleConfigChange = (field, value) => {
        if (!value) return;
        setConfig(prev => ({ ...prev, [field]: new Date(value).toISOString() }));
    };

    // Функция ручного сохранения по кнопке
    const saveAllSettings = async () => {
        setIsSavingSettings(true);
        try {
            const { error } = await supabase
                .from('config')
                .update({ 
                    open_date: config.open_date,
                    close_date: config.close_date
                })
                .eq('id', 1);

            if (error) throw error;
            alert('⚙️ Настройки дропа успешно сохранены!');
        } catch (error) {
            console.error('Ошибка сохранения настроек:', error);
            alert('Не удалось сохранить настройки. Проверьте сеть.');
        } finally {
            setIsSavingSettings(false);
        }
    };

    const toggleOrderExpand = (id) => {
        setExpandedOrders(prev => ({ ...prev, [id]: !prev[id] }));
    };

    // --- ФОРМАТИРОВАНИЕ ---

    const formatDate = (dateString) => {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    };

    const toDateTimeLocal = (isoString) => {
        if (!isoString) return '';
        const date = new Date(isoString);
        return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    };

    // --- ВЫЧИСЛЕНИЯ ДЛЯ ДАШБОРДА ---
    const totalRevenue = orders.reduce((sum, o) => sum + (o.total_price || 0), 0);
    const totalItems = orders.reduce((sum, o) => {
        let itemsCount = 0;
        if (o.items) {
            Object.values(o.items).forEach(item => itemsCount += (item.qty || 1));
        }
        return sum + itemsCount;
    }, 0);

    return (
        <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh', paddingBottom: '40px' }}>
            
            {/* Шапка */}
            <div style={{ padding: '16px', backgroundColor: 'white', display: 'flex', alignItems: 'center', gap: '16px', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                <button onClick={goBack} style={{ border: 'none', background: 'transparent', color: '#D97736', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <LeftOutlined style={{ fontSize: '12px' }} /> В профиль
                </button>
                <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: '#2c3e50', transform: 'translateX(-10px)' }}>Админка</h1>
            </div>

            {/* Навигационные табы (UX как на скрине, UI современный) */}
            <div style={{ padding: '16px 16px 0 16px' }}>
                <div style={{ display: 'flex', backgroundColor: '#ecf0f1', padding: '4px', borderRadius: '12px' }}>
                    <button onClick={() => setActiveTab('orders')} style={{ flex: 1, padding: '10px 0', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s', backgroundColor: activeTab === 'orders' ? 'white' : 'transparent', color: activeTab === 'orders' ? '#2c3e50' : '#7f8c8d', boxShadow: activeTab === 'orders' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none' }}>Заказы</button>
                    <button onClick={() => setActiveTab('users')} style={{ flex: 1, padding: '10px 0', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s', backgroundColor: activeTab === 'users' ? 'white' : 'transparent', color: activeTab === 'users' ? '#2c3e50' : '#7f8c8d', boxShadow: activeTab === 'users' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none' }}>Пользователи</button>
                    <button onClick={() => setActiveTab('settings')} style={{ flex: 1, padding: '10px 0', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s', backgroundColor: activeTab === 'settings' ? 'white' : 'transparent', color: activeTab === 'settings' ? '#2c3e50' : '#7f8c8d', boxShadow: activeTab === 'settings' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none' }}>Настройки</button>
                </div>
            </div>

            <div style={{ padding: '16px' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#95a5a6' }}><LoadingOutlined spin style={{ fontSize: '24px' }} /></div>
                ) : (
                    <>
                        {/* ===================== ВКЛАДКА ЗАКАЗЫ ===================== */}
                        {activeTab === 'orders' && (
                            <div>
                                {/* Блок метрик */}
                                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                                    <div style={{ flex: 1, backgroundColor: 'white', borderRadius: '12px', padding: '12px 0', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', border: '1px solid #f0f2f5' }}>
                                        <div style={{ fontSize: '10px', color: '#7f8c8d', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px' }}>Сумма</div>
                                        <div style={{ fontSize: '15px', color: '#D97736', fontWeight: '900' }}>{totalRevenue} ₽</div>
                                    </div>
                                    <div style={{ flex: 1, backgroundColor: 'white', borderRadius: '12px', padding: '12px 0', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', border: '1px solid #f0f2f5' }}>
                                        <div style={{ fontSize: '10px', color: '#7f8c8d', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px' }}>Позиций</div>
                                        <div style={{ fontSize: '15px', color: '#D97736', fontWeight: '900' }}>{totalItems} шт</div>
                                    </div>
                                    <div style={{ flex: 1, backgroundColor: 'white', borderRadius: '12px', padding: '12px 0', textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', border: '1px solid #f0f2f5' }}>
                                        <div style={{ fontSize: '10px', color: '#7f8c8d', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px' }}>Заказов</div>
                                        <div style={{ fontSize: '15px', color: '#D97736', fontWeight: '900' }}>{orders.length}</div>
                                    </div>
                                </div>

                                {/* Лента заказов */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {orders.map(order => (
                                        <div key={order.id} style={{ backgroundColor: 'white', borderRadius: '16px', padding: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.02)', border: '1px solid #f0f2f5' }}>
                                            
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed #ecf0f1', paddingBottom: '12px', marginBottom: '12px' }}>
                                                <div style={{ fontWeight: '900', color: '#2c3e50', fontSize: '16px' }}>#{order.id.toString().substring(0,6).toUpperCase()}</div>
                                                <div style={{ fontSize: '13px', color: '#7f8c8d' }}>{formatDate(order.created_at)}</div>
                                            </div>

                                            <div style={{ fontSize: '13px', color: '#2c3e50', marginBottom: '8px' }}>
                                                <span style={{ fontWeight: 'bold' }}>Итого:</span> {Object.keys(order.items || {}).length} товаров — <span style={{ color: '#D97736', fontWeight: 'bold' }}>{order.total_price} ₽</span>
                                            </div>
                                            <div style={{ fontSize: '13px', color: '#2c3e50', marginBottom: '8px' }}>
                                                <span style={{ fontWeight: 'bold' }}>Доставка:</span> {order.delivery_type === 'pickup' ? '🏪 Самовывоз' : '🚗 Курьер'}
                                            </div>
                                            <div style={{ fontSize: '13px', color: '#2c3e50', marginBottom: '12px' }}>
                                                <span style={{ fontWeight: 'bold' }}>Покупатель:</span> <span style={{ color: '#3498db', cursor: 'pointer' }}>{order.user_name || 'Неизвестен'} 💬</span>
                                            </div>

                                            <div onClick={() => toggleOrderExpand(order.id)} style={{ color: '#D97736', fontSize: '13px', fontWeight: 'bold', marginBottom: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                Развернуть состав {expandedOrders[order.id] ? <UpOutlined style={{ fontSize: '10px' }}/> : <DownOutlined style={{ fontSize: '10px' }}/>}
                                            </div>

                                            {/* Состав заказа */}
                                            {expandedOrders[order.id] && (
                                                <div style={{ backgroundColor: '#f8f9fa', padding: '12px', borderRadius: '12px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                                                    {order.items && Object.entries(order.items).map(([id, item]) => (
                                                        <div key={id} style={{ display: 'flex', justifyContent: 'space-between', color: '#2c3e50' }}>
                                                            <span>{item.product?.manufacturer} ({item.product?.series}) — <span style={{color: '#7f8c8d'}}>{item.product?.flavor}</span></span>
                                                            <span style={{fontWeight: 'bold'}}>{item.qty} шт</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Dropdown смены статуса (современный стиль) */}
                                            <select 
                                                value={order.status_id}
                                                onChange={(e) => handleOrderStatusChange(order.id, e.target.value)}
                                                style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #D97736', backgroundColor: '#FAF3E8', color: '#D97736', fontWeight: 'bold', fontSize: '14px', outline: 'none', cursor: 'pointer', appearance: 'none', backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23D97736%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 16px top 50%', backgroundSize: '10px auto' }}
                                            >
                                                {statuses.map(s => (
                                                    <option key={s.id} value={s.id}>{s.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ===================== ВКЛАДКА ПОЛЬЗОВАТЕЛИ ===================== */}
                        {activeTab === 'users' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {users.map(u => {
                                    // Цвет левой полоски в зависимости от роли
                                    let indicatorColor = '#2ecc71';
                                    if (u.status === 'blocked') indicatorColor = '#e74c3c';
                                    if (u.status === 'admin' || u.status === 'developer') indicatorColor = '#3498db';

                                    return (
                                        <div key={u.id} style={{ backgroundColor: 'white', borderRadius: '16px', padding: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.02)', borderLeft: `6px solid ${indicatorColor}`, position: 'relative' }}>
                                            
                                            <div style={{ fontWeight: '900', color: '#2c3e50', fontSize: '16px', marginBottom: '4px' }}>{u.full_name || 'Без имени'}</div>
                                            
                                            <button style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', color: '#bdc3c7', fontSize: '18px', cursor: 'pointer' }}>
                                                <DeleteOutlined />
                                            </button>

                                            <div style={{ fontSize: '13px', color: '#7f8c8d', marginBottom: '2px' }}>
                                                <span style={{ color: '#3498db' }}>@{u.username || 'unknown'}</span> | ID: {u.id}
                                            </div>
                                            <div style={{ fontSize: '13px', color: '#7f8c8d', marginBottom: '2px' }}>Откуда: {u.source || 'Не указано'}</div>
                                            <div style={{ fontSize: '12px', color: '#95a5a6', marginBottom: '16px' }}>Зарег: {formatDate(u.created_at)}</div>

                                            <div style={{ fontSize: '10px', color: '#7f8c8d', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '6px' }}>Статус доступа:</div>
                                            
                                            {/* Dropdown роли (зеленый/красный в зависимости от статуса) */}
                                            <select 
                                                value={u.status}
                                                onChange={(e) => handleUserRoleChange(u.id, e.target.value)}
                                                style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: `1px solid ${indicatorColor}`, backgroundColor: `${indicatorColor}10`, color: indicatorColor, fontWeight: 'bold', fontSize: '13px', outline: 'none', cursor: 'pointer' }}
                                            >
                                                <option value="pending">Ожидает проверки</option>
                                                <option value="approved">Принят (Покупатель)</option>
                                                <option value="admin">Администратор</option>
                                                <option value="developer">Разработчик</option>
                                                <option value="blocked">Заблокирован</option>
                                            </select>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* ===================== ВКЛАДКА НАСТРОЙКИ ===================== */}
                        {activeTab === 'settings' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                
                                {/* Расписание дропов */}
                                <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.02)', borderLeft: '6px solid #f1c40f' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: '900', color: '#2c3e50', marginBottom: '16px' }}>
                                        ⏰ Расписание (Дропы)
                                    </div>
                                    <div style={{ fontSize: '13px', color: '#7f8c8d', marginBottom: '16px', lineHeight: '1.4' }}>
                                        Если даты не заданы, магазин закрыт. Время местное.
                                    </div>
                                    
                                    <div style={{ marginBottom: '12px' }}>
                                        <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#2c3e50', marginBottom: '6px' }}>Открытие:</div>
                                        <input 
                                            type="datetime-local" 
                                            value={toDateTimeLocal(config.open_date)}
                                            onChange={(e) => handleConfigChange('open_date', new Date(e.target.value).toISOString())}
                                            style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ecf0f1', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                                        />
                                    </div>
                                    <div style={{ marginBottom: '20px' }}>
                                        <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#2c3e50', marginBottom: '6px' }}>Закрытие:</div>
                                        <input 
                                            type="datetime-local" 
                                            value={toDateTimeLocal(config.close_date)}
                                            onChange={(e) => handleConfigChange('close_date', e.target.value)}
                                            style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #ecf0f1', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                                        />
                                    </div>

                                    {/* 🚀 НАША НОВАЯ СТИЛЬНАЯ КНОПКА СОХРАНЕНИЯ */}
                                    <button
                                        onClick={saveAllSettings}
                                        disabled={isSavingSettings}
                                        style={{ width: '100%', backgroundColor: '#D97736', color: 'white', border: 'none', padding: '14px', borderRadius: '12px', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(217, 119, 54, 0.2)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', opacity: isSavingSettings ? 0.7 : 1 }}
                                    >
                                        {isSavingSettings ? <LoadingOutlined spin /> : 'Сохранить настройки'}
                                    </button>
                                </div>

                                {/* Статусы заказов */}
                                <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
                                    <h3 style={{ fontSize: '16px', fontWeight: '900', color: '#2c3e50', margin: '0 0 12px 0' }}>Статусы заказов</h3>
                                    <div style={{ fontSize: '13px', color: '#7f8c8d', marginBottom: '16px' }}>
                                        Названия статусов и их видимость в меню
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {statuses.map((status, index) => (
                                            <div key={status.id} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <span style={{ fontWeight: 'bold', color: '#2c3e50', width: '16px' }}>{index + 1}.</span>
                                                <input 
                                                    type="text" 
                                                    value={status.label}
                                                    readOnly // В мобильной версии только отображаем для безопасности
                                                    style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', border: '1px solid #D97736', color: '#2c3e50', fontSize: '14px', outline: 'none' }}
                                                />
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                    <span style={{ fontSize: '10px', color: '#7f8c8d' }}>Активен</span>
                                                    <input type="checkbox" checked={status.is_active} readOnly style={{ accentColor: '#D97736', width: '16px', height: '16px' }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}