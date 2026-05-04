#include <driver/i2s.h>
#include <math.h>

#define I2S_DOUT 22
#define I2S_BCLK 26
#define I2S_LRC 25
#define LED_PIN 2
#define ENABLE_BOOT_TEST_TONE true

uint32_t pcmSize = 0;
uint32_t bytesRead = 0;
bool receiving = false;
int syncState = 0;
unsigned long lastReceiveTime = 0;

void playTestTone(int durationMs = 800, float frequency = 880.0)
{
  const int sampleRate = 16000;
  const int framesPerChunk = 256;
  int16_t buffer[framesPerChunk * 2];
  int totalFrames = (sampleRate * durationMs) / 1000;
  int frameIndex = 0;

  while (frameIndex < totalFrames)
  {
    int framesThisChunk = min(framesPerChunk, totalFrames - frameIndex);

    for (int i = 0; i < framesThisChunk; i++)
    {
      float phase = 2.0 * PI * frequency * (frameIndex + i) / sampleRate;
      int16_t sample = (int16_t)(sin(phase) * 18000);
      buffer[i * 2] = sample;
      buffer[i * 2 + 1] = sample;
    }

    size_t bytesWritten;
    i2s_write(I2S_NUM_0, buffer, framesThisChunk * 2 * sizeof(int16_t), &bytesWritten, portMAX_DELAY);
    frameIndex += framesThisChunk;
  }

  i2s_zero_dma_buffer(I2S_NUM_0);
}

void setup()
{
  // MỞ RỘNG PHỄU NHẬN LÊN 32KB ĐỂ HỨNG BĂNG CHUYỀN
  Serial.setRxBufferSize(1024 * 32);
  Serial.begin(921600);
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  i2s_config_t i2s_config = {
      .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_TX),
      .sample_rate = 16000,
      .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
      .channel_format = I2S_CHANNEL_FMT_RIGHT_LEFT,
      .communication_format = I2S_COMM_FORMAT_STAND_I2S,
      .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
      .dma_buf_count = 8,
      .dma_buf_len = 1024,
      .use_apll = false};

  i2s_pin_config_t pin_config = {
      .bck_io_num = I2S_BCLK,
      .ws_io_num = I2S_LRC,
      .data_out_num = I2S_DOUT,
      .data_in_num = I2S_PIN_NO_CHANGE};

  i2s_driver_install(I2S_NUM_0, &i2s_config, 0, NULL);
  i2s_set_pin(I2S_NUM_0, &pin_config);

  if (ENABLE_BOOT_TEST_TONE)
  {
    delay(300);
    playTestTone();
  }

  Serial.println("SoulMate Sliding Window Protocol Ready");
}

void loop()
{
  if (!receiving)
  {
    while (Serial.available() > 0 && !receiving)
    {
      char c = Serial.read();
      if (syncState == 0 && c == 'S')
        syncState = 1;
      else if (syncState == 1 && c == 'O')
        syncState = 2;
      else if (syncState == 2 && c == 'U')
        syncState = 3;
      else if (syncState == 3 && c == 'L')
        syncState = 4;
      else
        syncState = (c == 'S') ? 1 : 0;

      if (syncState == 4)
      {
        while (Serial.available() < 4)
        {
          delay(1);
        }
        uint8_t header[4];
        Serial.readBytes(header, 4);
        pcmSize = header[0] | (header[1] << 8) | (header[2] << 16) | (header[3] << 24);

        if (pcmSize > 0)
        {
          bytesRead = 0;
          receiving = true;
          lastReceiveTime = millis();
          digitalWrite(LED_PIN, HIGH);

          Serial.write('K');
        }
        syncState = 0;
      }
    }
  }

  if (receiving)
  {
    int chunkSize = 2048;
    int remaining = pcmSize - bytesRead;
    int toRead = min(chunkSize, remaining);

    // Loa chỉ gắp ra hát khi phễu có đủ 2048 bytes
    if (Serial.available() >= toRead)
    {
      lastReceiveTime = millis();
      uint8_t buffer[2048];

      // Đọc sạch số byte cần thiết
      Serial.readBytes(buffer, toRead);

      size_t bytes_written;
      i2s_write(I2S_NUM_0, buffer, toRead, &bytes_written, portMAX_DELAY);
      bytesRead += toRead;

      // Hát xong 1 đoạn, réo Laptop thả thêm đoạn mới
      Serial.write('K');

      if (bytesRead >= pcmSize)
      {
        receiving = false;
        digitalWrite(LED_PIN, LOW);
        i2s_zero_dma_buffer(I2S_NUM_0);
      }
    }
    else
    {
      // Hẹn giờ hủy: Chờ quá 2 giây không có dữ liệu thì reset
      if (millis() - lastReceiveTime > 2000)
      {
        receiving = false;
        digitalWrite(LED_PIN, LOW);
        i2s_zero_dma_buffer(I2S_NUM_0);
        while (Serial.available())
          Serial.read();
      }
    }
  }
}
