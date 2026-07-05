document.addEventListener('DOMContentLoaded', () => {
    // Only show the mini-timer if we are NOT on the command-center page where the main timer is
    if (document.getElementById('timerDisplay')) return;

    // Create the mini-timer UI
    const timerDiv = document.createElement('div');
    timerDiv.id = 'globalMiniTimer';
    timerDiv.style.position = 'fixed';
    timerDiv.style.top = '1.5rem';
    timerDiv.style.right = '1.5rem';
    timerDiv.style.background = 'rgba(255, 255, 255, 0.9)';
    timerDiv.style.backdropFilter = 'blur(10px)';
    timerDiv.style.border = '1px solid var(--glass-border, rgba(0,0,0,0.1))';
    timerDiv.style.padding = '0.5rem 1rem';
    timerDiv.style.borderRadius = '20px';
    timerDiv.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
    timerDiv.style.zIndex = '9999';
    timerDiv.style.fontFamily = 'monospace';
    timerDiv.style.fontSize = '1.1rem';
    timerDiv.style.fontWeight = 'bold';
    timerDiv.style.color = 'var(--text-primary, #1f2937)';
    timerDiv.style.display = 'none';
    timerDiv.style.alignItems = 'center';
    timerDiv.style.gap = '0.5rem';
    timerDiv.style.cursor = 'pointer';
    timerDiv.title = 'Click to return to focus session';
    document.body.appendChild(timerDiv);

    // Click to go back to command center
    timerDiv.addEventListener('click', () => {
        window.location.href = 'command-center.html';
    });

    // Add pulse animation for the active indicator dot
    if (!document.getElementById('miniTimerStyles')) {
        const style = document.createElement('style');
        style.id = 'miniTimerStyles';
        style.innerHTML = `@keyframes pulse-timer { 0% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(0.9); } 100% { opacity: 1; transform: scale(1); } }`;
        document.head.appendChild(style);
    }

    function updateGlobalTimer() {
        const saved = localStorage.getItem('ifocus_timer_state');
        if (!saved) {
            timerDiv.style.display = 'none';
            return;
        }
        
        try {
            const state = JSON.parse(saved);
            // Only show if the timer is actively running and we have a target end time
            if (state.isRunning && state.targetEndTime) {
                const now = Date.now();
                let left = Math.floor((state.targetEndTime - now) / 1000);
                if (left < 0) left = 0;
                
                const minutes = Math.floor(left / 60);
                const seconds = left % 60;
                
                const dotColor = state.isBreak ? '#34d399' : '#f87171'; // Green for break, Red/Orange for work
                
                timerDiv.innerHTML = `
                    <div style="width: 8px; height: 8px; border-radius: 50%; background: ${dotColor}; animation: pulse-timer 2s infinite;"></div>
                    ${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}
                `;
                timerDiv.style.display = 'flex';
            } else {
                timerDiv.style.display = 'none';
            }
        } catch (e) {
            console.error("Error reading global timer state:", e);
            timerDiv.style.display = 'none';
        }
    }

    // Run every second
    setInterval(updateGlobalTimer, 1000);
    updateGlobalTimer(); // initial call
});
