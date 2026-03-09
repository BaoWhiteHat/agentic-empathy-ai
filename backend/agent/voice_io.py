import os
import time
import sounddevice as sd
import soundfile as sf
import pygame 
from openai import OpenAI
from elevenlabs.client import ElevenLabs

class VoiceInterface:
    def __init__(self):
        print("🎙️ Loading Voice Module (Whisper + ElevenLabs + Pygame)...")
        self.openai_client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
        self.eleven_api_key = os.environ.get("ELEVEN_API_KEY")
        self.eleven_client = ElevenLabs(api_key=self.eleven_api_key)
        self.voice_id = "2EiwWnXFnvU5JabPnv8n" 
        self._init_mixer()

    def _init_mixer(self):
        """Khởi tạo mixer an toàn"""
        try:
            if not pygame.mixer.get_init():
                pygame.mixer.init()
        except Exception as e:
            print(f"⚠️ Lỗi Mixer: {e}")

    def stop_all_audio(self):
        """Dọn dẹp để không bị lỗi CancelledError khi reload"""
        try:
            if pygame.mixer.get_init():
                pygame.mixer.music.stop()
                pygame.mixer.music.unload()
                pygame.mixer.quit()
                print("✅ Pygame Mixer đã nghỉ ngơi.")
        except: pass

    def record_audio(self, duration=4, fs=24000):
        print(f"   (Đang nghe trong {duration}s...)")
        try:
            recording = sd.rec(int(duration * fs), samplerate=fs, channels=1, dtype='float32')
            sd.wait()
            filename = "temp_input.wav"
            sf.write(filename, recording, fs)
            return filename
        except Exception as e:
            print(f"❌ Lỗi Mic: {e}")
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

    def speak_text(self, text):
        """Phát âm thanh qua file tạm (Cách ổn định nhất cho Windows)"""
        if not text: return
        self._init_mixer()
        try:
            print(f"🔊 SoulMate đang trả lời...")
            # Tải toàn bộ audio về (vẫn rất nhanh với model turbo)
            audio_data = self.eleven_client.text_to_speech.convert(
                text=text,
                voice_id=self.voice_id,
                model_id="eleven_turbo_v2_5",
                output_format="mp3_44100_128"
            )
            
            temp_file = "temp_speech.mp3"
            with open(temp_file, "wb") as f:
                for chunk in audio_data:
                    if chunk: f.write(chunk)
            
            if os.path.exists(temp_file):
                pygame.mixer.music.load(temp_file)
                pygame.mixer.music.play()
                while pygame.mixer.music.get_busy():
                    time.sleep(0.1)
                pygame.mixer.music.unload()
                try: os.remove(temp_file) # Xóa file tạm sau khi dùng xong
                except: pass
        except Exception as e:
            print(f"❌ Lỗi Phát âm thanh: {e}")