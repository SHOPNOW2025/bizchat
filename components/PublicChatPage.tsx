
import React, { useState, useRef, useEffect } from 'react';
import { BusinessProfile, Product, Message } from '../types';
import { db } from '../firebase';
import { collection, addDoc, query, orderBy, onSnapshot, limit, serverTimestamp, setDoc, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
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
  Twitter,
  Facebook,
  Globe,
  CheckCheck
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

    // Ensure session document exists and is tracking active time
    const sessionRef = doc(db, "profiles", profile.id, "chats", chatSessionId.current);
    setDoc(sessionRef, { 
      lastActive: serverTimestamp(),
      customerId: chatSessionId.current,
      createdAt: serverTimestamp()
    }, { merge: true });

    const q = query(
      collection(db, "profiles", profile.id, "chats", chatSessionId.current, "messages"),
      orderBy("timestamp", "asc"),
      limit(100)
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
      // 1. Update the parent session document to trigger notifications in Dashboard
      const sessionRef = doc(db, "profiles", profile.id, "chats", chatSessionId.current);
      await updateDoc(sessionRef, {
        lastText: text,
        lastActive: serverTimestamp()
      });

      // 2. Add the message to the subcollection
      await addDoc(collection(db, "profiles", profile.id, "chats", chatSessionId.current, "messages"), {
        sender: 'customer',
        text: text,
        timestamp: serverTimestamp()
      });
      
    } catch (e) {
      console.error("Error sending message", e);
      // If document doesn't exist (due to some error), set it again
      const sessionRef = doc(db, "profiles", profile.id, "chats", chatSessionId.current);
      await setDoc(sessionRef, { lastText: text, lastActive: serverTimestamp() }, { merge: true });
    }
  };

  return (
    <div className="h-screen bg-[#F0F4F8] flex flex-col max-w-2xl mx-auto shadow-2xl relative overflow-hidden font-tajawal">
      {/* Header */}
      <header className="bg-white p-5 flex items-center justify-between border-b shadow-sm z-30">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-[20px] overflow-hidden border-2 border-[#00D1FF] p-0.5 shadow-lg bg-gray-50">
            <img src={profile.logo} alt={profile.name} className="w-full h-full object-cover rounded-[18px]" />
          </div>
          <div>
            <h1 className="font-black text-lg text-[#0D2B4D] leading-none mb-1.5">{profile.name}</h1>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
              <span className="text-[10px] text-gray-400 font-black uppercase tracking-widest">مستعد لخدمتك</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2.5">
          <a href={`tel:${profile.phone}`} className="w-11 h-11 rounded-2xl bg-blue-50 text-[#0D2B4D] flex items-center justify-center hover:bg-blue-100 transition-all shadow-sm border border-blue-100"><Phone size={20} /></a>
          <button onClick={() => setIsCatalogOpen(true)} className="w-11 h-11 rounded-2xl bg-[#00D1FF] text-white flex items-center justify-center hover:bg-cyan-600 transition-all shadow-xl shadow-cyan-500/20"><ShoppingBag size={20} /></button>
        </div>
      </header>

      {/* Profile Bio */}
      {profile.description && (
        <div className="bg-white/80 backdrop-blur-md px-6 py-3 border-b text-center">
           <p className="text-xs text-gray-600 font-medium leading-relaxed italic line-clamp-2">"{profile.description}"</p>
        </div>
      )}

      {/* Chat Messages */}
      <main className="flex-1 overflow-y-auto p-5 space-y-6 bg-[url('https://www.transparenttextures.com/patterns/pinstriped-suit.png')]">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'customer' ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[85%] p-4 rounded-3xl shadow-md relative animate-in fade-in slide-in-from-bottom-3 duration-500 ${
              msg.sender === 'customer' 
                ? 'bg-white text-gray-800 rounded-tr-none' 
                : 'bg-[#0D2B4D] text-white rounded-tl-none border-b-4 border-blue-900 shadow-xl'
            }`}>
              <p className="text-sm leading-relaxed font-medium">{msg.text}</p>
              <div className={`text-[9px] mt-2.5 flex items-center gap-1 font-bold ${msg.sender === 'customer' ? 'text-gray-400' : 'text-blue-300'}`}>
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                {msg.sender === 'owner' && <CheckCheck size={12} />}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </main>

      {/* Input Area */}
      <footer className="p-5 bg-white border-t space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-gray-50 rounded-[24px] px-5 flex items-center focus-within:ring-2 focus-within:ring-[#00D1FF] transition-all border border-gray-100">
            <input 
              type="text" 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="اكتب رسالتك للمتجر هنا..."
              className="w-full py-5 bg-transparent outline-none text-sm font-medium"
            />
          </div>
          <button 
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className="w-16 h-16 rounded-[24px] bg-[#0D2B4D] text-white flex items-center justify-center shadow-2xl shadow-blue-900/30 disabled:opacity-50 hover:scale-105 active:scale-95 transition-all"
          >
            <Send size={24} className="transform -rotate-45 -mr-1" />
          </button>
        </div>
        <div className="flex justify-center">
          <button onClick={() => setIsPolicyOpen(true)} className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2 hover:text-[#00D1FF] transition-colors group">
            <Info size={14} className="group-hover:rotate-12 transition-transform" /> سياسات ومعلومات المتجر
          </button>
        </div>
      </footer>

      {/* Catalog Drawer */}
      {isCatalogOpen && (
        <div className="absolute inset-0 z-50">
          <div className="absolute inset-0 bg-[#0D2B4D]/60 backdrop-blur-sm animate-in fade-in" onClick={() => setIsCatalogOpen(false)}></div>
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[50px] max-h-[85vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-full duration-700">
            <div className="p-8 flex items-center justify-between border-b bg-gray-50/50 relative">
              <div className="absolute top-4 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-gray-200 rounded-full"></div>
              <div className="flex items-center gap-4 mt-2">
                <div className="p-3 bg-cyan-50 rounded-2xl text-[#00D1FF]"><ShoppingBag size={24} /></div>
                <div>
                  <h3 className="text-xl font-black text-[#0D2B4D]">كتالوج المتجر</h3>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">تصفح واطلب ما تحب</p>
                </div>
              </div>
              <button onClick={() => setIsCatalogOpen(false)} className="w-12 h-12 rounded-full bg-white shadow-md flex items-center justify-center text-gray-400 hover:text-red-500 transition-all">
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 grid grid-cols-2 gap-6">
              {profile.products.length === 0 ? (
                <div className="col-span-2 text-center py-24">
                   <p className="text-gray-400 font-bold">لا توجد منتجات حالياً</p>
                </div>
              ) : (
                profile.products.map(product => (
                  <div key={product.id} className="bg-white border rounded-[32px] overflow-hidden group hover:shadow-2xl transition-all border-gray-100 flex flex-col">
                    <div className="aspect-square relative overflow-hidden bg-gray-50">
                      <img src={product.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="" />
                      <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] font-black text-[#0D2B4D] shadow-xl">
                        {product.price} {profile.currency}
                      </div>
                    </div>
                    <div className="p-5 flex-1 flex flex-col gap-2">
                      <h4 className="font-bold text-xs text-[#0D2B4D] line-clamp-1">{product.name}</h4>
                      <button 
                        onClick={() => { setInputValue(`مهتم بطلب: ${product.name}`); setIsCatalogOpen(false); }}
                        className="w-full py-3.5 bg-[#0D2B4D] text-white text-[10px] font-bold rounded-2xl hover:bg-black transition-all shadow-lg shadow-blue-900/10 mt-2"
                      >
                        طلب المنتج
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Policy Modal */}
      {isPolicyOpen && (
        <div className="absolute inset-0 z-50 p-6 flex items-center justify-center">
          <div className="absolute inset-0 bg-[#0D2B4D]/80 backdrop-blur-md animate-in fade-in" onClick={() => setIsPolicyOpen(false)}></div>
          <div className="relative w-full max-w-sm bg-white rounded-[40px] p-8 shadow-2xl animate-in zoom-in-95 duration-300">
            <h3 className="text-xl font-black text-[#0D2B4D] mb-8 text-center">معلومات التواصل</h3>
            <div className="space-y-6">
              <div className="bg-gray-50 p-5 rounded-3xl space-y-4">
                <h4 className="text-[10px] font-black text-gray-400 uppercase">السياسات</h4>
                <div className="space-y-3">
                   <div className="flex gap-3"><ShoppingBag size={14} className="text-[#00D1FF] shrink-0" /><p className="text-[11px] text-gray-600 leading-relaxed">{profile.returnPolicy}</p></div>
                   <div className="flex gap-3"><Globe size={14} className="text-[#00D1FF] shrink-0" /><p className="text-[11px] text-gray-600 leading-relaxed">{profile.deliveryPolicy}</p></div>
                </div>
              </div>
              <div className="flex justify-center gap-4">
                {profile.socialLinks.instagram && <a href={profile.socialLinks.instagram} className="w-14 h-14 rounded-2xl bg-pink-50 text-pink-500 flex items-center justify-center hover:scale-110 transition-all border border-pink-100"><Instagram size={24} /></a>}
                {profile.socialLinks.twitter && <a href={profile.socialLinks.twitter} className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-400 flex items-center justify-center hover:scale-110 transition-all border border-blue-100"><Twitter size={24} /></a>}
                {profile.socialLinks.facebook && <a href={profile.socialLinks.facebook} className="w-14 h-14 rounded-2xl bg-blue-800 text-white flex items-center justify-center hover:scale-110 transition-all"><Facebook size={24} /></a>}
                {profile.socialLinks.whatsapp && <a href={profile.socialLinks.whatsapp} className="w-14 h-14 rounded-2xl bg-green-50 text-green-500 flex items-center justify-center hover:scale-110 transition-all border border-green-100"><Phone size={24} /></a>}
              </div>
            </div>
            <button onClick={() => setIsPolicyOpen(false)} className="w-full mt-8 py-5 bg-[#0D2B4D] text-white font-black rounded-3xl shadow-xl">رجوع للدردشة</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicChatPage;
