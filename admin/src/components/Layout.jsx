import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
    DashboardOutlined, 
    InboxOutlined, 
    TeamOutlined, 
    SettingOutlined, 
    LogoutOutlined,
    AppstoreOutlined 
} from '@ant-design/icons';

export default function Layout() {
    const navigate = useNavigate();
    const location = useLocation();
    
    // Достаем данные юзера
    const userString = localStorage.getItem('admin_user');
    const user = userString ? JSON.parse(userString) : null;

    const handleLogout = () => {
        localStorage.removeItem('admin_user');
        navigate('/login');
    };

    // Массив с нашими новыми иконками
    const menuItems = [
        { path: '/dashboard', label: 'Дашборд', icon: <DashboardOutlined /> },
        { path: '/orders', label: 'Заказы', icon: <InboxOutlined /> },
        { path: '/users', label: 'Пользователи', icon: <TeamOutlined /> },
        { path: '/products', label: 'Товары', icon: <AppstoreOutlined /> },
        { path: '/settings', label: 'Настройки', icon: <SettingOutlined /> }
    ];

    return (
        <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: '#FFF8EE', fontFamily: 'sans-serif', color: '#5C3A21', overflow: 'hidden' }}>
            
            {/* ЛЕВОЕ МЕНЮ (SIDEBAR) */}
            <div style={{ width: '260px', backgroundColor: 'white', borderRight: '1px solid rgba(232, 195, 150, 0.4)', display: 'flex', flexDirection: 'column', padding: '24px', boxSizing: 'border-box', boxShadow: '2px 0 10px rgba(92, 58, 33, 0.05)' }}>
                <div style={{ fontSize: '24px', fontWeight: '900', marginBottom: '40px', color: '#D97736', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '28px' }}>🐶</span> Пышка Pro
                </div>
                
                <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {menuItems.map(item => {
                        const isActive = location.pathname === item.path;
                        return (
                            <Link 
                                key={item.path} 
                                to={item.path}
                                style={{ 
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    padding: '14px 16px', 
                                    textDecoration: 'none', 
                                    color: isActive ? 'white' : '#5C3A21', 
                                    backgroundColor: isActive ? '#D97736' : 'transparent',
                                    borderRadius: '12px',
                                    fontWeight: isActive ? 'bold' : 'normal',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                <span style={{ fontSize: '18px', display: 'flex' }}>{item.icon}</span>
                                {item.label}
                            </Link>
                        );
                    })}
                </div>

                {/* ПРОФИЛЬ И ВЫХОД */}
                <div style={{ borderTop: '1px solid rgba(232, 195, 150, 0.4)', paddingTop: '20px', marginTop: '20px' }}>
                    <div style={{ fontSize: '15px', fontWeight: '900', marginBottom: '4px' }}>{user?.full_name || user?.username}</div>
                    <div style={{ fontSize: '12px', color: '#8B5E3C', marginBottom: '16px', fontWeight: 'bold' }}>
                        {user?.status === 'developer' ? '💻 Разработчик' : '👑 Администратор'}
                    </div>
                    <button 
                        onClick={handleLogout}
                        style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            gap: '8px',
                            width: '100%', 
                            padding: '12px', 
                            backgroundColor: '#fff', 
                            color: '#FF3B30', 
                            border: '1px solid rgba(255, 59, 48, 0.3)', 
                            borderRadius: '12px', 
                            cursor: 'pointer', 
                            fontWeight: 'bold',
                            transition: '0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 59, 48, 0.05)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                    >
                        <LogoutOutlined /> Выйти
                    </button>
                </div>
            </div>

            {/* ПРАВАЯ ЧАСТЬ (РАБОЧАЯ ЗОНА) */}
            <div style={{ flexGrow: 1, padding: '40px', overflowY: 'auto', boxSizing: 'border-box', position: 'relative' }}>
                <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                    <Outlet />
                </div>
            </div>
        </div>
    );
}