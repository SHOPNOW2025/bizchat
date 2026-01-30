
import React, { useState, useEffect, useRef } from 'react';
import { User, DashboardTab, Product, BusinessProfile, Message, FAQ } from '../types';
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
  Copy, 
  TrendingUp, 
  Users, 
  Save, 
  Send, 
  ChevronRight,
  Volume2,
  VolumeX,
  PhoneCall,
  Mic, 
  MicOff, 
  PhoneOff,
  CheckCircle2,
  ExternalLink,
  Link as LinkIcon,
  Image as ImageIcon,
  ChevronLeft,
  Bot,
  Menu,
  X,
  Instagram,
  Twitter,
  Facebook,
  MapPin,
  Phone,
  Camera,
  Loader2,
  Sparkles,
  ToggleLeft as ToggleOff,
  ToggleRight as ToggleOn
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

interface DashboardProps {
  user: User;
  setUser: (user: User) => void;
  onLogout: () => void;
}

interface ChatSession {
  id: string;
  customerName?: string;
  customerPhone?: string;
  lastText?: string;
  lastActive?: any;
  unreadCount?: number;
}

const IMGBB_API_KEY = 'a16fdd9aead1214d64e435c9b83a0c2e';

const Dashboard: React.FC<DashboardProps> = ({ user, setUser, onLogout }) => {
  const [activeTab, setActiveTab] = useState<DashboardTab>(DashboardTab.OVERVIEW);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [activeSessions, setActiveSessions] = useState<ChatSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState('');
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  
  const [newProduct, setNewProduct] = useState({ name: '', price: '', image: '' });
  const [newFAQ, setNewFAQ] = useState({ question: '', answer: '' });
  const [localProfile, setLocalProfile] = useState<BusinessProfile>(user.businessProfile);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setLocalProfile(user.businessProfile); }, [user.id]);

  const saveAllChanges = async () => {
    setIsSaving(true);
    try {
      const cleanSlug = localProfile.slug.toLowerCase().trim().replace(/[^\w-]/g, '');
      await sql`
        UPDATE profiles SET 
          name = ${localProfile.name}, 
          slug = ${cleanSlug}, 
          owner_name = ${localProfile.ownerName}, 
          description = ${localProfile.description || ''}, 
          phone = ${localProfile.phone}, 
          logo = ${localProfile.logo}, 
          location_url = ${localProfile.locationUrl || ''},
          social_links = ${JSON.stringify(localProfile.socialLinks)}, 
          products = ${JSON.stringify(localProfile.products)}, 
          faqs = ${JSON.stringify(localProfile.faqs || [])},
          currency = ${localProfile.currency}, 
          return_policy = ${localProfile.returnPolicy}, 
          delivery_policy = ${localProfile.deliveryPolicy},
          ai_enabled = ${localProfile.aiEnabled},
          ai_business_info = ${localProfile.aiBusinessInfo || ''}
        WHERE id = ${localProfile.id}
      `;
      
      const updatedUser = { ...user, businessProfile: { ...localProfile, slug: cleanSlug } };
      setUser(updatedUser);
      localStorage.setItem('bazchat_user', JSON.stringify(updatedUser));
      
      setShowSaveToast(true);
      setTimeout(() => setShowSaveToast(false), 3000);
    } catch (e) { 
      console.error(e);
      alert("حدث خطأ أثناء حفظ البيانات"); 
    } 
    finally { setIsSaving(false); }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'chat') => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: formData });
      const json = await response.json();
      if (json.success) {
        if (type === 'logo') setLocalProfile(prev => ({ ...prev, logo: json.data.url }));
        else if (type === 'chat' && selectedSession) {
           await sql`INSERT INTO chat_messages (session_id, sender, text) VALUES (${selectedSession}, 'owner', ${`IMAGE:${json.data.url}`})`;
        }
      }
    } catch (error) { alert('فشل رفع الصورة'); }
    finally { setIsUploading(false); }
  };

  const handleReply = async () => {
    if (!replyText.trim() || !selectedSession) return;
    const txt = replyText; setReplyText('');
    try {
      await sql`UPDATE chat_sessions SET last_text = ${`أنت: ${txt}`}, last_active = NOW() WHERE id = ${selectedSession}`;
      await sql`INSERT INTO chat_messages (session_id, sender, text, is_read, is_ai) VALUES (${selectedSession}, 'owner', ${txt}, TRUE, FALSE)`;
      setChatMessages(prev => [...prev, { id: Date.now().toString(), sender: 'owner', text: txt, timestamp: new Date(), isAi: false }]);
    } catch (e) {}
  };

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const sessions = await sql`
          SELECT s.id, s.customer_name as "customerName", s.customer_phone as "customerPhone", s.last_text as "lastText", s.last_active as "lastActive",
          COUNT(m.id) FILTER (WHERE m.sender = 'customer' AND m.is_read = FALSE) as "unreadCount"
          FROM chat_sessions s LEFT JOIN chat_messages m ON s.id = m.session_id
          WHERE s.profile_id = ${localProfile.id} GROUP BY s.id ORDER BY s.last_active DESC
        `;
        const data = sessions.map(s => ({ ...s, unreadCount: Number(s.unreadCount || 0) })) as ChatSession[];
        setActiveSessions(data);
        setTotalUnread(data.reduce((acc, curr) => acc + (curr.unreadCount || 0), 0));
      } catch (e) {}
    };
    fetchSessions();
    const interval = setInterval(fetchSessions, 5000); 
    return () => clearInterval(interval);
  }, [localProfile.id]);

  useEffect(() => {
    if (selectedSession) {
      const fetchMsgs = async () => {
        try {
          const msgs = await sql`SELECT id, sender, text, timestamp, is_read, is_ai FROM chat_messages WHERE session_id = ${selectedSession} ORDER BY timestamp ASC`;
          setChatMessages(msgs.map(m => ({ ...m, timestamp: new Date(m.timestamp), isAi: m.is_ai })) as Message[]);
          await sql`UPDATE chat_messages SET is_read = TRUE WHERE session_id = ${selectedSession} AND sender = 'customer' AND is_read = FALSE`;
        } catch (e) {}
      };
      fetchMsgs();
      const interval = setInterval(fetchMsgs, 3000);
      return () => clearInterval(interval);
    }
  }, [selectedSession]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  const renderContent = () => {
    switch (activeTab) {
      case DashboardTab.OVERVIEW:
        return (
          <div className="space-y-6 animate-in fade-in duration-500 pb-20 text-right">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard icon={<Users size={18} className="text-blue-500" />} label="زوار الصفحة" value="1,284" sub="+12%" />
              <StatCard icon={<MessageSquare size={18} className="text-green-500" />} label="محادثات" value={activeSessions.length.toString()} sub="+5%" />
              <StatCard icon={<Package size={18} className="text-orange-500" />} label="منتجات" value={localProfile.products.length.toString()} sub="نشط" />
              <StatCard icon={<TrendingUp size={18} className="text-purple-500" />} label="تحويل" value="3.2%" sub="-0.5%" />
            </div>
          </div>
        );
      case DashboardTab.MESSAGES:
        return (
          <div className="flex h-[calc(100vh-160px)] bg-white rounded-[40px] shadow-sm border overflow-hidden relative">
            <div className={`w-full md:w-80 border-l overflow-y-auto bg-gray-50/30 ${isMobileChatOpen ? 'hidden md:block' : 'block'}`}>
              <div className="p-6 border-b bg-white sticky top-0 z-10 flex items-center justify-between">
                <h3 className="font-bold text-[#0D2B4D]">المحادثات</h3>
              </div>
              {activeSessions.length === 0 ? <div className="p-10 text-center text-gray-400 text-sm font-bold">لا توجد رسائل بعد</div> : activeSessions.map(session => (
                <button key={session.id} onClick={() => { setSelectedSession(session.id); setIsMobileChatOpen(true); }} className={`w-full p-6 flex items-center gap-4 border-b text-right transition-colors ${selectedSession === session.id ? 'bg-white border-r-4 border-r-[#00D1FF]' : 'hover:bg-white'}`}>
                  <div className="w-12 h-12 rounded-[18px] bg-[#0D2B4D] text-white flex items-center justify-center font-bold text-lg shrink-0">{session.customerName?.substring(0, 1)}</div>
                  <div className="flex-1 overflow-hidden">
                    <div className="flex justify-between mb-1"><span className="font-bold text-sm truncate">{session.customerName || 'عميل'}</span></div>
                    <div className="flex justify-between items-center"><div className={`text-xs truncate ${session.unreadCount ? 'font-bold text-[#0D2B4D]' : 'text-gray-500'}`}>{session.lastText}</div></div>
                  </div>
                </button>
              ))}
            </div>
            <div className={`flex-1 flex flex-col bg-white ${isMobileChatOpen ? 'flex' : 'hidden md:flex'}`}>
              {selectedSession ? (
                <>
                  <div className="p-5 border-b flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <button onClick={() => setIsMobileChatOpen(false)} className="md:hidden p-2 bg-gray-100 rounded-xl"><ChevronRight size={20} /></button>
                      <span className="font-bold text-lg">{activeSessions.find(s=>s.id===selectedSession)?.customerName}</span>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/30">
                    {chatMessages.map(m => (
                      <div key={m.id} className={`flex ${m.sender==='owner'?'justify-start':'justify-end'}`}>
                        <div className={`max-w-[80%] p-5 rounded-[28px] text-sm font-medium shadow-sm relative ${m.sender==='owner'?'bg-[#0D2B4D] text-white rounded-tr-none':'bg-white border rounded-tl-none text-gray-800'}`}>
                          {m.isAi && <div className="flex items-center gap-1 mb-1 text-[#00D1FF] text-[8px] font-black uppercase tracking-wider"><Sparkles size={10} /> رد ذكي</div>}
                          {m.text.startsWith('IMAGE:') ? <img src={m.text.replace('IMAGE:', '')} className="rounded-2xl max-w-full max-h-[300px] object-cover" /> : <p>{m.text}</p>}
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                  <div className="p-6 border-t flex gap-3 items-center">
                    <input type="text" value={replyText} onChange={e=>setReplyText(e.target.value)} onKeyPress={e=>e.key==='Enter'&&handleReply()} placeholder="اكتب ردك هنا..." className="flex-1 px-6 py-4 rounded-3xl border bg-gray-50 outline-none focus:ring-2 focus:ring-[#00D1FF] font-bold" />
                    <button onClick={handleReply} className="w-14 h-14 bg-[#00D1FF] text-white rounded-3xl flex items-center justify-center shadow-xl hover:scale-105 transition-transform"><Send size={24} /></button>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 opacity-20"><MessageSquare size={100} /><p className="font-black mt-6 text-xl">اختر محادثة للبدء</p></div>
              )}
            </div>
          </div>
        );
      case DashboardTab.AI_SETTINGS:
        return (
          <div className="max-w-4xl space-y-8 animate-in slide-in-from-bottom-6 pb-40 text-right">
            <div className="bg-white p-10 rounded-[50px] shadow-sm border overflow-hidden">
              <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 bg-[#00D1FF]/10 rounded-3xl flex items-center justify-center text-[#00D1FF]"><Sparkles size={32} /></div>
                  <div>
                    <h3 className="text-2xl font-black text-[#0D2B4D]">الذكاء الاصطناعي (Z.AI)</h3>
                    <p className="text-gray-400 font-bold text-sm md:text-base leading-relaxed">درب البوت على معلومات عملك ليرد تلقائياً ويجمع الطلبات.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setLocalProfile(p => ({...p, aiEnabled: !p.aiEnabled}))}
                  className={`flex items-center gap-3 px-6 py-3 rounded-full font-black transition-all ${localProfile.aiEnabled ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'}`}
                >
                  {localProfile.aiEnabled ? <><ToggleOn size={24} /> مفعل</> : <><ToggleOff size={24} /> معطل</>}
                </button>
              </div>

              <div className="space-y-6">
                <div className="bg-blue-50 p-6 rounded-[32px] border border-blue-100">
                  <h4 className="text-[#0D2B4D] font-black mb-2 flex items-center gap-2"><Bot size={20} className="text-[#00D1FF]" /> تعليمات التدريب</h4>
                  <p className="text-sm text-blue-800 leading-relaxed font-bold">كلما زادت المعلومات، زادت دقة الردود. اذكر قائمة الأسعار، طرق الشحن، وتفاصيل الطلب.</p>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest">مساحة كتابة المعلومات (يستخدمها البوت للرد)</label>
                  <textarea 
                    className="w-full px-8 py-6 rounded-[40px] border bg-gray-50 outline-none focus:ring-4 focus:ring-[#00D1FF]/10 font-bold h-80 resize-none leading-loose text-lg" 
                    placeholder="مثال: نحن متجر بازشات. نبيع عطور فرنسية بأسعار تبدأ من 150 ريال. التوصيل مجاني للرياض. في حال العميل أراد الطلب اطلب منه تحديد الصنف والكمية..."
                    value={localProfile.aiBusinessInfo || ''}
                    onChange={(e) => setLocalProfile(p => ({...p, aiBusinessInfo: e.target.value}))}
                  />
                </div>
              </div>
            </div>
            <div className="fixed bottom-12 left-1/2 -translate-x-1/2 lg:mr-40 z-50">
              <button onClick={saveAllChanges} disabled={isSaving} className="bg-[#0D2B4D] text-white px-14 py-5 rounded-full font-black shadow-2xl flex items-center gap-4 hover:scale-105 transition-all disabled:opacity-50">{isSaving ? <Loader2 className="animate-spin" size={24} /> : <Save size={24} />} حفظ إعدادات الذكاء الاصطناعي</button>
            </div>
          </div>
        );
      case DashboardTab.CATALOG:
        return (
          <div className="space-y-6 animate-in slide-in-from-bottom-6 pb-40 text-right">
            <div className="flex justify-between items-center bg-white p-8 rounded-[40px] border shadow-sm">
              <div><h3 className="text-2xl font-black text-[#0D2B4D]">كتالوج المنتجات</h3></div>
              <button onClick={() => setIsAddProductModalOpen(true)} className="bg-[#00D1FF] text-white px-8 py-4 rounded-2xl font-black flex items-center gap-3 hover:scale-105 transition-transform"><Plus size={24} /> إضافة منتج</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {localProfile.products.map(product => (
                <div key={product.id} className="bg-white rounded-[40px] overflow-hidden shadow-sm border p-5 group">
                  <div className="aspect-square relative rounded-[32px] overflow-hidden bg-gray-50 mb-6">
                    <img src={product.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    <button onClick={() => removeProduct(product.id)} className="absolute top-4 left-4 p-3 bg-white/90 text-red-500 rounded-2xl"><Trash2 size={20} /></button>
                  </div>
                  <h4 className="font-black text-lg text-[#0D2B4D] truncate">{product.name}</h4>
                  <p className="text-[#00D1FF] font-black text-xl">{product.price} {localProfile.currency}</p>
                </div>
              ))}
            </div>
            <div className="fixed bottom-12 left-1/2 -translate-x-1/2 lg:mr-40 z-50">
              <button onClick={saveAllChanges} className="bg-[#0D2B4D] text-white px-14 py-5 rounded-full font-black shadow-2xl flex items-center gap-4 transition-all">حفظ التغييرات</button>
            </div>
          </div>
        );
      default: return null;
    }
  };

  const NavItem: React.FC<{active:boolean, onClick:()=>void, icon:React.ReactNode, label:string, badge?:number}> = ({ active, onClick, icon, label, badge }) => (
    <button onClick={onClick} className={`w-full flex items-center justify-between px-6 py-5 rounded-[26px] font-black transition-all ${active ? 'bg-[#00D1FF] text-white shadow-xl shadow-cyan-500/30' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
      <div className="flex items-center gap-4">{icon}{label}</div>
      {badge !== undefined && badge > 0 && <span className="bg-red-500 text-white text-[10px] w-6 h-6 rounded-full flex items-center justify-center">{badge}</span>}
    </button>
  );

  const StatCard: React.FC<{icon:React.ReactNode, label:string, value:string, sub:string}> = ({ icon, label, value, sub }) => (
    <div className="bg-white p-7 rounded-[40px] shadow-sm border border-gray-50 text-right">
      <div className="flex items-center gap-3 mb-5 justify-end"><span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">{label}</span><div className="p-3 bg-gray-50 rounded-2xl text-[#0D2B4D]">{icon}</div></div>
      <div className="text-3xl font-black text-[#0D2B4D] mb-1">{value}</div>
      <div className={`text-[11px] font-black ${sub.includes('+')?'text-green-500':'text-red-500'}`}>{sub}</div>
    </div>
  );

  const removeProduct = (id: string) => { setLocalProfile(p => ({ ...p, products: p.products.filter(prod => prod.id !== id) })); };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row font-tajawal text-right overflow-x-hidden">
      {isSidebarOpen && <div className="fixed inset-0 bg-black/60 z-[100] lg:hidden" onClick={() => setIsSidebarOpen(false)}></div>}
      <aside className={`w-80 bg-[#0D2B4D] text-white fixed h-full flex flex-col p-10 z-[110] transition-transform duration-300 lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}>
        <div className="flex items-center justify-between mb-16"><div className="flex items-center gap-4"><img src="https://i.ibb.co/XxVXdyhC/6.png" className="h-12"/><span className="text-2xl font-black">بازشات</span></div><button className="lg:hidden" onClick={() => setIsSidebarOpen(false)}><X size={28} /></button></div>
        <nav className="flex-1 space-y-3">
          <NavItem active={activeTab===DashboardTab.OVERVIEW} onClick={()=>{setActiveTab(DashboardTab.OVERVIEW); setIsSidebarOpen(false)}} icon={<LayoutDashboard size={22}/>} label="الرئيسية"/>
          <NavItem active={activeTab===DashboardTab.MESSAGES} onClick={()=>{setActiveTab(DashboardTab.MESSAGES); setIsSidebarOpen(false)}} icon={<MessageSquare size={22}/>} label="المحادثات" badge={totalUnread||undefined}/>
          <NavItem active={activeTab===DashboardTab.AI_SETTINGS} onClick={()=>{setActiveTab(DashboardTab.AI_SETTINGS); setIsSidebarOpen(false)}} icon={<Sparkles size={22}/>} label="الذكاء الاصطناعي"/>
          <NavItem active={activeTab===DashboardTab.CATALOG} onClick={()=>{setActiveTab(DashboardTab.CATALOG); setIsSidebarOpen(false)}} icon={<Package size={22}/>} label="المنتجات"/>
          <NavItem active={activeTab===DashboardTab.SETTINGS} onClick={()=>{setActiveTab(DashboardTab.SETTINGS); setIsSidebarOpen(false)}} icon={<Settings size={22}/>} label="الإعدادات"/>
        </nav>
        <button onClick={onLogout} className="mt-auto flex items-center gap-4 px-6 py-5 text-red-400 font-black"><LogOut size={22}/> خروج</button>
      </aside>
      <main className="flex-1 lg:mr-80 p-6 md:p-12 text-right w-full">
        <header className="lg:hidden flex items-center justify-between mb-8 bg-white p-5 rounded-[32px] border shadow-sm sticky top-4 z-40">
           <div className="flex items-center gap-3"><img src="https://i.ibb.co/XxVXdyhC/6.png" className="h-10"/><span className="text-xl font-black text-[#0D2B4D]">بازشات</span></div>
           <button onClick={() => setIsSidebarOpen(true)} className="p-3 bg-gray-50 rounded-2xl text-[#0D2B4D] border shadow-sm"><Menu size={28} /></button>
        </header>
        <header className="hidden lg:flex items-center justify-between mb-16">
          <div><h2 className="text-5xl font-black text-[#0D2B4D]">مرحباً، {localProfile.ownerName} 👋</h2><p className="text-gray-400 font-bold mt-3 text-lg">أنت تدير متجر <span className="text-[#00D1FF] font-black">{localProfile.name}</span></p></div>
          <div className="flex gap-4">
            <button onClick={()=>{navigator.clipboard.writeText(`${window.location.origin}/#/chat/${localProfile.slug||localProfile.id}`); alert('تم النسخ');}} className="bg-white border-2 border-gray-100 px-8 py-5 rounded-3xl font-black text-[#0D2B4D] flex items-center gap-3 shadow-sm hover:bg-gray-50"><Copy size={22}/> نسخ الرابط</button>
            <button onClick={()=>window.open(`${window.location.origin}/#/chat/${localProfile.slug||localProfile.id}`, '_blank')} className="bg-[#0D2B4D] text-white px-10 py-5 rounded-3xl font-black flex items-center gap-3 shadow-2xl hover:scale-105 transition-all"><ExternalLink size={22}/> معاينة المتجر</button>
          </div>
        </header>
        <div className="max-w-full">{renderContent()}</div>
      </main>
      {isAddProductModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-[#0D2B4D]/70 backdrop-blur-md" onClick={() => setIsAddProductModalOpen(false)}></div>
          <div className="relative bg-white w-full max-w-lg rounded-[50px] p-10 shadow-2xl text-right">
            <h3 className="text-2xl font-black mb-8 text-[#0D2B4D]">إضافة منتج جديد</h3>
            <div className="space-y-6">
              <input type="text" className="w-full px-6 py-4 rounded-2xl border bg-gray-50 outline-none font-black text-lg" placeholder="اسم المنتج" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
              <input type="number" className="w-full px-6 py-4 rounded-2xl border bg-gray-50 outline-none font-black text-lg" placeholder="السعر" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} />
              <input type="text" className="w-full px-6 py-4 rounded-2xl border bg-gray-50 outline-none font-bold" placeholder="رابط صورة المنتج" value={newProduct.image} onChange={e => setNewProduct({...newProduct, image: e.target.value})} />
            </div>
            <div className="flex gap-4 mt-10">
              <button onClick={() => { 
                if (!newProduct.name || !newProduct.price) return;
                setLocalProfile(p => ({ ...p, products: [...p.products, { id: `p_${Date.now()}`, name: newProduct.name, price: parseFloat(newProduct.price), description: '', image: newProduct.image || 'https://via.placeholder.com/150' }] }));
                setNewProduct({ name: '', price: '', image: '' });
                setIsAddProductModalOpen(false);
              }} className="flex-1 bg-[#00D1FF] text-white py-5 rounded-3xl font-black text-lg">تأكيد الإضافة</button>
              <button onClick={() => setIsAddProductModalOpen(false)} className="px-8 bg-gray-100 text-gray-500 py-5 rounded-3xl font-black">إلغاء</button>
            </div>
          </div>
        </div>
      )}
      {showSaveToast && <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-green-500 text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-3 z-[999] animate-in slide-in-from-top-12"><CheckCircle2 size={24} /> <span className="font-black text-lg">تم حفظ التعديلات بنجاح!</span></div>}
    </div>
  );
};

export default Dashboard;
