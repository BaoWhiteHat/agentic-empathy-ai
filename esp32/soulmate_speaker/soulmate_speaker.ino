#include <Arduino.h>
#include <driver/i2s.h>
#include <math.h>
#include <Wire.h>
#include <U8g2lib.h>

#define I2S_DOUT 27
#define I2S_BCLK 26
#define I2S_LRC  25
#define LED_PIN  2

U8G2_SH1106_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, U8X8_PIN_NONE);
const int cX = 64;
const int cY = 28;

enum EyeState { EYE_NEUTRAL=0, EYE_HAPPY, EYE_LOVE, EYE_SAD, EYE_ANXIOUS, EYE_ANGRY, EYE_SURPRISE };
volatile EyeState currentEye = EYE_NEUTRAL;
volatile bool     isSpeaking = false;
volatile uint32_t lastEmotionMs = 0;
const uint32_t EMOTION_IDLE_TIMEOUT_MS = 8000;

#define RING_SIZE 65536
static uint8_t  ringBuf[RING_SIZE];
volatile uint32_t ringHead = 0;
volatile uint32_t ringTail = 0;

inline uint32_t ringAvailable() { return (ringHead - ringTail) & (RING_SIZE - 1); }
inline uint32_t ringFree()      { return RING_SIZE - 1 - ringAvailable(); }

uint32_t streamBytesExpected = 0;
uint32_t streamBytesReceived = 0;
bool     streamActive       = false;
int      syncState          = 0;
unsigned long lastByteMs    = 0;

// ── ACK FLOW CONTROL ────────────────────────────────────────────────────────
// Mỗi khi i2s đã play xong ACK_CHUNK_SIZE bytes data thật (KHÔNG tính silence),
// gửi 1 byte 'A' về Python. Python dùng số ACK này để giới hạn outstanding
// = sent - acked ≤ WINDOW_BYTES (½ ring) → ring không bao giờ overflow.
// PHẢI khớp với ACK_CHUNK trong Python.
volatile uint32_t bytesConsumedSinceAck = 0;
const uint32_t ACK_CHUNK_SIZE = 4096;
// ─────────────────────────────────────────────────────────────────────────────

char    emotionBuf[32];
uint8_t emotionLen   = 0;
bool    inEmotionLine = false;
int     emotionMatch = 0;
const char EMOTION_PREFIX[] = "EMOTION:";

EyeState parseEmotionName(const char* name) {
  if (!strcmp(name, "happy")    || !strcmp(name, "joy"))       return EYE_HAPPY;
  if (!strcmp(name, "love"))                                   return EYE_LOVE;
  if (!strcmp(name, "sad")      || !strcmp(name, "depressed")
                                || !strcmp(name, "ashamed"))   return EYE_SAD;
  if (!strcmp(name, "anxious")  || !strcmp(name, "fearful")
                                || !strcmp(name, "fear"))      return EYE_ANXIOUS;
  if (!strcmp(name, "angry")    || !strcmp(name, "disgust"))   return EYE_ANGRY;
  if (!strcmp(name, "surprise") || !strcmp(name, "confusion")) return EYE_SURPRISE;
  return EYE_NEUTRAL;
}

bool feedEmotionParser(char c) {
  if (inEmotionLine) {
    if (c == '\n' || c == '\r') {
      emotionBuf[emotionLen] = '\0';
      for (uint8_t i = 0; i < emotionLen; i++)
        if (emotionBuf[i] >= 'A' && emotionBuf[i] <= 'Z') emotionBuf[i] += 32;
      currentEye = parseEmotionName(emotionBuf);
      lastEmotionMs = millis();
      inEmotionLine = false;
      emotionLen = 0;
      emotionMatch = 0;
    } else if (emotionLen < sizeof(emotionBuf) - 1) {
      emotionBuf[emotionLen++] = c;
    }
    return true;
  }
  if (c == EMOTION_PREFIX[emotionMatch]) {
    emotionMatch++;
    if (EMOTION_PREFIX[emotionMatch] == '\0') {
      inEmotionLine = true;
      emotionLen = 0;
    }
    return true;
  }
  if (emotionMatch > 0) {
    emotionMatch = (c == EMOTION_PREFIX[0]) ? 1 : 0;
    return true;
  }
  return false;
}

