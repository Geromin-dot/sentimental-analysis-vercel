let timerInterval;
let timeLeft = 25 * 60;
let timerRunning = false;

const initialTasks = [
    { id: 1, text: "Write 10-page Research Paper", effort: "High", type: "high-effort" },
    { id: 2, text: "Read Chapter 4 & 5", effort: "Medium", type: "medium-effort" },
    { id: 3, text: "Organize notes for 10 mins", effort: "Low (Quick Win)", type: "quick-win" },
    { id: 4, text: "Complete Math Worksheet", effort: "High", type: "high-effort" }
];

let currentTasks = [...initialTasks];

function renderTasks() {
    const taskList = document.getElementById('taskList');
    taskList.innerHTML = '';
    
    currentTasks.forEach((task, index) => {
        const div = document.createElement('div');
        div.className = `task-item ${task.type}`;
        // staggered animation
        div.style.animationDelay = `${index * 0.1}s`;
        div.style.animation = `fadeIn 0.5s ease backwards`;
        
        div.innerHTML = `
            <div>
                <strong style="font-size: 1.1rem; color: var(--text-primary);">${task.text}</strong>
                <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 6px;">Effort: ${task.effort}</div>
            </div>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--text-secondary)"><circle cx="12" cy="12" r="10"></circle></svg>
        `;
        taskList.appendChild(div);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    renderTasks();
});

document.getElementById('analyzeBtn').addEventListener('click', async () => {
    const text = document.getElementById('reflectionInput').value.trim();
    if (!text) return;
    
    const btn = document.getElementById('analyzeBtn');
    btn.innerHTML = '<div class="spinner" style="width:24px;height:24px;border-width:3px;margin:auto;"></div>';
    btn.disabled = true;
    
    try {
        await analyzeSentiment(text);
    } catch (e) {
        console.error(e);
    }
    
    btn.innerHTML = '<span class="btn-text">Analyze Sentiment & Adjust</span><svg class="sparkle" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"></path><path d="M3 12h18"></path><path d="M19 5l-14 14"></path><path d="M5 5l14 14"></path></svg>';
    btn.disabled = false;
});

async function analyzeSentiment(text) {
    const taskListStr = initialTasks.map(t => `${t.id}: ${t.text} (Effort: ${t.effort})`).join('\n');
    
    const prompt = `
You are an AI study coach analyzing a student's reflection journal entry.

Student Reflection: "${text}"

Current Tasks:
${taskListStr}

Your job is to do THREE things:
1. Categorize the student's emotional state into EXACTLY ONE of the following four categories: Stressed, Distracted, Motivated, or Engaged. Analyze the underlying emotion.
2. Determine the optimal order for the tasks based on their reflection. If the student explicitly requests to do a certain task first or order tasks in a certain way, you MUST prioritize that order. If they don't make a specific request, use these default rules:
   - Stressed: Quick Wins (Low effort) first, High effort last.
   - Distracted: Keep original order.
   - Motivated/Engaged: High effort first, Quick Wins last.
3. Write a short, personalized 1-2 sentence action plan explaining why you ordered the tasks this way (e.g., "I've moved Chapter 4 to the top as you requested, followed by a quick win.").

Reply STRICTLY in valid JSON format like this, do not use markdown blocks, just the JSON:
{
  "state": "Engaged",
  "taskOrder": [2, 3, 1, 4],
  "actionPlan": "Your personalized sentence here."
}
`;

    try {
        let modelToUse = localStorage.getItem('cached_gemini_model') || 'models/gemini-1.5-flash';
        let response = await fetch(`/api/generateContent?model=${encodeURIComponent(modelToUse)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.1 }
            })
        });

        // If 404, try to auto-discover a working model
        if (response.status === 404) {
            console.log("Model not found. Auto-discovering available models...");
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
                    console.log("Retrying with model:", modelToUse);
                    response = await fetch(`/api/generateContent?model=${encodeURIComponent(modelToUse)}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: prompt }] }],
                            generationConfig: { temperature: 0.1 }
                        })
                    });
                }
            }
        }

        if (!response.ok) {
            const errText = await response.text();
            console.error("API Error Response:", errText);
            throw new Error(`Failed to reach AI: ${response.status} ${errText}`);
        }

        const data = await response.json();
        const aiText = data.candidates[0].content.parts[0].text.trim();
        
        // Remove markdown formatting if the AI wraps it in json blocks
        const cleanJson = aiText.replace(/```json/gi, '').replace(/```/gi, '').trim();
        const parsed = JSON.parse(cleanJson);
        
        let state = parsed.state || "Engaged"; 
        let taskOrder = parsed.taskOrder || [];
        let actionPlan = parsed.actionPlan || null;

        applyIntervention(state, taskOrder, actionPlan);
    } catch (error) {
        console.error("AI Error:", error);
        alert("AI Analysis failed. Check console for details. Falling back to default.");
        applyIntervention("Engaged");
    }
}

