
import React, { useState, useRef, useEffect } from 'react';
import { BusinessProfile, Message, FAQ } from '../types';
import { sql } from '../neon';
import { 
  Send, 
  ShoppingBag, 
  Bot, 
  X, 
  MessageCircle, 
  Package, 
  ShieldCheck, 
  Camera, 
  Loader2, 
  Sparkles 
} from 'lucide-react';

interface PublicChatPageProps {
  profile: BusinessProfile;
}

const IMGBB_API_KEY = 'a16fdd9aead1214d64e435c9b83a0c2e';
const SEND_SOUND = 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3';
const OPENROUTER_API_KEY = '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';

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
      } catch (e) {
        console.error("Session init error:", e);
      }
    };
    initSession();
  }, [profile.id]);

  const callAI = async (userMessage: string, history: Message[]) => {
    try {
      const productsList = profile.products.map(p => `- ${p.name}: ${p.price} ${profile.currency}`).join('\n');
      
      const systemInstruction = `
        أنت المساعد الذكي "باز بوت" لمتجر "${profile.name}".
        صاحب المتجر هو: ${profile.ownerName}.
        
        معلومات المتجر:
        ${profile.aiBusinessInfo || profile.description || 'متجر بازشات المتميز'}
        
        المنتجات المتاحة:
        ${productsList || 'تواصل معنا لمعرفة المتاح'}
        
        بيانات العميل الحالي:
        الاسم: ${customerData.name}
        الهاتف: ${customerData.phone}
        
        قواعد الرد:
        1. رد دائماً باللغة العربية بأسلوب ودود ومحفز للشراء.
        2. استخدم المعلومات أعلاه فقط للإجابة.
        3. إذا طلب العميل منتجاً، أكد له أنك سجلت الطلب وسيتم التواصل معه على رقمه المذكور.
        4. لا تذكر أنك ذكاء اصطناعي إلا إذا سُئلت، وتصرف كموظف خدمة عملاء بشري.
      `;

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "HTTP-Referer": window.location.origin,
          "X-Title": "Bazchat Platform",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "arcee-ai/trinity-large-preview:free",
          messages: [
            { role: "system", content: systemInstruction },
            ...history.slice(-6).map(m => ({
              role: m.sender === 'customer' ? 'user' : 'assistant',
              content: m.text
            })),
            { role: "user", content: userMessage }
          ]
        })
      });

      const data = await response.json();
      return data.choices?.[0]?.message?.content || "أعتذر، حدث خطأ بسيط في معالجة طلبك. كيف يمكنني مساعدتك؟";
    } catch (e) {
      console.error("AI connection failed:", e);
      return "عذراً، أواجه ضغطاً في الطلبات حالياً. سيقوم صاحب المتجر بالرد عليك قريباً.";
    }
  };

  const triggerOnboardingBot = async (step: 'name' | 'phone') => {
    setIsBotThinking(true);
    await new Promise(resolve => setTimeout(resolve, 800));
    setIsBotThinking(false);
    let text = step === 'name' ? "أهلاً بك! قبل أن نبدأ، ما هو اسمك الكريم؟" : `تشرفنا بك يا ${customerData.name}! لطفاً زودنا برقم هاتفك لنتمكن من متابعة طلبك بشكل أفضل.`;
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
    const interval = setInterval(fetchMsgs, 5000);
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
          const confirmText = profile.aiEnabled 
            ? `شكراً لك يا ${customerData.name}! أنا المساعد الذكي لمتجر ${profile.name}. كيف يمكنني مساعدتك اليوم؟` 
            : "شكراً لك! تم استلام بياناتك بنجاح. سيقوم صاحب المتجر بالرد عليك قريباً.";
          await sql`INSERT INTO chat_messages (session_id, sender, text) VALUES (${chatSessionId.current}, 'owner', ${confirmText})`;
          setMessages(prev => [...prev, { id: `bot_${Date.now()}`, sender: 'owner', text: confirmText, timestamp: new Date() }]);
        }, 1000);
        return;
      }

      await sql`UPDATE chat_sessions SET last_text = ${txt.substring(0, 50)}, last_active = NOW() WHERE id = ${chatSessionId.current}`;
      await sql`INSERT INTO chat_messages (session_id, sender, text) VALUES (${chatSessionId.current}, 'customer', ${txt})`;
      
      const userMsgObj: Message = { id: `m_${Date.now()}`, sender: 'customer', text: txt, timestamp: new Date() };
      const updatedHistory = [...messages, userMsgObj];
      setMessages(updatedHistory);

      if (profile.aiEnabled && !txt.startsWith('IMAGE:')) {
        setIsBotThinking(true);
        const aiResponse = await callAI(txt, updatedHistory);
        setIsBotThinking(false);
        
        await sql`INSERT INTO chat_messages (session_id, sender, text, is_ai) VALUES (${chatSessionId.current}, 'owner', ${aiResponse}, TRUE)`;
        setMessages(prev => [...prev, { id: `bot_${Date.now()}`, sender: 'owner', text: aiResponse, timestamp: new Date(), isAi: true }]);
      }
    } catch (e) {
      console.error("Error sending message:", e);
      setIsBotThinking(false); // تأكيد إغلاق حالة التحميل في حال الخطأ
    }
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
      <header className="bg-white/90 backdrop-blur-md p-4 flex items-center justify-between border-b shadow-sm sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-[18px] overflow-hidden border-2 border-[#00D1FF] p-0.5 bg-white shrink-0 shadow-inner">
            <img src={profile.logo} className="w-full h-full object-cover rounded-[16px]" alt="Logo" />
          </div>
          <div>
            <h1 className="font-black text-sm md:text-base text-[#0D2B4D] truncate max-w-[150px]">{profile.name}</h1>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">نشط الآن</span>
            </div>
          </div>
        </div>
        <button onClick={() => setShowCatalog(true)} className="w-11 h-11 rounded-2xl bg-[#0D2B4D] text-white flex items-center justify-center shadow-xl active:scale-95 transition-all"><ShoppingBag size={20} /></button>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50/40">
        {messages.map((m, idx) => (
          <div key={m.id || idx} className={`flex ${m.sender === 'customer' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
            <div className={`max-w-[85%] p-5 rounded-[28px] text-sm font-bold shadow-sm relative ${
              m.sender === 'customer' 
                ? 'bg-[#0D2B4D] text-white rounded-tr-none' 
                : 'bg-white border border-gray-100 rounded-tl-none text-gray-800'
            }`}>
              {m.isAi && <div className="flex items-center gap-1 mb-2 text-[#00D1FF] text-[8px] font-black uppercase tracking-wider"><Sparkles size={10} /> رد ذكي ✨</div>}
              {m.text.startsWith('IMAGE:') ? (
                <img src={m.text.replace('IMAGE:', '')} className="rounded-2xl max-w-full max-h-[300px] object-cover" alt="Sent image" />
              ) : (
                <p className="leading-relaxed whitespace-pre-wrap">{m.text}</p>
              )}
              <div className="text-[9px] mt-2 opacity-40 text-left font-black tracking-tighter uppercase">{m.timestamp.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</div>
            </div>
          </div>
        ))}
        {isBotThinking && (
          <div className="flex justify-start animate-pulse">
            <div className="bg-white border p-4 rounded-3xl rounded-tl-none flex gap-2 items-center shadow-sm">
              <div className="w-2 h-2 bg-[#00D1FF] rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-[#00D1FF] rounded-full animate-bounce delay-150"></div>
              <div className="w-2 h-2 bg-[#00D1FF] rounded-full animate-bounce delay-300"></div>
              <span className="text-xs text-gray-400 font-bold mr-2">جاري الرد...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      <footer className="p-4 bg-white border-t shadow-2xl pb-6">
        <div className="flex items-center gap-2">
          <label className="w-12 h-12 flex items-center justify-center bg-gray-100 text-gray-400 rounded-2xl cursor-pointer shrink-0 hover:bg-gray-200 transition-colors">
            {isUploading ? <Loader2 size={24} className="animate-spin text-[#00D1FF]" /> : <Camera size={24} />}
            <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} disabled={isUploading} />
          </label>
          <input 
            type="text" 
            value={inputValue} 
            onChange={e=>setInputValue(e.target.value)} 
            onKeyPress={e=>e.key==='Enter'&&handleSend()} 
            placeholder={onboardingStep === 'name' ? 'ما هو اسمك؟' : onboardingStep === 'phone' ? 'ما هو رقم هاتفك؟' : "اكتب استفسارك هنا..."} 
            className="w-full px-5 py-3.5 rounded-[22px] bg-gray-50 border-2 border-transparent outline-none text-right font-bold text-sm focus:border-[#00D1FF]/20 focus:bg-white transition-all shadow-inner" 
          />
          <button 
            onClick={() => handleSend()} 
            disabled={!inputValue.trim() || isBotThinking || isUploading} 
            className="w-12 h-12 bg-[#00D1FF] text-white rounded-2xl flex items-center justify-center shadow-lg disabled:opacity-50 active:scale-90 transition-all shrink-0"
          >
            <Send size={22} className="-rotate-45" />
          </button>
        </div>
        <div className="flex justify-center mt-3">
          <div className="flex items-center gap-1.5 text-gray-300 text-[8px] font-black tracking-widest uppercase">
            <ShieldCheck size={10} className="text-green-500" />
            <span>مدعوم بواسطة بازشات - Trinity AI</span>
          </div>
        </div>
      </footer>

      {showCatalog && (
        <div className="fixed inset-0 z-[100] bg-[#0D2B4D]/60 backdrop-blur-sm animate-in fade-in duration-300">
           <div className="absolute inset-x-0 bottom-0 h-[85vh] bg-white rounded-t-[40px] shadow-2xl overflow-y-auto p-8 animate-in slide-in-from-bottom duration-500">
             <div className="flex items-center justify-between mb-8 sticky top-0 bg-white z-10 py-2 border-b">
                <h2 className="text-xl font-black text-[#0D2B4D]">كتالوج المنتجات</h2>
                <button onClick={() => setShowCatalog(false)} className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500"><X size={20}/></button>
             </div>
             <div className="grid grid-cols-2 gap-4">
                {profile.products.map(p => (
                  <div key={p.id} className="bg-white rounded-[30px] overflow-hidden border shadow-sm p-3 group">
                     <div className="aspect-square rounded-[22px] overflow-hidden mb-3 bg-gray-50">
                        <img src={p.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={p.name} />
                     </div>
                     <h4 className="font-bold text-[#0D2B4D] text-xs truncate mb-1">{p.name}</h4>
                     <div className="flex items-center justify-between">
                        <p className="text-[#00D1FF] font-black text-xs">{p.price} {profile.currency}</p>
                        <button 
                          onClick={() => { handleSend(`أرغب في طلب: ${p.name}`); setShowCatalog(false); }}
                          className="p-2 bg-[#0D2B4D] text-white rounded-lg hover:scale-105 transition-transform"
                        >
                          <MessageCircle size={14}/>
                        </button>
                     </div>
                  </div>
                ))}
             </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default PublicChatPage;
