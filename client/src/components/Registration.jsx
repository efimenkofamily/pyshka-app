import React, { useState } from 'react';
import { supabase } from '../supabase';
import { LoadingOutlined, CheckCircleOutlined } from '@ant-design/icons';

export default function Registration({ onComplete }) {
    const user = window.Telegram?.WebApp?.initDataUnsafe?.user;
    
    // Предзаполняем имя из Телеграма, если оно есть
    const defaultName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : '';
    
    const [fullName, setFullName] = useState(defaultName);
    const [source, setSource] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!fullName.trim() || !source.trim()) {
            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('error');
            }
            alert('Пожалуйста, заполните все поля');
            return;
        }

        setIsSubmitting(true);
        const userId = user?.id || 999888777; // Реальный ID или тестовый для ПК

        try {
            const newUser = {
                id: userId,
                username: user?.username || 'unknown',
                full_name: fullName.trim(),
                source: source.trim(),
                status: 'pending' // Новый юзер всегда уходит на модерацию
            };

            const { error } = await supabase.from('users').insert([newUser]);

            if (error) throw error;

            if (window.Telegram?.WebApp?.HapticFeedback) {
                window.Telegram.WebApp.HapticFeedback.notificationOccurred('success');
            }
            
            // Говорим главному компоненту, что анкета успешно отправлена
            onComplete();
            
        } catch (error) {
            console.error('Ошибка при регистрации:', error);
            alert('Не удалось отправить анкету. Попробуйте еще раз.');
            setIsSubmitting(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f8f9fa', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', boxSizing: 'border-box' }}>
            
            <div style={{ backgroundColor: 'white', padding: '32px 24px', borderRadius: '24px', width: '100%', maxWidth: '360px', boxShadow: '0 8px 30px rgba(0,0,0,0.04)', textAlign: 'center' }}>
                <div style={{ width: '64px', height: '64px', backgroundColor: '#2ecc71', borderRadius: '20px', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '0 auto 20px auto', boxShadow: '0 4px 15px rgba(46, 204, 113, 0.3)' }}>
                    <CheckCircleOutlined style={{ fontSize: '32px', color: 'white' }} />
                </div>
                
                <h1 style={{ margin: '0 0 8px 0', fontSize: '22px', fontWeight: '900', color: '#2c3e50' }}>Клуб Пышка</h1>
                <p style={{ margin: '0 0 24px 0', fontSize: '14px', color: '#7f8c8d', lineHeight: '1.5' }}>
                    Добро пожаловать! Чтобы получить доступ к каталогу, пожалуйста, заполните небольшую анкету.
                </p>

                <div style={{ textAlign: 'left', marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#2c3e50', marginBottom: '8px' }}>Ваше имя</label>
                    <input 
                        type="text" 
                        placeholder="Как к вам обращаться?" 
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid #ecf0f1', fontSize: '14px', outline: 'none', backgroundColor: '#f8f9fa', boxSizing: 'border-box' }}
                    />
                </div>

                <div style={{ textAlign: 'left', marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#2c3e50', marginBottom: '8px' }}>Откуда узнали о нас?</label>
                    <input 
                        type="text" 
                        placeholder="Например: от друга, из канала..." 
                        value={source}
                        onChange={(e) => setSource(e.target.value)}
                        style={{ width: '100%', padding: '14px 16px', borderRadius: '12px', border: '1px solid #ecf0f1', fontSize: '14px', outline: 'none', backgroundColor: '#f8f9fa', boxSizing: 'border-box' }}
                    />
                </div>

                <button 
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    style={{ width: '100%', padding: '16px', backgroundColor: '#2ecc71', color: 'white', border: 'none', borderRadius: '16px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 15px rgba(46, 204, 113, 0.3)', display: 'flex', justifyContent: 'center', alignItems: 'center', opacity: isSubmitting ? 0.7 : 1 }}
                >
                    {isSubmitting ? <LoadingOutlined spin /> : 'Отправить заявку'}
                </button>
            </div>
            
        </div>
    );
}