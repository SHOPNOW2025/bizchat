
import React, { useState, useEffect, useRef } from 'react';
import { User, DashboardTab, Product, BusinessProfile, Message } from '../types';
import { sql } from '../neon';
import { 
  LayoutDashboard, 
  MessageSquare, 
  Package, 
  Palette, 
  Settings, 
  LogOut, 
  Plus, 
  Trash2, 
  ExternalLink,
  Copy,
  TrendingUp,
  Users,
  Save,
  Send,
  Instagram,
  Facebook,
  Twitter,
  MessageCircle,
  Globe,
  Camera,
  CheckCircle2
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

interface DashboardProps {
  user: User;
  setUser: (user: User) => void;
  onLogout: () => void;
}

interface ChatSession {
  id: string;
  lastText?: string;
  lastActive?: any;
}

const STATS_DATA = [
  { name: 'السبت', views: 400, chats: 240 },
  { name: 'الأحد', views: 300, chats: 139 },
  { name: 'الاثنين', views: 200, chats: 980 },
  { name: 'الثلاثاء', views: 278, chats: 390 },
  { name: 'الأربعاء', views: 189, chats: 480 },
  { name: 'الخميس', views: 239, chats: 380 },
  { name: 'الجمعة', views: 349, chats: 430 },
];

const Dashboard: React.FC<DashboardProps> = ({ user, setUser, onLogout }) => {
  const [activeTab, setActiveTab] = useState<DashboardTab>(DashboardTab.OVERVIEW);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [activeSessions, setActiveSessions] = useState<ChatSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [localProfile, setLocalProfile] = useState<BusinessProfile>(user.businessProfile);

  useEffect(() => {
    setLocalProfile(user.businessProfile);
  }, [user.businessProfile]);

  // Replacement for onSnapshot: Polling for Chat Sessions
  useEffect(() => {
    if (activeTab === DashboardTab.MESSAGES) {
      const fetchSessions = async () => {
        try {
          const sessions = await sql`
            SELECT id, last_text as "lastText", last_active as "lastActive" 
            FROM chat_sessions 
            WHERE profile_id = ${localProfile.id} 
            ORDER BY last_active DESC
          `;
          setActiveSessions(sessions as any);
        } catch (e) {
          console.error("Error fetching sessions", e);
        }
      };

      fetchSessions();
      const interval = setInterval(fetchSessions, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab, localProfile.id]);

  // Polling for Messages in Selected Session
  useEffect(() => {
    if (selectedSession) {
      const fetchMessages = async () => {
        try {
          const msgs = await sql`
            SELECT id, sender, text, timestamp 
            FROM chat_messages 
            WHERE session_id = ${selectedSession} 
            ORDER BY timestamp ASC
          `;
          setChatMessages(msgs.map(m => ({
            ...m,
            timestamp: new Date(m.timestamp)
          })) as Message[]);
        } catch (e) {
          console.error("Error fetching messages", e);
        }
      };

      fetchMessages();
      const interval = setInterval(fetchMessages, 3000);
      return () => clearInterval(interval);
    }
  }, [selectedSession]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const saveAllChanges = async () => {
    setIsSaving(true);
    try {
      await sql`
        UPDATE profiles SET
          name = ${localProfile.name},
          owner_name = ${localProfile.ownerName},
          description = ${localProfile.description || ''},
          phone = ${localProfile.phone},
          logo = ${localProfile.logo},
          social_links = ${JSON.stringify(localProfile.socialLinks)},
          products = ${JSON.stringify(localProfile.products)},
          currency = ${localProfile.currency},
          return_policy = ${localProfile.returnPolicy},
          delivery_policy = ${localProfile.deliveryPolicy}
        WHERE id = ${localProfile.id}
      `;
      
      const updatedUser = { ...user, businessProfile: localProfile };
      setUser(updatedUser);
      localStorage.setItem('bazchat_user', JSON.stringify(updatedUser));
      setShowSaveToast(true);
      setTimeout(() => setShowSaveToast(false), 3000);
    } catch (e) {
      console.error("Error saving data", e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReply = async () => {
    if (!replyText.trim() || !selectedSession) return;
    const text = replyText;
    setReplyText('');
    try {
      await sql`
        UPDATE chat_sessions SET 
          last_text = ${`أنت: ${text}`},
          last_active = NOW()
        WHERE id = ${selectedSession}
      `;

      await sql`
        INSERT INTO chat_messages (session_id, sender, text)
        VALUES (${selectedSession}, 'owner', ${text})
      `;
      
      // Immediate local update for better UX
      setChatMessages(prev => [...prev, {
        id: Date.now().toString(),
        sender: 'owner',
        text: text,
        timestamp: new Date()
      }]);
    } catch (e) {
      console.error("Error sending reply", e);
    }
  };

  const copyChatLink = () => {
    const url = `${window.location.origin}${window.location.pathname}#/chat/${localProfile.id}`;
    navigator.clipboard.writeText(url).then(() => {
      alert('تم نسخ الرابط!');
    });
  };

  const renderContent = () => {
    switch (activeTab) {
      case DashboardTab.OVERVIEW:
        return (
          <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={<Users size={18} className="text-blue-500" />} label="زوار الصفحة" value="1,284" sub="+12%" />
              <StatCard icon={<MessageSquare size={18} className="text-green-500" />} label="محادثات" value={activeSessions.length.toString()} sub="+5%" />
              <StatCard icon={<Package size={18} className="text-orange-500" />} label="منتجات" value={localProfile.products.length.toString()} sub="نشط" />
              <StatCard icon={<TrendingUp size={18} className="text-purple-500" />} label="تحويل" value="3.2%" sub="-0.5%" />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-3xl shadow-sm border">
                <h3 className="text-md font-bold mb-4 text-[#0D2B4D]">نشاط المحادثات</h3>
                <div className="h-[250px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={STATS_DATA}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" /><YAxis /><Tooltip /><Bar dataKey="chats" fill="#00D1FF" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
              </div>
              <div className="bg-white p-6 rounded-3xl shadow-sm border">
                <h3 className="text-md font-bold mb-4 text-[#0D2B4D]">عدد الزيارات</h3>
                <div className="h-[250px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={STATS_DATA}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" /><YAxis /><Tooltip /><Line type="monotone" dataKey="views" stroke="#0D2B4D" strokeWidth={3} dot={false} /></LineChart></ResponsiveContainer></div>
              </div>
            </div>
          </div>
        );

      case DashboardTab.MESSAGES:
        return (
          <div className="flex h-[calc(100vh-200px)] bg-white rounded-3xl shadow-sm border overflow-hidden animate-in slide-in-from-bottom-4">
            <div className="w-full md:w-80 border-l overflow-y-auto bg-gray-50/30">
              <div className="p-5 border-b bg-white sticky top-0 z-10"><h3 className="font-bold text-[#0D2B4D]">صندوق الوارد</h3></div>
              {activeSessions.length === 0 ? (
                <div className="p-10 text-center text-gray-400 text-sm">لا توجد رسائل</div>
              ) : (
                activeSessions.map(session => (
                  <button 
                    key={session.id}
                    onClick={() => setSelectedSession(session.id)}
                    className={`w-full p-5 flex items-center gap-4 hover:bg-white transition-all border-b group ${selectedSession === session.id ? 'bg-white border-r-4 border-r-[#00D1FF]' : ''}`}
                  >
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#0D2B4D] to-blue-900 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-lg">
                      {session.id.substring(0, 3).toUpperCase()}
                    </div>
                    <div className="text-right flex-1 overflow-hidden">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-sm text-[#0D2B4D]">عميل {session.id.substring(0, 4)}</span>
                        <span className="text-[9px] text-gray-400">
                          {session.lastActive ? new Date(session.lastActive).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 truncate font-medium">{session.lastText}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
            <div className="hidden md:flex flex-1 flex-col bg-white">
              {selectedSession ? (
                <>
                  <div className="p-5 border-b flex items-center justify-between bg-white">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-[#0D2B4D] text-xs">U</div>
                      <span className="font-bold text-[#0D2B4D]">محادثة العميل ({selectedSession.substring(0, 4)})</span>
                    </div>
                    <span className="px-3 py-1 bg-green-50 text-green-600 rounded-full text-[10px] font-bold">نشط</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] bg-gray-50/50">
                    {chatMessages.map(msg => (
                      <div key={msg.id} className={`flex ${msg.sender === 'owner' ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[75%] p-4 rounded-2xl text-sm shadow-sm ${msg.sender === 'owner' ? 'bg-[#0D2B4D] text-white rounded-tr-none' : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'}`}>
                          {msg.text}
                          <div className={`text-[9px] mt-2 opacity-60 text-left`}>
                            {msg.timestamp?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                  <div className="p-5 border-t bg-white">
                    <div className="flex gap-3">
                      <input 
                        type="text" 
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleReply()}
                        placeholder="اكتب ردك هنا للعميل..."
                        className="flex-1 px-5 py-3 rounded-2xl border bg-gray-50 outline-none focus:ring-2 focus:ring-[#00D1FF] transition-all text-sm"
                      />
                      <button onClick={handleReply} className="w-12 h-12 bg-[#00D1FF] text-white rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/30 hover:scale-105 active:scale-95 transition-all"><Send size={20} /></button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50/30">
                  <MessageSquare size={64} className="mb-4 opacity-10" />
                  <p className="font-bold text-gray-400">اختر محادثة من القائمة للبدء</p>
                </div>
              )}
            </div>
          </div>
        );

      default:
        return <div>يرجى اختيار علامة تبويب</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row font-tajawal">
      {showSaveToast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 z-[999] animate-in slide-in-from-top-10">
          <CheckCircle2 size={18} />
          <span className="font-bold text-sm">تم حفظ التغييرات بنجاح!</span>
        </div>
      )}

      <aside className="w-72 bg-[#0D2B4D] text-white fixed h-full hidden lg:flex flex-col p-8 z-40">
        <div className="flex items-center gap-3 mb-12 px-2">
          <img src="https://i.ibb.co/XxVXdyhC/6.png" alt="Logo" className="h-10" />
          <span className="text-xl font-extrabold tracking-tight">بازشات</span>
        </div>
        <nav className="flex-1 space-y-2">
          <NavItem active={activeTab === DashboardTab.OVERVIEW} onClick={() => setActiveTab(DashboardTab.OVERVIEW)} icon={<LayoutDashboard size={20} />} label="الرئيسية" />
          <NavItem active={activeTab === DashboardTab.MESSAGES} onClick={() => setActiveTab(DashboardTab.MESSAGES)} icon={<MessageSquare size={20} />} label="المحادثات" />
          <NavItem active={activeTab === DashboardTab.CATALOG} onClick={() => setActiveTab(DashboardTab.CATALOG)} icon={<Package size={20} />} label="المنتجات" />
          <NavItem active={activeTab === DashboardTab.CUSTOMIZE} onClick={() => setActiveTab(DashboardTab.CUSTOMIZE)} icon={<Palette size={20} />} label="تخصيص الهوية" />
          <NavItem active={activeTab === DashboardTab.SETTINGS} onClick={() => setActiveTab(DashboardTab.SETTINGS)} icon={<Settings size={20} />} label="الإعدادات" />
        </nav>
        <button onClick={onLogout} className="mt-auto flex items-center gap-3 px-4 py-4 text-red-400 hover:bg-red-500/10 rounded-2xl transition-colors font-bold"><LogOut size={20} /> الخروج</button>
      </aside>

      <div className="lg:hidden bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-2">
          <img src="https://i.ibb.co/XxVXdyhC/6.png" alt="Logo" className="h-8" />
          <span className="font-extrabold text-[#0D2B4D]">بازشات</span>
        </div>
        <div className="flex gap-3">
          <button onClick={copyChatLink} className="p-2.5 bg-gray-50 rounded-xl text-gray-500 border"><Copy size={18} /></button>
          <button onClick={() => window.open(`${window.location.origin}${window.location.pathname}#/chat/${localProfile.id}`, '_blank')} className="p-2.5 bg-[#00D1FF] rounded-xl text-white shadow-lg shadow-cyan-500/30"><ExternalLink size={18} /></button>
        </div>
      </div>

      <main className="flex-1 lg:mr-72 p-6 md:p-10 lg:p-16">
        <header className="hidden lg:flex flex-row items-center justify-between gap-4 mb-12">
          <div>
            <h2 className="text-4xl font-black text-[#0D2B4D]">مرحباً، {localProfile.ownerName}</h2>
            <p className="text-gray-500 mt-2 font-medium">لوحة تحكم متجر <span className="text-[#00D1FF] font-black">{localProfile.name}</span></p>
          </div>
          <div className="flex gap-4">
            <button onClick={copyChatLink} className="bg-white border text-gray-700 px-8 py-4 rounded-2xl font-bold flex items-center gap-2 hover:bg-gray-50 transition-all shadow-sm"><Copy size={20} /> نسخ الرابط</button>
            <button onClick={() => window.open(`${window.location.origin}${window.location.pathname}#/chat/${localProfile.id}`, '_blank')} className="bg-[#00D1FF] text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-2 shadow-xl shadow-cyan-500/40 hover:scale-105 transition-all"><ExternalLink size={20} /> معاينة الصفحة</button>
          </div>
        </header>
        {renderContent()}
      </main>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around items-center p-3 z-50 shadow-2xl">
        <MobileNavItem active={activeTab === DashboardTab.OVERVIEW} onClick={() => setActiveTab(DashboardTab.OVERVIEW)} icon={<LayoutDashboard size={22} />} label="الرئيسية" />
        <MobileNavItem active={activeTab === DashboardTab.MESSAGES} onClick={() => setActiveTab(DashboardTab.MESSAGES)} icon={<MessageSquare size={22} />} label="الرسائل" />
        <MobileNavItem active={activeTab === DashboardTab.CATALOG} onClick={() => setActiveTab(DashboardTab.CATALOG)} icon={<Package size={22} />} label="المنتجات" />
        <MobileNavItem active={activeTab === DashboardTab.CUSTOMIZE} onClick={() => setActiveTab(DashboardTab.CUSTOMIZE)} icon={<Palette size={22} />} label="الهوية" />
        <MobileNavItem active={activeTab === DashboardTab.SETTINGS} onClick={() => setActiveTab(DashboardTab.SETTINGS)} icon={<Settings size={22} />} label="الإعدادات" />
      </nav>
    </div>
  );
};

const NavItem: React.FC<{active: boolean, onClick: () => void, icon: React.ReactNode, label: string}> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl font-bold transition-all ${active ? 'bg-[#00D1FF] text-white shadow-lg shadow-cyan-500/20 scale-[1.02]' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>{icon}{label}</button>
);

const MobileNavItem: React.FC<{active: boolean, onClick: () => void, icon: React.ReactNode, label: string}> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-all ${active ? 'text-[#00D1FF]' : 'text-gray-400'}`}>{icon}<span className="text-[10px] font-bold uppercase">{label}</span></button>
);

const StatCard: React.FC<{icon: React.ReactNode, label: string, value: string, sub: string}> = ({ icon, label, value, sub }) => (
  <div className="bg-white p-5 rounded-[32px] shadow-sm border border-gray-100"><div className="flex items-center gap-2 mb-3"><div className="p-2 bg-gray-50 rounded-xl">{icon}</div><span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{label}</span></div><div><div className="text-2xl font-black text-[#0D2B4D] mb-0.5">{value}</div><div className={`text-[10px] font-bold ${sub.includes('+') ? 'text-green-500' : 'text-red-500'}`}>{sub}</div></div></div>
);

export default Dashboard;
