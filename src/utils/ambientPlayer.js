/**
 * Soulful Space Ambient Player Utility
 * Synthesizes continuous ambient background music using the Web Audio API.
 * Handles playback state, volume, and mute persistence.
 */

// Module-scoped variables to hold the state and audio nodes
let audioContext = null;      // The main 'engine' for Web Audio processing.
let masterGain = null;        // A GainNode to control the overall volume.
let analyser = null;          // An AnalyserNode to extract data for visualization.
let activeOscillators = [];   // Array to keep track of currently playing sound sources (oscillators, buffers).
let activeTimers = [];        // Array to keep track of scheduled actions (setTimeout IDs).
let isMuted = false;          // Tracks the mute state.
let currentVolume = 0.7;      // Tracks the current volume level (0.0 to 1.0).
let isPlaying = false;        // Tracks if audio generation is currently active.
let heartbeatEnabled = false; // State for the new heartbeat generator.
let arpeggiatorEnabled = false; // State for the new arpeggiator generator.
let currentPadChordNotes = []; // Store the notes of the *current* pad chord for the arpeggiator

// --- Configuration State ---
// These variables hold the user-configurable parameters for the sounds.
let padOscType = 'triangle'; // Pad oscillator type (e.g., 'sine', 'triangle').
let padFilterFreq = 2000;   // Pad filter cutoff frequency (Hz). Lower values = darker sound.
let chordSpeedMs = 12000;   // Time between pad chord changes (milliseconds).

// --- Note/Chord Data (Constants) ---
// These define the musical elements for the ambient soundscape
const notes = [196.00, 233.08, 261.63, 293.66, 311.13, 349.23, 392.00, 415.30, 466.16, 523.25, 587.33, 622.25, 698.46]; // G Minor scale notes
const chords = [ [notes[0], notes[2], notes[6]], [notes[2], notes[5], notes[9]], [notes[4], notes[7], notes[11]], [notes[3], notes[8], notes[10]] ]; // Chord progression
const bassNotes = [notes[0] / 2, notes[2] / 2, notes[4] / 2, notes[3] / 2]; // Bass notes (octave lower)
const phrases = [ [notes[6], notes[8], notes[9], notes[6]], [notes[9], notes[6], notes[5], notes[2]], [notes[5], notes[6], notes[8], notes[9], notes[8]], [notes[8], notes[6], notes[4], notes[3]] ]; // Melodic phrases

// --- Initialization ---
/**
 * Initializes the Web Audio API AudioContext and main nodes.
 * Should be called once, preferably after a user interaction (like a button click).
 * Returns the necessary nodes for external use (like visualization).
 */
export function initAudio() {
  if (audioContext !== null) {
    // AudioContext already exists, just ensure it's running.
    if (audioContext.state === 'suspended') {
      // If the context was suspended (e.g., by the browser), try resuming it.
      audioContext.resume().catch(e => console.error("Ambient Audio: Error resuming context", e));
    }
    return { audioContext, masterGain, analyser }; // Return existing nodes.
  }

  try {
    // Create the core AudioContext. Handles audio processing graph.
    // (window.AudioContext || window.webkitAudioContext) provides cross-browser compatibility.
    audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // Create a GainNode: controls volume. Think of it as a volume knob.
    masterGain = audioContext.createGain();

    // Create an AnalyserNode: provides frequency/time domain data, used for visuals.
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024; // Affects resolution of frequency data (power of 2).

    // Connect nodes: masterGain -> analyser -> audio output (speakers).
    // This means all sound goes through the master volume, then the analyser, then to the speakers.
    masterGain.connect(analyser);
    analyser.connect(audioContext.destination); // 'destination' is the final output (speakers).

    // --- Load Persistent State ---
    // Attempt to load saved mute/volume settings from the browser's localStorage.
    isMuted = localStorage.getItem('ambientMuted') === 'true';
    const savedVolume = localStorage.getItem('ambientVolume');
    currentVolume = savedVolume !== null ? parseFloat(savedVolume) : 0.7;

    // Set the gain node's initial volume based on loaded/default state.
    // gain.value sets the volume instantly (0 = silent, 1 = full volume).
    masterGain.gain.value = isMuted ? 0 : currentVolume;

    console.log(`Ambient Audio Initialized. State: ${audioContext.state}, Muted: ${isMuted}, Volume: ${currentVolume}`);

    // --- Handle Initial Context State ---
    // Browsers often start AudioContext in a 'suspended' state to prevent unwanted audio.
    // It must be resumed after user interaction (e.g., button click).
    // We attempt to resume it here too, in case the browser allows it immediately.
    if (audioContext.state === 'suspended') {
      console.log("Ambient Audio: Context suspended, attempting initial resume...");
      // resume() returns a Promise, but we don't strictly need to wait for it here.
      audioContext.resume().catch(e => console.error("Ambient Audio: Error resuming context post-init", e));
    }

    // Return the created nodes for the UI to use.
    return { audioContext, masterGain, analyser };

  } catch (e) {
    console.error("Ambient Audio: Web Audio API not supported or initialization failed.", e);
    audioContext = null; masterGain = null; analyser = null; // Nullify nodes on failure.
    return null;
  }
}

