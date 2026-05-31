"""
SoulMate Physical Voice Companion
----------------------------------
Talk to SoulMate through the ESP32 speaker + OLED eyes.

Controls:
  SPACE → start / stop recording (push-to-talk toggle)
  Q     → quit

Usage:
  cd backend
  uv run python voice_companion.py

Flags:
  --test-tone   Send a 3-second 440 Hz MONO tone to the ESP32 and exit
  --test-eyes   Cycle through all 7 OLED eye states (3 s each) and exit
"""

from __future__ import annotations

import sys
import os
import asyncio
import threading
import struct
import time
import math
import io
from typing import Optional, Any

# ── Config ────────────────────────────────────────────────────────────────────
USER_ID    = os.getenv("COMPANION_USER_ID", "Ghostman")
ESP32_PORT = os.getenv("ESP32_PORT", "COM5")
BAUD_RATE  = 921600
USE_ESP32  = True
# ─────────────────────────────────────────────────────────────────────────────

from dotenv import load_dotenv
load_dotenv(override=True)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.engine import AgenticEmpathySystem

# ── Optional dependencies ────────────────────────────────────────────────────
serial_conn: Optional[Any] = None
pygame: Optional[Any] = None

if USE_ESP32:
    try:
        import serial as _serial
        serial_conn = _serial.Serial(ESP32_PORT, BAUD_RATE, timeout=1)
        print(f"✅ ESP32 connected on {ESP32_PORT}")
        time.sleep(2)
        serial_conn.reset_input_buffer()
    except Exception as e:
        print(f"⚠️  ESP32 not connected ({e}). Falling back to laptop speaker.")
        USE_ESP32 = False
        serial_conn = None

if not USE_ESP32:
    try:
        import pygame as _pygame
        _pygame.mixer.init()
        pygame = _pygame
    except Exception as e:
        print(f"⚠️  pygame not available: {e}")
        pygame = None


# ── ESP32 protocol ───────────────────────────────────────────────────────────
def send_emotion_to_esp32(emotion: str) -> None:
    """Send emotion tag to ESP32 BEFORE audio. Format: 'EMOTION:happy\\n'."""
    if serial_conn is None or not serial_conn.is_open:
        return
    emotion_clean = (emotion or "neutral").strip().lower()
    message = f"EMOTION:{emotion_clean}\n".encode("utf-8")
    serial_conn.write(message)
    serial_conn.flush()
    print(f"   👁️  Sent emotion to OLED: {emotion_clean}")


