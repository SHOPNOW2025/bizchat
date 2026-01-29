
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
  ChevronLeft
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

const STATS_DATA = [
  { name: 'السبت', views: 400, chats: 240 },
  { name: 'الأحد', views: 300, chats: 139 },
  { name: 'الاثنين', views: 600, chats: 980 },
  { name: 'الثلاثاء', views: 800, chats: 390 },
  { name: 'الأربعاء', views: 500, chats: 480 },
  { name: 'الخميس', views: 700, chats: 380 },
  { name: 'الجمعة', views: 900, chats: 430 },
];

const SOUND_OPTIONS = [
  { id: 'standard', name: 'قياسي', url: 'https://assets.mixkit.co/active_storage/sfx/2359/2359-preview.mp3' },
  { id: 'soft', name: 'نغمة هادئة', url: 'https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3' },
  { id: 'mute', name: 'كتم الصوت', url: '' },
];

const RING_SOUND = 'https://assets.mixkit.co/active_storage/sfx/1344/1344-preview.mp3';
const SEND_SOUND = 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3';
const HANGUP_SOUND = 'https://assets.mixkit.co/active_storage/sfx/2355/2355-preview.mp3';

const Dashboard: React.FC<DashboardProps> = ({ user, setUser, onLogout }) => {
  const [activeTab, setActiveTab] = useState<DashboardTab>(DashboardTab.OVERVIEW);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveToast, setShowSaveToast] = useState(false);
  const [activeSessions, setActiveSessions] = useState<ChatSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState('');
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [showSoundSettings, setShowSoundSettings] = useState(false);
  const [selectedSoundId, setSelectedSoundId] = useState(localStorage.getItem('merchant_sound_id') || 'standard');
  const [totalUnread, setTotalUnread] = useState(0);
  
  const [newProduct, setNewProduct] = useState({ name: '', price: '', image: '' });
  const [localProfile, setLocalProfile] = useState<BusinessProfile>(user.businessProfile);

  // Call States
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'incoming' | 'connected' | 'ended'>('idle');
  const [activeCallSessionId, setActiveCallSessionId] = useState<string | null>(null);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  
  const pc = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const ringAudio = useRef<HTMLAudioElement | null>(null);
  const processedCandidates = useRef<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastGlobalActiveRef = useRef<number>(Date.now());
  const isInitialLoad = useRef<boolean>(true);

  useEffect(() => { setLocalProfile(user.businessProfile); }, [user.id]);

  const playSystemSound = (url: string) => {
    if (!url) return;
    new Audio(url).play().catch(() => {});
  };

  const handleReceiveSound = () => {
    const sound = SOUND_OPTIONS.find(s => s.id === selectedSoundId);
    if (sound && sound.url) playSystemSound(sound.url);
  };

  // WebRTC & Signaling logic for stability
  const handleEndCall = async (notify = true) => {
    const sId = activeCallSessionId;
    const cId = currentCallId;
    
    setCallStatus('idle');
    setActiveCallSessionId(null);
    setCurrentCallId(null);
    playSystemSound(HANGUP_SOUND);

    if (localStream.current) { localStream.current.getTracks().forEach(t => t.stop()); localStream.current = null; }
    if (pc.current) { pc.current.close(); pc.current = null; }
    if (ringAudio.current) { ringAudio.current.pause(); ringAudio.current.currentTime = 0; }
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;

    if (notify && sId && cId) {
      try { await sql`UPDATE voice_calls SET status = 'ended', updated_at = NOW() WHERE session_id = ${sId} AND call_id = ${cId}`; } catch (e) {}
    }
  };

  useEffect(() => {
    const monitorSignaling = async () => {
      try {
        const calls = await sql`
          SELECT * FROM voice_calls 
          WHERE session_id IN (SELECT id FROM chat_sessions WHERE profile_id = ${localProfile.id})
          ORDER BY updated_at DESC LIMIT 1
        `;

        if (calls.length > 0) {
          const call = calls[0];
          if (callStatus !== 'idle' && (call.status === 'ended' || (currentCallId && call.call_id !== currentCallId))) {
            handleEndCall(false);
            return;
          }

          if (call.status === 'calling' && call.caller_role === 'customer' && callStatus === 'idle') {
            setCallStatus('incoming');
            setActiveCallSessionId(call.session_id);
            setCurrentCallId(call.call_id);
            if (!ringAudio.current) { ringAudio.current = new Audio(RING_SOUND); ringAudio.current.loop = true; }
            ringAudio.current.play().catch(() => {});
          }

          if (callStatus === 'calling' && call.status === 'connected' && call.answer && call.call_id === currentCallId) {
            if (pc.current && pc.current.signalingState === 'have-local-offer') {
              await pc.current.setRemoteDescription(new RTCSessionDescription(call.answer));
              setCallStatus('connected');
              if (ringAudio.current) ringAudio.current.pause();
            }
          }
        }
      } catch (e) { console.error(e); }
    };
    const timer = setInterval(monitorSignaling, 2000);
    return () => clearInterval(timer);
  }, [localProfile.id, callStatus, currentCallId]);

  useEffect(() => {
    let interval: any;
    if (callStatus === 'connected') interval = setInterval(() => setCallDuration(d => d + 1), 1000);
    else setCallDuration(0);
    return () => clearInterval(interval);
  }, [callStatus]);

  const initWebRTC = async (sessionId: string, callId: string) => {
    processedCandidates.current.clear();
    pc.current = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    pc.current.onicecandidate = async (event) => {
      if (event.candidate) {
        const col = callStatus === 'calling' ? 'caller_candidates' : 'receiver_candidates';
        await sql`UPDATE voice_calls SET ${sql(col)} = ${sql(col)} || ${JSON.stringify([event.candidate])}::jsonb, updated_at = NOW() WHERE sessionId = ${sessionId} AND call_id = ${callId}`;
      }
    };
    pc.current.ontrack = (event) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0];
        remoteAudioRef.current.play().catch(() => {});
      }
    };
    localStream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStream.current.getTracks().forEach(track => pc.current?.addTrack(track, localStream.current!));
  };

  const handleStartCall = async (sessionId: string) => {
    if (callStatus !== 'idle') return;
    const callId = `call_${Date.now()}`;
    setCurrentCallId(callId);
    setActiveCallSessionId(sessionId);
    setCallStatus('calling');
    try {
      await sql`INSERT INTO voice_calls (session_id, call_id, status, caller_role, updated_at) VALUES (${sessionId}, ${callId}, 'calling', 'owner', NOW()) ON CONFLICT (session_id) DO UPDATE SET call_id = ${callId}, status = 'calling', caller_role = 'owner', updated_at = NOW()`;
      await initWebRTC(sessionId, callId);
      const offer = await pc.current!.createOffer();
      await pc.current!.setLocalDescription(offer);
      await sql`UPDATE voice_calls SET offer = ${JSON.stringify(offer)} WHERE session_id = ${sessionId} AND call_id = ${callId}`;
      if (!ringAudio.current) { ringAudio.current = new Audio(RING_SOUND); ringAudio.current.loop = true; }
      ringAudio.current.play().catch(() => {});
    } catch (e) { handleEndCall(); }
  };

  const handleAcceptCall = async () => {
    if (!activeCallSessionId || !currentCallId) return;
    try {
      await initWebRTC(activeCallSessionId, currentCallId);
      const callData = await sql`SELECT offer FROM voice_calls WHERE session_id = ${activeCallSessionId} AND call_id = ${currentCallId}`;
      if (callData.length > 0 && callData[0].offer) {
        await pc.current!.setRemoteDescription(new RTCSessionDescription(callData[0].offer));
        const answer = await pc.current!.createAnswer();
        await pc.current!.setLocalDescription(answer);
        await sql`UPDATE voice_calls SET status = 'connected', answer = ${JSON.stringify(answer)}, updated_at = NOW() WHERE session_id = ${activeCallSessionId} AND call_id = ${currentCallId}`;
        setCallStatus('connected');
        if (ringAudio.current) ringAudio.current.pause();
      }
    } catch (e) { handleEndCall(); }
  };

  const formatDuration = (s: number) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

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
        if (data.length > 0) {
          const recentTime = new Date(data[0].lastActive).getTime();
          if (isInitialLoad.current) { lastGlobalActiveRef.current = recentTime; isInitialLoad.current = false; }
          else if (recentTime > lastGlobalActiveRef.current) {
            if (data[0].lastText && !data[0].lastText.startsWith('أنت:')) handleReceiveSound();
            lastGlobalActiveRef.current = recentTime;
          }
        }
      } catch (e) {}
    };
    fetchSessions();
    const interval = setInterval(fetchSessions, 5000); 
    return () => clearInterval(interval);
  }, [localProfile.id, selectedSoundId]);

  useEffect(() => {
    if (selectedSession) {
      const fetchMsgs = async () => {
        try {
          const msgs = await sql`SELECT id, sender, text, timestamp, is_read FROM chat_messages WHERE session_id = ${selectedSession} ORDER BY timestamp ASC`;
          setChatMessages(msgs.map(m => ({ ...m, timestamp: new Date(m.timestamp) })) as Message[]);
          await sql`UPDATE chat_messages SET is_read = TRUE WHERE session_id = ${selectedSession} AND sender = 'customer' AND is_read = FALSE`;
        } catch (e) {}
      };
      fetchMsgs();
      const interval = setInterval(fetchMsgs, 3000);
      return () => clearInterval(interval);
    }
  }, [selectedSession]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  // Added handleSelectSession to fix the error in the chat tab (Error on line 383)
  const handleSelectSession = (id: string) => {
    setSelectedSession(id);
    setIsMobileChatOpen(true);
  };

  const saveAllChanges = async () => {
    setIsSaving(true);
    try {
      const cleanSlug = localProfile.slug.toLowerCase().trim().replace(/[^\w-]/g, '');
      await sql`
        UPDATE profiles SET name = ${localProfile.name}, slug = ${cleanSlug}, owner_name = ${localProfile.ownerName}, description = ${localProfile.description || ''}, 
        phone = ${localProfile.phone}, logo = ${localProfile.logo}, social_links = ${JSON.stringify(localProfile.socialLinks)}, 
        products = ${JSON.stringify(localProfile.products)}, currency = ${localProfile.currency}, 
        return_policy = ${localProfile.returnPolicy}, delivery_policy = ${localProfile.deliveryPolicy}
        WHERE id = ${localProfile.id}
      `;
      setUser({ ...user, businessProfile: { ...localProfile, slug: cleanSlug } });
      setShowSaveToast(true);
      setTimeout(() => setShowSaveToast(false), 3000);
    } catch (e) { alert("حدث خطأ أثناء حفظ البيانات"); } 
    finally { setIsSaving(false); }
  };

  const handleReply = async () => {
    if (!replyText.trim() || !selectedSession) return;
    const txt = replyText; setReplyText(''); playSystemSound(SEND_SOUND); 
    try {
      await sql`UPDATE chat_sessions SET last_text = ${`أنت: ${txt}`}, last_active = NOW() WHERE id = ${selectedSession}`;
      await sql`INSERT INTO chat_messages (session_id, sender, text, is_read) VALUES (${selectedSession}, 'owner', ${txt}, TRUE)`;
      setChatMessages(prev => [...prev, { id: Date.now().toString(), sender: 'owner', text: txt, timestamp: new Date() }]);
    } catch (e) {}
  };

  const handleAddProduct = () => {
    if (!newProduct.name || !newProduct.price) return;
    const prod: Product = {
      id: `p_${Date.now()}`, name: newProduct.name, price: parseFloat(newProduct.price), description: '', image: newProduct.image || 'https://via.placeholder.com/150'
    };
    setLocalProfile(prev => ({ ...prev, products: [...prev.products, prod] }));
    setNewProduct({ name: '', price: '', image: '' });
    setIsAddProductModalOpen(false);
  };

  const removeProduct = (id: string) => {
    setLocalProfile(prev => ({ ...prev, products: prev.products.filter(p => p.id !== id) }));
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
              <div className="bg-white p-6 rounded-[32px] shadow-sm border">
                <h3 className="text-md font-bold mb-6 text-[#0D2B4D]">نشاط المحادثات الأسبوعي</h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={STATS_DATA}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                      <YAxis fontSize={10} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                      <Bar dataKey="chats" fill="#00D1FF" radius={[6, 6, 0, 0]} barSize={32} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-white p-6 rounded-[32px] shadow-sm border">
                <h3 className="text-md font-bold mb-6 text-[#0D2B4D]">زيارات الصفحة</h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={STATS_DATA}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                      <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                      <YAxis fontSize={10} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                      <Line type="monotone" dataKey="views" stroke="#0D2B4D" strokeWidth={4} dot={{r: 6, fill: '#0D2B4D', strokeWidth: 2, stroke: '#fff'}} activeDot={{r: 8}} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        );
      case DashboardTab.MESSAGES:
        return (
          <div className="flex h-[calc(100vh-160px)] bg-white rounded-[40px] shadow-sm border overflow-hidden relative">
            <div className={`w-full md:w-80 border-l overflow-y-auto bg-gray-50/30 ${isMobileChatOpen ? 'hidden md:block' : 'block'}`}>
              <div className="p-6 border-b bg-white sticky top-0 z-10 flex items-center justify-between">
                <h3 className="font-bold text-[#0D2B4D]">المحادثات</h3>
                <button onClick={() => setShowSoundSettings(!showSoundSettings)} className="p-2 text-gray-400 relative">
                   {selectedSoundId === 'mute' ? <VolumeX size={20} /> : <Volume2 size={20} />}
                   {showSoundSettings && (
                     <div className="absolute top-12 left-0 w-48 bg-white border shadow-2xl rounded-3xl p-4 z-50 text-right animate-in zoom-in-95">
                       <p className="text-[10px] font-black text-gray-400 mb-3">نغمة التنبيه</p>
                       <div className="space-y-1">
                         {SOUND_OPTIONS.map(s => (
                           <button key={s.id} onClick={(e) => { e.stopPropagation(); setSelectedSoundId(s.id); localStorage.setItem('merchant_sound_id', s.id); setShowSoundSettings(false); }} className={`w-full text-right px-4 py-3 rounded-2xl text-xs font-bold ${selectedSoundId === s.id ? 'bg-[#00D1FF] text-white' : 'hover:bg-gray-50'}`}>{s.name}</button>
                         ))}
                       </div>
                     </div>
                   )}
                </button>
              </div>
              {activeSessions.length === 0 ? <div className="p-10 text-center text-gray-400 text-sm font-bold">لا توجد رسائل بعد</div> : activeSessions.map(session => (
                <button key={session.id} onClick={() => handleSelectSession(session.id)} className={`w-full p-6 flex items-center gap-4 border-b text-right transition-colors ${selectedSession === session.id ? 'bg-white border-r-4 border-r-[#00D1FF]' : 'hover:bg-white'}`}>
                  <div className="w-14 h-14 rounded-[22px] bg-[#0D2B4D] text-white flex items-center justify-center font-bold text-lg shrink-0">{session.customerName?.substring(0, 1)}</div>
                  <div className="flex-1 overflow-hidden">
                    <div className="flex justify-between mb-1"><span className="font-bold text-sm truncate">{session.customerName || 'عميل'}</span><span className="text-[10px] text-gray-400">{session.lastActive ? new Date(session.lastActive).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : ''}</span></div>
                    <div className="flex justify-between items-center"><div className={`text-xs truncate ${session.unreadCount ? 'font-bold text-[#0D2B4D]' : 'text-gray-500'}`}>{session.lastText}</div>{!!session.unreadCount && <div className="bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold">{session.unreadCount}</div>}</div>
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
                      <div className="w-12 h-12 rounded-[18px] bg-gray-100 flex items-center justify-center font-bold">{activeSessions.find(s=>s.id===selectedSession)?.customerName?.substring(0,1)}</div>
                      <span className="font-bold text-lg">{activeSessions.find(s=>s.id===selectedSession)?.customerName}</span>
                    </div>
                    <button onClick={() => handleStartCall(selectedSession)} disabled={callStatus !== 'idle'} className="bg-green-500 text-white p-4 rounded-2xl shadow-xl shadow-green-500/20 hover:scale-105 transition-transform disabled:opacity-50"><PhoneCall size={20} /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/40">
                    {chatMessages.map(m => (
                      <div key={m.id} className={`flex ${m.sender==='owner'?'justify-start':'justify-end'}`}>
                        <div className={`max-w-[80%] p-5 rounded-[28px] text-sm font-medium shadow-sm ${m.sender==='owner'?'bg-[#0D2B4D] text-white rounded-tr-none':'bg-white border rounded-tl-none text-gray-800'}`}>
                          {m.text}<div className="text-[9px] mt-2 opacity-60 text-left font-black">{m.timestamp?.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                  <div className="p-6 border-t flex gap-3">
                    <input type="text" value={replyText} onChange={e=>setReplyText(e.target.value)} onKeyPress={e=>e.key==='Enter'&&handleReply()} placeholder="اكتب ردك هنا..." className="flex-1 px-6 py-4 rounded-3xl border bg-gray-50 outline-none focus:ring-2 focus:ring-[#00D1FF] font-bold" />
                    <button onClick={handleReply} className="w-14 h-14 bg-[#00D1FF] text-white rounded-3xl flex items-center justify-center shadow-xl shadow-cyan-500/20 hover:scale-105 transition-transform"><Send size={24} /></button>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 opacity-20"><MessageSquare size={100} /><p className="font-black mt-6 text-xl">اختر محادثة للبدء</p></div>
              )}
            </div>
          </div>
        );
      case DashboardTab.CATALOG:
        return (
          <div className="space-y-6 animate-in slide-in-from-bottom-6 pb-40">
            <div className="flex justify-between items-center bg-white p-8 rounded-[40px] border shadow-sm">
              <div><h3 className="text-2xl font-black text-[#0D2B4D]">كتالوج المنتجات</h3><p className="text-gray-400 font-bold mt-1">قم بإدارة وعرض منتجاتك لعملائك</p></div>
              <button onClick={() => setIsAddProductModalOpen(true)} className="bg-[#00D1FF] text-white px-8 py-4 rounded-2xl font-black flex items-center gap-3 shadow-xl shadow-cyan-500/30 hover:scale-105 transition-transform"><Plus size={24} /> إضافة منتج</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
              {localProfile.products.map(product => (
                <div key={product.id} className="bg-white rounded-[40px] overflow-hidden shadow-sm border p-5 group hover:shadow-xl transition-all duration-300">
                  <div className="aspect-square relative rounded-[32px] overflow-hidden bg-gray-50 mb-6">
                    <img src={product.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={product.name} />
                    <button onClick={() => removeProduct(product.id)} className="absolute top-4 left-4 p-3 bg-white/90 text-red-500 rounded-2xl shadow-lg hover:bg-red-50 transition-colors"><Trash2 size={20} /></button>
                  </div>
                  <div className="space-y-2 text-right">
                    <h4 className="font-black text-lg text-[#0D2B4D] truncate">{product.name}</h4>
                    <p className="text-[#00D1FF] font-black text-xl">{product.price} <span className="text-xs">{localProfile.currency}</span></p>
                  </div>
                </div>
              ))}
              {localProfile.products.length === 0 && (
                <div className="col-span-full py-24 text-center text-gray-400 bg-white rounded-[40px] border border-dashed border-gray-200"><Package size={80} className="mx-auto mb-6 opacity-10" /><p className="font-black text-xl">لا توجد منتجات حتى الآن</p></div>
              )}
            </div>
            <div className="fixed bottom-12 left-1/2 -translate-x-1/2 lg:mr-72 z-50">
              <button onClick={saveAllChanges} disabled={isSaving} className="bg-[#0D2B4D] text-white px-14 py-5 rounded-full font-black shadow-2xl flex items-center gap-4 hover:scale-105 transition-all disabled:opacity-50">{isSaving ? <Save className="animate-spin" size={24} /> : <Save size={24} />} حفظ الكتالوج</button>
            </div>
          </div>
        );
      case DashboardTab.CUSTOMIZE:
        return (
          <div className="max-w-4xl space-y-8 animate-in slide-in-from-bottom-6 pb-40">
            <div className="bg-white p-10 rounded-[50px] shadow-sm border relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-[#00D1FF]/5 rounded-full -mr-10 -mt-10 blur-3xl"></div>
               <h3 className="text-2xl font-black mb-8 text-[#0D2B4D] flex items-center gap-4"><LinkIcon className="text-[#00D1FF]" /> الرابط المخصص (Slug)</h3>
               <div className="flex flex-col md:flex-row items-center gap-3">
                  <div className="w-full md:w-auto bg-gray-100 px-6 py-5 rounded-3xl font-black text-gray-400 ltr">bazchat.com/#/chat/</div>
                  <input className="w-full flex-1 px-6 py-5 rounded-3xl border bg-gray-50 outline-none focus:ring-4 focus:ring-[#00D1FF]/10 font-black ltr text-xl text-[#0D2B4D]" value={localProfile.slug} onChange={(e) => setLocalProfile({...localProfile, slug: e.target.value.toLowerCase().replace(/[^\w-]/g, '')})} />
               </div>
               <p className="text-sm text-gray-400 mt-4 font-bold flex items-center gap-2"><ImageIcon size={14} /> رابط متجرك المباشر لعملائك ومتابعيك</p>
            </div>
            <div className="bg-white p-10 rounded-[50px] shadow-sm border">
              <h3 className="text-2xl font-black mb-10 text-[#0D2B4D] flex items-center gap-4"><Palette className="text-[#00D1FF]" /> الهوية البصرية</h3>
              <div className="space-y-8">
                <div className="flex flex-col md:flex-row gap-10 items-center bg-gray-50/50 p-8 rounded-[40px]">
                  <div className="w-40 h-40 rounded-[45px] overflow-hidden border-4 border-white shadow-xl bg-white shrink-0 p-1"><img src={localProfile.logo} className="w-full h-full object-cover rounded-[40px]" alt="Logo" /></div>
                  <div className="flex-1 w-full space-y-3 text-right">
                    <label className="text-xs font-black text-gray-400 tracking-widest uppercase">رابط شعار المتجر</label>
                    <input className="w-full px-6 py-4 rounded-2xl border bg-white outline-none focus:ring-4 focus:ring-[#00D1FF]/10 font-bold" value={localProfile.logo} onChange={(e) => setLocalProfile({...localProfile, logo: e.target.value})} />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-8 text-right">
                  <div className="space-y-3">
                    <label className="text-xs font-black text-gray-400 tracking-widest uppercase">اسم المنشأة</label>
                    <input className="w-full px-6 py-5 rounded-3xl border bg-gray-50 outline-none focus:ring-4 focus:ring-[#00D1FF]/10 font-black text-lg" value={localProfile.name} onChange={(e) => setLocalProfile({...localProfile, name: e.target.value})} />
                  </div>
                  <div className="space-y-3">
                    <label className="text-xs font-black text-gray-400 tracking-widest uppercase">اسم المالك</label>
                    <input className="w-full px-6 py-5 rounded-3xl border bg-gray-50 outline-none focus:ring-4 focus:ring-[#00D1FF]/10 font-black text-lg" value={localProfile.ownerName} onChange={(e) => setLocalProfile({...localProfile, ownerName: e.target.value})} />
                  </div>
                </div>
                <div className="space-y-3 text-right">
                  <label className="text-xs font-black text-gray-400 tracking-widest uppercase">النبذة التعريفية</label>
                  <textarea className="w-full px-6 py-5 rounded-[32px] border bg-gray-50 outline-none focus:ring-4 focus:ring-[#00D1FF]/10 font-bold h-40 resize-none leading-relaxed" value={localProfile.description || ''} onChange={(e) => setLocalProfile({...localProfile, description: e.target.value})} />
                </div>
              </div>
            </div>
            <div className="fixed bottom-12 left-1/2 -translate-x-1/2 lg:mr-72 z-50">
              <button onClick={saveAllChanges} disabled={isSaving} className="bg-[#0D2B4D] text-white px-14 py-5 rounded-full font-black shadow-2xl flex items-center gap-4 hover:scale-105 transition-all disabled:opacity-50">{isSaving ? <Save className="animate-spin" size={24} /> : <Save size={24} />} حفظ الهوية</button>
            </div>
          </div>
        );
      case DashboardTab.SETTINGS:
        return (
          <div className="max-w-3xl space-y-8 animate-in slide-in-from-bottom-6 pb-40">
            <div className="bg-white p-10 rounded-[50px] shadow-sm border relative">
               <h3 className="text-2xl font-black mb-10 text-[#0D2B4D] text-right">الإعدادات والسياسات</h3>
               <div className="space-y-8 text-right">
                 <div className="space-y-3">
                    <label className="text-xs font-black text-gray-400 tracking-widest uppercase">عملة المتجر الافتراضية</label>
                    <select className="w-full px-6 py-5 rounded-3xl border bg-gray-50 outline-none focus:ring-4 focus:ring-[#00D1FF]/10 font-black text-lg appearance-none cursor-pointer" value={localProfile.currency} onChange={(e) => setLocalProfile({...localProfile, currency: e.target.value})}>
                      <option value="SAR">SAR - ريال سعودي</option>
                      <option value="AED">AED - درهم إماراتي</option>
                      <option value="KWD">KWD - دينار كويتي</option>
                      <option value="EGP">EGP - جنيه مصري</option>
                      <option value="USD">USD - دولار أمريكي</option>
                    </select>
                 </div>
                 <div className="space-y-3">
                    <label className="text-xs font-black text-gray-400 tracking-widest uppercase">سياسة الاسترجاع</label>
                    <textarea className="w-full px-6 py-5 rounded-[32px] border bg-gray-50 outline-none focus:ring-4 focus:ring-[#00D1FF]/10 font-bold h-32 leading-relaxed" value={localProfile.returnPolicy} onChange={(e) => setLocalProfile({...localProfile, returnPolicy: e.target.value})} />
                 </div>
                 <div className="space-y-3">
                    <label className="text-xs font-black text-gray-400 tracking-widest uppercase">سياسة الشحن والتوصيل</label>
                    <textarea className="w-full px-6 py-5 rounded-[32px] border bg-gray-50 outline-none focus:ring-4 focus:ring-[#00D1FF]/10 font-bold h-32 leading-relaxed" value={localProfile.deliveryPolicy} onChange={(e) => setLocalProfile({...localProfile, deliveryPolicy: e.target.value})} />
                 </div>
               </div>
            </div>
            <div className="fixed bottom-12 left-1/2 -translate-x-1/2 lg:mr-72 z-50">
              <button onClick={saveAllChanges} disabled={isSaving} className="bg-[#0D2B4D] text-white px-14 py-5 rounded-full font-black shadow-2xl flex items-center gap-4 hover:scale-105 transition-all disabled:opacity-50">{isSaving ? <Save className="animate-spin" size={24} /> : <Save size={24} />} حفظ الإعدادات</button>
            </div>
            <button onClick={onLogout} className="w-full bg-red-50 text-red-500 py-6 rounded-[32px] font-black flex items-center justify-center gap-4 border border-red-100 hover:bg-red-100 transition-colors shadow-sm"><LogOut size={24} /> تسجيل الخروج النهائي</button>
          </div>
        );
      default: return <div className="p-20 text-center font-black text-gray-300 animate-pulse">جاري تحميل المحتوى...</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row font-tajawal text-right">
      <audio ref={remoteAudioRef} autoPlay className="hidden" />

      {isAddProductModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-[#0D2B4D]/70 backdrop-blur-md" onClick={() => setIsAddProductModalOpen(false)}></div>
          <div className="relative bg-white w-full max-w-lg rounded-[50px] p-10 shadow-2xl text-right animate-in zoom-in-95 duration-200">
            <h3 className="text-2xl font-black mb-8 text-[#0D2B4D]">إضافة منتج جديد</h3>
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest">اسم المنتج</label>
                <input type="text" className="w-full px-6 py-4 rounded-2xl border bg-gray-50 outline-none focus:ring-4 focus:ring-[#00D1FF]/10 font-black text-lg" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest">السعر ({localProfile.currency})</label>
                <input type="number" className="w-full px-6 py-4 rounded-2xl border bg-gray-50 outline-none focus:ring-4 focus:ring-[#00D1FF]/10 font-black text-lg" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest">رابط صورة المنتج</label>
                <input type="text" className="w-full px-6 py-4 rounded-2xl border bg-gray-50 outline-none focus:ring-4 focus:ring-[#00D1FF]/10 font-bold" value={newProduct.image} onChange={e => setNewProduct({...newProduct, image: e.target.value})} />
              </div>
            </div>
            <div className="flex gap-4 mt-10">
              <button onClick={handleAddProduct} className="flex-1 bg-[#00D1FF] text-white py-5 rounded-3xl font-black text-lg shadow-xl shadow-cyan-500/30 hover:scale-105 transition-transform">تأكيد الإضافة</button>
              <button onClick={() => setIsAddProductModalOpen(false)} className="px-8 bg-gray-100 text-gray-500 py-5 rounded-3xl font-black">إلغاء</button>
            </div>
          </div>
        </div>
      )}

      {callStatus !== 'idle' && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/85 backdrop-blur-[40px] animate-in fade-in duration-500"></div>
          <div className="relative bg-white/10 w-full max-w-sm rounded-[60px] p-12 shadow-2xl border border-white/20 text-center text-white animate-in zoom-in-95">
            <div className="mb-10 relative">
              <div className="w-40 h-40 rounded-[50px] overflow-hidden mx-auto border-8 border-white/10 p-1 bg-white/5 relative z-10 shadow-2xl shadow-cyan-500/20">
                <img src={localProfile.logo} className="w-full h-full object-cover rounded-[42px]" alt="Logo" />
              </div>
              {callStatus === 'connected' && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 border-2 border-cyan-400/40 rounded-full animate-ping"></div>}
            </div>
            <h3 className="text-3xl font-black mb-3">{activeSessions.find(s=>s.id===activeCallSessionId)?.customerName || 'عميل بازشات'}</h3>
            <p className="text-cyan-400 font-black text-sm tracking-[0.2em] uppercase mb-12 flex items-center justify-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
              {callStatus === 'calling' && 'جاري الاتصال...'}
              {callStatus === 'incoming' && 'مكالمة واردة...'}
              {callStatus === 'connected' && formatDuration(callDuration)}
            </p>
            <div className="flex items-center justify-center gap-8">
              {callStatus === 'incoming' ? (
                <>
                  <button onClick={() => handleEndCall(true)} className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center shadow-2xl hover:scale-110 transition-transform"><PhoneOff size={32} /></button>
                  <button onClick={handleAcceptCall} className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center shadow-2xl animate-bounce hover:scale-110 transition-transform"><PhoneCall size={32} /></button>
                </>
              ) : (
                <>
                  <button onClick={() => setIsMuted(!isMuted)} className={`w-16 h-16 rounded-full flex items-center justify-center border-2 transition-all ${isMuted?'bg-white text-black':'border-white/20 hover:bg-white/10'}`}>{isMuted?<MicOff size={24}/>:<Mic size={24}/>}</button>
                  <button onClick={() => handleEndCall(true)} className="w-24 h-24 bg-red-500 rounded-full flex items-center justify-center shadow-2xl shadow-red-500/30 hover:scale-110 transition-transform active:scale-95"><PhoneOff size={36} /></button>
                  <button className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center border-2 border-white/20 hover:bg-white/20 transition-all"><Volume2 size={24}/></button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showSaveToast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-green-500 text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-3 z-[999] animate-in slide-in-from-top-12">
          <CheckCircle2 size={24} /> <span className="font-black text-lg">تم حفظ التعديلات بنجاح!</span>
        </div>
      )}

      <aside className="w-80 bg-[#0D2B4D] text-white fixed h-full hidden lg:flex flex-col p-10 z-40 shadow-2xl">
        <div className="flex items-center gap-4 mb-16 px-2 group cursor-pointer" onClick={() => setActiveTab(DashboardTab.OVERVIEW)}>
          <img src="https://i.ibb.co/XxVXdyhC/6.png" className="h-14 group-hover:rotate-12 transition-transform duration-500"/>
          <span className="text-3xl font-black tracking-tight">بازشات</span>
        </div>
        <nav className="flex-1 space-y-3">
          <NavItem active={activeTab===DashboardTab.OVERVIEW} onClick={()=>setActiveTab(DashboardTab.OVERVIEW)} icon={<LayoutDashboard size={22}/>} label="الرئيسية"/>
          <NavItem active={activeTab===DashboardTab.MESSAGES} onClick={()=>setActiveTab(DashboardTab.MESSAGES)} icon={<MessageSquare size={22}/>} label="المحادثات" badge={totalUnread||undefined}/>
          <NavItem active={activeTab===DashboardTab.CATALOG} onClick={()=>setActiveTab(DashboardTab.CATALOG)} icon={<Package size={22}/>} label="المنتجات"/>
          <NavItem active={activeTab===DashboardTab.CUSTOMIZE} onClick={()=>setActiveTab(DashboardTab.CUSTOMIZE)} icon={<Palette size={22}/>} label="الهوية"/>
          <NavItem active={activeTab===DashboardTab.SETTINGS} onClick={()=>setActiveTab(DashboardTab.SETTINGS)} icon={<Settings size={22}/>} label="الإعدادات"/>
        </nav>
        <button onClick={onLogout} className="mt-auto flex items-center gap-4 px-6 py-5 text-red-400 hover:bg-red-500/10 rounded-3xl transition-all font-black group">
          <LogOut size={22} className="group-hover:-translate-x-1 transition-transform"/> خروج
        </button>
      </aside>

      <main className="flex-1 lg:mr-80 p-6 md:p-12 text-right">
        <header className="hidden lg:flex items-center justify-between mb-16">
          <div>
            <h2 className="text-5xl font-black text-[#0D2B4D] leading-tight">مرحباً، {localProfile.ownerName} 👋</h2>
            <p className="text-gray-400 font-bold mt-3 text-lg">أنت تدير متجر <span className="text-[#00D1FF] font-black">{localProfile.name}</span> باحترافية</p>
          </div>
          <div className="flex gap-4">
            <button onClick={()=>{navigator.clipboard.writeText(`${window.location.origin}/#/chat/${localProfile.slug||localProfile.id}`); alert('تم النسخ');}} className="bg-white border-2 border-gray-100 px-8 py-5 rounded-3xl font-black text-[#0D2B4D] flex items-center gap-3 hover:bg-gray-50 transition-colors shadow-sm"><Copy size={22}/> نسخ الرابط</button>
            <button onClick={()=>window.open(`${window.location.origin}/#/chat/${localProfile.slug||localProfile.id}`, '_blank')} className="bg-[#0D2B4D] text-white px-10 py-5 rounded-3xl font-black flex items-center gap-3 shadow-2xl shadow-blue-500/20 hover:scale-105 transition-all"><ExternalLink size={22}/> معاينة المتجر</button>
          </div>
        </header>

        {/* Mobile Header */}
        <header className="lg:hidden flex items-center justify-between mb-8 p-2">
           <div className="flex items-center gap-2"><img src="https://i.ibb.co/XxVXdyhC/6.png" className="h-10"/><span className="text-xl font-black text-[#0D2B4D]">بازشات</span></div>
           <button onClick={() => setShowSoundSettings(!showSoundSettings)} className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center border shadow-sm relative">
             <Settings size={20} className="text-gray-400" />
           </button>
        </header>

        {renderContent()}
      </main>
    </div>
  );
};

const NavItem: React.FC<{active:boolean, onClick:()=>void, icon:React.ReactNode, label:string, badge?:number}> = ({ active, onClick, icon, label, badge }) => (
  <button onClick={onClick} className={`w-full flex items-center justify-between px-6 py-5 rounded-[26px] font-black transition-all ${active ? 'bg-[#00D1FF] text-white shadow-xl shadow-cyan-500/30 -translate-x-1' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
    <div className="flex items-center gap-4">{icon}{label}</div>
    {badge !== undefined && badge > 0 && <span className="bg-red-500 text-white text-[10px] w-6 h-6 rounded-full flex items-center justify-center shadow-lg animate-pulse">{badge}</span>}
  </button>
);

const StatCard: React.FC<{icon:React.ReactNode, label:string, value:string, sub:string}> = ({ icon, label, value, sub }) => (
  <div className="bg-white p-7 rounded-[40px] shadow-sm border border-gray-50 text-right hover:shadow-md transition-all">
    <div className="flex items-center gap-3 mb-5 justify-end">
      <span className="text-[11px] font-black text-gray-400 uppercase tracking-widest">{label}</span>
      <div className="p-3 bg-gray-50 rounded-2xl text-[#0D2B4D]">{icon}</div>
    </div>
    <div className="text-3xl font-black text-[#0D2B4D] mb-1 tracking-tight">{value}</div>
    <div className={`text-[11px] font-black ${sub.includes('+')?'text-green-500':'text-red-500'} flex items-center justify-end gap-1`}>
       {sub.includes('+') ? <ChevronLeft size={10} className="rotate-90" /> : <ChevronLeft size={10} className="-rotate-90" />} {sub}
    </div>
  </div>
);

export default Dashboard;