// --- Sound Creation Functions (Internal - not exported) ---

// Creates the slowly evolving background pad sound using Oscillators and Filters.
function createPad() {
  if (!audioContext || !masterGain || !isPlaying) return; // Check prerequisites.
  console.log(`Creating Pad (Type: ${padOscType}, Filter: ${padFilterFreq}Hz, Speed: ${chordSpeedMs}ms)...`);
  let chordIndex = Math.floor(Math.random() * chords.length);

  const chordProgression = () => {
      if (!isPlaying || !audioContext) return; // Stop scheduling if paused/stopped.

      const previousChordNotes = [...currentPadChordNotes]; // Store previous notes (create copy)
      currentPadChordNotes = chords[chordIndex]; // *** STORE CURRENT CHORD NOTES ***
      const chordChanged = JSON.stringify(previousChordNotes) !== JSON.stringify(currentPadChordNotes);
      chordIndex = (chordIndex + 1) % chords.length;

      // --- Cleanup Previous Pad Notes ---
      // Filter through active oscillators, find previous pad notes, fade them out, and remove them.
      activeOscillators = activeOscillators.filter(({ osc, gain, type }) => {
          if (type === 'pad') {
              const now = audioContext.currentTime; // Get the precise current audio time.
              try {
                  // Smoothly ramp down the volume (gain) of the old pad note.
                  gain.gain.cancelScheduledValues(now); // Stop any previous volume changes.
                  gain.gain.setValueAtTime(gain.gain.value, now); // Start ramp from current volume.
                  gain.gain.linearRampToValueAtTime(0.0001, now + 4); // Fade to near-silence over 4 seconds.

                  // Schedule the oscillator to stop playing shortly after the fade completes.
                  osc.stop(now + 4.1);
              } catch (e) { console.warn("Error fading out pad oscillator", e); }
              return false; // Remove this oscillator from the active list.
          }
          return true; // Keep non-pad oscillators.
      });

      // --- Create New Pad Notes for Current Chord ---
      currentPadChordNotes.forEach(freq => {
          // Create the audio nodes for this note.
          const osc = audioContext.createOscillator(); // Generates a periodic waveform (sound tone).
          const gain = audioContext.createGain();       // Controls the volume of this specific oscillator.
          const osc2 = audioContext.createOscillator(); // Second oscillator for richness (detuned).
          const gain2 = audioContext.createGain();
          const filter = audioContext.createBiquadFilter(); // Filters frequencies (here, a lowpass).

          // --- Configure Nodes ---
          const validOscTypes = ['sine', 'square', 'sawtooth', 'triangle'];
          osc.type = validOscTypes.includes(padOscType) ? padOscType : 'triangle'; // Set waveform type from parameter.
          osc.frequency.value = freq; // Set the pitch (frequency) of the main oscillator.

          osc2.type = 'sine'; // Use sine for the detuned oscillator.
          osc2.frequency.value = freq * 1.003; // Set pitch slightly different (detuned).

          filter.type = 'lowpass'; // Only allows frequencies *below* the cutoff frequency.
          filter.frequency.value = padFilterFreq; // Set cutoff frequency from parameter.
          filter.Q.value = 1; // Controls the resonance/peak at the cutoff frequency.

          // --- Connect Nodes (Audio Routing) ---
          // osc -> gain -> filter -> masterGain
          // osc2 -> gain2 -> filter -> masterGain
          osc.connect(gain); osc2.connect(gain2);
          gain.connect(filter); gain2.connect(filter);
          filter.connect(masterGain); // Connect the filter output to the main volume control.

          // --- Schedule Volume Envelope (Fade-in) ---
          const now = audioContext.currentTime;
          const targetGain = 0.08;
          gain.gain.setValueAtTime(0, now); // Start silent.
          gain.gain.linearRampToValueAtTime(targetGain, now + 4); // Fade in volume over 4 seconds.
          gain2.gain.setValueAtTime(0, now);
          gain2.gain.linearRampToValueAtTime(targetGain * 0.75, now + 4.5);

          // --- Start Oscillators --- 
          // Oscillators must be explicitly started.
          osc.start(now); // Start playing immediately.
          osc2.start(now);

          // --- Track Active Nodes --- 
          // Add these new oscillators/gains to our tracking array for cleanup later.
          activeOscillators.push({ osc, gain, type: 'pad' });
          activeOscillators.push({ osc: osc2, gain: gain2, type: 'pad' });
      });

      // --- Schedule Next Chord Change ---
      // Use setTimeout to schedule the *next* call to this chordProgression function.
      const nextChange = chordSpeedMs + Math.random() * (chordSpeedMs * 0.2); // Use parameter + slight variation.
      console.log(`Next pad change scheduled in ${nextChange.toFixed(0)}ms`);
      const timerId = setTimeout(chordProgression, nextChange);
      activeTimers.push(timerId); // Track the timer ID so we can cancel it if needed (e.g., on stop).

      // --- Trigger Arpeggiator Update --- 
      // If the arpeggiator is enabled and the chord actually changed,
      // stop the old arpeggio sequence and start a new one with the new chord notes.
      if (arpeggiatorEnabled && chordChanged) {
         console.log("Chord changed, updating arpeggio.");
         stopArpeggioSequence(); // Helper function to stop current sequence
         createArpeggio(); // Start new sequence with currentPadChordNotes
      }
  };
  // Initialize currentPadChordNotes before first call
  currentPadChordNotes = chords[chordIndex];
  chordProgression(); // Call the function once to start the first chord.
}