def send_audio_to_esp32(pcm_bytes: bytes) -> None:
    """Stream MONO PCM tới ESP32 với CREDIT-BASED ACK FLOW CONTROL.

    Giao thức:
      1. Python gửi "SOUL" + length (4 bytes LE)
      2. Python gửi data theo CHUNK_SIZE, nhưng giữ
         outstanding = sent - acked ≤ WINDOW_BYTES
      3. ESP32 gửi byte 'A' mỗi khi i2s đã play xong ACK_CHUNK bytes
      4. Mỗi 'A' nhận được → acked += ACK_CHUNK → mở thêm window

    Vì sao cách này fix triệt để:
      - WINDOW_BYTES = ½ ring buffer ESP32 → KHÔNG THỂ overflow
      - Steady state: Python gửi đúng bằng tốc độ ESP32 tiêu thụ (32KB/s mono)
      - Không cần rate limit thủ công (SEND_FASTER) — ACK tự pace
      - Không phụ thuộc clock drift giữa laptop và ESP32
    """
    if serial_conn is None or not serial_conn.is_open:
        return

    # Clear stale ACKs từ stream trước (nếu có)
    serial_conn.reset_input_buffer()

    # ── Header ──
    serial_conn.write(b"SOUL" + struct.pack("<I", len(pcm_bytes)))
    serial_conn.flush()
    time.sleep(0.05)

    # ── Flow control params ── (phải khớp ACK_CHUNK_SIZE ở ESP32)
    WINDOW_BYTES = 32768   # ½ ring (64KB) — an toàn tuyệt đối
    ACK_CHUNK    = 4096    # ESP32 ACK mỗi 4KB đã play
    CHUNK_SIZE   = 2048    # Đơn vị Python write mỗi vòng
    ACK_TIMEOUT  = 2.0     # Fallback nếu mất ACK (USB hiccup)

    sent  = 0
    acked = 0
    last_progress = time.perf_counter()

    while sent < len(pcm_bytes):
        # ── Drain ACKs đang chờ (non-blocking) ──
        waiting = serial_conn.in_waiting
        if waiting:
            data = serial_conn.read(waiting)
            ack_count = data.count(b'A')
            if ack_count:
                acked += ack_count * ACK_CHUNK
                last_progress = time.perf_counter()

        outstanding = sent - acked

        if outstanding >= WINDOW_BYTES:
            # Window đầy → đợi ESP32 consume tiếp
            if time.perf_counter() - last_progress > ACK_TIMEOUT:
                # Mất ACK quá lâu → giả định ESP32 đã consume xong, recover
                print(f"   ⚠️  ACK timeout — recover (sent={sent:,}, acked={acked:,})")
                acked = sent
                last_progress = time.perf_counter()
            else:
                time.sleep(0.002)
            continue

        # ── Gửi chunk tiếp theo ──
        chunk = pcm_bytes[sent:sent + CHUNK_SIZE]
        serial_conn.write(chunk)
        sent += len(chunk)

    serial_conn.flush()

    # Drain final ACKs để hiển thị stat chính xác
    drain_deadline = time.perf_counter() + 0.5
    while acked < sent and time.perf_counter() < drain_deadline:
        waiting = serial_conn.in_waiting
        if waiting:
            data = serial_conn.read(waiting)
            acked += data.count(b'A') * ACK_CHUNK
        else:
            time.sleep(0.01)

    print(f"   -> Sent {sent:,} PCM bytes (ACK flow-controlled, acked≈{min(acked, sent):,})")


def play_on_laptop(mp3_bytes: bytes) -> None:
    """Fallback: play audio on laptop speaker via pygame."""
    if pygame is None:
        print("❌ pygame not available — cannot play on laptop speaker.")
        return
    try:
        pygame.mixer.music.load(io.BytesIO(mp3_bytes))
        pygame.mixer.music.play()
        print("   🔈 Playing... (press SPACE when done to speak again)")
        while pygame.mixer.music.get_busy():
            time.sleep(0.05)
        print("   ✅ Done speaking\n")
    except Exception as e:
        print(f"❌ Playback error: {e}")


def play_audio(audio_bytes: bytes, emotion: str = "neutral") -> None:
    """Send emotion FIRST (for OLED), then audio."""
    if USE_ESP32:
        send_emotion_to_esp32(emotion)
        time.sleep(0.1)
        send_audio_to_esp32(audio_bytes)
    else:
        play_on_laptop(audio_bytes)


def generate_test_tone_pcm(duration_s: float = 3.0, frequency_hz: float = 440.0) -> bytes:
    """Generate a 16 kHz signed 16-bit MONO PCM sine wave."""
    sample_rate = 16000
    amplitude = int(32767 * 0.65)
    sample_count = int(sample_rate * duration_s)
    frames = bytearray(sample_count * 2)   # mono = 2 bytes/sample

    for i in range(sample_count):
        sample = int(amplitude * math.sin(2 * math.pi * frequency_hz * i / sample_rate))
        struct.pack_into("<h", frames, i * 2, sample)

    return bytes(frames)


# ── Keyboard input (cross-platform) ──────────────────────────────────────────
def _wait_for_key() -> str:
    """Block until SPACE or Q is pressed. Returns the lowercased character."""
    if sys.platform == "win32":
        import msvcrt  # type: ignore[import-not-found]
        while True:
            if msvcrt.kbhit():
                ch = msvcrt.getwch()
                if ch in (' ', 'q', 'Q'):
                    return ch.lower()
            time.sleep(0.05)
    else:
        import tty       # type: ignore[import-not-found]
        import termios   # type: ignore[import-not-found]
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


