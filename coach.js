document.addEventListener('DOMContentLoaded', () => {
    const chatHistory = document.getElementById('chatHistory');
    const chatInput = document.getElementById('chatInput');
    const sendChatBtn = document.getElementById('sendChatBtn');
    const coachIntroText = document.getElementById('coachIntroText');

    let conversationHistory = [];

    // Load insight from localStorage if we were redirected here due to an intervention
    const storedInsight = localStorage.getItem('ifocus_telemetry_insight');
    
    if (storedInsight) {
        try {
            const data = JSON.parse(storedInsight);
            
            // Set intro text to the insight reason and recommendation
            coachIntroText.innerHTML = `<span style="color: var(--warning); font-weight: 600;">Intervention Triggered:</span> ${data.reason}<br><br><span style="color: var(--primary-accent); font-weight: 600;">Action Plan:</span> ${data.actionPlan || 'Take a 5-minute deep breathing break.'}<br><br>How are you feeling right now?`;
            
            conversationHistory.push({
                role: "model",
                parts: [{ text: `Intervention Triggered: ${data.reason}. Action Plan: ${data.actionPlan}. How are you feeling right now?` }]
            });

            // Clear it so it doesn't show up again next time
            localStorage.removeItem('ifocus_telemetry_insight');
        } catch (e) {
            console.error("Error parsing telemetry data", e);
        }
    } else {
        conversationHistory.push({
            role: "model",
            parts: [{ text: "Hi! I am your AI Study Coach. I am silently observing your session to help you maintain fantastic focus. How can I help you today?" }]
        });
    }

    function addMessageToUI(text, isUser) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-message ${isUser ? 'user-message' : 'ai-message'}`;
        msgDiv.style.display = 'flex';
        msgDiv.style.gap = '1rem';
        msgDiv.style.alignItems = 'flex-start';
        msgDiv.style.flexDirection = isUser ? 'row-reverse' : 'row';

        const avatar = isUser ? `
            <div class="user-avatar" style="width: 40px; height: 40px; flex-shrink: 0; background: var(--glass-bg); border: 1px solid var(--glass-border); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            </div>
        ` : `
            <div class="ai-avatar" style="width: 40px; height: 40px; flex-shrink: 0; background: linear-gradient(135deg, var(--primary), var(--primary-accent)); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 2v2"></path>
                    <path d="M12 20v2"></path>
                    <path d="M4.93 4.93l1.41 1.41"></path>
                    <path d="M17.66 17.66l1.41 1.41"></path>
                    <path d="M2 12h2"></path>
                    <path d="M20 12h2"></path>
                    <path d="M6.34 17.66l-1.41 1.41"></path>
                    <path d="M19.07 4.93l-1.41 1.41"></path>
                </svg>
            </div>
        `;

        const bubbleBg = isUser ? 'var(--primary)' : 'rgba(95, 143, 94, 0.1)';
        const bubbleColor = isUser ? 'white' : 'var(--text-primary)';
        const bubbleBorder = isUser ? 'none' : '1px solid rgba(95, 143, 94, 0.2)';
        const borderRadius = isUser ? '12px 12px 0 12px' : '0 12px 12px 12px';

        msgDiv.innerHTML = `
            ${avatar}
            <div style="background: ${bubbleBg}; border: ${bubbleBorder}; padding: 1rem; border-radius: ${borderRadius}; color: ${bubbleColor}; line-height: 1.5; max-width: 80%;">
                <p style="margin: 0;">${text}</p>
            </div>
        `;

        chatHistory.appendChild(msgDiv);
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }

    async function sendChatMessage() {
        const text = chatInput.value.trim();
        if (!text) return;

        // Add user message
        addMessageToUI(text, true);
        chatInput.value = '';
        sendChatBtn.disabled = true;

        conversationHistory.push({
            role: "user",
            parts: [{ text: text }]
        });

        // Show typing indicator
        const typingId = 'typing-' + Date.now();
        const typingDiv = document.createElement('div');
        typingDiv.id = typingId;
        typingDiv.style.display = 'flex';
        typingDiv.style.gap = '1rem';
        typingDiv.style.alignItems = 'flex-start';
        typingDiv.innerHTML = `
            <div class="ai-avatar pulse-animation" style="width: 40px; height: 40px; flex-shrink: 0; background: linear-gradient(135deg, var(--primary), var(--primary-accent)); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v2"></path><path d="M12 20v2"></path></svg>
            </div>
            <div style="background: rgba(95, 143, 94, 0.1); border: 1px solid rgba(95, 143, 94, 0.2); padding: 1rem; border-radius: 0 12px 12px 12px; color: var(--text-secondary);">
                Thinking...
            </div>
        `;
        chatHistory.appendChild(typingDiv);
        chatHistory.scrollTop = chatHistory.scrollHeight;

        try {
            const systemPrompt = `You are a supportive, concise, and highly effective AI Study Coach for the iFocus app. The user is currently in a focus session or taking a break. Keep your answers brief (1-3 sentences) and highly encouraging. Offer practical advice for focus, time management, or dealing with burnout.`;
            
            let modelToUse = localStorage.getItem('cached_gemini_model') || 'models/gemini-1.5-flash';
            let response = await fetch(\`/api/generateContent?model=\${encodeURIComponent(modelToUse)}\`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: systemPrompt }] },
                    contents: conversationHistory,
                    generationConfig: { temperature: 0.7 }
                })
            });

            if (!response.ok) throw new Error("API failed");
            
            const result = await response.json();
            let coachReply = result.candidates?.[0]?.content?.parts?.[0]?.text || "I'm here to help you stay focused!";
            
            document.getElementById(typingId).remove();
            
            conversationHistory.push({
                role: "model",
                parts: [{ text: coachReply }]
            });

            addMessageToUI(coachReply, false);

        } catch (error) {
            console.error(error);
            document.getElementById(typingId).remove();
            addMessageToUI("Sorry, I'm having trouble connecting right now. Take a deep breath, and let's get back to work when you're ready!", false);
        }

        sendChatBtn.disabled = false;
        chatInput.focus();
    }

    sendChatBtn.addEventListener('click', sendChatMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendChatMessage();
    });
});