function applyIntervention(state, orderedIds = [], actionPlan = null) {
    const section = document.getElementById('interventionSection');
    const content = document.getElementById('interventionContent');
    
    section.classList.remove('hidden');
    
    let recommendation = "";
    
    // 1. Process Task Ordering
    if (orderedIds && orderedIds.length > 0) {
        currentTasks = [];
        // Add tasks in the exact order the AI specified
        orderedIds.forEach(id => {
            const task = initialTasks.find(t => t.id === id);
            if (task) currentTasks.push(task);
        });
        // Add any remaining tasks that the AI might have missed
        initialTasks.forEach(task => {
            if (!currentTasks.includes(task)) currentTasks.push(task);
        });
    } else {
        // Fallback to default logic
        if (state === "Stressed") {
            currentTasks = [...initialTasks].sort((a, b) => {
                if (a.type === 'quick-win') return -1;
                if (b.type === 'quick-win') return 1;
                if (a.type === 'high-effort') return 1;
                if (b.type === 'high-effort') return -1;
                return 0;
            });
        } else if (state === "Engaged" || state === "Motivated") {
            currentTasks = [...initialTasks].sort((a, b) => {
                if (a.type === 'high-effort') return -1;
                if (b.type === 'high-effort') return 1;
                return 0;
            });
        } else {
            currentTasks = [...initialTasks];
        }
    }

    // 2. Process Interventions & UI
    if (state === "Stressed") {
        const defaultText = "Shorter focus blocks (15 mins) and longer breaks have been suggested. Your task list has been reordered to prioritize a Quick Win to build momentum.";
        recommendation = `
            <div class="state-badge state-Stressed">Stressed / Overwhelmed</div>
            <h3 style="margin-bottom:12px; font-size: 1.3rem;">Intervention Activated</h3>
            <p style="margin-bottom:20px; line-height: 1.6; color: var(--text-secondary);"><strong>Action taken:</strong> ${actionPlan || defaultText}</p>
        `;
        timeLeft = 15 * 60;
        document.getElementById('timerLabel').innerText = "Gentle Focus (Stressed)";
        
    } else if (state === "Distracted") {
        const defaultText = "Having trouble focusing? Let's tighten the structure. Switching to a highly structured 20-min Pomodoro cycle.";
        recommendation = `
            <div class="state-badge state-Distracted">Distracted</div>
            <h3 style="margin-bottom:12px; font-size: 1.3rem;">Intervention Activated</h3>
            <p style="margin-bottom:20px; line-height: 1.6; color: var(--text-secondary);"><strong>Action taken:</strong> ${actionPlan || defaultText}</p>
        `;
        timeLeft = 20 * 60;
        document.getElementById('timerLabel').innerText = "Strict Pomodoro (Distracted)";
        
    } else if (state === "Engaged" || state === "Motivated") {
        const defaultText = "You're in the zone! Extended Flow State suggested. High-effort tasks are prioritized while you have the energy and momentum.";
        recommendation = `
            <div class="state-badge state-${state}">${state}</div>
            <h3 style="margin-bottom:12px; font-size: 1.3rem;">Flow State Detected</h3>
            <p style="margin-bottom:20px; line-height: 1.6; color: var(--text-secondary);"><strong>Action taken:</strong> ${actionPlan || defaultText}</p>
        `;
        timeLeft = 60 * 60;
        document.getElementById('timerLabel').innerText = "Flow State (Engaged)";
    }

    updateTimerDisplay();
    
    content.innerHTML = recommendation;
    
    // Add a little animation class to tasks to show they reordered
    const taskList = document.getElementById('taskList');
    taskList.style.opacity = '0';
    setTimeout(() => {
        renderTasks();
        taskList.style.transition = 'opacity 0.4s ease';
        taskList.style.opacity = '1';
    }, 200);
}

// Timer Logic
function updateTimerDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    document.getElementById('timerDisplay').innerText = 
        `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

document.getElementById('startTimerBtn').addEventListener('click', () => {
    if (timerRunning) {
        clearInterval(timerInterval);
        document.getElementById('startTimerBtn').innerText = 'Start';
        timerRunning = false;
    } else {
        timerInterval = setInterval(() => {
            if (timeLeft > 0) {
                timeLeft--;
                updateTimerDisplay();
            } else {
                clearInterval(timerInterval);
                timerRunning = false;
                document.getElementById('startTimerBtn').innerText = 'Start';
                alert('Time is up! Good job.');
            }
        }, 1000);
        document.getElementById('startTimerBtn').innerText = 'Pause';
        timerRunning = true;
    }
});

document.getElementById('resetTimerBtn').addEventListener('click', () => {
    clearInterval(timerInterval);
    timerRunning = false;
    document.getElementById('startTimerBtn').innerText = 'Start';
    
    const label = document.getElementById('timerLabel').innerText;
    if (label.includes('Gentle')) timeLeft = 15 * 60;
    else if (label.includes('Strict')) timeLeft = 20 * 60;
    else if (label.includes('Flow')) timeLeft = 60 * 60;
    else timeLeft = 25 * 60;
    
    updateTimerDisplay();
});

// Add Task Logic
document.getElementById('addTaskBtn').addEventListener('click', () => {
    const text = document.getElementById('newTaskInput').value.trim();
    if (!text) return;
    
    const effortSel = document.getElementById('newTaskEffort');
    const effort = effortSel.value;
    
    let type = "medium-effort";
    if (effort.includes("High")) type = "high-effort";
    if (effort.includes("Low")) type = "quick-win";
    
    const newTask = {
        id: Date.now(),
        text: text,
        effort: effort,
        type: type
    };
    
    initialTasks.push(newTask);
    currentTasks.push(newTask);
    renderTasks();
    
    document.getElementById('newTaskInput').value = '';
});
