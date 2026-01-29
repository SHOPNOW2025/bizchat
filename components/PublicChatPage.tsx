
import React, { useState, useRef, useEffect } from 'react';
import { BusinessProfile, Product, Message } from '../types';
import { sql } from '../neon';
import { 
  Send, 
  Phone, 
  ShoppingBag, 
  X, 
  Check,
  User
} from 'lucide-react';

interface PublicChatPageProps {
  profile: BusinessProfile;
}

const PublicChatPage: React.FC<PublicChatPageProps> = ({ profile }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatSessionId = useRef<string>(localStorage.getItem(`chat_session_${profile.id}`) || `sess_${Date.now()}`);

  // دالة لجلب الرسائل من PostgreSQL
  const fetchMessages = async () => {
    try {
      const rows = await sql`
        SELECT * FROM messages 
        WHERE profile_id = ${profile.id} AND session_id = ${chatSessionId.current}
        ORDER BY timestamp ASC
      `;
      
      const msgs: Message[] = rows.map(r => ({
        id: r.id,
        sender: r.sender as 'customer' | 'owner',
        text: r.text,
        timestamp: new Date(r.timestamp)
      }));

      if (msgs.length === 0) {
        setMessages([
          { id: 'welcome', sender: 'owner', text: `مرحباً بك في ${profile.name}! كيف يمكنني مساعدتك اليوم؟`, timestamp: new Date() }
        ]);
      } else {
        setMessages(msgs);
      }
      setIsLoading(false);
    } catch (e) {
      console.error("Error fetching messages from Neon:", e);
    }
  };

  useEffect(() => {
    localStorage.setItem(`chat_session_${profile.id}`, chatSessionId.current);
    fetchMessages();

    // تحديث دوري كل 5 ثوانٍ لمحاكاة الوقت الفعلي
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [profile.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const text = inputValue;
    const msgId = `m_${Date.now()}`;
    setInputValue('');

    // تحديث الواجهة فوراً (Optimistic Update)
    const newMsg: Message = {
      id: msgId,
      sender: 'customer',
      text: text,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, newMsg]);

    try {
      await sql`
        INSERT INTO messages (id, profile_id, session_id, sender, text)
        VALUES (${msgId}, ${profile.id}, ${chatSessionId.current}, 'customer', ${text})
      `;
    } catch (e) {
      console.error("Error saving message to Neon:", e);
      alert("فشل في إرسال الرسالة، يرجى المحاولة لاحقاً.");
    }
  };

  return (
    <div className="h-screen bg-[#F8FAFC] flex flex-col max-w-2xl mx-auto shadow-2xl relative overflow-hidden font-tajawal">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md p-4 flex items-center justify-between border-b shadow-sm z-30 sticky top-0">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-[#00D1FF] p-0.5">
            <img src={profile.logo} alt={profile.name} className="w-full h-full object-cover rounded-full" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-[#0D2B4D]">{profile.name}</h1>
            <span className="text-[10px] text-green-500 font-bold flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span> متصل الآن
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <a href={`tel:${profile.phone}`} className="w-10 h-10 rounded-2xl bg-gray-50 text-[#0D2B4D] flex items-center justify-center hover:bg-[#0D2B4D] hover:text-white transition-all">
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
        <div ref={messagesEndRef} />
      </main>

      {/* Input Area */}
      <footer className="p-4 bg-white border-t border-gray-100">
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-gray-50 border border-gray-100 rounded-3xl px-5 flex items-center">
            <input 
              type="text" 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="اكتب رسالتك لصاحب المتجر..."
              className="w-full py-4 bg-transparent outline-none text-sm"
            />
          </div>
          <button 
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className="w-14 h-14 rounded-full bg-[#0D2B4D] text-white flex items-center justify-center shadow-xl disabled:opacity-50"
          >
            <Send size={22} className="transform -rotate-45" />
          </button>
        </div>
      </footer>

      {/* Catalog Drawer */}
      {isCatalogOpen && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsCatalogOpen(false)}></div>
          <div className="bg-white rounded-t-[40px] max-h-[85vh] p-6 overflow-y-auto relative z-10 animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">الكتالوج</h3>
              <button onClick={() => setIsCatalogOpen(false)} className="p-2 bg-gray-100 rounded-full"><X size={20}/></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {profile.products.map(p => (
                <div key={p.id} className="border border-gray-100 rounded-3xl p-3 bg-white shadow-sm">
                   <img src={p.image} className="w-full aspect-square object-cover rounded-2xl mb-2" />
                   <p className="text-xs font-bold truncate">{p.name}</p>
                   <p className="text-[10px] text-[#00D1FF] mb-2">{p.price} {profile.currency}</p>
                   <button 
                    onClick={() => {setInputValue(`أريد الاستفسار عن: ${p.name}`); setIsCatalogOpen(false)}} 
                    className="w-full py-2 bg-[#0D2B4D] text-white rounded-xl text-[10px] font-bold"
                   >
                    طلب المنتج
                   </button>
                </div>
              ))}
              {profile.products.length === 0 && (
                <div className="col-span-2 text-center py-10 text-gray-400">لا توجد منتجات معروضة حالياً</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicChatPage;
