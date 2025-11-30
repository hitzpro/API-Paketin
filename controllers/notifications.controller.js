import { NotificationModel } from "../models/notification.model.js";

// --- INTERNAL HELPER (Untuk dipanggil Controller Lain) ---
export const createNotification = async (userId, title, message, type = 'info') => {
    try {
        await NotificationModel.create({ userId, title, message, type });
        // TODO: Web Push Logic Here
    } catch (err) {
        console.error("Gagal buat notif:", err);
    }
};

// --- PUBLIC ENDPOINTS ---

// GET Notifications
export const getNotifications = async (req, res) => {
    const { user_id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    try {
        const { data, error, count } = await NotificationModel.getByUser(user_id, from, to);

        if (error) throw error;

        return res.json({
            data,
            page,
            has_next: to < (count - 1)
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// Mark as Read
export const markAsRead = async (req, res) => {
    const { id } = req.params;
    try {
        const { error } = await NotificationModel.markAsRead(id);
        if (error) throw error;
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};

// Delete Notification
export const deleteNotification = async (req, res) => {
    const { id } = req.params;
    try {
        const { error } = await NotificationModel.delete(id);
        if (error) throw error;
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
};