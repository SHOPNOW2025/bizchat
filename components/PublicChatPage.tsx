
import React, { useState, useRef, useEffect } from 'react';
import { BusinessProfile, Product, Message } from '../types';
import { db } from '../firebase';
import { collection, addDoc, query, orderBy, onSnapshot, limit, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
  Send, 
  Phone, 
  Instagram, 
  ShoppingBag, 
  Info, 
  X, 
  ChevronDown,
  ExternalLink,
  Check
} from 'lucide-react';

interface PublicChatPageProps {
  profile: BusinessProfile;
}

const PublicChatPage: React.FC<PublicChatPageProps> = ({ profile }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [isPolicyOpen, setIsPolicyOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatSessionId = useRef<string>(localStorage.getItem(`chat_session_${profile.id}`) || `session_${Date.now()}`);

  useEffect(() => {
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
    });

    return () => unsubscribe();
  }, [profile.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const text = inputValue;
    setInputValue('');

    try {
      await addDoc(collection(db, "profiles", profile.id, "chats", chatSessionId.current, "messages"), {
        sender: 'customer',
        text: text,
        timestamp: serverTimestamp()
      });

      // Simple auto-reply simulation for demo (in production, business owner responds)
      if (messages.length < 3) {
        setTimeout(async () => {
          await addDoc(collection(db, "profiles", profile.id, "chats", chatSessionId.current, "messages"), {
            sender: 'owner',
            text: 'شكراً لتواصلك، سنقوم بالرد عليك قريباً.',
            timestamp: serverTimestamp()
          });
        }, 2000);
      }
    } catch (e) {
      console.error("Error sending message", e);
    }
  };

  return (
    <div className="h-screen bg-[#F0F4F8] flex flex-col max-w-2xl mx-auto shadow-2xl relative overflow-hidden">
      {/* Header */}
      <header className="bg-white p-4 flex items-center justify-between border-b shadow-sm z-30">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-[#00D1FF] p-0.5">
            <img src={profile.logo} alt={profile.name} className="w-full h-full object-cover rounded-full" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-[#0D2B4D]">{profile.name}</h1>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-xs text-gray-500">متواجد الآن</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <a 
            href={`tel:${profile.phone}`} 
            className="w-10 h-10 rounded-full bg-blue-50 text-[#0D2B4D] flex items-center justify-center hover:bg-blue-100 transition-colors"
            title="اتصال مباشر"
          >
            <Phone size={20} />
          </a>
          <button 
            onClick={() => setIsCatalogOpen(true)}
            className="w-10 h-10 rounded-full bg-cyan-50 text-[#00D1FF] flex items-center justify-center hover:bg-cyan-100 transition-colors"
            title="كتالوج المنتجات"
          >
            <ShoppingBag size={20} />
          </button>
        </div>
      </header>

      {/* Chat Messages */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'customer' ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[80%] p-4 rounded-2xl shadow-sm relative ${
              msg.sender === 'customer' 
                ? 'bg-white text-gray-800 rounded-tr-none' 
                : 'bg-[#0D2B4D] text-white rounded-tl-none'
            }`}>
              <p className="text-sm leading-relaxed">{msg.text}</p>
              <div className={`text-[10px] mt-2 flex items-center gap-1 ${msg.sender === 'customer' ? 'text-gray-400' : 'text-blue-200'}`}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {msg.sender === 'owner' && <Check size={12} />}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </main>

      {/* Input Area */}
      <footer className="p-4 bg-white border-t">
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-gray-100 rounded-2xl px-4 flex items-center focus-within:ring-2 focus-within:ring-[#00D1FF] transition-all">
            <input 
              type="text" 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="اكتب رسالتك هنا..."
              className="w-full py-3 bg-transparent outline-none text-sm"
            />
          </div>
          <button 
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className="w-12 h-12 rounded-2xl bg-[#00D1FF] text-white flex items-center justify-center shadow-lg shadow-cyan-500/30 disabled:opacity-50 disabled:shadow-none hover:scale-105 active:scale-95 transition-all"
          >
            <Send size={20} className="transform -rotate-45 -mr-1" />
          </button>
        </div>
        <div className="flex justify-center gap-6 mt-4 opacity-50">
          <button onClick={() => setIsPolicyOpen(true)} className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-1 hover:opacity-100">
            <Info size={12} /> الشروط والسياسات
          </button>
        </div>
      </footer>

      {/* Catalog Drawer */}
      {isCatalogOpen && (
        <div className="absolute inset-0 z-50 animate-in slide-in-from-bottom-full duration-300">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsCatalogOpen(false)}></div>
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[40px] max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-6 flex items-center justify-between border-b bg-gray-50/50">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <ShoppingBag className="text-[#00D1FF]" /> كتالوج المنتجات
              </h3>
              <button onClick={() => setIsCatalogOpen(false)} className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-400">
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 gap-4">
              {profile.products.length === 0 ? (
                <div className="col-span-2 text-center py-20 text-gray-400">لا يوجد منتجات حالياً</div>
              ) : (
                profile.products.map(product => (
                  <div key={product.id} className="bg-white border rounded-3xl overflow-hidden group hover:shadow-md transition-shadow">
                    <div className="aspect-square relative">
                      <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                      <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg text-xs font-bold text-[#00D1FF]">
                        {product.price} {profile.currency}
                      </div>
                    </div>
                    <div className="p-3">
                      <h4 className="font-bold text-xs mb-1 line-clamp-1">{product.name}</h4>
                      <p className="text-[10px] text-gray-500 line-clamp-2 mb-3 h-7">{product.description}</p>
                      <button 
                        onClick={() => {
                          setInputValue(`أنا مهتم بمنتج: ${product.name}`);
                          setIsCatalogOpen(false);
                        }}
                        className="w-full py-2 bg-gray-50 text-[#0D2B4D] text-[10px] font-bold rounded-xl hover:bg-[#00D1FF] hover:text-white transition-colors"
                      >
                        اطلب الآن
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Policy Drawer */}
      {isPolicyOpen && (
        <div className="absolute inset-0 z-50 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsPolicyOpen(false)}></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] bg-white rounded-3xl p-8 max-h-[70vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold">السياسات والمعلومات</h3>
              <button onClick={() => setIsPolicyOpen(false)}><X size={24} /></button>
            </div>
            
            <div className="space-y-6">
              <section>
                <h4 className="font-bold text-[#00D1FF] mb-2 border-b pb-1">سياسة الاستبدال والارجاع</h4>
                <p className="text-sm text-gray-600 leading-relaxed">{profile.returnPolicy}</p>
              </section>
              <section>
                <h4 className="font-bold text-[#00D1FF] mb-2 border-b pb-1">سياسة التوصيل</h4>
                <p className="text-sm text-gray-600 leading-relaxed">{profile.deliveryPolicy}</p>
              </section>
              <section>
                <h4 className="font-bold text-[#00D1FF] mb-2 border-b pb-1">تواصل معنا</h4>
                <div className="flex gap-4">
                  {profile.socialLinks.instagram && <a href={profile.socialLinks.instagram} className="text-pink-500"><Instagram /></a>}
                  <a href={`tel:${profile.phone}`} className="text-blue-500"><Phone /></a>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicChatPage;
