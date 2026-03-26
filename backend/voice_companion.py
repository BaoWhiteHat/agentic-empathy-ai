"""
SoulMate Physical Voice Companion
----------------------------------
Run this script on your laptop to talk to SoulMate through the ESP32 speaker.

Controls:
  SPACE → start / stop recording (push-to-talk toggle)
  Q     → quit

Usage:
  cd backend
  uv run python voice_companion.py

Config:
  Set ESP32_PORT in .env or edit the default below.
  Set USER_ID to your username.
"""

import sys
import os
import asyncio
import threading
import struct
import time

# ── Config ────────────────────────────────────────────────────────────────────
USER_ID   = os.getenv("COMPANION_USER_ID", "Ghostman")
ESP32_PORT = os.getenv("ESP32_PORT", "COM3")          # Change to your port
BAUD_RATE  = 921600
USE_ESP32  = False  # Set False to play audio on laptop speakers instead
# ─────────────────────────────────────────────────────────────────────────────

from dotenv import load_dotenv
load_dotenv(override=True)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.engine import AgenticEmpathySystem

# Optional serial import — only fail if USE_ESP32 is True
serial_conn = None
if USE_ESP32:
    try:
        import serial
        serial_conn = serial.Serial(ESP32_PORT, BAUD_RATE, timeout=1)
        print(f"✅ ESP32 connected on {ESP32_PORT}")
    except Exception as e:
        print(f"⚠️  ESP32 not connected ({e}). Falling back to laptop speaker.")
        USE_ESP32 = False

# Fallback: play on laptop via pygame if ESP32 not available
if not USE_ESP32:
    try:
        import pygame
        pygame.mixer.init()
    except Exception as e:
        print(f"⚠️  pygame not available: {e}")


def send_audio_to_esp32(mp3_bytes: bytes):
    """Send MP3 bytes to ESP32 over serial with a 4-byte length header."""
    if not serial_conn or not serial_conn.is_open:
        return
    header = struct.pack("<I", len(mp3_bytes))  # uint32 little-endian
    serial_conn.write(header + mp3_bytes)
    serial_conn.flush()
    print(f"   → Sent {len(mp3_bytes):,} bytes to ESP32")


def play_on_laptop(mp3_bytes: bytes):
    """Fallback: play audio on laptop speaker via pygame."""
    import io
    try:
        pygame.mixer.music.load(io.BytesIO(mp3_bytes))
        pygame.mixer.music.play()
        print("   🔈 Playing... (press SPACE when done to speak again)")
        while pygame.mixer.music.get_busy():
            time.sleep(0.05)
        print("   ✅ Done speaking\n")
    except Exception as e:
        print(f"❌ Playback error: {e}")


def play_audio(mp3_bytes: bytes):
    if USE_ESP32:
        send_audio_to_esp32(mp3_bytes)
    else:
        play_on_laptop(mp3_bytes)


async def run_companion():
    print("\n🤖 Booting SoulMate Physical Companion...")
    system = AgenticEmpathySystem()
    print("\n✅ SoulMate ready!")
    print("━" * 50)
    print("  SPACE = start/stop recording")
    print("  Q     = quit")
    print("━" * 50 + "\n")

    recording_stop_event: threading.Event | None = None
    recording_task: asyncio.Task | None = None
    is_recording = False

    def on_key(key_char: str):
        nonlocal is_recording, recording_stop_event, recording_task
        return key_char  # handled in main loop

    while True:
        # Wait for keypress
        key = await asyncio.to_thread(_wait_for_key)

        if key == 'q':
            print("\n👋 Goodbye!")
            break

        if key == ' ':
            if not is_recording:
                # ── Start recording ──
                is_recording = True
                recording_stop_event = threading.Event()
                recording_task = asyncio.create_task(
                    asyncio.to_thread(system.voice_io.record_audio_ptt, recording_stop_event)
                )
                print("🎙️  Recording... (press SPACE to stop)")

            else:
                # ── Stop recording ──
                is_recording = False
                print("⏹️  Processing...")

                if recording_stop_event:
                    recording_stop_event.set()

                audio_file = await recording_task if recording_task else None
                recording_stop_event = None
                recording_task = None

                if not audio_file:
                    print("⚠️  No audio captured.\n")
                    continue

                # STT
                print("   🔍 Transcribing...")
                user_text = await asyncio.to_thread(system.voice_io.transcribe, audio_file)
                if not user_text.strip():
                    print("⚠️  No speech detected.\n")
                    continue
                print(f"   🗣️  You: {user_text}")

                # Emotion
                percept = await asyncio.to_thread(system.perception.detect_emotion, user_text)
                emotion = percept.get("emotion", "neutral")
                print(f"   💭 Emotion: {emotion}")

                # Pipeline
                print("   🧠 Thinking...")
                ai_response, _ = await system.process_brain_agentic(user_text, USER_ID, emotion)
                print(f"   🤖 SoulMate: {ai_response}")

                # TTS
                print("   🔊 Generating speech...")
                mp3_bytes = await asyncio.to_thread(system.voice_io.generate_speech_bytes, ai_response)

                if mp3_bytes:
                    play_audio(mp3_bytes)
                else:
                    print("❌ TTS failed.")

                # Background learning (fire and forget)
                asyncio.create_task(system.background_learning(user_text, USER_ID, emotion))
                asyncio.create_task(system.manage_reflection(USER_ID))
                print()


def _wait_for_key() -> str:
    """Block until a relevant key is pressed. Returns the character."""
    try:
        # Windows
        import msvcrt
        while True:
            if msvcrt.kbhit():
                ch = msvcrt.getwch()
                if ch in (' ', 'q', 'Q'):
                    return ch.lower()
            time.sleep(0.05)
    except ImportError:
        # Unix/Mac
        import tty, termios
        fd = sys.stdin.fileno()
        old = termios.tcgetattr(fd)
        try:
            tty.setraw(fd)
            while True:
                ch = sys.stdin.read(1)
                if ch in (' ', 'q', 'Q'):
                    return ch.lower()
        finally:
            termios.tcsetattr(fd, termios.TCSADRAIN, old)


if __name__ == "__main__":
    asyncio.run(run_companion())
