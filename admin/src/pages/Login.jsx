import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import TelegramWidget from '../components/TelegramWidget';

export default function Login() {
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleTelegramAuth = async (tgUser) => {
        setLoading(true);
        setError('');

        try {
            // Ищем пользователя в базе
            const { data, error: sbError } = await supabase
                .from('users')
                .select('*')
                .eq('id', tgUser.id)
                .single();

            if (sbError || !data) {
                setError('Пользователь не найден в базе данных.');
                setLoading(false);
                return;
            }

            // ПУСКАЕМ ТОЛЬКО РАЗРАБОТЧИКОВ
            if (data.status === 'developer') {
                localStorage.setItem('admin_user', JSON.stringify(data));
                navigate('/dashboard'); // Успех! Идем в панель
            } else {
                setError(`Доступ запрещен. Твой статус: ${data.status}. Панель только для разработчиков.`);
            }

        } catch (err) {
            console.error('Ошибка входа:', err);
            setError('Произошла ошибка при связи с сервером.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '100px', fontFamily: 'sans-serif' }}>
            <h1 style={{ color: '#5C3A21' }}>Клуб Пышка</h1>
            <p style={{ color: '#8B5E3C', marginBottom: '30px' }}>Панель разработчика</p>
            
            {loading ? (
                <p style={{ fontWeight: 'bold' }}>Проверка доступов...</p>
            ) : (
                <TelegramWidget 
                    botName="pyshka_club_bot" // <-- ЗАМЕНИ НА ИМЯ ТВОЕГО БОТА!
                    onAuth={handleTelegramAuth} 
                />
            )}

            {error && (
                <div style={{ color: 'white', background: '#FF3B30', padding: '10px 20px', borderRadius: '8px', marginTop: '20px', fontWeight: 'bold' }}>
                    {error}
                </div>
            )}
        </div>
    );
}