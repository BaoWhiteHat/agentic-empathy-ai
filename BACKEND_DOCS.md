# SoulMate Backend, AI, Evaluation, Voice, and Physical AI Reference

This document describes the current backend implementation in `backend/`, plus evaluation scripts and the ESP32 physical companion path. Source code is authoritative.

## 1. Runtime Entry Point

Main API entry:

- `backend/main.py`

Behavior:

- creates `FastAPI(title="SoulMate API")`
- installs CORS for `http://localhost:3000`
- includes routers from:
  - `backend/api/chat.py`
  - `backend/api/profile.py`
  - `backend/api/voice_monitor.py`
  - `backend/api/reflections.py`
  - `backend/api/companion_control.py`
- on Windows, sets `asyncio.WindowsSelectorEventLoopPolicy()` and wraps stdout/stderr as UTF-8
- lifespan startup constructs the shared `AgenticEmpathySystem`
- lifespan shutdown calls `system.close()`

Dependency singleton:

- `backend/core/dependencies.py`
- `get_system()` lazily constructs one global `AgenticEmpathySystem` instance.

Run command:

```bash
cd backend
uv run uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## 2. Environment and Dependency Files

Backend dependencies are declared at the repository root:

- `pyproject.toml`
- `uv.lock`
- `.python-version` (`3.12`)

Required environment variables:

- `OPENAI_API_KEY`
- `NEO4J_URI`
- `NEO4J_USER`
- `NEO4J_PASSWORD`

Voice/physical companion variables:

- `ELEVEN_API_KEY`
- `ESP32_PORT` (default `COM5`)
- `COMPANION_USER_ID` (default `Ghostman`)

Do not commit real `.env` files.

## 3. AgenticEmpathySystem

Source: `backend/core/engine.py`

Constructed components:

- `PerceptionAgent`
- `InferenceAgent`
- `KnowledgeAgent(reset_db=False)`
- `DialogueAgent`
- `VoiceInterface`
- `RouterAgent`
- `SafetyGuardrail`
- `GraphMemory` when Neo4j is configured and reachable
- `EmptyChairHybridSafety(suicide_threshold=0.2, max_length=256)` when local model files are present
- `EmptyChairAgent(memory, emptychair_safety)`

Neo4j fallback:

- If `NEO4J_PASSWORD` is absent or the driver fails, `self.memory = None`.
- Chat can still generate with RAG/dialogue when possible, but memory, profile, narrative, and reflections are unavailable or degraded.

Empty Chair safety fallback:

- If model loading fails, `self.emptychair_safety = None`.
- Empty Chair still constructs, but DistilBERT-based per-turn routing is absent.

Main public methods:

- `process_brain(...)`: lower-level generation path with explicit booleans for memory/OCEAN/RAG.
- `process_brain_agentic(...)`: production routed path used by chat/voice.
- `background_learning(...)`: asynchronous OCEAN update.
- `manage_reflection(...)`: every 10 turns per user, updates narrative profile.
- `close()`: closes Neo4j and stops audio.

## 4. End-to-End Chat Flow

Normal messaging path:

```text
WebSocket receives text
  -> PerceptionAgent.detect_emotion
  -> SafetyGuardrail.classifier.classify
  -> if self_harm_or_suicide: immediate response, no router/LLM
  -> RouterAgent.decide
  -> safety constraints adjust route
  -> process_brain
  -> optional GraphMemory context/profile
  -> optional KnowledgeAgent RAG examples
  -> DialogueAgent.generate_response
  -> optional memory write
  -> WebSocket message response
  -> background OCEAN update
  -> background narrative reflection check
