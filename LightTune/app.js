// Constants
const NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const A4_FREQUENCY = 440; // Reference frequency for A4
const C2_FREQUENCY = 65.41; // C2 note frequency in Hz
const SAMPLE_LENGTH_MS = 100; // Audio sample length in milliseconds
const CONFIDENCE_THRESHOLD = 10; // Minimum confidence threshold for detection

// DOM Elements
const noteNameElement = document.getElementById('note-name');
const frequencyElement = document.getElementById('frequency');
const needleElement = document.getElementById('needle');
const toggleMicrophoneBtn = document.getElementById('toggle-microphone');
const playReferenceBtn = document.getElementById('play-reference');

// Audio Context and Nodes
let audioContext;
let microphone;
let scriptProcessor;
let recording = false;
let testFrequencies = [];
let correlationWorker;

// Reference tone
let referenceOscillator;
let referenceGain;
let isPlayingReference = false;

// Initialize the application
function init() {
    // Generate test frequencies
    generateTestFrequencies();
    
    // Setup correlation worker
    setupCorrelationWorker();
    
    // Setup event listeners
    toggleMicrophoneBtn.addEventListener('click', toggleMicrophone);
    playReferenceBtn.addEventListener('click', toggleReferenceTone);
    
    // Initialize audio context on user interaction
    document.body.addEventListener('click', initAudioContext, { once: true });
}

// Generate test frequencies for all notes
function generateTestFrequencies() {
    testFrequencies = [];
    
    for (let i = 0; i < 30; i++) {
        const noteFrequency = C2_FREQUENCY * Math.pow(2, i / 12);
        const noteName = NOTES[i % 12];
        const octave = Math.floor(i / 12) + 2;
        
        const note = { 
            frequency: noteFrequency, 
            name: `${noteName}${octave}`,
            cents: 0
        };
        
        const justAbove = { 
            frequency: noteFrequency * Math.pow(2, 1 / 48), 
            name: `${noteName}${octave}`,
            cents: 25
        };
        
        const justBelow = { 
            frequency: noteFrequency * Math.pow(2, -1 / 48), 
            name: `${noteName}${octave}`,
            cents: -25
        };
        
        testFrequencies = testFrequencies.concat([justBelow, note, justAbove]);
    }
}

// Setup the correlation worker
function setupCorrelationWorker() {
    correlationWorker = new Worker("js/correlation-worker.js");
    correlationWorker.onmessage = interpretCorrelationResult;
}

// Initialize audio context
function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
}

// Toggle microphone access
function toggleMicrophone() {
    if (recording) {
        stopRecording();
        toggleMicrophoneBtn.innerHTML = '<span class="icon">🎤</span><span class="text">Start Tuning</span>';
        toggleMicrophoneBtn.classList.remove('tuning-active');
    } else {
        startRecording();
        toggleMicrophoneBtn.innerHTML = '<span class="icon">🔴</span><span class="text">Stop Tuning</span>';
        toggleMicrophoneBtn.classList.add('tuning-active');
    }
}

// Start recording from microphone
function startRecording() {
    initAudioContext();
    
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
            recording = true;
            setupAudioProcessing(stream);
        })
        .catch(error => {
            console.error('Error accessing microphone:', error);
            alert('Could not access microphone. Please ensure you have granted permission.');
            recording = false;
            toggleMicrophoneBtn.innerHTML = '<span class="icon">🎤</span><span class="text">Start Tuning</span>';
            toggleMicrophoneBtn.classList.remove('tuning-active');
        });
}

// Stop recording
function stopRecording() {
    if (microphone && microphone.mediaStream) {
        microphone.mediaStream.getTracks().forEach(track => track.stop());
    }
    if (scriptProcessor) {
        scriptProcessor.disconnect();
    }
    recording = false;
}