void drawHeart(int cx, int cy) {
  u8g2.drawDisc(cx - 4, cy - 2, 4);
  u8g2.drawDisc(cx + 4, cy - 2, 4);
  u8g2.drawTriangle(cx - 8, cy + 1, cx + 8, cy + 1, cx, cy + 9);
}

void renderEyes(EyeState eye, int dx, int dy, bool blinking) {
  u8g2.clearBuffer();
  switch (eye) {
    case EYE_HAPPY:
      u8g2.drawCircle(cX - 18 + dx, cY + dy + 8, 10, U8G2_DRAW_UPPER_RIGHT | U8G2_DRAW_UPPER_LEFT);
      u8g2.drawCircle(cX + 18 + dx, cY + dy + 8, 10, U8G2_DRAW_UPPER_RIGHT | U8G2_DRAW_UPPER_LEFT);
      u8g2.drawCircle(cX + dx, cY + dy + 20, 10, U8G2_DRAW_LOWER_RIGHT | U8G2_DRAW_LOWER_LEFT);
      break;
    case EYE_LOVE:
      if (blinking) { u8g2.drawBox(cX - 25 + dx, cY + dy, 14, 3); u8g2.drawBox(cX + 11 + dx, cY + dy, 14, 3); }
      else { drawHeart(cX - 18 + dx, cY - 4 + dy); drawHeart(cX + 18 + dx, cY - 4 + dy); }
      u8g2.drawCircle(cX + dx, cY + dy + 20, 8, U8G2_DRAW_LOWER_RIGHT | U8G2_DRAW_LOWER_LEFT);
      break;
    case EYE_SAD:
      if (blinking) { u8g2.drawBox(cX - 25 + dx, cY + dy, 14, 3); u8g2.drawBox(cX + 11 + dx, cY + dy, 14, 3); }
      else {
        u8g2.drawDisc(cX - 18 + dx, cY + 2 + dy, 7);
        u8g2.drawDisc(cX + 18 + dx, cY + 2 + dy, 7);
        u8g2.drawDisc(cX - 22 + dx, cY + 12 + dy, 2);
      }
      u8g2.drawCircle(cX + dx, cY + dy + 30, 8, U8G2_DRAW_UPPER_RIGHT | U8G2_DRAW_UPPER_LEFT);
      break;
    case EYE_ANXIOUS: {
      int jx = (millis() / 60) % 3 - 1;
      if (blinking) { u8g2.drawBox(cX - 25 + dx + jx, cY + dy, 14, 3); u8g2.drawBox(cX + 11 + dx + jx, cY + dy, 14, 3); }
      else {
        u8g2.drawDisc(cX - 18 + dx + jx, cY + dy, 9);
        u8g2.drawDisc(cX + 18 + dx + jx, cY + dy, 9);
        u8g2.setDrawColor(0);
        u8g2.drawDisc(cX - 18 + dx + jx, cY + dy, 3);
        u8g2.drawDisc(cX + 18 + dx + jx, cY + dy, 3);
        u8g2.setDrawColor(1);
      }
      u8g2.drawEllipse(cX + dx, cY + dy + 20, 8, 4);
      break;
    }
    case EYE_ANGRY:
      if (blinking) { u8g2.drawBox(cX - 25 + dx, cY + dy, 14, 3); u8g2.drawBox(cX + 11 + dx, cY + dy, 14, 3); }
      else {
        u8g2.drawDisc(cX - 18 + dx, cY + dy, 7);
        u8g2.drawDisc(cX + 18 + dx, cY + dy, 7);
        u8g2.setDrawColor(0);
        u8g2.drawTriangle(cX - 26 + dx, cY - 8 + dy, cX - 10 + dx, cY - 8 + dy, cX - 10 + dx, cY - 1 + dy);
        u8g2.drawTriangle(cX + 10 + dx, cY - 8 + dy, cX + 26 + dx, cY - 8 + dy, cX + 10 + dx, cY - 1 + dy);
        u8g2.setDrawColor(1);
      }
      u8g2.drawLine(cX - 10 + dx, cY + 20 + dy, cX + 10 + dx, cY + 16 + dy);
      break;
    case EYE_SURPRISE:
      if (blinking) { u8g2.drawBox(cX - 25 + dx, cY + dy, 14, 3); u8g2.drawBox(cX + 11 + dx, cY + dy, 14, 3); }
      else {
        u8g2.drawCircle(cX - 18 + dx, cY + dy, 9);
        u8g2.drawCircle(cX + 18 + dx, cY + dy, 9);
        u8g2.drawDisc(cX - 18 + dx, cY + dy, 3);
        u8g2.drawDisc(cX + 18 + dx, cY + dy, 3);
      }
      u8g2.drawCircle(cX + dx, cY + dy + 20, 7);
      break;
    case EYE_NEUTRAL:
    default:
      if (blinking) { u8g2.drawBox(cX - 25 + dx, cY + dy, 14, 3); u8g2.drawBox(cX + 11 + dx, cY + dy, 14, 3); }
      else { u8g2.drawDisc(cX - 18 + dx, cY + dy, 7); u8g2.drawDisc(cX + 18 + dx, cY + dy, 7); }
      u8g2.drawBox(cX - 10 + dx, cY + 18 + dy, 20, 2);
      break;
  }
  u8g2.sendBuffer();
}

