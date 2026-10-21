document.addEventListener('DOMContentLoaded', () => {
    const API_URL = 'http://127.0.0.1:8000';
    
    const aiModal = document.getElementById('ai-modal');
    const btnFab = document.getElementById('btn-fab');
    const closeAiBtn = document.getElementById('close-ai');
    const clearAiBtn = document.getElementById('clear-ai');
    
    const aiInput = document.getElementById('ai-input');
    const aiSendBtn = document.getElementById('ai-send-btn');
    const aiChatHistory = document.getElementById('ai-chat-history');
    
    let msgCounter = 0; 
    let aiConversationHistory = JSON.parse(sessionStorage.getItem('aiHistory')) || []; 
    
    if(aiChatHistory) {
        const savedChatHtml = sessionStorage.getItem('aiChatHtml');
        if (savedChatHtml) {
            aiChatHistory.innerHTML = savedChatHtml;
        }
    }

    function saveChatState() {
        sessionStorage.setItem('aiHistory', JSON.stringify(aiConversationHistory));
        if(aiChatHistory) {
            sessionStorage.setItem('aiChatHtml', aiChatHistory.innerHTML);
        }
    }

    if(btnFab) btnFab.addEventListener('click', () => { aiModal.classList.add('show'); btnFab.style.display = 'none'; });
    if(closeAiBtn) closeAiBtn.addEventListener('click', () => { aiModal.classList.remove('show'); btnFab.style.display = 'flex'; });

    if(clearAiBtn) {
        clearAiBtn.addEventListener('click', () => {
            aiConversationHistory = [];
            msgCounter = 0;
            if(aiChatHistory) {
                aiChatHistory.innerHTML = '<div class="ai-message">System calibrated. Ready for scanning. Would you like guidance?</div>';
            }
            saveChatState();
        });
    }

    async function sendAiMessage() {
        if(!aiInput) return;
        const text = aiInput.value.trim();
        if (!text) return;

        appendChatMessage('user', text);
        aiInput.value = '';
        const loadingId = appendChatMessage('ai', 'Thinking...');

        try {
            const response = await fetch(`${API_URL}/api/ai/chat`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: text, history: aiConversationHistory })
            });
            const data = await response.json();
            
            document.getElementById(loadingId).remove();
            appendChatMessage('ai', data.response);

            aiConversationHistory.push({ role: 'user', text: text }, { role: 'assistant', text: data.response });
            if(aiConversationHistory.length > 10) aiConversationHistory = aiConversationHistory.slice(-10);
            
            saveChatState();
        } catch (error) {
            document.getElementById(loadingId).remove();
            appendChatMessage('error', 'Connection to AI Server failed.');
        }
    }

    function appendChatMessage(sender, text) {
        if(!aiChatHistory) return;
        
        const msgDiv = document.createElement('div');
        const msgId = 'msg-' + Date.now() + '-' + (msgCounter++);
        msgDiv.id = msgId;
        
        msgDiv.className = 'ai-message'; 
        msgDiv.style.maxWidth = '85%';
        msgDiv.style.alignSelf = sender === 'user' ? 'flex-end' : (sender === 'ai' ? 'flex-start' : 'center');
        
        if (sender === 'user') {
            msgDiv.style.background = 'var(--accent)';
            msgDiv.style.color = 'var(--bg-primary)';
            msgDiv.style.borderLeft = 'none';
        } else if (sender === 'error') {
            msgDiv.style.background = '#ef4444'; 
            msgDiv.style.color = 'white';
            msgDiv.style.borderLeft = 'none';
        }

        msgDiv.innerText = text;
        aiChatHistory.appendChild(msgDiv);
        aiChatHistory.scrollTop = aiChatHistory.scrollHeight;
        
        saveChatState();
        return msgId;
    }

    if(aiSendBtn) aiSendBtn.addEventListener('click', sendAiMessage);
    if(aiInput) aiInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendAiMessage(); });
});