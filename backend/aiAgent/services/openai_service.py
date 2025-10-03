"""
OpenAI Service
處理所有與 OpenAI API 的互動
"""

import os
import json
from openai import OpenAI
from django.conf import settings


class OpenAIService:
    """OpenAI API 服務封裝"""

    def __init__(self):
        self.client = OpenAI(
            api_key=os.getenv('OPENAI_API_KEY') or getattr(settings, 'OPENAI_API_KEY', None)
        )
        self.model = getattr(settings, 'OPENAI_MODEL', 'gpt-4o-mini')

    def analyze_intent(self, user_input, context=None):
        """
        分析使用者意圖

        Args:
            user_input (str): 使用者輸入
            context (dict): 對話上下文

        Returns:
            dict: 意圖分析結果
        """
        system_prompt = """你是一個寵物社交平台的 AI 助理，專門分析使用者意圖。

請分析使用者的輸入，並返回以下 JSON 格式：
{
    "intent": "operation|health_consultation|user_recommendation|tutorial|feeding|general",
    "sub_type": "具體的子類型",
    "confidence": 0.0-1.0,
    "entities": {
        "timeRange": {"period": 7, "unit": "days"},
        "petBreed": "布偶貓",
        "petType": "貓",
        "symptoms": ["咳嗽", "嘔吐"],
        "feedBrand": "耐吉斯"
    },
    "reason": "為什麼判斷為這個意圖的簡短說明"
}

意圖類型說明：
- operation: 執行系統操作（查找記錄、設置提醒、搜尋醫院）
  子類型: findAbnormalPosts, findHealthRecords, setFeedingReminder, searchNearbyHospitals
  範例: "幫我找異常記錄"、"設定餵食提醒"

- health_consultation: 寵物健康狀況諮詢（根據症狀尋找相似案例）
  子類型: symptom_similar, disease_info, health_advice
  範例: "我的貓最近一直咳嗽怎麼辦"、"狗狗嘔吐該注意什麼"、"布偶貓容易有什麼疾病"
  重點: 會根據寵物類型、品種和症狀，查找其他使用者的疾病檔案（DiseaseArchiveContent）

- user_recommendation: 推薦相似用戶（根據飼養寵物、興趣等推薦）
  子類型: by_pet, by_interest, by_location
  範例: "推薦養布偶貓的用戶"、"有沒有同樣養吉娃娃的朋友"
  重點: 主要是社交目的，推薦志同道合的飼主

- tutorial: 教學引導（如何使用系統功能）
  子類型: tagPet, createPost, setReminder, healthRecord
  範例: "如何標註寵物"、"怎麼發布貼文"

- feeding: 飼料營養建議
  子類型: recommendation, comparison, nutrition
  範例: "推薦老貓肝臟保健的飼料"、"幼犬需要什麼營養"

- general: 一般對話（無法明確分類）
  範例: "你好"、"謝謝"

實體提取重點：
- timeRange: 時間範圍（最近、兩個禮拜、一個月）
- petType: 寵物類型（貓、狗）- 用於 health_consultation
- petBreed: 寵物品種（吉娃娃、布偶貓、黃金獵犬等）- 用於 health_consultation 和 user_recommendation
- symptoms: 症狀列表（咳嗽、嘔吐、發燒、食慾不振等）- 用於 health_consultation
- feedBrand: 飼料品牌（耐吉斯、Royal Canin、Hill's等）- 用於 feeding

判斷準則：
1. 如果提到寵物症狀、疾病、健康問題 → health_consultation
2. 如果想找相似的飼主、交朋友 → user_recommendation
3. 如果想查找或操作自己的記錄 → operation
4. 如果詢問如何使用系統功能 → tutorial
5. 如果詢問飼料、營養 → feeding

**重要：實體提取規則**
1. **優先使用使用者明確提到的資訊**：
   - 如果使用者說「養狗的用戶」→ petType: "狗"（不要補全為具體品種）
   - 如果使用者說「養柴犬的用戶」→ petBreed: "柴犬"
   - 如果使用者說「養貓的朋友」→ petType: "貓"（不要補全為具體品種）

2. **只在以下情況使用使用者的寵物資訊補全**：
   - 使用者用代詞指稱自己的寵物（例如：「牠最近一直咳嗽」、「我的寵物」）
   - 使用者沒有指明任何寵物類型，且詢問的是自己寵物相關的問題

3. **user_recommendation 意圖的特殊規則**：
   - 用戶想找其他飼主時，保持用戶原始的查詢範圍
   - 「養狗的用戶」→ petType: "狗"（不要縮小為具體品種）
   - 只有明確提到品種時才填 petBreed

4. **health_consultation 意圖的特殊規則**：
   - 如果使用者問「狗狗咳嗽」但自己養貓 → 可能是 user_recommendation（想找養狗的人諮詢）
   - 如果使用者說「我的貓咳嗽」→ 使用使用者的寵物資訊補全品種
"""

        user_message = f"使用者輸入：{user_input}"

        # 加入使用者基本資訊和寵物資訊
        if context and 'user' in context:
            user_info = context['user']
            user_context = f"\n\n使用者資訊："
            user_context += f"\n- 名稱: {user_info.get('fullname', user_info.get('username', '未知'))}"

            # 加入寵物資訊
            if 'pets' in user_info and user_info['pets']:
                user_context += f"\n- 飼養的寵物:"
                for pet in user_info['pets']:
                    pet_desc = f"  • {pet.get('name', '未命名')}"
                    if pet.get('breed'):
                        pet_desc += f" ({pet.get('type', '')} - {pet.get('breed', '')})"
                    else:
                        pet_desc += f" ({pet.get('type', '')})"
                    if pet.get('age'):
                        pet_desc += f"，{pet.get('age')}歲"
                    if pet.get('stage'):
                        stage_display = dict([
                            ('puppy', '幼犬'), ('adult', '成犬/成貓'),
                            ('pregnant', '懷孕期'), ('lactating', '哺乳期'),
                            ('kitten', '幼貓')
                        ]).get(pet.get('stage'), pet.get('stage'))
                        pet_desc += f"，{stage_display}"
                    user_context += f"\n{pet_desc}"
            else:
                user_context += f"\n- 尚未登記寵物資訊"

            user_message += user_context

        # 加入對話歷史等其他上下文
        if context and any(k in context for k in ['conversationHistory', 'lastIntent']):
            additional_context = {k: v for k, v in context.items() if k != 'user'}
            if additional_context:
                user_message += f"\n\n對話歷史：{json.dumps(additional_context, ensure_ascii=False)}"

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message}
                ],
                temperature=0.3,
                response_format={"type": "json_object"}
            )

            result = json.loads(response.choices[0].message.content)
            return {
                'success': True,
                'data': result
            }

        except Exception as e:
            print(f"OpenAI 意圖分析錯誤: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'fallback': {
                    'intent': 'general',
                    'confidence': 0.0,
                    'entities': {}
                }
            }

    def generate_response(self, intent_data, retrieved_data, user_input, case_details=None):
        """
        生成最終回應

        Args:
            intent_data (dict): 意圖分析結果
            retrieved_data (dict): 從向量資料庫取得的資料
            user_input (str): 原始使用者輸入
            case_details (list): 案例詳細內容（用於健康諮詢）

        Returns:
            dict: 格式化的回應
        """
        # 判斷意圖類型
        intent = intent_data.get('intent')
        is_health_consultation = intent == 'health_consultation'
        is_feeding = intent == 'feeding'

        if is_health_consultation and case_details:
            system_prompt = """你是 Peter AI，一個友善專業的寵物照護助理，具備豐富的寵物醫療知識。

你的任務是根據以下資訊提供專業的健康建議：
1. 使用者的問題和寵物症狀
2. 從資料庫找到的相似案例（其他飼主的真實經驗）
3. 你作為 AI 助理的醫療知識

**重要：你必須做到以下幾點：**
1. 仔細閱讀並分析每個相似案例的內容
2. 從案例中提取關鍵資訊：
   - 症狀描述
   - 可能的原因
   - 治療方式
   - 結果如何
3. 結合你的醫療知識，給出專業分析和建議
4. 如果多個案例有共同點，要特別指出
5. 提醒飼主何時需要就醫

請生成以下 JSON 格式的回應：
{
    "response": "專業且有同理心的回應文字（繁體中文），包含：\n- 對症狀的理解和同理\n- 從案例中學到的經驗總結\n- 你的專業建議\n- 就醫時機提醒",
    "ui_controls": {
        "hasTutorial": false,
        "tutorialType": null,
        "hasRecommendedUsers": false,
        "hasRecommendedArticles": true,
        "hasCalculator": false,
        "hasOperation": false,
        "operationType": null
    },
    "additional_data": {
        "recommended_user_ids": [],
        "recommended_article_ids": [ARTICLE_IDS_PLACEHOLDER],
        "operation_params": {}
    }
}

**重要**：`recommended_article_ids` 必須填入下方提供的案例 ID 列表。
- 案例已按照相似度排序（最相關的在前面）
- 優先順序：品種+症狀 > 品種 > 同類寵物+症狀 > 同類寵物
- 請返回所有提供的案例 ID（最多 3 個）

回應長度：3-6 句話，包含具體建議和案例分析。
語氣：專業、友善、有同理心，但不要過度承諾療效。
"""
            # 構建詳細的案例資訊和 ID 列表
            cases_summary = self._format_case_details(case_details)
            article_ids = [case['id'] for case in case_details]

            user_message = f"""使用者問題：{user_input}

寵物資訊和症狀：{json.dumps(intent_data.get('entities', {}), ensure_ascii=False)}

找到的相似案例（共 {len(case_details)} 個，已按相似度排序）：
{cases_summary}

案例 ID 列表（請將此列表原樣填入 recommended_article_ids）：{article_ids}

請根據這些真實案例，結合你的專業知識，給使用者提供有價值的健康建議。
記得在回應中提及這些案例的相關性，幫助使用者理解為什麼推薦這些文章。"""

        elif is_feeding:
            # 飼料諮詢意圖
            system_prompt = """你是 Peter AI，一個友善專業的寵物營養顧問。

你的任務是根據以下資訊提供飼料諮詢：
1. 使用者的問題（比較飼料、詢問適合性等）
2. 使用者的寵物資料（類型、年齡、體重、健康狀況）

請生成以下 JSON 格式的回應：
{
    "response": "友善且專業的飼料諮詢（繁體中文），包含：\n- 對使用者問題的理解\n- 飼料的營養特點分析（如果找得到資料）\n- 適合性評估（基於寵物的年齡、健康狀況等）\n- **引導使用者點擊下方的按鈕（「出發計算」或「前往新增」）**",
    "ui_controls": {
        "hasTutorial": false,
        "tutorialType": null,
        "hasRecommendedUsers": false,
        "hasRecommendedArticles": false,
        "hasCalculator": true,  // 如果找到飼料資料為 true；找不到為 false
        "hasOperation": false,  // 如果找不到飼料資料為 true；找到為 false
        "operationType": null   // 如果找不到飼料資料為 "addFeed"；找到為 null
    },
    "additional_data": {
        "recommended_user_ids": [],
        "recommended_article_ids": [],
        "operation_params": {}
    }
}

**重要規則**：
1. 設置 hasCalculator 為 true，讓前端在回應下方顯示「出發計算」按鈕
2. **絕對不要給出具體的每日餵食量或餵食建議（例如：不要說「建議每天餵食XX克」）**
3. 只評估飼料的營養成分是否適合該寵物（例如：蛋白質含量、脂肪含量等）
4. 最後一定要引導使用者：「您可以點擊下方的『出發計算』按鈕，根據寵物的體重和活動量，計算精確的每日餵食量」
5. **不要主動推薦飼料品牌或產品**
6. **如果使用者要求推薦飼料，請禮貌拒絕**，並說明：「我無法主動推薦特定飼料，但我可以幫您分析任何飼料的營養成分，或比較兩種飼料的差異。您有想了解的飼料嗎？」
7. **如果使用者詢問的飼料在資料庫中找不到（recommended_feeds 為空列表）**：
   - 設置 hasCalculator 為 false
   - 設置 hasOperation 為 true
   - 設置 operationType 為 "addFeed"
   - **只告訴使用者**：「很抱歉，我們的資料庫中目前沒有這款飼料的資料。您可以點擊下方的『前往新增』按鈕，幫助我們新增這款飼料的資訊！」
   - **不要提及寵物類型匹配問題**，因為沒有飼料資料就無法判斷類型
8. **如果飼料是未驗證的（is_verified 為 false）**：
   - 在回應中需加入提醒：「⚠️ 提醒您，這款飼料的資料尚未經過驗證，建議您參考時保持謹慎。」
   - 仍然提供營養分析，但標注資料來源可能不完整
9. **多寵物處理規則（只在找到飼料資料時才執行）**：
   - **使用者未指定寵物時**：根據飼料的 pet_type（貓用/狗用）自動篩選相符寵物
   - **若有多隻相同類型寵物**：詢問使用者「您想要為哪一隻寵物諮詢呢？您有 [寵物1名字]、[寵物2名字]...」，列出所有該類型寵物的名字
   - **若只有一隻相符寵物**：直接使用該寵物資料進行分析
   - **若沒有相符類型寵物**：告知使用者「您的寵物資料中沒有適合這款飼料的寵物類型（這款飼料適合[貓/狗]）」

**使用情境**：
- ✅ 比較兩種飼料：「A 飼料和 B 飼料哪個比較適合我的狗？」
  → 分析營養成分差異，說明各自的優缺點，基於寵物的年齡、健康狀況給出適合性評估

- ✅ 詢問適合性：「這款飼料適合我的老貓嗎？」
  → 根據寵物的年齡、體重、健康狀況，評估該飼料的營養成分是否合適

- ✅ 營養諮詢：「高蛋白飼料對幼犬好嗎？」
  → 解釋營養成分對寵物健康的影響

- ❌ 主動推薦：「推薦老貓的飼料」
  → 拒絕：「我無法主動推薦特定飼料，但我可以幫您分析任何飼料的營養成分。您有正在考慮的飼料嗎？」

回應規則：
1. 語氣友善、專業，提供實用的營養分析
2. 基於營養成分和寵物需求進行客觀分析，不做商業推薦
3. 提醒飼主注意事項（如換糧過渡期、特殊健康狀況等）
4. 保持簡潔，3-5句話為佳
5. **最重要：不侵犯營養計算器的功能範圍，不給出具體餵食量**
6. **不顯示飼料卡片，不提供飼料 ID 列表**
"""
            user_message = f"""使用者問題：{user_input}

使用者的寵物資料：
{json.dumps(retrieved_data.get('user_pets', []), ensure_ascii=False, indent=2)}

飼料資料庫檢索結果：
{json.dumps(retrieved_data.get('recommended_feeds', []), ensure_ascii=False, indent=2)}

請根據使用者的寵物資料和飼料資料庫檢索結果，提供專業的營養分析和適合性評估。

**重要提醒**：
- 不要給出具體餵食量，而是引導使用者使用營養計算器功能
- 不要主動推薦飼料品牌，只能回答使用者詢問的特定飼料
- 如果使用者要求推薦，請禮貌拒絕並引導他們提供想了解的飼料
- **注意檢查飼料資料中的 is_verified 欄位，若為 false 必須在回應中提醒使用者該飼料資料尚未驗證**
- **處理找不到飼料的情況（recommended_feeds 為空）**：
  * 只說明資料庫中沒有該飼料資料
  * 不要提及寵物類型匹配問題
  * 引導使用者點擊「前往新增」按鈕
- **多寵物處理（只在有飼料資料時執行）**：
  1. 檢查使用者是否在問題中指定了寵物名字
  2. 若未指定，根據飼料的 pet_type（貓/狗）篩選相符類型的寵物
  3. 若有多隻相符寵物，必須詢問使用者要為哪一隻諮詢（列出寵物名字）
  4. 若只有一隻相符寵物，直接使用該寵物資料分析
  5. 若無相符寵物，告知使用者沒有適合該飼料的寵物類型"""

        else:
            # 其他意圖使用原本的 prompt
            system_prompt = """你是 Peter AI，一個友善專業的寵物照護助理。

根據以下資訊生成回應：
1. 使用者意圖分析結果
2. 從資料庫檢索到的相關資料
3. 使用者原始問題

請生成以下 JSON 格式的回應：
{
    "response": "友善且專業的回應文字（繁體中文）",
    "ui_controls": {
        "hasTutorial": false,
        "tutorialType": null,
        "hasRecommendedUsers": false,
        "hasRecommendedArticles": false,
        "hasCalculator": false,
        "hasOperation": false,
        "operationType": null
    },
    "additional_data": {
        "recommended_user_ids": [],
        "recommended_article_ids": [],
        "operation_params": {}
    }
}

回應規則：
1. 語氣友善、專業、有同理心
2. 根據檢索到的資料提供具體建議
3. **用戶推薦特殊規則**：
   - 如果意圖是 user_recommendation：
     * 檢查 retrieved_data 中的 users 列表
     * **如果有用戶**：將所有用戶的 id 填入 recommended_user_ids，設置 hasRecommendedUsers 為 true，回答「為您找到幾位飼主」
     * **如果沒有用戶（空列表）**：recommended_user_ids 留空，hasRecommendedUsers 為 false，誠實告知「目前沒有找到符合條件的用戶」
   - **不要**在回應中提到用戶的寵物品種（例如：不要說「養柴犬的用戶」）
   - **保持**用戶原始查詢的範圍（例如：用戶問「養狗的用戶」就說「養狗的朋友」）
   - 範例：
     * 用戶問「推薦養狗的用戶」且有結果 → 回答「為您找到幾位同樣養狗的朋友」
     * 用戶問「有沒有養布偶貓的朋友」且有結果 → 回答「為您找到幾位養布偶貓的飼主」
     * 用戶問「推薦養狗的用戶」但沒結果 → 回答「很抱歉，目前沒有找到養狗的用戶推薦」
4. 如果有推薦用戶或文章，要在回應中自然地提及
5. 如果需要執行操作，說明操作內容並設置對應的 ui_controls
6. 保持簡潔，2-4句話為佳
"""
            user_message = f"""使用者原始輸入：「{user_input}」

意圖分析：{json.dumps(intent_data, ensure_ascii=False)}

檢索資料：{json.dumps(retrieved_data, ensure_ascii=False)}

**重要提醒**：
- 如果意圖是 user_recommendation，請根據「使用者原始輸入」來描述推薦的用戶
- 不要自作主張縮小或擴大查詢範圍
- 例如：用戶說「養狗的用戶」→ 回答「養狗的朋友」（不是「養柴犬的用戶」）

請生成適當的回應。"""

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message}
                ],
                temperature=0.7,
                response_format={"type": "json_object"}
            )

            result = json.loads(response.choices[0].message.content)
            return {
                'success': True,
                'data': result
            }

        except Exception as e:
            print(f"OpenAI 回應生成錯誤: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'fallback': {
                    'response': '抱歉，我暫時無法處理您的請求。請稍後再試。',
                    'ui_controls': {},
                    'additional_data': {}
                }
            }

    def _format_case_details(self, case_details):
        """
        格式化案例詳情為易讀的文本

        Args:
            case_details (list): 案例詳細資料列表

        Returns:
            str: 格式化後的案例文本
        """
        if not case_details:
            return "未找到相似案例"

        formatted_cases = []
        for i, case in enumerate(case_details, 1):
            case_text = f"\n【案例 {i}】"
            case_text += f"\n標題: {case.get('archive_title', '未命名')}"

            if case.get('pet_info'):
                pet = case['pet_info']
                pet_parts = []
                if pet.get('name'):
                    pet_parts.append(pet['name'])
                if pet.get('type') and pet.get('breed'):
                    pet_parts.append(f"({pet['type']} - {pet['breed']})")
                elif pet.get('type'):
                    pet_parts.append(f"({pet['type']})")
                if pet_parts:
                    case_text += f"\n寵物: {' '.join(pet_parts)}"

            case_text += f"\n內容: {case.get('content', '無內容')}"
            case_text += f"\n健康狀態: {case.get('health_status', '未知')}"
            case_text += f"\n是否就醫: {'是' if case.get('go_to_doctor') else '否'}"

            formatted_cases.append(case_text)

        return "\n".join(formatted_cases)

    def generate_embedding(self, text):
        """
        生成文本嵌入向量

        Args:
            text (str): 要嵌入的文本

        Returns:
            list: 嵌入向量
        """
        try:
            response = self.client.embeddings.create(
                model="text-embedding-3-small",
                input=text
            )
            return response.data[0].embedding

        except Exception as e:
            print(f"OpenAI 嵌入生成錯誤: {str(e)}")
            return None