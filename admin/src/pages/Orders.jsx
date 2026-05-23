import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { 
    ReloadOutlined, 
    DownOutlined, 
    UpOutlined, 
    ShoppingOutlined, 
    CarOutlined, 
    UserOutlined,
    DollarOutlined,
    PieChartOutlined
} from '@ant-design/icons';

export default function Orders() {
    const [orders, setOrders] = useState([]);
    const [statuses, setStatuses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedOrders, setExpandedOrders] = useState({});

    // Загрузка заказов и статусов
    const fetchData = async () => {
        setLoading(true);
        try {
            const [ordersRes, statusesRes] = await Promise.all([
                supabase.from('orders').select('*').order('created_at', { ascending: false }),
                supabase.from('order_statuses').select('*').order('sort_order')
            ]);

            if (ordersRes.error) throw ordersRes.error;
            if (statusesRes.error) throw statusesRes.error;

            setOrders(ordersRes.data || []);
            setStatuses(statusesRes.data || []);
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
            alert('Не удалось загрузить данные заказов');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const toggleOrder = (orderId) => {
        setExpandedOrders(prev => ({ ...prev, [orderId]: !prev[orderId] }));
    };

    const handleStatusChange = async (orderId, newStatusId) => {
        try {
            const { error } = await supabase
                .from('orders')
                .update({ status_id: parseInt(newStatusId) })
                .eq('id', orderId);

            if (error) throw error;
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status_id: parseInt(newStatusId) } : o));
        } catch (error) {
            console.error('Ошибка обновления статуса:', error);
            alert('Не удалось обновить статус');
        }
    };

    // Всеядная функция расчета себестоимости одного заказа
    const calculateOrderCostPrice = (items) => {
        if (!items) return 0;
        
        // Превращаем объект/карту товаров в массив для перебора
        const itemsArray = Array.isArray(items) ? items : Object.values(items);
        
        return itemsArray.reduce((total, item) => {
            // Данные товара могут быть в корне или внутри вложенного объекта product
            const prod = item.product || item;
            let rawCost = prod.price_10;
            
            if (rawCost) {
                if (typeof rawCost === 'string') {
                    // Очищаем от букв "р", пробелов и заменяем запятые на точки
                    rawCost = rawCost.replace(/[^0-9.,]/g, '').replace(',', '.');
                }
                const costPerUnit = parseFloat(rawCost) || 0;
                const quantity = parseInt(item.qty) || parseInt(item.quantity) || 0;
                
                return total + (costPerUnit * quantity);
            }
            return total;
        }, 0);
    };

    const getStatusStyle = (statusId) => {
        const base = { padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold' };
        switch(statusId) {
            case 1: return { ...base, backgroundColor: '#FAF3E8', color: '#D97736' };
            case 2: return { ...base, backgroundColor: '#E3F2FD', color: '#1E88E5' };
            case 3: return { ...base, backgroundColor: '#E8F5E9', color: '#4CAF50' };
            case 4: return { ...base, backgroundColor: '#FFEBEE', color: '#E53935' };
            default: return { ...base, backgroundColor: '#F5F5F5', color: '#757575' };
        }
    };

    // Глобальные счетчики аналитики по всем загруженным заказам
    const totalRevenue = orders.reduce((acc, o) => acc + (o.total_price || 0), 0);
    const totalCost = orders.reduce((acc, o) => acc + calculateOrderCostPrice(o.items), 0);
    const totalProfit = totalRevenue - totalCost;

    return (
        <div>
            {/* Хедер */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '900' }}>Журнал заказов</h1>
                <button 
                    onClick={fetchData}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: 'white', color: '#D97736', border: '1px solid #D97736', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                    <ReloadOutlined spin={loading} /> Обновить данные
                </button>
            </div>

            {/* Финансовые карточки */}
            {!loading && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                    <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #E8C396' }}>
                        <div style={{ fontSize: '12px', color: '#8B5E3C', fontWeight: 'bold' }}><DollarOutlined /> ОБЩАЯ ВЫРУЧКА</div>
                        <div style={{ fontSize: '24px', fontWeight: '900', color: '#5C3A21', marginTop: '5px' }}>{totalRevenue.toLocaleString()} ₽</div>
                    </div>
                    <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #E8C396' }}>
                        <div style={{ fontSize: '12px', color: '#8B5E3C', fontWeight: 'bold' }}><ShoppingOutlined /> СЕБЕСТОИМОСТЬ (Закупка)</div>
                        <div style={{ fontSize: '24px', fontWeight: '900', color: '#7f8c8d', marginTop: '5px' }}>{Math.round(totalCost).toLocaleString()} ₽</div>
                    </div>
                    <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '16px', border: '1px solid #2ecc71' }}>
                        <div style={{ fontSize: '12px', color: '#27ae60', fontWeight: 'bold' }}><PieChartOutlined /> ЧИСТАЯ ПРИБЫЛЬ</div>
                        <div style={{ fontSize: '24px', fontWeight: '900', color: '#2ecc71', marginTop: '5px' }}>{Math.round(totalProfit).toLocaleString()} ₽</div>
                    </div>
                </div>
            )}

            {/* Основная таблица */}
            <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #E8C396', boxShadow: '0 4px 15px rgba(92, 58, 33, 0.05)', overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#8B5E3C', fontWeight: 'bold' }}>Загрузка списка заказов...</div>
                ) : orders.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#8B5E3C', fontWeight: 'bold' }}>Заказов пока нет</div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#FAF3E8', borderBottom: '2px solid #E8C396' }}>
                                <th style={{ padding: '16px 20px', width: '50px' }}></th>
                                <th style={{ padding: '16px 20px', fontWeight: '900', color: '#5C3A21' }}>Дата / Клиент</th>
                                <th style={{ padding: '16px 20px', fontWeight: '900', color: '#5C3A21' }}>Доставка</th>
                                <th style={{ padding: '16px 20px', fontWeight: '900', color: '#5C3A21' }}>Себестоимость</th>
                                <th style={{ padding: '16px 20px', fontWeight: '900', color: '#5C3A21' }}>К оплате</th>
                                <th style={{ padding: '16px 20px', fontWeight: '900', color: '#2ecc71' }}>Прибыль</th>
                                <th style={{ padding: '16px 20px', fontWeight: '900', color: '#5C3A21', width: '200px' }}>Статус заказа</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.map((o) => {
                                const isExpanded = !!expandedOrders[o.id];
                                const orderCostPrice = calculateOrderCostPrice(o.items);
                                const orderProfit = (o.total_price || 0) - orderCostPrice;

                                // Преобразуем объект товаров конкретного заказа в массив
                                const currentOrderItems = o.items ? (Array.isArray(o.items) ? o.items : Object.values(o.items)) : [];

                                return (
                                    <React.Fragment key={o.id}>
                                        <tr style={{ borderBottom: '1px solid rgba(232, 195, 150, 0.3)', cursor: 'pointer', backgroundColor: isExpanded ? '#FAF3E8' : 'transparent' }} onClick={() => toggleOrder(o.id)}>
                                            <td style={{ padding: '16px 20px', textAlign: 'center' }}>
                                                {isExpanded ? <UpOutlined style={{ color: '#D97736' }} /> : <DownOutlined style={{ color: '#D97736' }} />}
                                            </td>
                                            <td style={{ padding: '16px 20px' }}>
                                                <div style={{ fontWeight: 'bold', color: '#5C3A21' }}>{o.user_name || 'Без имени'}</div>
                                                <div style={{ fontSize: '12px', color: '#8B5E3C' }}>
                                                    {new Date(o.created_at).toLocaleString('ru-RU')}
                                                </div>
                                            </td>
                                            <td style={{ padding: '16px 20px', fontSize: '14px' }}>
                                                {o.delivery_type === 'delivery' ? (
                                                    <span style={{ color: '#D97736', fontWeight: 'bold' }}><CarOutlined /> Курьер</span>
                                                ) : (
                                                    <span style={{ color: '#8B5E3C' }}><ShoppingOutlined /> Самовывоз</span>
                                                )}
                                            </td>
                                            <td style={{ padding: '16px 20px', fontWeight: 'bold', color: '#7f8c8d' }}>
                                                {Math.round(orderCostPrice)} ₽
                                            </td>
                                            <td style={{ padding: '16px 20px', fontWeight: '900', color: '#D97736', fontSize: '15px' }}>
                                                {o.total_price} ₽
                                            </td>
                                            <td style={{ padding: '16px 20px', fontWeight: '900', color: '#2ecc71', fontSize: '15px' }}>
                                                +{Math.round(orderProfit)} ₽
                                            </td>
                                            <td style={{ padding: '16px 20px' }} onClick={(e) => e.stopPropagation()}>
                                                <select 
                                                    value={o.status_id || 1} 
                                                    onChange={(e) => handleStatusChange(o.id, e.target.value)}
                                                    style={{ ...getStatusStyle(o.status_id || 1), border: 'none', outline: 'none', cursor: 'pointer', width: '100%' }}
                                                >
                                                    {statuses.map(st => (
                                                        <option key={st.id} value={st.id} style={{ color: '#5C3A21', backgroundColor: 'white' }}>
                                                            {st.label}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                        </tr>

                                        {/* Выпадающий список товаров */}
                                        {isExpanded && (
                                            <tr>
                                                <td colSpan="7" style={{ backgroundColor: '#FFFBF5', padding: '20px 40px', borderBottom: '1px solid #E8C396' }}>
                                                    <div style={{ padding: '15px', backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E8C396' }}>
                                                        <h4 style={{ margin: '0 0 12px 0', color: '#5C3A21', borderBottom: '1px solid #FAF3E8', paddingBottom: '6px' }}>
                                                            Состав заказа:
                                                        </h4>
                                                        
                                                        {currentOrderItems.length > 0 ? (
                                                            currentOrderItems.map((item, idx) => {
                                                                const prod = item.product || item;
                                                                const q = item.qty || item.quantity || 0;
                                                                const seriesName = (prod.series && prod.series !== '—') ? `(${prod.series})` : '';

                                                                return (
                                                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '14px', borderBottom: idx !== currentOrderItems.length - 1 ? '1px dashed #FAF3E8' : 'none' }}>
                                                                        <span style={{ color: '#5C3A21' }}>
                                                                            🔹 <b>{prod.manufacturer || 'Товар'}</b> {seriesName} — {prod.flavor || ''}
                                                                        </span>
                                                                        <span style={{ fontWeight: 'bold', color: '#8B5E3C' }}>
                                                                            {q} шт.
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })
                                                        ) : (
                                                            <div style={{ color: '#8B5E3C', fontSize: '13px' }}>Корзина заказа пуста</div>
                                                        )}

                                                        {o.address && (
                                                            <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #FAF3E8', fontSize: '13px', color: '#5C3A21' }}>
                                                                📍 <b>Адрес доставки:</b> {o.address}
                                                            </div>
                                                        )}
                                                        <div style={{ marginTop: '10px', fontSize: '13px', color: '#8B5E3C' }}>
                                                            <UserOutlined /> ID Покупателя: <code style={{ backgroundColor: '#FAF3E8', padding: '2px 6px', borderRadius: '4px' }}>{o.user_id}</code>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}