
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
  
  // Call States
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'incoming' | 'connected' | 'ended'>('idle');
  const [activeCallSessionId, setActiveCallSessionId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const remoteStream = useRef<MediaStream | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const callInterval = useRef<any>(null);
  const ringAudio = useRef<HTMLAudioElement | null>(null);

  const [newProduct, setNewProduct] = useState({ name: '', price: '', image: '' });
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
          AND status != 'idle' AND status != 'ended'
          ORDER BY updated_at DESC LIMIT 1
        `;

        if (calls.length > 0) {
          const call = calls[0];
          // If customer is calling and we are idle
          if (call.caller_role === 'customer' && call.status === 'calling' && callStatus === 'idle') {
            setCallStatus('incoming');
            setActiveCallSessionId(call.session_id);
            if (!ringAudio.current) {
              ringAudio.current = new Audio(RING_SOUND);
              ringAudio.current.loop = true;
            }
            ringAudio.current.play();
          } 
          // If we called and they answered
          else if (call.caller_role === 'owner' && call.status === 'connected' && callStatus === 'calling') {
            const remoteAnswer = call.answer;
            if (remoteAnswer && peerConnection.current && peerConnection.current.signalingState === 'have-local-offer') {
              await peerConnection.current.setRemoteDescription(new RTCSessionDescription(remoteAnswer));
              setCallStatus('connected');
              if (ringAudio.current) ringAudio.current.pause();
            }
          }
          // Handle remote hangup
          else if (call.status === 'ended' && (callStatus === 'connected' || callStatus === 'calling' || callStatus === 'incoming')) {
            handleEndCall();
          }
        }
      } catch (e) {
        console.error("Signaling error", e);
      }
    };

    const interval = setInterval(checkCalls, 2500);
    return () => clearInterval(interval);
  }, [localProfile.id, callStatus]);

  useEffect(() => {
    let timer: any;
    if (callStatus === 'connected') {
      timer = setInterval(() => setCallDuration(d => d + 1), 1000);
    } else {
      setCallDuration(0);
    }
    return () => clearInterval(timer);
  }, [callStatus]);

  const setupWebRTC = async () => {
    peerConnection.current = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    localStream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStream.current.getTracks().forEach(track => {
      peerConnection.current?.addTrack(track, localStream.current!);
    });

    peerConnection.current.ontrack = (event) => {
      remoteStream.current = event.streams[0];
      const audio = new Audio();
      audio.srcObject = remoteStream.current;
      audio.play();
    };
  };

  const handleStartCall = async (sessionId: string) => {
    try {
      setCallStatus('calling');
      setActiveCallSessionId(sessionId);
      await setupWebRTC();
      
      const offer = await peerConnection.current!.createOffer();
      await peerConnection.current!.setLocalDescription(offer);

      await sql`
        INSERT INTO voice_calls (session_id, status, caller_role, offer, updated_at)
        VALUES (${sessionId}, 'calling', 'owner', ${JSON.stringify(offer)}, NOW())
        ON CONFLICT (session_id) DO UPDATE SET
          status = 'calling',
          caller_role = 'owner',
          offer = ${JSON.stringify(offer)},
          updated_at = NOW()
      `;

      if (!ringAudio.current) {
        ringAudio.current = new Audio(RING_SOUND);
        ringAudio.current.loop = true;
      }
      ringAudio.current.play();
    } catch (e) {
      console.error("Failed to start call", e);
      setCallStatus('idle');
    }
  };

  const handleAcceptCall = async () => {
    if (!activeCallSessionId) return;
    try {
      await setupWebRTC();
      
      const callData = await sql`SELECT offer FROM voice_calls WHERE session_id = ${activeCallSessionId}`;
      if (callData.length > 0) {
        await peerConnection.current!.setRemoteDescription(new RTCSessionDescription(callData[0].offer));
        const answer = await peerConnection.current!.createAnswer();
        await peerConnection.current!.setLocalDescription(answer);

        await sql`
          UPDATE voice_calls SET 
            status = 'connected',
            answer = ${JSON.stringify(answer)},
            updated_at = NOW()
          WHERE session_id = ${activeCallSessionId}
        `;
        
        setCallStatus('connected');
        if (ringAudio.current) ringAudio.current.pause();
      }
    } catch (e) {
      console.error("Error accepting call", e);
      handleEndCall();
    }
  };

  const handleEndCall = async () => {
    if (activeCallSessionId) {
      await sql`UPDATE voice_calls SET status = 'ended', updated_at = NOW() WHERE session_id = ${activeCallSessionId}`;
    }
    
    if (localStream.current) localStream.current.getTracks().forEach(t => t.stop());
    if (peerConnection.current) peerConnection.current.close();
    if (ringAudio.current) ringAudio.current.pause();
    
    peerConnection.current = null;
    localStream.current = null;
    setCallStatus('idle');
    setActiveCallSessionId(null);
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Fix: Missing handleSelectSession function added to fix line 426 error
  const handleSelectSession = (id: string) => {
    setSelectedSession(id);
    setIsMobileChatOpen(true);
  };

  // Polling for Chat Sessions
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
        
        const sessionsData = sessions.map(s => ({
          ...s,
          unreadCount: Number(s.unreadCount || 0)
        })) as ChatSession[];
        
        setActiveSessions(sessionsData);
        setTotalUnread(sessionsData.reduce((acc, curr) => acc + (curr.unreadCount || 0), 0));

        if (sessionsData.length > 0) {
          const mostRecent = sessionsData[0];
          const mostRecentTime = new Date(mostRecent.lastActive).getTime();
          if (isInitialLoad.current) {
            lastGlobalActiveRef.current = mostRecentTime;
            isInitialLoad.current = false;
          } else if (mostRecentTime > lastGlobalActiveRef.current) {
            if (mostRecent.lastText && !mostRecent.lastText.startsWith('أنت:')) {
              handleReceiveSound();
            }
            lastGlobalActiveRef.current = mostRecentTime;
          }
        }
      } catch (e) {
        console.error("Error fetching sessions", e);
      }
    };

    fetchSessions();
    const interval = setInterval(fetchSessions, 5000); 
    return () => clearInterval(interval);
  }, [localProfile.id, selectedSoundId]);

  useEffect(() => {
    if (selectedSession) {
      const fetchMessages = async () => {
        try {
          const msgs = await sql`
            SELECT id, sender, text, timestamp, is_read FROM chat_messages 
            WHERE session_id = ${selectedSession} ORDER BY timestamp ASC
          `;
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
                       <p className="text-[10px] font-black text-gray-400 mb-3 border-b pb-2 uppercase tracking-widest">إعدادات التنبيهات</p>
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
                  <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-[#0D2B4D] to-blue-900 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-lg">{session.customerName ? session.customerName.substring(0, 1).toUpperCase() : 'C'}</div>
                  <div className="flex-1 overflow-hidden">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-bold text-sm text-[#0D2B4D] truncate ml-2">{session.customerName || 'عميل'}</span>
                      <span className="text-[9px] text-gray-400">{session.lastActive ? new Date(session.lastActive).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2">
                      <div className={`text-xs truncate font-medium ${ (session.unreadCount || 0) > 0 ? 'text-[#0D2B4D] font-bold' : 'text-gray-500' }`}>{session.lastText}</div>
                      { (session.unreadCount || 0) > 0 && <div className="bg-red-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shrink-0 animate-bounce">{session.unreadCount}</div>}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className={`flex-1 flex flex-col bg-white ${isMobileChatOpen ? 'flex' : 'hidden md:flex'}`}>
              {selectedSession ? (
                <>
                  <div className="p-4 border-b flex items-center justify-between bg-white shadow-sm z-10">
                    <div className="flex items-center gap-3">
                      <button onClick={() => setIsMobileChatOpen(false)} className="md:hidden p-2 -mr-2 text-gray-400 hover:text-[#0D2B4D]"><ChevronRight size={24} /></button>
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center font-bold text-[#0D2B4D] text-xs">{activeSessions.find(s => s.id === selectedSession)?.customerName?.substring(0,1) || 'U'}</div>
                      <div>
                        <span className="block font-bold text-[#0D2B4D] text-sm md:text-base">{activeSessions.find(s => s.id === selectedSession)?.customerName || 'عميل'}</span>
                        <div className="flex items-center gap-1.5"><PhoneIcon size={10} className="text-gray-400" /><span className="text-[10px] text-gray-500 font-bold ltr">{activeSessions.find(s => s.id === selectedSession)?.customerPhone || 'بدون رقم'}</span></div>
                      </div>
                    </div>
                    {/* زر الاتصال الجديد */}
                    <button 
                      onClick={() => handleStartCall(selectedSession)}
                      className="bg-green-500 text-white p-3 rounded-2xl shadow-lg hover:bg-green-600 transition-all flex items-center gap-2 text-xs font-bold"
                    >
                      <PhoneCall size={18} />
                      <span className="hidden sm:inline">اتصال الآن</span>
                    </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-5 md:p-8 space-y-6 bg-gray-50/50">
                    {chatMessages.map(msg => (
                      <div key={msg.id} className={`flex ${msg.sender === 'owner' ? 'justify-start' : 'justify-end'}`}>
                        <div className={`max-w-[85%] md:max-w-[75%] p-4 rounded-2xl text-sm shadow-sm ${msg.sender === 'owner' ? 'bg-[#0D2B4D] text-white rounded-tr-none' : 'bg-white text-gray-800 rounded-tl-none border border-gray-100'}`}>
                          {msg.text}
                          <div className={`text-[9px] mt-2 opacity-60 text-left`}>{msg.timestamp?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  <div className="p-4 border-t bg-white">
                    <div className="flex gap-2">
                      <input type="text" value={replyText} onChange={(e) => setReplyText(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleReply()} placeholder="اكتب ردك هنا..." className="flex-1 px-4 py-3 rounded-2xl border bg-gray-50 outline-none focus:ring-2 focus:ring-[#00D1FF] transition-all text-sm" />
                      <button onClick={handleReply} className="w-12 h-12 bg-[#00D1FF] text-white rounded-2xl flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"><Send size={20} /></button>
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
      default:
        return <div className="p-10">جاري تحميل المحتوى...</div>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row font-tajawal">
      {/* شاشة الاتصال المتكاملة */}
      {callStatus !== 'idle' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#0D2B4D]/90 backdrop-blur-xl animate-in fade-in"></div>
          <div className="relative bg-white/10 w-full max-w-sm rounded-[50px] p-10 shadow-2xl border border-white/20 text-center text-white animate-in zoom-in-95">
            <div className="relative mb-8">
              <div className="w-32 h-32 rounded-[40px] overflow-hidden mx-auto border-4 border-white/20 p-1 bg-white/10 relative z-10">
                <img src={localProfile.logo} className="w-full h-full object-cover rounded-[34px]" alt="Avatar" />
              </div>
              {callStatus === 'connected' && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-cyan-400/30 rounded-full animate-ping"></div>
              )}
            </div>
            
            <h3 className="text-2xl font-black mb-2">
              {activeSessions.find(s => s.id === activeCallSessionId)?.customerName || 'عميل بازشات'}
            </h3>
            <p className="text-cyan-400 font-bold text-sm tracking-widest uppercase mb-10">
              {callStatus === 'calling' && 'جاري الاتصال...'}
              {callStatus === 'incoming' && 'مكالمة واردة...'}
              {callStatus === 'connected' && formatDuration(callDuration)}
            </p>

            {/* موجات صوتية بسيطة */}
            {callStatus === 'connected' && (
              <div className="flex justify-center gap-1.5 h-12 mb-10 items-center">
                {[1,2,3,4,5,6,7].map(i => (
                  <div key={i} className="w-1.5 bg-cyan-400 rounded-full animate-pulse" style={{ height: `${20 + Math.random() * 80}%`, animationDelay: `${i * 0.1}s` }}></div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-center gap-6">
              {callStatus === 'incoming' ? (
                <>
                  <button onClick={handleEndCall} className="w-16 h-16 bg-red-500 text-white rounded-full flex items-center justify-center shadow-2xl hover:bg-red-600 transition-all"><PhoneOff size={28} /></button>
                  <button onClick={handleAcceptCall} className="w-16 h-16 bg-green-500 text-white rounded-full flex items-center justify-center shadow-2xl hover:bg-green-600 animate-bounce transition-all"><PhoneCall size={28} /></button>
                </>
              ) : (
                <>
                  <button onClick={() => setIsMuted(!isMuted)} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all border ${isMuted ? 'bg-white text-[#0D2B4D]' : 'bg-white/10 text-white border-white/20'}`}>
                    {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
                  </button>
                  <button onClick={handleEndCall} className="w-20 h-20 bg-red-500 text-white rounded-full flex items-center justify-center shadow-2xl hover:bg-red-600 transition-all"><PhoneOff size={32} /></button>
                  <button className="w-14 h-14 bg-white/10 text-white rounded-full flex items-center justify-center border border-white/20"><Volume2 size={22} /></button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sidebar and Main Content (Existing) */}
      <aside className="w-72 bg-[#0D2B4D] text-white fixed h-full hidden lg:flex flex-col p-8 z-40">
        <div className="flex items-center gap-3 mb-12 px-2">
          <img src="https://i.ibb.co/XxVXdyhC/6.png" alt="Logo" className="h-10" />
          <span className="text-xl font-extrabold tracking-tight">بازشات</span>
        </div>
        <nav className="flex-1 space-y-2">
          <NavItem active={activeTab === DashboardTab.OVERVIEW} onClick={() => setActiveTab(DashboardTab.OVERVIEW)} icon={<LayoutDashboard size={20} />} label="الرئيسية" />
          <NavItem active={activeTab === DashboardTab.MESSAGES} onClick={() => setActiveTab(DashboardTab.MESSAGES)} icon={<MessageSquare size={20} />} label="المحادثات" badge={totalUnread > 0 ? totalUnread : undefined} />
          <NavItem active={activeTab === DashboardTab.CATALOG} onClick={() => setActiveTab(DashboardTab.CATALOG)} icon={<Package size={20} />} label="المنتجات" />
          <NavItem active={activeTab === DashboardTab.CUSTOMIZE} onClick={() => setActiveTab(DashboardTab.CUSTOMIZE)} icon={<Palette size={20} />} label="تخصيص الهوية" />
          <NavItem active={activeTab === DashboardTab.SETTINGS} onClick={() => setActiveTab(DashboardTab.SETTINGS)} icon={<Settings size={20} />} label="الإعدادات" />
        </nav>
        <button onClick={onLogout} className="mt-auto flex items-center gap-3 px-4 py-4 text-red-400 hover:bg-red-500/10 rounded-2xl transition-colors font-bold"><LogOut size={20} /> الخروج</button>
      </aside>

      <main className="flex-1 lg:mr-72 p-4 md:p-10 lg:p-16 text-right">
        {renderContent()}
      </main>
    </div>
  );
};

