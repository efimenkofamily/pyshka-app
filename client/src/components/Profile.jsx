import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { 
    LeftOutlined, 
    ClockCircleOutlined, 
    CheckCircleOutlined, 
    CloseCircleOutlined,
    LoadingOutlined,
    UserOutlined,
    DownOutlined,
    UpOutlined,
    RightOutlined
} from '@ant-design/icons';

// 🚀 Распределяем цвета и шаги прогресс-бара по всем 5 статусам из твоей БД
const UI_PRESETS = {
    1: { color: '#3498db', progress: '20%' },   // 🥂 Новый заказ
    2: { color: '#f39c12', progress: '45%' },   // 🤝 Принят
    3: { color: '#e67e22', progress: '70%' },   // 🚚 Ждёт поставки на склад
    4: { color: '#2ecc71', progress: '90%' },   // 🛄 Прибыл, готов к вручению
    5: { color: '#2ecc71', progress: '100%' }  // 🎯 Вручено. Спасибо за заказ
};

export default function Profile({ goBack, products, config, authStatus }) {
    const [currentView, setCurrentView] = useState('menu'); 
    const [orders, setOrders] = useState([]);
    const [dbStatuses, setDbStatuses] = useState({}); 
    const [loading, setLoading] = useState(true);
    const [isOrderExpanded, setIsOrderExpanded] = useState(false);

    const user = window.Telegram?.WebApp?.initDataUnsafe?.user;
    const effectiveUserId = user?.id || 999888777;

    useEffect(() => {
        fetchProfileData();
    }, []);

    const fetchProfileData = async () => {
        setLoading(true);
        try {
            // 1. Тянем реальные статусы из БД
            const { data: statusData, error: statusError } = await supabase
                .from('order_statuses')
                .select('*');

            if (statusError) throw statusError;

            const statusMap = {};
            statusData?.forEach(s => {
                // 🚀 Читаем колонку s.label, которую мы увидели в логах!
                statusMap[s.id] = s.label || `Статус #${s.id}`;
            });
            setDbStatuses(statusMap);

            // 2. Тянем заказы
            const { data: orderData, error: orderError } = await supabase
                .from('orders')
                .select('*')
                .eq('user_id', effectiveUserId)
                .order('id', { ascending: false });

            if (orderError) throw orderError;
            setOrders(orderData || []);

        } catch (error) {
            console.error('Ошибка загрузки данных профиля:', error);
        } finally {
            setLoading(false);
        }
    };

    // 🚀 ТЕКУЩИЙ ЗАКАЗ: Показывать на главном экране любой заказ со статусом от 1 до 4 (пока не вручен)
    const currentActiveOrder = orders.find(o => [1, 2, 3, 4].includes(o.status_id));

    const getRoleBadge = () => {
        if (authStatus === 'admin') return { text: 'Администратор', bg: '#fde8e8', color: '#e74c3c' };
        if (authStatus === 'developer') return { text: 'Разработчик', bg: '#ebf5ff', color: '#3182ce' };
        return { text: 'Клиент клуба', bg: '#e8f8f0', color: '#2ecc71' };
    };

    const role = getRoleBadge();

    const formatDate = (dateString) => {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    };

    // === ИСТОРИЯ ЗАКАЗОВ ===
    if (currentView === 'history') {
        return (
            <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh', paddingBottom: '40px' }}>
                <div style={{ padding: '16px', backgroundColor: 'white', display: 'flex', alignItems: 'center', gap: '16px', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }}>
                    <button onClick={() => setCurrentView('menu')} style={{ border: 'none', background: 'transparent', fontSize: '16px', color: '#2c3e50', cursor: 'pointer', display: 'flex', alignItems: 'center' }}><LeftOutlined /></button>
                    <h1 style={{ margin: 0, fontSize: '18px', color: '#2c3e50', fontWeight: '900' }}>История заказов</h1>
                </div>
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {orders.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#95a5a6', fontWeight: '600' }}>История заказов пуста</div>
                    ) : (
                        orders.map(order => {
                            const statusText = dbStatuses[order.status_id] || `Статус #${order.status_id}`;
                            const visualPreset = UI_PRESETS[order.status_id] || { color: '#2ecc71' };

                            return (
                                <div key={order.id} style={{ backgroundColor: 'white', borderRadius: '16px', padding: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid #f0f2f5', paddingBottom: '10px' }}>
                                        <div>
                                            <div style={{ fontWeight: '800', color: '#2c3e50', fontSize: '14px' }}>Заказ №{order.id.toString().substring(0,6).toUpperCase()}</div>
                                            <div style={{ fontSize: '12px', color: '#95a5a6', marginTop: '2px' }}>{formatDate(order.created_at)}</div>
                                        </div>
                                        <span style={{ fontSize: '11px', fontWeight: '900', color: visualPreset.color, backgroundColor: `${visualPreset.color}12`, padding: '4px 10px', borderRadius: '8px' }}>
                                            {statusText}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px', fontSize: '13px', color: '#2c3e50' }}>
                                        {order.items && Object.entries(order.items).map(([id, item]) => (
                                            <div key={id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span>{item.product?.manufacturer} {item.product?.series !== '—' && `(${item.product?.series})`} — <span style={{color: '#7f8c8d'}}>{item.product?.flavor}</span></span>
                                                <span style={{fontWeight: '700', color: '#7f8c8d'}}>{item.qty} шт</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'bold', color: '#2ecc71', paddingTop: '10px', borderTop: '1px solid #f0f2f5' }}>
                                        <span style={{color: '#7f8c8d', fontWeight: '600'}}>{order.delivery_type === 'pickup' ? '🏪 Самовывоз' : '🚗 Доставка'}</span>
                                        <span>{order.total_price} ₽</span>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        );
    }

    // === ГЛАВНЫЙ ЭКРАН ПРОФИЛЯ ===
    const activeVisual = currentActiveOrder ? (UI_PRESETS[currentActiveOrder.status_id] || { color: '#3498db', progress: '50%' }) : null;
    const activeStatusText = currentActiveOrder ? dbStatuses[currentActiveOrder.status_id] : '';

    return (
        <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh', paddingBottom: '30px', boxSizing: 'border-box' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 16px 8px 16px' }}>
                <button onClick={goBack} style={{ border: 'none', background: 'transparent', color: '#7f8c8d', fontWeight: 'bold', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}><LeftOutlined style={{ fontSize: '12px' }} /> В каталог</button>
                <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: '#2c3e50', transform: 'translateX(-25px)' }}>Профиль</h1>
                <div></div>
            </div>

            <div style={{ padding: '0 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px', marginTop: '12px' }}>
                    <div style={{ width: '70px', height: '70px', borderRadius: '50%', backgroundColor: '#ecf0f1', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                        {user?.photo_url ? <img src={user.photo_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <UserOutlined style={{ color: '#95a5a6', fontSize: '28px' }} />}
                    </div>
                    <div>
                        <div style={{ fontSize: '20px', fontWeight: '800', color: '#2c3e50' }}>{user ? `${user.first_name}` : 'Пользователь'} 🐼</div>
                        <span style={{ display: 'inline-block', marginTop: '6px', backgroundColor: role.bg, color: role.color, padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '900' }}>{role.text}</span>
                    </div>
                </div>

                <h3 style={{ fontSize: '16px', fontWeight: '900', color: '#2c3e50', marginBottom: '12px', marginTop: '24px', paddingLeft: '4px' }}>Текущий заказ</h3>
                
                {loading ? (
                    <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '20px', textAlign: 'center', color: '#7f8c8d' }}><LoadingOutlined spin /></div>
                ) : !currentActiveOrder ? (
                    <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '24px', textAlign: 'center', color: '#95a5a6', fontSize: '14px', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>У вас нет активных заказов в обработке</div>
                ) : (
                    <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', border: '1px solid #f0f2f5' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                            <div>
                                <div style={{ fontSize: '16px', fontWeight: '900', color: '#2c3e50' }}>Заказ #{currentActiveOrder.id.toString().substring(0,6).toUpperCase()}</div>
                                <div style={{ fontSize: '13px', color: '#7f8c8d', marginTop: '4px', fontWeight: '600' }}>Сумма: {currentActiveOrder.total_price} ₽</div>
                                <div onClick={() => setIsOrderExpanded(!isOrderExpanded)} style={{ color: '#3498db', fontSize: '13px', fontWeight: 'bold', marginTop: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    {isOrderExpanded ? <>Свернуть <UpOutlined style={{fontSize:'10px'}} /></> : <>Состав заказа <DownOutlined style={{fontSize:'10px'}} /></>}
                                </div>
                            </div>
                            
                            {/* 🚀 Текст берется строго из базы по колонке s.label (включая эмодзи дропов!) */}
                            <div style={{ backgroundColor: `${activeVisual.color}12`, color: activeVisual.color, padding: '6px 12px', borderRadius: '10px', fontSize: '12px', fontWeight: '900', textAlign: 'center' }}>
                                {activeStatusText || <LoadingOutlined spin />}
                            </div>
                        </div>

                        {isOrderExpanded && (
                            <div style={{ padding: '8px 0', borderTop: '1px solid #f0f2f5', marginBottom: '12px', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {currentActiveOrder.items && Object.entries(currentActiveOrder.items).map(([id, item]) => (
                                    <div key={id} style={{ display: 'flex', justifyContent: 'space-between', color: '#2c3e50' }}>
                                        <span>{item.product?.manufacturer} — <span style={{color: '#7f8c8d'}}>{item.product?.flavor}</span></span>
                                        <span style={{fontWeight: 'bold', color: '#7f8c8d'}}>{item.qty} шт</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div style={{ width: '100%', height: '6px', backgroundColor: '#f0f2f5', borderRadius: '3px', overflow: 'hidden', marginTop: '10px' }}>
                            <div style={{ width: activeVisual.progress, height: '100%', backgroundColor: activeVisual.color, borderRadius: '3px', transition: 'width 0.4s ease-out' }}></div>
                        </div>
                    </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)', borderRadius: '16px', padding: '18px 20px', marginTop: '20px', color: 'white', boxShadow: '0 6px 20px rgba(44, 62, 80, 0.08)' }}>
                    <div>
                        <div style={{ fontSize: '15px', fontWeight: '800', marginBottom: '4px', letterSpacing: '0.3px' }}>Зарабатывай с клубом</div>
                        <div style={{ fontSize: '12px', opacity: '0.85', lineHeight: '1.4' }}>Приглашай друзей и получай кэшбэк на баланс</div>
                    </div>
                    <div style={{ fontSize: '32px' }}>🎁</div>
                </div>

                <div style={{ backgroundColor: 'white', borderRadius: '16px', marginTop: '20px', overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
                    <div onClick={() => setCurrentView('history')} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid #f0f2f5', cursor: 'pointer' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#2c3e50', fontWeight: '600', fontSize: '14px' }}><span style={{fontSize: '16px'}}>📦</span> История всех заказов</div>
                        <RightOutlined style={{ color: '#95a5a6', fontSize: '12px' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid #f0f2f5', color: '#2c3e50', opacity: 0.65 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: '600', fontSize: '14px' }}><span style={{fontSize: '16px'}}>🤝</span> Реферальная программа</div>
                        <RightOutlined style={{ color: '#cbd5e1', fontSize: '12px' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: (authStatus === 'admin' || authStatus === 'developer') ? '1px solid #f0f2f5' : 'none', color: '#2c3e50', opacity: 0.65 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: '600', fontSize: '14px' }}><span style={{fontSize: '16px'}}>💬</span> Служба поддержки</div>
                        <RightOutlined style={{ color: '#cbd5e1', fontSize: '12px' }} />
                    </div>
                    {(authStatus === 'admin' || authStatus === 'developer') && (
                        <div 
                            onClick={() => goBack('admin_panel')}
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', color: '#e74c3c', cursor: 'pointer' }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: '700', fontSize: '14px' }}>
                                <span>⚙️</span> Панель управления (Админ)
                            </div>
                            <RightOutlined style={{ color: '#e74c3c', fontSize: '12px' }} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}