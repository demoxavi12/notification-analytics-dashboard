import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  Filter,
  Plus,
  RefreshCw,
  Mail,
  Smartphone,
  MessageSquare,
  Trash2,
  CheckCircle,
} from 'lucide-react';
import { notificationsApi } from '../services/api';
import Badge from '../components/common/Badge';
import Modal from '../components/common/Modal';

const NotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [filterRead, setFilterRead] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [filterChannel, setFilterChannel] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  // New notification modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newNotif, setNewNotif] = useState({
    title: 'Cluster Node Scaling Event',
    message: 'Node us-east-worker-4 was automatically provisioned to handle peak traffic.',
    type: 'info',
    channel: 'in-app',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { refreshUnreadCount } = useOutletContext() || {};

  const fetchNotifications = async (page = 1) => {
    setIsLoading(true);
    try {
      const res = await notificationsApi.getNotifications({
        page,
        limit: pagination.limit,
        read: filterRead !== 'all' ? filterRead : undefined,
        type: filterType !== 'all' ? filterType : undefined,
        channel: filterChannel !== 'all' ? filterChannel : undefined,
      });

      setNotifications(res.data.data || []);
      setPagination(res.data.pagination);
      setUnreadCount(res.data.unreadCount || 0);
      if (refreshUnreadCount) refreshUnreadCount();
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications(1);
  }, [filterRead, filterType, filterChannel]);

  const handleMarkAsRead = async (id) => {
    try {
      await notificationsApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
      if (refreshUnreadCount) refreshUnreadCount();
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
      if (refreshUnreadCount) refreshUnreadCount();
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const handleDelete = async (id) => {
    try {
      await notificationsApi.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      if (refreshUnreadCount) refreshUnreadCount();
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  };

  const handleCreateNotification = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await notificationsApi.createNotification(newNotif);
      setIsModalOpen(false);
      fetchNotifications(1);
    } catch (err) {
      alert('Failed to dispatch notification: ' + (err.response?.data?.error?.message || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  const getChannelIcon = (channel) => {
    switch (channel) {
      case 'email':
        return <Mail size={14} />;
      case 'push':
        return <Smartphone size={14} />;
      case 'in-app':
      default:
        return <MessageSquare size={14} />;
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Notifications Center</h1>
          <p className="page-subtitle">
            System dispatch logs, multi-channel alerts, and read markers
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="btn btn-secondary btn-sm"
            >
              <CheckCheck size={14} /> Mark All as Read
            </button>
          )}
          <button
            onClick={() => fetchNotifications(pagination.page)}
            className="btn btn-secondary btn-sm"
          >
            <RefreshCw size={14} className={isLoading ? 'loading-spinner' : ''} />
            Refresh
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="btn btn-primary btn-sm"
          >
            <Plus size={14} /> Dispatch Notification
          </button>
        </div>
      </div>

      {/* Filter Tabs / Controls */}
      <div className="card" style={{ marginBottom: '20px', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          {/* Read status tabs */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={() => setFilterRead('all')}
              className={`btn btn-sm ${filterRead === 'all' ? 'btn-primary' : 'btn-outline'}`}
            >
              All Alerts
            </button>
            <button
              onClick={() => setFilterRead('false')}
              className={`btn btn-sm ${filterRead === 'false' ? 'btn-primary' : 'btn-outline'}`}
            >
              Unread {unreadCount > 0 && `(${unreadCount})`}
            </button>
            <button
              onClick={() => setFilterRead('true')}
              className={`btn btn-sm ${filterRead === 'true' ? 'btn-primary' : 'btn-outline'}`}
            >
              Read
            </button>
          </div>

          {/* Select filters */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Type:</span>
              <select
                className="select"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="all">All Types</option>
                <option value="info">Info</option>
                <option value="success">Success</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Channel:</span>
              <select
                className="select"
                value={filterChannel}
                onChange={(e) => setFilterChannel(e.target.value)}
              >
                <option value="all">All Channels</option>
                <option value="in-app">In-App</option>
                <option value="email">Email</option>
                <option value="push">Push</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '60px' }}>
            <div className="loading-spinner" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="card empty-state">
            <Bell className="empty-icon" />
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>
              No notifications found
            </div>
            <p style={{ fontSize: '13px', marginTop: '4px' }}>
              You're all caught up! No notifications match the selected filter.
            </p>
          </div>
        ) : (
          notifications.map((notif) => (
            <div
              key={notif._id}
              className="card"
              style={{
                padding: '16px 20px',
                backgroundColor: notif.read ? 'var(--bg-secondary)' : 'rgba(31, 41, 55, 0.7)',
                borderLeft: notif.read ? '1px solid var(--border-color)' : '4px solid var(--primary)',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flex: 1 }}>
                <div style={{ marginTop: '2px' }}>
                  <Badge type={notif.type}>{notif.type}</Badge>
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h3
                      style={{
                        fontSize: '15px',
                        fontWeight: notif.read ? 500 : 700,
                        color: 'var(--text-primary)',
                      }}
                    >
                      {notif.title}
                    </h3>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        backgroundColor: 'var(--bg-tertiary)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                      }}
                    >
                      {getChannelIcon(notif.channel)} {notif.channel}
                    </span>
                    <Badge type={notif.status}>{notif.status}</Badge>
                  </div>

                  <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                    {notif.message}
                  </p>

                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                    Sent on {new Date(notif.createdAt).toLocaleString()}
                    {notif.recipient?.name && ` • Recipient: ${notif.recipient.name}`}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {!notif.read && (
                  <button
                    onClick={() => handleMarkAsRead(notif._id)}
                    className="btn btn-outline btn-sm"
                    title="Mark as read"
                  >
                    <CheckCircle size={14} /> Mark Read
                  </button>
                )}
                <button
                  onClick={() => handleDelete(notif._id)}
                  className="btn btn-sm"
                  style={{
                    backgroundColor: 'transparent',
                    color: 'var(--text-muted)',
                    padding: '6px',
                    border: 'none',
                  }}
                  title="Delete notification"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Dispatch Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Dispatch Test Notification"
      >
        <form onSubmit={handleCreateNotification}>
          <div className="input-group">
            <label className="input-label">Title</label>
            <input
              type="text"
              className="input"
              value={newNotif.title}
              onChange={(e) => setNewNotif({ ...newNotif, title: e.target.value })}
              required
            />
          </div>

          <div className="input-group">
            <label className="input-label">Message</label>
            <textarea
              className="input"
              rows={3}
              value={newNotif.message}
              onChange={(e) => setNewNotif({ ...newNotif, message: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="input-group">
              <label className="input-label">Type</label>
              <select
                className="select"
                value={newNotif.type}
                onChange={(e) => setNewNotif({ ...newNotif, type: e.target.value })}
              >
                <option value="info">Info</option>
                <option value="success">Success</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">Channel</label>
              <select
                className="select"
                value={newNotif.channel}
                onChange={(e) => setNewNotif({ ...newNotif, channel: e.target.value })}
              >
                <option value="in-app">In-App</option>
                <option value="email">Email</option>
                <option value="push">Push Notification</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Dispatching...' : 'Dispatch Alert'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default NotificationsPage;