void oledTask(void* parameter) {
  uint32_t nextBlinkMs = millis() + random(2000, 5000);
  uint32_t blinkStartMs = 0;
  const uint32_t BLINK_MS = 150;
  uint32_t nextLookMs = millis() + random(4000, 8000);
  uint32_t lookStartMs = 0;
  const uint32_t LOOK_HOLD_MS = 600;
  int lookDx = 0, lookDy = 0;
  for (;;) {
    uint32_t now = millis();
    if (!isSpeaking && currentEye != EYE_NEUTRAL && (now - lastEmotionMs) > EMOTION_IDLE_TIMEOUT_MS)
      currentEye = EYE_NEUTRAL;
    bool blinking = false;
    if (blinkStartMs == 0 && now >= nextBlinkMs) blinkStartMs = now;
    if (blinkStartMs != 0) {
      if (now - blinkStartMs < BLINK_MS) blinking = true;
      else { blinkStartMs = 0; nextBlinkMs = now + random(2000, 5000); }
    }
    if (isSpeaking) {
      lookDx = 0; lookDy = 0; lookStartMs = 0;
      nextLookMs = now + random(4000, 8000);
    } else {
      if (lookStartMs == 0 && now >= nextLookMs) {
        lookStartMs = now;
        lookDx = (int)random(-6, 8); lookDy = (int)random(-3, 4);
      }
      if (lookStartMs != 0 && (now - lookStartMs) >= LOOK_HOLD_MS) {
        lookDx = 0; lookDy = 0; lookStartMs = 0;
        nextLookMs = now + random(4000, 8000);
      }
    }
    renderEyes(currentEye, lookDx, lookDy, blinking);
    vTaskDelay(pdMS_TO_TICKS(66));
  }
}

void serialReaderTask(void* parameter) {
  for (;;) {
    while (Serial.available() > 0) {
      if (streamActive && streamBytesReceived < streamBytesExpected) {
        uint32_t needed = streamBytesExpected - streamBytesReceived;
        uint32_t available = Serial.available();
        uint32_t free = ringFree();
        uint32_t toRead = min(min(needed, available), free);

        if (toRead == 0) {
          vTaskDelay(pdMS_TO_TICKS(2));
          break;
        }

        uint32_t firstChunk = min(toRead, (uint32_t)(RING_SIZE - ringHead));
        Serial.readBytes(&ringBuf[ringHead], firstChunk);
        ringHead = (ringHead + firstChunk) & (RING_SIZE - 1);

        if (toRead > firstChunk) {
          Serial.readBytes(&ringBuf[ringHead], toRead - firstChunk);
          ringHead = (ringHead + (toRead - firstChunk)) & (RING_SIZE - 1);
        }

        streamBytesReceived += toRead;
        lastByteMs = millis();

        if (streamBytesReceived >= streamBytesExpected) {
          streamActive = false;
        }
        continue;
      }

      char c = Serial.read();
      if (feedEmotionParser(c)) continue;

      if      (syncState == 0 && c == 'S') syncState = 1;
      else if (syncState == 1 && c == 'O') syncState = 2;
      else if (syncState == 2 && c == 'U') syncState = 3;
      else if (syncState == 3 && c == 'L') syncState = 4;
      else                                  syncState = (c == 'S') ? 1 : 0;

      if (syncState == 4) {
        while (Serial.available() < 4) delay(1);
        uint8_t header[4];
        Serial.readBytes(header, 4);
        streamBytesExpected = header[0] | (header[1] << 8) |
                              (header[2] << 16) | (header[3] << 24);
        streamBytesReceived = 0;
        streamActive = true;
        bytesConsumedSinceAck = 0;   // Reset ACK counter cho stream mới
        lastByteMs = millis();
        syncState = 0;
      }
    }

    if (streamActive && (millis() - lastByteMs > 2000)) {
      streamActive = false;
    }

    vTaskDelay(1);
  }
}

