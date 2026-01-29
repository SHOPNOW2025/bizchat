
import React, { useState, useRef, useEffect } from 'react';
import { BusinessProfile, Message, FAQ } from '../types';
import { sql } from '../neon';
import { 
  Send, 
  ShoppingBag, 
  PhoneCall, 
  Mic, 
  MicOff, 
  PhoneOff,
  Volume2,
  ChevronRight,
  Bot,
  X,
  MessageCircle,
  Package
} from 'lucide-react';

interface PublicChatPageProps {
  profile: BusinessProfile;
}

const RING_SOUND = 'https://assets.mixkit.co/active_storage/sfx/1344/1344-preview.mp3';
const SEND_SOUND = 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3';
const HANGUP_SOUND = 'https://assets.mixkit.co/active_storage/sfx/2355/2355-preview.mp3';

const PublicChatPage: React.FC<PublicChatPageProps> = ({ profile }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'incoming' | 'connected' | 'ended'>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [showCatalog, setShowCatalog] = useState(false);
  const [isBotThinking, setIsBotThinking] = useState(false);

  const pc = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const ringAudio = useRef<HTMLAudioElement | null>(null);
  const processedCandidates = useRef<Set<string>>(new Set());
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatSessionId = useRef<string>(localStorage.getItem(`chat_session_${profile.id}`) || `session_${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    localStorage.setItem(`chat_session_${profile.id}`, chatSessionId.current);
    // تسجيل الجلسة في قاعدة البيانات إذا لم تكن موجودة
    const regSession = async () => {
      try {
        await sql`
          INSERT INTO chat_sessions (id, profile_id, customer_name, customer_phone)
          VALUES (${chatSessionId.current}, ${profile.id}, 'عميل بازشات', '')
          ON CONFLICT (id) DO NOTHING
        `;
      } catch (e) {}
    };
    regSession();
  }, [profile.id]);

  const playSound = (url: string) => { new Audio(url).play().catch(() => {}); };

  // Call Signaling Logic (Customer)
  useEffect(() => {
    const monitorSignaling = async () => {
      try {
        const calls = await sql`
          SELECT * FROM voice_calls WHERE session_id = ${chatSessionId.current}
          ORDER BY updated_at DESC LIMIT 1
        `;

        if (calls.length > 0) {
          const call = calls[0];
          if (callStatus !== 'idle' && (call.status === 'ended' || (currentCallId && call.call_id !== currentCallId))) {
            handleEndCall(false);
            return;
          }

          if (call.status === 'calling' && call.caller_role === 'owner' && callStatus === 'idle') {
            setCallStatus('incoming');
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
      } catch (e) {}
    };

    const timer = setInterval(monitorSignaling, 1500);
    return () => clearInterval(timer);
  }, [callStatus, currentCallId]);

  useEffect(() => {
    let interval: any;
    if (callStatus === 'connected') interval = setInterval(() => setCallDuration(d => d + 1), 1000);
    else setCallDuration(0);
    return () => clearInterval(interval);
  }, [callStatus]);

  const handleStartCall = async () => {
    if (callStatus !== 'idle') return;
    const callId = `call_${Date.now()}`;
    setCurrentCallId(callId);
    setCallStatus('calling');
    try {
      await sql`INSERT INTO voice_calls (session_id, call_id, status, caller_role, updated_at) VALUES (${chatSessionId.current}, ${callId}, 'calling', 'customer', NOW()) ON CONFLICT (session_id) DO UPDATE SET call_id = ${callId}, status = 'calling', caller_role = 'customer', updated_at = NOW()`;
      
      pc.current = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      pc.current.onicecandidate = async (event) => {
        if (event.candidate) {
          await sql`UPDATE voice_calls SET caller_candidates = caller_candidates || ${JSON.stringify([event.candidate])}::jsonb, updated_at = NOW() WHERE session_id = ${chatSessionId.current} AND call_id = ${callId}`;
        }
      };
      
      localStream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStream.current.getTracks().forEach(track => pc.current?.addTrack(track, localStream.current!));
      
      const offer = await pc.current.createOffer();
      await pc.current.setLocalDescription(offer);
      await sql`UPDATE voice_calls SET offer = ${JSON.stringify(offer)} WHERE session_id = ${chatSessionId.current} AND call_id = ${callId}`;
      
      if (!ringAudio.current) { ringAudio.current = new Audio(RING_SOUND); ringAudio.current.loop = true; }
      ringAudio.current.play().catch(() => {});
    } catch (e) { handleEndCall(); }
  };

  const handleEndCall = async (notify = true) => {
    const cId = currentCallId;
    setCallStatus('idle');
    setCurrentCallId(null);
    playSound(HANGUP_SOUND);
    if (localStream.current) localStream.current.getTracks().forEach(t => t.stop());
    if (pc.current) pc.current.close();
    if (ringAudio.current) ringAudio.current.pause();
    if (notify && cId) {
      try { await sql`UPDATE voice_calls SET status = 'ended', updated_at = NOW() WHERE session_id = ${chatSessionId.current} AND call_id = ${cId}`; } catch (e) {}
    }
  };

  const formatDuration = (s: number) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  useEffect(() => {
    const fetchMsgs = async () => {
      try {
        const msgs = await sql`SELECT id, sender, text, timestamp FROM chat_messages WHERE session_id = ${chatSessionId.current} ORDER BY timestamp ASC`;
        setMessages(msgs.map(m => ({ ...m, timestamp: new Date(m.timestamp) })) as Message[]);
      } catch (e) {}
    };
    fetchMsgs();
    const interval = setInterval(fetchMsgs, 3000);
    return () => clearInterval(interval);
  }, [profile.id]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isBotThinking]);

  const handleSend = async (customText?: string) => {
    const txt = customText || inputValue;
    if (!txt.trim()) return;
    if (!customText) setInputValue('');
    playSound(SEND_SOUND);
    try {
      await sql`UPDATE chat_sessions SET last_text = ${txt}, last_active = NOW() WHERE id = ${chatSessionId.current}`;
      await sql`INSERT INTO chat_messages (session_id, sender, text) VALUES (${chatSessionId.current}, 'customer', ${txt})`;
      setMessages(prev => [...prev, { id: `m_${Date.now()}`, sender: 'customer', text: txt, timestamp: new Date() }]);
    } catch (e) {}
  };

  const handleFAQClick = async (faq: FAQ) => {
    // 1. Send the question as customer message
    await handleSend(faq.question);
    
    // 2. Bot thinking simulation
    setIsBotThinking(true);
    setTimeout(async () => {
      setIsBotThinking(false);
      // 3. Send the answer as owner message
      try {
        await sql`INSERT INTO chat_messages (session_id, sender, text) VALUES (${chatSessionId.current}, 'owner', ${faq.answer})`;
        setMessages(prev => [...prev, { id: `bot_${Date.now()}`, sender: 'owner', text: faq.answer, timestamp: new Date() }]);
      } catch (e) {}
    }, 1500);
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col max-w-full md:max-w-2xl mx-auto shadow-2xl relative overflow-hidden font-tajawal text-right">
      <audio ref={remoteAudioRef} autoPlay className="hidden" />

      {/* Catalog Modal */}
      {showCatalog && (
        <div className="fixed inset-0 z-[100] bg-[#0D2B4D]/60 backdrop-blur-md animate-in fade-in duration-300">
           <div className="absolute inset-x-0 bottom-0 h-[85vh] bg-white rounded-t-[50px] shadow-2xl overflow-y-auto p-8 animate-in slide-in-from-bottom duration-500">
             <div className="flex items-center justify-between mb-8 sticky top-0 bg-white z-10 py-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#00D1FF]/10 rounded-2xl flex items-center justify-center text-[#00D1FF]"><Package size={24}/></div>
                  <h2 className="text-2xl font-black text-[#0D2B4D]">كتالوج المنتجات</h2>
                </div>
                <button onClick={() => setShowCatalog(false)} className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-500"><X size={24}/></button>
             </div>
             
             <div className="grid grid-cols-2 gap-4">
                {profile.products.map(p => (
                  <div key={p.id} className="bg-gray-50 rounded-[32px] overflow-hidden border p-3 group">
                     <div className="aspect-square rounded-[24px] overflow-hidden mb-3 bg-white">
                        <img src={p.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                     </div>
                     <div className="px-2">
                        <h4 className="font-black text-[#0D2B4D] text-sm truncate">{p.name}</h4>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-[#00D1FF] font-black text-sm">{p.price} {profile.currency}</p>
                          <button onClick={() => { handleSend(`أنا مهتم بمنتج: ${p.name}`); setShowCatalog(false); }} className="w-8 h-8 bg-[#0D2B4D] text-white rounded-xl flex items-center justify-center hover:scale-110 transition-transform"><MessageCircle size={14}/></button>
                        </div>
                     </div>
                  </div>
                ))}
                {profile.products.length === 0 && (
                  <div className="col-span-full py-20 text-center text-gray-400"><Package size={48} className="mx-auto mb-3 opacity-20" /><p className="font-bold">لا توجد منتجات معروضة حالياً</p></div>
                )}
             </div>
           </div>
        </div>
      )}

      {/* Call UI */}
      {callStatus !== 'idle' && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-2xl"></div>
          <div className="relative w-full max-w-xs text-center text-white animate-in zoom-in-95">
             <div className="mb-8 relative flex justify-center">
                <div className="w-28 h-28 rounded-[40px] overflow-hidden border-4 border-[#00D1FF] p-1 bg-white relative z-10 shadow-2xl">
                  <img src={profile.logo} className="w-full h-full object-cover rounded-[34px]" />
                </div>
                {callStatus === 'connected' && <div className="absolute top-0 w-32 h-32 m-auto border-2 border-cyan-400 rounded-full animate-ping opacity-40"></div>}
             </div>
             <h3 className="text-2xl font-black mb-1">{profile.name}</h3>
             <p className="text-[#00D1FF] font-black text-xs uppercase tracking-widest mb-12">
               {callStatus === 'calling' && 'جاري طلب المكالمة...'}
               {callStatus === 'incoming' && 'المتجر يتصل بك...'}
               {callStatus === 'connected' && formatDuration(callDuration)}
             </p>
             <div className="flex items-center justify-center gap-6">
                <button onClick={() => handleEndCall(true)} className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center shadow-xl hover:scale-110 transition-transform active:scale-95"><PhoneOff size={32}/></button>
                {callStatus === 'incoming' && <button onClick={handleStartCall} className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center shadow-xl animate-bounce"><PhoneCall size={32}/></button>}
             </div>
          </div>
        </div>
      )}

      {/* Main Header */}
      <header className="bg-white/80 backdrop-blur-md p-4 flex items-center justify-between border-b shadow-sm sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-[18px] overflow-hidden border-2 border-[#00D1FF] p-0.5 shadow-lg bg-white shrink-0"><img src={profile.logo} className="w-full h-full object-cover rounded-[16px]" /></div>
          <div className="overflow-hidden">
            <h1 className="font-black text-base text-[#0D2B4D] truncate">{profile.name}</h1>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-500"></div><span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Online</span></div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleStartCall} disabled={callStatus !== 'idle'} className="w-10 h-10 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center border border-green-100 disabled:opacity-50 active:scale-90 transition-transform"><PhoneCall size={18} /></button>
          <button onClick={() => setShowCatalog(true)} className="w-10 h-10 rounded-2xl bg-[#00D1FF] text-white flex items-center justify-center shadow-lg shadow-cyan-100 active:scale-90 transition-transform"><ShoppingBag size={18} /></button>
        </div>
      </header>

      {/* Chat History */}
      <main className="flex-1 overflow-y-auto p-4 space-y-5 bg-gray-50/20">
        {messages.length === 0 && (
          <div className="text-center py-10 px-6 animate-in fade-in duration-700">
             <div className="w-20 h-20 bg-[#00D1FF]/10 rounded-[30px] flex items-center justify-center text-[#00D1FF] mx-auto mb-6"><MessageCircle size={40}/></div>
             <h3 className="text-xl font-black text-[#0D2B4D] mb-2">أهلاً بك في بازشات {profile.name}</h3>
             <p className="text-gray-400 text-sm font-bold leading-relaxed">{profile.description || 'يمكنك طرح استفساراتك أو تصفح منتجاتنا، يسعدنا خدمتك دائماً.'}</p>
          </div>
        )}

        {messages.map((m, idx) => (
          <div key={m.id} className={`flex ${m.sender==='customer'?'justify-end':'justify-start'} animate-in slide-in-from-bottom-2`}>
            <div className={`max-w-[85%] p-4 rounded-[26px] text-sm font-bold shadow-sm ${m.sender==='customer'?'bg-[#0D2B4D] text-white rounded-tr-none':'bg-white border border-gray-100 rounded-tl-none text-gray-800'}`}>
              <p className="leading-relaxed">{m.text}</p>
              <div className="text-[9px] mt-2 opacity-60 text-left font-black">{m.timestamp.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>
            </div>
          </div>
        ))}
        
        {isBotThinking && (
          <div className="flex justify-start animate-pulse">
            <div className="bg-white border p-3 rounded-2xl rounded-tl-none flex gap-1">
              <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce"></div>
              <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce delay-100"></div>
              <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce delay-200"></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Bot / FAQ Actions */}
      {profile.faqs && profile.faqs.length > 0 && messages.length < 10 && (
        <div className="bg-white/50 px-4 py-3 flex gap-2 overflow-x-auto no-scrollbar border-t border-gray-50 shrink-0">
          <div className="w-8 h-8 bg-[#0D2B4D] text-white rounded-full flex items-center justify-center shrink-0 shadow-lg"><Bot size={18}/></div>
          {profile.faqs.map((faq) => (
            <button 
              key={faq.id} 
              onClick={() => handleFAQClick(faq)}
              className="bg-white border px-4 py-2 rounded-2xl text-xs font-black text-gray-700 whitespace-nowrap shadow-sm hover:border-[#00D1FF] transition-colors"
            >
              {faq.question}
            </button>
          ))}
        </div>
      )}

      {/* Input Footer */}
      <footer className="p-4 bg-white border-t safe-area-bottom">
        <div className="flex items-center gap-2">
          <input 
            type="text" 
            value={inputValue} 
            onChange={e=>setInputValue(e.target.value)} 
            onKeyPress={e=>e.key==='Enter'&&handleSend()} 
            placeholder="اكتب استفسارك هنا..." 
            className="flex-1 px-5 py-4 rounded-[22px] bg-gray-50 border outline-none text-right font-bold text-sm focus:ring-2 focus:ring-[#00D1FF]/10 transition-all" 
          />
          <button 
            onClick={() => handleSend()} 
            disabled={!inputValue.trim()} 
            className="w-14 h-14 bg-[#0D2B4D] text-white rounded-[22px] flex items-center justify-center shadow-xl shadow-blue-500/10 active:scale-90 transition-all disabled:opacity-50"
          >
            <Send size={24} className="-rotate-45" />
          </button>
        </div>
      </footer>
    </div>
  );
};

export default PublicChatPage;
