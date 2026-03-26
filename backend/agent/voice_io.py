import os
import numpy as np
import sounddevice as sd
import soundfile as sf
from openai import OpenAI
from elevenlabs.client import ElevenLabs

# Absolute path for mic recording — reliable regardless of CWD
_DIR = os.path.dirname(os.path.abspath(__file__))
_TEMP_INPUT = os.path.join(_DIR, "temp_input.wav")

class VoiceInterface:
    def __init__(self):
        print("🎙️ Loading Voice Module (Whisper + ElevenLabs)...")
        self.openai_client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
        self.eleven_api_key = os.environ.get("ELEVEN_API_KEY")
        self.eleven_client = ElevenLabs(api_key=self.eleven_api_key)
        self.voice_id = "EXAVITQu4vr4xnSDxMaL"  # Sarah — Mature, Reassuring (free premade)

    def record_audio_ptt(self, stop_event, fs=24000, chunk_ms=100):
        """Record until stop_event is set (push-to-talk). No silence threshold needed."""
        chunk_samples = int(fs * chunk_ms / 1000)
        chunks = []
        print("   (PTT: đang ghi âm...)")
        try:
            with sd.InputStream(samplerate=fs, channels=1, dtype='float32') as stream:
                while not stop_event.is_set():
                    data, _ = stream.read(chunk_samples)
                    chunks.append(data.copy())
            if not chunks:
                return None
            recording = np.concatenate(chunks, axis=0)
            sf.write(_TEMP_INPUT, recording, fs)
            print(f"   (PTT xong: {len(recording)/fs:.1f}s)")
            return _TEMP_INPUT
        except Exception as e:
            print(f"❌ Lỗi Mic PTT: {e}")
            return None

    def transcribe(self, audio_filename):
        if not audio_filename or not os.path.exists(audio_filename): return ""
        try:
            with open(audio_filename, "rb") as audio_file:
                transcript = self.openai_client.audio.transcriptions.create(
                    model="whisper-1", file=audio_file, language="vi"
                )
            return transcript.text.strip()
        except Exception as e:
            print(f"❌ Lỗi Whisper: {e}")
            return ""

    def generate_speech_bytes(self, text) -> bytes | None:
        """Generate full TTS audio and return MP3 bytes (for serial/local playback)."""
        if not text:
            return None
        try:
            print(f"🔊 Generating speech...")
            audio_data = self.eleven_client.text_to_speech.convert(
                text=text,
                voice_id=self.voice_id,
                model_id="eleven_turbo_v2_5",
                output_format="mp3_44100_128"
            )
            return b"".join(chunk for chunk in audio_data if chunk)
        except Exception as e:
            print(f"❌ TTS error: {e}")
            return None

    def stream_speech_chunks(self, text):
        """Yield MP3 byte chunks from ElevenLabs streaming TTS as they arrive."""
        if not text:
            return
        try:
            print(f"🔊 SoulMate đang tổng hợp giọng nói (streaming)...")
            for chunk in self.eleven_client.text_to_speech.stream(
                text=text,
                voice_id=self.voice_id,
                model_id="eleven_turbo_v2_5",
                output_format="mp3_44100_128"
            ):
                if chunk:
                    yield chunk
        except Exception as e:
            print(f"❌ Lỗi TTS stream: {e}")
