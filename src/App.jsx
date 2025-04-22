import React, { useState, useEffect, useRef, useCallback } from 'react'
// Removed App.css import as it should be empty

// Import the audio player utility functions
import * as ambientPlayer from './utils/ambientPlayer'

// Constants for notes and chords (moved outside the component for clarity)
// Minor scale with emotional character - Gm scale
// Adjusted to include those Drake-like emotional intervals
const notes = [
    196.00, // G3
    233.08, // A#3
    261.63, // C4
    293.66, // D4
    311.13, // D#4 - added for emotional tension
    349.23, // F4
    392.00, // G4
    415.30, // G#4 - added for soulful character
    466.16, // A#4
    523.25, // C5
    587.33, // D5
    622.25, // D#5
    698.46  // F5
];

// Drake-inspired chord progressions
const chords = [
    // Gm (i)
    [notes[0], notes[2], notes[6]],
    // Cm (iv)
    [notes[2], notes[5], notes[9]],
    // D# (VI) - a common Drake chord for that yearning feel
    [notes[4], notes[7], notes[11]],
    // D (V) with suspended 4th for tension
    [notes[3], notes[8], notes[10]]
];

// Bass notes corresponding to chord roots but an octave lower
const bassNotes = [
    notes[0] / 2, // G2
    notes[2] / 2, // C3
    notes[4] / 2, // D#2
    notes[3] / 2  // D2
];

// Emotional melodic phrases
const phrases = [
    [notes[6], notes[8], notes[9], notes[6]], // Yearning upward
    [notes[9], notes[6], notes[5], notes[2]], // Falling, searching
    [notes[5], notes[6], notes[8], notes[9], notes[8]], // Rising hope
    [notes[8], notes[6], notes[4], notes[3]] // Emotional resolution
];

// Background colors for shifting effect
const backgroundColors = [
    'radial-gradient(circle at 50% 50%, #252545 0%, #191930 100%)',
    'radial-gradient(circle at 50% 50%, #2d2d4d 0%, #1e1e35 100%)',
    'radial-gradient(circle at 50% 50%, #252538 0%, #151525 100%)',
    'radial-gradient(circle at 50% 50%, #2a2a40 0%, #191930 100%)'
];

const PRESET_PREFIX = 'ambientPreset_'; // Prefix for localStorage keys

// --- Components ---

// StarBackground Component: Handles rendering and animating stars
function StarBackground() {
    const [stars, setStars] = useState([])

    useEffect(() => {
        const generatedStars = []
        for (let i = 0; i < 50; i++) {
            generatedStars.push({
                id: i,
                style: {
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    animationDuration: `${5 + Math.random() * 10}s`,
                    animationDelay: `${Math.random() * 5}s`,
                }
            })
        }
        setStars(generatedStars)
    }, []) // Empty dependency array means this runs once on mount

    return (
        <>
            {stars.map(star => (
                <div key={star.id} className="star" style={star.style}></div>
            ))}
        </>
    )
}

