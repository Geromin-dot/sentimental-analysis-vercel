

// DOM Elements
const timeSlider = document.getElementById('timeSlider');
const timeVal = document.getElementById('timeVal');
const pauseSlider = document.getElementById('pauseSlider');
const pauseVal = document.getElementById('pauseVal');
const taskSlider = document.getElementById('taskSlider');
const taskVal = document.getElementById('taskVal');
const coachNote = document.getElementById('coachNote');
const coachBtn = document.getElementById('coachBtn');
const coachOutput = document.getElementById('coachOutput');

// Update slider values dynamically
timeSlider.addEventListener('input', () => timeVal.innerText = timeSlider.value);
pauseSlider.addEventListener('input', () => pauseVal.innerText = pauseSlider.value);
taskSlider.addEventListener('input', () => taskVal.innerText = taskSlider.value);

coachBtn.addEventListener('click', async () => {
    const time = timeSlider.value;
    const pauses = pauseSlider.value;
    const tasks = taskSlider.value;
    const note = coachNote.value.trim();


    coachBtn.innerHTML = '<div class="spinner" style="width:24px;height:24px;border-width:3px;margin:auto;"></div>';
    coachBtn.disabled = true;
    coachOutput.innerHTML = '<p style="color: var(--text-secondary); text-align: center; margin-top: 2rem;">Analyzing your study session...</p>';

    try {
        await generateCoaching(time, pauses, tasks, note);
    } catch (e) {
        console.error(e);
        coachOutput.innerHTML = `<p style="color: #ef4444; text-align: center; margin-top: 2rem;"><strong>AI Error:</strong><br>${e.message || 'Failed to connect. Please try again.'}</p>`;
    }

    coachBtn.innerHTML = '<span class="btn-text">Generate AI Coaching</span><svg class="sparkle" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"></path><path d="M3 12h18"></path><path d="M19 5l-14 14"></path><path d="M5 5l14 14"></path></svg>';
    coachBtn.disabled = false;
});

async function generateCoaching(time, pauses, tasks, note) {
    const noteContext = note ? `\nStudent's Specific Note/Question: "${note}"\nPlease directly address this note in your coaching.` : "";

    const prompt = `
You are an AI study coach analyzing a student's recent study session.

Session Data:
- Total Time Focused: ${time} minutes
- Number of Times Timer was Paused (Distractions): ${pauses}
- Tasks Completed: ${tasks}${noteContext}

Your job is to analyze this performance and provide personalized coaching.
1. Determine the "status" of the session (e.g., "Highly Productive", "Distracted", "Burnout Risk", "Good Effort").
2. Write a short, empathetic motivational message (1-2 sentences).
3. Provide a specific, actionable study tip based on their metrics (e.g., if pauses are high, suggest hiding their phone).

Return the output STRICTLY in valid JSON format like this. Do not use markdown blocks:
{
  "status": "Distracted",
  "message": "It looks like you had trouble staying in the zone today, and that's completely okay.",
  "tip": "Try putting your phone in another room to reduce the urge to pause."
}
    `;

    let modelToUse = localStorage.getItem('cached_gemini_model') || 'models/gemini-1.5-flash';
    let response = await fetch(`/api/generateContent?model=${encodeURIComponent(modelToUse)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.4 }
        })
    });

    // Auto-discover model if 404
    if (response.status === 404) {
        const modelsRes = await fetch(`/api/models`);
        if (modelsRes.ok) {
            const modelsData = await modelsRes.json();
            const availableModels = modelsData.models || [];
            const validModel = availableModels.find(m => 
                m.supportedGenerationMethods && 
                m.supportedGenerationMethods.includes('generateContent') && 
                m.name.includes('gemini')
            );
            if (validModel) {
                modelToUse = validModel.name;
                localStorage.setItem('cached_gemini_model', modelToUse);
                response = await fetch(`/api/generateContent?model=${encodeURIComponent(modelToUse)}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { temperature: 0.4 }
                    })
                });
            }
        }
    }

    if (!response.ok) {
        if (response.status === 429) {
            throw new Error("API Rate Limit Exceeded (429).<br><br>The free Gemini API only allows 15 requests per minute. Please wait about 60 seconds and click Generate again!");
        }
        const errText = await response.text();
        console.error("API Error:", errText);
        throw new Error("Failed to reach AI.");
    }

    const data = await response.json();
    const aiText = data.candidates[0].content.parts[0].text.trim();
    
    // Clean JSON
    const cleanJson = aiText.replace(/```json/gi, '').replace(/```/gi, '').trim();
    const parsed = JSON.parse(cleanJson);

    // Determine badge color based on status keywords
    let badgeClass = "okay";
    const statusLower = (parsed.status || "").toLowerCase();
    if (statusLower.includes("productive") || statusLower.includes("excellent") || statusLower.includes("great") || statusLower.includes("flow")) {
        badgeClass = "excellent";
    } else if (statusLower.includes("distracted") || statusLower.includes("burnout") || statusLower.includes("poor") || statusLower.includes("struggle")) {
        badgeClass = "poor";
    }

    // Render output
    coachOutput.innerHTML = `
        <div style="text-align: center;">
            <div class="metric-badge ${badgeClass}">${parsed.status}</div>
        </div>
        <p style="color: var(--text-primary); font-size: 1.1rem; line-height: 1.6; margin-bottom: 1.5rem;">"${parsed.message}"</p>
        <div style="background: rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px; border-left: 4px solid var(--primary-accent);">
            <strong style="color: var(--primary-accent); display: block; margin-bottom: 0.5rem;">💡 Coach's Tip:</strong>
            <span style="color: var(--text-secondary); font-size: 0.95rem; line-height: 1.5;">${parsed.tip}</span>
        </div>
    `;
}
