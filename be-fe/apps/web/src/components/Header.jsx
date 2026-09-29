import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

const Header = ({ onSearch }) => {

  // 🔥 STATE HELP
  const [showHelp, setShowHelp] = useState(false);

  // 🔥 AUTH
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // 🔥 STATE SEARCH
  const [search, setSearch] = useState("");

  // 🔥 STATE NOTIF
  const [notifications, setNotifications] = useState([]);
  const [showNotif, setShowNotif] = useState(false);
  const unreadCount = notifications.filter(n => !n.isRead).length;
  const notifRef = useRef(null);

  // fetch notifications
  const fetchNotifications = async () => {
    try {
      const token = user?.token || JSON.parse(localStorage.getItem("user"))?.token;
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:3001'}/api/v1/notifications`, { headers });
      if (!res.ok) return;
      const json = await res.json();
      if (json.success) {
        setNotifications(json.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, [user]);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotif(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);


  return (
    <header className="relative flex items-center justify-between px-8 py-3 ml-64 w-[calc(100%-16rem)] sticky top-0 z-30 bg-[#0b1326]/60 backdrop-blur-md h-16 border-b border-white/5 shadow-none">

      {/* 🔍 Search Bar */}
      <div className="flex items-center bg-surface-container-lowest px-4 py-2 rounded-lg outline outline-1 outline-outline-variant/30 focus-within:outline-primary/50 focus-within:shadow-[0_4px_20px_rgba(124,58,237,0.15)] transition-all duration-300 w-96">
        <span className="material-symbols-outlined text-on-surface-variant mr-3 text-sm">search</span>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && search.trim() !== "") {
              // 1. Jika halaman saat ini memiliki fitur onSearch (seperti Violations)
              if (onSearch) {
                onSearch(search);
              }
              // 2. Jika tidak ada (misal di Dashboard), jadikan Global Redirector ke Peta!
              else {
                navigate(`/map?search=${encodeURIComponent(search)}`);
              }
            }
          }}
          className="bg-transparent border-none focus:ring-0 text-sm text-on-surface w-full placeholder:text-on-surface-variant/50"
          placeholder="Search coordinates, districts..."
          type="text"
        />
      </div>

      {/* Actions & Profile */}
      <div className="flex items-center gap-4">

        {/* 🔔 NOTIFICATIONS */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotif(!showNotif)}
            className="relative p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined">notifications</span>
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full outline outline-2 outline-[#0b1326]"></span>
            )}
          </button>

          {/* DROPDOWN NOTIFICATIONS */}
          {showNotif && (
            <div className="absolute top-14 right-0 w-80 bg-[#1e293b] rounded-xl shadow-2xl border border-white/10 z-50 overflow-hidden">
              <div className="p-4 border-b border-white/10 flex justify-between items-center bg-slate-800/50">
                <h3 className="font-bold text-white text-sm">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-medium">
                    {unreadCount} New
                  </span>
                )}
              </div>
              <div className="max-h-[320px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm">
                    No new notifications
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`p-4 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer flex gap-3 ${!notif.isRead ? 'bg-white/[0.02]' : ''}`}
                    >
                      <div className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${notif.type === 'CRITICAL' ? 'bg-red-500/20 text-red-400' :
                          notif.type === 'WARNING' ? 'bg-amber-500/20 text-amber-400' :
                            'bg-blue-500/20 text-blue-400'
                        }`}>
                        <span className="material-symbols-outlined text-sm">
                          {notif.type === 'CRITICAL' ? 'warning' :
                            notif.type === 'WARNING' ? 'error_outline' :
                              'info'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm truncate ${notif.type === 'CRITICAL' ? 'text-red-400 font-medium' : 'text-slate-200'}`}>
                          {notif.title}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                          {notif.message}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-2 font-medium uppercase tracking-wider">
                          {new Date(notif.time).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="p-2 border-t border-white/10 bg-slate-800/50">
                <button
                  className="w-full py-2 text-xs font-medium text-slate-300 hover:text-white transition-colors"
                  onClick={() => setShowNotif(false)}
                >
                  Mark all as read
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ❓ HELP */}
        <button
          onClick={() => setShowHelp(!showHelp)}
          className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
        >
          <span className="material-symbols-outlined">help_outline</span>
        </button>

        {/* POPUP HELP */}
        {showHelp && (
          <div className="absolute top-16 right-6 w-96 bg-[#1e293b] text-white p-5 rounded-xl shadow-2xl border border-white/10 z-50 text-sm space-y-4">

            <h2 className="text-lg font-bold text-primary-container">Zonify Help</h2>

            <p className="text-gray-300 leading-relaxed">
              Selamat datang di Zonify! Sistem ini dirancang untuk membantumu memantau dan
              menganalisis kepadatan lokasi ritel agar sesuai dengan aturan zonasi jarak ideal.
              Lewat platform ini, kamu bisa melihat gambaran besar data di{' '}
              <span className="text-white font-semibold">Dashboard</span>, mengecek titik lokasi
              spesifik beserta radius amannya melalui{' '}
              <span className="text-white font-semibold">Map</span>, dan mengidentifikasi area mana
              saja yang sudah terlalu padat di halaman{' '}
              <span className="text-white font-semibold">Rankings</span>.
            </p>

            <p className="text-gray-300 leading-relaxed">
              Jika ada lokasi yang jaraknya terlalu berdekatan atau tumpang tindih, sistem akan
              otomatis mendeteksinya sebagai pelanggaran dan mencatatnya di menu{' '}
              <span className="text-white font-semibold">Violations</span> serta{' '}
              <span className="text-white font-semibold">Audit Logs</span>. Intinya, Zonify hadir
              untuk memberikan insight yang jelas agar kamu bisa mencegah terjadinya
              over-saturasi ritel di suatu wilayah.
            </p>

          </div>
        )}

        <div className="h-6 w-px bg-outline-variant/30 mx-2"></div>

        {/* 🔥 PROFILE */}
        <button
          onClick={() => {
            if (!user) {
              navigate("/login");
            } else {
              logout();
            }
          }}
          className="flex items-center gap-3 hover:bg-white/5 p-1 pr-3 rounded-lg transition-colors group"
        >
          {/* Avatar: foto jika ada, fallback ke inisial */}
          <div className="relative w-8 h-8 flex-shrink-0">
            {user?.avatar ? (
              <img
                alt={user?.name || "Profile"}
                className="w-8 h-8 rounded-md object-cover border border-outline-variant/30"
                src={user.avatar}
              />
            ) : (
              <div className="w-8 h-8 rounded-md border border-outline-variant/30 bg-violet-600/80 flex items-center justify-center text-white text-sm font-bold uppercase">
                {(user?.name || user?.email || "?").charAt(0)}
              </div>
            )}
          </div>

          {/* Nama & Badge Role */}
          <div className="flex flex-col items-start leading-tight">
            <span className="text-sm font-semibold text-white">
              {user?.name || user?.email || "Guest"}
            </span>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${(user?.roleId === 1 || user?.isAdmin)
              ? "bg-violet-500/20 text-violet-300"
              : "bg-slate-500/20 text-slate-400"
              }`}>
              {user?.role?.name ? user.role.name.toUpperCase() : (user?.isAdmin ? "Admin" : "User")}
            </span>
          </div>
        </button>

      </div>
    </header>
  );
};

export default Header;