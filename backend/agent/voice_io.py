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
        print("   (PTT: Recording...)")
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
        if not audio_filename or not os.path.exists(audio_filename):
            return ""
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

    def generate_speech_pcm16_stereo_bytes(self, text) -> bytes | None:
        """Generate raw 16 kHz signed 16-bit MONO PCM bytes for ESP32 I2S playback.

        NOTE: Tên hàm giữ '..._stereo_...' để không phải sửa chỗ gọi, nhưng output
        thực tế là MONO. Chỉ có 1 con MAX98357A (mono). Mono giảm tiêu thụ I2S
        còn 32KB/s, cho phép ACK flow control hoạt động êm với margin lớn.
        """
        if not text:
            return None
        try:
            print("Generating PCM speech...")
            audio_data = self.eleven_client.text_to_speech.convert(
                text=text,
                voice_id=self.voice_id,
                model_id="eleven_turbo_v2_5",
                output_format="pcm_16000"
            )
            mono_pcm = b"".join(chunk for chunk in audio_data if chunk)
            if not mono_pcm:
                return None

            samples = np.frombuffer(mono_pcm, dtype="<i2").astype(np.float32)

            # 1) Trim trailing silence — cắt im lặng cuối
            threshold = 200
            abs_samples = np.abs(samples)
            nonzero = np.where(abs_samples > threshold)[0]
            if len(nonzero) > 0:
                last_nonzero = nonzero[-1]
                cut_at = min(last_nonzero + 480, len(samples))  # giữ 30ms đuôi
                samples = samples[:cut_at]

            # 2) Fade-IN 5ms đầu — chống pop khi bắt đầu
            fade_in = min(80, len(samples))   # 5ms × 16kHz = 80 samples
            if fade_in > 0:
                ramp = np.linspace(0.0, 1.0, fade_in)
                samples[:fade_in] *= ramp

            # 3) Fade-OUT 30ms cuối — chống pop khi kết thúc
            fade_out = min(480, len(samples))  # 30ms × 16kHz = 480 samples
            if fade_out > 0:
                ramp = np.linspace(1.0, 0.0, fade_out)
                samples[-fade_out:] *= ramp

            # 4) Clip về int16 — TRẢ MONO (không column_stack thành stereo)
            samples = np.clip(samples, -32768, 32767).astype("<i2")
            return samples.tobytes()
        except Exception as e:
            print(f"TTS PCM error: {e}")
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