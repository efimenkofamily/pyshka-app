import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users'; // <-- ИМПОРТ Пользователей
import Orders from './pages/Orders'; // <-- ИМПОРТ Заказов
import Settings from './pages/Settings'; // <-- ИМПОРТ НАСТРОЕК
import Products from './pages/Products'; // <-- ИМПОРТ ТОВАРОВ
import Layout from './components/Layout';


function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/users" element={<Users />} />
          <Route path="/orders" element={<Orders />} />
          <Route path="/products" element={<Products />} /> {/* <-- ПОДКЛЮЧИЛИ ТОВАРЫ */}
          <Route path="/settings" element={<Settings />} /> {/* <-- ПОДКЛЮЧИЛИ НАСТРОЙКИ */}
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