// Creates the deep, 808-style bassline.
function createBassline() {
    if (!audioContext || !masterGain || !isPlaying) return;
    console.log("Creating Bassline...");
    let noteIndex = Math.floor(Math.random() * bassNotes.length);

    const playBassNote = () => {
        if (!isPlaying || !audioContext) return;
        const freq = bassNotes[noteIndex];
        noteIndex = (noteIndex + 1) % bassNotes.length;

        // --- Create Nodes ---
        const osc = audioContext.createOscillator(); const gain = audioContext.createGain();
        const subOsc = audioContext.createOscillator(); const subGain = audioContext.createGain();
        const distortion = audioContext.createWaveShaper(); // Adds harmonic distortion for warmth/character.

        // --- Configure Distortion ---
        // This function creates a specific curve shape for the WaveShaperNode.
        function makeDistortionCurve(amount) { const k = amount; const n_samples = 44100; const curve = new Float32Array(n_samples); const deg = Math.PI / 180; for (let i = 0; i < n_samples; ++i) { const x = i * 2 / n_samples - 1; curve[i] = (3 + k) * x * 20 * deg / (Math.PI + k * Math.abs(x)); } return curve; }
        distortion.curve = makeDistortionCurve(2);
        distortion.oversample = '4x'; // Improves quality by reducing aliasing.

        // --- Configure Oscillators ---
        osc.type = 'sine'; osc.frequency.value = freq;
        subOsc.type = 'sine'; subOsc.frequency.value = freq / 2; // Sub-bass oscillator.

        // --- Connect Nodes ---
        // Both oscillators feed into the distortion, which then feeds into the master gain.
        osc.connect(gain); subOsc.connect(subGain);
        gain.connect(distortion); subGain.connect(distortion); distortion.connect(masterGain);

        // --- Schedule Volume Envelope (808 Style: quick attack, hold, long decay) ---
        const now = audioContext.currentTime;
        const targetGain = 0.15; const subTargetGain = 0.1;
        // Main oscillator envelope:
        gain.gain.setValueAtTime(0, now);                     // Start silent.
        gain.gain.linearRampToValueAtTime(targetGain, now + 0.1); // Quick attack.
        gain.gain.linearRampToValueAtTime(targetGain * 0.5, now + 1); // Decay slightly.
        gain.gain.exponentialRampToValueAtTime(0.001, now + 6); // Long exponential release.
        // Sub oscillator envelope (similar, slightly different timing):
        subGain.gain.setValueAtTime(0, now);
        subGain.gain.linearRampToValueAtTime(subTargetGain, now + 0.15);
        subGain.gain.exponentialRampToValueAtTime(0.001, now + 7);

        // --- Start & Stop Oscillators ---
        osc.start(now);
        subOsc.start(now);
        // Schedule stop times matching the end of their envelopes.
        osc.stop(now + 7);
        subOsc.stop(now + 7);

        // --- Schedule Next Bass Note ---
        const nextTime = 6000 + Math.random() * 2000;
        const timerId = setTimeout(playBassNote, nextTime);
        activeTimers.push(timerId);
    };
    // Start the first bass note after a delay.
    const startTimerId = setTimeout(playBassNote, 4000);
    activeTimers.push(startTimerId);
}