// I2S clock chạy LIÊN TỤC — feed silence khi idle (chống MAX98357A mute → click).
// Sau mỗi i2s_write data THẬT, gửi 'A' về Python mỗi ACK_CHUNK_SIZE bytes.
void i2sWriterTask(void* parameter) {
  uint8_t chunk[1024];
  static uint8_t sil[1024] = {0};

  for (;;) {
    uint32_t avail = ringAvailable();

    if (avail > 0) {
      uint32_t toWrite = min(avail, (uint32_t)sizeof(chunk));

      uint32_t firstChunk = min(toWrite, (uint32_t)(RING_SIZE - ringTail));
      memcpy(chunk, &ringBuf[ringTail], firstChunk);
      ringTail = (ringTail + firstChunk) & (RING_SIZE - 1);

      if (toWrite > firstChunk) {
        memcpy(&chunk[firstChunk], &ringBuf[ringTail], toWrite - firstChunk);
        ringTail = (ringTail + (toWrite - firstChunk)) & (RING_SIZE - 1);
      }

      size_t bytes_written;
      i2s_write(I2S_NUM_0, chunk, toWrite, &bytes_written, portMAX_DELAY);

      // ── ACK: chỉ tính cho data THẬT (không tính silence padding) ──
      bytesConsumedSinceAck += toWrite;
      while (bytesConsumedSinceAck >= ACK_CHUNK_SIZE) {
        Serial.write('A');
        bytesConsumedSinceAck -= ACK_CHUNK_SIZE;
      }
      // ──────────────────────────────────────────────────────────────

      if (!isSpeaking) {
        isSpeaking = true;
        digitalWrite(LED_PIN, HIGH);
      }
    } else {
      // Ring rỗng → đẩy silence để giữ I2S clock (KHÔNG gửi ACK)
      if (isSpeaking && !streamActive) {
        isSpeaking = false;
        digitalWrite(LED_PIN, LOW);
      }
      size_t bytes_written;
      i2s_write(I2S_NUM_0, sil, sizeof(sil), &bytes_written, portMAX_DELAY);
    }
  }
}

void setup() {
  Serial.setRxBufferSize(1024 * 64);
  Serial.begin(921600);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  i2s_config_t i2s_config = {
      .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_TX),
      .sample_rate = 16000,
      .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
      .channel_format = I2S_CHANNEL_FMT_ONLY_LEFT,   // MONO — khớp data từ Python
      .communication_format = I2S_COMM_FORMAT_STAND_I2S,
      .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
      .dma_buf_count = 16,
      .dma_buf_len = 1024,
      .use_apll = true};

  i2s_pin_config_t pin_config = {
      .bck_io_num = I2S_BCLK,
      .ws_io_num = I2S_LRC,
      .data_out_num = I2S_DOUT,
      .data_in_num = I2S_PIN_NO_CHANGE};

  i2s_driver_install(I2S_NUM_0, &i2s_config, 0, NULL);
  i2s_set_pin(I2S_NUM_0, &pin_config);
  i2s_zero_dma_buffer(I2S_NUM_0);

  u8g2.begin();
  u8g2.clearBuffer();
  u8g2.setFont(u8g2_font_ncenB14_tr);
  u8g2.drawStr(10, 40, "SoulMate");
  u8g2.sendBuffer();
  delay(500);

  xTaskCreatePinnedToCore(serialReaderTask, "serial", 8192, NULL, 3, NULL, 0);
  xTaskCreatePinnedToCore(i2sWriterTask,    "i2s",    8192, NULL, 2, NULL, 1);
  xTaskCreatePinnedToCore(oledTask,         "oled",   8192, NULL, 1, NULL, 1);
}

void loop() {
  vTaskDelay(pdMS_TO_TICKS(1000));
}
