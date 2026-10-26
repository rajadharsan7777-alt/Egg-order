import React from 'react';
import { NotificationItem } from '../types/eggFarm';
import { Bell, CheckCheck, Clock, ExternalLink, X, Volume2 } from 'lucide-react';
import { playNewOrderChime } from '../utils/audioAlert';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onMarkAllRead: () => void;
  onSelectOrder: (orderId: string) => void;
  language: 'en' | 'ta';
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAllRead,
  onSelectOrder,
  language,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-4 bg-stone-900/40 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden border border-stone-200 mt-14 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-stone-200 flex items-center justify-between bg-stone-50">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-800" />
            <h3 className="font-bold text-stone-900 text-sm">
              {language === 'ta' ? 'புதிய ஆர்டர் அறிவிப்புகள்' : 'New Order Alerts'}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => playNewOrderChime()}
              className="p-1.5 text-stone-500 hover:text-stone-900 rounded-md hover:bg-stone-200/60 transition-colors"
              title="Test notification sound chime"
            >
              <Volume2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-stone-800 rounded-md hover:bg-stone-200/60 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Action bar */}
        <div className="px-4 py-2 bg-stone-100/70 border-b border-stone-200/80 flex items-center justify-between text-xs">
          <span className="text-stone-600 font-medium">
            {notifications.filter(n => !n.read).length} unread alerts
          </span>
          {notifications.length > 0 && (
            <button
              onClick={onMarkAllRead}
              className="text-amber-800 hover:text-amber-950 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Mark all read</span>
            </button>
          )}
        </div>

        {/* Notifications list */}
        <div className="overflow-y-auto flex-1 divide-y divide-stone-100 p-2">
          {notifications.length === 0 ? (
            <div className="text-center py-10 text-stone-400 text-xs">
              No new order notifications yet.
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => {
                  onSelectOrder(notif.orderId);
                  onClose();
                }}
                className={`p-3 rounded-xl transition-all cursor-pointer space-y-1 hover:bg-stone-50 ${
                  !notif.read ? 'bg-amber-50/50 border-l-2 border-amber-800' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-xs text-stone-900">
                    {notif.orderId}
                  </span>
                  <span className="text-[10px] text-stone-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="text-xs text-stone-700 font-medium">
                  New egg order from <strong className="text-stone-900">{notif.customerName}</strong>
                </div>
                <div className="flex items-center justify-between text-[11px] text-stone-500 pt-0.5">
                  <span>{notif.totalEggs} eggs ordered</span>
                  <span className="font-bold text-emerald-800 tabular-nums">₹{notif.totalAmount}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
