
import React, { useState, useRef, useEffect } from 'react';
import { BusinessProfile, Message } from '../types';
import { sql } from '../neon';
import { 
  Send, 
  Phone, 
  Instagram, 
  ShoppingBag, 
  Info, 
  X, 
  CheckCheck,
  MessageCircle,
  User as UserIcon,
  Twitter,
  Facebook,
  CheckCircle2,
  Volume2,
  VolumeX,
  Settings,
  PhoneCall,
  Mic,
  MicOff,
  PhoneOff
} from 'lucide-react';

interface PublicChatPageProps {
  profile: BusinessProfile;
}

const SOUND_OPTIONS = [
  { id: 'standard', name: 'قياسي', url: 'https://assets.mixkit.co/active_storage/sfx/2359/2359-preview.mp3' },
  { id: 'soft', name: 'نغمة هادئة', url: 'https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3' },
  { id: 'mute', name: 'كتم الصوت', url: '' },
];

const RING_SOUND = 'https://assets.mixkit.co/active_storage/sfx/1344/1344-preview.mp3';
const SEND_SOUND = 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3';

const PublicChatPage: React.FC<PublicChatPageProps> = ({ profile }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [isPolicyOpen, setIsPolicyOpen] = useState(false);
  const [showSoundMenu, setShowSoundMenu] = useState(false);
  const [selectedSoundId, setSelectedSoundId] = useState(localStorage.getItem('customer_sound_id') || 'standard');
  
  // Call States
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'incoming' | 'connected' | 'ended'>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const remoteStream = useRef<MediaStream | null>(null);
  const ringAudio = useRef<HTMLAudioElement | null>(null);

  // Lead form states
  const [isLeadFormOpen, setIsLeadFormOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessagesCount = useRef<number | null>(null);
  const chatSessionId = useRef<string>(localStorage.getItem(`chat_session_${profile.id}`) || `session_${Math.random().toString(36).substr(2, 9)}`);

  const playSound = (url: string) => {
    if (!url) return;
    const audio = new Audio(url);
    audio.play().catch(e => console.debug("Audio play blocked"));
  };

  // Call Signaling Loop (Customer Side)
  useEffect(() => {
    const checkCalls = async () => {
      try {
        const calls = await sql`
          SELECT * FROM voice_calls 
          WHERE session_id = ${chatSessionId.current}
          AND status != 'idle' AND status != 'ended'
          ORDER BY updated_at DESC LIMIT 1
        `;

        if (calls.length > 0) {
          const call = calls[0];
          // If Owner is calling and we are idle
          if (call.caller_role === 'owner' && call.status === 'calling' && callStatus === 'idle') {
            setCallStatus('incoming');
            if (!ringAudio.current) {
              ringAudio.current = new Audio(RING_SOUND);
              ringAudio.current.loop = true;
            }
            ringAudio.current.play();
          } 
          // If we called and they answered
          else if (call.caller_role === 'customer' && call.status === 'connected' && callStatus === 'calling') {
            const remoteAnswer = call.answer;
            if (remoteAnswer && peerConnection.current && peerConnection.current.signalingState === 'have-local-offer') {
              await peerConnection.current.setRemoteDescription(new RTCSessionDescription(remoteAnswer));
              setCallStatus('connected');
              if (ringAudio.current) ringAudio.current.pause();
            }
          }
          // Handle hangup
          else if (call.status === 'ended' && callStatus !== 'idle') {
            handleEndCall();
          }
        }
      } catch (e) { console.error(e); }
    };

    const interval = setInterval(checkCalls, 2500);
    return () => clearInterval(interval);
  }, [callStatus]);

  useEffect(() => {
    let timer: any;
    if (callStatus === 'connected') timer = setInterval(() => setCallDuration(d => d + 1), 1000);
    else setCallDuration(0);
    return () => clearInterval(timer);
  }, [callStatus]);

  const setupWebRTC = async () => {
    peerConnection.current = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    localStream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStream.current.getTracks().forEach(track => peerConnection.current?.addTrack(track, localStream.current!));
    peerConnection.current.ontrack = (event) => {
      remoteStream.current = event.streams[0];
      const audio = new Audio();
      audio.srcObject = remoteStream.current;
      audio.play();
    };
  };

  const handleStartCall = async () => {
    try {
      setCallStatus('calling');
      await setupWebRTC();
      const offer = await peerConnection.current!.createOffer();
      await peerConnection.current!.setLocalDescription(offer);
      await sql`
        INSERT INTO voice_calls (session_id, status, caller_role, offer, updated_at)
        VALUES (${chatSessionId.current}, 'calling', 'customer', ${JSON.stringify(offer)}, NOW())
        ON CONFLICT (session_id) DO UPDATE SET status = 'calling', caller_role = 'customer', offer = ${JSON.stringify(offer)}, updated_at = NOW()
      `;
      if (!ringAudio.current) { ringAudio.current = new Audio(RING_SOUND); ringAudio.current.loop = true; }
      ringAudio.current.play();
    } catch (e) { console.error(e); setCallStatus('idle'); }
  };

  const handleAcceptCall = async () => {
    try {
      await setupWebRTC();
      const callData = await sql`SELECT offer FROM voice_calls WHERE session_id = ${chatSessionId.current}`;
      if (callData.length > 0) {
        await peerConnection.current!.setRemoteDescription(new RTCSessionDescription(callData[0].offer));
        const answer = await peerConnection.current!.createAnswer();
        await peerConnection.current!.setLocalDescription(answer);
        await sql`UPDATE voice_calls SET status = 'connected', answer = ${JSON.stringify(answer)}, updated_at = NOW() WHERE session_id = ${chatSessionId.current}`;
        setCallStatus('connected');
        if (ringAudio.current) ringAudio.current.pause();
      }
    } catch (e) { console.error(e); handleEndCall(); }
  };

  const handleEndCall = async () => {
    await sql`UPDATE voice_calls SET status = 'ended', updated_at = NOW() WHERE session_id = ${chatSessionId.current}`;
    if (localStream.current) localStream.current.getTracks().forEach(t => t.stop());
    if (peerConnection.current) peerConnection.current.close();
    if (ringAudio.current) ringAudio.current.pause();
    setCallStatus('idle');
  };

  const formatDuration = (s: number) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  // Check if lead info is already provided
  useEffect(() => {
    const savedInfo = localStorage.getItem(`customer_info_${profile.id}`);
    if (!savedInfo) setIsLeadFormOpen(true);
    else { const { name, phone } = JSON.parse(savedInfo); setCustomerName(name); setCustomerPhone(phone); }
  }, [profile.id]);

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const msgs = await sql`SELECT id, sender, text, timestamp FROM chat_messages WHERE session_id = ${chatSessionId.current} ORDER BY timestamp ASC`;
        const newMessages = msgs.map(m => ({ ...m, timestamp: new Date(m.timestamp) })) as Message[];
        if (prevMessagesCount.current !== null && newMessages.length > prevMessagesCount.current) {
          if (newMessages[newMessages.length - 1].sender === 'owner') {
             const sound = SOUND_OPTIONS.find(s => s.id === selectedSoundId);
             if (sound && sound.url) playSound(sound.url);
          }
        }
        setMessages(newMessages.length === 0 ? [{ id: 'welcome', sender: 'owner', text: `مرحباً بك في ${profile.name}! كيف يمكنني مساعدتك اليوم؟`, timestamp: new Date() }] : newMessages);
        prevMessagesCount.current = newMessages.length || 1; 
      } catch (e) { console.error(e); }
    };
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [profile.id, selectedSoundId]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;
    const text = inputValue;
    setInputValue('');
    playSound(SEND_SOUND); 
    try {
      await sql`UPDATE chat_sessions SET last_text = ${text}, last_active = NOW() WHERE id = ${chatSessionId.current}`;
      await sql`INSERT INTO chat_messages (session_id, sender, text) VALUES (${chatSessionId.current}, 'customer', ${text})`;
      setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'customer', text, timestamp: new Date() }]);
    } catch (e) { console.error(e); }
  };

  return (
    <div className="h-screen bg-[#F0F4F8] flex flex-col max-w-2xl mx-auto shadow-2xl relative overflow-hidden font-tajawal">
      {/* شاشة الاتصال للعميل */}
      {callStatus !== 'idle' && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-[#0D2B4D]/95 backdrop-blur-2xl animate-in fade-in"></div>
          <div className="relative w-full max-w-xs text-center text-white animate-in zoom-in-95">
            <div className="relative mb-8">
              <div className="w-28 h-28 rounded-full overflow-hidden mx-auto border-4 border-[#00D1FF] shadow-2xl relative z-10 p-1 bg-white">
                <img src={profile.logo} className="w-full h-full object-cover rounded-full" alt="Avatar" />
              </div>
              {callStatus === 'connected' && <div className="absolute inset-0 w-32 h-32 m-auto border-2 border-[#00D1FF]/40 rounded-full animate-ping"></div>}
            </div>
            
            <h3 className="text-xl font-black mb-1">{profile.name}</h3>
            <p className="text-[#00D1FF] font-bold text-xs uppercase tracking-widest mb-12">
              {callStatus === 'calling' && 'جاري الاتصال بالمتجر...'}
              {callStatus === 'incoming' && 'المتجر يتصل بك...'}
              {callStatus === 'connected' && formatDuration(callDuration)}
            </p>

            {callStatus === 'connected' && (
              <div className="flex justify-center gap-1.5 h-8 mb-12 items-center">
                {[1,2,3,4,5].map(i => <div key={i} className="w-1 bg-[#00D1FF] rounded-full animate-pulse" style={{ height: `${30 + Math.random() * 70}%`, animationDelay: `${i * 0.1}s` }}></div>)}
              </div>
            )}

            <div className="flex items-center justify-center gap-6">
              {callStatus === 'incoming' ? (
                <>
                  <button onClick={handleEndCall} className="w-14 h-14 bg-red-500 rounded-full flex items-center justify-center shadow-lg"><PhoneOff size={24} /></button>
                  <button onClick={handleAcceptCall} className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center shadow-xl animate-bounce"><PhoneCall size={28} /></button>
                </>
              ) : (
                <>
                  <button onClick={() => setIsMuted(!isMuted)} className={`w-12 h-12 rounded-full flex items-center justify-center border ${isMuted ? 'bg-white text-black' : 'border-white/20'}`}>{isMuted ? <MicOff size={20} /> : <Mic size={20} />}</button>
                  <button onClick={handleEndCall} className="w-16 h-16 bg-red-500 text-white rounded-full flex items-center justify-center shadow-xl hover:scale-105 transition-all"><PhoneOff size={28} /></button>
                  <button className="w-12 h-12 rounded-full flex items-center justify-center border border-white/20"><Volume2 size={20} /></button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* الرأس (Header) */}
      <header className="bg-white p-5 flex items-center justify-between border-b shadow-sm z-30">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-[20px] overflow-hidden border-2 border-[#00D1FF] p-0.5 shadow-lg bg-gray-50">
            <img src={profile.logo} alt={profile.name} className="w-full h-full object-cover rounded-[18px]" />
          </div>
          <div>
            <h1 className="font-black text-lg text-[#0D2B4D] leading-none mb-1.5">{profile.name}</h1>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div><span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">مستعد لخدمتك</span></div>
          </div>
        </div>
        <div className="flex gap-2.5">
          <button onClick={handleStartCall} className="w-11 h-11 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center hover:bg-green-100 transition-all border border-green-100 shadow-sm"><PhoneCall size={20} /></button>
          <button onClick={() => setIsCatalogOpen(true)} className="w-11 h-11 rounded-2xl bg-[#00D1FF] text-white flex items-center justify-center hover:bg-cyan-600 transition-all shadow-xl shadow-cyan-500/20"><ShoppingBag size={20} /></button>
        </div>
      </header>

      {/* Chat Messages and Footer (Existing) */}
      <main className="flex-1 overflow-y-auto p-5 space-y-6 bg-gray-50/50">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'customer' ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[85%] p-4 rounded-3xl shadow-sm ${msg.sender === 'customer' ? 'bg-white text-gray-800 rounded-tr-none' : 'bg-[#0D2B4D] text-white rounded-tl-none border-b-2 border-blue-900'}`}>
              <p className="text-sm font-medium">{msg.text}</p>
              <div className="text-[9px] mt-2 opacity-60">{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </main>

      <footer className="p-5 bg-white border-t">
        <div className="flex items-center gap-3">
          <input type="text" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSend()} placeholder="اكتب رسالتك هنا..." className="flex-1 px-5 py-4 rounded-[24px] bg-gray-50 border outline-none focus:ring-2 focus:ring-[#00D1FF] text-sm" />
          <button onClick={handleSend} disabled={!inputValue.trim()} className="w-14 h-14 bg-[#0D2B4D] text-white rounded-[24px] flex items-center justify-center shadow-lg disabled:opacity-50 transition-all"><Send size={22} className="-rotate-45 -mr-1" /></button>
        </div>
      </footer>
    </div>
  );
};

export default PublicChatPage;
