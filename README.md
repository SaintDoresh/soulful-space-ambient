# Soulful Space Ambient Generator

![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)
![Web Audio API](https://img.shields.io/badge/Web%20Audio%20API-orange?style=for-the-badge)

A simple web-based ambient music generator built with React and the Web Audio API, inspired by emotional, atmospheric background music.

## Features

*   **Generative Ambient Music:** Creates a continuous, non-repetitive soundscape.
*   **Sound Layers:** Combines multiple layers for richness:
    *   Slowly evolving pads (chords)
    *   Deep sub-bass line
    *   Sparse melodic fragments
    *   Subtle background texture
    *   Optional rhythmic "Heartbeat" pulse
    *   Optional gentle "Arpeggio" based on the current pad chord
*   **Interactive Controls:**
    *   Play / Pause
    *   Volume control
    *   Pad Sound (Oscillator Type: Triangle, Sine, Square, Sawtooth)
    *   Pad Filter Brightness (Lowpass Filter Cutoff Frequency)
    *   Chord Speed (Duration of each pad chord)
    *   Toggle switches for Heartbeat and Arpeggio layers
*   **Preset Management:**
    *   Save your current sound settings as a named preset.
    *   Load previously saved presets.
    *   Delete saved presets.
    *   Presets are stored in your browser's `localStorage`.
*   **Audio Visualization:** Real-time frequency visualization matching the audio output.
*   **Persistent Settings:** Volume level and mute state are saved in `localStorage`.
*   **Responsive Layout:** Adapts to different screen sizes, using a two-column layout on wider screens.

## Setup and Running

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url> # Replace with your actual repo URL
    cd soulful-space-ambient
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Run the development server:**
    ```bash
    npm run dev
    ```
4.  **Open in browser:** Navigate to the local URL provided by Vite (usually `http://localhost:5173` or similar).

## How to Use

1.  Click **"Begin Journey"** to start the audio generation and visualization.
2.  Click **"Pause"** to stop the audio.
3.  Use the **Volume** slider to adjust the overall loudness.
4.  Experiment with the parameter controls:
    *   **Pad Sound:** Changes the basic tone/timbre of the main pad chords.
    *   **Pad Filter (Brightness):** Controls how bright or muffled the pad sounds.
    *   **Chord Speed:** Adjusts how quickly the underlying pad chords change.
    *   **Subtle Heartbeat / Gentle Arpeggio Toggles:** Turn these optional rhythmic layers on or off.
5.  **Manage Presets:**
    *   To save the current settings, type a name in the input field under "Presets" and click **"Save"**.
    *   To load settings, select a name from the dropdown list and click **"Load"**.
    *   To remove a saved preset, select it from the dropdown and click **"Delete"**.

## Examples / Moods (Suggestions)

*   **Deep & Meditative:** Pad Sound: `Triangle` or `Sine`, Pad Filter: `800-1500 Hz`, Chord Speed: `20-30 seconds`, Heartbeat: `Off`, Arpeggio: `Off`.
*   **Bright & Ethereal:** Pad Sound: `Sine`, Pad Filter: `3000-5000 Hz`, Chord Speed: `10-15 seconds`, Heartbeat: `Off`, Arpeggio: `On`.
*   **Dark & Rhythmic:** Pad Sound: `Square` or `Sawtooth`, Pad Filter: `500-1000 Hz`, Chord Speed: `15-25 seconds`, Heartbeat: `On`, Arpeggio: `Off`.
*   **Active & Flowing:** Pad Sound: `Triangle`, Pad Filter: `2000-4000 Hz`, Chord Speed: `8-12 seconds`, Heartbeat: `On`, Arpeggio: `On`.
