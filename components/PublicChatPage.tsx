
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
// Correct import for Gemini API
import { GoogleGenAI } from "@google/genai";

interface PublicChatPageProps {
  profile: BusinessProfile;
}

const IMGBB_API_KEY = 'a16fdd9aead1214d64e435c9b83a0c2e';
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
      } catch (e) {
        console.error("Session init error:", e);
      }
    };
    initSession();
  }, [profile.id]);

  // Updated to use Google GenAI SDK as per coding guidelines
  const callAI = async (userMessage: string, history: Message[]) => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    try {
      const productsList = profile.products.map(p => `- ${p.name}: ${p.price} ${profile.currency}`).join('\n');
      
      const systemInstruction = `
        أنت المساعد الذكي لمصنع/متجر "${profile.name}".
        صاحب المتجر هو: ${profile.ownerName}.
        
        معلومات المتجر التي تم حفظها:
        ${profile.aiBusinessInfo || profile.description || 'متجر بازشات المتميز'}
        
        كتالوج المنتجات:
        ${productsList || 'تواصل معنا لمعرفة المتاح'}
        
        بيانات العميل:
        الاسم: ${customerData.name}
        الهاتف: ${customerData.phone}
        
        التعليمات:
        1. رد دائماً باللغة العربية.
        2. استخدم المعلومات المحفوظة أعلاه للإجابة على العميل.
        3. إذا أراد العميل طلب شيء، أكد له أن بياناته مسجلة وسيتم التواصل معه.
        4. كن لطيفاً ومختصراً.
      `;

      // Using gemini-3-flash-preview for general text tasks
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: history.slice(-6).map(m => ({
          role: m.sender === 'customer' ? 'user' : 'model',
          parts: [{ text: m.text }]
        })),
        config: {
          systemInstruction: systemInstruction,
        }
      });

      return response.text || "أعتذر، حدث خطأ في معالجة الرد.";
    } catch (e) {
      console.error("AI connection failed:", e);
      return "عذراً، أواجه صعوبة في الاتصال بالذكاء الاصطناعي حالياً. سيقوم صاحب المتجر بالرد عليك قريباً.";
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
            ? `شكراً لك يا ${customerData.name}! أنا المساعد الذكي لمتجر ${profile.name}. كيف يمكنني مساعدتك اليوم؟ يمكنك سؤالي عن أي شيء يخص منتجاتنا.` 
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
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-tajawal text-right overflow-hidden">
      {/* Header */}
      <div className="bg-white p-4 border-b flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <img src={profile.logo} className="h-10 w-10 rounded-xl object-cover" alt="Logo" />
          <div>
            <h1 className="font-bold text-[#0D2B4D]">{profile.name}</h1>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[10px] text-gray-400 font-bold">متصل الآن</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <button onClick={() => setShowCatalog(true)} className="p-2 bg-[#00D1FF]/10 text-[#00D1FF] rounded-xl"><Package size={20} /></button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.sender === 'owner' ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[85%] p-4 rounded-2xl shadow-sm text-sm relative ${
              m.sender === 'owner' 
                ? 'bg-white border text-gray-800 rounded-tr-none' 
                : 'bg-[#0D2B4D] text-white rounded-tl-none'
            }`}>
              {m.isAi && (
                <div className="flex items-center gap-1 mb-1 text-[#00D1FF] text-[8px] font-black uppercase tracking-wider">
                  <Sparkles size={10} /> رد ذكي
                </div>
              )}
              {m.text.startsWith('IMAGE:') ? (
                <img src={m.text.replace('IMAGE:', '')} className="rounded-xl max-w-full" alt="Uploaded" />
              ) : (
                <p className="leading-relaxed font-medium">{m.text}</p>
              )}
            </div>
          </div>
        ))}
        {isBotThinking && (
          <div className="flex justify-start">
            <div className="bg-white border p-4 rounded-2xl rounded-tr-none flex items-center gap-2">
              <Loader2 className="animate-spin text-[#00D1FF]" size={16} />
              <span className="text-xs text-gray-400 font-bold">جاري الرد...</span>
            </div>
          </div>
        ) }
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t sticky bottom-0">
        <div className="flex gap-2 items-center bg-gray-50 p-2 rounded-2xl border">
          <button 
            onClick={() => handleSend()}
            disabled={!inputValue.trim()}
            className="w-12 h-12 bg-[#0D2B4D] text-white rounded-xl flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-50"
          >
            <Send size={20} />
          </button>
          <input 
            type="text" 
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="اكتب رسالتك هنا..."
            className="flex-1 bg-transparent border-none outline-none p-2 text-sm font-bold"
          />
        </div>
      </div>

      {/* Catalog Modal */}
      {showCatalog && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-[#0D2B4D]/80 backdrop-blur-sm" onClick={() => setShowCatalog(false)} />
          <div className="relative bg-white w-full max-w-lg rounded-t-[32px] sm:rounded-[32px] max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b flex items-center justify-between bg-gray-50">
              <h3 className="font-bold text-lg">منتجاتنا</h3>
              <button onClick={() => setShowCatalog(false)} className="p-2 bg-white rounded-xl shadow-sm"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-4">
              {profile.products.map((p) => (
                <div key={p.id} className="bg-white border rounded-2xl overflow-hidden group shadow-sm">
                  <div className="aspect-square overflow-hidden bg-gray-100">
                    <img src={p.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform" alt={p.name} />
                  </div>
                  <div className="p-3">
                    <h4 className="text-xs font-bold text-[#0D2B4D] truncate">{p.name}</h4>
                    <p className="text-[#00D1FF] font-black text-sm mt-1">{p.price} {profile.currency}</p>
                    <button 
                      onClick={() => {
                        handleSend(`أرغب في الاستفسار عن المنتج: ${p.name}`);
                        setShowCatalog(false);
                      }}
                      className="w-full mt-2 py-2 bg-gray-50 text-[10px] font-bold rounded-lg hover:bg-[#00D1FF] hover:text-white transition-colors"
                    >
                      استفسار
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
