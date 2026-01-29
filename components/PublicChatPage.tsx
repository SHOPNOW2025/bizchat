
import React, { useState, useRef, useEffect } from 'react';
import { BusinessProfile, Message } from '../types';
import { sql } from '../neon';
import { 
  Send, 
  ShoppingBag, 
  PhoneCall, 
  Mic, 
  MicOff, 
  PhoneOff,
  Volume2,
  ChevronRight
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

  const pc = useRef<RTCPeerConnection | null>(null);
  const localStream = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const ringAudio = useRef<HTMLAudioElement | null>(null);
  const processedCandidates = useRef<Set<string>>(new Set());
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatSessionId = useRef<string>(localStorage.getItem(`chat_session_${profile.id}`) || `session_${Math.random().toString(36).substr(2, 9)}`);

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

          if ((callStatus === 'connected' || callStatus === 'calling') && call.call_id === currentCallId) {
            const remoteCandidates = call.caller_role === 'customer' ? call.receiver_candidates : call.caller_candidates;
            if (Array.isArray(remoteCandidates)) {
              for (const cand of remoteCandidates) {
                const cStr = JSON.stringify(cand);
                if (!processedCandidates.current.has(cStr) && pc.current) {
                  try {
                    await pc.current.addIceCandidate(new RTCIceCandidate(cand));
                    processedCandidates.current.add(cStr);
                  } catch (e) {}
                }
              }
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

  const initWebRTC = async (callId: string) => {
    processedCandidates.current.clear();
    pc.current = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }]
    });

    pc.current.onicecandidate = async (event) => {
      if (event.candidate) {
        const col = callStatus === 'calling' ? 'caller_candidates' : 'receiver_candidates';
        await sql`
          UPDATE voice_calls SET 
            ${sql(col)} = ${sql(col)} || ${JSON.stringify([event.candidate])}::jsonb,
            updated_at = NOW()
          WHERE session_id = ${chatSessionId.current} AND call_id = ${callId}
        `;
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

  const handleStartCall = async () => {
    if (callStatus !== 'idle') return;
    const callId = `call_${Date.now()}`;
    setCurrentCallId(callId);
    setCallStatus('calling');

    try {
      await sql`
        INSERT INTO voice_calls (session_id, call_id, status, caller_role, caller_candidates, receiver_candidates, updated_at)
        VALUES (${chatSessionId.current}, ${callId}, 'calling', 'customer', '[]'::jsonb, '[]'::jsonb, NOW())
        ON CONFLICT (session_id) DO UPDATE SET 
          call_id = ${callId}, status = 'calling', caller_role = 'customer', offer = NULL, answer = NULL,
          caller_candidates = '[]'::jsonb, receiver_candidates = '[]'::jsonb, updated_at = NOW()
      `;

      await initWebRTC(callId);
      const offer = await pc.current!.createOffer();
      await pc.current!.setLocalDescription(offer);
      await sql`UPDATE voice_calls SET offer = ${JSON.stringify(offer)} WHERE session_id = ${chatSessionId.current} AND call_id = ${callId}`;
      
      if (!ringAudio.current) { ringAudio.current = new Audio(RING_SOUND); ringAudio.current.loop = true; }
      ringAudio.current.play().catch(() => {});
    } catch (e) { handleEndCall(); }
  };

  const handleAcceptCall = async () => {
    if (!currentCallId) return;
    try {
      await initWebRTC(currentCallId);
      const callData = await sql`SELECT offer FROM voice_calls WHERE session_id = ${chatSessionId.current} AND call_id = ${currentCallId}`;
      if (callData.length > 0 && callData[0].offer) {
        await pc.current!.setRemoteDescription(new RTCSessionDescription(callData[0].offer));
        const answer = await pc.current!.createAnswer();
        await pc.current!.setLocalDescription(answer);
        await sql`
          UPDATE voice_calls SET 
            status = 'connected', answer = ${JSON.stringify(answer)}, updated_at = NOW()
          WHERE session_id = ${chatSessionId.current} AND call_id = ${currentCallId}
        `;
        setCallStatus('connected');
        if (ringAudio.current) ringAudio.current.pause();
      }
    } catch (e) { handleEndCall(); }
  };

  const handleEndCall = async (notify = true) => {
    const cId = currentCallId;
    setCallStatus('idle');
    setCurrentCallId(null);
    playSound(HANGUP_SOUND);

    if (localStream.current) { localStream.current.getTracks().forEach(t => t.stop()); localStream.current = null; }
    if (pc.current) { pc.current.close(); pc.current = null; }
    if (ringAudio.current) { ringAudio.current.pause(); ringAudio.current.currentTime = 0; }
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;

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

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;
    const txt = inputValue; setInputValue(''); playSound(SEND_SOUND);
    try {
      await sql`UPDATE chat_sessions SET last_text = ${txt}, last_active = NOW() WHERE id = ${chatSessionId.current}`;
      await sql`INSERT INTO chat_messages (session_id, sender, text) VALUES (${chatSessionId.current}, 'customer', ${txt})`;
      setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'customer', text: txt, timestamp: new Date() }]);
    } catch (e) {}
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col max-w-2xl mx-auto shadow-2xl relative overflow-hidden font-tajawal text-right">
      <audio ref={remoteAudioRef} autoPlay className="hidden" />

      {callStatus !== 'idle' && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-2xl animate-in fade-in"></div>
          <div className="relative w-full max-w-xs text-center text-white animate-in zoom-in-95">
            <div className="mb-8">
              <div className="w-28 h-28 rounded-full overflow-hidden mx-auto border-4 border-[#00D1FF] shadow-2xl relative z-10 p-1 bg-white">
                <img src={profile.logo} className="w-full h-full object-cover rounded-full" alt="Logo" />
              </div>
              {callStatus === 'connected' && <div className="absolute inset-0 w-32 h-32 m-auto border-2 border-[#00D1FF]/40 rounded-full animate-ping"></div>}
            </div>
            <h3 className="text-xl font-black mb-1">{profile.name}</h3>
            <p className="text-[#00D1FF] font-bold text-xs uppercase tracking-widest mb-12">
              {callStatus === 'calling' && 'جاري الاتصال...'}
              {callStatus === 'incoming' && 'المتجر يتصل بك...'}
              {callStatus === 'connected' && formatDuration(callDuration)}
            </p>
            <div className="flex items-center justify-center gap-6">
              {callStatus === 'incoming' ? (
                <>
                  <button onClick={() => handleEndCall(true)} className="w-14 h-14 bg-red-500 rounded-full flex items-center justify-center shadow-lg"><PhoneOff size={24}/></button>
                  <button onClick={handleAcceptCall} className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center shadow-xl animate-bounce"><PhoneCall size={28}/></button>
                </>
              ) : (
                <>
                  <button onClick={() => setIsMuted(!isMuted)} className={`w-12 h-12 rounded-full flex items-center justify-center border ${isMuted?'bg-white text-black':'border-white/20'}`}>{isMuted?<MicOff size={20}/>:<Mic size={20}/>}</button>
                  <button onClick={() => handleEndCall(true)} className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center shadow-xl"><PhoneOff size={28}/></button>
                  <button className="w-12 h-12 rounded-full flex items-center justify-center border border-white/20"><Volume2 size={20}/></button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <header className="bg-white p-5 flex items-center justify-between border-b shadow-sm z-30">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-[20px] overflow-hidden border-2 border-[#00D1FF] p-0.5 shadow-lg bg-gray-50"><img src={profile.logo} className="w-full h-full object-cover rounded-[18px]" /></div>
          <div><h1 className="font-black text-lg text-[#0D2B4D] leading-none mb-1.5">{profile.name}</h1><div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-500"></div><span className="text-[10px] text-gray-400 font-black">مستعد لخدمتك</span></div></div>
        </div>
        <div className="flex gap-2.5">
          <button onClick={handleStartCall} disabled={callStatus !== 'idle'} className="w-11 h-11 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center border border-green-100 disabled:opacity-50"><PhoneCall size={20} /></button>
          <button className="w-11 h-11 rounded-2xl bg-[#00D1FF] text-white flex items-center justify-center shadow-xl shadow-cyan-500/20"><ShoppingBag size={20} /></button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-5 space-y-6 bg-gray-50/50 text-right">
        {messages.map(m => (
          <div key={m.id} className={`flex ${m.sender==='customer'?'justify-start':'justify-end'}`}>
            <div className={`max-w-[85%] p-4 rounded-3xl shadow-sm ${m.sender==='customer'?'bg-white text-gray-800 rounded-tr-none':'bg-[#0D2B4D] text-white rounded-tl-none'}`}>
              <p className="text-sm font-medium">{m.text}</p><div className="text-[9px] mt-2 opacity-60 text-left">{m.timestamp.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </main>

      <footer className="p-5 bg-white border-t">
        <div className="flex items-center gap-3">
          <input type="text" value={inputValue} onChange={e=>setInputValue(e.target.value)} onKeyPress={e=>e.key==='Enter'&&handleSend()} placeholder="اكتب رسالتك..." className="flex-1 px-5 py-4 rounded-[24px] bg-gray-50 border outline-none text-right" />
          <button onClick={handleSend} disabled={!inputValue.trim()} className="w-14 h-14 bg-[#0D2B4D] text-white rounded-[24px] flex items-center justify-center shadow-lg disabled:opacity-50"><Send size={22} className="-rotate-45" /></button>
        </div>
      </footer>
    </div>
  );
};

export default PublicChatPage;
