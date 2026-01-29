
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
  
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'incoming' | 'connected' | 'ended'>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const ringAudio = useRef<HTMLAudioElement | null>(null);
  const processedIceCandidates = useRef<Set<string>>(new Set());

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

  // Call Signaling & Sync (Customer)
  useEffect(() => {
    const checkCalls = async () => {
      try {
        const calls = await sql`
          SELECT * FROM voice_calls 
          WHERE session_id = ${chatSessionId.current}
          ORDER BY updated_at DESC LIMIT 1
        `;

        if (calls.length > 0) {
          const call = calls[0];

          // 1. مزامنة الإنهاء
          if (call.status === 'ended' && callStatus !== 'idle') {
            handleEndCall(false);
            return;
          }

          // 2. استقبال مكالمة المتجر
          if (call.caller_role === 'owner' && call.status === 'calling' && callStatus === 'idle') {
            setCallStatus('incoming');
            if (!ringAudio.current) {
              ringAudio.current = new Audio(RING_SOUND);
              ringAudio.current.loop = true;
            }
            ringAudio.current.play().catch(() => {});
          } 

          // 3. استقبال الإجابة (إذا كنت أنا من اتصلت)
          if (call.caller_role === 'customer' && call.status === 'connected' && callStatus === 'calling' && call.answer) {
            if (peerConnection.current && peerConnection.current.signalingState === 'have-local-offer') {
              await peerConnection.current.setRemoteDescription(new RTCSessionDescription(call.answer));
              setCallStatus('connected');
              if (ringAudio.current) ringAudio.current.pause();
            }
          }

          // 4. تبادل ICE Candidates
          if (callStatus === 'connected' || callStatus === 'calling') {
            const remoteCandidates = call.caller_role === 'customer' ? call.receiver_candidates : call.caller_candidates;
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

    const interval = setInterval(checkCalls, 2000);
    return () => clearInterval(interval);
  }, [callStatus]);

  useEffect(() => {
    let timer: any;
    if (callStatus === 'connected') timer = setInterval(() => setCallDuration(d => d + 1), 1000);
    else setCallDuration(0);
    return () => clearInterval(timer);
  }, [callStatus]);

  const setupWebRTC = async () => {
    processedIceCandidates.current.clear();
    peerConnection.current = new RTCPeerConnection({ 
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun2.l.google.com:19302' }] 
    });

    peerConnection.current.onicecandidate = async (event) => {
      if (event.candidate) {
        try {
          const colName = callStatus === 'calling' ? 'caller_candidates' : 'receiver_candidates';
          await sql`
            UPDATE voice_calls SET 
              ${sql(colName)} = ${sql(colName)} || ${JSON.stringify([event.candidate])}::jsonb,
              updated_at = NOW()
            WHERE session_id = ${chatSessionId.current}
          `;
        } catch (e) { console.error(e); }
      }
    };

    peerConnection.current.ontrack = (event) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = event.streams[0];
        remoteAudioRef.current.play().catch(e => console.error(e));
      }
    };

    localStream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    localStream.current.getTracks().forEach(track => peerConnection.current?.addTrack(track, localStream.current!));
  };

  const handleStartCall = async () => {
    if (callStatus !== 'idle') return;
    try {
      setCallStatus('calling');
      
      await sql`
        INSERT INTO voice_calls (session_id, status, caller_role, caller_candidates, receiver_candidates, updated_at)
        VALUES (${chatSessionId.current}, 'calling', 'customer', '[]'::jsonb, '[]'::jsonb, NOW())
        ON CONFLICT (session_id) DO UPDATE SET 
          status = 'calling', caller_role = 'customer', offer = NULL, answer = NULL,
          caller_candidates = '[]'::jsonb, receiver_candidates = '[]'::jsonb, updated_at = NOW()
      `;

      await setupWebRTC();
      
      const offer = await peerConnection.current!.createOffer();
      await peerConnection.current!.setLocalDescription(offer);

      await sql`UPDATE voice_calls SET offer = ${JSON.stringify(offer)}, updated_at = NOW() WHERE session_id = ${chatSessionId.current}`;
      
      if (!ringAudio.current) { ringAudio.current = new Audio(RING_SOUND); ringAudio.current.loop = true; }
      ringAudio.current.play().catch(() => {});
    } catch (e) { console.error(e); handleEndCall(); }
  };

  const handleAcceptCall = async () => {
    try {
      await setupWebRTC();
      const callData = await sql`SELECT offer FROM voice_calls WHERE session_id = ${chatSessionId.current}`;
      if (callData.length > 0 && callData[0].offer) {
        await peerConnection.current!.setRemoteDescription(new RTCSessionDescription(callData[0].offer));
        const answer = await peerConnection.current!.createAnswer();
        await peerConnection.current!.setLocalDescription(answer);
        await sql`UPDATE voice_calls SET status = 'connected', answer = ${JSON.stringify(answer)}, updated_at = NOW() WHERE session_id = ${chatSessionId.current}`;
        setCallStatus('connected');
        if (ringAudio.current) ringAudio.current.pause();
      }
    } catch (e) { console.error(e); handleEndCall(); }
  };

  const handleEndCall = async (notifyOtherSide = true) => {
    setCallStatus('idle');
    processedIceCandidates.current.clear();

    if (localStream.current) {
      localStream.current.getTracks().forEach(t => t.stop());
      localStream.current = null;
    }
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    if (ringAudio.current) {
      ringAudio.current.pause();
      ringAudio.current.currentTime = 0;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }

    if (notifyOtherSide) {
      try {
        await sql`UPDATE voice_calls SET status = 'ended', updated_at = NOW() WHERE session_id = ${chatSessionId.current}`;
      } catch (e) { console.error(e); }
    }
  };

  const formatDuration = (s: number) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

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
      {/* عنصر الصوت الخفي */}
      <audio ref={remoteAudioRef} autoPlay className="hidden" />

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

            <div className="flex items-center justify-center gap-6">
              {callStatus === 'incoming' ? (
                <>
                  <button onClick={() => handleEndCall(true)} className="w-14 h-14 bg-red-500 rounded-full flex items-center justify-center shadow-lg"><PhoneOff size={24} /></button>
                  <button onClick={handleAcceptCall} className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center shadow-xl animate-bounce"><PhoneCall size={28} /></button>
                </>
              ) : (
                <>
                  <button onClick={() => setIsMuted(!isMuted)} className={`w-12 h-12 rounded-full flex items-center justify-center border ${isMuted ? 'bg-white text-black' : 'border-white/20'}`}>{isMuted ? <MicOff size={20} /> : <Mic size={20} />}</button>
                  <button onClick={() => handleEndCall(true)} className="w-16 h-16 bg-red-500 text-white rounded-full flex items-center justify-center shadow-xl hover:scale-105 transition-all"><PhoneOff size={28} /></button>
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
          <button onClick={handleStartCall} disabled={callStatus !== 'idle'} className="w-11 h-11 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center hover:bg-green-100 transition-all border border-green-100 shadow-sm disabled:opacity-50"><PhoneCall size={20} /></button>
          <button onClick={() => setIsCatalogOpen(true)} className="w-11 h-11 rounded-2xl bg-[#00D1FF] text-white flex items-center justify-center hover:bg-cyan-600 transition-all shadow-xl shadow-cyan-500/20"><ShoppingBag size={20} /></button>
        </div>
      </header>

      {/* Chat Messages and Footer */}
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
