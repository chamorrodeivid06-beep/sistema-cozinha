window.SupportChatComponent = function SupportChat({ 
  companyId, 
  currentUsername, 
  currentUserRole, 
  operatorUsername,
  isVisible,
  supabaseClient 
}) {
  const { useState, useEffect, useRef } = React;
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef(null);

  const fetchMessages = async () => {
    if (!companyId || !operatorUsername || !supabaseClient) return;
    try {
      const { data, error } = await supabaseClient
        .from('support_messages')
        .select('*')
        .eq('company_id', companyId)
        .eq('operator_username', operatorUsername)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setMessages(data);
      }
    } catch (err) {
      console.error("Erro ao carregar mensagens:", err);
    }
  };

  useEffect(() => {
    if (!isVisible || !companyId || !operatorUsername || !supabaseClient) return;

    fetchMessages();

    const channel = supabaseClient
      .channel(`chat-${companyId}-${operatorUsername}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `operator_username=eq.${operatorUsername}`
        },
        (payload) => {
          if (payload.new && payload.new.company_id === companyId) {
            setMessages((prev) => [...prev, payload.new]);
            if (!isOpen && payload.new.sender_username !== currentUsername) {
              setUnreadCount((count) => count + 1);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [companyId, operatorUsername, isOpen, currentUsername, isVisible, supabaseClient]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isVisible || !companyId || !operatorUsername) {
    return null;
  }

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const text = newMessage.trim();
    if (!text) return;

    setNewMessage('');

    try {
      await supabaseClient.from('support_messages').insert([
        {
          company_id: companyId,
          operator_username: operatorUsername,
          sender_username: currentUsername,
          sender_role: currentUserRole || 'operador',
          message: text
        }
      ]);
    } catch (err) {
      console.error("Erro ao enviar mensagem:", err);
    }
  };

  const handleToggleOpen = () => {
    if (!isOpen) setUnreadCount(0);
    setIsOpen(!isOpen);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* JANELA DE CONVERSA */}
      {isOpen && (
        <div className="w-80 sm:w-96 h-[480px] bg-[#161616] border border-[#2d2d2d] rounded-2xl shadow-2xl flex flex-col overflow-hidden mb-3 animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Topo */}
          <div className="p-4 bg-[#111111] border-b border-[#262626] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#D95B1E]/10 border border-[#D95B1E]/30 flex items-center justify-center text-[#D95B1E]">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>
              </div>
              <div>
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  Canal Direto de Suporte
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                </h4>
                <p className="text-[10px] text-zinc-400">
                  Sessão ativa com: <strong className="text-[#D95B1E]">{operatorUsername}</strong>
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="text-zinc-400 hover:text-white p-1 rounded-lg transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>

          {/* Mensagens */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-zinc-500 space-y-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-zinc-700"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <p className="text-[11px]">Nenhuma mensagem ainda.<br />Inicie a conversa pelo suporte.</p>
              </div>
            ) : (
              messages.map((m) => {
                const isMe = m.sender_username?.toLowerCase() === currentUsername?.toLowerCase();
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <span className="text-[10px] text-zinc-500 mb-0.5 px-1">
                      {isMe ? 'Você' : m.sender_username} ({m.sender_role})
                    </span>
                    <div
                      className={`max-w-[85%] px-3 py-2 rounded-xl text-xs leading-relaxed ${
                        isMe
                          ? 'bg-[#D95B1E] text-white font-medium rounded-tr-none'
                          : 'bg-[#222222] text-white rounded-tl-none border border-[#333]'
                      }`}
                    >
                      {m.message}
                    </div>
                    <span className="text-[9px] text-zinc-600 mt-0.5 px-1 font-mono">
                      {new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input de envio */}
          <form onSubmit={handleSendMessage} className="p-3 bg-[#111111] border-t border-[#262626] flex items-center gap-2">
            <input
              type="text"
              placeholder="Digite sua mensagem..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="flex-1 bg-[#1c1c1c] border border-[#333] rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#D95B1E] transition-colors placeholder:text-zinc-500"
            />
            <button
              type="submit"
              className="bg-[#D95B1E] hover:bg-[#c34e17] text-white p-2 rounded-xl transition-all shadow-md disabled:opacity-40"
              disabled={!newMessage.trim()}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
            </button>
          </form>
        </div>
      )}

      {/* BOTÃO FLUTUANTE */}
      <button
        onClick={handleToggleOpen}
        className="w-14 h-14 rounded-full bg-[#D95B1E] hover:bg-[#c34e17] text-white shadow-2xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95 relative border-2 border-orange-400/30"
        title="Abrir Chat de Suporte"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-black">
            {unreadCount}
          </span>
        )}
      </button>
    </div>
  );
};
