class Metronome {
    constructor() {
        this.bpm = 120;
        this.beatsPerMeasure = 4;
        this.currentBeat = 0;
        this.isRunning = false;
        this.timer = null;
        this.tapTimes = [];
        this.soundType = 'click';
        
        // Audio context initialization
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.loadSounds();
        
        // DOM elements
        this.bpmValue = document.getElementById('bpm-value');
        this.increaseBpm = document.getElementById('increase-bpm');
        this.decreaseBpm = document.getElementById('decrease-bpm');
        this.startStopButton = document.getElementById('start-stop');
        this.tapButton = document.getElementById('tap-button');
        this.tapCount = document.getElementById('tap-count');
        this.visualizerDot = document.querySelector('.visualizer-dot');
        
        // Event listeners
        this.increaseBpm.addEventListener('click', () => this.changeBpm(5));
        this.decreaseBpm.addEventListener('click', () => this.changeBpm(-5));
        
        document.querySelectorAll('.beat-option').forEach(button => {
            button.addEventListener('click', () => this.setBeatsPerMeasure(parseInt(button.dataset.beats)));
        });
        
        document.querySelectorAll('.sound-option').forEach(button => {
            button.addEventListener('click', () => this.setSoundType(button.dataset.sound));
        });
        
        this.startStopButton.addEventListener('click', () => this.toggleStartStop());
        this.tapButton.addEventListener('click', () => this.tapTempo());
        
        // Update display
        this.updateDisplay();
    }
    
    loadSounds() {
        // Create audio buffers for different sounds
        this.sounds = {
            click: this.createClickSound(),
            wood: this.createWoodBlockSound(),
            beep: this.createBeepSound()
        };
    }
    
    createClickSound() {
        const duration = 0.05;
        const sampleRate = this.audioContext.sampleRate;
        const frameCount = Math.floor(duration * sampleRate);
        const buffer = this.audioContext.createBuffer(1, frameCount, sampleRate);
        const channelData = buffer.getChannelData(0);
        
        for (let i = 0; i < frameCount; i++) {
            const progress = i / frameCount;
            channelData[i] = Math.sin(progress * Math.PI * 20) * (1 - progress);
        }
        
        return buffer;
    }
    
    createWoodBlockSound() {
        const duration = 0.1;
        const sampleRate = this.audioContext.sampleRate;
        const frameCount = Math.floor(duration * sampleRate);
        const buffer = this.audioContext.createBuffer(1, frameCount, sampleRate);
        const channelData = buffer.getChannelData(0);
        
        for (let i = 0; i < frameCount; i++) {
            const progress = i / frameCount;
            channelData[i] = Math.random() * 0.2 * (1 - progress * 2);
        }
        
        return buffer;
    }
    
    createBeepSound() {
        const duration = 0.1;
        const sampleRate = this.audioContext.sampleRate;
        const frameCount = Math.floor(duration * sampleRate);
        const buffer = this.audioContext.createBuffer(1, frameCount, sampleRate);
        const channelData = buffer.getChannelData(0);
        
        for (let i = 0; i < frameCount; i++) {
            const progress = i / frameCount;
            channelData[i] = Math.sin(progress * Math.PI * 440 * 2) * (1 - progress);
        }
        
        return buffer;
    }
    
    playSound(isAccent) {
        const source = this.audioContext.createBufferSource();
        const gainNode = this.audioContext.createGain();
        
        source.buffer = this.sounds[this.soundType];
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        // Make the first beat louder
        if (isAccent) {
            gainNode.gain.value = 1.0;
        } else {
            gainNode.gain.value = 0.7;
        }
        
        source.start();
    }
    
    changeBpm(amount) {
        this.bpm = Math.max(20, Math.min(300, this.bpm + amount));
        this.updateDisplay();
        
        if (this.isRunning) {
            this.stop();
            this.start();
        }
    }
    
    setBeatsPerMeasure(beats) {
        this.beatsPerMeasure = beats;
        document.querySelectorAll('.beat-option').forEach(button => {
            button.dataset.active = button.dataset.beats === beats.toString();
        });
    }
    
    setSoundType(sound) {
        this.soundType = sound;
        document.querySelectorAll('.sound-option').forEach(button => {
            button.dataset.active = button.dataset.sound === sound;
        });
    }
    
    toggleStartStop() {
        if (this.isRunning) {
            this.stop();
        } else {
            this.start();
        }
    }
    
    start() {
        this.isRunning = true;
        this.currentBeat = 0;
        this.startStopButton.textContent = 'Stop';
        
        const interval = 60000 / this.bpm; // Convert BPM to milliseconds
        
        this.timer = setInterval(() => {
            this.playBeat();
        }, interval);
        
        // Play first beat immediately
        this.playBeat();
    }
    
    stop() {
        this.isRunning = false;
        this.startStopButton.textContent = 'Start';
        clearInterval(this.timer);
        this.visualizerDot.style.transform = 'translate(-50%, -50%) scale(1)';
    }
    
    playBeat() {
        const isFirstBeat = this.currentBeat === 0;
        this.playSound(isFirstBeat);
        
        // Visual feedback
        this.visualizerDot.style.transform = isFirstBeat 
            ? 'translate(-50%, -50%) scale(1.5)' 
            : 'translate(-50%, -50%) scale(1.2)';
        
        setTimeout(() => {
            this.visualizerDot.style.transform = 'translate(-50%, -50%) scale(1)';
        }, 100);
        
        this.currentBeat = (this.currentBeat + 1) % this.beatsPerMeasure;
    }
    
    tapTempo() {
        const now = Date.now();
        this.tapTimes.push(now);
        
        // Keep only the last 4 taps
        if (this.tapTimes.length > 4) {
            this.tapTimes.shift();
        }
        
        if (this.tapTimes.length > 1) {
            const intervals = [];
            for (let i = 1; i < this.tapTimes.length; i++) {
                intervals.push(this.tapTimes[i] - this.tapTimes[i - 1]);
            }
            
            const averageInterval = intervals.reduce((sum, val) => sum + val, 0) / intervals.length;
            const newBpm = Math.round(60000 / averageInterval);
            
            // Only update if the new BPM is reasonable
            if (newBpm >= 20 && newBpm <= 300) {
                this.bpm = newBpm;
                this.updateDisplay();
                
                if (this.isRunning) {
                    this.stop();
                    this.start();
                }
            }
        }
        
        this.updateTapCount();
    }
    
    updateTapCount() {
        const tapsNeeded = Math.max(0, 4 - this.tapTimes.length);
        this.tapCount.textContent = tapsNeeded > 0 
            ? `Tap ${tapsNeeded} more time${tapsNeeded > 1 ? 's' : ''} to set tempo` 
            : 'Tempo set!';
        
        // Reset message after 2 seconds
        if (tapsNeeded === 0) {
            setTimeout(() => {
                this.tapCount.textContent = 'Tap 4 times to set tempo';
            }, 2000);
        }
    }
    
    updateDisplay() {
        this.bpmValue.textContent = this.bpm;
    }
}

// Initialize the metronome when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    new Metronome();
});