
import React, { useState, useRef, useEffect } from 'react';
import { BusinessProfile, Product, Message } from '../types';
import { db } from '../firebase';
import { collection, addDoc, query, orderBy, onSnapshot, limit, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { GoogleGenAI } from "@google/genai";
import { 
  Send, 
  Phone, 
  Instagram, 
  ShoppingBag, 
  Info, 
  X, 
  ChevronDown,
  ExternalLink,
  Check,
  Sparkles,
  Bot
} from 'lucide-react';

interface PublicChatPageProps {
  profile: BusinessProfile;
}

const PublicChatPage: React.FC<PublicChatPageProps> = ({ profile }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [isPolicyOpen, setIsPolicyOpen] = useState(false);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatSessionId = useRef<string>(localStorage.getItem(`chat_session_${profile.id}`) || `session_${Date.now()}`);

  useEffect(() => {
    if (!db) return;

    localStorage.setItem(`chat_session_${profile.id}`, chatSessionId.current);

    const q = query(
      collection(db, "profiles", profile.id, "chats", chatSessionId.current, "messages"),
      orderBy("timestamp", "asc"),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          sender: data.sender,
          text: data.text,
          timestamp: data.timestamp?.toDate() || new Date()
        } as Message;
      });
      
      if (msgs.length === 0) {
        setMessages([
          { id: 'welcome', sender: 'owner', text: `مرحباً بك في ${profile.name}! كيف يمكنني مساعدتك اليوم؟`, timestamp: new Date() }
        ]);
      } else {
        setMessages(msgs);
      }
    }, (error) => {
      console.error("Firestore error:", error);
    });

    return () => unsubscribe();
  }, [profile.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getAiResponse = async (userText: string) => {
    setIsAiThinking(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const productsInfo = profile.products.map(p => `${p.name}: ${p.price} ${profile.currency}. ${p.description}`).join('\n');
      
      const systemInstruction = `
        أنت مساعد ذكي لمتجر "${profile.name}". صاحب المتجر هو "${profile.ownerName}".
        منتجات المتجر هي:
        ${productsInfo}
        
        سياسة الاستبدال: ${profile.returnPolicy}
        سياسة التوصيل: ${profile.deliveryPolicy}
        
        قواعدك:
        1. كن ودوداً واحترافياً باللهجة العربية المناسبة.
        2. أجب عن أسئلة العملاء بناءً على المعلومات أعلاه فقط.
        3. إذا سأل العميل عن شيء غير متوفر، أخبره بلطف أن يتواصل مع صاحب المتجر عبر الرقم ${profile.phone}.
        4. شجع العميل على تصفح الكتالوج.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: userText,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.7,
        },
      });

      const aiText = response.text || "عذراً، لم أستطع معالجة طلبك حالياً.";

      if (db) {
        await addDoc(collection(db, "profiles", profile.id, "chats", chatSessionId.current, "messages"), {
          sender: 'owner',
          text: aiText,
          isAi: true,
          timestamp: serverTimestamp()
        });
      }
    } catch (e) {
      console.error("AI Error:", e);
    } finally {
      setIsAiThinking(false);
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || !db) return;

    const text = inputValue;
    setInputValue('');

    try {
      await addDoc(collection(db, "profiles", profile.id, "chats", chatSessionId.current, "messages"), {
        sender: 'customer',
        text: text,
        timestamp: serverTimestamp()
      });

      // Trigger Gemini Assistant
      getAiResponse(text);
    } catch (e) {
      console.error("Error sending message", e);
    }
  };

  return (
    <div className="h-screen bg-[#F8FAFC] flex flex-col max-w-2xl mx-auto shadow-2xl relative overflow-hidden font-tajawal">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md p-4 flex items-center justify-between border-b shadow-sm z-30 sticky top-0">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-[#00D1FF] p-0.5 shadow-inner">
              <img src={profile.logo} alt={profile.name} className="w-full h-full object-cover rounded-full" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-white"></div>
          </div>
          <div>
            <h1 className="font-bold text-lg text-[#0D2B4D]">{profile.name}</h1>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-1">
               <Bot size={10} className="text-[#00D1FF]" /> مساعد ذكي
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <a href={`tel:${profile.phone}`} className="w-10 h-10 rounded-2xl bg-gray-50 text-[#0D2B4D] flex items-center justify-center hover:bg-[#0D2B4D] hover:text-white transition-all shadow-sm">
            <Phone size={18} />
          </a>
          <button onClick={() => setIsCatalogOpen(true)} className="w-10 h-10 rounded-2xl bg-[#00D1FF]/10 text-[#00D1FF] flex items-center justify-center hover:bg-[#00D1FF] hover:text-white transition-all">
            <ShoppingBag size={18} />
          </button>
        </div>
      </header>

      {/* Chat Messages */}
      <main className="flex-1 overflow-y-auto p-5 space-y-6 bg-gradient-to-b from-white to-gray-50">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.sender === 'customer' ? 'items-start' : 'items-end'}`}>
            <div className={`max-w-[85%] p-4 rounded-3xl shadow-sm ${
              msg.sender === 'customer' 
                ? 'bg-white text-gray-800 rounded-tr-none border border-gray-100' 
                : 'bg-[#0D2B4D] text-white rounded-tl-none'
            }`}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              <div className={`text-[10px] mt-2 flex items-center gap-1.5 ${msg.sender === 'customer' ? 'text-gray-400' : 'text-blue-200/60'}`}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {msg.sender === 'owner' && <Check size={12} />}
              </div>
            </div>
          </div>
        ))}
        {isAiThinking && (
          <div className="flex justify-end animate-pulse">
            <div className="bg-[#0D2B4D]/10 p-3 rounded-2xl rounded-tl-none flex items-center gap-2 text-xs">
               <Bot size={14} className="text-[#0D2B4D]" /> جاري الكتابة...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Input Area */}
      <footer className="p-4 bg-white border-t border-gray-100">
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-gray-50 border border-gray-100 rounded-3xl px-5 flex items-center focus-within:ring-2 focus-within:ring-[#00D1FF]/30">
            <input 
              type="text" 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="اكتب رسالتك هنا..."
              className="w-full py-4 bg-transparent outline-none text-sm"
              disabled={!db}
            />
          </div>
          <button 
            onClick={handleSend}
            disabled={!inputValue.trim() || isAiThinking || !db}
            className="w-14 h-14 rounded-full bg-[#0D2B4D] text-white flex items-center justify-center shadow-xl disabled:opacity-50"
          >
            <Send size={22} className="transform -rotate-45" />
          </button>
        </div>
      </footer>

      {/* Catalog & Policy Drawers simplified logic for stability */}
      {isCatalogOpen && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsCatalogOpen(false)}></div>
          <div className="bg-white rounded-t-[40px] max-h-[85vh] p-6 overflow-y-auto relative z-10">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">الكتالوج</h3>
              <button onClick={() => setIsCatalogOpen(false)}><X /></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {profile.products.map(p => (
                <div key={p.id} className="border rounded-3xl p-3">
                   <img src={p.image} className="w-full aspect-square object-cover rounded-2xl mb-2" />
                   <p className="text-xs font-bold truncate">{p.name}</p>
                   <p className="text-[10px] text-[#00D1FF]">{p.price} {profile.currency}</p>
                   <button onClick={() => {setInputValue(`أريد طلب: ${p.name}`); setIsCatalogOpen(false)}} className="w-full mt-2 py-2 bg-gray-100 rounded-xl text-[10px] font-bold">اطلب</button>
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
