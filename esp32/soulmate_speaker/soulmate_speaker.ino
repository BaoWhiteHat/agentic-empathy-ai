/**
 * SoulMate ESP32 Speaker Firmware
 * ---------------------------------
 * Receives MP3 audio from laptop via USB serial and plays through I2S speaker.
 *
 * Wiring (MAX98357A I2S Amplifier):
 *   MAX98357 DIN  → GPIO 22
 *   MAX98357 BCLK → GPIO 26
 *   MAX98357 LRC  → GPIO 25
 *   MAX98357 VDD  → 5V (or 3.3V)
 *   MAX98357 GND  → GND
 *
 * Libraries required (install via Arduino Library Manager):
 *   - ESP32-audioI2S by schreibfaul1
 *
 * Board: ESP32 Dev Module
 * Upload speed: 921600
 */

#include "Arduino.h"
#include "Audio.h"        // ESP32-audioI2S

// ── I2S pin config ───────────────────────────────────────────────────────────
#define I2S_DOUT  22
#define I2S_BCLK  26
#define I2S_LRC   25

// ── Status LED (built-in on most ESP32 boards) ───────────────────────────────
#define LED_PIN   2

// ── Serial protocol ──────────────────────────────────────────────────────────
// Backend sends: [4 bytes uint32 LE = length] [MP3 bytes...]
#define SERIAL_BAUD  921600
#define MAX_MP3_SIZE (512 * 1024)  // 512 KB max buffer

Audio audio;

uint8_t* mp3Buffer = nullptr;
uint32_t mp3Size   = 0;
uint32_t bytesRead = 0;
bool     receiving = false;

void setup() {
  Serial.begin(SERIAL_BAUD);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  audio.setPinout(I2S_BCLK, I2S_LRC, I2S_DOUT);
  audio.setVolume(18);  // 0–21

  mp3Buffer = (uint8_t*)ps_malloc(MAX_MP3_SIZE);  // use PSRAM if available
  if (!mp3Buffer) {
    mp3Buffer = (uint8_t*)malloc(MAX_MP3_SIZE);    // fallback to SRAM
  }

  Serial.println("SoulMate ESP32 Speaker Ready");
}

void loop() {
  // ── Receive audio from serial ─────────────────────────────────────────────
  if (!receiving && Serial.available() >= 4) {
    // Read 4-byte length header
    uint8_t header[4];
    Serial.readBytes(header, 4);
    mp3Size   = (uint32_t)header[0]
              | ((uint32_t)header[1] << 8)
              | ((uint32_t)header[2] << 16)
              | ((uint32_t)header[3] << 24);

    if (mp3Size > 0 && mp3Size <= MAX_MP3_SIZE) {
      bytesRead = 0;
      receiving = true;
      digitalWrite(LED_PIN, HIGH);  // LED on while receiving
    }
  }

  if (receiving) {
    uint32_t available = Serial.available();
    if (available > 0) {
      uint32_t toRead = min(available, mp3Size - bytesRead);
      Serial.readBytes(mp3Buffer + bytesRead, toRead);
      bytesRead += toRead;

      if (bytesRead >= mp3Size) {
        // Full MP3 received — play it
        receiving = false;
        digitalWrite(LED_PIN, LOW);
        audio.connecttospeech_mp3(mp3Buffer, mp3Size);
      }
    }
  }

  // ── Drive audio playback ──────────────────────────────────────────────────
  audio.loop();
}

// Optional: log audio events to Serial for debugging
void audio_info(const char* info) {
  Serial.print("audio_info: ");
  Serial.println(info);
}
