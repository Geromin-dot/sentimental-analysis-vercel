/**
 * Keystroke Telemetry Engine
 * Monitors typing dynamics to detect stress/frustration through erratic typing.
 */

document.addEventListener('DOMContentLoaded', () => {
    const inputField = document.getElementById('reflectionInput');
    if (!inputField) return;

    let keydownTimes = {};
    let lastKeyupTime = null;
    
    // Metrics
    let dwellTimes = []; // Time a key is held down
    let flightTimes = []; // Time between keys
    let backspaceCount = 0;
    let totalKeystrokes = 0;

    let anomalyTriggered = false;

    inputField.addEventListener('keydown', (e) => {
        if (anomalyTriggered) return;

        const now = performance.now();
        
        // Don't track if they hold down a key (autorepeat)
        if (!e.repeat) {
            keydownTimes[e.code] = now;
        }

        if (e.key === 'Backspace' || e.key === 'Delete') {
            backspaceCount++;
        }

        totalKeystrokes++;

        checkAnomalies();
    });

    inputField.addEventListener('keyup', (e) => {
        if (anomalyTriggered) return;

        const now = performance.now();
        
        if (keydownTimes[e.code]) {
            const dwell = now - keydownTimes[e.code];
            if (dwell > 0 && dwell < 2000) { // filter out extreme outliers (e.g., leaving desk)
                dwellTimes.push(dwell);
                if (dwellTimes.length > 20) dwellTimes.shift(); // Rolling window
            }
            delete keydownTimes[e.code];
        }

        if (lastKeyupTime) {
            const flight = now - lastKeyupTime;
            if (flight >= 0 && flight < 2000) {
                flightTimes.push(flight);
                if (flightTimes.length > 20) flightTimes.shift(); // Rolling window
            }
        }
        
        lastKeyupTime = now;
    });

    function checkAnomalies() {
        if (totalKeystrokes < 10) return; // Need a smaller baseline

        // Calculate averages over the rolling window
        const avgDwell = dwellTimes.reduce((a, b) => a + b, 0) / (dwellTimes.length || 1);
        const avgFlight = flightTimes.reduce((a, b) => a + b, 0) / (flightTimes.length || 1);
        const backspaceRatio = backspaceCount / totalKeystrokes;

        // Update Debug UI
        const debugUI = document.getElementById('telemetryDebug');
        if (debugUI) {
            debugUI.textContent = `Flight: ${Math.round(avgFlight)}ms | Dwell: ${Math.round(avgDwell)}ms | BS: ${Math.round(backspaceRatio*100)}%`;
        }

        // Anomaly logic
        let anomalyDetected = false;
        let anomalyReason = "";

        if (backspaceRatio > 0.40) { 
            anomalyDetected = true;
            anomalyReason = "High deletion frequency detected. More than 40% of your keystrokes were backspaces, which strongly correlates with cognitive friction or frustration.";
        } else if (avgFlight < 60) { 
            anomalyDetected = true;
            anomalyReason = "Erratic typing cadence detected (Flight time: " + Math.round(avgFlight) + "ms). This hyper-velocity pattern indicates you are hitting multiple keys simultaneously, suggesting acute stress or agitation.";
        } else if (avgFlight < 100 && backspaceRatio > 0.20) { 
            anomalyDetected = true;
            anomalyReason = "Rushed, error-prone typing detected. A combination of very fast typing (Flight time: " + Math.round(avgFlight) + "ms) and high correction rate suggests you might be feeling overwhelmed.";
        } else if (avgDwell > 350) { 
            anomalyDetected = true;
            anomalyReason = "Heavy keystroke dwell time detected (" + Math.round(avgDwell) + "ms). Prolonged key-presses indicate hesitation, mental fatigue, or a distracted cognitive state.";
        }

        if (anomalyDetected) {
            anomalyTriggered = true;
            console.log("Telemetry Anomaly Triggered:", anomalyReason, { avgFlight, avgDwell, backspaceRatio });
            triggerTelemetryAlert(anomalyReason, avgDwell, avgFlight, backspaceRatio);
        }
    }

    function triggerTelemetryAlert(reason, dwell, flight, bsRatio) {
        // Save to local storage for the Coach dashboard
        const telemetryData = {
            timestamp: new Date().toISOString(),
            reason: reason,
            metrics: {
                dwellTime: Math.round(dwell),
                flightTime: Math.round(flight),
                errorRate: Math.round(bsRatio * 100)
            }
        };
        localStorage.setItem('ifocus_telemetry_insight', JSON.stringify(telemetryData));

        // Show toast alert
        const toast = document.getElementById('telemetryToast');
        if (toast) {
            toast.classList.remove('hidden');
            toast.style.display = 'block'; // Force display just in case
            
            // Force browser reflow to ensure transition works
            void toast.offsetWidth;
            
            toast.classList.add('show');
        }
    }
});