// Creates sparse, emotional melody fragments with a delay effect.
function createMelody() {
    if (!audioContext || !masterGain || !isPlaying) return;
    console.log("Creating Melody...");
    let phraseIndex = Math.floor(Math.random() * phrases.length);

    const playPhrase = () => {
        if (!isPlaying || !audioContext) return;
        const currentPhrase = phrases[phraseIndex];
        phraseIndex = (phraseIndex + 1) % phrases.length;

        // Schedule each note in the phrase.
        currentPhrase.forEach((freq, i) => {
            const noteTimeout = setTimeout(() => {
                if (!isPlaying || !audioContext) return; // Double-check playback state.

                // --- Create Nodes ---
                const osc = audioContext.createOscillator(); const gain = audioContext.createGain();
                // DelayNode creates an echo/reverb effect.
                const delay = audioContext.createDelay(1.0); // Max delay time.
                const delayGain = audioContext.createGain(); // Controls volume of the echo.

                // --- Configure Delay ---
                delay.delayTime.value = 0.5; // Echo repeats after 0.5 seconds.
                delayGain.gain.value = 0.4; // Echo volume (40% of original).

                // --- Configure Oscillator ---
                osc.type = 'sine'; osc.frequency.value = freq;

                // --- Connect Nodes (Dry + Wet Signal) ---
                // Dry signal path: osc -> gain -> masterGain
                // Wet signal path: gain -> delay -> delayGain -> masterGain
                osc.connect(gain);
                gain.connect(masterGain);      // Connect dry signal to output.
                gain.connect(delay);           // Also send signal to delay.
                delay.connect(delayGain);       // Connect delay output to its volume control.
                delayGain.connect(masterGain);   // Connect wet (echo) signal to output.

                // --- Schedule Volume Envelope --- 
                const now = audioContext.currentTime;
                const targetGain = 0.18;
                gain.gain.setValueAtTime(0, now);
                gain.gain.linearRampToValueAtTime(targetGain, now + 0.1);      // Quick rise
                gain.gain.linearRampToValueAtTime(targetGain * 0.55, now + 0.3);   // Slight fall
                gain.gain.linearRampToValueAtTime(0.001, now + 3);                 // Release

                // --- Start & Stop Oscillator --- 
                osc.start(now);
                osc.stop(now + 3); // Stop after envelope.

                // --- Track Active Nodes ---
                activeOscillators.push({ osc, gain, type: 'melody' });

                // --- Schedule Self-Cleanup --- 
                // Remove this specific oscillator from tracking array after it should have stopped.
                const cleanupTimer = setTimeout(() => {
                     activeOscillators = activeOscillators.filter(item => item.osc !== osc);
                 }, 3100);
                 activeTimers.push(cleanupTimer);

            }, i * (800 + Math.random() * 200)); // Schedule note with slight timing variation.
            activeTimers.push(noteTimeout);
        });

        // --- Schedule Next Phrase ---
        const nextTime = 10000 + (Math.random() * 5000);
        const timerId = setTimeout(playPhrase, nextTime);
        activeTimers.push(timerId);
    };
    // Start the first phrase after a longer delay.
    const firstPhraseTimer = setTimeout(playPhrase, 8000);
    activeTimers.push(firstPhraseTimer);
}

// Creates a subtle background noise texture using an AudioBufferSourceNode.
function createTexture() {
    if (!audioContext || !masterGain || !isPlaying) return;
    if (activeOscillators.some(item => item.type === 'texture')) return; // Prevent duplicates.
    console.log("Creating Texture...");

    // --- Create Noise Buffer ---
    const bufferSize = audioContext.sampleRate * 4; // 4 seconds buffer duration.
    // Create an empty stereo audio buffer.
    const buffer = audioContext.createBuffer(2, bufferSize, audioContext.sampleRate);

    // --- Fill Buffer with Generated Noise ---
    for (let channel = 0; channel < 2; channel++) {
        const data = buffer.getChannelData(channel); // Get data array for the channel.
        let lastValue = 0;
        for (let i = 0; i < bufferSize; i++) {
            // Generate 'brown-ish' noise using a simple filter.
            const white = Math.random() * 2 - 1; data[i] = (lastValue + (0.02 * white)) / 1.02; lastValue = data[i] * 0.97;
            // Add occasional 'vinyl crackle'.
            if (Math.random() > 0.9995) { /* ... crackle generation logic ... */ }
            data[i] *= 0.3; // Reduce amplitude.
        }
    }

    // --- Create Nodes --- 
    // AudioBufferSourceNode plays back audio data from an AudioBuffer.
    const noiseSource = audioContext.createBufferSource();
    noiseSource.buffer = buffer; // Assign the generated noise buffer.
    noiseSource.loop = true;     // Make the noise loop continuously.

    const filter = audioContext.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 3000; filter.Q.value = 0.7;
    const gain = audioContext.createGain(); gain.gain.value = 0.03; // Very quiet.

    // --- Connect Nodes --- 
    noiseSource.connect(filter); filter.connect(gain); gain.connect(masterGain);

    // --- Start Playback --- 
    noiseSource.start(); // Start playing the noise buffer.

    // --- Track Active Node --- 
    activeOscillators.push({ osc: noiseSource, gain, type: 'texture' });
}