const NavItem: React.FC<{active: boolean, onClick: () => void, icon: React.ReactNode, label: string, badge?: number}> = ({ active, onClick, icon, label, badge }) => (
  <button onClick={onClick} className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl font-bold transition-all relative ${active ? 'bg-[#00D1FF] text-white shadow-lg shadow-cyan-500/20 scale-[1.02]' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}>
    <div className="flex items-center gap-4">{icon}{label}</div>
    {badge !== undefined && badge > 0 && <span className="bg-red-500 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center animate-pulse">{badge}</span>}
  </button>
);

const StatCard: React.FC<{icon: React.ReactNode, label: string, value: string, sub: string}> = ({ icon, label, value, sub }) => (
  <div className="bg-white p-5 rounded-[32px] shadow-sm border border-gray-100 text-right"><div className="flex items-center gap-2 mb-3 justify-end"><span className="text-[10px] font-bold text-gray-400 uppercase tracking-tight">{label}</span><div className="p-2 bg-gray-50 rounded-xl">{icon}</div></div><div><div className="text-2xl font-black text-[#0D2B4D] mb-0.5">{value}</div><div className={`text-[10px] font-bold ${sub.includes('+') ? 'text-green-500' : 'text-red-500'}`}>{sub}</div></div></div>
);

export default Dashboard;
