import os
import time
import sounddevice as sd
import soundfile as sf
import pygame # <--- Thư viện mới để phát MP3
from openai import OpenAI
from elevenlabs.client import ElevenLabs

class VoiceInterface:
    def __init__(self):
        print("🎙️ Loading Voice Module (Whisper + ElevenLabs)...")
        
        # 1. Config OpenAI (STT)
        self.openai_client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
        
        # 2. Config ElevenLabs (TTS)
        self.eleven_api_key = os.environ.get("ELEVEN_API_KEY")
        if not self.eleven_api_key:
            print("⚠️ WARNING: Chưa có ELEVEN_API_KEY. Voice sẽ không hoạt động.")
        
        self.eleven_client = ElevenLabs(api_key=self.eleven_api_key)
        self.voice_id = "2EiwWnXFnvU5JabPnv8n" 
        
        # 3. Khởi tạo Pygame Mixer (Để phát MP3)
        try:
            pygame.mixer.init()
        except Exception as e:
            print(f"⚠️ Lỗi khởi tạo Pygame: {e}")

    def record_audio(self, duration=4, fs=24000):
        """Thu âm (Giữ nguyên)"""
        print(f"   (Đang nghe trong {duration}s...)")
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
        """Whisper STT (Giữ nguyên)"""
        if not audio_filename or not os.path.exists(audio_filename): return ""
        try:
            with open(audio_filename, "rb") as audio_file:
                transcript = self.openai_client.audio.transcriptions.create(
                    model="whisper-1", 
                    file=audio_file, 
                    language="vi" 
                )
            return transcript.text.strip()
        except Exception as e:
            print(f"❌ Lỗi Whisper: {e}")
            return ""

    def speak_text(self, text):
        """
        [FIXED] Dùng Pygame để phát MP3 (Hỗ trợ gói Free)
        """
        if not text: return
        print(f"🔊 Đang phát giọng nói (ElevenLabs)...")
        try:
            # 1. Yêu cầu MP3 (Gói Free hỗ trợ cái này)
            audio_stream = self.eleven_client.text_to_speech.convert(
                text=text,
                voice_id=self.voice_id,
                model_id="eleven_turbo_v2_5",
                output_format="mp3_44100_128" # <--- MP3 chuẩn
            )
            
            # 2. Lưu stream vào file tạm
            temp_file = "temp_speech.mp3"
            with open(temp_file, "wb") as f:
                for chunk in audio_stream:
                    if chunk:
                        f.write(chunk)
            
            # 3. Dùng Pygame để phát file MP3
            if os.path.exists(temp_file):
                pygame.mixer.music.load(temp_file)
                pygame.mixer.music.play()
                
                # Chờ phát xong mới dừng
                while pygame.mixer.music.get_busy():
                    time.sleep(0.1)
                
                # Giải phóng file để lần sau ghi đè được
                pygame.mixer.music.unload()

        except Exception as e:
            print(f"❌ Lỗi ElevenLabs TTS: {e}")

    # --- HÀM CHO SERVER (Giữ nguyên MP3 cho ESP32) ---
    def tts_stream_generator(self, text):
        try:
            return self.eleven_client.text_to_speech.convert(
                text=text,
                voice_id=self.voice_id,
                model_id="eleven_turbo_v2_5",
                output_format="mp3_44100_128"
            )
        except Exception as e:
            print(f"❌ Lỗi Gen Stream: {e}")
            return None