```

Routing invariant:

- In normal routed production, `use_rag` is forced to `True`.
- The router may add at most one secondary source: Memory or OCEAN.
- Safety can subsequently disable OCEAN, RAG, memory, raw storage, or normal generation.

## 5. API Routes

### Chat WebSocket

Source: `backend/api/chat.py`

Endpoint:

```text
WS /ws/chat/{user_id}
```

Supported incoming actions:

- `send_text` (default)
- `start_recording`
- `stop_recording`
- Empty Chair lifecycle actions:
  - `resume_roleplay`
  - `switch_to_support`
  - `end_session`
  - `check_elevated_mode`
  - `show_reentry_options`

Supported modes:

- `messaging`
- `voice`
- `empty-chair`

Outgoing frames include:

- `message`
- `status`
- `emotion_status`
- `user_speech`
- `audio_chunk`
- `audio_end`
- `safety_decision`
- `crisis_mode`
- `elevated_mode`
- `re_entry_choice`
- `system_message`
- `safety_summary`

Backend onboarding:

- If Neo4j profile values are all near `0.5`, backend starts a three-question onboarding flow over the chat WebSocket.
- After answers are collected, `InferenceAgent.infer_traits(...)` warm-starts the OCEAN profile.

Browser voice note:

- `start_recording` and `stop_recording` call `VoiceInterface.record_audio_ptt()` and `transcribe()`.
- This protocol still exists, but the current frontend Physical tab presents standalone hardware mode rather than a browser PTT UI.

### Profile Routes

Source: `backend/api/profile.py`

- `GET /api/v1/profile/{user_id}`: returns `{user_id, traits}` if memory is ready.
- `GET /profile/ocean/{user_id}`: returns raw OCEAN score dict or an error.
- `GET /api/ocean/{user_id}`: returns OCEAN scores plus `narrative`, with defaults when memory is unavailable.

### Reflections Routes

Source: `backend/api/reflections.py`

- `POST /api/reflections/{user_id}` with `{title, body, mood}`.
- `GET /api/reflections/{user_id}` returns `{reflections: [...]}`.
- `DELETE /api/reflections/{user_id}/{reflection_id}` detach-deletes a reflection owned by the user.

Reflection storage requires `system.memory.driver`.

### Voice Monitor Routes

Source: `backend/api/voice_monitor.py`

- `WS /ws/voice-monitor/{user_id}`: browser observer connection.
- `POST /api/voice-monitor/{user_id}/event`: publishes a monitor event to connected clients.

Events:

- `status`
- `emotion_status`
- `user_speech`
- `message`

This is an event monitor, not an audio recorder.

### Companion Control Routes

Source: `backend/api/companion_control.py`

- `GET /api/companion/status`
- `POST /api/companion/start`
- `POST /api/companion/stop`

Start behavior:

- Spawns `uv run python voice_companion.py` with cwd `backend/`.
- Sets child env `ESP32_PORT="COM5"`, `USE_ESP32="True"`, and `COMPANION_USER_ID=<user_id>`.
- `USE_ESP32` is not actually read by `voice_companion.py`, which uses a hardcoded `USE_ESP32 = True`.

Frontend divergence:

- These endpoints exist, but the active Physical tab does not expose direct start/stop controls.

## 6. AI Modules

### PerceptionAgent

Source: `backend/agent/perception.py`

Input:

- user text

Output:

- `{emotion, confidence}`

Technique:

- Loads keywords from `backend/data/emotion_keywords.json`.
- Scores keyword hits, handles nearby negations, and boosts strong words.
- Loads Hugging Face `SamLowe/roberta-base-go_emotions` via `transformers.pipeline`.
- Maps GoEmotions labels into SoulMate labels such as `happy`, `love`, `depressed`, `fearful`, `ashamed`, `angry`, and `neutral`.
- If the model fails to load, falls back to keyword-only.
- Uppercase text can be treated as angry unless already high-energy.

Limitation:

- Emotion detection is heuristic/model-assisted and should not be treated as mental-state diagnosis.

### SafetyGuardrail

Source: `backend/agent/safety.py`

Risk categories:

- `normal_support`
- `high_distress`
- `clinical_boundary`
- `self_harm_or_suicide`

Decision fields:

- `risk_type`
- `risk_level`
- `allow_router`
- `allow_memory`
- `allow_ocean`
- `allow_rag`
- `safe_mode`
- `store_raw_turn`
- `reason`

Effects:

- `normal_support`: router, memory, OCEAN, RAG, and raw storage allowed.
- `high_distress`: OCEAN disabled, safe prompt enabled, memory/RAG allowed.
- `clinical_boundary`: OCEAN and RAG disabled, safe prompt enabled.
- `self_harm_or_suicide`: router bypassed, no LLM route, no RAG/OCEAN/memory use, raw input not stored.

Memory sanitization:

- Critical self-harm/suicide turns are stored only as generic safety summaries when memory is available.

### RouterAgent

Source: `backend/agent/router.py`

Input:

- seeker post
- detected emotion
- whether history exists
- whether OCEAN profile is non-default
- narrative summary
- OCEAN profile string

Output:

- `use_memory`
- `use_ocean`
- `use_rag`
- `reasoning`

Technique:

- Deterministic guardrails detect concrete self-contained incidents, unresolved referents, and personalization requests.
- LLM decision uses OpenAI `gpt-4o-mini`, temperature `0`, JSON output.
- `use_rag` is forced to `True`.
- If both memory and OCEAN are returned, OCEAN is disabled.
- Memory is disabled without history.
- OCEAN is disabled when all profile values are default/near default.
- On exceptions, falls back to RAG-only.

### KnowledgeAgent and RAG

Source: `backend/agent/knowledge.py`

Input:

- query transcript
- current emotion

Output:

- formatted examples with situation, user emotion, traits, and ideal response

Storage:

- ChromaDB at `backend/chroma_db/` when run from `backend/`.
- Collection: `soulmate_knowledge_base`.
- Embeddings: OpenAI `text-embedding-3-small`.

Retrieval:

- First searches with metadata filter `emotion == current_emotion`.
- Falls back to unfiltered similarity search.
- Returns empty string on retrieval errors.

Build scripts:

- `backend/scripts/build_rag_combined.py`: recommended; builds from 100 percent ESConv train split plus EPITOME level-2 ER/IP/EX rows.
- `backend/scripts/build_rag_from_esconv.py`: older ESConv-only script using first 80 percent of ESConv.

### DialogueAgent

Source: `backend/agent/dialogue.py`

Input:

- user input
- emotion
- response time
- selected memory context
- long-term profile/narrative
- RAG examples
- safety flags/instructions
- OCEAN values

Output:

- final response string

Technique:

- LangChain `ChatOpenAI`
- model: `gpt-4o-mini`
- temperature: `0`
- normal prompt: `SOULMATE_SYSTEM_PROMPT`
- safe prompt: `SOULMATE_SAFETY_SYSTEM_PROMPT`
- fallback response if generation fails

### GraphMemory

Source: `backend/agent/memory.py`

Neo4j nodes/relationships:

- `(:User {id})`
- `(:Turn {user_input, ai_response, emotion, timestamp, risk_level, risk_type, raw_stored})`
- `(:User)-[:HAS_TURN]->(:Turn)`
- `(:Profile {openness, conscientiousness, extraversion, agreeableness, neuroticism, narrative, last_updated})`
- `(:User)-[:HAS_PROFILE]->(:Profile)`
- `(:PersonalitySnapshot {...})`
- `(:User)-[:HAS_HISTORY]->(:PersonalitySnapshot)`
- `(:Reflection {id, title, body, mood, timestamp})`
- `(:User)-[:HAS_REFLECTION]->(:Reflection)`

Context retrieval:

- Default mode returns recent turns.
- Filtered mode keeps the 3 most recent turns, then adds older turns matching current emotion or keyword overlap.
- Duplicate user inputs are removed.

OCEAN updates:

- EMA alpha: `0.15`.
- Defaults all five traits to `0.5`.

Fallback:

- If Neo4j is unavailable, profile reads return defaults and context reads return empty strings.

### InferenceAgent

Source: `backend/agent/inference.py`

Responsibilities:

- Infer OCEAN-style trait values from a turn.
- Reflect on recent history into a narrative profile.

Models:

- Fast model: `gpt-4o-mini`, temperature `0.1`.
- Slow reflection model: `gpt-4o`, temperature `0.4`.

Fallback:

- OCEAN parse failures return neutral/default values.

### EmptyChairAgent

Source: `backend/agent/emptychair_agent.py`

Input:

- user id
- target name
- relationship
- unspoken need
- user input
- emotion
- optional precomputed safety decision

Output:

- in-character roleplay response, safe roleplay response, or crisis-safe response

Technique:

- OpenAI `gpt-4o-mini`, temperature `0.7`.
- Uses `GraphMemory.get_conflict_history(...)` when available.
- Saves turns to memory with safety metadata.

### EmptyChairHybridSafety

Source: `backend/agent/emptychair_safety.py`

Model files:

- `backend/models/emptychair_distilbert/config.json`
- `backend/models/emptychair_distilbert/tokenizer.json`
- `backend/models/emptychair_distilbert/tokenizer_config.json`
- `backend/models/emptychair_distilbert/label_encoder.joblib`
- `backend/models/emptychair_distilbert/model.safetensors` (large, gitignored)

Local model labels from `config.json`:

- `self.Anxiety`
- `self.SuicideWatch`
- `self.bipolar`
- `self.depression`
- `self.offmychest`

Pipeline:

1. Keyword override checks 15 explicit crisis phrases.
2. DistilBERT sequence classifier predicts a label.
3. SuicideWatch probability `>= 0.2` triggers `stop_roleplay`.
4. Distress labels Anxiety, Depression, or Bipolar trigger `safe_roleplay`.
5. Other labels default to `normal_roleplay`.

The original SWMH-style source task is a five-class subreddit-label classification setup. SoulMate does not expose those labels as diagnoses. It maps the classifier output and threshold into three product routing actions: `normal_roleplay`, `safe_roleplay`, and `stop_roleplay`.

Outputs:

- `SafetyDecision`, aliased as `EmptyChairSafetyDecision`.

Crisis response:

- Stops roleplay.
- Provides non-clinical support language.
- Shows current visible lines:
  - `Vietnam: 096 306 1414`
  - `US: 988 (Suicide & Crisis Lifeline)`

## 7. Empty Chair WebSocket Lifecycle

Backend session state:

- `target_name`
- `relationship`
- `unspoken_need`
- `crisis_timestamp`
- `elevated_mode_until`
- `post_crisis_lockout`
- `support_mode`
- `crisis_count`

Constants:

- `ELEVATED_MODE_DURATION_SECONDS = 30 * 60`
- `BREATHING_LOCKOUT_SECONDS = 15`
- `DISTILBERT_TIMEOUT_SECONDS = 3.0`

Stop-roleplay path:

- sends `safety_decision`
- sends `crisis_mode`
- sends `elevated_mode`
- stores sanitized safety summary if memory exists
- returns `emptychair_safety.crisis_response()`
- locks roleplay until user chooses a re-entry/support option

Timeout fallback:

- If DistilBERT inference takes longer than 3 seconds, backend creates a synthetic `safe_roleplay` decision.

## 8. VoiceInterface

Source: `backend/agent/voice_io.py`

Responsibilities:

- push-to-talk microphone recording with `sounddevice`
- WAV writing with `soundfile`
- Whisper transcription with OpenAI `whisper-1`
- ElevenLabs MP3 generation
- ElevenLabs raw PCM 16 kHz generation for ESP32
- streaming ElevenLabs MP3 chunks for browser playback

Defaults:

- temporary input path: `backend/agent/temp_input.wav`
- ElevenLabs voice id: `EXAVITQu4vr4xnSDxMaL`
- ElevenLabs model: `eleven_turbo_v2_5`
- Whisper language argument: `vi`

Limitations:

- Depends on local microphone/audio drivers.
- Temporary audio files are runtime artifacts.
- TTS requires `ELEVEN_API_KEY`.

## 9. Physical Companion Process

Source: `backend/voice_companion.py`

Run:

```bash
cd backend
uv run python voice_companion.py
```

Controls:

- Space: start/stop recording
- Q: quit

Optional flags:

- `--test-tone`
- `--test-eyes`

Runtime flow:

```text
Keyboard PTT
  -> VoiceInterface.record_audio_ptt
  -> VoiceInterface.transcribe
  -> PerceptionAgent.detect_emotion
  -> AgenticEmpathySystem.process_brain_agentic(mode="voice")
  -> VoiceInterface.generate_speech_pcm16_stereo_bytes or generate_speech_bytes
  -> ESP32 serial playback or pygame laptop-speaker fallback
  -> background OCEAN/reflection tasks
