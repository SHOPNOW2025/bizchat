
import React, { useState, useRef, useEffect } from 'react';
import { BusinessProfile, Message, FAQ } from '../types';
import { sql } from '../neon';
import { 
  Send, 
  ShoppingBag, 
  PhoneCall, 
  Bot, 
  X, 
  MessageCircle, 
  Package, 
  ShieldCheck, 
  MapPin, 
  Phone, 
  Camera, 
  Loader2, 
  Sparkles 
} from 'lucide-react';

interface PublicChatPageProps {
  profile: BusinessProfile;
}

const IMGBB_API_KEY = 'a16fdd9aead1214d64e435c9b83a0c2e';
const ZAI_API_KEY = '069e2918fe414ef8bba9f3821a3fea9a.xUiYL7a9GDzppL4Z';
const SEND_SOUND = 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3';

const PublicChatPage: React.FC<PublicChatPageProps> = ({ profile }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [showCatalog, setShowCatalog] = useState(false);
  const [isBotThinking, setIsBotThinking] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<'none' | 'name' | 'phone' | 'done'>('none');
  const [isUploading, setIsUploading] = useState(false);
  const [customerData, setCustomerData] = useState({ name: '', phone: '' });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatSessionId = useRef<string>(localStorage.getItem(`chat_session_${profile.id}`) || `session_${Math.random().toString(36).substr(2, 9)}`);

  const playSound = (url: string) => { new Audio(url).play().catch(() => {}); };

  useEffect(() => {
    localStorage.setItem(`chat_session_${profile.id}`, chatSessionId.current);
    const initSession = async () => {
      try {
        const rows = await sql`SELECT * FROM chat_sessions WHERE id = ${chatSessionId.current}`;
        if (rows.length === 0) {
          await sql`INSERT INTO chat_sessions (id, profile_id, customer_name, customer_phone) VALUES (${chatSessionId.current}, ${profile.id}, 'عميل بازشات', '')`;
          setOnboardingStep('name');
          await triggerOnboardingBot('name');
        } else {
          const s = rows[0];
          setCustomerData({ name: s.customer_name || '', phone: s.customer_phone || '' });
          if (!s.customer_name || s.customer_name === 'عميل بازشات') {
            setOnboardingStep('name');
            await triggerOnboardingBot('name');
          } else if (!s.customer_phone) {
            setOnboardingStep('phone');
            await triggerOnboardingBot('phone');
          } else {
            setOnboardingStep('done');
          }
        }
      } catch (e) {}
    };
    initSession();
  }, [profile.id]);

  const callZAI = async (userMessage: string, history: Message[]) => {
    try {
      const messagesPayload = [
        { 
          role: "system", 
          content: `You are an AI Sales Assistant for "${profile.name}".
          Business Information: ${profile.aiBusinessInfo || profile.description}.
          Customer Name: ${customerData.name}.
          Customer Phone: ${customerData.phone}.
          Context: You help customers discover products and place orders. 
          Instructions:
          1. Answer accurately based ONLY on the business info provided.
          2. If a customer wants to order, ask for items and quantity clearly.
          3. Be friendly and professional. Respond in Arabic.
          4. If info is missing, say you'll notify the manager.`
        },
        ...history.slice(-10).map(m => ({
          role: m.sender === 'customer' ? 'user' : 'assistant',
          content: m.text
        })),
        { role: "user", content: userMessage }
      ];

      const response = await fetch("https://api.z.ai/api/paas/v4/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${ZAI_API_KEY}` },
        body: JSON.stringify({ model: "glm-4.7", messages: messagesPayload, temperature: 0.7 })
      });

      const data = await response.json();
      return data.choices?.[0]?.message?.content || "أعتذر، حدث خطأ تقني في معالجة طلبك.";
    } catch (e) {
      console.error("ZAI Error", e);
      return "عذراً، أواجه مشكلة في الرد حالياً. سيقوم صاحب المتجر بالرد عليك قريباً.";
    }
  };

  const triggerOnboardingBot = async (step: 'name' | 'phone') => {
    setIsBotThinking(true);
    await new Promise(resolve => setTimeout(resolve, 800));
    setIsBotThinking(false);
    let text = step === 'name' ? "أهلاً بك! قبل أن نبدأ، ما هو اسمك الكريم؟" : "تشرفنا بك! لطفاً زودنا برقم هاتفك لنتمكن من متابعة طلبك بشكل أفضل.";
    setMessages(prev => [...prev, { id: `bot_${Date.now()}`, sender: 'owner', text, timestamp: new Date() }]);
  };

  useEffect(() => {
    const fetchMsgs = async () => {
      try {
        const msgs = await sql`SELECT id, sender, text, timestamp, is_ai FROM chat_messages WHERE session_id = ${chatSessionId.current} ORDER BY timestamp ASC`;
        setMessages(msgs.map(m => ({ ...m, timestamp: new Date(m.timestamp), isAi: m.is_ai })) as Message[]);
      } catch (e) {}
    };
    fetchMsgs();
    const interval = setInterval(fetchMsgs, 4000);
    return () => clearInterval(interval);
  }, [profile.id]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isBotThinking]);

  const handleSend = async (customText?: string) => {
    const txt = customText || inputValue;
    if (!txt.trim()) return;
    if (!customText) setInputValue('');
    playSound(SEND_SOUND);

    try {
      if (onboardingStep === 'name') {
        const name = txt.trim();
        setCustomerData(prev => ({ ...prev, name }));
        await sql`UPDATE chat_sessions SET customer_name = ${name}, last_text = ${txt}, last_active = NOW() WHERE id = ${chatSessionId.current}`;
        await sql`INSERT INTO chat_messages (session_id, sender, text) VALUES (${chatSessionId.current}, 'customer', ${txt})`;
        setMessages(prev => [...prev, { id: `m_${Date.now()}`, sender: 'customer', text: txt, timestamp: new Date() }]);
        setOnboardingStep('phone');
        await triggerOnboardingBot('phone');
        return;
      } else if (onboardingStep === 'phone') {
        const phone = txt.trim();
        setCustomerData(prev => ({ ...prev, phone }));
        await sql`UPDATE chat_sessions SET customer_phone = ${phone}, last_text = ${txt}, last_active = NOW() WHERE id = ${chatSessionId.current}`;
        await sql`INSERT INTO chat_messages (session_id, sender, text) VALUES (${chatSessionId.current}, 'customer', ${txt})`;
        setMessages(prev => [...prev, { id: `m_${Date.now()}`, sender: 'customer', text: txt, timestamp: new Date() }]);
        setOnboardingStep('done');
        setIsBotThinking(true);
        setTimeout(async () => {
          setIsBotThinking(false);
          const confirmText = profile.aiEnabled ? "شكراً لك! سأقوم بمساعدتك الآن والرد على استفساراتك بناءً على معلومات العمل المتوفرة لدي." : "شكراً لك! تم حفظ بياناتك. كيف يمكنني مساعدتك؟";
          await sql`INSERT INTO chat_messages (session_id, sender, text) VALUES (${chatSessionId.current}, 'owner', ${confirmText})`;
          setMessages(prev => [...prev, { id: `bot_${Date.now()}`, sender: 'owner', text: confirmText, timestamp: new Date() }]);
        }, 1000);
        return;
      }

      await sql`UPDATE chat_sessions SET last_text = ${txt.substring(0, 30)}, last_active = NOW() WHERE id = ${chatSessionId.current}`;
      await sql`INSERT INTO chat_messages (session_id, sender, text) VALUES (${chatSessionId.current}, 'customer', ${txt})`;
      
      const updatedHistory = [...messages, { id: `m_${Date.now()}`, sender: 'customer', text: txt, timestamp: new Date() } as Message];
      setMessages(updatedHistory);

      if (profile.aiEnabled && !txt.startsWith('IMAGE:')) {
        setIsBotThinking(true);
        const aiResponse = await callZAI(txt, updatedHistory);
        setIsBotThinking(false);
        await sql`INSERT INTO chat_messages (session_id, sender, text, is_ai) VALUES (${chatSessionId.current}, 'owner', ${aiResponse}, TRUE)`;
        setMessages(prev => [...prev, { id: `ai_${Date.now()}`, sender: 'owner', text: aiResponse, timestamp: new Date(), isAi: true }]);
      }
    } catch (e) {}
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (onboardingStep !== 'done') { alert("يرجى إكمال بياناتك أولاً"); return; }
    const file = event.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: formData });
      const json = await response.json();
      if (json.success) await handleSend(`IMAGE:${json.data.url}`);
    } catch (error) { alert('فشل رفع الصورة'); }
    finally { setIsUploading(false); }
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col max-w-full md:max-w-2xl mx-auto shadow-2xl relative overflow-hidden font-tajawal text-right">
      <header className="bg-white/80 backdrop-blur-md p-4 flex items-center justify-between border-b shadow-sm sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-[18px] overflow-hidden border-2 border-[#00D1FF] p-0.5 bg-white shrink-0"><img src={profile.logo} className="w-full h-full object-cover rounded-[16px]" /></div>
          <div className="overflow-hidden"><h1 className="font-black text-base text-[#0D2B4D] truncate">{profile.name}</h1><div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-500"></div><span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">نشط الآن</span></div></div>
        </div>
        <button onClick={() => setShowCatalog(true)} className="w-11 h-11 rounded-2xl bg-[#00D1FF] text-white flex items-center justify-center shadow-xl"><ShoppingBag size={20} /></button>
      </header>
      <main className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50/20">
        {messages.map((m, idx) => (
          <div key={m.id || idx} className={`flex ${m.sender==='customer'?'justify-end':'justify-start'} animate-in slide-in-from-bottom-2`}>
            <div className={`max-w-[85%] p-5 rounded-[28px] text-sm font-bold shadow-sm relative ${m.sender==='customer'?'bg-[#0D2B4D] text-white rounded-tr-none':'bg-white border border-gray-100 rounded-tl-none text-gray-800'}`}>
              {m.isAi && <div className="flex items-center gap-1 mb-1 text-[#00D1FF] text-[8px] font-black uppercase tracking-wider"><Sparkles size={10} /> رد ذكي</div>}
              {m.text.startsWith('IMAGE:') ? <img src={m.text.replace('IMAGE:', '')} className="rounded-2xl max-w-full max-h-[300px] object-cover" /> : <p className="leading-relaxed">{m.text}</p>}
              <div className="text-[10px] mt-2 opacity-50 text-left font-black tracking-tighter uppercase">{m.timestamp.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>
            </div>
          </div>
        ))}
        {isBotThinking && <div className="flex justify-start"><div className="bg-white border p-4 rounded-3xl flex gap-1.5 shadow-sm"><div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce"></div><div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce delay-150"></div><div className="w-2 h-2 bg-cyan-400 rounded-full animate-bounce delay-300"></div></div></div>}
        <div ref={messagesEndRef} />
      </main>
      {showCatalog && (
        <div className="fixed inset-0 z-[100] bg-[#0D2B4D]/60 backdrop-blur-md animate-in fade-in duration-300">
           <div className="absolute inset-x-0 bottom-0 h-[85vh] bg-white rounded-t-[50px] shadow-2xl overflow-y-auto p-8 animate-in slide-in-from-bottom duration-500">
             <div className="flex items-center justify-between mb-8 sticky top-0 bg-white z-10 py-2"><h2 className="text-2xl font-black text-[#0D2B4D]">كتالوج المنتجات</h2><button onClick={() => setShowCatalog(false)} className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center text-gray-500"><X size={24}/></button></div>
             <div className="grid grid-cols-2 gap-4">
                {profile.products.map(p => (
                  <div key={p.id} className="bg-gray-50 rounded-[32px] overflow-hidden border p-3 group">
                     <div className="aspect-square rounded-[24px] overflow-hidden mb-3 bg-white"><img src={p.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" /></div>
                     <div className="px-2"><h4 className="font-black text-[#0D2B4D] text-sm truncate">{p.name}</h4><p className="text-[#00D1FF] font-black text-sm">{p.price} {profile.currency}</p></div>
                  </div>
                ))}
             </div>
           </div>
        </div>
      )}
      <footer className="p-4 bg-white border-t safe-area-bottom shadow-2xl">
        <div className="flex items-center gap-3">
          <label className="w-12 h-12 flex items-center justify-center bg-gray-100 text-gray-400 rounded-2xl cursor-pointer shrink-0">{isUploading ? <Loader2 size={24} className="animate-spin text-[#00D1FF]" /> : <Camera size={24} />}<input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={isUploading} /></label>
          <input type="text" value={inputValue} onChange={e=>setInputValue(e.target.value)} onKeyPress={e=>e.key==='Enter'&&handleSend()} placeholder={onboardingStep === 'name' ? 'أدخل اسمك هنا...' : onboardingStep === 'phone' ? 'أدخل رقم هاتفك هنا...' : "اكتب استفسارك هنا..."} className="w-full px-6 py-4 rounded-[26px] bg-gray-50 border-2 border-transparent outline-none text-right font-black text-sm focus:border-[#00D1FF]/30 transition-all shadow-inner" />
          <button onClick={() => handleSend()} disabled={!inputValue.trim() || isBotThinking || isUploading} className="w-14 h-14 bg-[#0D2B4D] text-white rounded-[24px] flex items-center justify-center shadow-2xl disabled:opacity-50"><Send size={26} className="-rotate-45" /></button>
        </div>
        <div className="flex justify-center mt-3"><div className="flex items-center gap-1.5 text-gray-400 text-[9px] font-bold"><ShieldCheck size={12} className="text-green-500" /><span>مدعوم بواسطة بازشات - محادثة آمنة ومشفرة</span></div></div>
      </footer>
    </div>
  );
};

export default PublicChatPage;