// Visualizer Component: Renders the visualizer bars
function Visualizer({ analyser, isPlaying }) {
    const visualizerRef = useRef(null) // Ref to access the visualizer DOM element
    const animationFrameId = useRef(null) // Ref to store the animation frame ID

    const barCount = 32

    useEffect(() => {
        if (!analyser || !visualizerRef.current || !isPlaying) {
            // If not playing or analyser isn't ready, cancel any existing animation frame
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current)
                animationFrameId.current = null
            }
            // Optionally reset bars when stopped
            const bars = visualizerRef.current?.querySelectorAll('.bar')
            if (bars) {
                bars.forEach(bar => bar.style.height = '3px')
            }
            const glow = document.querySelector('.glow') // Find glow outside visualizerRef
            if (glow) {
                glow.style.width = '200px'
                glow.style.height = '40px'
                glow.style.background = 'radial-gradient(ellipse at center, rgba(110, 142, 255, 0.15) 0%, rgba(110, 142, 255, 0) 70%)'
            }
            return
        }

        const dataArray = new Uint8Array(analyser.frequencyBinCount)
        const bars = visualizerRef.current.querySelectorAll('.bar')
        const glow = document.querySelector('.glow') // Find glow outside visualizerRef

        const draw = () => {
            animationFrameId.current = requestAnimationFrame(draw) // Schedule next frame

            analyser.getByteFrequencyData(dataArray) // Get data for this frame

            const step = Math.floor(dataArray.length / barCount)
            let sum = 0

            for (let i = 0; i < barCount; i++) {
                const dataIndex = i * step
                const value = dataArray[dataIndex]
                const height = Math.max(3, value / 3) // Calculate bar height (min 3px)

                if (bars[i]) { // Check if bar exists before styling
                    bars[i].style.height = `${height}px`
                    sum += height
                }
            }

            // Update glow based on overall amplitude
            if (glow) { // Check if glow element exists
                const avgHeight = sum / barCount
                const glowSize = 200 + (avgHeight * 3)
                const glowOpacity = Math.min(0.8, 0.15 + (avgHeight / 100)) // Cap opacity

                glow.style.width = `${glowSize}px`
                glow.style.height = `${glowSize / 3}px`
                glow.style.background = `radial-gradient(ellipse at center, 
                                            rgba(110, 142, 255, ${glowOpacity}) 0%, 
                                            rgba(110, 142, 255, 0) 70%)`
            }
        }

        draw() // Start the animation loop

        // Cleanup function: Cancel the animation frame when the component unmounts or dependencies change
        return () => {
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current)
                animationFrameId.current = null
            }
        }
    }, [analyser, isPlaying]) // Rerun effect if analyser or isPlaying changes

    return (
        <div className="visualizer-container">
            <div className="glow"></div>
            <div className="visualizer" ref={visualizerRef}>
                {/* Create bars dynamically */}
                {Array.from({ length: barCount }).map((_, i) => (
                    <div key={i} className="bar"></div>
                ))}
            </div>
        </div>
    )
}