/**
 * Creates a subtle, rhythmic heartbeat pulse using a low-frequency oscillator
 * with a sharp volume envelope.
 */
function createHeartbeat() {
    if (!audioContext || !masterGain || !isPlaying || !heartbeatEnabled) return; // Check prerequisites & enabled state
    console.log("Creating Heartbeat...");

    const beatIntervalSeconds = 3.0; // Time between heartbeat pairs (e.g., 3 seconds)
    const secondBeatDelay = 0.35; // Time between the two beats in a pair
    const baseFreq = 60; // Low frequency for the kick sound (Hz)
    const targetGain = 0.15; // Peak volume of the kick
    const envelopeDuration = 0.2; // How long the kick sound lasts

    const playBeatPair = () => {
        if (!isPlaying || !audioContext || !heartbeatEnabled) return; // Stop scheduling if disabled or stopped

        const playSingleBeat = (startTimeOffset) => {
            if (!isPlaying || !audioContext) return; // Check again before playing
            const now = audioContext.currentTime;
            const startTime = now + startTimeOffset;

            // Create oscillator and gain for the beat
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();

            osc.type = 'triangle'; // Triangle or sine works well for low kicks
            osc.frequency.value = baseFreq;
            // Optional: Pitch drop for a more kick-like sound
            osc.frequency.setValueAtTime(baseFreq * 1.5, startTime);
            osc.frequency.exponentialRampToValueAtTime(baseFreq, startTime + 0.05);

            // Connect nodes: osc -> gain -> masterGain
            osc.connect(gain);
            gain.connect(masterGain);

            // Very short envelope: quick attack, fast decay
            gain.gain.setValueAtTime(0, startTime);
            gain.gain.linearRampToValueAtTime(targetGain, startTime + 0.01); // Very fast attack
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + envelopeDuration); // Fast decay

            osc.start(startTime);
            osc.stop(startTime + envelopeDuration + 0.1); // Stop shortly after envelope

            // Track this beat momentarily for stop cleanup (optional but good practice)
            activeOscillators.push({ osc, gain, type: 'heartbeat' });
            const cleanupTimer = setTimeout(() => {
                activeOscillators = activeOscillators.filter(item => item.osc !== osc);
            }, (startTimeOffset + envelopeDuration + 0.2) * 1000); // Convert to ms
            activeTimers.push(cleanupTimer);
        }

        // Play the two beats of the pair
        playSingleBeat(0); // First beat immediately
        playSingleBeat(secondBeatDelay); // Second beat shortly after

        // Schedule the *next* pair of beats
        const timerId = setTimeout(playBeatPair, beatIntervalSeconds * 1000);
        activeTimers.push(timerId);
    }

    playBeatPair(); // Start the first beat pair
}

/**
 * Creates a gentle arpeggio sequence based on the current pad chord.
 */
function createArpeggio() {
    if (!audioContext || !masterGain || !isPlaying || !arpeggiatorEnabled || currentPadChordNotes.length === 0) return;
    console.log("Creating Arpeggio...");

    const arpNotes = [...currentPadChordNotes, currentPadChordNotes[1] * 2]; // Example: Root, Third, Fifth, Third (Octave Up)
    const noteDuration = 0.25; // Duration of each arpeggio note in seconds
    const noteGap = 0.05; // Gap between notes
    const totalNoteTime = noteDuration + noteGap;
    const targetGain = 0.1; // Volume of arpeggio notes
    let noteIndex = 0;

    const playArpNote = () => {
        // Stop condition checked inside timeout
        const freq = arpNotes[noteIndex % arpNotes.length];
        noteIndex++;

        // Create nodes for this note
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const filter = audioContext.createBiquadFilter(); // Simple filter

        // Configure nodes
        osc.type = 'sine'; // Sine or triangle often works well
        osc.frequency.value = freq;
        filter.type = 'lowpass';
        filter.frequency.value = 4000;
        filter.Q.value = 0.5;

        // Connect nodes: osc -> filter -> gain -> masterGain
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);

        // Schedule envelope (gentle attack/release)
        const now = audioContext.currentTime;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(targetGain, now + 0.02); // Quick attack
        // Hold gain value slightly before release starts
        gain.gain.setValueAtTime(targetGain, now + noteDuration - 0.05);
        gain.gain.linearRampToValueAtTime(0.0001, now + noteDuration); // Quick release to near zero

        osc.start(now);
        osc.stop(now + noteDuration + 0.1);

        // Track
        activeOscillators.push({ osc, gain, type: 'arpeggio' });
        const cleanupTimer = setTimeout(() => {
            activeOscillators = activeOscillators.filter(item => item.osc !== osc);
        }, (noteDuration + 0.2) * 1000);
        activeTimers.push(cleanupTimer);

        // Schedule the *next* note in the sequence
        if (isPlaying && arpeggiatorEnabled) { // Check condition before scheduling next
             const nextNoteTimerId = setTimeout(playArpNote, totalNoteTime * 1000);
             // Tag this timer specifically for the arpeggiator sequence
             activeTimers.push({ id: nextNoteTimerId, type: 'arpeggio_note' });
        }
    };

    // Start the first note of the sequence
    playArpNote();
}