# ── Main loop ────────────────────────────────────────────────────────────────
async def run_companion() -> None:
    print("\n🤖 Booting SoulMate Physical Companion...")
    system = AgenticEmpathySystem()
    print("\n✅ SoulMate ready!")
    print("━" * 50)
    print("  SPACE = start/stop recording")
    print("  Q     = quit")
    print("━" * 50 + "\n")

    if USE_ESP32:
        send_emotion_to_esp32("neutral")

    recording_stop_event: Optional[threading.Event] = None
    recording_task: Optional[asyncio.Task] = None
    is_recording = False

    while True:
        key = await asyncio.to_thread(_wait_for_key)

        if key == 'q':
            print("\n👋 Goodbye!")
            if USE_ESP32:
                send_emotion_to_esp32("neutral")
            break

        if key == ' ':
            if not is_recording:
                is_recording = True
                recording_stop_event = threading.Event()
                recording_task = asyncio.create_task(
                    asyncio.to_thread(system.voice_io.record_audio_ptt, recording_stop_event)
                )
                print("🎙️  Recording... (press SPACE to stop)")

            else:
                is_recording = False
                print("⏹️  Processing...")

                if recording_stop_event is not None:
                    recording_stop_event.set()

                audio_file = await recording_task if recording_task is not None else None
                recording_stop_event = None
                recording_task = None

                if not audio_file:
                    print("⚠️  No audio captured.\n")
                    continue

                print("   🔍 Transcribing...")
                user_text = await asyncio.to_thread(system.voice_io.transcribe, audio_file)
                if not user_text.strip():
                    print("⚠️  No speech detected.\n")
                    continue
                print(f"   🗣️  You: {user_text}")

                percept = await asyncio.to_thread(system.perception.detect_emotion, user_text)
                emotion = percept.get("emotion", "neutral")
                print(f"   💭 Emotion: {emotion}")

                print("   🧠 Thinking...")
                ai_response, _routing_info, safety_info = await system.process_brain_agentic(
                    user_text,
                    USER_ID,
                    emotion,
                    mode="voice",
                )
                print(f"   🤖 SoulMate: {ai_response}")

                print("   🔊 Generating speech...")
                if USE_ESP32:
                    audio_bytes = await asyncio.to_thread(
                        system.voice_io.generate_speech_pcm16_stereo_bytes,
                        ai_response,
                    )
                else:
                    audio_bytes = await asyncio.to_thread(
                        system.voice_io.generate_speech_bytes, ai_response
                    )

                if audio_bytes:
                    play_audio(audio_bytes, emotion=emotion)
                else:
                    print("❌ TTS failed.")

                if safety_info.get("risk_type") != "self_harm_or_suicide":
                    asyncio.create_task(system.background_learning(user_text, USER_ID, emotion))
                asyncio.create_task(system.manage_reflection(USER_ID))
                print()


# ── Entry point ──────────────────────────────────────────────────────────────
if __name__ == "__main__":
    if "--test-tone" in sys.argv:
        if not USE_ESP32 or serial_conn is None:
            print("ESP32 is disabled or not connected; cannot send test tone.")
            raise SystemExit(1)
        print("Sending 3-second ESP32 test tone (mono)...")
        send_audio_to_esp32(generate_test_tone_pcm())
        raise SystemExit(0)

    if "--test-eyes" in sys.argv:
        if not USE_ESP32 or serial_conn is None:
            print("ESP32 not connected.")
            raise SystemExit(1)
        print("Testing all 7 eye states (3 seconds each)...")
        emotions = ["happy", "sad", "angry", "anxious", "love", "surprise", "neutral"]
        for emo in emotions:
            print(f"  → {emo}")
            send_emotion_to_esp32(emo)
            time.sleep(3)
        raise SystemExit(0)

    asyncio.run(run_companion())