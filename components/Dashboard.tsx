
import React, { useState, useEffect, useRef } from 'react';
import { User, DashboardTab, Product, BusinessProfile, Message } from '../types';
import { sql } from '../neon';
import { GoogleGenAI } from "@google/genai";
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
  CheckCircle2,
  ChevronRight,
  X,
  Image as ImageIcon,
  Link as LinkIcon,
  Info,
  Sparkles // أيقونة الذكاء الاصطناعي
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
  const [isGeneratingMeta, setIsGeneratingMeta] = useState(false);
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [activeSessions, setActiveSessions] = useState<ChatSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState('');
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  
  const [newProduct, setNewProduct] = useState({ name: '', price: '', image: '' });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [localProfile, setLocalProfile] = useState<BusinessProfile>(user.businessProfile);

  useEffect(() => {
    setLocalProfile(user.businessProfile);
  }, [user.id]);

  // Polling for Chat Sessions
  useEffect(() => {
    if (activeTab === DashboardTab.MESSAGES || activeTab === DashboardTab.OVERVIEW) {
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

  const generateMetaDescription = async (name: string, bio: string) => {
    try {
      setIsGeneratingMeta(true);
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `أنت خبير سيو (SEO) محترف. قم بكتابة وصف ميتا (Meta Description) جذاب واحترافي باللغة العربية لمتجر يدعى "${name}". النبذة التعريفية للمتجر هي: "${bio}". 
      الشروط:
      1. يجب أن يكون الطول بين 120 إلى 150 حرفاً.
      2. يجب أن يتضمن دعوة لاتخاذ إجراء (Call to action) مثل "تواصل معنا" أو "اكتشف منتجاتنا".
      3. لا تضف أي نص توضيحي، فقط اكتب الوصف مباشرة.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      return response.text?.trim() || "";
    } catch (error) {
      console.error("AI Meta generation failed", error);
      return `${name} - تواصل معنا مباشرة عبر صفحة الدردشة الخاصة بنا واكتشف أحدث منتجاتنا وخدماتنا.`;
    } finally {
      setIsGeneratingMeta(false);
    }
  };

  const saveAllChanges = async () => {
    setIsSaving(true);
    try {
      const cleanSlug = localProfile.slug.toLowerCase().trim().replace(/[^\w-]/g, '');
      if (!cleanSlug) {
        alert("الرابط المخصص لا يمكن أن يكون فارغاً.");
        setIsSaving(false);
        return;
      }

      // إنشاء وصف الميتا تلقائياً إذا كان هناك تغيير في الاسم أو الوصف أو إذا كان فارغاً
      let finalMeta = localProfile.metaDescription;
      if (!finalMeta || localProfile.name !== user.businessProfile.name || localProfile.description !== user.businessProfile.description) {
        finalMeta = await generateMetaDescription(localProfile.name, localProfile.description || '');
      }

      await sql`
        UPDATE profiles SET
          name = ${localProfile.name},
          slug = ${cleanSlug},
          owner_name = ${localProfile.ownerName},
          description = ${localProfile.description || ''},
          meta_description = ${finalMeta},
          phone = ${localProfile.phone},
          logo = ${localProfile.logo},
          social_links = ${JSON.stringify(localProfile.socialLinks)},
          products = ${JSON.stringify(localProfile.products)},
          currency = ${localProfile.currency},
          return_policy = ${localProfile.returnPolicy},
          delivery_policy = ${localProfile.deliveryPolicy}
        WHERE id = ${localProfile.id}
      `;
      
      const updatedProfile = { ...localProfile, slug: cleanSlug, metaDescription: finalMeta };
      const updatedUser = { ...user, businessProfile: updatedProfile };
      setLocalProfile(updatedProfile);
      setUser(updatedUser);
      localStorage.setItem('bazchat_user', JSON.stringify(updatedUser));
      setShowSaveToast(true);
      setTimeout(() => setShowSaveToast(false), 3000);
    } catch (e: any) {
      console.error("Error saving data", e);
      if (e.message.includes('unique constraint')) {
        alert("عذراً، هذا الرابط المخصص مستخدم من قبل متجر آخر. يرجى اختيار اسم آخر.");
      } else {
        alert("حدث خطأ أثناء الحفظ، يرجى المحاولة مرة أخرى.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddProduct = () => {
    if (!newProduct.name || !newProduct.price) {
      alert("يرجى إدخال اسم المنتج وسعره على الأقل.");
      return;
    }

    const productToAdd: Product = {
      id: Date.now().toString(),
      name: newProduct.name,
      price: Number(newProduct.price),
      description: '',
      image: newProduct.image || 'https://picsum.photos/seed/' + Math.random() + '/400/400'
    };

    setLocalProfile(prev => ({
      ...prev,
      products: [...prev.products, productToAdd]
    }));

    setNewProduct({ name: '', price: '', image: '' });
    setIsAddProductModalOpen(false);
  };

  const handleSelectSession = (sessionId: string) => {
    setSelectedSession(sessionId);
    setIsMobileChatOpen(true);
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

  const getPublicChatUrl = () => {
    const identifier = localProfile.slug || localProfile.id;
    return `${window.location.origin}${window.location.pathname}#/chat/${identifier}`;
  };

  const copyChatLink = () => {
    const url = getPublicChatUrl();
    navigator.clipboard.writeText(url).then(() => {
      alert('تم نسخ الرابط المخصص لمتجرك!');
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
          <div className="flex h-[calc(100vh-180px)] md:h-[calc(100vh-200px)] bg-white rounded-3xl shadow-sm border overflow-hidden animate-in slide-in-from-bottom-4">
            <div className={`w-full md:w-80 border-l overflow-y-auto bg-gray-50/30 ${isMobileChatOpen ? 'hidden md:block' : 'block'}`}>
              <div className="p-5 border-b bg-white sticky top-0 z-10">
                <h3 className="font-bold text-[#0D2B4D]">صندوق الوارد</h3>
              </div>
              {activeSessions.length === 0 ? (
                <div className="p-10 text-center text-gray-400 text-sm">لا توجد رسائل</div>
              ) : (
                activeSessions.map(session => (
                  <button 
                    key={session.id}
                    onClick={() => handleSelectSession(session.id)}
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

            <div className={`flex-1 flex flex-col bg-white ${isMobileChatOpen ? 'flex' : 'hidden md:flex'}`}>
              {selectedSession ? (
                <>
                  <div className="p-4 border-b flex items-center justify-between bg-white shadow-sm z-10">
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setIsMobileChatOpen(false)}
                        className="md:hidden p-2 -mr-2 text-gray-400 hover:text-[#0D2B4D]"
                      >
                        <ChevronRight size={24} />
                      </button>
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-[#0D2B4D] text-xs">U</div>
                      <div>
                        <span className="block font-bold text-[#0D2B4D] text-sm md:text-base">عميل ({selectedSession.substring(0, 4)})</span>
                        <span className="block text-[10px] text-green-500 font-bold">نشط الآن</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-5 md:p-8 space-y-6 bg-gray-50/50">
                    {chatMessages.map(msg => (
                      <div key={msg.id} className={`flex ${msg.sender === 'owner' ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[85%] md:max-w-[75%] p-4 rounded-2xl text-sm shadow-sm ${msg.sender === 'owner' ? 'bg-[#0D2B4D] text-white rounded-tr-none' : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'}`}>
                          {msg.text}
                          <div className={`text-[9px] mt-2 opacity-60 text-left`}>
                            {msg.timestamp?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  <div className="p-4 border-t bg-white">
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleReply()}
                        placeholder="اكتب ردك هنا..."
                        className="flex-1 px-4 py-3 rounded-2xl border bg-gray-50 outline-none focus:ring-2 focus:ring-[#00D1FF] transition-all text-sm"
                      />
                      <button 
                        onClick={handleReply} 
                        className="w-12 h-12 bg-[#00D1FF] text-white rounded-2xl flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"
                      >
                        <Send size={20} />
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-6 text-center">
                  <MessageSquare size={64} className="mb-4 opacity-10" />
                  <p className="font-bold">اختر محادثة من القائمة للبدء بالرد على عملائك</p>
                </div>
              )}
            </div>
          </div>
        );

      case DashboardTab.CATALOG:
        return (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 pb-20">
            <div className="flex justify-between items-center bg-white p-5 rounded-3xl border shadow-sm">
              <div>
                <h3 className="text-xl font-bold text-[#0D2B4D]">إدارة الكتالوج</h3>
                <p className="text-xs text-gray-400">لديك {localProfile.products.length} منتجات معروضة</p>
              </div>
              <button 
                onClick={() => setIsAddProductModalOpen(true)}
                className="bg-[#00D1FF] text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg hover:bg-[#00B8E0] transition-all"
              >
                <Plus size={20} /> إضافة منتج
              </button>
            </div>
            
            {localProfile.products.length === 0 ? (
              <div className="bg-white rounded-[40px] p-20 text-center border-2 border-dashed border-gray-100">
                 <Package size={48} className="mx-auto mb-4 text-gray-200" />
                 <p className="text-gray-400 font-bold">لا توجد منتجات في متجرك حالياً</p>
                 <button onClick={() => setIsAddProductModalOpen(true)} className="mt-4 text-[#00D1FF] font-bold underline">أضف أول منتج الآن</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {localProfile.products.map(product => (
                  <div key={product.id} className="bg-white rounded-[32px] overflow-hidden shadow-sm border border-gray-100 p-4 space-y-4 group">
                    <div className="aspect-square relative rounded-2xl overflow-hidden bg-gray-50 border border-gray-50">
                      <img src={product.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={product.name} />
                      <button 
                        onClick={() => setLocalProfile({...localProfile, products: localProfile.products.filter(p => p.id !== product.id)})} 
                        className="absolute top-2 left-2 p-2.5 bg-white/90 backdrop-blur text-red-500 rounded-xl shadow-sm hover:bg-red-50 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">اسم المنتج</label>
                        <input 
                          className="w-full font-bold text-[#0D2B4D] outline-none border-b border-transparent focus:border-[#00D1FF] bg-transparent pb-1" 
                          value={product.name} 
                          onChange={(e) => {
                            const newProds = localProfile.products.map(p => p.id === product.id ? {...p, name: e.target.value} : p);
                            setLocalProfile({...localProfile, products: newProds});
                          }} 
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase">السعر</label>
                        <div className="flex items-center gap-2">
                          <input 
                            type="number" 
                            className="w-24 bg-gray-50 px-3 py-2 rounded-xl outline-none font-black text-[#0D2B4D]" 
                            value={product.price} 
                            onChange={(e) => {
                              const newProds = localProfile.products.map(p => p.id === product.id ? {...p, price: Number(e.target.value)} : p);
                              setLocalProfile({...localProfile, products: newProds});
                            }} 
                          />
                          <span className="text-xs font-bold text-gray-400">{localProfile.currency}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="fixed bottom-24 lg:bottom-12 left-1/2 -translate-x-1/2 z-50">
              <button onClick={saveAllChanges} disabled={isSaving} className="bg-[#0D2B4D] text-white px-12 py-4 rounded-full font-black shadow-2xl flex items-center gap-3 hover:scale-105 active:scale-95 transition-all">
                {isSaving ? <Save className="animate-spin" size={20} /> : <Save size={20} />}
                حفظ التغييرات في المتجر
              </button>
            </div>
          </div>
        );

      case DashboardTab.CUSTOMIZE:
        return (
          <div className="max-w-4xl space-y-8 animate-in slide-in-from-bottom-4 pb-32">
            <div className="bg-white p-8 rounded-[40px] shadow-sm border border-cyan-100">
               <h3 className="text-xl font-black mb-6 text-[#0D2B4D] flex items-center gap-3"><LinkIcon className="text-[#00D1FF]" /> رابط المتجر المخصص</h3>
               <div className="space-y-4">
                  <p className="text-sm text-gray-500">اختر رابطاً سهلاً لعملائك للوصول لمتجرك ومحادثتك مباشرة.</p>
                  <div className="flex flex-col md:flex-row items-center gap-2">
                    <div className="w-full md:w-auto bg-gray-100 px-5 py-4 rounded-2xl font-bold text-gray-400 text-sm ltr">bazchat.com/</div>
                    <input 
                      className="w-full flex-1 px-5 py-4 rounded-2xl border bg-gray-50 outline-none focus:ring-2 focus:ring-[#00D1FF] font-bold text-[#0D2B4D] ltr" 
                      value={localProfile.slug} 
                      onChange={(e) => setLocalProfile({...localProfile, slug: e.target.value.toLowerCase().replace(/[^\w-]/g, '')})}
                      placeholder="my-brand-name"
                    />
                  </div>
                  <div className="p-4 bg-blue-50 rounded-2xl flex items-start gap-3">
                    <Info size={18} className="text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-blue-700 leading-relaxed">الرابط المخصص يساعد في تحسين ظهورك ويسهل على العملاء حفظ اسم متجرك. يمكنك استخدام الحروف الإنجليزية والأرقام والشرطة (-) فقط.</p>
                  </div>
               </div>
            </div>

            <div className="bg-white p-8 rounded-[40px] shadow-sm border">
              <h3 className="text-xl font-black mb-8 text-[#0D2B4D] flex items-center gap-3"><Palette className="text-[#00D1FF]" /> تخصيص هوية المتجر</h3>
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row gap-8 items-center">
                  <div className="w-32 h-32 rounded-[32px] overflow-hidden border-4 border-gray-50 bg-gray-50 shrink-0">
                    <img src={localProfile.logo} className="w-full h-full object-cover" alt="Logo" />
                  </div>
                  <div className="flex-1 w-full space-y-2">
                    <label className="text-xs font-bold text-gray-400">رابط الشعار</label>
                    <input className="w-full px-5 py-4 rounded-2xl border bg-gray-50 outline-none focus:ring-2 focus:ring-[#00D1FF]" value={localProfile.logo} onChange={(e) => setLocalProfile({...localProfile, logo: e.target.value})} />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400">اسم المتجر</label>
                    <input className="w-full px-5 py-4 rounded-2xl border bg-gray-50 outline-none" value={localProfile.name} onChange={(e) => setLocalProfile({...localProfile, name: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400">اسم المالك</label>
                    <input className="w-full px-5 py-4 rounded-2xl border bg-gray-50 outline-none" value={localProfile.ownerName} onChange={(e) => setLocalProfile({...localProfile, ownerName: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-400">النبذة التعريفية (Bio)</label>
                  <textarea className="w-full px-5 py-4 rounded-2xl border bg-gray-50 outline-none h-32 resize-none" value={localProfile.description || ''} onChange={(e) => setLocalProfile({...localProfile, description: e.target.value})} />
                </div>
                
                {localProfile.metaDescription && (
                  <div className="p-5 bg-gradient-to-r from-[#0D2B4D] to-blue-900 rounded-[24px] text-white shadow-lg overflow-hidden relative">
                    <Sparkles className="absolute -top-2 -right-2 opacity-20 rotate-12" size={64} />
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-blue-300">تحسين محركات البحث (SEO)</span>
                        {isGeneratingMeta && <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></div>}
                      </div>
                      <p className="text-xs font-medium leading-relaxed italic opacity-90">"{localProfile.metaDescription}"</p>
                    </div>
                  </div>
                )}

                <div className="pt-6 border-t">
                  <h4 className="font-bold mb-4">روابط التواصل الاجتماعي</h4>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="relative">
                      <Instagram size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-pink-500" />
                      <input className="w-full pl-12 pr-5 py-3 rounded-2xl border" placeholder="إنستقرام" value={localProfile.socialLinks.instagram || ''} onChange={(e) => setLocalProfile({...localProfile, socialLinks: {...localProfile.socialLinks, instagram: e.target.value}})} />
                    </div>
                    <div className="relative">
                      <Twitter size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-400" />
                      <input className="w-full pl-12 pr-5 py-3 rounded-2xl border" placeholder="تويتر" value={localProfile.socialLinks.twitter || ''} onChange={(e) => setLocalProfile({...localProfile, socialLinks: {...localProfile.socialLinks, twitter: e.target.value}})} />
                    </div>
                    <div className="relative">
                      <Facebook size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-700" />
                      <input className="w-full pl-12 pr-5 py-3 rounded-2xl border" placeholder="فيسبوك" value={localProfile.socialLinks.facebook || ''} onChange={(e) => setLocalProfile({...localProfile, socialLinks: {...localProfile.socialLinks, facebook: e.target.value}})} />
                    </div>
                    <div className="relative">
                      <MessageCircle size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-green-500" />
                      <input className="w-full pl-12 pr-5 py-3 rounded-2xl border" placeholder="واتساب" value={localProfile.socialLinks.whatsapp || ''} onChange={(e) => setLocalProfile({...localProfile, socialLinks: {...localProfile.socialLinks, whatsapp: e.target.value}})} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="fixed bottom-24 lg:bottom-12 left-1/2 -translate-x-1/2 z-50">
              <button onClick={saveAllChanges} disabled={isSaving || isGeneratingMeta} className="bg-[#0D2B4D] text-white px-10 py-4 rounded-full font-black shadow-2xl flex items-center gap-3 hover:scale-105 active:scale-95 transition-all">
                {isSaving ? <Save className="animate-spin" size={20} /> : <Save size={20} />}
                {isGeneratingMeta ? 'جاري تحسين الظهور...' : 'حفظ الهوية والتعديلات'}
              </button>
            </div>
          </div>
        );

      case DashboardTab.SETTINGS:
        return (
          <div className="max-w-3xl space-y-6 animate-in slide-in-from-bottom-4 pb-20">
            <div className="bg-white p-8 rounded-[40px] shadow-sm border">
               <h3 className="text-xl font-bold mb-8 text-[#0D2B4D]">إعدادات وسياسات المتجر</h3>
               <div className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400">عملة العرض</label>
                    <select className="w-full px-5 py-4 rounded-2xl border bg-gray-50 outline-none" value={localProfile.currency} onChange={(e) => setLocalProfile({...localProfile, currency: e.target.value})}>
                      <option value="SAR">ريال سعودي (SAR)</option><option value="AED">درهم إماراتي (AED)</option><option value="USD">دولار أمريكي (USD)</option>
                    </select>
                 </div>
                 <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400">سياسة الارجاع</label>
                    <textarea className="w-full px-5 py-4 rounded-2xl border bg-gray-50 outline-none h-24" value={localProfile.returnPolicy} onChange={(e) => setLocalProfile({...localProfile, returnPolicy: e.target.value})} />
                 </div>
                 <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400">سياسة الشحن</label>
                    <textarea className="w-full px-5 py-4 rounded-2xl border bg-gray-50 outline-none h-24" value={localProfile.deliveryPolicy} onChange={(e) => setLocalProfile({...localProfile, deliveryPolicy: e.target.value})} />
                 </div>
               </div>
            </div>
            <div className="fixed bottom-24 lg:bottom-12 left-1/2 -translate-x-1/2 z-50">
              <button onClick={saveAllChanges} disabled={isSaving} className="bg-[#0D2B4D] text-white px-10 py-4 rounded-full font-black shadow-2xl flex items-center gap-3 hover:scale-105 active:scale-95 transition-all">
                {isSaving ? <Save className="animate-spin" size={20} /> : <Save size={20} />}
                حفظ الإعدادات
              </button>
            </div>
            <button onClick={onLogout} className="w-full bg-red-50 text-red-500 py-5 rounded-[24px] font-bold flex items-center justify-center gap-3 border border-red-100 hover:bg-red-100 transition-colors"><LogOut size={22} /> تسجيل الخروج</button>
          </div>
        );

      default:
        return <div>يرجى اختيار علامة تبويب</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row font-tajawal">
      {/* Add Product Modal */}
      {isAddProductModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#0D2B4D]/60 backdrop-blur-sm animate-in fade-in" onClick={() => setIsAddProductModalOpen(false)}></div>
          <div className="relative bg-white w-full max-w-md rounded-[40px] p-8 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-[#0D2B4D]">إضافة منتج جديد</h3>
              <button onClick={() => setIsAddProductModalOpen(false)} className="p-2 text-gray-400 hover:text-red-500 transition-colors"><X size={24} /></button>
            </div>
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-600">اسم المنتج</label>
                <input 
                  type="text" 
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                  placeholder="مثلاً: قميص قطني فاخر"
                  className="w-full px-5 py-4 rounded-2xl border bg-gray-50 outline-none focus:ring-2 focus:ring-[#00D1FF]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-600">السعر ({localProfile.currency})</label>
                <input 
                  type="number" 
                  value={newProduct.price}
                  onChange={(e) => setNewProduct({...newProduct, price: e.target.value})}
                  placeholder="0.00"
                  className="w-full px-5 py-4 rounded-2xl border bg-gray-50 outline-none focus:ring-2 focus:ring-[#00D1FF]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-600">رابط صورة المنتج (URL)</label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={newProduct.image}
                    onChange={(e) => setNewProduct({...newProduct, image: e.target.value})}
                    placeholder="https://..."
                    className="w-full px-12 py-4 rounded-2xl border bg-gray-50 outline-none focus:ring-2 focus:ring-[#00D1FF]"
                  />
                  <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                </div>
                <p className="text-[10px] text-gray-400">اترك الحقل فارغاً لاستخدام صورة عشوائية</p>
              </div>
            </div>
            <button 
              onClick={handleAddProduct}
              className="w-full mt-8 bg-[#00D1FF] text-white py-5 rounded-[24px] font-black text-lg shadow-xl shadow-cyan-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              تأكيد الإضافة للكتالوج
            </button>
          </div>
        </div>
      )}

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
          <button onClick={() => window.open(getPublicChatUrl(), '_blank')} className="p-2.5 bg-[#00D1FF] rounded-xl text-white shadow-lg"><ExternalLink size={18} /></button>
        </div>
      </div>

      <main className="flex-1 lg:mr-72 p-4 md:p-10 lg:p-16">
        <header className="hidden lg:flex flex-row items-center justify-between gap-4 mb-12">
          <div>
            <h2 className="text-4xl font-black text-[#0D2B4D]">مرحباً، {localProfile.ownerName}</h2>
            <p className="text-gray-500 mt-2 font-medium">لوحة تحكم متجر <span className="text-[#00D1FF] font-black">{localProfile.name}</span></p>
          </div>
          <div className="flex gap-4">
            <button onClick={copyChatLink} className="bg-white border text-gray-700 px-8 py-4 rounded-2xl font-bold flex items-center gap-2 hover:bg-gray-50 transition-all shadow-sm"><Copy size={20} /> نسخ الرابط</button>
            <button onClick={() => window.open(getPublicChatUrl(), '_blank')} className="bg-[#00D1FF] text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-2 shadow-xl shadow-cyan-500/40 hover:scale-105 transition-all"><ExternalLink size={20} /> معاينة الصفحة</button>
          </div>
        </header>
        {renderContent()}
      </main>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around items-center p-3 z-50 shadow-2xl">
        <MobileNavItem active={activeTab === DashboardTab.OVERVIEW} onClick={() => setActiveTab(DashboardTab.OVERVIEW)} icon={<LayoutDashboard size={22} />} label="الرئيسية" />
        <MobileNavItem active={activeTab === DashboardTab.MESSAGES} onClick={() => { setActiveTab(DashboardTab.MESSAGES); setIsMobileChatOpen(false); }} icon={<MessageSquare size={22} />} label="الرسائل" />
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