/**
 * Helper function to stop only the currently running arpeggio sequence timers and notes.
 */
function stopArpeggioSequence() {
    console.log("Stopping Arpeggio Sequence...");
    // Clear pending arpeggio note timers
    activeTimers = activeTimers.filter(timer => {
        if (typeof timer === 'object' && timer.type === 'arpeggio_note') {
            clearTimeout(timer.id);
            return false; // Remove this timer
        }
        return true; // Keep other timers
    });

    // Fade out and stop active arpeggio notes
    const now = audioContext.currentTime;
    activeOscillators = activeOscillators.filter(({ osc, gain, type }) => {
        if (type === 'arpeggio') {
            try {
                gain.gain.cancelScheduledValues(now);
                gain.gain.setValueAtTime(gain.gain.value, now);
                gain.gain.linearRampToValueAtTime(0.0001, now + 0.1); // Quick fade
                osc.stop(now + 0.2);
            } catch (e) { /* Ignore */ }
            return false; // Remove
        }
        return true; // Keep others
    });
}

// --- Playback Control (Exported Functions) ---

/**
 * Starts playing all ambient sound layers.
 * Ensures audio context is initialized and resumed.
 */
export async function startAmbient() {
  const nodes = initAudio();
  if (!nodes || !audioContext || isPlaying) return;

  console.log("Ambient Audio: Starting...");
  try {
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
  } catch (e) { console.error("Ambient Audio: Error resuming context during start", e); return; }

  isPlaying = true;
  setVolume(currentVolume);

  // Start Sound Layers
  createPad(); // Pad needs to start first to set initial currentPadChordNotes
  createBassline();
  createTexture();
  createMelody();
  if (heartbeatEnabled) { createHeartbeat(); }
  // Start arpeggio AFTER pad has set the initial chord notes
  if (arpeggiatorEnabled && currentPadChordNotes.length > 0) { createArpeggio(); }
}

/**
 * Stops all ambient sounds and clears scheduled actions.
 */
export function stopAmbient() {
  if (!audioContext || !isPlaying) return;
  isPlaying = false;
  console.log("Ambient Audio: Stopping...");

  // Clear ALL pending timers (includes arp note timers)
  activeTimers.forEach(timer => {
      // Check if timer is an object with id (our tagged arp timer) or just an ID
      if (typeof timer === 'object' && timer.id) {
          clearTimeout(timer.id);
      } else if (typeof timer === 'number') { // Assuming other timers are numbers
          clearTimeout(timer);
      }
  });
  activeTimers = [];

  // Fade out and stop ALL active oscillators/sources
  const now = audioContext.currentTime;
  activeOscillators.forEach(({ osc, gain }) => {
      try {
          if (gain && gain.gain) {
              gain.gain.cancelScheduledValues(now);
              gain.gain.setValueAtTime(gain.gain.value, now);
              gain.gain.linearRampToValueAtTime(0.0001, now + 1.0);
          }
          if (osc.stop) {
            osc.stop(now + 1.1);
          }
      } catch (e) { /* Ignore errors */ }
  });
  activeOscillators = [];
  console.log("Ambient Audio: Stopped.");
}

// --- Mute/Volume Control (Exported Functions) ---

/**
 * Toggles the master mute state and updates localStorage.
 */
export function toggleMute() {
    const nodes = initAudio();
    if (!nodes || !masterGain) return;
    isMuted = !isMuted;
    const now = audioContext.currentTime;
    masterGain.gain.cancelScheduledValues(now);
    if (isMuted) {
        if (masterGain.gain.value > 0.001) { currentVolume = masterGain.gain.value; }
        masterGain.gain.setValueAtTime(masterGain.gain.value, now);
        masterGain.gain.linearRampToValueAtTime(0, now + 0.2);
        localStorage.setItem('ambientMuted', 'true');
        console.log("Ambient Audio: Muted");
    } else {
        masterGain.gain.setValueAtTime(0, now);
        masterGain.gain.linearRampToValueAtTime(currentVolume, now + 0.2);
        localStorage.removeItem('ambientMuted');
        console.log(`Ambient Audio: Unmuted. Volume: ${currentVolume}`);
    }
}

