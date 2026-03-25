"""
Graph Memory Module - Advanced Version (EMA + Narrative Support)
Nhiệm vụ: Lưu trữ & Truy xuất lịch sử hội thoại VÀ Hồ sơ tâm lý (Profile) từ Neo4j.
"""
import time
from neo4j import GraphDatabase

class GraphMemory:
    def __init__(self, uri, auth):
        """
        Kết nối tới Neo4j Database
        uri: "bolt://localhost:7687"
        auth: ("neo4j", "password")
        """
        try:
            self.driver = GraphDatabase.driver(uri, auth=auth)
            self.verify_connection()
            print("✅ Memory Connected: Kết nối Neo4j thành công!")
        except Exception as e:
            print(f"❌ Neo4j Connection Failed: {e}")
            self.driver = None # Đánh dấu là không có kết nối

    def verify_connection(self):
        if self.driver:
            with self.driver.session() as session:
                session.run("RETURN 1")
            
    def close(self):
        if self.driver:
            self.driver.close()

    # --- PHẦN 1: QUẢN LÝ HỘI THOẠI ---

    def add_turn(self, user_id: str, user_input: str, emotion: str, ai_response: str):
        """
        Lưu một lượt hội thoại (Turn) vào Graph
        """
        if not self.driver: return

        query = """
        MERGE (u:User {id: $user_id})
        CREATE (t:Turn {
            user_input: $user_input,
            ai_response: $ai_response,
            emotion: $emotion,
            timestamp: $timestamp
        })
        CREATE (u)-[:HAS_TURN]->(t)
        """
        try:
            with self.driver.session() as session:
                session.run(query, 
                            user_id=user_id, 
                            user_input=user_input, 
                            ai_response=ai_response, 
                            emotion=emotion, 
                            timestamp=time.time())
        except Exception as e:
            print(f"⚠️ Memory Write Error: {e}")

    # Stopwords to filter out when extracting keywords for relevance matching
    _STOPWORDS = {
        "the", "a", "an", "is", "am", "are", "i", "my", "me",
        "to", "and", "of", "in", "it", "that", "so", "do", "was",
        "have", "has", "been", "but", "not", "no", "just", "very",
        "really", "feel", "feeling", "this", "what", "how", "you",
        "your", "they", "them", "we", "our", "can", "will", "would",
        "should", "could", "about", "with", "for", "from", "on", "at",
    }

    def _extract_keywords(self, message: str) -> list:
        """Extract meaningful keywords from a message for relevance matching."""
        words = message.lower().split()
        return [w for w in words if len(w) >= 3 and w not in self._STOPWORDS]

    def get_context(self, user_id: str, limit: int = 10,
                    current_emotion: str = None,
                    current_message: str = None) -> str:
        """
        Lấy ngữ cảnh hội thoại đã được LỌC TRÙNG và LÀM SẠCH.
        When current_emotion/current_message are provided, returns only
        relevant turns: 3 most recent + older turns matching emotion or keywords.
        """
        if not self.driver: return ""

        # --- Default behavior (no filtering) ---
        if current_emotion is None and current_message is None:
            query = """
            MATCH (u:User {id: $user_id})-[:HAS_TURN]->(t:Turn)
            RETURN t.user_input AS input, t.ai_response AS response, t.timestamp AS time
            ORDER BY t.timestamp DESC
            LIMIT $limit
            """
            try:
                with self.driver.session() as session:
                    result = session.run(query, user_id=user_id, limit=limit)
                    raw_history = [record for record in result]
                    raw_history.reverse()
                    return self._format_turns(raw_history)
            except Exception as e:
                print(f"⚠️ Error retrieving context: {e}")
                return ""

        # --- Filtered behavior (relevance-based) ---
        try:
            with self.driver.session() as session:
                # Part A: Always keep 3 most recent turns
                recent_query = """
                MATCH (u:User {id: $user_id})-[:HAS_TURN]->(t:Turn)
                RETURN t.user_input AS input, t.ai_response AS response, t.timestamp AS time
                ORDER BY t.timestamp DESC
                LIMIT 3
                """
                recent_result = session.run(recent_query, user_id=user_id)
                recent_turns = [record for record in recent_result]

                # Part B: From older turns, filter by emotion or keyword match
                keywords = self._extract_keywords(current_message) if current_message else []
                older_limit = max(limit - 3, 4)

                if keywords and current_emotion:
                    older_query = """
                    MATCH (u:User {id: $user_id})-[:HAS_TURN]->(t:Turn)
                    WITH t ORDER BY t.timestamp DESC SKIP 3
                    WHERE t.emotion = $current_emotion
                       OR any(word IN $keywords WHERE toLower(t.user_input) CONTAINS toLower(word))
                    RETURN t.user_input AS input, t.ai_response AS response, t.timestamp AS time
                    ORDER BY t.timestamp DESC
                    LIMIT $older_limit
                    """
                    older_result = session.run(older_query, user_id=user_id,
                                               current_emotion=current_emotion,
                                               keywords=keywords,
                                               older_limit=older_limit)
                elif current_emotion:
                    older_query = """
                    MATCH (u:User {id: $user_id})-[:HAS_TURN]->(t:Turn)
                    WITH t ORDER BY t.timestamp DESC SKIP 3
                    WHERE t.emotion = $current_emotion
                    RETURN t.user_input AS input, t.ai_response AS response, t.timestamp AS time
                    ORDER BY t.timestamp DESC
                    LIMIT $older_limit
                    """
                    older_result = session.run(older_query, user_id=user_id,
                                               current_emotion=current_emotion,
                                               older_limit=older_limit)
                else:
                    older_query = """
                    MATCH (u:User {id: $user_id})-[:HAS_TURN]->(t:Turn)
                    WITH t ORDER BY t.timestamp DESC SKIP 3
                    WHERE any(word IN $keywords WHERE toLower(t.user_input) CONTAINS toLower(word))
                    RETURN t.user_input AS input, t.ai_response AS response, t.timestamp AS time
                    ORDER BY t.timestamp DESC
                    LIMIT $older_limit
                    """
                    older_result = session.run(older_query, user_id=user_id,
                                               keywords=keywords,
                                               older_limit=older_limit)

                older_turns = [record for record in older_result]

                # Part C: Combine — recent first, then older, deduplicate
                combined = recent_turns
                combined.reverse()  # chronological order
                older_turns.reverse()
                combined = older_turns + combined  # older first, recent last

                return self._format_turns(combined)

        except Exception as e:
            print(f"⚠️ Error retrieving filtered context: {e}")
            return ""

    def _format_turns(self, records) -> str:
        """Deduplicate and format turn records into context string."""
        seen_inputs = set()
        clean_lines = []

        for record in records:
            u_in = record['input'].strip()
            ai_res = record['response'].strip()

            if u_in in seen_inputs:
                continue
            seen_inputs.add(u_in)

            clean_lines.append(f"User: {u_in}")
            if ai_res and "System: Acknowledged" not in ai_res:
                clean_lines.append(f"Soulmate: {ai_res}")

        return "\n".join(clean_lines)

    def get_conflict_history(self, user_id: str, target_name: str, limit: int = 5) -> str:
        """
        Truy xuất các đoạn hội thoại trong quá khứ liên quan đến một nhân vật (target_name).
        Dùng để làm 'Ký ức xích mích' đắp vào Prompt cho chế độ Empty Chair (GraphRAG).
        """
        if not self.driver: return "Không có dữ liệu lịch sử."

        # Dùng Cypher để tìm các Turn có chứa target_name (không phân biệt hoa thường)
        query = """
        MATCH (u:User {id: $user_id})-[:HAS_TURN]->(t:Turn)
        WHERE toLower(t.user_input) CONTAINS toLower($target_name) 
           OR toLower(t.ai_response) CONTAINS toLower($target_name)
        RETURN t.user_input AS input, t.emotion AS emotion, t.timestamp AS time
        ORDER BY t.timestamp DESC
        LIMIT $limit
        """
        try:
            with self.driver.session() as session:
                result = session.run(query, user_id=user_id, target_name=target_name, limit=limit)
                
                history_lines = []
                for record in result:
                    u_in = record['input'].strip()
                    emo = record['emotion']
                    # Gắn thêm tag cảm xúc để AI biết user đã từng bực tức thế nào
                    history_lines.append(f"- User previously said (Emotion: {emo}): {u_in}")
                
                if not history_lines:
                    return f"User chưa có dữ liệu cụ thể nào về {target_name} trong quá khứ. Hãy đóng vai {target_name} dựa trên tính cách được giao."
                
                return "\n".join(history_lines)

        except Exception as e:
            print(f"⚠️ Error retrieving conflict history: {e}")
            return "Lỗi khi truy xuất dữ liệu lịch sử."

    # --- PHẦN 2: QUẢN LÝ PROFILE (OCEAN - EMA SMOOTHING) ---

    def update_user_profile(self, user_id: str, input_traits: dict):
        """
        Cập nhật chỉ số OCEAN sử dụng EMA (Exponential Moving Average).
        TRẢ VỀ: (smoothed_traits, deltas) để hiển thị ra màn hình.
        """
        # Nếu driver lỗi, trả về tuple rỗng để main.py không bị crash
        if not self.driver: return {}, {}

        # 1. Lấy Profile hiện tại từ DB
        current_profile = self.get_user_profile(user_id)
        
        # 2. Cấu hình hệ số làm mượt
        ALPHA = 0.15 
        
        ocean_keys = ["openness", "conscientiousness", "extraversion", "agreeableness", "neuroticism"]
        smoothed_traits = {}
        deltas = {} # <--- [QUAN TRỌNG] Biến lưu sự thay đổi điểm số

        # 3. Tính toán EMA cho từng chỉ số
        for key in ocean_keys:
            old_val = current_profile.get(key, 0.5)
            new_input_val = input_traits.get(key, old_val) 
            
            # CÔNG THỨC EMA
            smoothed_val = (new_input_val * ALPHA) + (old_val * (1.0 - ALPHA))
            
            # Làm tròn
            smoothed_traits[key] = round(smoothed_val, 3)
            
            # [QUAN TRỌNG] Tính Delta (Mới - Cũ)
            diff = smoothed_val - old_val
            if abs(diff) >= 0.001: # Chỉ lấy nếu có thay đổi đáng kể
                deltas[key] = diff

        # 4. Chuẩn bị lưu vào Neo4j
        ts = int(time.time())
        date_str = time.strftime("%Y-%m-%d %H:%M:%S")

        query_update_current = """
        MERGE (u:User {id: $user_id})
        MERGE (u)-[:HAS_PROFILE]->(p:Profile)
        SET p += $traits
        SET p.last_updated = $timestamp
        """

        query_save_history = """
        MATCH (u:User {id: $user_id})
        CREATE (s:PersonalitySnapshot {
            timestamp: $timestamp,
            date_str: $date_str,
            openness: $o,
            conscientiousness: $c,
            extraversion: $e,
            agreeableness: $a,
            neuroticism: $n
        })
        CREATE (u)-[:HAS_HISTORY]->(s)
        """

        try:
            with self.driver.session() as session:
                # Lưu Profile Mới
                session.run(query_update_current, 
                            user_id=user_id, 
                            traits=smoothed_traits, 
                            timestamp=ts)
                
                # Lưu Lịch sử
                session.run(query_save_history,
                            user_id=user_id,
                            timestamp=ts,
                            date_str=date_str,
                            o=smoothed_traits['openness'],
                            c=smoothed_traits['conscientiousness'],
                            e=smoothed_traits['extraversion'],
                            a=smoothed_traits['agreeableness'],
                            n=smoothed_traits['neuroticism']
                            )
                
                print(f"🧠 [Memory] Updated OCEAN (EMA): {smoothed_traits}")
                
                # --- [QUAN TRỌNG NHẤT] TRẢ VỀ KẾT QUẢ CHO MAIN.PY ---
                return smoothed_traits, deltas

        except Exception as e:
            print(f"⚠️ Profile Update Error: {e}")
            return {}, {} # Trả về tuple rỗng nếu có lỗi

    def get_user_profile(self, user_id: str) -> dict:
        """
        Lấy Profile OCEAN hiện tại của user.
        """
        default_profile = {
            "openness": 0.5, "conscientiousness": 0.5, "extraversion": 0.5, 
            "agreeableness": 0.5, "neuroticism": 0.5
        }

        if not self.driver: return default_profile

        query = "MATCH (u:User {id: $user_id})-[:HAS_PROFILE]->(p:Profile) RETURN p"
        try:
            with self.driver.session() as session:
                result = session.run(query, user_id=user_id)
                record = result.single()
                
                if record:
                    node_props = dict(record["p"])
                    return {k: node_props.get(k, 0.5) for k in default_profile}
                else:
                    return default_profile
        except Exception as e:
            print(f"⚠️ Profile Read Error: {e}")
            return default_profile

    # --- PHẦN 3: QUẢN LÝ NARRATIVE (HỒ SƠ VĂN BẢN) ---

    def save_narrative_profile(self, user_id: str, narrative: str):
        """Lưu đoạn văn mô tả tâm lý người dùng"""
        if not self.driver: return
        query = """
        MERGE (u:User {id: $user_id})
        MERGE (u)-[:HAS_PROFILE]->(p:Profile)
        SET p.narrative = $narrative
        """
        try:
            with self.driver.session() as session:
                session.run(query, user_id=user_id, narrative=narrative)
        except Exception as e:
            print(f"⚠️ Narrative Save Error: {e}")

    def get_narrative_profile(self, user_id: str) -> str:
        """Lấy đoạn văn mô tả tâm lý người dùng"""
        if not self.driver: return "No narrative yet."
        query = "MATCH (u:User {id: $user_id})-[:HAS_PROFILE]->(p:Profile) RETURN p.narrative"
        try:
            with self.driver.session() as session:
                result = session.run(query, user_id=user_id)
                record = result.single()
                if record and record["p.narrative"]:
                    return record["p.narrative"]
                return "No narrative yet."
        except Exception as e:
            return "No narrative yet."

# --- Code test nhanh ---
if __name__ == "__main__":
    try:
        mem = GraphMemory("bolt://localhost:7687", ("neo4j", "123456789"))
        
        # Test 1: Update với EMA
        print("--- Test EMA ---")
        traits_data = {"openness": 0.8, "neuroticism": 0.8}
        
        # Hàm mới trả về 2 giá trị -> Phải hứng bằng 2 biến
        profile, delta = mem.update_user_profile("test_user_ema", traits_data)
        
        print(f"New Profile: {profile}")
        print(f"Changes: {delta}")
        
        mem.close()
    except Exception as e:
        print(f"Lỗi: {e}")