```

Configuration:

- `COMPANION_USER_ID` default `Ghostman`
- `ESP32_PORT` default `COM5`
- `BAUD_RATE = 921600`
- `USE_ESP32 = True` hardcoded

Fallback:

- If ESP32 serial connection fails, tries pygame laptop-speaker playback.

## 10. ESP32 Firmware

Source:

- `esp32/soulmate_speaker/soulmate_speaker.ino`

Hardware:

- ESP32 NodeMCU / ESP32-class board
- SH1106 128x64 OLED
- MAX98357A I2S amplifier
- speaker

Pins:

- `I2S_DOUT = GPIO27`
- `I2S_BCLK = GPIO26`
- `I2S_LRC = GPIO25`
- `LED_PIN = GPIO2`
- SH1106 uses hardware I2C via U8g2 defaults.

Serial:

- `Serial.begin(921600)`
- RX buffer: 64 KB

Protocol:

- Emotion line: `EMOTION:<label>\n`
- Audio header: ASCII `SOUL`
- Length: 4-byte little-endian unsigned integer
- Audio: 16 kHz, signed 16-bit, mono PCM
- ACK: byte `A` every 4096 consumed bytes

OLED:

- states: neutral, happy, love, sad, anxious, angry, surprise
- animated blinking and gaze
- emotion returns to neutral after 8000 ms idle when not speaking

Audio:

- I2S clock runs continuously.
- Silence is fed while idle to reduce speaker clicks.
- Ring buffer size: 65536 bytes.

## 11. ChromaDB/RAG Construction

Recommended command:

```bash
cd backend
uv run python scripts/build_rag_combined.py
```

`build_rag_combined.py`:

- loads `thu-coai/esconv` from Hugging Face
- uses all ESConv train conversations
- loads EPITOME CSVs from `backend/data/epitome`
- keeps EPITOME rows where `level == 2`
- builds ChromaDB in `backend/chroma_db`
- collection `soulmate_knowledge_base`
- embedding model `text-embedding-3-small`

Local generated ChromaDB storage should not be committed.

## 12. Evaluation

Location:

- `backend/evaluate/benchmark/`

Core accepted benchmark set:

- B1 clean EPITOME empathy
- B2 adapted LongMemEval memory utility
- B3 controlled router correctness

### B1 clean

Scripts:

- `run_benchmark_b1_500.py`
- `finalize_b1_500.py`

Accepted outputs:

- `backend/evaluate/benchmark/results/b1_500/summary_results_b1_500_clean.csv`
- `backend/evaluate/benchmark/results/b1_500/summary_results_b1_500_by_mode_clean.csv`
- `backend/evaluate/benchmark/results/b1_500/results_b1_500_clean.png`

Metrics:

- EPITOME ER, IP, EX
- total score
- EPITOME reference: Sharma et al. (2020), which defines Emotional Reactions, Interpretations, and Explorations for text-based mental health support.

Committed clean mean totals:

- Baseline: `1.768`
- RAG: `2.258`
- RAG+Memory: `2.224`
- RAG+OCEAN: `2.232`
- Agentic: `2.182`
- Full pipeline: `2.246`

Interpretation:

- This does not support a simple "Agentic is best overall" claim.
- It supports the context-overload framing that RAG-only can be strong on self-contained empathy posts.

### B2 adapted LongMemEval

Scripts:

- `run_benchmark_b2_200.py`
- `finalize_b2_200.py`

Accepted output:

- `backend/evaluate/benchmark/results/b2_200/summary_results_b2_200.csv`

Metric:

- normalized answer accuracy

Committed overall accuracy:

- Baseline: `0.005`
- RAG: `0.085`
- RAG+Memory: `0.210`
- Full pipeline: `0.205`

Dataset:

- `backend/data/LongMemEval/longmemeval_s_cleaned.json`
- This local large dataset is ignored and may be absent.
- The file name and runner confirm the project uses an adapted/cleaned local subset. The upstream benchmark is LongMemEval by Wu et al. (2024), not a SoulMate-created dataset.

### B3 controlled routing

Scripts:

- `run_benchmark_b3.py`
- `finalize_b3.py`

Accepted outputs:

- `backend/evaluate/benchmark/results/b3/summary_results_b3.csv`
- `backend/evaluate/benchmark/results/b3/classification_report_b3.csv`
- `backend/evaluate/benchmark/results/b3/confusion_matrix_b3.csv`

Committed result:

- overall accuracy: `1.0`
- macro-F1: `1.0`
- per-class support: 20 each for `rag_only`, `memory`, `ocean`

Interpretation:

- This is a controlled route-selection result, not proof of perfect routing in all real conversations.
- This is a SoulMate project-created benchmark, not an external public benchmark.

### Historical outputs

The repository also contains pilot, stability, full, and legacy result folders. Preserve them as committed evidence, but do not combine incompatible historical results with the current accepted B1/B2/B3 snapshot.

### Empty Chair safety evaluation status

Current repository evidence for Empty Chair safety is source-level and model-metadata based:

- `CRISIS_KEYWORDS`: 15 explicit phrases mapped to `stop_roleplay`.
- DistilBERT local model metadata: five subreddit-derived classes.
- Threshold rule: SuicideWatch probability `>= 0.2` maps to `stop_roleplay`.
- Distress-label rule: Anxiety, Depression, and Bipolar map to `safe_roleplay`.
- Timeout fallback in `api/chat.py`: inference over 3 seconds maps to synthetic `safe_roleplay`.

No final committed standalone Empty Chair raw scored benchmark output was identified in `backend/evaluate/benchmark/results/`. Treat any included research-paper/report SWMH classification and safety-routing results as paper-reported evidence, separate from committed raw benchmark output files. Do not claim additional keyword, TF-IDF, DistilBERT, threshold, or hybrid numeric performance unless it is present in an included paper/report or a committed result file.

### Evaluation commands

```bash
cd backend
uv run python audit_pipeline.py
uv run python evaluate/benchmark/run_benchmark_b1_500.py
uv run python evaluate/benchmark/finalize_b1_500.py
uv run python evaluate/benchmark/run_benchmark_b2_200.py
uv run python evaluate/benchmark/finalize_b2_200.py
uv run python evaluate/benchmark/run_benchmark_b3.py
uv run python evaluate/benchmark/finalize_b3.py
```

## 13. Known Backend and Hardware Limitations

- Non-clinical prototype only.
- Requires external OpenAI services for core generation, routing, embeddings, and transcription.
- Requires ElevenLabs for TTS.
- Neo4j unavailability disables memory/profile/reflection/reflection storage behavior.
- Empty ChromaDB gives no useful RAG context until built.
- Empty Chair DistilBERT weights are large and gitignored; without them, Empty Chair loses DistilBERT safety routing.
- EPITOME scorer `.pth` model weights are large and ignored.
- `COM5` appears as a default/hardcoded value and may be wrong on other machines.
- `USE_ESP32` in `voice_companion.py` is hardcoded rather than read from env.
- Browser voice protocol exists, but the product UI currently emphasizes standalone hardware mode.
- Voice monitor is event observation, not browser-side recording.
- Hardware timing depends on wiring, USB serial reliability, local audio stack, and power.

## 14. References

- Sharma, Ashish, Adam Miner, David Atkins, and Tim Althoff. 2020. "A Computational Approach to Understanding Empathy Expressed in Text-Based Mental Health Support." In *Proceedings of the 2020 Conference on Empirical Methods in Natural Language Processing (EMNLP)*, 5263-5276. Online: Association for Computational Linguistics. DOI: `10.18653/v1/2020.emnlp-main.425`.
- Wu, Di, Hongwei Wang, Wenhao Yu, Yuwei Zhang, Kai-Wei Chang, and Dong Yu. 2024. "LongMemEval: Benchmarking Chat Assistants on Long-Term Interactive Memory." arXiv:`2410.10813`; listed as ICLR 2025 on the arXiv record.
- Ji, Shaoxiong, Xue Li, Zi Huang, and Erik Cambria. 2022. "Suicidal Ideation and Mental Disorder Detection with Attentive Relation Networks." *Neural Computing and Applications* 34:10309-10319. DOI: `10.1007/s00521-021-06208-y`.
- Ji, Shaoxiong, Xue Li, Zi Huang, and Erik Cambria. 2022. "Reddit SuicideWatch and Mental Health Collection (SWMH) for Suicidal Ideation and Mental Disorder Detection." Zenodo. DOI: `10.5281/zenodo.6476179`.