/** Gets the current mute state. */
export function getMuteState() {
    if (audioContext) { return isMuted; }
    if (typeof localStorage !== 'undefined') { return localStorage.getItem('ambientMuted') === 'true'; }
    return false;
}

/** Gets the current volume level (0.0 to 1.0). */
export function getVolume() {
    if (audioContext) { return currentVolume; }
    if (typeof localStorage !== 'undefined') { const savedVolume = localStorage.getItem('ambientVolume'); return savedVolume !== null ? parseFloat(savedVolume) : 0.7; }
    return 0.7;
}

/** Sets the master volume and updates localStorage. */
export function setVolume(value) {
    const nodes = initAudio();
    if (!nodes || !masterGain) return;
    const newVolume = Math.max(0, Math.min(1, value));
    currentVolume = newVolume;
    if (!isMuted) {
        const now = audioContext.currentTime;
        // Use setTargetAtTime for smoother volume changes, especially with sliders.
        // It creates an exponential approach to the target value.
        // The third argument is a time constant (lower = faster change).
        masterGain.gain.setTargetAtTime(newVolume, now, 0.015);
    }
    try {
        localStorage.setItem('ambientVolume', currentVolume.toString());
    } catch (e) { console.warn("Ambient Audio: Could not save volume preference to localStorage", e); }
    console.log(`Ambient Audio: Volume set to ${currentVolume}`);
}

// --- State Getters (Exported Functions) ---

/** Checks if the audio is currently playing. */
export function getIsPlaying() {
    return isPlaying;
}

/** Gets the current pad oscillator type. */
export function getPadOscillatorType() {
    return padOscType;
}

/** Gets the current pad filter frequency. */
export function getPadFilterFrequency() {
    return padFilterFreq;
}

/** Gets the current chord speed in milliseconds. */
export function getChordSpeed() {
    return chordSpeedMs;
}

/** Gets the current state of the heartbeat generator. */
export function getHeartbeatEnabled() {
    // Optional: Load from localStorage if not initialized?
    // if (audioContext === null && typeof localStorage !== 'undefined') {
    //    return localStorage.getItem('ambientHeartbeatEnabled') === 'true';
    // }
    return heartbeatEnabled;
}

/** Gets the current state of the arpeggiator generator. */
export function getArpeggiatorEnabled() {
    // Optional: Load from localStorage?
    // if (audioContext === null && typeof localStorage !== 'undefined') {
    //    return localStorage.getItem('ambientArpeggiatorEnabled') === 'true';
    // }
    return arpeggiatorEnabled;
}

// --- Settings Management ---

/**
 * Bundles all current configurable settings into an object.
 * @returns {object} An object containing the current audio settings.
 */
export function getSettings() {
    return {
        volume: currentVolume,
        isMuted: isMuted,
        padOscType: padOscType,
        padFilterFreq: padFilterFreq,
        chordSpeedMs: chordSpeedMs,
        heartbeatEnabled: heartbeatEnabled,
        arpeggiatorEnabled: arpeggiatorEnabled,
        // Add any new parameters here in the future
    };
}

/**
 * Applies a settings object to the audio player.
 * Calls individual setter functions to update the player state.
 * @param {object} settings - The settings object to apply.
 */
export function applySettings(settings) {
    if (!settings) return;
    console.log("Applying settings:", settings);

    // Apply volume and mute state
    // Need to handle mute *after* setting volume if unmuting
    if (typeof settings.volume === 'number') {
        setVolume(settings.volume);
    }
    if (typeof settings.isMuted === 'boolean' && settings.isMuted !== isMuted) {
        toggleMute(); // Toggle handles the logic correctly
    }

    // Apply pad settings
    if (typeof settings.padOscType === 'string') {
        setPadOscillatorType(settings.padOscType);
    }
    if (typeof settings.padFilterFreq === 'number') {
        setPadFilterFrequency(settings.padFilterFreq);
    }
    if (typeof settings.chordSpeedMs === 'number') {
        setChordSpeed(settings.chordSpeedMs);
    }

    // Apply generator enabled states
    // Important: Check if the state needs to change before toggling
    if (typeof settings.heartbeatEnabled === 'boolean' && settings.heartbeatEnabled !== heartbeatEnabled) {
        toggleHeartbeat();
    }
    if (typeof settings.arpeggiatorEnabled === 'boolean' && settings.arpeggiatorEnabled !== arpeggiatorEnabled) {
        toggleArpeggiator();
    }

    // Add logic for any new parameters here in the future
}

// --- Optional Context Control ---

/** Suspends the AudioContext (saves resources when tab is inactive). */
export function suspendAudio() {
    if (audioContext && audioContext.state === 'running') {
        audioContext.suspend().then(() => console.log("Ambient Audio: Context suspended."));
    }
}

