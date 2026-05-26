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
    PieChartOutlined,
    MoreOutlined, 
    EditOutlined, 
    DeleteOutlined, 
    SearchOutlined, 
    PlusOutlined, 
    MinusOutlined, 
    CloseOutlined, 
    SaveOutlined,
    LoadingOutlined
} from '@ant-design/icons';

export default function Orders() {
    const [orders, setOrders] = useState([]);
    const [statuses, setStatuses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedOrders, setExpandedOrders] = useState({});
    const [activeMenuOrderId, setActiveMenuOrderId] = useState(null); // ID заказа, у которого открыты три точки
    const [editingOrder, setEditingOrder] = useState(null);           // Копия заказа, который мы прямо сейчас редактируем в модальном окне
    const [allProducts, setAllProducts] = useState([]);               // Весь список товаров из БД для поиска замен
    const [config, setConfig] = useState(null);                       // Конфиг наценок для правильного пересчета розничной цены
    const [searchQuery, setSearchQuery] = useState('');               // Текст поиска товара внутри модалки

    // Загрузка заказов, статусов, товаров и конфига
    const fetchData = async () => {
        setLoading(true);
        try {
            const [ordersRes, statusesRes, prodRes, configRes] = await Promise.all([
                supabase.from('orders').select('*').order('created_at', { ascending: false }),
                supabase.from('order_statuses').select('*').order('sort_order'),
                supabase.from('products').select('*').eq('availability', 'есть'),
                supabase.from('config').select('*').eq('id', 1).single()
            ]);

            if (ordersRes.error) throw ordersRes.error;
            if (statusesRes.error) throw statusesRes.error;

            setOrders(ordersRes.data || []);
            setStatuses(statusesRes.data || []);
            setAllProducts(prodRes.data || []);
            setConfig(configRes.data || null);
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
            alert('Не удалось загрузить данные заказов');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        // Закрывать трехточечное меню при клике в любое место экрана
        const handleGlobalClick = () => setActiveMenuOrderId(null);
        window.addEventListener('click', handleGlobalClick);
        return () => window.removeEventListener('click', handleGlobalClick);
    }, []);

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

    // === ЛОГИКА РЕДАКТИРОВАНИЯ И УДАЛЕНИЯ ЗАКАЗА ===
    const handleDeleteOrder = async (orderId) => {
        const isConfirmed = window.confirm(`Удалить заказ №${orderId.substring(0,6).toUpperCase()}?`);
        if (!isConfirmed) return;
        try {
            const { error } = await supabase.from('orders').delete().eq('id', orderId);
            if (error) throw error;
            setOrders(prev => prev.filter(o => o.id !== orderId));
        } catch (err) {
            console.error(err);
            alert('Не удалось удалить заказ');
        }
    };

    const handleStartEdit = (order) => {
        setEditingOrder(JSON.parse(JSON.stringify(order)));
        setSearchQuery('');
    };

    const calculateRetailPrice = (product) => {
        if (!product || !product.price_10) return 0;
        const cleanPrice = parseFloat(product.price_10.toString().replace(/[^0-9.,]/g, '').replace(',', '.'));
        if (isNaN(cleanPrice)) return 0;
        const margin = config?.category_margins?.[product.category] || config?.default_margin || 1.7;
        return Math.round(cleanPrice * margin);
    };

    const updateOrderTotal = (updatedItems) => {
        let itemsSum = 0;
        Object.values(updatedItems).forEach(item => {
            const price = calculateRetailPrice(item.product);
            itemsSum += price * (item.qty || 1);
        });
        let finalTotal = itemsSum;
        if (editingOrder.delivery_type === 'delivery' && config && itemsSum < (config.free_delivery_threshold || 5000)) {
            finalTotal += (config.delivery_cost || 350);
        }
        setEditingOrder(prev => ({ ...prev, items: updatedItems, total_price: finalTotal }));
    };

    const handleQtyChange = (productId, delta) => {
        const updatedItems = { ...editingOrder.items };
        if (!updatedItems[productId]) return;
        updatedItems[productId].qty += delta;
        if (updatedItems[productId].qty <= 0) delete updatedItems[productId];
        updateOrderTotal(updatedItems);
    };

    const handleRemoveItem = (productId) => {
        const updatedItems = { ...editingOrder.items };
        delete updatedItems[productId];
        updateOrderTotal(updatedItems);
    };

    const handleAddItemToOrder = (product) => {
        const updatedItems = { ...(editingOrder.items || {}) };
        if (updatedItems[product.id]) {
            updatedItems[product.id].qty += 1;
        } else {
            updatedItems[product.id] = { qty: 1, product: { ...product } };
        }
        updateOrderTotal(updatedItems);
        setSearchQuery('');
    };

    const handleSaveOrderEdit = async () => {
        try {
            const { error } = await supabase.from('orders')
                .update({ items: editingOrder.items, total_price: editingOrder.total_price })
                .eq('id', editingOrder.id);
            if (error) throw error;
            setOrders(prev => prev.map(o => o.id === editingOrder.id ? editingOrder : o));
            setEditingOrder(null);
        } catch (err) {
            console.error(err);
            alert('Не удалось сохранить изменения');
        }
    };
    // === КОНЕЦ ЛОГИКИ РЕДАКТИРОВАНИЯ ===
    
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
                                <th style={{ padding: '16px 20px', width: '50px' }}></th>
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
                                            {/* КНОПКА 3 ТОЧКИ С МЕНЮШКОЙ */}
                                            <td style={{ position: 'relative', textAlign: 'right', paddingRight: '20px' }}>
                                                <button 
                                                    onClick={(e) => { e.stopPropagation(); setActiveMenuOrderId(activeMenuOrderId === o.id ? null : o.id); }}
                                                    style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#8B5E3C', padding: '4px 8px' }}
                                                >
                                                    <MoreOutlined />
                                                </button>
                                                {activeMenuOrderId === o.id && (
                                                    <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', right: '40px', top: '10px', backgroundColor: 'white', borderRadius: '10px', boxShadow: '0 6px 20px rgba(0,0,0,0.15)', zIndex: 100, display: 'flex', flexDirection: 'column', border: '1px solid #f0f2f5', minWidth: '160px' }}>
                                                        <button onClick={() => { handleStartEdit(o); setActiveMenuOrderId(null); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 18px', border: 'none', background: 'transparent', fontSize: '13px', fontWeight: 'bold', color: '#2c3e50', cursor: 'pointer', textAlign: 'left' }}><EditOutlined style={{ color: '#3498db' }} /> Редактировать</button>
                                                        <button onClick={() => { handleDeleteOrder(o.id); setActiveMenuOrderId(null); }} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 18px', border: 'none', borderTop: '1px solid #f0f2f5', background: 'transparent', fontSize: '13px', fontWeight: 'bold', color: '#e74c3c', cursor: 'pointer', textAlign: 'left' }}><DeleteOutlined /> Удалить заказ</button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>

                                        {/* Выпадающий список товаров */}
                                        {isExpanded && (
                                            <tr>
                                                <td colSpan="8" style={{ backgroundColor: '#FFFBF5', padding: '20px 40px', borderBottom: '1px solid #E8C396' }}>
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

            {/* ===================== МОДАЛЬНОЕ ОКНО РЕДАКТИРОВАНИЯ ЗАКАЗА ===================== */}
            {editingOrder && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(44, 62, 80, 0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
                    <div style={{ backgroundColor: 'white', width: '850px', height: '650px', borderRadius: '20px', boxShadow: '0 15px 50px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        
                        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f0f2f5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: '#2c3e50' }}>Редактирование заказа №{editingOrder.id.substring(0,6).toUpperCase()}</h2>
                                <span style={{ fontSize: '13px', color: '#7f8c8d' }}>Покупатель: <b>{editingOrder.user_name}</b> | Доставка: {editingOrder.delivery_type === 'pickup' ? '🏪 Самовывоз' : '🚗 Курьер'}</span>
                            </div>
                            <button onClick={() => setEditingOrder(null)} style={{ border: 'none', background: 'transparent', fontSize: '18px', cursor: 'pointer', color: '#95a5a6' }}><CloseOutlined /></button>
                        </div>

                        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                            {/* ЛЕВАЯ КОЛОНКА */}
                            <div style={{ width: '55%', borderRight: '1px solid #f0f2f5', padding: '20px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                                <h3 style={{ margin: '0 0 14px 0', fontSize: '14px', fontWeight: 'bold', color: '#7f8c8d', textTransform: 'uppercase' }}>Состав заказа</h3>
                                {Object.keys(editingOrder.items || {}).length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '40px', color: '#95a5a6', fontSize: '13px' }}>Заказ пуст. Добавьте товары справа.</div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                        {Object.entries(editingOrder.items).map(([id, item]) => (
                                            <div key={id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8f9fa', padding: '12px', borderRadius: '12px', border: '1px solid #f0f2f5' }}>
                                                <div style={{ flex: 1, paddingRight: '10px' }}>
                                                    <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#2c3e50' }}>{item.product?.manufacturer}</div>
                                                    <div style={{ fontSize: '12px', color: '#7f8c8d' }}>{item.product?.series !== '—' && `${item.product?.series} | `}{item.product?.flavor}</div>
                                                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#D97736', marginTop: '4px' }}>{calculateRetailPrice(item.product)} ₽ / шт</div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '14px' }}>
                                                    <button onClick={() => handleQtyChange(id, -1)} style={{ width: '24px', height: '24px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: 'white', cursor: 'pointer' }}><MinusOutlined style={{ fontSize: '10px' }} /></button>
                                                    <span style={{ fontWeight: 'bold', fontSize: '14px', minWidth: '20px', textAlign: 'center' }}>{item.qty}</span>
                                                    <button onClick={() => handleQtyChange(id, 1)} style={{ width: '24px', height: '24px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: 'white', cursor: 'pointer' }}><PlusOutlined style={{ fontSize: '10px' }} /></button>
                                                </div>
                                                <button onClick={() => handleRemoveItem(id)} style={{ border: 'none', background: 'transparent', color: '#e74c3c', cursor: 'pointer', fontSize: '14px' }}><DeleteOutlined /></button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* ПРАВАЯ КОЛОНКА */}
                            <div style={{ width: '45%', padding: '20px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 'bold', color: '#7f8c8d', textTransform: 'uppercase' }}>Добавить замену</h3>
                                <div style={{ position: 'relative', marginBottom: '14px' }}>
                                    <SearchOutlined style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#95a5a6' }} />
                                    <input 
                                        type="text"
                                        placeholder="Поиск товара..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: '10px', border: '1px solid #ecf0f1', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                                    />
                                </div>
                                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }} className="no-scrollbar">
                                    {searchQuery.trim().length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '40px', color: '#95a5a6', fontSize: '12px' }}>Введите название вкуса или бренда</div>
                                    ) : allProducts.filter(p => `${p.manufacturer} ${p.series} ${p.flavor}`.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 30).map(product => (
                                        <div key={product.id} onClick={() => handleAddItemToOrder(product)} style={{ padding: '10px 12px', backgroundColor: '#fdfaf6', border: '1px solid #faebcc', borderRadius: '10px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div style={{ flex: 1, paddingRight: '8px' }}>
                                                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#2c3e50' }}>{product.manufacturer} {product.series !== '—' && `(${product.series})`}</div>
                                                <div style={{ fontSize: '11px', color: '#7f8c8d', marginTop: '2px' }}>{product.flavor}</div>
                                            </div>
                                            <div style={{ textAlign: 'right', minWidth: '70px' }}>
                                                <div style={{ fontSize: '12px', fontWeight: '900', color: '#2ecc71' }}>{calculateRetailPrice(product)} ₽</div>
                                                <span style={{ fontSize: '9px', backgroundColor: '#e8f8f0', color: '#2ecc71', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold', display: 'inline-block', marginTop: '2px' }}>+ Добавить</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* ПОДВАЛ */}
                        <div style={{ padding: '16px 24px', borderTop: '1px solid #f0f2f5', backgroundColor: '#f8f9fa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <span style={{ fontSize: '12px', color: '#7f8c8d', fontWeight: 'bold', textTransform: 'uppercase' }}>Новая сумма к оплате:</span>
                                <div style={{ fontSize: '22px', fontWeight: '900', color: '#2ecc71' }}>{editingOrder.total_price} ₽</div>
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button onClick={() => setEditingOrder(null)} style={{ padding: '12px 20px', borderRadius: '12px', border: '1px solid #cbd5e1', backgroundColor: 'white', color: '#64748b', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer' }}>Отмена</button>
                                <button onClick={handleSaveOrderEdit} style={{ padding: '12px 24px', borderRadius: '12px', border: 'none', backgroundColor: '#D97736', color: 'white', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}><SaveOutlined /> Сохранить изменения</button>
                            </div>
                        </div>

                    </div>
                </div>
            )}

        </div>
    );
}