// Setup audio processing
function setupAudioProcessing(stream) {
    microphone = audioContext.createMediaStreamSource(stream);
    scriptProcessor = audioContext.createScriptProcessor(1024, 1, 1);
    
    scriptProcessor.connect(audioContext.destination);
    microphone.connect(scriptProcessor);
    
    let buffer = [];
    let isProcessing = false;
    
    scriptProcessor.onaudioprocess = function(event) {
        if (!recording || isProcessing) return;
        
        buffer = buffer.concat(Array.from(event.inputBuffer.getChannelData(0)));
        
        if (buffer.length > SAMPLE_LENGTH_MS * audioContext.sampleRate / 1000) {
            isProcessing = true;
            
            correlationWorker.postMessage({
                timeseries: buffer,
                test_frequencies: testFrequencies,
                sample_rate: audioContext.sampleRate
            });
            
            buffer = [];
            setTimeout(() => { isProcessing = false; }, 250);
        }
    };
}

// Interpret correlation results
function interpretCorrelationResult(event) {
    const frequencyAmplitudes = event.data.frequency_amplitudes;
    
    // Compute magnitudes
    const magnitudes = frequencyAmplitudes.map(z => z[0] * z[0] + z[1] * z[1]);
    
    // Find the maximum magnitude
    let maxIndex = -1;
    let maxMagnitude = 0;
    magnitudes.forEach((mag, i) => {
        if (mag > maxMagnitude) {
            maxIndex = i;
            maxMagnitude = mag;
        }
    });
    
    // Compute average magnitude
    const average = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;
    const confidence = maxMagnitude / average;
    
    if (confidence > CONFIDENCE_THRESHOLD && maxIndex >= 0) {
        const dominantFrequency = testFrequencies[maxIndex];
        updateDisplay(dominantFrequency);
    }
}

// Update the display with the detected note
function updateDisplay(note) {
    noteNameElement.textContent = note.name;
    frequencyElement.textContent = `${note.frequency.toFixed(2)} Hz`;
    
    // Update needle position based on cents (-25 to 25)
    const cents = note.cents;
    const percentage = 50 + (cents * 2); // Convert -25..25 to 0..100
    needleElement.style.transform = `translateX(-50%) translateX(${percentage - 50}%)`;
    
    // Color coding
    if (Math.abs(cents) < 5) {
        needleElement.style.backgroundColor = '#4CAF50'; // Green for in tune
    } else {
        needleElement.style.backgroundColor = '#F44336'; // Red for out of tune
    }
}

// Toggle reference tone
function toggleReferenceTone() {
    if (isPlayingReference) {
        stopReferenceTone();
        playReferenceBtn.innerHTML = '<span class="icon">🔊</span><span class="text">Play A4 (440Hz)</span>';
    } else {
        playReferenceTone();
        playReferenceBtn.innerHTML = '<span class="icon">🔇</span><span class="text">Stop A4</span>';
    }
}

// Play reference tone (A4 - 440Hz)
function playReferenceTone() {
    initAudioContext();
    
    referenceOscillator = audioContext.createOscillator();
    referenceGain = audioContext.createGain();
    
    referenceOscillator.type = 'sine';
    referenceOscillator.frequency.value = A4_FREQUENCY;
    referenceGain.gain.value = 0.1;
    
    referenceOscillator.connect(referenceGain);
    referenceGain.connect(audioContext.destination);
    
    referenceOscillator.start();
    isPlayingReference = true;
}

// Stop reference tone
function stopReferenceTone() {
    if (referenceGain) {
        referenceGain.gain.setValueAtTime(referenceGain.gain.value, audioContext.currentTime);
        referenceGain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);
        
        setTimeout(() => {
            if (referenceOscillator) {
                referenceOscillator.stop();
                referenceOscillator.disconnect();
                referenceOscillator = null;
            }
            if (referenceGain) {
                referenceGain.disconnect();
                referenceGain = null;
            }
        }, 500);
    }
    isPlayingReference = false;
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', init);