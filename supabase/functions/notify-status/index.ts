import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Получаем токен из защищенного хранилища
const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');

serve(async (req) => {
  try {
    const payload = await req.json();

    // Проверяем, что это обновление таблицы orders
    if (payload.type === 'UPDATE' && payload.table === 'orders') {
      const oldRecord = payload.old_record;
      const newRecord = payload.record;

      // Отправляем сообщение ТОЛЬКО если статус изменился
      if (oldRecord.status_id !== newRecord.status_id) {
        // user_id в нашей базе — это и есть Telegram ID клиента
        const chatId = newRecord.user_id; 
        const orderId = newRecord.id.substring(0, 6).toUpperCase();

        // Базовые названия статусов (можно расширить)
        const statusMap: Record<number, string> = {
            1: '🟠 Новый',
            2: '🟡 Принят',
            3: '🔵 В сборке',
            4: '🟢 Готов к выдаче',
            5: '✅ Завершен'
        };
        const statusText = statusMap[newRecord.status_id] || `Обновлен на #${newRecord.status_id}`;

        const message = `🔔 <b>Обновление заказа #${orderId}</b>\n\nТекущий статус: ${statusText}`;

        // Отправляем запрос напрямую в Telegram API
        const tgUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        await fetch(tgUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML'
          })
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), { headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error(err);
    return new Response(String(err), { status: 500 });
  }
})