// --- Main App Component ---
function App() {
    // --- State Variables ---
    const [status, setStatus] = useState('Click Begin Journey to start your emotional odyssey')
    const [isPlaying, setIsPlaying] = useState(false) // Default to false, then check utility in useEffect
    const [volume, setVolume] = useState(70) // Default value, will update in useEffect
    const [analyserNode, setAnalyserNode] = useState(null) // State to hold the analyser node for the visualizer

    // State for new configurable parameters
    const [padType, setPadType] = useState('triangle') // Default value
    const [padFilterFreq, setPadFilterFreq] = useState(2000) // Default value
    const [chordSpeed, setChordSpeed] = useState(12000) // Default value

    // State for heartbeat generator
    const [heartbeatOn, setHeartbeatOn] = useState(ambientPlayer.getHeartbeatEnabled()); // Init from utility

    // State for arpeggiator generator
    const [arpeggiatorOn, setArpeggiatorOn] = useState(ambientPlayer.getArpeggiatorEnabled()); // Init from utility

    // State for presets
    const [presetName, setPresetName] = useState('My Ambient Sound');
    const [savedPresets, setSavedPresets] = useState([]); // Array of preset names
    const [selectedPreset, setSelectedPreset] = useState(''); // Name of the selected preset in dropdown

    // --- Refs ---
    const backgroundIntervalRef = useRef(null); // Keep ref for background interval only

    // --- Initialization Effect ---
    // Attempt to initialize audio on component mount and sync state with utility
    useEffect(() => {
        console.log("App Mount: Initializing audio...");
        
        // Initialize audio context and get nodes
        const nodes = ambientPlayer.initAudio();
        
        if (nodes && nodes.analyser) {
            console.log("App Mount: Analyser node received.");
            setAnalyserNode(nodes.analyser);
            
            // Sync state with utility values
            setIsPlaying(ambientPlayer.getIsPlaying());
            setVolume(ambientPlayer.getVolume() * 100);
            setPadType(ambientPlayer.getPadOscillatorType());
            setPadFilterFreq(ambientPlayer.getPadFilterFrequency());
            setChordSpeed(ambientPlayer.getChordSpeed());
            setHeartbeatOn(ambientPlayer.getHeartbeatEnabled()); // Sync heartbeat state
            setArpeggiatorOn(ambientPlayer.getArpeggiatorEnabled()); // Sync arpeggiator state
        } else {
            console.error("App Mount: Failed to initialize audio or get analyser.");
            setStatus("Failed to initialize audio. Please refresh or try a different browser.");
        }

        // Start background shift if already playing
        if (ambientPlayer.getIsPlaying()) {
            startBackgroundShift();
        }

        // Cleanup function for unmounting
        return () => {
            console.log("App Unmount: Stopping ambient sound and background shift.");
            ambientPlayer.stopAmbient(); // Ensure sound stops when component unmounts
            stopBackgroundShift(); // Stop background shift
        };
    }, []); // Empty dependency array - runs only once on mount

    // Effect to load presets from localStorage on mount
    useEffect(() => {
        const loadedPresets = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(PRESET_PREFIX)) {
                loadedPresets.push(key.substring(PRESET_PREFIX.length)); // Add name without prefix
            }
        }
        setSavedPresets(loadedPresets.sort());
        if (loadedPresets.length > 0) {
             setSelectedPreset(loadedPresets[0]); // Select first preset by default
        }
    }, []);

    // --- Background Color Shifting (Moved outside audio logic) ---
    const startBackgroundShift = useCallback(() => {
        if (backgroundIntervalRef.current) {
            clearInterval(backgroundIntervalRef.current);
        }
        let colorIndex = 0;
        document.body.style.backgroundImage = backgroundColors[colorIndex]; // Set initial color
        backgroundIntervalRef.current = setInterval(() => {
            colorIndex = (colorIndex + 1) % backgroundColors.length;
            document.body.style.backgroundImage = backgroundColors[colorIndex];
        }, 20000);
    }, []);

    const stopBackgroundShift = useCallback(() => {
        if (backgroundIntervalRef.current) {
            clearInterval(backgroundIntervalRef.current);
            backgroundIntervalRef.current = null;
        }
    }, []);

    // --- Control Functions (Calling utility functions) ---

    // Handle clicking the play/start button
    const handlePlay = useCallback(async () => {
        setStatus('Starting journey...')
        console.log("UI: Play button clicked.")
        
        try {
            // Attempt to start the ambient player
            await ambientPlayer.startAmbient();
            
            // Update UI state based on the player's actual state
            if (ambientPlayer.getIsPlaying()) {
                setIsPlaying(true);
                setStatus('Soulful journey in progress...');
                startBackgroundShift(); // Start background effect only if playing starts
            } else {
                // Handle case where starting failed (e.g., context couldn't resume)
                setStatus('Could not start audio. Please click again or check browser permissions.');
            }
            
            // Ensure analyser node is set if it wasn't on initial load
            if (!analyserNode) {
                const nodes = ambientPlayer.initAudio(); // Call init again safely
                if (nodes && nodes.analyser) {
                    setAnalyserNode(nodes.analyser);
                }
            }
        } catch (error) {
            console.error("Error starting ambient sound:", error);
            setStatus('Error starting audio. Please refresh the page and try again.');
        }
    }, [startBackgroundShift, analyserNode]);

    // Handle clicking the stop/pause button
    const handleStop = useCallback(() => {
        console.log("UI: Stop button clicked.")
        ambientPlayer.stopAmbient();
        setIsPlaying(false);
        setStatus('Journey paused. Begin again?');
        stopBackgroundShift(); // Stop background effect
    }, [stopBackgroundShift]);

    // Handle volume slider changes
    const handleVolumeChange = (event) => {
        const newVolumeSlider = Number(event.target.value); // Value from 0-100
        setVolume(newVolumeSlider);
        ambientPlayer.setVolume(newVolumeSlider / 100); // Convert to 0.0-1.0 for the utility
    };

    // Handlers for new parameter controls
    const handlePadTypeChange = (event) => {
        const newType = event.target.value;
        setPadType(newType);
        ambientPlayer.setPadOscillatorType(newType);
    };

    const handlePadFilterChange = (event) => {
        const newFreq = Number(event.target.value);
        setPadFilterFreq(newFreq);
        ambientPlayer.setPadFilterFrequency(newFreq);
    };

    // Fixed chord speed slider logic
    const handleChordSpeedChange = (event) => {
        // Get the value directly from the slider (already inverted in the UI)
        const sliderValue = Number(event.target.value);
        // Calculate actual chord speed value (4000-30000 range)
        const actualValue = 34000 - sliderValue;
        setChordSpeed(actualValue);
        ambientPlayer.setChordSpeed(actualValue);
    };

    // Handler for heartbeat toggle
    const handleToggleHeartbeat = () => {
        ambientPlayer.toggleHeartbeat();
        setHeartbeatOn(ambientPlayer.getHeartbeatEnabled());
    };

    // Handler for arpeggiator toggle
    const handleToggleArpeggiator = () => {
        ambientPlayer.toggleArpeggiator(); // Call the utility function
        setArpeggiatorOn(ambientPlayer.getArpeggiatorEnabled()); // Update UI state from utility
    };

    // --- Preset Handlers ---
    const handleSavePreset = () => {
        if (!presetName.trim()) {
            alert('Please enter a name for the preset.');
            return;
        }
        const key = `${PRESET_PREFIX}${presetName.trim()}`;
        const currentSettings = ambientPlayer.getSettings();
        try {
            localStorage.setItem(key, JSON.stringify(currentSettings));
            console.log(`Preset '${presetName.trim()}' saved.`);
            setStatus(`Preset '${presetName.trim()}' saved.`);
            // Update preset list if it's a new preset
            if (!savedPresets.includes(presetName.trim())) {
                const updatedPresets = [...savedPresets, presetName.trim()].sort();
                setSavedPresets(updatedPresets);
                setSelectedPreset(presetName.trim()); // Select the newly saved preset
            }
        } catch (e) {
            console.error("Error saving preset to localStorage:", e);
            alert('Could not save preset. Storage might be full.');
        }
    };

    const handleLoadPreset = () => {
        if (!selectedPreset) {
            alert('Please select a preset to load.');
            return;
        }
        const key = `${PRESET_PREFIX}${selectedPreset}`;
        const settingsString = localStorage.getItem(key);
        if (settingsString) {
            try {
                const settings = JSON.parse(settingsString);
                console.log(`Loading preset '${selectedPreset}':`, settings);
                // Apply settings to the player first
                ambientPlayer.applySettings(settings);
                // Then, update the UI state to match the loaded settings
                setVolume(settings.volume * 100);
                setPadType(settings.padOscType);
                setPadFilterFreq(settings.padFilterFreq);
                setChordSpeed(settings.chordSpeedMs);
                // Use the player's state after applySettings to ensure consistency
                // (especially for toggled states like mute, heartbeat, arpeggiator)
                setIsPlaying(ambientPlayer.getIsPlaying());
                setHeartbeatOn(ambientPlayer.getHeartbeatEnabled());
                setArpeggiatorOn(ambientPlayer.getArpeggiatorEnabled());
                setPresetName(selectedPreset); // Update name input field
                setStatus(`Preset '${selectedPreset}' loaded.`);
            } catch (e) {
                console.error("Error parsing or applying preset:", e);
                alert(`Could not load preset '${selectedPreset}'. It might be corrupted.`);
            }
        } else {
            alert(`Preset '${selectedPreset}' not found.`);
        }
    };

    const handleDeletePreset = () => {
         if (!selectedPreset) {
            alert('Please select a preset to delete.');
            return;
        }
        if (confirm(`Are you sure you want to delete the preset '${selectedPreset}'?`)) {
             const key = `${PRESET_PREFIX}${selectedPreset}`;
             try {
                 localStorage.removeItem(key);
                 console.log(`Preset '${selectedPreset}' deleted.`);
                 setStatus(`Preset '${selectedPreset}' deleted.`);
                 // Update preset list
                 const updatedPresets = savedPresets.filter(p => p !== selectedPreset);
                 setSavedPresets(updatedPresets);
                 // Select the first preset in the updated list, or none if empty
                 setSelectedPreset(updatedPresets.length > 0 ? updatedPresets[0] : '');
             } catch (e) {
                 console.error("Error deleting preset:", e);
                 alert('Could not delete preset.');
             }
        }
    };

    // --- Render JSX ---
    return (
        <>
            <StarBackground />
            <div className="container">
                <h1>Soulful Space Journey</h1>
                <p className="subtitle">Emotional ambient tones with soul & longing</p>

                {/* Pass analyser node and isPlaying state to Visualizer */}
                <Visualizer analyser={analyserNode} isPlaying={isPlaying} />

                <div className="controls">
                    {/* --- Left Column --- */}
                    <div className="controls-column">
                        {/* Play/Pause buttons */}
                        <div className="control-group button-group">
                            <button onClick={handlePlay} disabled={isPlaying}>
                                Begin Journey
                            </button>
                            <button onClick={handleStop} disabled={!isPlaying}>
                                Pause
                            </button>
                        </div>

                        {/* Volume Slider */}
                        <div className="slider-container control-group">
                            <label htmlFor="volumeSlider">Volume</label>
                            <input
                                type="range"
                                id="volumeSlider"
                                className="slider"
                                min="0"
                                max="100"
                                value={volume}
                                onChange={handleVolumeChange}
                                aria-label="Volume"
                            />
                        </div>

                        {/* Pad Oscillator Type Dropdown */}
                        <div className="control-group">
                            <label htmlFor="padTypeSelect">Pad Sound</label>
                            <select id="padTypeSelect" value={padType} onChange={handlePadTypeChange} className="select-control">
                                <option value="triangle">Warm Triangle</option>
                                <option value="sine">Smooth Sine</option>
                                <option value="square">Sharp Square</option>
                                <option value="sawtooth">Buzzy Sawtooth</option>
                            </select>
                        </div>

                        {/* Pad Filter Frequency Slider */}
                        <div className="slider-container control-group">
                            <label htmlFor="padFilterSlider">Pad Filter (Brightness)</label>
                            <input
                                type="range"
                                id="padFilterSlider"
                                className="slider"
                                min="200" // Lower limit for filter cutoff (Hz)
                                max="8000" // Upper limit for filter cutoff (Hz)
                                step="100" // Step value
                                value={padFilterFreq}
                                onChange={handlePadFilterChange}
                                aria-label="Pad Filter Frequency"
                            />
                            <span style={{ fontSize: '0.8em', color: '#a0a0d0' }}>{padFilterFreq} Hz</span>
                        </div>

                        {/* Chord Progression Speed Slider */}
                        <div className="slider-container control-group">
                            <label htmlFor="chordSpeedSlider">Chord Speed</label>
                            <input
                                type="range"
                                id="chordSpeedSlider"
                                className="slider"
                                min="4000" // Min duration in ms (4 seconds)
                                max="30000" // Max duration in ms (30 seconds)
                                step="1000" // Step value (1 second)
                                // Invert the slider visually so right is slower
                                value={34000 - chordSpeed} // Map 4k-30k to slider range
                                onChange={handleChordSpeedChange}
                                aria-label="Chord Progression Speed"
                            />
                            <span style={{ fontSize: '0.8em', color: '#a0a0d0' }}>{(chordSpeed / 1000).toFixed(1)} s/chord</span>
                        </div>
                    </div>

                    {/* --- Right Column --- */}
                    <div className="controls-column">
                        {/* --- Heartbeat Toggle --- */}
                        <div className="control-group toggle-group">
                            <label htmlFor="heartbeatToggle">Subtle Heartbeat</label>
                            <label className="switch">
                                <input
                                    type="checkbox"
                                    id="heartbeatToggle"
                                    checked={heartbeatOn}
                                    onChange={handleToggleHeartbeat}
                                />
                                <span className="toggle-slider round"></span>
                            </label>
                        </div>

                        {/* --- Arpeggiator Toggle --- */}
                        <div className="control-group toggle-group">
                            <label htmlFor="arpeggiatorToggle">Gentle Arpeggio</label>
                            <label className="switch">
                                <input
                                    type="checkbox"
                                    id="arpeggiatorToggle"
                                    checked={arpeggiatorOn}
                                    onChange={handleToggleArpeggiator} // Use the new handler
                                />
                                <span className="toggle-slider round"></span>
                            </label>
                        </div>

                        {/* --- Preset Management --- */}
                        <div className="preset-manager control-group">
                            <h3 className="preset-title">Presets</h3>
                            <div className="preset-save">
                                <input
                                    type="text"
                                    value={presetName}
                                    onChange={(e) => setPresetName(e.target.value)}
                                    placeholder="Preset Name"
                                    className="preset-input"
                                />
                                <button onClick={handleSavePreset} className="preset-button">Save</button>
                            </div>
                            <div className="preset-load">
                                <select
                                    value={selectedPreset}
                                    onChange={(e) => setSelectedPreset(e.target.value)}
                                    className="preset-select select-control"
                                    disabled={savedPresets.length === 0}
                                >
                                    {savedPresets.length === 0 ? (
                                        <option value="">No presets saved</option>
                                    ) : (
                                        savedPresets.map(name => (
                                            <option key={name} value={name}>{name}</option>
                                        ))
                                    )}
                                </select>
                                <button onClick={handleLoadPreset} disabled={!selectedPreset} className="preset-button">Load</button>
                                <button onClick={handleDeletePreset} disabled={!selectedPreset} className="preset-button preset-delete">Delete</button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Status Display */}
                <div id="status">{status}</div>
            </div>
        </>
    );
}

export default App;
