document.addEventListener('DOMContentLoaded', () => {
    const noInsightState = document.getElementById('noInsightState');
    const insightState = document.getElementById('insightState');
    
    const insightReason = document.getElementById('insightReason');
    const coachRecommendation = document.getElementById('coachRecommendation');
    const clearInsightBtn = document.getElementById('clearInsightBtn');

    // Load insight from localStorage
    const storedInsight = localStorage.getItem('ifocus_telemetry_insight');
    
    if (storedInsight) {
        try {
            const data = JSON.parse(storedInsight);
            
            noInsightState.classList.add('hidden');
            insightState.classList.remove('hidden');

            insightReason.textContent = data.reason;
            if (coachRecommendation && data.actionPlan) {
                coachRecommendation.textContent = data.actionPlan;
            }

        } catch (e) {
            console.error("Error parsing telemetry data", e);
        }
    } else {
        noInsightState.classList.remove('hidden');
        insightState.classList.add('hidden');
    }

    if (clearInsightBtn) {
        clearInsightBtn.addEventListener('click', () => {
            localStorage.removeItem('ifocus_telemetry_insight');
            noInsightState.classList.remove('hidden');
            insightState.classList.add('hidden');
        });
    }
});
