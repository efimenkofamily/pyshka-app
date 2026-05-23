import { useEffect, useRef } from 'react';

export default function TelegramWidget({ botName, onAuth }) {
    const containerRef = useRef(null);

    useEffect(() => {
        // Глобальная функция, которую вызовет Telegram после успешного входа
        window.onTelegramAuth = (user) => {
            if (onAuth) onAuth(user);
        };

        const script = document.createElement('script');
        script.src = 'https://telegram.org/js/telegram-widget.js?22';
        script.setAttribute('data-telegram-login', botName);
        script.setAttribute('data-size', 'large');
        script.setAttribute('data-request-access', 'write');
        script.setAttribute('data-onauth', 'onTelegramAuth(user)');
        script.async = true;

        if (containerRef.current) {
            containerRef.current.appendChild(script);
        }

        return () => {
            if (containerRef.current) {
                containerRef.current.innerHTML = '';
            }
            delete window.onTelegramAuth;
        };
    }, [botName, onAuth]);

    return <div ref={containerRef}></div>;
}