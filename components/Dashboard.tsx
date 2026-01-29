
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
  Sparkles,
  Phone as PhoneIcon,
  Volume2,
  VolumeX,
  Bell,
  PhoneCall,
  Mic,
  MicOff,
  PhoneOff
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
  { name: 'الاثنين', views: 200, chats: 980 },
  { name: 'الثلاثاء', views: 278, chats: 390 },
  { name: 'الأربعاء', views: 189, chats: 480 },
  { name: 'الخميس', views: 239, chats: 380 },
  { name: 'الجمعة', views: 349, chats: 430 },
];

const SOUND_OPTIONS = [
  { id: 'standard', name: 'قياسي', url: 'https://assets.mixkit.co/active_storage/sfx/2359/2359-preview.mp3' },
  { id: 'soft', name: 'نغمة هادئة', url: 'https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3' },
  { id: 'mute', name: 'كتم الصوت', url: '' },
];

const RING_SOUND = 'https://assets.mixkit.co/active_storage/sfx/1344/1344-preview.mp3';
const SEND_SOUND = 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3';

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
  const [showSoundSettings, setShowSoundSettings] = useState(false);
  const [selectedSoundId, setSelectedSoundId] = useState(localStorage.getItem('merchant_sound_id') || 'standard');
  const [totalUnread, setTotalUnread] = useState(0);
  
  const [newProduct, setNewProduct] = useState({ name: '', price: '', image: '' });

  // Call States
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'incoming' | 'connected' | 'ended'>('idle');
  const [activeCallSessionId, setActiveCallSessionId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const ringAudio = useRef<HTMLAudioElement | null>(null);
  const processedIceCandidates = useRef<Set<string>>(new Set());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastGlobalActiveRef = useRef<number>(Date.now());
  const isInitialLoad = useRef<boolean>(true);
  const [localProfile, setLocalProfile] = useState<BusinessProfile>(user.businessProfile);

  useEffect(() => {
    setLocalProfile(user.businessProfile);
  }, [user.id]);

  const playSound = (url: string) => {
    if (!url) return;
    const audio = new Audio(url);
    audio.volume = 1.0; 
    audio.play().catch(e => console.debug("Audio play blocked"));
  };

  const handleReceiveSound = () => {
    const sound = SOUND_OPTIONS.find(s => s.id === selectedSoundId);
    if (sound && sound.url) playSound(sound.url);
  };

  const changeSoundPreference = (id: string) => {
    setSelectedSoundId(id);
    localStorage.setItem('merchant_sound_id', id);
    const sound = SOUND_OPTIONS.find(s => s.id === id);
    if (sound && sound.url) playSound(sound.url);
  };

  // Call Signaling Loop
  useEffect(() => {
    const checkCalls = async () => {
      try {
        const calls = await sql`
          SELECT * FROM voice_calls 
          WHERE session_id IN (SELECT id FROM chat_sessions WHERE profile_id = ${localProfile.id})
          ORDER BY updated_at DESC LIMIT 1
        `;

        if (calls.length > 0) {
          const call = calls[0];

          if (call.status === 'ended' && callStatus !== 'idle') {
            handleEndCall(false);
            return;
          }

          if (call.caller_role === 'customer' && call.status === 'calling' && callStatus === 'idle') {
            setCallStatus('incoming');
            setActiveCallSessionId(call.session_id);
            if (!ringAudio.current) {
              ringAudio.current = new Audio(RING_SOUND);
              ringAudio.current.loop = true;
            }
            ringAudio.current.play().catch(() => {});
          } 

          if (call.caller_role === 'owner' && call.status === 'connected' && callStatus === 'calling' && call.answer) {
            if (peerConnection.current && peerConnection.current.signalingState === 'have-local-offer') {
              await peerConnection.current.setRemoteDescription(new RTCSessionDescription(call.answer));
              setCallStatus('connected');
              if (ringAudio.current) ringAudio.current.pause();
            }
          }

          if (callStatus === 'connected' || callStatus === 'calling') {
            const remoteCandidates = call.caller_role === 'owner' ? call.receiver_candidates : call.caller_candidates;
            if (remoteCandidates && Array.isArray(remoteCandidates)) {
              for (const candidateData of remoteCandidates) {
                const candidateStr = JSON.stringify(candidateData);
                if (!processedIceCandidates.current.has(candidateStr) && peerConnection.current) {
                  try {
                    await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidateData));
                    processedIceCandidates.current.add(candidateStr);
                  } catch (e) { console.error(e); }
                }
              }
            }
          }
        }
      } catch (e) { console.error(e); }
    };

    const interval = setInterval(checkCalls, 1500); // زيادة السرعة لمزامنة الإنهاء
    return () => clearInterval(interval);
  }, [localProfile.id, callStatus]);

  useEffect(() => {
    let timer: any;
    if (callStatus === 'connected') timer = setInterval(() => setCallDuration(d => d + 1), 1000);
    else setCallDuration(0);
    return () => clearInterval(timer);
  }, [callStatus]);

  const setupWebRTC = async (sessionId: string) => {
    processedIceCandidates.current.clear();
    peerConnection.current = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }]
    });

    peerConnection.current.onicecandidate = async (event) => {
      if (event.candidate) {
        try {
          const colName = callStatus === 'calling' ? 'caller_candidates' : 'receiver_candidates';
          await sql`
            UPDATE voice_calls SET 
              ${sql(colName)} = ${sql(colName)} || ${JSON.stringify([event.candidate])}::jsonb,
              updated_at = NOW()
            WHERE session_id = ${sessionId}
          `;
        } catch (e) { console.error(e); }
      }
    };

    peerConnection.current.ontrack = (event) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0];
        remoteAudioRef.current.play().catch(() => {});
      }
    };

    localStream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStream.current.getTracks().forEach(track => peerConnection.current?.addTrack(track, localStream.current!));
  };

  const handleStartCall = async (sessionId: string) => {
    if (callStatus !== 'idle') return;
    try {
      setCallStatus('calling');
      setActiveCallSessionId(sessionId);
      await sql`
        INSERT INTO voice_calls (session_id, status, caller_role, caller_candidates, receiver_candidates, updated_at)
        VALUES (${sessionId}, 'calling', 'owner', '[]'::jsonb, '[]'::jsonb, NOW())
        ON CONFLICT (session_id) DO UPDATE SET
          status = 'calling', caller_role = 'owner', offer = NULL, answer = NULL,
          caller_candidates = '[]'::jsonb, receiver_candidates = '[]'::jsonb, updated_at = NOW()
      `;
      await setupWebRTC(sessionId);
      const offer = await peerConnection.current!.createOffer();
      await peerConnection.current!.setLocalDescription(offer);
      await sql`UPDATE voice_calls SET offer = ${JSON.stringify(offer)}, updated_at = NOW() WHERE session_id = ${sessionId}`;
      if (!ringAudio.current) { ringAudio.current = new Audio(RING_SOUND); ringAudio.current.loop = true; }
      ringAudio.current.play().catch(() => {});
    } catch (e) { console.error(e); handleEndCall(); }
  };

  const handleAcceptCall = async () => {
    if (!activeCallSessionId) return;
    try {
      await setupWebRTC(activeCallSessionId);
      const callData = await sql`SELECT offer FROM voice_calls WHERE session_id = ${activeCallSessionId}`;
      if (callData.length > 0 && callData[0].offer) {
        await peerConnection.current!.setRemoteDescription(new RTCSessionDescription(callData[0].offer));
        const answer = await peerConnection.current!.createAnswer();
        await peerConnection.current!.setLocalDescription(answer);
        await sql`UPDATE voice_calls SET status = 'connected', answer = ${JSON.stringify(answer)}, updated_at = NOW() WHERE session_id = ${activeCallSessionId}`;
        setCallStatus('connected');
        if (ringAudio.current) ringAudio.current.pause();
      }
    } catch (e) { console.error(e); handleEndCall(); }
  };

  const handleEndCall = async (notifyOtherSide = true) => {
    const sessionId = activeCallSessionId;
    setCallStatus('idle');
    setActiveCallSessionId(null);
    processedIceCandidates.current.clear();
    if (localStream.current) { localStream.current.getTracks().forEach(t => t.stop()); localStream.current = null; }
    if (peerConnection.current) { peerConnection.current.close(); peerConnection.current = null; }
    if (ringAudio.current) { ringAudio.current.pause(); ringAudio.current.currentTime = 0; }
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    if (notifyOtherSide && sessionId) {
      try { await sql`UPDATE voice_calls SET status = 'ended', updated_at = NOW() WHERE session_id = ${sessionId}`; } catch (e) { console.error(e); }
    }
  };

  const formatDuration = (s: number) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  const handleSelectSession = (id: string) => {
    setSelectedSession(id);
    setIsMobileChatOpen(true);
  };

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const sessions = await sql`
          SELECT 
            s.id, s.customer_name as "customerName", s.customer_phone as "customerPhone", 
            s.last_text as "lastText", s.last_active as "lastActive",
            COUNT(m.id) FILTER (WHERE m.sender = 'customer' AND m.is_read = FALSE) as "unreadCount"
          FROM chat_sessions s
          LEFT JOIN chat_messages m ON s.id = m.session_id
          WHERE s.profile_id = ${localProfile.id} 
          GROUP BY s.id
          ORDER BY s.last_active DESC
        `;
        const sessionsData = sessions.map(s => ({ ...s, unreadCount: Number(s.unreadCount || 0) })) as ChatSession[];
        setActiveSessions(sessionsData);
        setTotalUnread(sessionsData.reduce((acc, curr) => acc + (curr.unreadCount || 0), 0));
        if (sessionsData.length > 0) {
          const mostRecent = sessionsData[0];
          const mostRecentTime = new Date(mostRecent.lastActive).getTime();
          if (isInitialLoad.current) { lastGlobalActiveRef.current = mostRecentTime; isInitialLoad.current = false; }
          else if (mostRecentTime > lastGlobalActiveRef.current) {
            if (mostRecent.lastText && !mostRecent.lastText.startsWith('أنت:')) handleReceiveSound();
            lastGlobalActiveRef.current = mostRecentTime;
          }
        }
      } catch (e) { console.error(e); }
    };
    fetchSessions();
    const interval = setInterval(fetchSessions, 5000); 
    return () => clearInterval(interval);
  }, [localProfile.id, selectedSoundId]);

  useEffect(() => {
    if (selectedSession) {
      const fetchMessages = async () => {
        try {
          const msgs = await sql`SELECT id, sender, text, timestamp, is_read FROM chat_messages WHERE session_id = ${selectedSession} ORDER BY timestamp ASC`;
          setChatMessages(msgs.map(m => ({ ...m, timestamp: new Date(m.timestamp) })) as Message[]);
          await sql`UPDATE chat_messages SET is_read = TRUE WHERE session_id = ${selectedSession} AND sender = 'customer' AND is_read = FALSE`;
        } catch (e) { console.error(e); }
      };
      fetchMessages();
      const interval = setInterval(fetchMessages, 3000);
      return () => clearInterval(interval);
    }
  }, [selectedSession]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  const saveAllChanges = async () => {
    setIsSaving(true);
    try {
      const cleanSlug = localProfile.slug.toLowerCase().trim().replace(/[^\w-]/g, '');
      await sql`
        UPDATE profiles SET name = ${localProfile.name}, slug = ${cleanSlug}, owner_name = ${localProfile.ownerName}, 
        description = ${localProfile.description || ''}, phone = ${localProfile.phone}, logo = ${localProfile.logo},
        social_links = ${JSON.stringify(localProfile.socialLinks)}, products = ${JSON.stringify(localProfile.products)},
        currency = ${localProfile.currency}, return_policy = ${localProfile.returnPolicy}, delivery_policy = ${localProfile.deliveryPolicy}
        WHERE id = ${localProfile.id}
      `;
      setShowSaveToast(true);
      setTimeout(() => setShowSaveToast(false), 3000);
    } catch (e) { console.error(e); } finally { setIsSaving(false); }
  };

  const handleReply = async () => {
    if (!replyText.trim() || !selectedSession) return;
    const text = replyText;
    setReplyText('');
    playSound(SEND_SOUND); 
    try {
      await sql`UPDATE chat_sessions SET last_text = ${`أنت: ${text}`}, last_active = NOW() WHERE id = ${selectedSession}`;
      await sql`INSERT INTO chat_messages (session_id, sender, text, is_read) VALUES (${selectedSession}, 'owner', ${text}, TRUE)`;
      setChatMessages(prev => [...prev, { id: Date.now().toString(), sender: 'owner', text, timestamp: new Date() }]);
      lastGlobalActiveRef.current = Date.now();
    } catch (e) { console.error(e); }
  };

  const handleAddProduct = () => {
    if (!newProduct.name || !newProduct.price) return;
    const productToAdd: Product = {
      id: Date.now().toString(),
      name: newProduct.name,
      price: Number(newProduct.price),
      description: '',
      image: newProduct.image || `https://picsum.photos/seed/${Math.random()}/400/400`
    };
    setLocalProfile(prev => ({ ...prev, products: [...prev.products, productToAdd] }));
    setNewProduct({ name: '', price: '', image: '' });
    setIsAddProductModalOpen(false);
  };

  const getPublicChatUrl = () => `${window.location.origin}${window.location.pathname}#/chat/${localProfile.slug || localProfile.id}`;

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
              <div className="bg-white p-6 rounded-3xl shadow-sm border h-[350px]">
                <h3 className="text-md font-bold mb-4 text-[#0D2B4D]">نشاط المحادثات</h3>
                <ResponsiveContainer width="100%" height="85%">
                  <BarChart data={STATS_DATA}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" fontSize={10} />
                    <YAxis fontSize={10} />
                    <Tooltip />
                    <Bar dataKey="chats" fill="#00D1FF" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white p-6 rounded-3xl shadow-sm border h-[350px]">
                <h3 className="text-md font-bold mb-4 text-[#0D2B4D]">الزيارات الأسبوعية</h3>
                <ResponsiveContainer width="100%" height="85%">
                  <LineChart data={STATS_DATA}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" fontSize={10} />
                    <YAxis fontSize={10} />
                    <Tooltip />
                    <Line type="monotone" dataKey="views" stroke="#0D2B4D" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        );

      case DashboardTab.MESSAGES:
        return (
          <div className="flex h-[calc(100vh-180px)] md:h-[calc(100vh-200px)] bg-white rounded-3xl shadow-sm border overflow-hidden animate-in slide-in-from-bottom-4 relative">
            <div className={`w-full md:w-80 border-l overflow-y-auto bg-gray-50/30 ${isMobileChatOpen ? 'hidden md:block' : 'block'}`}>
              <div className="p-5 border-b bg-white sticky top-0 z-10 flex items-center justify-between">
                <h3 className="font-bold text-[#0D2B4D]">صندوق الوارد</h3>
                <button onClick={() => setShowSoundSettings(!showSoundSettings)} className="p-2 text-gray-400 hover:text-[#00D1FF] transition-colors relative">
                   {selectedSoundId === 'mute' ? <VolumeX size={18} /> : <Volume2 size={18} />}
                   {showSoundSettings && (
                     <div className="absolute top-10 left-0 w-48 bg-white border shadow-2xl rounded-2xl p-3 z-50 animate-in zoom-in-95 text-right">
                       <p className="text-[10px] font-black text-gray-400 mb-3 border-b pb-2 text-right">إعدادات التنبيهات</p>
                       <div className="space-y-1">
                         {SOUND_OPTIONS.map(sound => (
                           <button key={sound.id} onClick={(e) => { e.stopPropagation(); changeSoundPreference(sound.id); }} className={`w-full text-right px-3 py-2 rounded-xl text-xs font-bold transition-all ${selectedSoundId === sound.id ? 'bg-[#00D1FF] text-white' : 'text-gray-600 hover:bg-gray-50'}`}>{sound.name}</button>
                         ))}
                       </div>
                     </div>
                   )}
                </button>
              </div>
              {activeSessions.length === 0 ? <div className="p-10 text-center text-gray-400 text-sm">لا توجد رسائل</div> : activeSessions.map(session => (
                <button key={session.id} onClick={() => handleSelectSession(session.id)} className={`w-full p-5 flex items-center gap-4 hover:bg-white transition-all border-b group text-right ${selectedSession === session.id ? 'bg-white border-r-4 border-r-[#00D1FF]' : ''} ${(session.unreadCount || 0) > 0 ? 'bg-blue-50/50' : ''}`}>
                  <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#0D2B4D] to-blue-900 text-white flex items-center justify-center font-bold text-xs shrink-0">{session.customerName?.substring(0, 1) || 'C'}</div>
                  <div className="flex-1 overflow-hidden">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-sm text-[#0D2B4D] truncate">{session.customerName || 'عميل'}</span>
                      <span className="text-[9px] text-gray-400">{session.lastActive ? new Date(session.lastActive).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <div className={`text-xs truncate ${ (session.unreadCount || 0) > 0 ? 'text-[#0D2B4D] font-bold' : 'text-gray-500' }`}>{session.lastText}</div>
                      { (session.unreadCount || 0) > 0 && <div className="bg-red-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center animate-bounce">{session.unreadCount}</div>}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div className={`flex-1 flex flex-col bg-white ${isMobileChatOpen ? 'flex' : 'hidden md:flex'}`}>
              {selectedSession ? (
                <>
                  <div className="p-4 border-b flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button onClick={() => setIsMobileChatOpen(false)} className="md:hidden p-2"><ChevronRight size={24} /></button>
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-[#0D2B4D]">{activeSessions.find(s => s.id === selectedSession)?.customerName?.substring(0,1) || 'U'}</div>
                      <span className="font-bold">{activeSessions.find(s => s.id === selectedSession)?.customerName || 'عميل'}</span>
                    </div>
                    <button onClick={() => handleStartCall(selectedSession)} className="bg-green-500 text-white p-3 rounded-2xl shadow-lg hover:bg-green-600 transition-all flex items-center gap-2 text-xs font-bold"><PhoneCall size={18} /><span className="hidden sm:inline">اتصال</span></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-gray-50/50">
                    {chatMessages.map(msg => (
                      <div key={msg.id} className={`flex ${msg.sender === 'owner' ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[85%] p-4 rounded-2xl text-sm ${msg.sender === 'owner' ? 'bg-[#0D2B4D] text-white rounded-tr-none' : 'bg-white text-gray-800 rounded-tl-none border shadow-sm'}`}>
                          {msg.text}
                          <div className="text-[9px] mt-2 opacity-60">{msg.timestamp?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                  <div className="p-4 border-t bg-white flex gap-2">
                    <input type="text" value={replyText} onChange={(e) => setReplyText(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleReply()} placeholder="اكتب ردك هنا..." className="flex-1 px-4 py-3 rounded-2xl border bg-gray-50 outline-none" />
                    <button onClick={handleReply} className="w-12 h-12 bg-[#00D1FF] text-white rounded-2xl flex items-center justify-center"><Send size={20} /></button>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 p-6 text-center">
                  <MessageSquare size={64} className="mb-4 opacity-10" />
                  <p className="font-bold">اختر محادثة للبدء</p>
                </div>
              )}
            </div>
          </div>
        );

      case DashboardTab.CATALOG:
        return (
          <div className="space-y-6 animate-in slide-in-from-bottom-4 pb-20">
            <div className="flex justify-between items-center bg-white p-5 rounded-3xl border shadow-sm">
              <h3 className="text-xl font-bold text-[#0D2B4D]">إدارة المنتجات</h3>
              <button onClick={() => setIsAddProductModalOpen(true)} className="bg-[#00D1FF] text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg hover:bg-[#00B8E0] transition-all"><Plus size={20} /> إضافة منتج</button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {localProfile.products.map(product => (
                <div key={product.id} className="bg-white rounded-[32px] overflow-hidden shadow-sm border p-4 space-y-4 group">
                  <div className="aspect-square relative rounded-2xl overflow-hidden bg-gray-50">
                    <img src={product.image} className="w-full h-full object-cover transition-transform group-hover:scale-105" alt={product.name} />
                    <button onClick={() => setLocalProfile({...localProfile, products: localProfile.products.filter(p => p.id !== product.id)})} className="absolute top-2 left-2 p-2.5 bg-white/90 text-red-500 rounded-xl shadow-sm"><Trash2 size={16} /></button>
                  </div>
                  <div className="space-y-3">
                    <input className="w-full font-bold text-[#0D2B4D] outline-none border-b border-transparent focus:border-[#00D1FF] bg-transparent pb-1" value={product.name} onChange={(e) => {
                      const newProds = localProfile.products.map(p => p.id === product.id ? {...p, name: e.target.value} : p);
                      setLocalProfile({...localProfile, products: newProds});
                    }} />
                    <div className="flex items-center gap-2">
                      <input type="number" className="w-24 bg-gray-50 px-3 py-2 rounded-xl outline-none font-bold" value={product.price} onChange={(e) => {
                        const newProds = localProfile.products.map(p => p.id === product.id ? {...p, price: Number(e.target.value)} : p);
                        setLocalProfile({...localProfile, products: newProds});
                      }} />
                      <span className="text-xs font-bold text-gray-400">{localProfile.currency}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="fixed bottom-24 lg:bottom-12 left-1/2 -translate-x-1/2 z-50">
              <button onClick={saveAllChanges} disabled={isSaving} className="bg-[#0D2B4D] text-white px-12 py-4 rounded-full font-black shadow-2xl flex items-center gap-3 hover:scale-105 transition-all">
                {isSaving ? <Save className="animate-spin" size={20} /> : <Save size={20} />} حفظ المنتجات
              </button>
            </div>
          </div>
        );

      case DashboardTab.CUSTOMIZE:
        return (
          <div className="max-w-4xl space-y-8 animate-in slide-in-from-bottom-4 pb-32">
            <div className="bg-white p-8 rounded-[40px] shadow-sm border">
               <h3 className="text-xl font-black mb-6 text-[#0D2B4D] flex items-center gap-3"><LinkIcon className="text-[#00D1FF]" /> الرابط المخصص</h3>
               <div className="flex flex-col md:flex-row items-center gap-2 text-right">
                  <div className="w-full md:w-auto bg-gray-100 px-5 py-4 rounded-2xl font-bold text-gray-400 ltr">bazchat.com/</div>
                  <input className="w-full flex-1 px-5 py-4 rounded-2xl border bg-gray-50 outline-none focus:ring-2 focus:ring-[#00D1FF] font-bold ltr" value={localProfile.slug} onChange={(e) => setLocalProfile({...localProfile, slug: e.target.value.toLowerCase().replace(/[^\w-]/g, '')})} />
               </div>
            </div>
            <div className="bg-white p-8 rounded-[40px] shadow-sm border">
              <h3 className="text-xl font-black mb-8 text-[#0D2B4D] flex items-center gap-3"><Palette className="text-[#00D1FF]" /> الهوية البصرية</h3>
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row gap-8 items-center">
                  <div className="w-32 h-32 rounded-[32px] overflow-hidden border-4 border-gray-50 bg-gray-50 shrink-0"><img src={localProfile.logo} className="w-full h-full object-cover" /></div>
                  <div className="flex-1 w-full space-y-2 text-right">
                    <label className="text-xs font-bold text-gray-400">رابط الشعار</label>
                    <input className="w-full px-5 py-4 rounded-2xl border bg-gray-50 outline-none" value={localProfile.logo} onChange={(e) => setLocalProfile({...localProfile, logo: e.target.value})} />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-6 text-right">
                  <div className="space-y-2"><label className="text-xs font-bold text-gray-400">اسم المتجر</label><input className="w-full px-5 py-4 rounded-2xl border bg-gray-50 outline-none" value={localProfile.name} onChange={(e) => setLocalProfile({...localProfile, name: e.target.value})} /></div>
                  <div className="space-y-2"><label className="text-xs font-bold text-gray-400">اسم المالك</label><input className="w-full px-5 py-4 rounded-2xl border bg-gray-50 outline-none" value={localProfile.ownerName} onChange={(e) => setLocalProfile({...localProfile, ownerName: e.target.value})} /></div>
                </div>
                <div className="space-y-2 text-right">
                  <label className="text-xs font-bold text-gray-400">النبذة التعريفية</label>
                  <textarea className="w-full px-5 py-4 rounded-2xl border bg-gray-50 outline-none h-32 resize-none" value={localProfile.description || ''} onChange={(e) => setLocalProfile({...localProfile, description: e.target.value})} />
                </div>
              </div>
            </div>
            <div className="fixed bottom-24 lg:bottom-12 left-1/2 -translate-x-1/2 z-50">
              <button onClick={saveAllChanges} disabled={isSaving} className="bg-[#0D2B4D] text-white px-10 py-4 rounded-full font-black shadow-2xl flex items-center gap-3 hover:scale-105 transition-all">
                {isSaving ? <Save className="animate-spin" size={20} /> : <Save size={20} />} حفظ الهوية
              </button>
            </div>
          </div>
        );

      case DashboardTab.SETTINGS:
        return (
          <div className="max-w-3xl space-y-6 animate-in slide-in-from-bottom-4 pb-20">
            <div className="bg-white p-8 rounded-[40px] shadow-sm border">
               <h3 className="text-xl font-bold mb-8 text-[#0D2B4D] text-right">الإعدادات والسياسات</h3>
               <div className="space-y-6">
                 <div className="space-y-2 text-right">
                    <label className="text-xs font-bold text-gray-400">عملة المتجر</label>
                    <select className="w-full px-5 py-4 rounded-2xl border bg-gray-50 outline-none" value={localProfile.currency} onChange={(e) => setLocalProfile({...localProfile, currency: e.target.value})}>
                      <option value="SAR">ريال سعودي</option><option value="AED">درهم إماراتي</option><option value="USD">دولار أمريكي</option>
                    </select>
                 </div>
                 <div className="space-y-2 text-right">
                    <label className="text-xs font-bold text-gray-400">سياسة الارجاع</label>
                    <textarea className="w-full px-5 py-4 rounded-2xl border bg-gray-50 outline-none h-24" value={localProfile.returnPolicy} onChange={(e) => setLocalProfile({...localProfile, returnPolicy: e.target.value})} />
                 </div>
                 <div className="space-y-2 text-right">
                    <label className="text-xs font-bold text-gray-400">سياسة الشحن والتوصيل</label>
                    <textarea className="w-full px-5 py-4 rounded-2xl border bg-gray-50 outline-none h-24" value={localProfile.deliveryPolicy} onChange={(e) => setLocalProfile({...localProfile, deliveryPolicy: e.target.value})} />
                 </div>
               </div>
            </div>
            <div className="fixed bottom-24 lg:bottom-12 left-1/2 -translate-x-1/2 z-50">
              <button onClick={saveAllChanges} disabled={isSaving} className="bg-[#0D2B4D] text-white px-10 py-4 rounded-full font-black shadow-2xl flex items-center gap-3 hover:scale-105 transition-all">
                {isSaving ? <Save className="animate-spin" size={20} /> : <Save size={20} />} حفظ الإعدادات
              </button>
            </div>
            <button onClick={onLogout} className="w-full bg-red-50 text-red-500 py-5 rounded-[24px] font-bold flex items-center justify-center gap-3 border border-red-100 hover:bg-red-100 transition-colors"><LogOut size={22} /> تسجيل الخروج</button>
          </div>
        );

      default:
        return <div className="p-10 text-center">جاري تحميل المحتوى...</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row font-tajawal">
      <audio ref={remoteAudioRef} autoPlay className="hidden" />

      {isAddProductModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#0D2B4D]/60 backdrop-blur-sm" onClick={() => setIsAddProductModalOpen(false)}></div>
          <div className="relative bg-white w-full max-w-md rounded-[40px] p-8 shadow-2xl">
            <h3 className="text-xl font-black mb-6 text-[#0D2B4D] text-right">منتج جديد</h3>
            <div className="space-y-5 text-right">
              <input type="text" placeholder="اسم المنتج" className="w-full px-5 py-4 rounded-2xl border bg-gray-50" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
              <input type="number" placeholder="السعر" className="w-full px-5 py-4 rounded-2xl border bg-gray-50" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} />
              <input type="text" placeholder="رابط الصورة" className="w-full px-5 py-4 rounded-2xl border bg-gray-50" value={newProduct.image} onChange={e => setNewProduct({...newProduct, image: e.target.value})} />
            </div>
            <button onClick={handleAddProduct} className="w-full mt-8 bg-[#00D1FF] text-white py-5 rounded-[24px] font-black text-lg shadow-xl">تأكيد الإضافة</button>
          </div>
        </div>
      )}

      {callStatus !== 'idle' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#0D2B4D]/90 backdrop-blur-xl"></div>
          <div className="relative bg-white/10 w-full max-w-sm rounded-[50px] p-10 shadow-2xl border border-white/20 text-center text-white animate-in zoom-in-95">
            <div className="relative mb-8">
              <div className="w-32 h-32 rounded-[40px] overflow-hidden mx-auto border-4 border-white/20 p-1 bg-white/10 relative z-10">
                <img src={localProfile.logo} className="w-full h-full object-cover rounded-[34px]" alt="Avatar" />
              </div>
              {callStatus === 'connected' && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-cyan-400/30 rounded-full animate-ping"></div>}
            </div>
            <h3 className="text-2xl font-black mb-2">{activeSessions.find(s => s.id === activeCallSessionId)?.customerName || 'عميل بازشات'}</h3>
            <p className="text-cyan-400 font-bold text-sm tracking-widest uppercase mb-10">
              {callStatus === 'calling' && 'جاري الاتصال...'}
              {callStatus === 'incoming' && 'مكالمة واردة...'}
              {callStatus === 'connected' && formatDuration(callDuration)}
            </p>
            <div className="flex items-center justify-center gap-6">
              {callStatus === 'incoming' ? (
                <>
                  <button onClick={() => handleEndCall(true)} className="w-16 h-16 bg-red-500 text-white rounded-full flex items-center justify-center shadow-2xl hover:bg-red-600 transition-all"><PhoneOff size={28} /></button>
                  <button onClick={handleAcceptCall} className="w-16 h-16 bg-green-500 text-white rounded-full flex items-center justify-center shadow-2xl hover:bg-green-600 animate-bounce transition-all"><PhoneCall size={28} /></button>
                </>
              ) : (
                <>
                  <button onClick={() => setIsMuted(!isMuted)} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all border ${isMuted ? 'bg-white text-[#0D2B4D]' : 'bg-white/10 text-white border-white/20'}`}>{isMuted ? <MicOff size={22} /> : <Mic size={22} />}</button>
                  <button onClick={() => handleEndCall(true)} className="w-20 h-20 bg-red-500 text-white rounded-full flex items-center justify-center shadow-2xl hover:bg-red-600 transition-all"><PhoneOff size={32} /></button>
                  <button className="w-14 h-14 bg-white/10 text-white rounded-full flex items-center justify-center border border-white/20"><Volume2 size={22} /></button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {showSaveToast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-2 z-[999] animate-in slide-in-from-top-10">
          <CheckCircle2 size={18} /> <span className="font-bold text-sm">تم الحفظ بنجاح!</span>
        </div>
      )}

      <aside className="w-72 bg-[#0D2B4D] text-white fixed h-full hidden lg:flex flex-col p-8 z-40">
        <div className="flex items-center gap-3 mb-12 px-2">
          <img src="https://i.ibb.co/XxVXdyhC/6.png" alt="Logo" className="h-10" />
          <span className="text-xl font-extrabold tracking-tight">بازشات</span>
        </div>
        <nav className="flex-1 space-y-2">
          <NavItem active={activeTab === DashboardTab.OVERVIEW} onClick={() => setActiveTab(DashboardTab.OVERVIEW)} icon={<LayoutDashboard size={20} />} label="الرئيسية" />
          <NavItem active={activeTab === DashboardTab.MESSAGES} onClick={() => setActiveTab(DashboardTab.MESSAGES)} icon={<MessageSquare size={20} />} label="المحادثات" badge={totalUnread > 0 ? totalUnread : undefined} />
          <NavItem active={activeTab === DashboardTab.CATALOG} onClick={() => setActiveTab(DashboardTab.CATALOG)} icon={<Package size={20} />} label="المنتجات" />
          <NavItem active={activeTab === DashboardTab.CUSTOMIZE} onClick={() => setActiveTab(DashboardTab.CUSTOMIZE)} icon={<Palette size={20} />} label="الهوية" />
          <NavItem active={activeTab === DashboardTab.SETTINGS} onClick={() => setActiveTab(DashboardTab.SETTINGS)} icon={<Settings size={20} />} label="الإعدادات" />
        </nav>
        <button onClick={onLogout} className="mt-auto flex items-center gap-3 px-4 py-4 text-red-400 hover:bg-red-500/10 rounded-2xl transition-colors font-bold"><LogOut size={20} /> الخروج</button>
      </aside>

      <main className="flex-1 lg:mr-72 p-4 md:p-10 lg:p-16 text-right">
        <header className="hidden lg:flex flex-row items-center justify-between gap-4 mb-12">
          <div className="text-right">
            <h2 className="text-4xl font-black text-[#0D2B4D]">مرحباً، {localProfile.ownerName}</h2>
            <p className="text-gray-500 mt-2 font-medium">إدارة متجر <span className="text-[#00D1FF] font-black">{localProfile.name}</span></p>
          </div>
          <div className="flex gap-4">
            <button onClick={() => { navigator.clipboard.writeText(getPublicChatUrl()); alert('تم نسخ الرابط'); }} className="bg-white border text-gray-700 px-8 py-4 rounded-2xl font-bold flex items-center gap-2 shadow-sm"><Copy size={20} /> نسخ الرابط</button>
            <button onClick={() => window.open(getPublicChatUrl(), '_blank')} className="bg-[#00D1FF] text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-2 shadow-xl shadow-cyan-500/40 hover:scale-105 transition-all"><ExternalLink size={20} /> معاينة المتجر</button>
          </div>
        </header>
        {renderContent()}
      </main>
    </div>
  );
};

const NavItem: React.FC<{active: boolean, onClick: () => void, icon: React.ReactNode, label: string, badge?: number}> = ({ active, onClick, icon, label, badge }) => (
  <button onClick={onClick} className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl font-bold transition-all relative ${active ? 'bg-[#00D1FF] text-white shadow-lg' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
    <div className="flex items-center gap-4">{icon}{label}</div>
    {badge !== undefined && badge > 0 && <span className="bg-red-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center animate-pulse">{badge}</span>}
  </button>
);

const StatCard: React.FC<{icon: React.ReactNode, label: string, value: string, sub: string}> = ({ icon, label, value, sub }) => (
  <div className="bg-white p-5 rounded-[32px] shadow-sm border border-gray-100 text-right"><div className="flex items-center gap-2 mb-3 justify-end"><span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{label}</span><div className="p-2 bg-gray-50 rounded-xl">{icon}</div></div><div><div className="text-2xl font-black text-[#0D2B4D] mb-0.5">{value}</div><div className={`text-[10px] font-bold ${sub.includes('+') ? 'text-green-500' : 'text-red-500'}`}>{sub}</div></div></div>
);

export default Dashboard;