/** Resumes a suspended AudioContext. */
export function resumeAudio() {
     if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume().then(() => console.log("Ambient Audio: Context resumed."));
    }
}

// --- Parameter Setters (Exported Functions) ---

/** Sets the oscillator type for the pad sound. */
export function setPadOscillatorType(type) {
    const validOscTypes = ['sine', 'square', 'sawtooth', 'triangle'];
    if (validOscTypes.includes(type)) {
        padOscType = type;
        console.log(`Ambient Audio: Pad oscillator type set to ${padOscType}`);
        // Note: This change will only apply to the *next* chord generated.
        // For immediate effect, we would need to find active pad oscillators and update their type,
        // which can sometimes cause clicks. Applying on next chord is smoother.
    } else {
        console.warn(`Ambient Audio: Invalid oscillator type - ${type}`);
    }
}

/** Sets the lowpass filter cutoff frequency for the pad sound. */
export function setPadFilterFrequency(freq) {
    const frequency = Math.max(100, Math.min(10000, Number(freq))); // Clamp frequency
    padFilterFreq = frequency;
    console.log(`Ambient Audio: Pad filter frequency set to ${padFilterFreq}Hz`);

    // Optionally: Apply immediately to existing pad filters (can cause clicks)
    /*
    if (audioContext) {
        const now = audioContext.currentTime;
        activeOscillators.forEach(({ type, gain }) => {
            // Assuming filter is connected to gain node output
            if (type === 'pad' && gain.numberOfOutputs > 0) {
                 // This assumes the filter is the first node connected *after* the gain.
                 // A more robust approach would store the filter node reference itself.
                 const filterNode = gain.context.destination; // Placeholder - Need better way to access filter
                 // if (filterNode instanceof BiquadFilterNode) {
                 //     filterNode.frequency.setTargetAtTime(padFilterFreq, now, 0.05);
                 // }
            }
        });
    }
    */
    // For now, change only applies to *next* chord's filter.
}

/** Sets the duration (speed) of each chord in the pad progression. */
export function setChordSpeed(ms) {
    const speed = Math.max(4000, Math.min(30000, Number(ms))); // Clamp speed (4s to 30s)
    chordSpeedMs = speed;
    console.log(`Ambient Audio: Chord speed set to ${chordSpeedMs}ms`);
    // Note: This change will apply to the scheduling of the *next* chord change.
}

/** Toggles the heartbeat generator on or off. */
export function toggleHeartbeat() {
    heartbeatEnabled = !heartbeatEnabled;
    console.log(`Ambient Audio: Heartbeat ${heartbeatEnabled ? 'enabled' : 'disabled'}`);
    if (isPlaying) {
        if (heartbeatEnabled) {
            // If playing and heartbeat was just enabled, start it
            createHeartbeat();
        } else {
            // If playing and heartbeat was disabled, stop existing beats
            // (Stop function already handles clearing timers/fading sounds)
            // We might need a more specific stop function later if we add more togglable elements
            const now = audioContext.currentTime;
            activeOscillators = activeOscillators.filter(({ osc, gain, type }) => {
                if (type === 'heartbeat') {
                    try {
                        gain.gain.cancelScheduledValues(now);
                        gain.gain.setValueAtTime(gain.gain.value, now);
                        gain.gain.linearRampToValueAtTime(0.0001, now + 0.1); // Quick fade
                        osc.stop(now + 0.2);
                    } catch (e) { /* Ignore */ }
                    return false; // Remove
                }
                return true; // Keep others
            });
            // Also clear any pending beat timers
             activeTimers = activeTimers.filter(id => {
                 // This is tricky without knowing which timer belongs to the heartbeat
                 // For now, stopAmbient clears all timers. A more robust solution
                 // would involve tracking timers by type.
                 return true; // Keep all timers for now, stopAmbient handles full clear
             });
        }
    }
     // Persist state? Optional: localStorage.setItem('ambientHeartbeatEnabled', heartbeatEnabled);
}

/** Toggles the arpeggiator generator on or off. */
export function toggleArpeggiator() {
    arpeggiatorEnabled = !arpeggiatorEnabled;
    console.log(`Ambient Audio: Arpeggiator ${arpeggiatorEnabled ? 'enabled' : 'disabled'}`);
    if (isPlaying) {
        if (arpeggiatorEnabled) {
            // If playing and arp was just enabled, start it with the current chord
            createArpeggio();
        } else {
            // If playing and arp was disabled, stop the current sequence
            stopArpeggioSequence();
        }
    }
    // Optional: Persist state
    // localStorage.setItem('ambientArpeggiatorEnabled', arpeggiatorEnabled);
} 