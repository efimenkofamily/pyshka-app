import React, { useState } from 'react';
import { supabase } from '../supabase';
import { 
    LeftOutlined, 
    CheckCircleOutlined, 
    EnvironmentOutlined,
    ShopOutlined,
    LoadingOutlined,
    PlusOutlined,
    MinusOutlined,
    DeleteOutlined
} from '@ant-design/icons';

export default function Checkout({ cart, setCart, products, config, goBack, reservedStock }) {
    const [deliveryType, setDeliveryType] = useState('pickup'); // 'pickup' или 'courier'
    const [address, setAddress] = useState('');
    const [comment, setComment] = useState('');
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const user = window.Telegram?.WebApp?.initDataUnsafe?.user;

    const calculatePricing = (product) => {
        let rawCost = product.price_10;
        if (typeof rawCost === 'string') rawCost = rawCost.replace(/[^0-9.,]/g, '').replace(',', '.');
        const costPrice = parseFloat(rawCost) || 0;
        const margin = (config?.category_margins && config.category_margins[product.category]) || config?.default_margin || 1.0;
        return Math.round(costPrice * margin);
    };

    // 🚀 === КОМПОНЕНТ ОДНОГО ТОВАРА СО СВАЙПОМ ===
    const CartItem = ({ id, qty, prod, price }) => {
        const [swipeOffset, setSwipeOffset] = useState(0);
        const [isSwiping, setIsSwiping] = useState(false);
        const [startX, setStartX] = useState(0);

        const MAX_SWIPE = -80; // Ширина кнопки удаления

        // Обработка тач-событий (свайп на мобилках)
        const handleTouchStart = (e) => {
            setStartX(e.touches[0].clientX);
            setIsSwiping(true);
        };

        const handleTouchMove = (e) => {
            if (!isSwiping) return;
            const currentX = e.touches[0].clientX;
            const diff = currentX - startX;
            // Разрешаем тянуть только влево до MAX_SWIPE
            if (diff < 0 && diff >= MAX_SWIPE) {
                setSwipeOffset(diff);
            }
        };

        const handleTouchEnd = () => {
            setIsSwiping(false);
            // Если протянули больше половины, фиксируем кнопку открытой
            if (swipeOffset < MAX_SWIPE / 2) {
                setSwipeOffset(MAX_SWIPE);
            } else {
                setSwipeOffset(0);
            }
        };

        // Изменение количества товара
        const updateQty = (delta) => {
            const availableQty = (prod?.stock_qty || 0) - (reservedStock[id] || 0);

            // Если пытаемся нажать "плюс", но лимит исчерпан
            if (delta > 0 && qty >= availableQty) {
                if (window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
                return;
            }

            setCart(prev => {
                const newCart = { ...prev };
                if (newCart[id] + delta >= 1) {
                    newCart[id] += delta;
                }
                return newCart;
            });
            if (window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
        };

        // Полное удаление товара (кнопка корзины)
        const removeItem = () => {
            setCart(prev => {
                const newCart = { ...prev };
                delete newCart[id];
                if (Object.keys(newCart).length === 0) goBack(); // Если корзина опустела, выкидываем в каталог
                return newCart;
            });
            if (window.Telegram?.WebApp?.HapticFeedback) window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
        };

        return (
            <div style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid #f0f2f5', marginBottom: '12px', paddingBottom: '12px' }}>
                
                {/* 🗑️ Кнопка удаления, спрятанная под свайпом (подложка) */}
                <div style={{ position: 'absolute', top: 0, right: 0, bottom: '12px', width: `${Math.abs(MAX_SWIPE)}px`, backgroundColor: '#e74c3c', borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'white', zIndex: 1 }}>
                    <DeleteOutlined style={{ fontSize: '20px' }} onClick={removeItem} />
                </div>

                {/* 📦 Основная карточка товара (подвижная часть) */}
                <div 
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    style={{ 
                        position: 'relative', 
                        zIndex: 2, 
                        backgroundColor: 'white', 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        transform: `translateX(${swipeOffset}px)`, 
                        transition: isSwiping ? 'none' : 'transform 0.2s ease-out' 
                    }}
                >
                    <div style={{ flexGrow: 1, paddingRight: '12px' }}>
                        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#2c3e50' }}>{prod.manufacturer} {prod.series !== '—' && `(${prod.series})`}</div>
                        <div style={{ fontSize: '12px', color: '#7f8c8d', marginTop: '2px' }}>{prod.flavor}</div>
                        <div style={{ fontSize: '14px', fontWeight: '900', color: '#2ecc71', marginTop: '4px' }}>{price} ₽ / шт</div>
                    </div>
                    
                    {/* Кнопки +/- */}
                    {/* Оборачиваем элементы управления в колонку */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#f8f9fa', padding: '4px', borderRadius: '20px' }}>
                            <button onClick={() => updateQty(-1)} style={{ width: '28px', height: '28px', borderRadius: '50%', border: 'none', backgroundColor: 'white', color: '#e74c3c', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                <MinusOutlined style={{ fontSize: '12px' }} />
                            </button>
                            
                            <span style={{ fontWeight: 'bold', fontSize: '14px', minWidth: '16px', textAlign: 'center' }}>{qty}</span>
                            
                            <button 
                                onClick={() => updateQty(1)} 
                                disabled={qty >= ((prod?.stock_qty || 0) - (reservedStock[id] || 0))}
                                style={{ width: '28px', height: '28px', borderRadius: '50%', border: 'none', backgroundColor: qty >= ((prod?.stock_qty || 0) - (reservedStock[id] || 0)) ? '#bdc3c7' : '#2ecc71', color: 'white', cursor: qty >= ((prod?.stock_qty || 0) - (reservedStock[id] || 0)) ? 'not-allowed' : 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                            >
                                <PlusOutlined style={{ fontSize: '12px' }} />
                            </button>
                        </div>

                        {/* 🚀 ПОДПИСЬ В КОРЗИНЕ */}
                        <span style={{ fontSize: '10px', color: qty >= ((prod?.stock_qty || 0) - (reservedStock[id] || 0)) ? '#e74c3c' : '#95a5a6', fontWeight: 'bold' }}>
                            {qty >= ((prod?.stock_qty || 0) - (reservedStock[id] || 0)) 
                                ? 'Больше нет' 
                                : `Осталось: ${((prod?.stock_qty || 0) - (reservedStock[id] || 0)) - qty} шт.`}
                        </span>

                    </div>
                </div>
            </div>
        );
    };

    const itemsTotal = Object.entries(cart).reduce((total, [id, qty]) => {
        const prod = products.find(p => p.id === id);
        return prod ? total + (calculatePricing(prod) * qty) : total;
    }, 0);

    let deliveryCost = 0;
    if (deliveryType === 'courier') {
        const threshold = config?.free_delivery_threshold || 5000;
        const baseCost = config?.delivery_cost || 300;
        if (itemsTotal < threshold) {
            deliveryCost = baseCost;
        }
    }

    const finalTotal = itemsTotal + deliveryCost;

    const handleSubmit = async () => {
        if (deliveryType === 'courier' && !address.trim()) {
            alert('Пожалуйста, укажите адрес доставки');
            return;
        }

        setIsSubmitting(true);

        try {
            const orderCart = {};
            Object.entries(cart).forEach(([id, qty]) => {
                const product = products.find(p => p.id === id);
                if (product) {
                    orderCart[id] = { qty, product };
                }
            });

            const newOrder = {
                user_id: user?.id || 999888777, 
                user_name: user ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Тестовый Офис ПК', 
                items: orderCart, 
                total_price: finalTotal, 
                delivery_type: deliveryType === 'pickup' ? 'pickup' : 'delivery', 
                address: deliveryType === 'pickup' ? 'Самовывоз' : address,
                status_id: 1 
            };

            if (comment.trim() && deliveryType === 'courier') {
                newOrder.address += ` (Комментарий: ${comment})`;
            }

            const { error } = await supabase.from('orders').insert([newOrder]);

            if (error) throw error;

            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            }

            setIsSuccess(true);
            setCart({}); 
        } catch (error) {
            console.error('Полная ошибка Supabase:', error);
            alert(`Ошибка базы данных: ${error.message || 'Проверьте консоль'}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    // 🚀 ЭКРАН УСПЕХА С ТВОИМ ТЕКСТОМ
    if (isSuccess) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8f9fa', padding: '20px', textAlign: 'center' }}>
                <CheckCircleOutlined style={{ fontSize: '64px', color: '#2ecc71', marginBottom: '20px' }} />
                <h1 style={{ color: '#2c3e50', marginBottom: '12px', fontSize: '24px', fontWeight: '900' }}>Заказ успешно оформлен!</h1>
                <p style={{ color: '#7f8c8d', marginBottom: '32px', fontSize: '15px', lineHeight: '1.5' }}>
                    Благодарим за заказ. Как только наш менеджер его обработает — вы получите уведомление о статусе заказа.
                </p>
                <button onClick={goBack} style={{ padding: '16px 32px', backgroundColor: '#2c3e50', color: 'white', border: 'none', borderRadius: '16px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', width: '100%' }}>Вернуться в каталог</button>
            </div>
        );
    }

    return (
        <div style={{ backgroundColor: '#f8f9fa', minHeight: '100vh', paddingBottom: '100px' }}>
            <div style={{ padding: '16px', backgroundColor: 'white', display: 'flex', alignItems: 'center', gap: '16px', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' }}>
                <button onClick={goBack} style={{ border: 'none', background: 'transparent', fontSize: '18px', color: '#2c3e50', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><LeftOutlined /></button>
                <h1 style={{ margin: 0, fontSize: '20px', color: '#2c3e50', fontWeight: '900' }}>Оформление заказа</h1>
            </div>

            <div style={{ padding: '16px' }}>
                <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '16px', marginBottom: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)', overflow: 'hidden' }}>
                    <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#2c3e50', margin: '0 0 16px 0' }}>Ваш заказ</h2>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {Object.entries(cart).map(([id, qty]) => {
                            const prod = products.find(p => p.id === id);
                            if (!prod) return null;
                            const price = calculatePricing(prod);
                            return (
                                <CartItem key={id} id={id} qty={qty} prod={prod} price={price} />
                            );
                        })}
                    </div>
                </div>

                <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '16px', marginBottom: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
                    <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#2c3e50', margin: '0 0 16px 0' }}>Способ получения</h2>
                    <div style={{ display: 'flex', gap: '10px', backgroundColor: '#f0f2f5', padding: '4px', borderRadius: '12px', marginBottom: deliveryType === 'courier' ? '16px' : '0' }}>
                        <button onClick={() => setDeliveryType('pickup')} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s', backgroundColor: deliveryType === 'pickup' ? 'white' : 'transparent', color: deliveryType === 'pickup' ? '#2c3e50' : '#7f8c8d', boxShadow: deliveryType === 'pickup' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><ShopOutlined /> Самовывоз</button>
                        <button onClick={() => setDeliveryType('courier')} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s', backgroundColor: deliveryType === 'courier' ? 'white' : 'transparent', color: deliveryType === 'courier' ? '#2c3e50' : '#7f8c8d', boxShadow: deliveryType === 'courier' ? '0 2px 8px rgba(0,0,0,0.05)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><EnvironmentOutlined /> Курьер</button>
                    </div>

                    {deliveryType === 'courier' && (
                        <div>
                            <input type="text" placeholder="Улица, дом, квартира..." value={address} onChange={(e) => setAddress(e.target.value)} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #ecf0f1', outline: 'none', boxSizing: 'border-box', fontSize: '14px', backgroundColor: '#f8f9fa' }} />
                            {config?.free_delivery_threshold > 0 && (
                                <div style={{ fontSize: '12px', color: '#7f8c8d', marginTop: '8px', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Доставка: {deliveryCost === 0 ? <span style={{color: '#2ecc71', fontWeight: 'bold'}}>Бесплатно</span> : `${deliveryCost} ₽`}</span>
                                    {deliveryCost > 0 && <span>Бесплатно от {config.free_delivery_threshold} ₽</span>}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div style={{ backgroundColor: 'white', borderRadius: '16px', padding: '16px', boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
                    <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#2c3e50', margin: '0 0 16px 0' }}>Комментарий к заказу</h2>
                    <textarea placeholder="Например: дойти до шлагбаума..." value={comment} onChange={(e) => setComment(e.target.value)} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #ecf0f1', outline: 'none', boxSizing: 'border-box', fontSize: '14px', backgroundColor: '#f8f9fa', minHeight: '80px', resize: 'vertical' }} />
                </div>
            </div>

            <div style={{ position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '361px', padding: '0 16px', boxSizing: 'border-box', zIndex: 100 }}>
                <button onClick={handleSubmit} disabled={isSubmitting} style={{ width: '100%', backgroundColor: '#2ecc71', color: 'white', border: 'none', padding: '16px', borderRadius: '16px', fontWeight: '900', fontSize: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0 8px 25px rgba(46, 204, 113, 0.4)', cursor: isSubmitting ? 'wait' : 'pointer', opacity: isSubmitting ? 0.7 : 1 }}>
                    <span>{isSubmitting ? <LoadingOutlined spin /> : 'Подтвердить заказ'}</span>
                    <span>{finalTotal} ₽</span>
                </button>
            </div>
        </div>
    );
}